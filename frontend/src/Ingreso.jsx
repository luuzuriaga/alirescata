import { useState } from 'react';
import { correoValido, contrasenaValida } from './validaciones.js';
import { ingresar } from './api.js';

export default function Ingreso() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [sesion, setSesion] = useState(() => sessionStorage.getItem('token'));
  const enviar = async (e) => {
    e.preventDefault();
    const er = {};
    if (!correoValido(correo)) er.correo = 'Ingresa un correo válido, por ejemplo nombre@correo.com';
    if (!contrasenaValida(clave)) er.clave = 'Mínimo 8 caracteres, con una mayúscula y un número';
    setErrores(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    const r = await ingresar(correo, clave);
    setEnviando(false);
    if (!r.ok) return setErrores({ general: r.mensaje });
    sessionStorage.setItem('token', r.token);
    setSesion(r.token);
  };
  const salir = () => { sessionStorage.removeItem('token'); setSesion(null); setClave(''); };
  const marco = { fontFamily: 'Inter, Roboto, Arial, sans-serif', maxWidth: 360, margin: '40px auto' };
  if (sesion) {
    return (
      <main style={marco}>
        <h1 style={{ color: '#2E7D32' }}>Alirescata</h1>
        <p>Ingresaste correctamente.</p>
        <button type="button" onClick={salir} style={{ minHeight: 44 }}>Cerrar sesión</button>
      </main>
    );
  }
  return (
    <main style={marco}>
      <h1 style={{ color: '#2E7D32' }}>Alirescata</h1>
      <form onSubmit={enviar} noValidate>
        <label>Correo electrónico<input value={correo} onChange={(e) => setCorreo(e.target.value)} /></label>
        {errores.correo && <p style={{ color: '#B71C1C' }}>{errores.correo}</p>}
        <label>Contraseña<input type="password" value={clave} onChange={(e) => setClave(e.target.value)} /></label>
        {errores.clave && <p style={{ color: '#B71C1C' }}>{errores.clave}</p>}
        {errores.general && <p role="alert" style={{ color: '#B71C1C' }}>{errores.general}</p>}
        <button type="submit" disabled={enviando} style={{ background: '#2E7D32', color: '#fff', minHeight: 44 }}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  );
}
