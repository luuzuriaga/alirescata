const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../../common/db');

const registroSchema = z.object({
  correo: z.string().trim().toLowerCase().email().max(120),
  contrasena: z.string().min(8).max(64).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/),
  nombres: z.string().trim().min(2).max(80),
  telefono: z.string().regex(/^9\d{8}$/).optional(),
  rol: z.enum(['consumidor', 'comercio', 'organizacion']),
  consentimiento: z.literal(true),
});

async function registrar(datos) {
  const d = registroSchema.parse(datos);
  const hash = await bcrypt.hash(d.contrasena, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      'INSERT INTO usuario (correo, hash_contrasena, nombres, telefono, rol) VALUES ($1,$2,$3,$4,$5) RETURNING id_usuario, rol',
      [d.correo, hash, d.nombres, d.telefono || null, d.rol]);
    await client.query('INSERT INTO consentimiento (id_usuario, version_politica) VALUES ($1,$2)', [r.rows[0].id_usuario, 'v1']);
    await client.query('COMMIT');
    return r.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function ingresar(correo, contrasena) {
  const r = await pool.query('SELECT id_usuario, hash_contrasena, rol FROM usuario WHERE correo = $1 AND estado = \'activo\'', [String(correo).toLowerCase()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(String(contrasena), u.hash_contrasena))) return null;
  return jwt.sign({ sub: u.id_usuario, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '2h' });
}
module.exports = { registrar, ingresar, registroSchema };
