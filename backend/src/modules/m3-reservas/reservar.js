const crypto = require('crypto');
const pool = require('../../common/db');

class SinStock extends Error {}

// Reserva con control de stock transaccional (ver sección 3.3 del PA2).
async function reservar(idOferta, idConsumidor, cantidad) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 5) throw new RangeError('cantidad entre 1 y 5');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `UPDATE oferta SET stock_disponible = stock_disponible - $2
        WHERE id_oferta = $1 AND estado = 'publicada' AND stock_disponible >= $2
          AND now() < ventana_fin
      RETURNING precio_oferta`, [idOferta, cantidad]);
    if (u.rowCount === 0) throw new SinStock('ya no hay stock');
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const r = await client.query(
      'INSERT INTO reserva (id_oferta, id_consumidor, cantidad, precio_unitario, codigo_recojo) VALUES ($1,$2,$3,$4,$5) RETURNING id_reserva, codigo_recojo',
      [idOferta, idConsumidor, cantidad, u.rows[0].precio_oferta, codigo]);
    await client.query('COMMIT');
    return r.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function reservasDe(idConsumidor) {
  const r = await pool.query(
    `SELECT r.id_reserva, r.codigo_recojo, r.cantidad, r.precio_unitario::float8 AS precio_unitario,
            r.estado, r.reservada_en, o.ventana_inicio, o.ventana_fin,
            p.nombre, c.nombre_comercial, c.direccion
       FROM reserva r
       JOIN oferta o ON o.id_oferta = r.id_oferta
       JOIN producto p ON p.id_producto = o.id_producto
       JOIN comercio c ON c.id_comercio = p.id_comercio
      WHERE r.id_consumidor = $1
      ORDER BY r.reservada_en DESC`, [idConsumidor]);
  return r.rows;
}
module.exports = { reservar, reservasDe, SinStock };
