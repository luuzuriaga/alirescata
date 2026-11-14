import { test, expect } from 'vitest';
import { ventana, rucValido, validarOferta, resumenDescuento, porcentajes, estadoOferta, codigoVerificacion, huellaCorta, kilos, packs, fechaHora } from './paneles.js';

const ahora = new Date('2026-11-13T15:00:00-05:00');
const base = { nombre: 'Pack de panes artesanales', id_categoria: '1', descripcion_pack: ' 6 panes del día ', cantidad: '3', peso_kg: '', precio_regular: '12.00', precio_oferta: '6,00', recojo_desde: '19:00', recojo_hasta: '20:30', alergenos: [1, 2], sinAlergenos: false };

test('describe la ventana de recojo', () => {
  expect(ventana('2026-11-14T01:30:00Z', '2026-11-14T02:30:00Z', ahora)).toBe('Hoy 20:30–21:30');
  expect(ventana('2026-11-14T13:00:00Z', '2026-11-14T14:00:00Z', ahora)).toBe('Mañana 08:00–09:00');
  expect(ventana('2026-11-20T13:00:00Z', '2026-11-20T14:00:00Z', ahora)).toBe('20/11 08:00–09:00');
  expect(fechaHora('2027-01-20T01:42:00Z')).toBe('19/01/2027 · 20:42');
});
test('valida el RUC igual que el servidor', () => {
  expect(rucValido('20100070970')).toBe(true);
  expect(rucValido('20100070971')).toBe(false);
  expect(rucValido('2010007097')).toBe(false);
});
test('acepta una oferta correcta y la deja lista para la API', () => {
  const { errores, datos } = validarOferta(base);
  expect(errores).toEqual({});
  expect(datos).toEqual({ nombre: 'Pack de panes artesanales', id_categoria: 1, descripcion_pack: '6 panes del día', cantidad: 3, peso_kg: 1, precio_regular: 12, precio_oferta: 6, recojo_desde: '19:00', recojo_hasta: '20:30', alergenos: [1, 2] });
});
test('señala los errores del formulario de oferta', () => {
  const { errores } = validarOferta({ ...base, nombre: 'a', id_categoria: '', cantidad: '0', precio_oferta: '12', recojo_hasta: '18:00', alergenos: [] });
  expect(Object.keys(errores).sort()).toEqual(['alergenos', 'cantidad', 'id_categoria', 'nombre', 'precio_oferta', 'recojo_hasta']);
  expect(errores.recojo_hasta).toBe('Debe ser posterior a la hora de inicio');
  expect(validarOferta({ ...base, alergenos: [], sinAlergenos: true })).toMatchObject({ errores: {}, datos: { alergenos: [] } });
});
test('calcula el descuento solo con precios válidos', () => {
  expect(resumenDescuento('12.00', '6.00')).toBe('Descuento calculado: 50 %. Ahorro por pack para el cliente: S/ 6.00.');
  expect(resumenDescuento('12', '')).toBe(null);
  expect(resumenDescuento('6', '12')).toBe(null);
});
test('los porcentajes del destino suman 100', () => {
  expect(porcentajes({ vendido: 72, donado: 24, no_aprovechado: 4 })).toEqual({ vendido: 72, donado: 24, no_aprovechado: 4 });
  const tercios = porcentajes({ vendido: 1, donado: 1, no_aprovechado: 1 });
  expect(tercios.vendido + tercios.donado + tercios.no_aprovechado).toBe(100);
  expect(porcentajes({ vendido: 0, donado: 0, no_aprovechado: 0 })).toEqual({ vendido: 0, donado: 0, no_aprovechado: 0 });
});
test('resume el estado de una oferta', () => {
  expect(estadoOferta({ estado: 'publicada', stock_disponible: 2 })[0]).toBe('Publicada');
  expect(estadoOferta({ estado: 'publicada', stock_disponible: 2, vencida: true })[0]).toBe('Vencida');
  expect(estadoOferta({ estado: 'publicada', stock_disponible: 0 })[0]).toBe('Agotada');
  expect(estadoOferta({ estado: 'cerrada', donada: true })[0]).toBe('Donada');
});
test('formatea cantidades y la huella de la constancia', () => {
  expect(kilos(3)).toBe('3 kg');
  expect(kilos(345.64)).toBe('345.6 kg');
  expect(packs(1)).toBe('1 pack');
  expect(packs(3)).toBe('3 packs');
  const huella = '9f3a71c20b5e'.padEnd(60, '0') + 'c91a';
  expect(codigoVerificacion(huella)).toBe('9F3A-71C2-0B5E');
  expect(huellaCorta(huella)).toBe('9f3a…c91a');
});
