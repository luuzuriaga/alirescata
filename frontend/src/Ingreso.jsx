import { useState } from 'react';
import { correoValido, contrasenaValida, nombresValidos } from './validaciones.js';
import { ingresar, registrar } from './api.js';

const ROLES = [['consumidor', 'Consumidor'], ['comercio', 'Comercio'], ['organizacion', 'Organización']];

export default function Ingreso() {
  const [modo, setModo] = useState('ingresar');
  const [nombres, setNombres] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState('consumidor');
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [sesion, setSesion] = useState(() => sessionStorage.getItem('token'));
  const creando = modo === 'crear';

  const cambiarModo = (m) => { setModo(m); setErrores({}); };

  const enviar = async (e) => {
    e.preventDefault();
    const er = {};
    if (creando && !nombresValidos(nombres)) er.nombres = 'Escribe tu nombre (mínimo 2 letras)';
    if (!correoValido(correo)) er.correo = 'Ingresa un correo válido, por ejemplo nombre@correo.com';
    if (!contrasenaValida(clave)) er.clave = 'Mínimo 8 caracteres, con una mayúscula y un número';
    if (creando && !acepta) er.acepta = 'Debes aceptar el tratamiento de tus datos para crear la cuenta';
    setErrores(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    let r = { ok: true };
    if (creando) r = await registrar({ correo, contrasena: clave, nombres: nombres.trim(), rol, consentimiento: true });
    if (r.ok) r = await ingresar(correo, clave);
    setEnviando(false);
    if (!r.ok) return setErrores({ general: r.mensaje });
    sessionStorage.setItem('token', r.token);
    setSesion(r.token);
  };

  const salir = () => { sessionStorage.removeItem('token'); setSesion(null); setClave(''); };

  const marca = (
    <header className="marca">
      <h1>Alirescata</h1>
      <p>Que ningún alimento apto se pierda</p>
    </header>
  );

  if (sesion) {
    return (
      <main className="pantalla">
        <div className="contenido">
          {marca}
          <p className="aviso">Ingresaste correctamente.</p>
          <button type="button" className="boton boton-secundario" onClick={salir}>Cerrar sesión</button>
        </div>
      </main>
    );
  }

  return (
    <main className="pantalla">
      <div className="contenido">
        {marca}
        <div className="pestanas" role="tablist" aria-label="Ingreso o registro">
          <button type="button" role="tab" className="pestana" aria-selected={!creando} onClick={() => cambiarModo('ingresar')}>Ingresar</button>
          <button type="button" role="tab" className="pestana" aria-selected={creando} onClick={() => cambiarModo('crear')}>Crear cuenta</button>
        </div>
        <form onSubmit={enviar} noValidate>
          {errores.general && <p role="alert" className="error-general">{errores.general}</p>}
          {creando && (
            <div className="campo">
              <label htmlFor="nombres">Nombres</label>
              <input id="nombres" autoComplete="name" value={nombres} onChange={(e) => setNombres(e.target.value)} aria-invalid={!!errores.nombres} />
              {errores.nombres && <p className="error">{errores.nombres}</p>}
            </div>
          )}
          <div className="campo">
            <label htmlFor="correo">Correo electrónico</label>
            <input id="correo" type="email" inputMode="email" autoComplete="email" placeholder="nombre@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} aria-invalid={!!errores.correo} />
            {errores.correo && <p className="error">{errores.correo}</p>}
          </div>
          <div className="campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" autoComplete={creando ? 'new-password' : 'current-password'} value={clave} onChange={(e) => setClave(e.target.value)} aria-invalid={!!errores.clave} />
            {errores.clave && <p className="error">{errores.clave}</p>}
          </div>
          {creando && (
            <>
              <fieldset className="grupo">
                <legend className="grupo-titulo">Soy…</legend>
                <div className="chips" role="radiogroup" aria-label="Tipo de cuenta">
                  {ROLES.map(([valor, texto]) => (
                    <button key={valor} type="button" role="radio" className="chip" aria-checked={rol === valor} onClick={() => setRol(valor)}>{texto}</button>
                  ))}
                </div>
              </fieldset>
              <label className="consentimiento">
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                <span>Acepto el tratamiento de mis datos personales (Ley 29733)</span>
              </label>
              {errores.acepta && <p className="error">{errores.acepta}</p>}
            </>
          )}
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? 'Un momento…' : creando ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
