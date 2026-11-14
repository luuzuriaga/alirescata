const express = require('express');
const { z } = require('zod');
const pool = require('../../common/db');
const { autenticar } = require('../../common/sesion');
const { ErrorHttp, ruta, soloRol } = require('../../common/http');

const decisionSchema = z.object({
  tipo: z.enum(['comercio', 'organizacion']),
  id: z.number().int().positive(),
  resultado: z.enum(['aprobado', 'rechazado']),
  motivo: z.string().trim().max(250).optional(),
}).refine((d) => d.resultado === 'aprobado' || (d.motivo && d.motivo.length >= 5), { path: ['motivo'] });

const router = express.Router();
router.use(autenticar, soloRol('administrador'));

router.get('/verificaciones', ruta(async (_req, res) => {
  const r = await pool.query(
    `SELECT 'comercio' AS tipo, c.id_comercio AS id, c.nombre_comercial AS solicitante, c.ruc, d.nombre AS distrito,
            c.direccion, c.tipo_comercio AS rubro, u.creado_en AS enviada
       FROM comercio c JOIN distrito d ON d.id_distrito = c.id_distrito JOIN usuario u ON u.id_usuario = c.id_usuario
      WHERE c.estado_verificacion = 'pendiente'
     UNION ALL
     SELECT 'organizacion', o.id_organizacion, o.razon_social, o.ruc, d.nombre, o.direccion, o.tipo, u.creado_en
       FROM organizacion o JOIN distrito d ON d.id_distrito = o.id_distrito JOIN usuario u ON u.id_usuario = o.id_usuario
      WHERE o.estado_verificacion = 'pendiente'
     ORDER BY enviada, solicitante`);
  res.json(r.rows);
}));

router.post('/verificaciones', ruta(async (req, res) => {
  const d = decisionSchema.parse(req.body);
  const [tabla, clave] = d.tipo === 'comercio' ? ['comercio', 'id_comercio'] : ['organizacion', 'id_organizacion'];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `UPDATE ${tabla} SET estado_verificacion = $2 WHERE ${clave} = $1 AND estado_verificacion = 'pendiente' RETURNING ${clave}`,
      [d.id, d.resultado]);
    if (!u.rowCount) throw new ErrorHttp(409, 'YA_REVISADA');
    await client.query(
      `INSERT INTO verificacion (${clave}, id_admin, resultado, motivo) VALUES ($1,$2,$3,$4)`,
      [d.id, req.usuario.id, d.resultado, d.resultado === 'rechazado' ? d.motivo : (d.motivo || null)]);
    await client.query('COMMIT');
    res.json({ tipo: d.tipo, id: d.id, estado: d.resultado });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

module.exports = router;
