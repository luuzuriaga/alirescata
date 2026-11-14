const { ZodError } = require('zod');
const pool = require('./db');

class ErrorHttp extends Error {
  constructor(status, codigo) { super(codigo); this.status = status; this.codigo = codigo; }
}

// Envuelve una ruta: traduce los errores conocidos a su código HTTP.
const ruta = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ codigo: 'VALIDACION', campos: e.issues.map((i) => i.path.join('.')) });
    if (e instanceof ErrorHttp) return res.status(e.status).json({ codigo: e.codigo });
    if (e.code === '23505') return res.status(409).json({ codigo: 'DUPLICADO' });
    return res.status(500).json({ codigo: 'ERROR' });
  }
};

const soloRol = (...roles) => (req, res, next) => (
  roles.includes(req.usuario.rol) ? next() : res.status(403).json({ codigo: 'ROL_NO_PERMITIDO' })
);

// Carga el comercio u organización del usuario y exige que esté aprobado por administración.
const conEntidad = (tabla) => async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT * FROM ${tabla} WHERE id_usuario = $1`, [req.usuario.id]);
    const entidad = r.rows[0];
    if (!entidad) return res.status(403).json({ codigo: 'SIN_PERFIL' });
    if (entidad.estado_verificacion !== 'aprobado') return res.status(403).json({ codigo: 'SIN_VERIFICAR' });
    req[tabla] = entidad;
    next();
  } catch { res.status(500).json({ codigo: 'ERROR' }); }
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Fecha y hora de Lima a partir de "HH:MM" y un desplazamiento en días (0 = hoy, 1 = mañana).
const EN_LIMA = (hora, dias) => `(((now() AT TIME ZONE 'America/Lima')::date + ${dias}::int + ${hora}::time) AT TIME ZONE 'America/Lima')`;

async function factorCo2(db = pool) {
  const r = await db.query("SELECT valor::float8 AS valor FROM parametro_impacto WHERE nombre = 'factor_co2e' AND vigente_desde <= CURRENT_DATE ORDER BY vigente_desde DESC LIMIT 1");
  return r.rows[0] ? r.rows[0].valor : 2.7;
}

module.exports = { ErrorHttp, ruta, soloRol, conEntidad, HORA, EN_LIMA, factorCo2 };
