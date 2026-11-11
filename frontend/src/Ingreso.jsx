import { useState } from 'react';
import { correoValido, contrasenaValida } from './validaciones.js';

export default function Ingreso() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState({});
  const enviar = (e) => {
    e.preventDefault();
    const er = {};
    if (!correoValido(correo)) er.correo = 'Ingresa un correo válido, por ejemplo nombre@correo.com';
    if (!contrasenaValida(clave)) er.clave = 'Mínimo 8 caracteres, con una mayúscula y un número';
    setErrores(er);
  };
  return (
    <main style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif', maxWidth: 360, margin: '40px auto' }}>
      <h1 style={{ color: '#2E7D32' }}>Alirescata</h1>
      <form onSubmit={enviar} noValidate>
        <label>Correo electrónico<input value={correo} onChange={(e) => setCorreo(e.target.value)} /></label>
        {errores.correo && <p style={{ color: '#B71C1C' }}>{errores.correo}</p>}
        <label>Contraseña<input type="password" value={clave} onChange={(e) => setClave(e.target.value)} /></label>
        {errores.clave && <p style={{ color: '#B71C1C' }}>{errores.clave}</p>}
        <button type="submit" style={{ background: '#2E7D32', color: '#fff', minHeight: 44 }}>Ingresar</button>
      </form>
    </main>
  );
}
