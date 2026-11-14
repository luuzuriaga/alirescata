import { Encabezado, Aviso, usarApi, Tabla } from './Marco.jsx';
import { fecha, fechaHora, kilos, packs, tipoOrganizacion, codigoVerificacion, huellaCorta } from './paneles.js';

export function Constancias({ token, alExpirar, alVer }) {
  const carga = usarApi(token, '/constancias', alExpirar);
  return (
    <>
      <Encabezado titulo="Constancias" bajada="Se emiten cuando la organización confirma que recibió la donación." />
      <Aviso carga={carga} vacio="Todavía no hay constancias emitidas." />
      {carga.datos?.length > 0 && (
        <Tabla>
            <thead><tr><th>N.º</th><th>Emitida</th><th>Donante</th><th>Receptora</th><th>Donación</th><th><span className="oculto">Acción</span></th></tr></thead>
            <tbody>
              {carga.datos.map((k) => (
                <tr key={k.codigo_constancia}>
                  <td><strong>{k.codigo_constancia}</strong></td>
                  <td>{fecha(k.emitida_en)}</td>
                  <td>{k.nombre_comercial}</td>
                  <td>{k.organizacion}</td>
                  <td>{packs(k.cantidad_packs)} (≈ {kilos(k.kg)})</td>
                  <td><button type="button" className="enlace" onClick={() => alVer(k.codigo_constancia)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </Tabla>
      )}
    </>
  );
}

// I-10 · Constancia de donación
export function Constancia({ token, codigo, alExpirar, alVolver }) {
  const carga = usarApi(token, `/constancias/${encodeURIComponent(codigo)}`, alExpirar);
  const k = carga.datos;
  return (
    <>
      <div className="acciones no-imprimir">
        <button type="button" className="boton boton-auto boton-neutro" onClick={alVolver}>‹ Volver</button>
        {k && <button type="button" className="boton boton-auto" onClick={() => window.print()}>Imprimir o guardar PDF</button>}
      </div>
      <Aviso carga={carga} />
      {k && (
        <article className="constancia">
          <header className="constancia-cabecera">
            <span className="constancia-marca">Alirescata</span>
            <h2>Constancia de donación N.º {k.codigo_constancia}</h2>
          </header>
          <div className="constancia-cuerpo">
            <h3>Datos del donante</h3>
            <p>{k.nombre_comercial} · RUC {k.ruc_comercio} · {k.distrito}, Lima</p>
            <h3>Datos de la organización receptora</h3>
            <p>{k.organizacion} · RUC {k.ruc_organizacion} · {tipoOrganizacion(k.tipo_organizacion)}</p>
            <h3>Detalle de la donación</h3>
            <Tabla clara>
                <thead><tr><th>Descripción</th><th>Cantidad</th><th>Peso aprox.</th><th>CO₂e evitado</th></tr></thead>
                <tbody><tr><td>{k.descripcion}</td><td>{packs(k.cantidad_packs)}</td><td>{kilos(k.kg)}</td><td>{kilos(k.co2_evitado)}</td></tr></tbody>
              </Tabla>
            <h3>Entrega y recepción</h3>
            <p className="constancia-fechas">
              <span>Donación reclamada: {fechaHora(k.reclamada_en)}</span>
              <span>Recepción confirmada por la organización: {fechaHora(k.recibida_en)}</span>
            </p>
            <p className="suave">Esta constancia sirve como registro de entrega y recepción de la donación (Ley N.º 30498 y su reglamento).</p>
            <div className="constancia-pie">
              <p>Código de verificación: {codigoVerificacion(k.hash_sha256)}</p>
              <p className="suave">Huella del documento (SHA-256): {huellaCorta(k.hash_sha256)}</p>
              <p className="suave">Emitida automáticamente por Alirescata el {fechaHora(k.emitida_en)}</p>
            </div>
          </div>
        </article>
      )}
    </>
  );
}
