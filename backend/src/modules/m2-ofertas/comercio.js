const express = require('express');
const { z } = require('zod');
const pool = require('../../common/db');
const { autenticar } = require('../../common/sesion');
const { ErrorHttp, ruta, soloRol, conEntidad, HORA, EN_LIMA, factorCo2 } = require('../../common/http');

const ofertaSchema = z.object({
  nombre: z.string().trim().min(3).max(100),
  id_categoria: z.number().int().positive(),
  descripcion_pack: z.string().trim().max(250).optional(),
  cantidad: z.number().int().min(1).max(99),
  peso_kg: z.number().positive().max(999).optional(),
  precio_regular: z.number().positive().max(999999),
  precio_oferta: z.number().positive().max(999999),
  recojo_desde: z.string().regex(HORA),
  recojo_hasta: z.string().regex(HORA),
  alergenos: z.array(z.number().int().positive()).max(20),
}).refine((d) => d.precio_oferta < d.precio_regular, { path: ['precio_oferta'] })
  .refine((d) => d.recojo_hasta > d.recojo_desde, { path: ['recojo_hasta'] });

const donarSchema = z.object({
  recojo_desde: z.string().regex(HORA),
  recojo_hasta: z.string().regex(HORA),
  manana: z.boolean().optional(),
}).refine((d) => d.recojo_hasta > d.recojo_desde, { path: ['recojo_hasta'] });

// "María Pérez" se muestra como "María P." en el mostrador.
const nombreCorto = (nombres) => {
  const [primero, segundo] = String(nombres).trim().split(/\s+/);
  return segundo ? `${primero} ${segundo[0].toUpperCase()}.` : primero;
};
const idDe = (texto) => {
  const id = Number(texto);
  if (!Number.isInteger(id) || id < 1) throw new ErrorHttp(400, 'VALIDACION');
  return id;
};

const router = express.Router();
router.use(autenticar, soloRol('comercio'), conEntidad('comercio'));

router.post('/ofertas', ruta(async (req, res) => {
  const d = ofertaSchema.parse(req.body);
  const idComercio = req.comercio.id_comercio;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cat = await client.query('SELECT 1 FROM categoria WHERE id_categoria = $1 AND permitida_piloto', [d.id_categoria]);
    if (!cat.rowCount) throw new ErrorHttp(400, 'VALIDACION');
    let prod = await client.query(
      'SELECT id_producto FROM producto WHERE id_comercio = $1 AND id_categoria = $2 AND lower(nombre) = lower($3) AND activo',
      [idComercio, d.id_categoria, d.nombre]);
    if (!prod.rowCount) {
      prod = await client.query('INSERT INTO producto (id_comercio, id_categoria, nombre) VALUES ($1,$2,$3) RETURNING id_producto',
        [idComercio, d.id_categoria, d.nombre]);
    }
    const o = await client.query(
      `INSERT INTO oferta (id_producto, descripcion_pack, stock_inicial, stock_disponible, peso_kg_pack, precio_regular, precio_oferta, ventana_inicio, ventana_fin)
       VALUES ($1,$2,$3,$3,$4,$5,$6, ${EN_LIMA('$7', '0')}, ${EN_LIMA('$8', '0')})
       RETURNING id_oferta, ventana_fin > now() AS vigente`,
      [prod.rows[0].id_producto, d.descripcion_pack || null, d.cantidad, d.peso_kg || 1, d.precio_regular, d.precio_oferta, d.recojo_desde, d.recojo_hasta]);
    if (!o.rows[0].vigente) throw new ErrorHttp(400, 'VENTANA_PASADA');
    for (const idAlergeno of [...new Set(d.alergenos)]) {
      await client.query('INSERT INTO oferta_alergeno (id_oferta, id_alergeno) VALUES ($1,$2)', [o.rows[0].id_oferta, idAlergeno]);
    }
    await client.query('COMMIT');
    res.status(201).json({ id_oferta: o.rows[0].id_oferta });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23503') throw new ErrorHttp(400, 'VALIDACION');
    throw e;
  } finally { client.release(); }
}));

router.get('/ofertas', ruta(async (req, res) => {
  const r = await pool.query(
    `SELECT o.id_oferta, p.nombre, o.descripcion_pack, o.stock_inicial, o.stock_disponible,
            o.precio_regular::float8 AS precio_regular, o.precio_oferta::float8 AS precio_oferta,
            o.ventana_inicio, o.ventana_fin, o.estado, o.ventana_fin <= now() AS vencida,
            COALESCE((SELECT SUM(r.cantidad) FROM reserva r WHERE r.id_oferta = o.id_oferta AND r.estado IN ('activa','entregada')), 0)::int AS reservados,
            EXISTS (SELECT 1 FROM donacion d WHERE d.id_oferta = o.id_oferta AND d.estado <> 'cancelada') AS donada
       FROM oferta o JOIN producto p ON p.id_producto = o.id_producto
      WHERE p.id_comercio = $1
      ORDER BY o.creado_en DESC LIMIT 50`, [req.comercio.id_comercio]);
  res.json(r.rows);
}));

router.get('/reservas/hoy', ruta(async (req, res) => {
  const r = await pool.query(
    `SELECT r.id_reserva, r.codigo_recojo, r.cantidad, r.estado, u.nombres
       FROM reserva r
       JOIN oferta o ON o.id_oferta = r.id_oferta
       JOIN producto p ON p.id_producto = o.id_producto
       JOIN usuario u ON u.id_usuario = r.id_consumidor
      WHERE p.id_comercio = $1 AND r.estado IN ('activa','entregada')
        AND (o.ventana_fin AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date
      ORDER BY (r.estado = 'activa') DESC, r.reservada_en DESC`, [req.comercio.id_comercio]);
  res.json(r.rows.map(({ nombres, ...resto }) => ({ ...resto, cliente: nombreCorto(nombres) })));
}));

router.get('/reservas/codigo/:codigo', ruta(async (req, res) => {
  if (!/^\d{6}$/.test(req.params.codigo)) throw new ErrorHttp(400, 'VALIDACION');
  const r = await pool.query(
    `SELECT r.id_reserva, r.codigo_recojo, r.cantidad, r.estado, r.entregada_en,
            (r.cantidad * r.precio_unitario)::float8 AS monto,
            p.nombre, o.ventana_inicio, o.ventana_fin, u.nombres
       FROM reserva r
       JOIN oferta o ON o.id_oferta = r.id_oferta
       JOIN producto p ON p.id_producto = o.id_producto
       JOIN usuario u ON u.id_usuario = r.id_consumidor
      WHERE p.id_comercio = $1 AND r.codigo_recojo = $2
      ORDER BY (r.estado = 'activa') DESC, r.reservada_en DESC LIMIT 1`, [req.comercio.id_comercio, req.params.codigo]);
  if (!r.rowCount) throw new ErrorHttp(404, 'CODIGO_NO_ENCONTRADO');
  const { nombres, ...resto } = r.rows[0];
  res.json({ ...resto, cliente: nombreCorto(nombres) });
}));

router.post('/reservas/:id/entregar', ruta(async (req, res) => {
  const id = idDe(req.params.id);
  const metodo = z.enum(['efectivo', 'billetera_digital']).parse(req.body && req.body.metodo);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE reserva r SET estado = 'entregada', entregada_en = now()
         FROM oferta o JOIN producto p ON p.id_producto = o.id_producto
        WHERE r.id_reserva = $1 AND r.estado = 'activa' AND o.id_oferta = r.id_oferta AND p.id_comercio = $2
       RETURNING r.id_reserva, (r.cantidad * r.precio_unitario) AS monto`, [id, req.comercio.id_comercio]);
    if (!r.rowCount) throw new ErrorHttp(409, 'RESERVA_NO_ACTIVA');
    await client.query('INSERT INTO pago (id_reserva, monto, metodo) VALUES ($1,$2,$3)', [id, r.rows[0].monto, metodo]);
    await client.query('COMMIT');
    res.json({ id_reserva: id, estado: 'entregada' });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

// Cierre del día: los packs que no se vendieron pasan a donación y la oferta se cierra.
router.post('/ofertas/:id/donar', ruta(async (req, res) => {
  const id = idDe(req.params.id);
  const d = donarSchema.parse(req.body);
  const dias = d.manana ? 1 : 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query(
      `SELECT o.stock_disponible FROM oferta o JOIN producto p ON p.id_producto = o.id_producto
        WHERE o.id_oferta = $1 AND p.id_comercio = $2 AND o.estado = 'publicada' FOR UPDATE OF o`, [id, req.comercio.id_comercio]);
    if (!o.rowCount || o.rows[0].stock_disponible < 1) throw new ErrorHttp(409, 'SIN_SOBRANTE');
    const don = await client.query(
      `INSERT INTO donacion (id_oferta, cantidad_packs, recojo_desde, recojo_hasta)
       VALUES ($1,$2, ${EN_LIMA('$3', '$5')}, ${EN_LIMA('$4', '$5')})
       RETURNING id_donacion, cantidad_packs, recojo_hasta > now() AS vigente`,
      [id, o.rows[0].stock_disponible, d.recojo_desde, d.recojo_hasta, dias]);
    if (!don.rows[0].vigente) throw new ErrorHttp(400, 'VENTANA_PASADA');
    await client.query("UPDATE oferta SET stock_disponible = 0, estado = 'cerrada' WHERE id_oferta = $1", [id]);
    await client.query('COMMIT');
    res.status(201).json({ id_donacion: don.rows[0].id_donacion, cantidad_packs: don.rows[0].cantidad_packs });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

router.get('/donaciones', ruta(async (req, res) => {
  const r = await pool.query(
    `SELECT d.id_donacion, p.nombre, o.descripcion_pack, d.cantidad_packs,
            (d.cantidad_packs * o.peso_kg_pack)::float8 AS kg, d.recojo_desde, d.recojo_hasta, d.estado,
            g.razon_social AS organizacion, k.codigo_constancia
       FROM donacion d
       JOIN oferta o ON o.id_oferta = d.id_oferta
       JOIN producto p ON p.id_producto = o.id_producto
       LEFT JOIN organizacion g ON g.id_organizacion = d.id_organizacion
       LEFT JOIN constancia k ON k.id_donacion = d.id_donacion
      WHERE p.id_comercio = $1
      ORDER BY d.recojo_desde DESC LIMIT 50`, [req.comercio.id_comercio]);
  res.json(r.rows);
}));

router.get('/impacto', ruta(async (req, res) => {
  const id = req.comercio.id_comercio;
  const [ventas, donado, constancias, publicado, semanas, factor] = await Promise.all([
    pool.query('SELECT COALESCE(kg_vendidos,0)::float8 AS kg, COALESCE(ingreso_recuperado,0)::float8 AS ingreso FROM v_impacto_comercio WHERE id_comercio = $1', [id]),
    pool.query('SELECT COALESCE(kg_donados,0)::float8 AS kg FROM v_kg_donados_comercio WHERE id_comercio = $1', [id]),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM constancia k JOIN donacion d ON d.id_donacion = k.id_donacion
         JOIN oferta o ON o.id_oferta = d.id_oferta JOIN producto p ON p.id_producto = o.id_producto WHERE p.id_comercio = $1`, [id]),
    pool.query(
      `SELECT COALESCE(SUM(o.stock_inicial * o.peso_kg_pack),0)::float8 AS kg
         FROM oferta o JOIN producto p ON p.id_producto = o.id_producto
        WHERE p.id_comercio = $1 AND o.estado <> 'anulada' AND (o.estado IN ('cerrada','agotada') OR o.ventana_fin <= now())`, [id]),
    pool.query(
      `WITH semanas AS (
         SELECT generate_series(date_trunc('week', now()) - interval '4 weeks', date_trunc('week', now()), interval '1 week') AS inicio),
       mov AS (
         SELECT r.entregada_en AS cuando, r.cantidad * o.peso_kg_pack AS kg
           FROM reserva r JOIN oferta o ON o.id_oferta = r.id_oferta JOIN producto p ON p.id_producto = o.id_producto
          WHERE p.id_comercio = $1 AND r.estado = 'entregada'
         UNION ALL
         SELECT d.recibida_en, d.cantidad_packs * o.peso_kg_pack
           FROM donacion d JOIN oferta o ON o.id_oferta = d.id_oferta JOIN producto p ON p.id_producto = o.id_producto
          WHERE p.id_comercio = $1 AND d.estado = 'recibida')
       SELECT s.inicio, COALESCE(SUM(m.kg),0)::float8 AS kg
         FROM semanas s LEFT JOIN mov m ON m.cuando >= s.inicio AND m.cuando < s.inicio + interval '1 week'
        GROUP BY s.inicio ORDER BY s.inicio`, [id]),
    factorCo2(),
  ]);
  const kgVendidos = ventas.rows[0] ? ventas.rows[0].kg : 0;
  const kgDonados = donado.rows[0] ? donado.rows[0].kg : 0;
  const rescatado = kgVendidos + kgDonados;
  const noAprovechado = Math.max(publicado.rows[0].kg - rescatado, 0);
  res.json({
    kg_rescatados: rescatado,
    co2_evitado: rescatado * factor,
    ingreso_recuperado: ventas.rows[0] ? ventas.rows[0].ingreso : 0,
    constancias: constancias.rows[0].n,
    semanas: semanas.rows.map((s) => s.kg),
    destino: { vendido: kgVendidos, donado: kgDonados, no_aprovechado: noAprovechado },
    factor,
  });
}));

module.exports = router;
