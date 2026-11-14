// Reglas de presentación y validación de los paneles de comercio, organización y administración.
import { hora, esHoy, soles } from './catalogo.js';

const ZONA = 'America/Lima';
const fmtFecha = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
const UN_DIA = 24 * 60 * 60 * 1000;

export const fecha = (f) => fmtFecha.format(new Date(f));
export const fechaHora = (f) => `${fecha(f)} · ${hora(f)}`;
export const kilos = (n) => `${Number(Number(n).toFixed(1))} kg`;
export const packs = (n) => `${n} ${n === 1 ? 'pack' : 'packs'}`;

// "Hoy 20:30–21:30", "Mañana 08:00–09:00" o "19/01 08:00–09:00".
export function ventana(desde, hasta, ahora = new Date()) {
  let dia = fecha(desde).slice(0, 5);
  if (esHoy(desde, ahora)) dia = 'Hoy';
  else if (esHoy(desde, new Date(ahora.getTime() + UN_DIA))) dia = 'Mañana';
  return `${dia} ${hora(desde)}–${hora(hasta)}`;
}

// Misma regla que el servidor: 11 dígitos, inicia en 10 o 20 y dígito verificador (módulo 11).
export function rucValido(ruc) {
  if (!/^(10|20)\d{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let d = 11 - (pesos.reduce((acc, p, i) => acc + p * Number(ruc[i]), 0) % 11);
  if (d === 10) d = 0;
  if (d === 11) d = 1;
  return d === Number(ruc[10]);
}

const numero = (t) => (String(t).trim() === '' ? NaN : Number(String(t).replace(',', '.')));

// Valida el formulario "Publicar excedente". Devuelve { errores, datos } con los datos listos para la API.
export function validarOferta(f) {
  const errores = {};
  const cantidad = numero(f.cantidad);
  const peso = f.peso_kg === '' ? 1 : numero(f.peso_kg);
  const regular = numero(f.precio_regular);
  const oferta = numero(f.precio_oferta);
  if (f.nombre.trim().length < 3) errores.nombre = 'Escribe el nombre del producto o pack (mínimo 3 letras)';
  if (!f.id_categoria) errores.id_categoria = 'Elige una categoría';
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) errores.cantidad = 'Entre 1 y 99 packs';
  if (!(peso > 0) || peso > 999) errores.peso_kg = 'Debe ser mayor que 0';
  if (!(regular > 0)) errores.precio_regular = 'Ingresa el precio regular';
  if (!(oferta > 0)) errores.precio_oferta = 'Ingresa el precio rebajado';
  else if (regular > 0 && oferta >= regular) errores.precio_oferta = 'Debe ser menor al precio regular';
  if (!f.recojo_desde) errores.recojo_desde = 'Indica la hora de inicio';
  if (!f.recojo_hasta) errores.recojo_hasta = 'Indica la hora de fin';
  else if (f.recojo_desde && f.recojo_hasta <= f.recojo_desde) errores.recojo_hasta = 'Debe ser posterior a la hora de inicio';
  if (!f.sinAlergenos && f.alergenos.length === 0) errores.alergenos = 'Marca los alérgenos presentes o "Ninguno"';
  const datos = {
    nombre: f.nombre.trim(), id_categoria: Number(f.id_categoria), cantidad, peso_kg: peso,
    precio_regular: regular, precio_oferta: oferta, recojo_desde: f.recojo_desde, recojo_hasta: f.recojo_hasta,
    alergenos: f.sinAlergenos ? [] : f.alergenos,
  };
  if (f.descripcion_pack.trim()) datos.descripcion_pack = f.descripcion_pack.trim();
  return { errores, datos };
}

// Texto del recuadro de descuento, o null si los precios aún no permiten calcularlo.
export function resumenDescuento(precioRegular, precioOferta) {
  const regular = numero(precioRegular);
  const oferta = numero(precioOferta);
  if (!(regular > 0) || !(oferta > 0) || oferta >= regular) return null;
  return `Descuento calculado: ${Math.round((1 - oferta / regular) * 100)} %. Ahorro por pack para el cliente: ${soles(regular - oferta)}.`;
}

// Reparte el destino del excedente en porcentajes enteros que suman 100.
export function porcentajes(destino) {
  const claves = ['vendido', 'donado', 'no_aprovechado'];
  const total = claves.reduce((acc, k) => acc + destino[k], 0);
  if (!(total > 0)) return { vendido: 0, donado: 0, no_aprovechado: 0 };
  const r = Object.fromEntries(claves.map((k) => [k, Math.round((destino[k] / total) * 100)]));
  const mayor = claves.reduce((a, b) => (destino[b] > destino[a] ? b : a));
  r[mayor] += 100 - claves.reduce((acc, k) => acc + r[k], 0);
  return r;
}

export function estadoOferta(o) {
  if (o.donada) return ['Donada', 'ok'];
  if (o.estado === 'publicada' && o.vencida) return ['Vencida', 'neutro'];
  if (o.estado === 'publicada' && o.stock_disponible === 0) return ['Agotada', 'neutro'];
  if (o.estado === 'publicada') return ['Publicada', 'ok'];
  return [{ agotada: 'Agotada', cerrada: 'Cerrada', anulada: 'Anulada' }[o.estado] || o.estado, 'neutro'];
}

export const ESTADOS_DONACION = {
  disponible: ['Disponible', 'pendiente'], reclamada: ['Por recoger', 'pendiente'], recibida: ['Recibida', 'ok'],
  vencida: ['Vencida', 'neutro'], cancelada: ['Cancelada', 'neutro'],
};
export const TIPOS_COMERCIO = [['panaderia', 'Panadería'], ['cafe', 'Café'], ['restaurante', 'Restaurante'], ['minimercado', 'Minimercado'], ['otro', 'Otro']];
export const TIPOS_ORGANIZACION = [['banco_alimentos', 'Banco de alimentos'], ['comedor', 'Comedor'], ['ong', 'ONG'], ['otro', 'Otro']];
export const tipoOrganizacion = (t) => (TIPOS_ORGANIZACION.find(([v]) => v === t) || [t, t])[1];

// "9F3A-71C2-0B5E" a partir de la huella SHA-256 de la constancia.
export const codigoVerificacion = (huella) => huella.slice(0, 12).toUpperCase().match(/.{4}/g).join('-');
export const huellaCorta = (huella) => `${huella.slice(0, 4)}…${huella.slice(-4)}`;
