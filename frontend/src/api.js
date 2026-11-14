// Cliente mínimo de la API. VITE_API_URL se define al construir (por ejemplo en Vercel).
const BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function registrar(datos, pedir = fetch) {
  let r;
  try {
    r = await pedir(`${BASE}/api/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' };
  }
  if (r.status === 409) return { ok: false, mensaje: 'Ese correo ya tiene una cuenta. Prueba ingresar.' };
  if (r.status === 400) return { ok: false, mensaje: 'Revisa los datos ingresados e inténtalo de nuevo.' };
  if (!r.ok) return { ok: false, mensaje: 'Ocurrió un error. Inténtalo de nuevo en unos minutos.' };
  return { ok: true };
}

export async function ingresar(correo, contrasena, pedir = fetch) {
  let r;
  try {
    r = await pedir(`${BASE}/api/auth/ingreso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena }),
    });
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' };
  }
  if (r.status === 401) return { ok: false, mensaje: 'Correo o contraseña incorrectos' };
  if (!r.ok) return { ok: false, mensaje: 'Ocurrió un error. Inténtalo de nuevo en unos minutos.' };
  const { token } = await r.json();
  return { ok: true, token };
}

const SIN_CONEXION = { ok: false, mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' };
const ERROR = { ok: false, mensaje: 'Ocurrió un error. Inténtalo de nuevo en unos minutos.' };
const EXPIRADA = { ok: false, expirada: true, mensaje: 'Tu sesión terminó. Vuelve a ingresar.' };
const conSesion = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

export async function listarOfertas(pedir = fetch) {
  let r;
  try { r = await pedir(`${BASE}/api/ofertas`); } catch { return SIN_CONEXION; }
  if (!r.ok) return ERROR;
  return { ok: true, ofertas: await r.json() };
}

export async function reservar(token, idOferta, cantidad, pedir = fetch) {
  let r;
  try {
    r = await pedir(`${BASE}/api/reservas`, {
      method: 'POST',
      headers: conSesion(token),
      body: JSON.stringify({ id_oferta: idOferta, cantidad }),
    });
  } catch { return SIN_CONEXION; }
  if (r.status === 401) return EXPIRADA;
  if (r.status === 403) return { ok: false, mensaje: 'Solo las cuentas de consumidor pueden reservar packs.' };
  if (r.status === 409) return { ok: false, agotada: true, mensaje: 'Ya no quedan packs suficientes de esta oferta.' };
  if (!r.ok) return ERROR;
  const { codigo_recojo: codigo } = await r.json();
  return { ok: true, codigo };
}

export async function misReservas(token, pedir = fetch) {
  let r;
  try { r = await pedir(`${BASE}/api/reservas/mias`, { headers: conSesion(token) }); } catch { return SIN_CONEXION; }
  if (r.status === 401) return EXPIRADA;
  if (!r.ok) return ERROR;
  return { ok: true, reservas: await r.json() };
}

const MENSAJES = {
  VALIDACION: 'Revisa los datos ingresados e inténtalo de nuevo.',
  DUPLICADO: 'Ese RUC ya está registrado en Alirescata.',
  SIN_PERFIL: 'Primero completa los datos de tu institución.',
  SIN_VERIFICAR: 'Tu cuenta aún no ha sido verificada por administración.',
  ROL_NO_PERMITIDO: 'Tu tipo de cuenta no puede hacer esta acción.',
  VENTANA_PASADA: 'Ese horario ya pasó. Elige una hora de fin posterior a la hora actual.',
  CODIGO_NO_ENCONTRADO: 'No hay ninguna reserva con ese código en tu comercio.',
  RESERVA_NO_ACTIVA: 'Esa reserva ya fue entregada o cancelada.',
  SIN_SOBRANTE: 'Esa oferta ya no tiene packs sobrantes para donar.',
  YA_RECLAMADA: 'Otra organización reclamó esta donación antes.',
  NO_RECLAMADA: 'Esta donación ya no está pendiente de recepción.',
  YA_REVISADA: 'Esa solicitud ya fue revisada.',
  NO_ENCONTRADA: 'No encontramos esa constancia.',
};

// Llamada genérica con sesión para los paneles. Devuelve { ok, datos } o { ok: false, mensaje, codigo }.
export async function api(token, metodo, ruta, cuerpo, pedir = fetch) {
  let r;
  try {
    r = await pedir(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: token ? conSesion(token) : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch { return SIN_CONEXION; }
  if (r.status === 401) return EXPIRADA;
  let datos = null;
  try { datos = await r.json(); } catch { /* respuesta sin cuerpo */ }
  if (!r.ok) return { ok: false, codigo: datos?.codigo, campos: datos?.campos, mensaje: MENSAJES[datos?.codigo] || ERROR.mensaje };
  return { ok: true, datos };
}
