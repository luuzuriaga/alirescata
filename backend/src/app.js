const express = require('express');
const { ZodError } = require('zod');
const { registrar, ingresar } = require('./modules/m1-identidad/auth');
const { listarOfertas } = require('./modules/m2-ofertas/catalogo');
const { reservar, reservasDe, SinStock } = require('./modules/m3-reservas/reservar');
const { autenticar } = require('./common/sesion');
const perfil = require('./modules/m1-identidad/perfil');
const comercio = require('./modules/m2-ofertas/comercio');
const donaciones = require('./modules/m4-donaciones/donaciones');
const administracion = require('./modules/m5-administracion/verificaciones');

const cors = require('./common/cors');

const app = express();
app.use(cors);
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
app.get('/api/ofertas', async (_req, res) => {
  try { res.json(await listarOfertas()); }
  catch { res.status(500).json({ codigo: 'ERROR' }); }
});
app.post('/api/reservas', autenticar, async (req, res) => {
  if (req.usuario.rol !== 'consumidor') return res.status(403).json({ codigo: 'SOLO_CONSUMIDOR' });
  const { id_oferta: idOferta, cantidad } = req.body || {};
  if (!Number.isInteger(idOferta) || idOferta < 1 || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 5) {
    return res.status(400).json({ codigo: 'VALIDACION' });
  }
  try { res.status(201).json(await reservar(idOferta, req.usuario.id, cantidad)); }
  catch (e) {
    if (e instanceof SinStock) return res.status(409).json({ codigo: 'SIN_STOCK' });
    return res.status(500).json({ codigo: 'ERROR' });
  }
});
app.get('/api/reservas/mias', autenticar, async (req, res) => {
  try { res.json(await reservasDe(req.usuario.id)); }
  catch { res.status(500).json({ codigo: 'ERROR' }); }
});
app.use('/api', perfil);
app.use('/api/comercio', comercio);
app.use('/api/donaciones', donaciones.organizacion);
app.use('/api/constancias', donaciones.constancias);
app.use('/api/admin', administracion);
module.exports = app;
