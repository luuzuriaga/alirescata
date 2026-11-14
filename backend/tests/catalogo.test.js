const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/common/db');
afterAll(() => pool.end());

const clave = 'Clave1234';
const cuenta = (correo, rol) => ({ correo, contrasena: clave, nombres: 'Prueba', rol, consentimiento: true });
let idOferta, tokenConsumidor, tokenComercio;

async function entrar(correo, rol) {
  await pool.query('DELETE FROM reserva WHERE id_consumidor IN (SELECT id_usuario FROM usuario WHERE correo = $1)', [correo]);
  await pool.query('DELETE FROM consentimiento WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE correo = $1)', [correo]);
  await pool.query('DELETE FROM usuario WHERE correo = $1', [correo]);
  await request(app).post('/api/auth/registro').send(cuenta(correo, rol));
  return (await request(app).post('/api/auth/ingreso').send({ correo, contrasena: clave })).body.token;
}

beforeAll(async () => {
  await pool.query("INSERT INTO usuario (correo,hash_contrasena,nombres,rol) VALUES ('cafe@test.pe','x','Café','comercio') ON CONFLICT DO NOTHING");
  const idU = (await pool.query("SELECT id_usuario FROM usuario WHERE correo='cafe@test.pe'")).rows[0].id_usuario;
  await pool.query("INSERT INTO comercio (id_usuario,ruc,razon_social,nombre_comercial,direccion,id_distrito,tipo_comercio,hora_apertura,hora_cierre,estado_verificacion) SELECT $1,'20512345671','Café Prueba SAC','Café Rincón Dulce','Jr. Castilla 456',2,'cafe','08:00','21:00','aprobado' WHERE NOT EXISTS (SELECT 1 FROM comercio WHERE ruc='20512345671')", [idU]);
  const idC = (await pool.query("SELECT id_comercio FROM comercio WHERE ruc='20512345671'")).rows[0].id_comercio;
  const idP = (await pool.query("INSERT INTO producto (id_comercio,id_categoria,nombre) VALUES ($1,1,'Caja de postres surtidos') RETURNING id_producto", [idC])).rows[0].id_producto;
  idOferta = (await pool.query("INSERT INTO oferta (id_producto,descripcion_pack,stock_inicial,stock_disponible,precio_regular,precio_oferta,ventana_inicio,ventana_fin) VALUES ($1,'4 postres del día',2,2,19,9.5,now()-interval '1 hour',now()+interval '2 hour') RETURNING id_oferta", [idP])).rows[0].id_oferta;
  await pool.query('INSERT INTO oferta_alergeno (id_oferta,id_alergeno) VALUES ($1,1),($1,2)', [idOferta]);
  tokenConsumidor = await entrar('cata@test.pe', 'consumidor');
  tokenComercio = await entrar('tienda@test.pe', 'comercio');
});

test('el catálogo lista la oferta vigente con comercio, distrito y alérgenos', async () => {
  const r = await request(app).get('/api/ofertas');
  expect(r.status).toBe(200);
  const o = r.body.find((x) => x.id_oferta === idOferta);
  expect(o).toMatchObject({ nombre: 'Caja de postres surtidos', nombre_comercial: 'Café Rincón Dulce', distrito: 'Pueblo Libre', precio_oferta: 9.5, precio_regular: 19, stock_disponible: 2 });
  expect(o.alergenos).toEqual(['Gluten', 'Huevo']);
});
test('el catálogo no muestra ofertas de comercios sin aprobar', async () => {
  const r = await request(app).get('/api/ofertas');
  expect(r.body.every((x) => x.nombre_comercial !== 'La Espiga')).toBe(true);
});
test('reservar exige sesión', async () => {
  expect((await request(app).post('/api/reservas').send({ id_oferta: idOferta, cantidad: 1 })).status).toBe(401);
  expect((await request(app).post('/api/reservas').set('Authorization', 'Bearer roto').send({ id_oferta: idOferta, cantidad: 1 })).status).toBe(401);
});
test('solo un consumidor puede reservar', async () => {
  const r = await request(app).post('/api/reservas').set('Authorization', `Bearer ${tokenComercio}`).send({ id_oferta: idOferta, cantidad: 1 });
  expect(r.status).toBe(403);
});
test('rechaza cantidades fuera de 1 a 5', async () => {
  const r = await request(app).post('/api/reservas').set('Authorization', `Bearer ${tokenConsumidor}`).send({ id_oferta: idOferta, cantidad: 6 });
  expect(r.status).toBe(400);
});
test('reserva, entrega un código de 6 dígitos y aparece en mis reservas', async () => {
  const r = await request(app).post('/api/reservas').set('Authorization', `Bearer ${tokenConsumidor}`).send({ id_oferta: idOferta, cantidad: 2 });
  expect(r.status).toBe(201);
  expect(r.body.codigo_recojo).toMatch(/^\d{6}$/);
  const mias = await request(app).get('/api/reservas/mias').set('Authorization', `Bearer ${tokenConsumidor}`);
  expect(mias.status).toBe(200);
  expect(mias.body[0]).toMatchObject({ codigo_recojo: r.body.codigo_recojo, cantidad: 2, nombre: 'Caja de postres surtidos', estado: 'activa' });
});
test('sin stock responde 409 y la oferta sale del catálogo', async () => {
  const r = await request(app).post('/api/reservas').set('Authorization', `Bearer ${tokenConsumidor}`).send({ id_oferta: idOferta, cantidad: 1 });
  expect(r.status).toBe(409);
  const lista = await request(app).get('/api/ofertas');
  expect(lista.body.some((x) => x.id_oferta === idOferta)).toBe(false);
});
test('mis reservas exige sesión', async () => {
  expect((await request(app).get('/api/reservas/mias')).status).toBe(401);
});
