const express = require('express');
const { z } = require('zod');
const pool = require('../../common/db');
const { rucValido } = require('../../common/ruc');
const { autenticar } = require('../../common/sesion');
const { ruta, soloRol, HORA } = require('../../common/http');

const ruc = z.string().refine(rucValido, 'RUC inválido');
const comercioSchema = z.object({
  ruc,
  razon_social: z.string().trim().min(2).max(150),
  nombre_comercial: z.string().trim().min(2).max(100),
  direccion: z.string().trim().min(5).max(150),
  id_distrito: z.number().int().positive(),
  tipo_comercio: z.enum(['panaderia', 'cafe', 'restaurante', 'minimercado', 'otro']),
  hora_apertura: z.string().regex(HORA),
  hora_cierre: z.string().regex(HORA),
});
const organizacionSchema = z.object({
  ruc,
  razon_social: z.string().trim().min(2).max(150),
  tipo: z.enum(['banco_alimentos', 'comedor', 'ong', 'otro']),
  direccion: z.string().trim().min(5).max(150),
  id_distrito: z.number().int().positive(),
});

const router = express.Router();

// Listas para los formularios: distritos del piloto, categorías permitidas y alérgenos.
router.get('/catalogos', ruta(async (_req, res) => {
  const [distritos, categorias, alergenos] = await Promise.all([
    pool.query('SELECT id_distrito, nombre FROM distrito WHERE activo_piloto ORDER BY id_distrito'),
    pool.query('SELECT id_categoria, nombre FROM categoria WHERE permitida_piloto ORDER BY id_categoria'),
    pool.query('SELECT id_alergeno, nombre FROM alergeno ORDER BY id_alergeno'),
  ]);
  res.json({ distritos: distritos.rows, categorias: categorias.rows, alergenos: alergenos.rows });
}));

router.get('/perfil', autenticar, ruta(async (req, res) => {
  const u = (await pool.query('SELECT nombres, correo, rol FROM usuario WHERE id_usuario = $1', [req.usuario.id])).rows[0];
  if (!u) return res.status(401).json({ codigo: 'SESION_INVALIDA' });
  let entidad = null;
  if (u.rol === 'comercio') {
    entidad = (await pool.query(
      `SELECT c.nombre_comercial AS nombre, c.estado_verificacion AS estado, d.nombre AS distrito,
              (SELECT v.motivo FROM verificacion v WHERE v.id_comercio = c.id_comercio ORDER BY v.verificado_en DESC LIMIT 1) AS motivo
         FROM comercio c JOIN distrito d ON d.id_distrito = c.id_distrito WHERE c.id_usuario = $1`, [req.usuario.id])).rows[0] || null;
  } else if (u.rol === 'organizacion') {
    entidad = (await pool.query(
      `SELECT o.razon_social AS nombre, o.estado_verificacion AS estado, d.nombre AS distrito,
              (SELECT v.motivo FROM verificacion v WHERE v.id_organizacion = o.id_organizacion ORDER BY v.verificado_en DESC LIMIT 1) AS motivo
         FROM organizacion o JOIN distrito d ON d.id_distrito = o.id_distrito WHERE o.id_usuario = $1`, [req.usuario.id])).rows[0] || null;
  }
  res.json({ nombres: u.nombres, correo: u.correo, rol: u.rol, entidad });
}));

router.post('/comercios', autenticar, soloRol('comercio'), ruta(async (req, res) => {
  const d = comercioSchema.parse(req.body);
  const r = await pool.query(
    `INSERT INTO comercio (id_usuario, ruc, razon_social, nombre_comercial, direccion, id_distrito, tipo_comercio, hora_apertura, hora_cierre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_comercio, estado_verificacion`,
    [req.usuario.id, d.ruc, d.razon_social, d.nombre_comercial, d.direccion, d.id_distrito, d.tipo_comercio, d.hora_apertura, d.hora_cierre]);
  res.status(201).json(r.rows[0]);
}));

router.post('/organizaciones', autenticar, soloRol('organizacion'), ruta(async (req, res) => {
  const d = organizacionSchema.parse(req.body);
  const r = await pool.query(
    `INSERT INTO organizacion (id_usuario, ruc, razon_social, tipo, direccion, id_distrito)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_organizacion, estado_verificacion`,
    [req.usuario.id, d.ruc, d.razon_social, d.tipo, d.direccion, d.id_distrito]);
  res.status(201).json(r.rows[0]);
}));

module.exports = router;
