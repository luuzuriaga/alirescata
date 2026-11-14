import { tipoFoto } from './catalogo.js';
import panes from './imagenes/panes.jpg';
import postres from './imagenes/postres.jpg';
import almuerzo from './imagenes/almuerzo.jpg';

const FOTOS = { panes, postres, almuerzo };

// Foto de ejemplo según el tipo de pack; si no hay una adecuada queda el recuadro con texto.
export default function Foto({ oferta, grande = false, children }) {
  const src = FOTOS[tipoFoto(oferta)];
  return (
    <div className={grande ? 'foto foto-grande' : 'foto'} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : (grande ? 'foto del pack' : 'foto')}
      {children}
    </div>
  );
}
