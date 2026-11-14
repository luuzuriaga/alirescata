import { test, expect } from 'vitest';
import { ingresar, registrar, listarOfertas, reservar, misReservas, api } from './api.js';

const respuesta = (status, cuerpo) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => cuerpo });

test('devuelve el token cuando el ingreso es correcto', async () => {
  expect(await ingresar('a@b.com', 'Clave1234', respuesta(200, { token: 'abc' }))).toEqual({ ok: true, token: 'abc' });
});
test('informa credenciales incorrectas', async () => {
  const r = await ingresar('a@b.com', 'Mala1234', respuesta(401, {}));
  expect(r.ok).toBe(false);
  expect(r.mensaje).toMatch(/incorrectos/);
});
test('informa cuando no hay conexión', async () => {
  const r = await ingresar('a@b.com', 'Clave1234', async () => { throw new Error('red'); });
  expect(r.ok).toBe(false);
  expect(r.mensaje).toMatch(/conectar/);
});
test('registra una cuenta nueva', async () => {
  expect(await registrar({ correo: 'a@b.com' }, respuesta(201, { id_usuario: 1 }))).toEqual({ ok: true });
});
test('avisa cuando el correo ya está registrado', async () => {
  const r = await registrar({ correo: 'a@b.com' }, respuesta(409, {}));
  expect(r.ok).toBe(false);
  expect(r.mensaje).toMatch(/ya tiene una cuenta/);
});
test('trae las ofertas del catálogo', async () => {
  expect(await listarOfertas(respuesta(200, [{ id_oferta: 1 }]))).toEqual({ ok: true, ofertas: [{ id_oferta: 1 }] });
});
test('reserva y devuelve el código de recojo', async () => {
  let enviado;
  const pedir = async (url, opciones) => { enviado = opciones; return respuesta(201, { id_reserva: 7, codigo_recojo: '482196' })(); };
  expect(await reservar('tok', 3, 2, pedir)).toEqual({ ok: true, codigo: '482196' });
  expect(enviado.headers.Authorization).toBe('Bearer tok');
  expect(JSON.parse(enviado.body)).toEqual({ id_oferta: 3, cantidad: 2 });
});
test('avisa cuando la oferta se agotó o la sesión venció', async () => {
  expect((await reservar('tok', 3, 1, respuesta(409, {}))).agotada).toBe(true);
  expect((await reservar('tok', 3, 1, respuesta(401, {}))).expirada).toBe(true);
  expect((await reservar('tok', 3, 1, respuesta(403, {}))).mensaje).toMatch(/consumidor/);
});
test('trae mis reservas', async () => {
  expect(await misReservas('tok', respuesta(200, [{ id_reserva: 7 }]))).toEqual({ ok: true, reservas: [{ id_reserva: 7 }] });
  expect((await misReservas('tok', respuesta(401, {}))).expirada).toBe(true);
});
test('la llamada genérica envía la sesión y traduce los códigos de error', async () => {
  let enviado;
  const pedir = async (url, opciones) => { enviado = { url, ...opciones }; return respuesta(201, { id_oferta: 9 })(); };
  expect(await api('tok', 'POST', '/comercio/ofertas', { cantidad: 3 }, pedir)).toEqual({ ok: true, datos: { id_oferta: 9 } });
  expect(enviado.url).toMatch(/\/api\/comercio\/ofertas$/);
  expect(enviado.headers.Authorization).toBe('Bearer tok');
  expect(JSON.parse(enviado.body)).toEqual({ cantidad: 3 });
  const reclamada = await api('tok', 'POST', '/donaciones/4/reclamar', undefined, respuesta(409, { codigo: 'YA_RECLAMADA' }));
  expect(reclamada).toMatchObject({ ok: false, codigo: 'YA_RECLAMADA' });
  expect(reclamada.mensaje).toMatch(/Otra organización/);
  expect((await api('tok', 'GET', '/perfil', undefined, respuesta(401, {}))).expirada).toBe(true);
  expect((await api('tok', 'GET', '/perfil', undefined, async () => { throw new Error('red'); })).mensaje).toMatch(/conectar/);
});
