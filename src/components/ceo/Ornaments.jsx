// Ornements antiques du dashboard CEO, dessinés en SVG (légers, nets à toute taille).
// Ils encadrent l'information, ils ne la concurrencent jamais : un filet, une frise
// grecque en séparateur, des cercles d'orbite en fond, une couronne de laurier.
import { motion } from 'framer-motion';
import { EASE_OUT } from './motion.js';

// Frise grecque (méandre) : motif répété, hauteur 10 px, en filet discret.
export function Meander({ className = '', opacity = 0.45 }) {
  const id = 'an-meander';
  return (
    <svg className={`an-meander ${className}`} height="10" width="100%" aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern id={id} width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 9.25 H3.5 V0.75 H12.5 V6.25 H6.75 V3.75 H9.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M12.5 9.25 H20" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

// Titre gravé d'une section : petites capitales, un filet d'or qui se trace à
// l'arrivée, un sous-titre en retrait. Le texte reste du texte : lisible, sélectionnable.
export function Inscription({ children, sub, right, reduce }) {
  return (
    <div className="an-inscription-row">
      <div className="an-inscription">
        <h2>{children}</h2>
        {sub && <span className="an-inscription-sub">{sub}</span>}
        <motion.span
          className="an-hairline"
          aria-hidden="true"
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
        />
      </div>
      {right && <div className="an-inscription-right">{right}</div>}
    </div>
  );
}

// Cercles d'orbite du panneau lapis (clin d'œil à la carte murale) : trois anneaux
// d'or et un arc, en rotation très lente et continue (boucle sans couture, linéaire).
export function Orbits({ reduce }) {
  return (
    <svg className={`an-orbits${reduce ? ' is-still' : ''}`} viewBox="0 0 400 400" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="200" cy="200" r="170" strokeOpacity="0.55" strokeDasharray="2 7" />
        <circle cx="200" cy="200" r="122" strokeOpacity="0.8" />
        <circle cx="200" cy="200" r="76" strokeOpacity="0.5" strokeDasharray="1 5" />
        <path d="M200 30 A170 170 0 0 1 370 200" strokeOpacity="0.95" strokeWidth="1.6" />
        <circle cx="370" cy="200" r="3.2" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

// Chapiteau : deux traits d'angle qui « posent » un bloc sur sa base.
export function CornerTicks() {
  return (
    <span className="an-corners" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}
