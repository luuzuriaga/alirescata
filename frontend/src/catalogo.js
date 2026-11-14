// Reglas de presentación del catálogo (pantallas I-05 e I-06).
export const DISTRITOS = ['San Miguel', 'Pueblo Libre', 'Magdalena'];
const ZONA = 'America/Lima';
const fmtHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONA });
const fmtDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA });

export const soles = (n) => `S/ ${Number(n).toFixed(2)}`;
export const descuento = (o) => Math.round((1 - o.precio_oferta / o.precio_regular) * 100);
export const hora = (fecha) => fmtHora.format(new Date(fecha));
export const esHoy = (fecha, ahora = new Date()) => fmtDia.format(new Date(fecha)) === fmtDia.format(ahora);

// Una ventana que empieza hoy y termina pasada la medianoche sigue siendo "hoy".
export const recojoEsHoy = (o, ahora = new Date()) => esHoy(o.ventana_inicio, ahora) || esHoy(o.ventana_fin, ahora);
const dia = (o, ahora) => {
  if (recojoEsHoy(o, ahora)) return 'hoy';
  const [, mes, d] = fmtDia.format(new Date(o.ventana_fin)).split('-');
  return `${d}/${mes}`;
};
const mayuscula = (t) => t[0].toUpperCase() + t.slice(1);

// "Hoy 19:00–20:30" en la tarjeta y "hoy de 19:00 a 20:30" en el detalle.
export const recojoCorto = (o, ahora = new Date()) => `${mayuscula(dia(o, ahora))} ${hora(o.ventana_inicio)}–${hora(o.ventana_fin)}`;
export const recojoLargo = (o, ahora = new Date()) => `${dia(o, ahora)} de ${hora(o.ventana_inicio)} a ${hora(o.ventana_fin)}`;

const plano = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filtrar(ofertas, { texto = '', distrito = null, panaderia = false, hasta10 = false, hoy = false } = {}, ahora = new Date()) {
  const q = plano(texto.trim());
  return ofertas.filter((o) => {
    if (distrito && o.distrito !== distrito) return false;
    if (panaderia && !plano(o.categoria).startsWith('panaderia')) return false;
    if (hasta10 && o.precio_oferta > 10) return false;
    if (hoy && !recojoEsHoy(o, ahora)) return false;
    return !q || [o.nombre, o.nombre_comercial, o.descripcion_pack].some((c) => plano(c).includes(q));
  });
}

export const cantidadMaxima = (o) => Math.max(1, Math.min(5, o.stock_disponible));

// Qué foto de ejemplo le corresponde a una oferta: primero por su nombre y, si no, por su categoría.
export function tipoFoto(o) {
  const nombre = plano(o.nombre);
  if (/postre|torta|pastel|dulce|queque|alfajor/.test(nombre)) return 'postres';
  if (/(^| )pan(es)?( |$)|baguette|ciabatta/.test(nombre)) return 'panes';
  if (/almuerzo|menu|combo|comida|arroz|pollo/.test(nombre)) return 'almuerzo';
  const categoria = plano(o.categoria);
  if (categoria.startsWith('panaderia')) return 'panes';
  if (categoria.startsWith('comida')) return 'almuerzo';
  return null;
}
