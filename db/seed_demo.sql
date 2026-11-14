-- Datos de demostración para el catálogo (pantallas I-05 e I-06). Se puede ejecutar las veces que haga falta:
-- cada ejecución cierra las ofertas de demostración anteriores y publica otras vigentes desde la hora en curso y por 6 horas.
-- Los usuarios de estos comercios no pueden ingresar (no tienen una contraseña válida).
INSERT INTO usuario (correo, hash_contrasena, nombres, rol) VALUES
  ('espiga@demo.alirescata.pe', 'x', 'Panadería La Espiga', 'comercio'),
  ('rincon@demo.alirescata.pe', 'x', 'Café Rincón Dulce', 'comercio'),
  ('donlucho@demo.alirescata.pe', 'x', 'Minimarket Don Lucho', 'comercio')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO comercio (id_usuario, ruc, razon_social, nombre_comercial, direccion, id_distrito, tipo_comercio, hora_apertura, hora_cierre, estado_verificacion)
SELECT u.id_usuario, v.ruc, v.razon, v.nombre, v.direccion, d.id_distrito, v.tipo, '07:00', '21:00', 'aprobado'
FROM (VALUES
  ('espiga@demo.alirescata.pe', '20600000011', 'La Espiga SAC', 'Panadería La Espiga', 'Av. La Marina 1234', 'San Miguel', 'panaderia'),
  ('rincon@demo.alirescata.pe', '20600000022', 'Rincón Dulce EIRL', 'Café Rincón Dulce', 'Av. Brasil 2150', 'Pueblo Libre', 'cafe'),
  ('donlucho@demo.alirescata.pe', '20600000033', 'Inversiones Don Lucho SAC', 'Minimarket Don Lucho', 'Jr. Castilla 480', 'Magdalena', 'minimercado')
) AS v(correo, ruc, razon, nombre, direccion, distrito, tipo)
JOIN usuario u ON u.correo = v.correo
JOIN distrito d ON d.nombre = v.distrito
ON CONFLICT DO NOTHING;

INSERT INTO producto (id_comercio, id_categoria, nombre)
SELECT c.id_comercio, cat.id_categoria, v.nombre
FROM (VALUES
  ('20600000011', 'Panadería y pastelería', 'Pack de panes artesanales'),
  ('20600000022', 'Panadería y pastelería', 'Caja de postres surtidos'),
  ('20600000033', 'Comida preparada', 'Combo almuerzo del día')
) AS v(ruc, categoria, nombre)
JOIN comercio c ON c.ruc = v.ruc
JOIN categoria cat ON cat.nombre = v.categoria
WHERE NOT EXISTS (SELECT 1 FROM producto p WHERE p.id_comercio = c.id_comercio AND p.nombre = v.nombre);

UPDATE oferta SET estado = 'cerrada'
WHERE estado = 'publicada' AND id_producto IN (
  SELECT p.id_producto FROM producto p JOIN comercio c ON c.id_comercio = p.id_comercio
  WHERE c.ruc IN ('20600000011', '20600000022', '20600000033'));

WITH nuevas AS (
  INSERT INTO oferta (id_producto, descripcion_pack, stock_inicial, stock_disponible, precio_regular, precio_oferta, ventana_inicio, ventana_fin)
  SELECT p.id_producto, v.descripcion, v.stock, v.stock, v.regular, v.oferta, date_trunc('hour', now()), date_trunc('hour', now()) + interval '6 hours'
  FROM (VALUES
    ('20600000011', '6 panes del día (pan francés y ciabatta)', 3, 12.00, 6.00),
    ('20600000022', '4 postres del día (torta, pie y alfajores)', 2, 19.00, 9.50),
    ('20600000033', 'Menú del día con entrada, segundo y refresco', 5, 16.00, 8.00)
  ) AS v(ruc, descripcion, stock, regular, oferta)
  JOIN comercio c ON c.ruc = v.ruc
  JOIN producto p ON p.id_comercio = c.id_comercio
  RETURNING id_oferta, id_producto
)
INSERT INTO oferta_alergeno (id_oferta, id_alergeno)
SELECT n.id_oferta, a.id_alergeno
FROM nuevas n
JOIN producto p ON p.id_producto = n.id_producto
JOIN alergeno a ON (p.nombre = 'Pack de panes artesanales' AND a.nombre IN ('Gluten', 'Huevo'))
                OR (p.nombre = 'Caja de postres surtidos' AND a.nombre IN ('Gluten', 'Huevo', 'Leche'))
                OR (p.nombre = 'Combo almuerzo del día' AND a.nombre IN ('Gluten'));
