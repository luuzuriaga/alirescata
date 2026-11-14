import { useState } from 'react';
import { reservar } from './api.js';
import Foto from './Foto.jsx';
import { soles, hora, recojoLargo, cantidadMaxima } from './catalogo.js';

export default function Detalle({ oferta, token, alVolver, alExpirar }) {
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [agotada, setAgotada] = useState(false);
  const [codigo, setCodigo] = useState(null);
  const maximo = cantidadMaxima(oferta);
  const limite = hora(oferta.ventana_fin);

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    const r = await reservar(token, oferta.id_oferta, cantidad);
    setEnviando(false);
    if (r.expirada) return alExpirar();
    if (!r.ok) { setError(r.mensaje); setAgotada(!!r.agotada); return; }
    setCodigo(r.codigo);
  };

  return (
    <div className="app">
      <header className="barra">
        <button type="button" className="barra-volver" onClick={alVolver}>
          <span aria-hidden="true">‹</span> Detalle de la oferta
        </button>
      </header>
      <main className="cuerpo">
        <Foto oferta={oferta} grande />
        <h1 className="titulo">{oferta.nombre}</h1>
        <p className="suave">{oferta.nombre_comercial} · {oferta.distrito}</p>
        <p className="precios precios-grandes">
          <span className="precio">{soles(oferta.precio_oferta)}</span>
          <s className="precio-regular">{soles(oferta.precio_regular)}</s>
        </p>
        {oferta.descripcion_pack && <p className="linea">Incluye: {oferta.descripcion_pack}</p>}
        <p className="linea">Recojo: {recojoLargo(oferta)} · {oferta.direccion}</p>
        <p className="linea alergenos">
          <strong>Alérgenos:</strong>
          {oferta.alergenos.length === 0 ? ' ninguno declarado' : oferta.alergenos.map((a) => <span key={a} className="alergeno">{a}</span>)}
        </p>
        <p className="nota-pago">Pagas en el local al recoger. Presenta tu código de 6 dígitos antes de las {limite}.</p>

        {!codigo && (
          <>
            <div className="cantidad">
              <span id="cantidad-titulo">Cantidad</span>
              <div className="pasos" role="group" aria-labelledby="cantidad-titulo">
                <button type="button" className="paso" aria-label="Quitar uno" disabled={cantidad <= 1} onClick={() => setCantidad(cantidad - 1)}>−</button>
                <output aria-live="polite">{cantidad}</output>
                <button type="button" className="paso" aria-label="Agregar uno" disabled={cantidad >= maximo} onClick={() => setCantidad(cantidad + 1)}>+</button>
              </div>
            </div>
            {error && <p role="alert" className="error-general">{error}</p>}
            <button type="button" className="boton" disabled={enviando || agotada} onClick={confirmar}>
              {enviando ? 'Un momento…' : cantidad === 1 ? 'Reservar este pack' : `Reservar ${cantidad} packs · ${soles(cantidad * oferta.precio_oferta)}`}
            </button>
          </>
        )}

        {codigo && (
          <section className="confirmada" role="status">
            <h2>Reserva confirmada</h2>
            <p className="codigo" aria-label={`Código de recojo ${codigo.split('').join(' ')}`}>{codigo}</p>
            <p className="suave">Código de recojo · válido hasta las {limite}</p>
            {cantidad > 1 && <p className="suave">{cantidad} packs · pagas {soles(cantidad * oferta.precio_oferta)} en el local</p>}
          </section>
        )}
      </main>
    </div>
  );
}
