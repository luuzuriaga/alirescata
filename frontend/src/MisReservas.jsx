import { useEffect, useState } from 'react';
import { misReservas } from './api.js';
import { soles, recojoLargo } from './catalogo.js';

const ESTADOS = { activa: 'Por recoger', entregada: 'Entregada', vencida: 'Vencida', cancelada: 'Cancelada' };

export default function MisReservas({ token, alVolver, alExpirar, alSalir }) {
  const [estado, setEstado] = useState({ cargando: true, reservas: [], error: '' });

  useEffect(() => {
    let vigente = true;
    misReservas(token).then((r) => {
      if (!vigente) return;
      if (r.expirada) return alExpirar();
      setEstado({ cargando: false, reservas: r.ok ? r.reservas : [], error: r.ok ? '' : r.mensaje });
    });
    return () => { vigente = false; };
  }, [token]);

  return (
    <div className="app">
      <header className="barra">
        <button type="button" className="barra-volver" onClick={alVolver}>
          <span aria-hidden="true">‹</span> Mis reservas
        </button>
      </header>
      <main className="cuerpo">
        {estado.cargando && <p className="estado" role="status">Cargando tus reservas…</p>}
        {estado.error && <p role="alert" className="error-general">{estado.error}</p>}
        {!estado.cargando && !estado.error && estado.reservas.length === 0 && (
          <p className="estado">Todavía no tienes reservas. Elige un pack del catálogo.</p>
        )}
        <ul className="ofertas">
          {estado.reservas.map((r) => (
            <li key={r.id_reserva} className="reserva">
              <div className="reserva-cabecera">
                <h2>{r.nombre}</h2>
                <span className={`etiqueta etiqueta-${r.estado}`}>{ESTADOS[r.estado] || r.estado}</span>
              </div>
              <p className="suave">{r.nombre_comercial} · {r.direccion}</p>
              <p className="linea">{r.cantidad} {r.cantidad === 1 ? 'pack' : 'packs'} · {soles(r.cantidad * r.precio_unitario)} · Recojo {recojoLargo(r)}</p>
              <p className="codigo codigo-chico">{r.codigo_recojo}</p>
            </li>
          ))}
        </ul>
        <button type="button" className="boton boton-secundario" onClick={alSalir}>Cerrar sesión</button>
      </main>
    </div>
  );
}
