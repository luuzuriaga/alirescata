import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Marco de los paneles: barra superior con la institución y menú de secciones
// (lateral en escritorio, desplegable con el botón "Menú" en teléfono).
export default function Marco({ etiqueta, secciones = [], activa, alCambiar, alSalir, children }) {
  const [abierto, setAbierto] = useState(false);
  const elegir = (id) => { setAbierto(false); alCambiar(id); };
  return (
    <div className="marco">
      <header className="barra barra-ancha">
        <div className="barra-inicio">
          <button type="button" className="menu-boton" aria-expanded={abierto} aria-controls="menu-secciones" onClick={() => setAbierto(!abierto)}>
            <span aria-hidden="true">{abierto ? '✕' : '☰'}</span> Menú
          </button>
          <h1>Alirescata</h1>
        </div>
        <span className="barra-etiqueta">{etiqueta}</span>
      </header>
      <div className="marco-cuerpo">
        <nav id="menu-secciones" className={abierto ? 'lateral lateral-abierta' : 'lateral'} aria-label="Secciones">
          {secciones.map(([id, texto]) => (
            <button key={id} type="button" className="lateral-item" aria-current={activa === id ? 'page' : undefined} onClick={() => elegir(id)}>{texto}</button>
          ))}
          <button type="button" className="lateral-item lateral-salir" onClick={alSalir}>Cerrar sesión</button>
        </nav>
        <main className="panel">{children}</main>
      </div>
    </div>
  );
}

// Tabla que en teléfono se convierte en tarjetas: copia el título de cada columna a sus celdas
// (data-etiqueta) para que la hoja de estilos lo muestre junto al dato.
export function Tabla({ clara = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const titulos = [...ref.current.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    ref.current.querySelectorAll('tbody tr').forEach((fila) => {
      [...fila.children].forEach((celda, i) => celda.setAttribute('data-etiqueta', titulos[i] || ''));
    });
  });
  return (
    <div className="tabla-marco">
      <table ref={ref} className={clara ? 'tabla tabla-clara' : 'tabla'}>{children}</table>
    </div>
  );
}

export function Encabezado({ titulo, bajada }) {
  return (
    <>
      <h2 className="panel-titulo">{titulo}</h2>
      {bajada && <p className="panel-bajada">{bajada}</p>}
    </>
  );
}

// Carga datos de la API para una pantalla: { cargando, error, datos, recargar }.
export function usarApi(token, ruta, alExpirar) {
  const [estado, setEstado] = useState({ cargando: true, error: '', datos: null });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vigente = true;
    api(token, 'GET', ruta).then((r) => {
      if (!vigente) return;
      if (r.expirada) return alExpirar();
      setEstado({ cargando: false, error: r.ok ? '' : r.mensaje, datos: r.ok ? r.datos : null });
    });
    return () => { vigente = false; };
  }, [token, ruta, vuelta]); // eslint-disable-line
  const recargar = useCallback(() => setVuelta((n) => n + 1), []);
  return { ...estado, recargar };
}

// Mensajes de carga, error o lista vacía; devuelve null cuando hay contenido que mostrar.
export function Aviso({ carga, vacio }) {
  if (carga.cargando) return <p className="estado" role="status">Cargando…</p>;
  if (carga.error) return <p role="alert" className="error-general">{carga.error}</p>;
  if (vacio && Array.isArray(carga.datos) && carga.datos.length === 0) return <p className="estado">{vacio}</p>;
  return null;
}

export function Etiqueta({ tono = 'neutro', children }) {
  return <span className={`etiqueta tono-${tono}`}>{children}</span>;
}

export function Campo({ id, etiqueta, error, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
