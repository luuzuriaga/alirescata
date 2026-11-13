import { test, expect } from 'vitest';
import { correoValido, contrasenaValida, telefonoValido } from './validaciones.js';
test('correo', () => { expect(correoValido('nombre@correo.com')).toBe(true); expect(correoValido('maria@')).toBe(false); });
test('contraseña', () => { expect(contrasenaValida('Clave1234')).toBe(true); expect(contrasenaValida('clave')).toBe(false); });
test('teléfono', () => { expect(telefonoValido('987654321')).toBe(true); expect(telefonoValido('187654321')).toBe(false); });
test('nombres', async () => { const { nombresValidos } = await import('./validaciones.js'); expect(nombresValidos('María')).toBe(true); expect(nombresValidos(' a ')).toBe(false); });
