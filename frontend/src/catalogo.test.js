import { test, expect } from 'vitest';
import { soles, descuento, recojoCorto, recojoLargo, filtrar, cantidadMaxima, esHoy, tipoFoto } from './catalogo.js';

const ahora = new Date('2026-11-13T15:00:00-05:00');
const panes = { nombre: 'Pack de panes artesanales', nombre_comercial: 'Panadería La Espiga', descripcion_pack: '6 panes del día', distrito: 'San Miguel', categoria: 'Panadería y pastelería', precio_regular: 12, precio_oferta: 6, stock_disponible: 3, ventana_inicio: '2026-11-14T00:00:00Z', ventana_fin: '2026-11-14T01:30:00Z' };
const almuerzo = { nombre: 'Combo almuerzo del día', nombre_comercial: 'Minimarket Don Lucho', descripcion_pack: 'Menú del día', distrito: 'Magdalena', categoria: 'Comida preparada', precio_regular: 30, precio_oferta: 12, stock_disponible: 9, ventana_inicio: '2026-11-14T20:30:00Z', ventana_fin: '2026-11-14T22:00:00Z' };
const ofertas = [panes, almuerzo];

test('formatea precios y descuento', () => {
  expect(soles(6)).toBe('S/ 6.00');
  expect(soles(9.5)).toBe('S/ 9.50');
  expect(descuento(panes)).toBe(50);
  expect(descuento(almuerzo)).toBe(60);
});
test('muestra el horario de recojo en hora de Lima', () => {
  expect(recojoCorto(panes, ahora)).toBe('Hoy 19:00–20:30');
  expect(recojoLargo(panes, ahora)).toBe('hoy de 19:00 a 20:30');
  expect(recojoCorto(almuerzo, ahora)).toBe('14/11 15:30–17:00');
  expect(esHoy(almuerzo.ventana_fin, ahora)).toBe(false);
});
test('una ventana que cruza la medianoche cuenta como hoy', () => {
  const nocturna = { ...panes, ventana_inicio: '2026-11-14T00:30:00Z', ventana_fin: '2026-11-14T06:30:00Z' };
  expect(recojoCorto(nocturna, ahora)).toBe('Hoy 19:30–01:30');
  expect(filtrar([nocturna], { hoy: true }, ahora)).toEqual([nocturna]);
});
test('filtra por distrito, categoría, precio y día', () => {
  expect(filtrar(ofertas, {}, ahora)).toHaveLength(2);
  expect(filtrar(ofertas, { distrito: 'Magdalena' }, ahora)).toEqual([almuerzo]);
  expect(filtrar(ofertas, { panaderia: true }, ahora)).toEqual([panes]);
  expect(filtrar(ofertas, { hasta10: true }, ahora)).toEqual([panes]);
  expect(filtrar(ofertas, { hoy: true }, ahora)).toEqual([panes]);
  expect(filtrar(ofertas, { distrito: 'Pueblo Libre' }, ahora)).toEqual([]);
});
test('busca sin distinguir tildes ni mayúsculas', () => {
  expect(filtrar(ofertas, { texto: 'PANADERIA' }, ahora)).toEqual([panes]);
  expect(filtrar(ofertas, { texto: ' menú ' }, ahora)).toEqual([almuerzo]);
  expect(filtrar(ofertas, { texto: 'sushi' }, ahora)).toEqual([]);
});
test('la cantidad máxima es el stock, con tope de 5', () => {
  expect(cantidadMaxima(panes)).toBe(3);
  expect(cantidadMaxima(almuerzo)).toBe(5);
});
test('elige la foto de ejemplo por nombre y luego por categoría', () => {
  expect(tipoFoto(panes)).toBe('panes');
  expect(tipoFoto(almuerzo)).toBe('almuerzo');
  expect(tipoFoto({ nombre: 'Caja de postres surtidos', categoria: 'Panadería y pastelería' })).toBe('postres');
  expect(tipoFoto({ nombre: 'Bolsa sorpresa', categoria: 'Panadería y pastelería' })).toBe('panes');
  expect(tipoFoto({ nombre: 'Bolsa sorpresa', categoria: 'Envasados y no perecibles' })).toBe(null);
});
