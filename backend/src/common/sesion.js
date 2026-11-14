const jwt = require('jsonwebtoken');

// Exige un JWT válido en la cabecera Authorization y deja al usuario en req.usuario.
function autenticar(req, res, next) {
  const [tipo, token] = String(req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ codigo: 'SIN_SESION' });
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: Number(datos.sub), rol: datos.rol };
    next();
  } catch {
    res.status(401).json({ codigo: 'SESION_INVALIDA' });
  }
}
module.exports = { autenticar };
