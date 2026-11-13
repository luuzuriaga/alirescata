import { test, expect } from 'vitest';
import { ingresar, registrar } from './api.js';

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
