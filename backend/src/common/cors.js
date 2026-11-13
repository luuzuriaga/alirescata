// CORS: solo los orígenes listados en CORS_ORIGIN (separados por coma) pueden llamar a la API desde el navegador.
const permitidos = () => (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

function cors(req, res, next) {
  const origen = req.headers.origin;
  if (origen && permitidos().includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
module.exports = cors;
