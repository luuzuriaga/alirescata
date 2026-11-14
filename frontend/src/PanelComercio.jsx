import { useState } from 'react';
import { api } from './api.js';
import { Encabezado, Campo, Etiqueta, Aviso, usarApi, Tabla } from './Marco.jsx';
import { soles, hora } from './catalogo.js';
import { validarOferta, resumenDescuento, estadoOferta, ventana, kilos, packs, porcentajes, ESTADOS_DONACION } from './paneles.js';

export const SECCIONES_COMERCIO = [
  ['ofertas', 'Mis ofertas'], ['publicar', 'Publicar excedente'], ['validar', 'Validar recojo'], ['cierre', 'Cierre del día'],
  ['donaciones', 'Donaciones'], ['constancias', 'Constancias'], ['impacto', 'Mi impacto'],
];

export function MisOfertas({ token, alExpirar, alPublicar, aviso }) {
  const carga = usarApi(token, '/comercio/ofertas', alExpirar);
  return (
    <>
      <Encabezado titulo="Mis ofertas" bajada="Los packs que publicaste y cuántos se reservaron." />
      {aviso && <p role="status" className="nota-ok">{aviso}</p>}
      <Aviso carga={carga} vacio="Todavía no publicaste ninguna oferta." />
      {carga.datos?.length > 0 && (
        <Tabla>
            <thead><tr><th>Pack</th><th>Precio</th><th>Recojo</th><th>Reservados</th><th>Estado</th></tr></thead>
            <tbody>
              {carga.datos.map((o) => {
                const [texto, tono] = estadoOferta(o);
                return (
                  <tr key={o.id_oferta}>
                    <td><strong>{o.nombre}</strong>{o.descripcion_pack && <span className="celda-nota">{o.descripcion_pack}</span>}</td>
                    <td><span>{soles(o.precio_oferta)} <s className="precio-regular">{soles(o.precio_regular)}</s></span></td>
                    <td>{ventana(o.ventana_inicio, o.ventana_fin)}</td>
                    <td>{o.reservados} de {o.stock_inicial}</td>
                    <td><Etiqueta tono={tono}>{texto}</Etiqueta></td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
      )}
      <div className="acciones">
        <button type="button" className="boton boton-auto" onClick={alPublicar}>Publicar excedente</button>
      </div>
    </>
  );
}

const OFERTA_VACIA = { nombre: '', id_categoria: '', descripcion_pack: '', cantidad: '', peso_kg: '', precio_regular: '', precio_oferta: '', recojo_desde: '', recojo_hasta: '', alergenos: [], sinAlergenos: false };

// I-06 · Publicar excedente
export function PublicarExcedente({ token, alExpirar, alTerminar, alCancelar }) {
  const catalogos = usarApi(null, '/catalogos', alExpirar);
  const [f, setF] = useState(OFERTA_VACIA);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const poner = (campo) => (e) => setF((p) => ({ ...p, [campo]: e.target.value }));
  const alternar = (id) => setF((p) => ({ ...p, sinAlergenos: false, alergenos: p.alergenos.includes(id) ? p.alergenos.filter((a) => a !== id) : [...p.alergenos, id] }));
  const descuento = resumenDescuento(f.precio_regular, f.precio_oferta);

  const enviar = async (e) => {
    e.preventDefault();
    const { errores: er, datos } = validarOferta(f);
    setErrores(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    const r = await api(token, 'POST', '/comercio/ofertas', datos);
    setEnviando(false);
    if (r.expirada) return alExpirar();
    if (!r.ok) return setErrores(r.codigo === 'VENTANA_PASADA' ? { recojo_hasta: r.mensaje } : { general: r.mensaje });
    alTerminar();
  };

  if (!catalogos.datos) return <Aviso carga={catalogos} />;
  const entrada = (id, extra = {}) => ({ id, value: f[id], onChange: poner(id), 'aria-invalid': !!errores[id], ...extra });
  return (
    <>
      <Encabezado titulo="Publicar excedente" bajada="Completa los datos del pack. Tarda menos de 2 minutos." />
      <form className="formulario" onSubmit={enviar} noValidate>
        {errores.general && <p role="alert" className="error-general">{errores.general}</p>}
        <div className="rejilla">
          <Campo id="nombre" etiqueta="Producto o pack *" error={errores.nombre}><input {...entrada('nombre')} /></Campo>
          <Campo id="id_categoria" etiqueta="Categoría *" error={errores.id_categoria}>
            <select {...entrada('id_categoria')}>
              <option value="">Elige…</option>
              {catalogos.datos.categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo id="descripcion_pack" etiqueta="Contenido del pack" error={errores.descripcion_pack}><input {...entrada('descripcion_pack', { maxLength: 250 })} /></Campo>
          <div className="rejilla-par">
            <Campo id="cantidad" etiqueta="Cantidad de packs *" error={errores.cantidad}><input {...entrada('cantidad', { inputMode: 'numeric' })} /></Campo>
            <Campo id="peso_kg" etiqueta="Peso aprox. (kg)" error={errores.peso_kg}><input {...entrada('peso_kg', { inputMode: 'decimal', placeholder: '1.0' })} /></Campo>
          </div>
          <div className="rejilla-par">
            <Campo id="precio_regular" etiqueta="Precio regular (S/) *" error={errores.precio_regular}><input {...entrada('precio_regular', { inputMode: 'decimal' })} /></Campo>
            <Campo id="precio_oferta" etiqueta="Precio rebajado (S/) *" error={errores.precio_oferta}><input {...entrada('precio_oferta', { inputMode: 'decimal' })} /></Campo>
          </div>
          <div className="rejilla-par">
            <Campo id="recojo_desde" etiqueta="Recojo desde *" error={errores.recojo_desde}><input {...entrada('recojo_desde', { type: 'time' })} /></Campo>
            <Campo id="recojo_hasta" etiqueta="Recojo hasta *" error={errores.recojo_hasta}><input {...entrada('recojo_hasta', { type: 'time' })} /></Campo>
          </div>
        </div>
        <fieldset className="grupo">
          <legend className="grupo-titulo">Alérgenos presentes *</legend>
          <div className="chips">
            {catalogos.datos.alergenos.map((a) => (
              <button key={a.id_alergeno} type="button" className="chip chip-alergeno" aria-pressed={f.alergenos.includes(a.id_alergeno)} onClick={() => alternar(a.id_alergeno)}>{a.nombre}</button>
            ))}
            <button type="button" className="chip" aria-pressed={f.sinAlergenos} onClick={() => setF((p) => ({ ...p, alergenos: [], sinAlergenos: !p.sinAlergenos }))}>Ninguno</button>
          </div>
          {errores.alergenos && <p className="error">{errores.alergenos}</p>}
        </fieldset>
        <div className="nota-pago">
          {descuento && <p>{descuento}</p>}
          <p className="suave">Al publicar declaras que el producto es apto para el consumo y cumple las condiciones de inocuidad.</p>
        </div>
        <div className="acciones">
          <button type="submit" className="boton boton-auto" disabled={enviando}>{enviando ? 'Un momento…' : 'Publicar oferta'}</button>
          <button type="button" className="boton boton-auto boton-neutro" onClick={alCancelar}>Cancelar</button>
        </div>
      </form>
    </>
  );
}

const METODOS = [['efectivo', 'Efectivo'], ['billetera_digital', 'Billetera digital']];
const espaciado = (codigo) => codigo.split('').join(' ');

// I-07 · Validar recojo
export function ValidarRecojo({ token, alExpirar }) {
  const hoy = usarApi(token, '/comercio/reservas/hoy', alExpirar);
  const [codigo, setCodigo] = useState('');
  const [reserva, setReserva] = useState(null);
  const [metodo, setMetodo] = useState('efectivo');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const validar = async (e) => {
    e.preventDefault();
    setAviso('');
    setReserva(null);
    const limpio = codigo.replace(/\D/g, '');
    if (limpio.length !== 6) return setError('El código tiene 6 dígitos');
    setError('');
    setOcupado(true);
    const r = await api(token, 'GET', `/comercio/reservas/codigo/${limpio}`);
    setOcupado(false);
    if (r.expirada) return alExpirar();
    if (!r.ok) return setError(r.mensaje);
    setReserva(r.datos);
  };

  const confirmar = async () => {
    setOcupado(true);
    const r = await api(token, 'POST', `/comercio/reservas/${reserva.id_reserva}/entregar`, { metodo });
    setOcupado(false);
    if (r.expirada) return alExpirar();
    if (!r.ok) return setError(r.mensaje);
    setAviso(`Entrega registrada: ${reserva.nombre} ×${reserva.cantidad} · ${soles(reserva.monto)}.`);
    setReserva(null);
    setCodigo('');
    hoy.recargar();
  };

  return (
    <>
      <Encabezado titulo="Validar recojo" bajada="Pide el código de 6 dígitos al cliente y confirma la entrega." />
      <div className="dos-columnas">
        <div>
          <form className="validar" onSubmit={validar} noValidate>
            <Campo id="codigo" etiqueta="Código de recojo" error={error}>
              <input id="codigo" className="entrada-codigo" inputMode="numeric" autoComplete="off" maxLength={11} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-invalid={!!error} />
            </Campo>
            <button type="submit" className="boton boton-auto" disabled={ocupado}>Validar código</button>
          </form>
          {aviso && <p role="status" className="nota-ok">{aviso}</p>}
          {reserva && reserva.estado === 'activa' && (
            <section className="valido" role="status">
              <h3>✓ Código válido</h3>
              <p><strong>{reserva.nombre} ×{reserva.cantidad}</strong></p>
              <p>Cliente: {reserva.cliente} · Ventana: {hora(reserva.ventana_inicio)}–{hora(reserva.ventana_fin)}</p>
              <p className="monto"><span className="suave">Monto a cobrar:</span> <span className="precio">{soles(reserva.monto)}</span></p>
              <div className="medio">
                <span className="suave" id="medio-titulo">Medio de pago:</span>
                <div className="chips" role="radiogroup" aria-labelledby="medio-titulo">
                  {METODOS.map(([valor, texto]) => (
                    <button key={valor} type="button" role="radio" className="chip" aria-checked={metodo === valor} onClick={() => setMetodo(valor)}>{texto}</button>
                  ))}
                </div>
              </div>
              <button type="button" className="boton boton-auto" disabled={ocupado} onClick={confirmar}>Confirmar cobro y entrega</button>
            </section>
          )}
          {reserva && reserva.estado !== 'activa' && (
            <p role="alert" className="error-general">
              {reserva.estado === 'entregada' ? `Este código ya fue entregado (${reserva.nombre} ×${reserva.cantidad}, ${reserva.cliente}).` : 'Esta reserva ya no está activa.'}
            </p>
          )}
        </div>
        <section className="caja">
          <h3>Reservas de hoy</h3>
          <Aviso carga={hoy} vacio="Aún no hay reservas para hoy." />
          <ul className="lista-reservas">
            {(hoy.datos || []).map((r) => (
              <li key={r.id_reserva}>
                <strong className="codigo-linea">{espaciado(r.codigo_recojo)}</strong>
                <span>{r.cliente}</span>
                <span>×{r.cantidad}</span>
                <Etiqueta tono={r.estado === 'activa' ? 'pendiente' : 'ok'}>{r.estado === 'activa' ? 'Por entregar' : 'Entregada'}</Etiqueta>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

// Cierre del día: lo que no se vendió se ofrece en donación.
export function CierreDia({ token, alExpirar }) {
  const carga = usarApi(token, '/comercio/ofertas', alExpirar);
  const [horario, setHorario] = useState({ recojo_desde: '20:30', recojo_hasta: '21:30', manana: false });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupada, setOcupada] = useState(null);
  const sobrantes = (carga.datos || []).filter((o) => o.estado === 'publicada' && o.stock_disponible > 0);

  const donar = async (o) => {
    setAviso('');
    if (horario.recojo_hasta <= horario.recojo_desde) return setError('La hora de fin debe ser posterior a la de inicio');
    setError('');
    setOcupada(o.id_oferta);
    const r = await api(token, 'POST', `/comercio/ofertas/${o.id_oferta}/donar`, horario);
    setOcupada(null);
    if (r.expirada) return alExpirar();
    if (!r.ok) return setError(r.mensaje);
    setAviso(`${packs(r.datos.cantidad_packs)} de "${o.nombre}" quedaron disponibles para las organizaciones.`);
    carga.recargar();
  };

  return (
    <>
      <Encabezado titulo="Cierre del día" bajada="Ofrece en donación los packs que no se vendieron. La oferta se cierra y deja de aparecer en el catálogo." />
      {aviso && <p role="status" className="nota-ok">{aviso}</p>}
      {error && <p role="alert" className="error-general">{error}</p>}
      <Aviso carga={carga} />
      {carga.datos && sobrantes.length === 0 && <p className="estado">No tienes packs sobrantes por donar.</p>}
      {sobrantes.length > 0 && (
        <>
          <fieldset className="grupo horario-donacion">
            <legend className="grupo-titulo">¿Cuándo pueden recoger la donación?</legend>
            <div className="rejilla-tres">
              <Campo id="dia" etiqueta="Día">
                <select id="dia" value={horario.manana ? '1' : '0'} onChange={(e) => setHorario((h) => ({ ...h, manana: e.target.value === '1' }))}>
                  <option value="0">Hoy</option>
                  <option value="1">Mañana</option>
                </select>
              </Campo>
              <Campo id="don-desde" etiqueta="Desde"><input id="don-desde" type="time" value={horario.recojo_desde} onChange={(e) => setHorario((h) => ({ ...h, recojo_desde: e.target.value }))} /></Campo>
              <Campo id="don-hasta" etiqueta="Hasta"><input id="don-hasta" type="time" value={horario.recojo_hasta} onChange={(e) => setHorario((h) => ({ ...h, recojo_hasta: e.target.value }))} /></Campo>
            </div>
          </fieldset>
          <Tabla>
              <thead><tr><th>Pack</th><th>Venta</th><th>Sobrante</th><th><span className="oculto">Acción</span></th></tr></thead>
              <tbody>
                {sobrantes.map((o) => (
                  <tr key={o.id_oferta}>
                    <td><strong>{o.nombre}</strong></td>
                    <td>{ventana(o.ventana_inicio, o.ventana_fin)}</td>
                    <td>{packs(o.stock_disponible)} de {o.stock_inicial}</td>
                    <td><button type="button" className="boton boton-chico" disabled={ocupada === o.id_oferta} onClick={() => donar(o)}>Donar sobrante</button></td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
        </>
      )}
    </>
  );
}

export function DonacionesComercio({ token, alExpirar, alVerConstancia }) {
  const carga = usarApi(token, '/comercio/donaciones', alExpirar);
  return (
    <>
      <Encabezado titulo="Donaciones" bajada="Los sobrantes que ofreciste y qué organización los recogió." />
      <Aviso carga={carga} vacio="Todavía no ofreciste donaciones. Hazlo desde Cierre del día." />
      {carga.datos?.length > 0 && (
        <Tabla>
            <thead><tr><th>Alimentos</th><th>Cantidad</th><th>Recojo</th><th>Organización</th><th>Estado</th><th>Constancia</th></tr></thead>
            <tbody>
              {carga.datos.map((d) => {
                const [texto, tono] = ESTADOS_DONACION[d.estado] || [d.estado, 'neutro'];
                return (
                  <tr key={d.id_donacion}>
                    <td><strong>{d.nombre}</strong></td>
                    <td>{packs(d.cantidad_packs)} (≈ {kilos(d.kg)})</td>
                    <td>{ventana(d.recojo_desde, d.recojo_hasta)}</td>
                    <td>{d.organizacion || '—'}</td>
                    <td><Etiqueta tono={tono}>{texto}</Etiqueta></td>
                    <td>{d.codigo_constancia ? <button type="button" className="enlace" onClick={() => alVerConstancia(d.codigo_constancia)}>{d.codigo_constancia}</button> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
      )}
    </>
  );
}

const DESTINOS = [['vendido', 'Vendido con rebaja', 'verde'], ['donado', 'Donado con constancia', 'rojo'], ['no_aprovechado', 'No aprovechado', 'gris']];

// I-11 · Panel de impacto
export function MiImpacto({ token, alExpirar }) {
  const carga = usarApi(token, '/comercio/impacto', alExpirar);
  if (!carga.datos) return (<><Encabezado titulo="Mi impacto" bajada="Resumen acumulado desde que te sumaste a Alirescata." /><Aviso carga={carga} /></>);
  const d = carga.datos;
  const maximo = Math.max(...d.semanas, 1);
  const reparto = porcentajes(d.destino);
  return (
    <>
      <Encabezado titulo="Mi impacto" bajada="Resumen acumulado desde que te sumaste a Alirescata." />
      <div className="cifras">
        <div className="cifra borde-verde"><span>Alimento rescatado</span><strong>{kilos(d.kg_rescatados)}</strong></div>
        <div className="cifra borde-verde"><span>CO₂e evitado</span><strong>{kilos(d.co2_evitado)}</strong></div>
        <div className="cifra borde-azul"><span>Ahorro recuperado</span><strong>S/ {Math.round(d.ingreso_recuperado)}</strong></div>
        <div className="cifra borde-rojo"><span>Donaciones con constancia</span><strong>{d.constancias}</strong></div>
      </div>
      <div className="graficos">
        <section className="caja">
          <h3>Kilos rescatados por semana</h3>
          <ol className="barras" aria-label="Kilos rescatados en las últimas 5 semanas, de la más antigua a la actual">
            {d.semanas.map((kg, i) => (
              <li key={i}>
                <span className="barra-valor">{Number(kg.toFixed(1))}</span>
                <span className="barra-columna" style={{ height: `${(kg / maximo) * 100}%` }} />
                <span className="barra-semana">S{i + 1}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="caja">
          <h3>Destino del excedente</h3>
          {DESTINOS.map(([clave, texto, color]) => (
            <div key={clave} className="destino">
              <div className="destino-linea"><span>{texto}</span><strong>{reparto[clave]} %</strong></div>
              <div className="pista"><span className={`relleno relleno-${color}`} style={{ width: `${reparto[clave]}%` }} /></div>
            </div>
          ))}
          <p className="suave pie-caja">Factor de emisión usado: {d.factor} kg CO₂e/kg</p>
        </section>
      </div>
    </>
  );
}
