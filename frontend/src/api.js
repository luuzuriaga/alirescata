// Cliente mínimo de la API. VITE_API_URL se define al construir (por ejemplo en Vercel).
const BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

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
