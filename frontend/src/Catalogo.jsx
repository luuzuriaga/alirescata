import { useEffect, useState } from 'react';
import { listarOfertas } from './api.js';
import Foto from './Foto.jsx';
import { DISTRITOS, soles, descuento, recojoCorto, filtrar } from './catalogo.js';

const EXTRAS = [['panaderia', 'Panadería'], ['hasta10', 'Hasta S/ 10'], ['hoy', 'Recojo hoy']];

export default function Catalogo({ alElegir, alVerReservas }) {
  const [estado, setEstado] = useState({ cargando: true, ofertas: [], error: '' });
  const [intento, setIntento] = useState(0);
  const [filtros, setFiltros] = useState({ texto: '', distrito: null, panaderia: false, hasta10: false, hoy: false });

  useEffect(() => {
    let vigente = true;
    listarOfertas().then((r) => {
      if (vigente) setEstado({ cargando: false, ofertas: r.ok ? r.ofertas : [], error: r.ok ? '' : r.mensaje });
    });
    return () => { vigente = false; };
  }, [intento]);

  const reintentar = () => { setEstado({ cargando: true, ofertas: [], error: '' }); setIntento((n) => n + 1); };
  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const visibles = filtrar(estado.ofertas, filtros);

  return (
    <div className="app">
      <header className="barra">
        <h1>Alirescata</h1>
        <button type="button" className="barra-enlace" onClick={alVerReservas}>Mis reservas</button>
      </header>
      <main className="cuerpo">
        <input
          className="buscador" type="search" aria-label="Buscar ofertas" placeholder="Buscar pan, postres, comida…"
          value={filtros.texto} onChange={(e) => cambiar('texto', e.target.value)}
        />
        <div className="chips filtros" role="group" aria-label="Distrito">
          {DISTRITOS.map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={filtros.distrito === d} onClick={() => cambiar('distrito', filtros.distrito === d ? null : d)}>{d}</button>
          ))}
        </div>
        <div className="chips filtros" role="group" aria-label="Más filtros">
          {EXTRAS.map(([campo, texto]) => (
            <button key={campo} type="button" className="chip chip-borde" aria-pressed={filtros[campo]} onClick={() => cambiar(campo, !filtros[campo])}>{texto}</button>
          ))}
        </div>

        {estado.cargando && <p className="estado" role="status">Cargando ofertas…</p>}
        {estado.error && (
          <div className="estado">
            <p role="alert" className="error-general">{estado.error}</p>
            <button type="button" className="boton boton-secundario" onClick={reintentar}>Reintentar</button>
          </div>
        )}
        {!estado.cargando && !estado.error && visibles.length === 0 && (
          <p className="estado">
            {estado.ofertas.length === 0 ? 'Por ahora no hay ofertas disponibles. Vuelve más tarde.' : 'Ninguna oferta coincide con tu búsqueda.'}
          </p>
        )}

        <ul className="ofertas">
          {visibles.map((o) => (
            <li key={o.id_oferta} className="tarjeta">
              <Foto oferta={o}><span className="descuento">-{descuento(o)} %</span></Foto>
              <div className="tarjeta-datos">
                <h2>{o.nombre}</h2>
                <p className="suave">{o.nombre_comercial}</p>
                <p className="precios">
                  <span className="precio">{soles(o.precio_oferta)}</span>
                  <s className="precio-regular">{soles(o.precio_regular)}</s>
                </p>
                <p className="recojo">Recojo {recojoCorto(o)}</p>
                <div className="tarjeta-pie">
                  <span className="disponibles">{o.stock_disponible} {o.stock_disponible === 1 ? 'disponible' : 'disponibles'}</span>
                  <button type="button" className="boton boton-chico" onClick={() => alElegir(o)} aria-label={`Reservar ${o.nombre}`}>Reservar</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
