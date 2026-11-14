import { useRef, useState } from 'react';
import { api } from './api.js';
import { Encabezado, Aviso, usarApi, Tabla } from './Marco.jsx';
import { fecha } from './paneles.js';

export const SECCIONES_ADMIN = [['verificaciones', 'Verificaciones'], ['constancias', 'Constancias']];

// I-12 · Cola de verificación
export function Verificaciones({ token, alExpirar }) {
  const carga = usarApi(token, '/admin/verificaciones', alExpirar);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupada, setOcupada] = useState(null);
  const campoMotivo = useRef(null);

  const decidir = async (s, resultado) => {
    setAviso('');
    if (resultado === 'rechazado' && motivo.trim().length < 5) {
      setError('Escribe el motivo del rechazo (mínimo 5 letras) y vuelve a pulsar Rechazar');
      campoMotivo.current?.focus();
      return;
    }
    setError('');
    const clave = `${s.tipo}-${s.id}`;
    setOcupada(clave);
    const r = await api(token, 'POST', '/admin/verificaciones', { tipo: s.tipo, id: s.id, resultado, motivo: resultado === 'rechazado' ? motivo.trim() : undefined });
    setOcupada(null);
    if (r.expirada) return alExpirar();
    if (!r.ok) setError(r.mensaje);
    else {
      setAviso(`${s.solicitante}: ${resultado === 'aprobado' ? 'cuenta habilitada' : 'solicitud rechazada'}.`);
      if (resultado === 'rechazado') setMotivo('');
    }
    carga.recargar();
  };

  return (
    <>
      <Encabezado titulo="Cola de verificación" bajada="Revisa el RUC, la dirección y el rubro antes de habilitar la cuenta." />
      {aviso && <p role="status" className="nota-ok">{aviso}</p>}
      <Aviso carga={carga} vacio="No hay solicitudes pendientes." />
      {carga.datos?.length > 0 && (
        <>
          <Tabla>
              <thead><tr><th>Solicitante</th><th>Tipo</th><th>RUC</th><th>Distrito</th><th>Enviada</th><th>Acción</th></tr></thead>
              <tbody>
                {carga.datos.map((s) => {
                  const clave = `${s.tipo}-${s.id}`;
                  return (
                    <tr key={clave}>
                      <td><strong>{s.solicitante}</strong><span className="celda-nota">{s.direccion}</span></td>
                      <td>{s.tipo === 'comercio' ? 'Comercio' : 'Organización'}</td>
                      <td>{s.ruc}</td>
                      <td>{s.distrito}</td>
                      <td>{fecha(s.enviada)}</td>
                      <td>
                        <div className="acciones-celda">
                          <button type="button" className="boton boton-chico" disabled={ocupada === clave} onClick={() => decidir(s, 'aprobado')} aria-label={`Aprobar ${s.solicitante}`}>Aprobar</button>
                          <button type="button" className="boton boton-chico boton-rechazo" disabled={ocupada === clave} onClick={() => decidir(s, 'rechazado')} aria-label={`Rechazar ${s.solicitante}`}>Rechazar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          <div className="caja caja-motivo">
            <div className="campo">
              <label htmlFor="motivo">Motivo del rechazo (obligatorio si rechazas)</label>
              <input id="motivo" ref={campoMotivo} maxLength={250} placeholder="Ej.: el RUC no figura como activo en SUNAT" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-invalid={!!error} />
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
