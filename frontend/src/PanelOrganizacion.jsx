import { useState } from 'react';
import { api } from './api.js';
import { Encabezado, Etiqueta, Aviso, usarApi, Tabla } from './Marco.jsx';
import { DISTRITOS } from './catalogo.js';
import { ventana, kilos, packs, ESTADOS_DONACION } from './paneles.js';

export const SECCIONES_ORGANIZACION = [['disponibles', 'Disponibles'], ['mias', 'Mis donaciones'], ['constancias', 'Constancias'], ['impacto', 'Mi impacto']];

// I-09 · Donaciones disponibles
export function DonacionesDisponibles({ token, alExpirar, alReclamar }) {
  const carga = usarApi(token, '/donaciones/disponibles', alExpirar);
  const [distrito, setDistrito] = useState(null);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState(null);
  const visibles = (carga.datos || []).filter((d) => !distrito || d.distrito === distrito);

  const reclamar = async (d) => {
    setError('');
    setOcupada(d.id_donacion);
    const r = await api(token, 'POST', `/donaciones/${d.id_donacion}/reclamar`);
    setOcupada(null);
    if (r.expirada) return alExpirar();
    if (!r.ok) { setError(r.mensaje); carga.recargar(); return; }
    alReclamar(`Reclamaste la donación de ${d.nombre_comercial}. Recógela ${ventana(d.recojo_desde, d.recojo_hasta).toLowerCase()} en ${d.direccion}.`);
  };

  return (
    <>
      <Encabezado titulo="Donaciones disponibles" bajada="Se actualizan cuando los comercios cierran su ventana de venta." />
      <div className="chips filtros" role="group" aria-label="Distrito">
        <button type="button" className="chip" aria-pressed={!distrito} onClick={() => setDistrito(null)}>Todos los distritos</button>
        {DISTRITOS.map((n) => <button key={n} type="button" className="chip" aria-pressed={distrito === n} onClick={() => setDistrito(n)}>{n}</button>)}
      </div>
      {error && <p role="alert" className="error-general">{error}</p>}
      <Aviso carga={carga} />
      {carga.datos && visibles.length === 0 && <p className="estado">{carga.datos.length === 0 ? 'Por ahora no hay donaciones disponibles.' : 'No hay donaciones en ese distrito.'}</p>}
      {visibles.length > 0 && (
        <Tabla>
            <thead><tr><th>Comercio</th><th>Alimentos</th><th>Cantidad</th><th>Recojo</th><th><span className="oculto">Acción</span></th></tr></thead>
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id_donacion}>
                  <td><strong>{d.nombre_comercial}</strong></td>
                  <td>{d.alimentos}</td>
                  <td>{packs(d.cantidad_packs)} (≈ {kilos(d.kg)})</td>
                  <td>{ventana(d.recojo_desde, d.recojo_hasta)} · {d.distrito}</td>
                  <td>
                    {d.estado === 'disponible'
                      ? <button type="button" className="boton boton-chico" disabled={ocupada === d.id_donacion} onClick={() => reclamar(d)} aria-label={`Reclamar donación de ${d.nombre_comercial}`}>Reclamar</button>
                      : <Etiqueta>Reclamada por otra org.</Etiqueta>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
      )}
      <div className="nota-pago">
        <p>Al reclamar una donación te comprometes a recogerla dentro de la ventana indicada. Gana quien reclama primero.</p>
        <p className="suave">Cuando recojas los alimentos, confirma la recepción para que se emita la constancia.</p>
      </div>
    </>
  );
}

export function MisDonaciones({ token, alExpirar, alVerConstancia, aviso }) {
  const carga = usarApi(token, '/donaciones/mias', alExpirar);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState(null);

  const recibir = async (d) => {
    setError('');
    setOcupada(d.id_donacion);
    const r = await api(token, 'POST', `/donaciones/${d.id_donacion}/recibir`);
    setOcupada(null);
    if (r.expirada) return alExpirar();
    if (!r.ok) { setError(r.mensaje); carga.recargar(); return; }
    alVerConstancia(r.datos.codigo_constancia);
  };

  return (
    <>
      <Encabezado titulo="Mis donaciones" bajada="Las donaciones que reclamaste. Confirma la recepción cuando recojas los alimentos." />
      {aviso && <p role="status" className="nota-ok">{aviso}</p>}
      {error && <p role="alert" className="error-general">{error}</p>}
      <Aviso carga={carga} vacio="Todavía no reclamaste ninguna donación." />
      {carga.datos?.length > 0 && (
        <Tabla>
            <thead><tr><th>Comercio</th><th>Alimentos</th><th>Cantidad</th><th>Recojo</th><th>Estado</th><th><span className="oculto">Acción</span></th></tr></thead>
            <tbody>
              {carga.datos.map((d) => {
                const [texto, tono] = ESTADOS_DONACION[d.estado] || [d.estado, 'neutro'];
                return (
                  <tr key={d.id_donacion}>
                    <td><strong>{d.nombre_comercial}</strong><span className="celda-nota">{d.direccion} · {d.distrito}</span></td>
                    <td>{d.alimentos}</td>
                    <td>{packs(d.cantidad_packs)} (≈ {kilos(d.kg)})</td>
                    <td>{ventana(d.recojo_desde, d.recojo_hasta)}</td>
                    <td><Etiqueta tono={tono}>{texto}</Etiqueta></td>
                    <td>
                      {d.estado === 'reclamada' && <button type="button" className="boton boton-chico" disabled={ocupada === d.id_donacion} onClick={() => recibir(d)}>Confirmar recepción</button>}
                      {d.codigo_constancia && <button type="button" className="enlace" onClick={() => alVerConstancia(d.codigo_constancia)}>Ver constancia</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
      )}
    </>
  );
}

export function ImpactoOrganizacion({ token, alExpirar }) {
  const carga = usarApi(token, '/donaciones/impacto', alExpirar);
  const d = carga.datos;
  return (
    <>
      <Encabezado titulo="Mi impacto" bajada="Resumen acumulado de las donaciones que recibió tu organización." />
      <Aviso carga={carga} />
      {d && (
        <>
          <div className="cifras">
            <div className="cifra borde-verde"><span>Alimento recibido</span><strong>{kilos(d.kg_recibidos)}</strong></div>
            <div className="cifra borde-verde"><span>CO₂e evitado</span><strong>{kilos(d.co2_evitado)}</strong></div>
            <div className="cifra borde-azul"><span>Packs recibidos</span><strong>{d.packs}</strong></div>
            <div className="cifra borde-rojo"><span>Donaciones con constancia</span><strong>{d.constancias}</strong></div>
          </div>
          <p className="suave">Factor de emisión usado: {d.factor} kg CO₂e/kg</p>
        </>
      )}
    </>
  );
}
