const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/common/db');
afterAll(() => pool.end());
const base = { correo: 'maria@correo.com', contrasena: 'Clave1234', nombres: 'María', rol: 'consumidor', consentimiento: true };
beforeAll(async () => { await pool.query("DELETE FROM consentimiento WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE correo = 'maria@correo.com')"); await pool.query("DELETE FROM usuario WHERE correo = 'maria@correo.com'"); });
test('VAL-01: rechaza correo sin dominio', async () => {
  const r = await request(app).post('/api/auth/registro').send({ ...base, correo: 'maria@' });
  expect(r.status).toBe(400);
});
test('rechaza registro sin consentimiento', async () => {
  const r = await request(app).post('/api/auth/registro').send({ ...base, consentimiento: false });
  expect(r.status).toBe(400);
});
test('registra, bloquea duplicado (VAL-02) e ingresa con JWT', async () => {
  expect((await request(app).post('/api/auth/registro').send(base)).status).toBe(201);
  expect((await request(app).post('/api/auth/registro').send(base)).status).toBe(409);
  const ok = await request(app).post('/api/auth/ingreso').send({ correo: base.correo, contrasena: base.contrasena });
  expect(ok.status).toBe(200); expect(ok.body.token).toBeDefined();
  expect((await request(app).post('/api/auth/ingreso').send({ correo: base.correo, contrasena: 'Mala1234' })).status).toBe(401);
});
test('health responde ok', async () => { expect((await request(app).get('/health')).body.estado).toBe('ok'); });
