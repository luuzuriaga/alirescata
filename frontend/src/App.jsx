import { useEffect, useState } from 'react';
import { api } from './api.js';
import Ingreso from './Ingreso.jsx';
import Catalogo from './Catalogo.jsx';
import Detalle from './Detalle.jsx';
import MisReservas from './MisReservas.jsx';
import Marco, { Encabezado } from './Marco.jsx';
import DatosInstitucion from './DatosInstitucion.jsx';
import { SECCIONES_COMERCIO, MisOfertas, PublicarExcedente, ValidarRecojo, CierreDia, DonacionesComercio, MiImpacto } from './PanelComercio.jsx';
import { SECCIONES_ORGANIZACION, DonacionesDisponibles, MisDonaciones, ImpactoOrganizacion } from './PanelOrganizacion.jsx';
import { SECCIONES_ADMIN, Verificaciones } from './PanelAdmin.jsx';
import { Constancias, Constancia } from './Constancias.jsx';

const INICIO = { comercio: 'ofertas', organizacion: 'disponibles', administrador: 'verificaciones' };
const SECCIONES = { comercio: SECCIONES_COMERCIO, organizacion: SECCIONES_ORGANIZACION, administrador: SECCIONES_ADMIN };

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [perfil, setPerfil] = useState(null);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [aviso, setAviso] = useState('');

  const entrar = (t) => { sessionStorage.setItem('token', t); setPerfil(null); setToken(t); setAviso(''); };
  const salir = (mensaje = '') => { sessionStorage.removeItem('token'); setToken(null); setPerfil(null); setAviso(mensaje); };
  const expirar = () => salir('Tu sesión terminó. Vuelve a ingresar.');

  useEffect(() => {
    if (!token) return undefined;
    let vigente = true;
    api(token, 'GET', '/perfil').then((r) => {
      if (!vigente) return;
      if (r.expirada) return expirar();
      setErrorPerfil(r.ok ? '' : r.mensaje);
      if (r.ok) setPerfil(r.datos);
    });
    return () => { vigente = false; };
  }, [token, vuelta]); // eslint-disable-line

  if (!token) return <Ingreso alIngresar={entrar} aviso={aviso} />;
  if (!perfil) {
    return (
      <main className="pantalla">
        <div className="contenido">
          {errorPerfil
            ? <><p role="alert" className="error-general">{errorPerfil}</p><button type="button" className="boton" onClick={() => setVuelta((n) => n + 1)}>Reintentar</button><button type="button" className="boton boton-secundario" onClick={() => salir()}>Cerrar sesión</button></>
            : <p className="estado" role="status">Cargando…</p>}
        </div>
      </main>
    );
  }
  if (perfil.rol === 'consumidor') return <Consumidor token={token} alExpirar={expirar} alSalir={() => salir()} />;
  return <Panel key={perfil.rol} token={token} perfil={perfil} alExpirar={expirar} alSalir={() => salir()} alActualizar={() => setVuelta((n) => n + 1)} />;
}

function Consumidor({ token, alExpirar, alSalir }) {
  const [vista, setVista] = useState('catalogo');
  const [oferta, setOferta] = useState(null);
  if (vista === 'detalle' && oferta) return <Detalle oferta={oferta} token={token} alVolver={() => setVista('catalogo')} alExpirar={alExpirar} />;
  if (vista === 'reservas') return <MisReservas token={token} alVolver={() => setVista('catalogo')} alExpirar={alExpirar} alSalir={alSalir} />;
  return <Catalogo alElegir={(o) => { setOferta(o); setVista('detalle'); }} alVerReservas={() => setVista('reservas')} />;
}

function Panel({ token, perfil, alExpirar, alSalir, alActualizar }) {
  const { rol, entidad } = perfil;
  const [seccion, setSeccion] = useState(INICIO[rol]);
  const [constancia, setConstancia] = useState(null);
  const [aviso, setAviso] = useState('');
  const ir = (id, mensaje = '') => { setConstancia(null); setAviso(mensaje); setSeccion(id); };
  const comun = { token, alExpirar };
  const habilitado = rol === 'administrador' || entidad?.estado === 'aprobado';
  const etiqueta = rol === 'administrador'
    ? 'Administración · Alirescata'
    : `${entidad?.nombre || perfil.nombres} · ${{ aprobado: 'Verificado ✓', pendiente: 'En revisión', rechazado: 'No aprobado' }[entidad?.estado] || 'Sin verificar'}`;

  let contenido;
  if (!habilitado) {
    if (!entidad) contenido = <DatosInstitucion rol={rol} {...comun} alGuardar={alActualizar} />;
    else if (entidad.estado === 'pendiente') {
      contenido = (
        <>
          <Encabezado titulo="Tu cuenta está en revisión" bajada="Administración está verificando tus datos. Te habilitaremos apenas termine la revisión." />
          <div className="acciones"><button type="button" className="boton boton-auto boton-neutro" onClick={alActualizar}>Volver a consultar</button></div>
        </>
      );
    } else {
      contenido = (
        <>
          <Encabezado titulo="No pudimos habilitar tu cuenta" bajada="Administración revisó tus datos y rechazó la solicitud." />
          {entidad.motivo && <p className="error-general">Motivo: {entidad.motivo}</p>}
        </>
      );
    }
  } else if (constancia) {
    contenido = <Constancia {...comun} codigo={constancia} alVolver={() => setConstancia(null)} />;
  } else if (seccion === 'constancias') {
    contenido = <Constancias {...comun} alVer={setConstancia} />;
  } else if (rol === 'comercio') {
    contenido = {
      ofertas: <MisOfertas {...comun} aviso={aviso} alPublicar={() => ir('publicar')} />,
      publicar: <PublicarExcedente {...comun} alTerminar={() => ir('ofertas', 'Tu oferta ya está publicada en el catálogo.')} alCancelar={() => ir('ofertas')} />,
      validar: <ValidarRecojo {...comun} />,
      cierre: <CierreDia {...comun} />,
      donaciones: <DonacionesComercio {...comun} alVerConstancia={setConstancia} />,
      impacto: <MiImpacto {...comun} />,
    }[seccion];
  } else if (rol === 'organizacion') {
    contenido = {
      disponibles: <DonacionesDisponibles {...comun} alReclamar={(mensaje) => ir('mias', mensaje)} />,
      mias: <MisDonaciones {...comun} aviso={aviso} alVerConstancia={setConstancia} />,
      impacto: <ImpactoOrganizacion {...comun} />,
    }[seccion];
  } else {
    contenido = <Verificaciones {...comun} />;
  }

  return (
    <Marco etiqueta={etiqueta} secciones={habilitado ? SECCIONES[rol] : []} activa={seccion} alCambiar={(id) => ir(id)} alSalir={alSalir}>
      {contenido}
    </Marco>
  );
}
