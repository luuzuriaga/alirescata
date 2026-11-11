// Validación de RUC peruano: 11 dígitos, inicia en 10 o 20 y dígito verificador (módulo 11).
function rucValido(ruc) {
  if (!/^(10|20)\d{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(ruc[i]), 0);
  let d = 11 - (suma % 11);
  if (d === 10) d = 0;
  if (d === 11) d = 1;
  return d === Number(ruc[10]);
}
module.exports = { rucValido };
