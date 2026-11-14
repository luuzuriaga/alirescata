const crypto = require('crypto');
const express = require('express');
const pool = require('../../common/db');
const { autenticar } = require('../../common/sesion');
const { ErrorHttp, ruta, soloRol, conEntidad, factorCo2 } = require('../../common/http');

const idDe = (texto) => {
  const id = Number(texto);
  if (!Number.isInteger(id) || id < 1) throw new ErrorHttp(400, 'VALIDACION');
  return id;
};

const DETALLE = `
  SELECT d.id_donacion, c.nombre_comercial, c.direccion, t.nombre AS distrito,
         COALESCE(o.descripcion_pack, p.nombre) AS alimentos, d.cantidad_packs,
         (d.cantidad_packs * o.peso_kg_pack)::float8 AS kg, d.recojo_desde, d.recojo_hasta, d.estado,
         k.codigo_constancia
    FROM donacion d
    JOIN oferta o ON o.id_oferta = d.id_oferta
    JOIN producto p ON p.id_producto = o.id_producto
    JOIN comercio c ON c.id_comercio = p.id_comercio
    JOIN distrito t ON t.id_distrito = c.id_distrito
    LEFT JOIN constancia k ON k.id_donacion = d.id_donacion`;

const organizacion = express.Router();
organizacion.use(autenticar, soloRol('organizacion'), conEntidad('organizacion'));

// Donaciones por recoger: las libres y las que ya reclamó otra organización (para que se vea que se fueron).
organizacion.get('/disponibles', ruta(async (req, res) => {
  const r = await pool.query(
    `${DETALLE}
      WHERE d.recojo_hasta > now()
        AND (d.estado = 'disponible' OR (d.estado = 'reclamada' AND d.id_organizacion <> $1))
      ORDER BY d.recojo_desde, d.id_donacion`, [req.organizacion.id_organizacion]);
  res.json(r.rows);
}));

organizacion.get('/mias', ruta(async (req, res) => {
  const r = await pool.query(
    `${DETALLE}
      WHERE d.id_organizacion = $1 AND d.estado IN ('reclamada','recibida')
      ORDER BY (d.estado = 'reclamada') DESC, d.recojo_desde DESC LIMIT 50`, [req.organizacion.id_organizacion]);
  res.json(r.rows);
}));

// Gana quien reclama primero: la actualización solo afecta a una donación que siga disponible.
organizacion.post('/:id/reclamar', ruta(async (req, res) => {
  const r = await pool.query(
    `UPDATE donacion SET estado = 'reclamada', id_organizacion = $2, reclamada_en = now()
      WHERE id_donacion = $1 AND estado = 'disponible' AND recojo_hasta > now()
     RETURNING id_donacion`, [idDe(req.params.id), req.organizacion.id_organizacion]);
  if (!r.rowCount) throw new ErrorHttp(409, 'YA_RECLAMADA');
  res.json({ id_donacion: r.rows[0].id_donacion, estado: 'reclamada' });
}));

// Al confirmar la recepción se emite la constancia.
organizacion.post('/:id/recibir', ruta(async (req, res) => {
  const id = idDe(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = await client.query(
      `UPDATE donacion SET estado = 'recibida', recibida_en = now()
        WHERE id_donacion = $1 AND estado = 'reclamada' AND id_organizacion = $2
       RETURNING id_donacion, id_oferta, cantidad_packs, recibida_en`, [id, req.organizacion.id_organizacion]);
    if (!d.rowCount) throw new ErrorHttp(409, 'NO_RECLAMADA');
    const n = (await client.query("SELECT nextval(pg_get_serial_sequence('constancia','id_constancia')) AS n")).rows[0].n;
    const codigo = `ALR-${new Date(d.rows[0].recibida_en).getFullYear()}-${String(n).padStart(6, '0')}`;
    const huella = crypto.createHash('sha256')
      .update(JSON.stringify({ codigo, ...d.rows[0], id_organizacion: req.organizacion.id_organizacion })).digest('hex');
    await client.query(
      'INSERT INTO constancia (id_constancia, id_donacion, codigo_constancia, ruta_pdf, hash_sha256) VALUES ($1,$2,$3,$4,$5)',
      [n, id, codigo, `constancias/${codigo}.pdf`, huella]);
    await client.query('COMMIT');
    res.status(201).json({ id_donacion: id, codigo_constancia: codigo });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

organizacion.get('/impacto', ruta(async (req, res) => {
  const [r, factor] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(d.cantidad_packs * o.peso_kg_pack),0)::float8 AS kg, COUNT(*)::int AS donaciones,
              COALESCE(SUM(d.cantidad_packs),0)::int AS packs, COUNT(k.id_constancia)::int AS constancias
         FROM donacion d JOIN oferta o ON o.id_oferta = d.id_oferta
         LEFT JOIN constancia k ON k.id_donacion = d.id_donacion
        WHERE d.id_organizacion = $1 AND d.estado = 'recibida'`, [req.organizacion.id_organizacion]),
    factorCo2(),
  ]);
  const t = r.rows[0];
  res.json({ kg_recibidos: t.kg, co2_evitado: t.kg * factor, donaciones: t.donaciones, packs: t.packs, constancias: t.constancias, factor });
}));

// Constancias: las ven el comercio donante, la organización receptora y administración.
const constancias = express.Router();
constancias.use(autenticar, soloRol('comercio', 'organizacion', 'administrador'));

const CONSTANCIA = `
  SELECT k.codigo_constancia, k.emitida_en, k.hash_sha256,
         c.nombre_comercial, c.ruc AS ruc_comercio, t.nombre AS distrito,
         g.razon_social AS organizacion, g.ruc AS ruc_organizacion, g.tipo AS tipo_organizacion,
         COALESCE(o.descripcion_pack, p.nombre) AS descripcion, d.cantidad_packs,
         (d.cantidad_packs * o.peso_kg_pack)::float8 AS kg, d.reclamada_en, d.recibida_en
    FROM constancia k
    JOIN donacion d ON d.id_donacion = k.id_donacion
    JOIN oferta o ON o.id_oferta = d.id_oferta
    JOIN producto p ON p.id_producto = o.id_producto
    JOIN comercio c ON c.id_comercio = p.id_comercio
    JOIN distrito t ON t.id_distrito = c.id_distrito
    JOIN organizacion g ON g.id_organizacion = d.id_organizacion`;
// Cada rol solo alcanza las constancias en las que participa.
const alcance = (usuario) => {
  if (usuario.rol === 'comercio') return ['c.id_usuario = $1', [usuario.id]];
  if (usuario.rol === 'organizacion') return ['g.id_usuario = $1', [usuario.id]];
  return ['$1::int IS NOT NULL', [usuario.id]];
};

constancias.get('/', ruta(async (req, res) => {
  const [filtro, valores] = alcance(req.usuario);
  const r = await pool.query(`${CONSTANCIA} WHERE ${filtro} ORDER BY k.emitida_en DESC LIMIT 100`, valores);
  res.json(r.rows.map((k) => ({ codigo_constancia: k.codigo_constancia, emitida_en: k.emitida_en, nombre_comercial: k.nombre_comercial, organizacion: k.organizacion, descripcion: k.descripcion, cantidad_packs: k.cantidad_packs, kg: k.kg })));
}));

constancias.get('/:codigo', ruta(async (req, res) => {
  const [filtro, valores] = alcance(req.usuario);
  const [r, factor] = await Promise.all([
    pool.query(`${CONSTANCIA} WHERE ${filtro} AND k.codigo_constancia = $2`, [...valores, req.params.codigo]),
    factorCo2(),
  ]);
  if (!r.rowCount) throw new ErrorHttp(404, 'NO_ENCONTRADA');
  res.json({ ...r.rows[0], co2_evitado: r.rows[0].kg * factor });
}));

module.exports = { organizacion, constancias };
