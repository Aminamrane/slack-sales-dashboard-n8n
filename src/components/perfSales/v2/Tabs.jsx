import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, reducedMotion } from '../motion';
import TabIcon from './TabIcons';

// Onglets (dev 14/10 : « des beaux SVG pour chaque catégorie, animation quand on clique dessus ») : un rail blanc, la
// pastille marine glisse d'un onglet à l'autre et l'icône de l'onglet choisi joue son geste. Le rail tient sur une ligne
// à 1440 px avec la barre latérale du CEO ; plus étroit, il défile horizontalement (jamais de retour à la ligne).
// `tabs` : [clé, libellé, icône?] ; l'icône est celle de la clé tant qu'une troisième valeur ne désigne pas un autre pictogramme de TabIcons.
export default function Tabs({ tabs, tab, onTab, label }) {
  const [beat, setBeat] = useState(0);
  const still = reducedMotion();
  const pick = (key, el) => {
    setBeat((b) => b + 1);
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
    onTab(key);
  };
  return (
    <Motion.div className="ps2-tabbar" layoutScroll>
      <div className="ps2-tabs" role="tablist" aria-label={label}>
        {tabs.map(([key, text, icon]) => {
          const on = tab === key;
          return (
            <button type="button" key={key} role="tab" aria-selected={on} className="ps2-tab" onClick={(e) => pick(key, e.currentTarget)}>
              {on && <Motion.span layoutId="ps2-tab-pill" className="ps2-tab-pill" transition={still ? { duration: 0 } : { duration: 0.45, ease: EASE }} />}
              <span className="ps2-tab-label"><TabIcon name={icon || key} active={on} beat={on ? beat : 0} />{text}</span>
            </button>
          );
        })}
      </div>
    </Motion.div>
  );
}
