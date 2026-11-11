const express = require('express');
const { ZodError } = require('zod');
const { registrar, ingresar } = require('./modules/m1-identidad/auth');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.get('/health', (_req, res) => res.json({ estado: 'ok' }));
app.post('/api/auth/registro', async (req, res) => {
  try { res.status(201).json(await registrar(req.body)); }
  catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ codigo: 'VALIDACION', campos: e.issues.map(i => i.path.join('.')) });
    if (e.code === '23505') return res.status(409).json({ codigo: 'CORREO_DUPLICADO' });
    return res.status(500).json({ codigo: 'ERROR' });
  }
});
app.post('/api/auth/ingreso', async (req, res) => {
  const token = await ingresar(req.body.correo, req.body.contrasena);
  if (!token) return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
  res.json({ token });
});
module.exports = app;
