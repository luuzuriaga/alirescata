const pool = require('../../common/db');

// Ofertas que se pueden reservar ahora: publicadas, con stock, con el horario de recojo aún sin terminar y de un comercio aprobado.
async function listarOfertas() {
  const r = await pool.query(
    `SELECT o.id_oferta, p.nombre, o.descripcion_pack,
            o.precio_regular::float8 AS precio_regular, o.precio_oferta::float8 AS precio_oferta,
            o.stock_disponible, o.ventana_inicio, o.ventana_fin,
            c.nombre_comercial, c.direccion, d.nombre AS distrito, cat.nombre AS categoria,
            COALESCE((SELECT array_agg(a.nombre ORDER BY a.nombre)
                        FROM oferta_alergeno oa JOIN alergeno a ON a.id_alergeno = oa.id_alergeno
                       WHERE oa.id_oferta = o.id_oferta), '{}') AS alergenos
       FROM oferta o
       JOIN producto p ON p.id_producto = o.id_producto
       JOIN comercio c ON c.id_comercio = p.id_comercio
       JOIN distrito d ON d.id_distrito = c.id_distrito
       JOIN categoria cat ON cat.id_categoria = p.id_categoria
      WHERE o.estado = 'publicada' AND o.stock_disponible > 0
        AND now() < o.ventana_fin
        AND c.estado_verificacion = 'aprobado' AND p.activo
      ORDER BY o.ventana_fin, o.id_oferta`);
  return r.rows;
}
module.exports = { listarOfertas };
