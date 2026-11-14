import { useState } from 'react';
import { api } from './api.js';
import { Encabezado, Campo, usarApi, Aviso } from './Marco.jsx';
import { rucValido, TIPOS_COMERCIO, TIPOS_ORGANIZACION } from './paneles.js';

// Primer paso de comercios y organizaciones: sus datos, que administración revisa antes de habilitar la cuenta.
export default function DatosInstitucion({ rol, token, alExpirar, alGuardar }) {
  const esComercio = rol === 'comercio';
  const catalogos = usarApi(null, '/catalogos', alExpirar);
  const [f, setF] = useState({ ruc: '', razon_social: '', nombre_comercial: '', direccion: '', id_distrito: '', tipo: '', hora_apertura: '07:00', hora_cierre: '21:00' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const poner = (campo) => (e) => setF((p) => ({ ...p, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const er = {};
    if (!rucValido(f.ruc.trim())) er.ruc = 'Ingresa un RUC válido de 11 dígitos';
    if (f.razon_social.trim().length < 2) er.razon_social = 'Escribe la razón social';
    if (esComercio && f.nombre_comercial.trim().length < 2) er.nombre_comercial = 'Escribe el nombre comercial';
    if (f.direccion.trim().length < 5) er.direccion = 'Escribe la dirección completa';
    if (!f.id_distrito) er.id_distrito = 'Elige un distrito';
    if (!f.tipo) er.tipo = 'Elige una opción';
    if (esComercio && f.hora_cierre <= f.hora_apertura) er.hora_cierre = 'Debe ser posterior a la hora de apertura';
    setErrores(er);
    if (Object.keys(er).length) return;
    const comun = { ruc: f.ruc.trim(), razon_social: f.razon_social.trim(), direccion: f.direccion.trim(), id_distrito: Number(f.id_distrito) };
    const cuerpo = esComercio
      ? { ...comun, nombre_comercial: f.nombre_comercial.trim(), tipo_comercio: f.tipo, hora_apertura: f.hora_apertura, hora_cierre: f.hora_cierre }
      : { ...comun, tipo: f.tipo };
    setEnviando(true);
    const r = await api(token, 'POST', esComercio ? '/comercios' : '/organizaciones', cuerpo);
    setEnviando(false);
    if (r.expirada) return alExpirar();
    if (!r.ok) return setErrores({ general: r.mensaje });
    alGuardar();
  };

  if (!catalogos.datos) return <Aviso carga={catalogos} />;
  const tipos = esComercio ? TIPOS_COMERCIO : TIPOS_ORGANIZACION;
  return (
    <>
      <Encabezado titulo={esComercio ? 'Datos de tu comercio' : 'Datos de tu organización'} bajada="Administración revisa el RUC, la dirección y el rubro antes de habilitar la cuenta." />
      <form className="formulario" onSubmit={enviar} noValidate>
        {errores.general && <p role="alert" className="error-general">{errores.general}</p>}
        <div className="rejilla">
          <Campo id="ruc" etiqueta="RUC *" error={errores.ruc}>
            <input id="ruc" inputMode="numeric" maxLength={11} value={f.ruc} onChange={poner('ruc')} aria-invalid={!!errores.ruc} />
          </Campo>
          <Campo id="razon" etiqueta="Razón social *" error={errores.razon_social}>
            <input id="razon" value={f.razon_social} onChange={poner('razon_social')} aria-invalid={!!errores.razon_social} />
          </Campo>
          {esComercio && (
            <Campo id="comercial" etiqueta="Nombre comercial *" error={errores.nombre_comercial}>
              <input id="comercial" value={f.nombre_comercial} onChange={poner('nombre_comercial')} aria-invalid={!!errores.nombre_comercial} />
            </Campo>
          )}
          <Campo id="tipo" etiqueta={esComercio ? 'Rubro *' : 'Tipo de organización *'} error={errores.tipo}>
            <select id="tipo" value={f.tipo} onChange={poner('tipo')} aria-invalid={!!errores.tipo}>
              <option value="">Elige…</option>
              {tipos.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </Campo>
          <Campo id="direccion" etiqueta="Dirección *" error={errores.direccion}>
            <input id="direccion" autoComplete="street-address" value={f.direccion} onChange={poner('direccion')} aria-invalid={!!errores.direccion} />
          </Campo>
          <Campo id="distrito" etiqueta="Distrito *" error={errores.id_distrito}>
            <select id="distrito" value={f.id_distrito} onChange={poner('id_distrito')} aria-invalid={!!errores.id_distrito}>
              <option value="">Elige…</option>
              {catalogos.datos.distritos.map((d) => <option key={d.id_distrito} value={d.id_distrito}>{d.nombre}</option>)}
            </select>
          </Campo>
          {esComercio && (
            <>
              <Campo id="apertura" etiqueta="Hora de apertura *">
                <input id="apertura" type="time" value={f.hora_apertura} onChange={poner('hora_apertura')} />
              </Campo>
              <Campo id="cierre" etiqueta="Hora de cierre *" error={errores.hora_cierre}>
                <input id="cierre" type="time" value={f.hora_cierre} onChange={poner('hora_cierre')} aria-invalid={!!errores.hora_cierre} />
              </Campo>
            </>
          )}
        </div>
        <div className="acciones">
          <button type="submit" className="boton boton-auto" disabled={enviando}>{enviando ? 'Un momento…' : 'Enviar a verificación'}</button>
        </div>
      </form>
    </>
  );
}
