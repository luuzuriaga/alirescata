const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/common/db');
afterAll(() => pool.end());

describe('CORS', () => {
  const previo = process.env.CORS_ORIGIN;
  beforeAll(() => { process.env.CORS_ORIGIN = 'https://web.ejemplo.com, http://localhost:5173/'; });
  afterAll(() => { if (previo === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = previo; });

  test('permite un origen de la lista', async () => {
    const r = await request(app).get('/health').set('Origin', 'https://web.ejemplo.com');
    expect(r.headers['access-control-allow-origin']).toBe('https://web.ejemplo.com');
  });
  test('no autoriza un origen ajeno', async () => {
    const r = await request(app).get('/health').set('Origin', 'https://otro.ejemplo.com');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
  test('responde el preflight con 204', async () => {
    const r = await request(app).options('/api/auth/ingreso').set('Origin', 'http://localhost:5173');
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-headers']).toMatch(/Content-Type/);
  });
});
