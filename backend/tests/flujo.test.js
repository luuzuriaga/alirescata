// Recorrido completo: verificación, publicación, reserva, entrega, cierre del día, donación y constancia.
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/common/db');
afterAll(() => pool.end());

const marca = Date.now();
const clave = 'Clave1234';
// RUC válido y distinto en cada corrida, para poder repetir la prueba sobre la misma base.
function rucNuevo(n) {
  const base = `20${String(marca + n).slice(-8)}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let d = 11 - (pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0) % 11);
  if (d === 10) d = 0;
  if (d === 11) d = 1;
  return base + d;
}
const como = (token) => ({ Authorization: `Bearer ${token}` });
async function cuenta(nombre, rol) {
  const correo = `${nombre}${marca}@flujo.pe`;
  await request(app).post('/api/auth/registro').send({ correo, contrasena: clave, nombres: 'María Pérez', rol, consentimiento: true });
  return (await request(app).post('/api/auth/ingreso').send({ correo, contrasena: clave })).body.token;
}

let comercio, organizacion, otraOrganizacion, consumidor, admin, idOferta, idDonacion, codigo, constancia;

beforeAll(async () => {
  const correo = `admin${marca}@flujo.pe`;
  await pool.query("INSERT INTO usuario (correo, hash_contrasena, nombres, rol) VALUES ($1,$2,'Admin','administrador')", [correo, await bcrypt.hash(clave, 4)]);
  admin = (await request(app).post('/api/auth/ingreso').send({ correo, contrasena: clave })).body.token;
  [comercio, organizacion, otraOrganizacion, consumidor] = await Promise.all([
    cuenta('comercio', 'comercio'), cuenta('org', 'organizacion'), cuenta('org2', 'organizacion'), cuenta('consumidor', 'consumidor'),
  ]);
});

const datosComercio = () => ({ ruc: rucNuevo(1), razon_social: 'Sol Naciente SAC', nombre_comercial: `Panadería Sol ${marca}`, direccion: 'Av. Brasil 1500', id_distrito: 2, tipo_comercio: 'panaderia', hora_apertura: '07:00', hora_cierre: '21:00' });
const datosOferta = () => ({ nombre: 'Pack de panes artesanales', id_categoria: 1, descripcion_pack: '6 panes del día', cantidad: 3, peso_kg: 1, precio_regular: 12, precio_oferta: 6, recojo_desde: '00:00', recojo_hasta: '23:59', alergenos: [1, 2] });

test('perfil y catálogos para los formularios', async () => {
  const p = await request(app).get('/api/perfil').set(como(comercio));
  expect(p.body).toMatchObject({ rol: 'comercio', entidad: null });
  const c = await request(app).get('/api/catalogos');
  expect(c.body.distritos).toHaveLength(3);
  expect(c.body.alergenos.map((a) => a.nombre)).toContain('Gluten');
});

test('el comercio registra sus datos y queda en revisión', async () => {
  expect((await request(app).post('/api/comercios').set(como(comercio)).send({ ...datosComercio(), ruc: '20100070971' })).status).toBe(400);
  expect((await request(app).post('/api/comercios').set(como(consumidor)).send(datosComercio())).status).toBe(403);
  expect((await request(app).post('/api/comercios').set(como(comercio)).send(datosComercio())).status).toBe(201);
  expect((await request(app).post('/api/comercios').set(como(comercio)).send(datosComercio())).status).toBe(409);
  const sinAprobar = await request(app).post('/api/comercio/ofertas').set(como(comercio)).send(datosOferta());
  expect(sinAprobar.status).toBe(403);
  expect(sinAprobar.body.codigo).toBe('SIN_VERIFICAR');
});

test('administración aprueba o rechaza con motivo', async () => {
  for (const [token, n, razon] of [[organizacion, 2, 'Banco de Alimentos Oeste'], [otraOrganizacion, 3, 'Comedor Santa Rosa']]) {
    const r = await request(app).post('/api/organizaciones').set(como(token)).send({ ruc: rucNuevo(n), razon_social: `${razon} ${marca}`, tipo: 'ong', direccion: 'Jr. Castilla 480', id_distrito: 3 });
    expect(r.status).toBe(201);
  }
  expect((await request(app).get('/api/admin/verificaciones').set(como(comercio))).status).toBe(403);
  const cola = (await request(app).get('/api/admin/verificaciones').set(como(admin))).body;
  const mias = cola.filter((s) => s.solicitante.endsWith(String(marca)));
  expect(mias.map((s) => s.tipo).sort()).toEqual(['comercio', 'organizacion', 'organizacion']);
  const [tienda] = mias.filter((s) => s.tipo === 'comercio');
  const [banco, comedor] = mias.filter((s) => s.tipo === 'organizacion').sort((a, b) => a.solicitante.localeCompare(b.solicitante));
  const decidir = (cuerpo) => request(app).post('/api/admin/verificaciones').set(como(admin)).send(cuerpo);
  expect((await decidir({ tipo: 'comercio', id: tienda.id, resultado: 'rechazado' })).status).toBe(400);
  expect((await decidir({ tipo: 'comercio', id: tienda.id, resultado: 'aprobado' })).status).toBe(200);
  expect((await decidir({ tipo: 'comercio', id: tienda.id, resultado: 'aprobado' })).status).toBe(409);
  expect((await decidir({ tipo: 'organizacion', id: banco.id, resultado: 'aprobado' })).status).toBe(200);
  expect((await decidir({ tipo: 'organizacion', id: comedor.id, resultado: 'aprobado' })).status).toBe(200);
  expect((await request(app).get('/api/perfil').set(como(comercio))).body.entidad).toMatchObject({ estado: 'aprobado', distrito: 'Pueblo Libre' });
});

test('el comercio publica un excedente y aparece en el catálogo', async () => {
  const publicar = (cuerpo) => request(app).post('/api/comercio/ofertas').set(como(comercio)).send(cuerpo);
  expect((await publicar({ ...datosOferta(), precio_oferta: 12 })).status).toBe(400);
  expect((await publicar({ ...datosOferta(), recojo_hasta: '00:00' })).status).toBe(400);
  const r = await publicar(datosOferta());
  expect(r.status).toBe(201);
  idOferta = r.body.id_oferta;
  const enCatalogo = (await request(app).get('/api/ofertas')).body.find((o) => o.id_oferta === idOferta);
  expect(enCatalogo).toMatchObject({ stock_disponible: 3, precio_oferta: 6, alergenos: ['Gluten', 'Huevo'] });
  const propias = (await request(app).get('/api/comercio/ofertas').set(como(comercio))).body;
  expect(propias[0]).toMatchObject({ id_oferta: idOferta, stock_inicial: 3, reservados: 0, estado: 'publicada' });
});

test('valida el código de recojo y registra el cobro una sola vez', async () => {
  codigo = (await request(app).post('/api/reservas').set(como(consumidor)).send({ id_oferta: idOferta, cantidad: 1 })).body.codigo_recojo;
  expect((await request(app).get('/api/comercio/reservas/codigo/000000x').set(como(comercio))).status).toBe(400);
  const r = await request(app).get(`/api/comercio/reservas/codigo/${codigo}`).set(como(comercio));
  expect(r.body).toMatchObject({ nombre: 'Pack de panes artesanales', cantidad: 1, monto: 6, cliente: 'María P.', estado: 'activa' });
  const hoy = (await request(app).get('/api/comercio/reservas/hoy').set(como(comercio))).body;
  expect(hoy).toEqual([expect.objectContaining({ codigo_recojo: codigo, cliente: 'María P.', estado: 'activa' })]);
  const entregar = (cuerpo) => request(app).post(`/api/comercio/reservas/${r.body.id_reserva}/entregar`).set(como(comercio)).send(cuerpo);
  expect((await entregar({ metodo: 'cheque' })).status).toBe(400);
  expect((await entregar({ metodo: 'efectivo' })).status).toBe(200);
  expect((await entregar({ metodo: 'efectivo' })).status).toBe(409);
  const pago = await pool.query('SELECT monto::float8 AS monto, metodo FROM pago WHERE id_reserva = $1', [r.body.id_reserva]);
  expect(pago.rows).toEqual([{ monto: 6, metodo: 'efectivo' }]);
});

test('en el cierre del día el sobrante pasa a donación', async () => {
  const donar = () => request(app).post(`/api/comercio/ofertas/${idOferta}/donar`).set(como(comercio)).send({ recojo_desde: '08:00', recojo_hasta: '09:00', manana: true });
  const r = await donar();
  expect(r.status).toBe(201);
  expect(r.body.cantidad_packs).toBe(2);
  idDonacion = r.body.id_donacion;
  expect((await donar()).status).toBe(409);
  expect((await request(app).get('/api/ofertas')).body.some((o) => o.id_oferta === idOferta)).toBe(false);
});

test('la primera organización que reclama se queda con la donación', async () => {
  const disponibles = (await request(app).get('/api/donaciones/disponibles').set(como(organizacion))).body;
  expect(disponibles.find((d) => d.id_donacion === idDonacion)).toMatchObject({ cantidad_packs: 2, kg: 2, estado: 'disponible', distrito: 'Pueblo Libre' });
  const res = await Promise.all([organizacion, otraOrganizacion].map((t) => request(app).post(`/api/donaciones/${idDonacion}/reclamar`).set(como(t))));
  expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  const ganadora = res[0].status === 200 ? organizacion : otraOrganizacion;
  const perdedora = ganadora === organizacion ? otraOrganizacion : organizacion;
  const vista = (await request(app).get('/api/donaciones/disponibles').set(como(perdedora))).body.find((d) => d.id_donacion === idDonacion);
  expect(vista.estado).toBe('reclamada');
  expect((await request(app).post(`/api/donaciones/${idDonacion}/recibir`).set(como(perdedora))).status).toBe(409);
  const r = await request(app).post(`/api/donaciones/${idDonacion}/recibir`).set(como(ganadora));
  expect(r.status).toBe(201);
  constancia = r.body.codigo_constancia;
  expect(constancia).toMatch(/^ALR-\d{4}-\d{6}$/);
  expect((await request(app).post(`/api/donaciones/${idDonacion}/recibir`).set(como(ganadora))).status).toBe(409);
  expect((await request(app).get('/api/donaciones/mias').set(como(ganadora))).body[0]).toMatchObject({ id_donacion: idDonacion, estado: 'recibida', codigo_constancia: constancia });
  expect((await request(app).get(`/api/constancias/${constancia}`).set(como(perdedora))).status).toBe(404);
  expect((await request(app).get('/api/donaciones/impacto').set(como(ganadora))).body).toMatchObject({ kg_recibidos: 2, donaciones: 1, constancias: 1 });
});

test('la constancia y el impacto quedan disponibles para el comercio', async () => {
  const k = await request(app).get(`/api/constancias/${constancia}`).set(como(comercio));
  expect(k.status).toBe(200);
  expect(k.body).toMatchObject({ codigo_constancia: constancia, cantidad_packs: 2, kg: 2, descripcion: '6 panes del día' });
  expect(k.body.hash_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(k.body.co2_evitado).toBeCloseTo(5.4);
  expect((await request(app).get('/api/constancias').set(como(comercio))).body.map((c) => c.codigo_constancia)).toEqual([constancia]);
  expect((await request(app).get('/api/constancias').set(como(consumidor))).status).toBe(403);
  const impacto = (await request(app).get('/api/comercio/impacto').set(como(comercio))).body;
  expect(impacto).toMatchObject({ kg_rescatados: 3, ingreso_recuperado: 6, constancias: 1, destino: { vendido: 1, donado: 2, no_aprovechado: 0 } });
  expect(impacto.semanas).toHaveLength(5);
  expect(impacto.semanas[4]).toBe(3);
  expect((await request(app).get('/api/comercio/donaciones').set(como(comercio))).body[0]).toMatchObject({ estado: 'recibida', codigo_constancia: constancia });
});
