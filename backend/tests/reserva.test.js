const pool = require('../src/common/db');
const { reservar, SinStock } = require('../src/modules/m3-reservas/reservar');
afterAll(() => pool.end());
let idOferta, idCons;
beforeAll(async () => {
  await pool.query("INSERT INTO usuario (correo,hash_contrasena,nombres,rol) VALUES ('cons@test.pe','x','Cons','consumidor') ON CONFLICT DO NOTHING");
  idCons = (await pool.query("SELECT id_usuario FROM usuario WHERE correo='cons@test.pe'")).rows[0].id_usuario;
  await pool.query("INSERT INTO usuario (correo,hash_contrasena,nombres,rol) VALUES ('com@test.pe','x','Com','comercio') ON CONFLICT DO NOTHING");
  const idU = (await pool.query("SELECT id_usuario FROM usuario WHERE correo='com@test.pe'")).rows[0].id_usuario;
  await pool.query("INSERT INTO comercio (id_usuario,ruc,razon_social,nombre_comercial,direccion,id_distrito,tipo_comercio,hora_apertura,hora_cierre) SELECT $1,'20100070970','Panadería Prueba SAC','La Espiga','Av. La Marina 1234',1,'panaderia','07:00','21:00' WHERE NOT EXISTS (SELECT 1 FROM comercio WHERE ruc='20100070970')", [idU]);
  const idC = (await pool.query("SELECT id_comercio FROM comercio WHERE ruc='20100070970'")).rows[0].id_comercio;
  const idP = (await pool.query("INSERT INTO producto (id_comercio,id_categoria,nombre) VALUES ($1,1,'Pack de panes') RETURNING id_producto", [idC])).rows[0].id_producto;
  idOferta = (await pool.query("INSERT INTO oferta (id_producto,stock_inicial,stock_disponible,precio_regular,precio_oferta,ventana_inicio,ventana_fin) VALUES ($1,1,1,12,6,now()-interval '1 hour',now()+interval '2 hour') RETURNING id_oferta", [idP])).rows[0].id_oferta;
});
test('VAL-08: dos reservas simultáneas del último pack, solo una se confirma', async () => {
  const res = await Promise.allSettled([reservar(idOferta, idCons, 1), reservar(idOferta, idCons, 1)]);
  expect(res.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const rech = res.find(r => r.status === 'rejected');
  expect(rech.reason).toBeInstanceOf(SinStock);
  const s = await pool.query('SELECT stock_disponible FROM oferta WHERE id_oferta=$1', [idOferta]);
  expect(s.rows[0].stock_disponible).toBe(0);
});
test('VAL-07: no permite reservar más de lo disponible', async () => {
  await expect(reservar(idOferta, idCons, 3)).rejects.toBeInstanceOf(SinStock);
});
test('el precio de la oferta debe ser menor al regular (CHECK)', async () => {
  const idP = (await pool.query('SELECT id_producto FROM oferta WHERE id_oferta=$1', [idOferta])).rows[0].id_producto;
  await expect(pool.query("INSERT INTO oferta (id_producto,stock_inicial,stock_disponible,precio_regular,precio_oferta,ventana_inicio,ventana_fin) VALUES ($1,1,1,6,6,now(),now()+interval '1 hour')", [idP])).rejects.toThrow();
});
