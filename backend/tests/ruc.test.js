const { rucValido } = require('../src/common/ruc');
test('acepta RUC con dígito verificador correcto', () => {
  expect(rucValido('20100070970')).toBe(true);
  expect(rucValido('20100128056')).toBe(true);
});
test('rechaza dígito verificador incorrecto y formatos inválidos', () => {
  expect(rucValido('20100070971')).toBe(false);
  expect(rucValido('30100070970')).toBe(false);
  expect(rucValido('2010007097')).toBe(false);
});
