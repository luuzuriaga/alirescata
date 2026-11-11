// Reglas de validación compartidas con el servidor (capítulo 5 del PA2).
export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 120;
export const contrasenaValida = (p) => p.length >= 8 && p.length <= 64 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
export const telefonoValido = (t) => t === '' || /^9\d{8}$/.test(t);
