import React, { useEffect, useRef } from 'react';
import { motion as Motion, useAnimationControls } from 'framer-motion';
import { EASE, reducedMotion } from '../motion';

// Icônes des onglets de la Performance Sales (dev 14/10/2026 : « des beaux SVG pour chaque catégorie, animation quand on
// clique dessus »). Grille 24, trait 2, bouts ronds, couleur héritée (blanc sur la pastille marine, gris sinon). Chaque
// icône rejoue un geste court à l'activation de son onglet (et à chaque nouveau clic dessus) ; au repos, elle est
// identique avant et après le geste. Rien ne bouge si l'utilisateur réduit les animations.

// Images clés précédées d'un palier : une partie qui démarre en retard part de sa première image dès le clic, sans
// éclair de l'état de repos.
function keyframes(values, delay, duration, ease) {
  const total = delay + duration;
  const lead = total ? delay / total : 0;
  const n = values.length - 1;
  const times = values.map((_, i) => lead + (i / n) * (1 - lead));
  return delay > 0
    ? { values: [values[0], ...values], transition: { duration: total, times: [0, ...times], ease } }
    : { values, transition: { duration, times, ease } };
}

// Quand on change d'onglet, le geste attend que la pastille marine arrive sous l'icône (elle glisse en 0,45 s) ; quand on
// reclique sur l'onglet déjà affiché, il part tout de suite.
const LANDING = 0.12;

// { propriété: [images, retard, durée, courbe] } → variantes « rest » (dernière image, immédiate), « play » (après
// l'arrivée de la pastille) et « again » (immédiat).
function gesture(spec) {
  const rest = { transition: { duration: 0 } };
  const play = { transition: {} };
  const again = { transition: {} };
  Object.entries(spec).forEach(([prop, [values, delay = 0, duration = 0.5, ease = EASE]]) => {
    rest[prop] = values[values.length - 1];
    const late = keyframes(values, delay + LANDING, duration, ease);
    const now = keyframes(values, delay, duration, ease);
    play[prop] = late.values;
    play.transition[prop] = late.transition;
    again[prop] = now.values;
    again.transition[prop] = now.transition;
  });
  return { rest, play, again };
}

const draw = (delay = 0, duration = 0.45) => gesture({ pathLength: [[0, 1], delay, duration], opacity: [[0, 1], delay, 0.06, 'linear'] });
const pop = (delay = 0, duration = 0.42, from = 0.3) => gesture({ scale: [[from, 1.14, 1], delay, duration], opacity: [[0, 1], delay, 0.12, 'linear'] });
const drop = (delay = 0, from = -3) => gesture({ y: [[from, 0.7, 0], delay, 0.42], opacity: [[0, 1], delay, 0.12, 'linear'] });
const grow = (delay = 0, from = 0.45) => gesture({ scale: [[from, 1], delay, 0.5], opacity: [[0, 1], delay, 0.14, 'linear'] });
const around = (x, y) => ({ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' });
const STILL = { rest: {}, play: {}, again: {} };

// Vue d'ensemble : quatre tuiles qui se posent dans le sens des aiguilles d'une montre.
const OVERVIEW = (
  <>
    <Motion.rect x="3" y="3" width="7" height="9" rx="1.8" variants={pop(0)} />
    <Motion.rect x="14" y="3" width="7" height="5" rx="1.8" variants={pop(0.06)} />
    <Motion.rect x="14" y="12" width="7" height="9" rx="1.8" variants={pop(0.12)} />
    <Motion.rect x="3" y="16" width="7" height="5" rx="1.8" variants={pop(0.18)} />
  </>
);

// Canaux : une source qui émet, deux ondes qui s'éloignent.
const CHANNELS = (
  <>
    <Motion.circle cx="12" cy="12" r="1.5" fill="currentColor" variants={pop(0, 0.38, 0)} />
    <Motion.g variants={grow(0.08)} style={around(12, 12)}>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.08" /><path d="M8.46 8.46a5 5 0 0 0 0 7.08" />
    </Motion.g>
    <Motion.g variants={grow(0.18, 0.6)} style={around(12, 12)}>
      <path d="M18.36 5.64a9 9 0 0 1 0 12.72" /><path d="M5.64 5.64a9 9 0 0 0 0 12.72" />
    </Motion.g>
  </>
);

// Leads : une frise, chaque étape se pose puis la ligne se trace.
const LEADS = (
  <>
    <Motion.path d="M6 4v16" variants={draw(0, 0.4)} />
    <Motion.circle cx="6" cy="6" r="1.6" fill="currentColor" variants={pop(0.05, 0.34, 0)} />
    <Motion.circle cx="6" cy="12" r="1.6" fill="currentColor" variants={pop(0.14, 0.34, 0)} />
    <Motion.circle cx="6" cy="18" r="1.6" fill="currentColor" variants={pop(0.23, 0.34, 0)} />
    <Motion.path d="M10.5 6H20" variants={draw(0.1, 0.26)} />
    <Motion.path d="M10.5 12H18" variants={draw(0.19, 0.24)} />
    <Motion.path d="M10.5 18H16" variants={draw(0.28, 0.22)} />
  </>
);

// Sales : les épaules se tracent, la tête se pose.
const SALES = (
  <>
    <Motion.path d="M4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" variants={draw(0, 0.5)} />
    <Motion.circle cx="12" cy="7.5" r="3.6" variants={drop(0.12)} />
  </>
);

// Équipes : le coéquipier glisse derrière, le premier se redresse.
const TEAMS = (
  <>
    <Motion.g variants={gesture({ x: [[-3.5, 0], 0.08, 0.5], opacity: [[0, 1], 0.08, 0.2, 'linear'] })}>
      <path d="M15.6 5.2a3.1 3.1 0 0 1 0 6" /><path d="M17.6 14.6c2.3.6 3.9 2.7 3.9 5.9" />
    </Motion.g>
    <Motion.g variants={gesture({ scale: [[0.82, 1.06, 1], 0, 0.45] })} style={around(9, 20.5)}>
      <circle cx="9" cy="8.5" r="3.2" /><path d="M2.5 20.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" />
    </Motion.g>
  </>
);

// Rendez-vous : les anneaux tombent, la coche se trace.
const RDV = (
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17" />
    <Motion.path d="M8 3v4" variants={drop(0, -2.5)} />
    <Motion.path d="M16 3v4" variants={drop(0.06, -2.5)} />
    <Motion.path d="M9 15.2l2.1 2.1 4.4-4.4" variants={draw(0.16, 0.4)} />
  </>
);

// Réactivité : on presse le bouton, l'aiguille fait un tour.
const REACTIVITY = (
  <>
    <circle cx="12" cy="13.5" r="7.5" />
    <Motion.g variants={gesture({ y: [[0, 1.3, 0], 0, 0.32] })}>
      <path d="M9.5 2.5h5" /><path d="M12 2.5V6" />
    </Motion.g>
    <path d="M18 7.5l1.7-1.7" />
    <Motion.path d="M12 13.5V9.5" variants={gesture({ rotate: [[0, 360], 0.08, 0.9] })} style={around(12, 13.5)} />
  </>
);

// Cohorte : les leads du mois, étape par étape jusqu'à la vente ; les barres montent l'une après l'autre.
const COHORT = (
  <>
    <path d="M4 3.5V18a2.5 2.5 0 0 0 2.5 2.5h14" />
    <Motion.path d="M9 16V5.5" variants={draw(0, 0.42)} />
    <Motion.path d="M14 16V9.5" variants={draw(0.1, 0.36)} />
    <Motion.path d="M19 16v-3" variants={draw(0.2, 0.28)} />
  </>
);

// Ventes : l'euro se trace, l'arc puis les deux barres (un retournement de pièce le montrait un instant à l'envers).
const VENTES = (
  <>
    <Motion.path d="M19 6.64a7 7 0 1 0 0 10.72" variants={draw(0, 0.46)} />
    <Motion.path d="M5 10.2h9.5" variants={draw(0.26, 0.2)} />
    <Motion.path d="M5 13.8h9.5" variants={draw(0.34, 0.2)} />
  </>
);

// Setters : le combiné sonne, les ondes partent.
const SETTERS = (
  <>
    <Motion.path d="M5.5 3.5h3l1.6 4.2-2.1 1.5a11 11 0 0 0 6.8 6.8l1.5-2.1 4.2 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1z"
      variants={gesture({ rotate: [[0, -14, 11, -7, 4, 0], 0, 0.62, 'easeInOut'] })} style={around(12, 12)} />
    <Motion.path d="M14.5 7.2a2.5 2.5 0 0 1 2.3 2.3" variants={draw(0.14, 0.26)} />
    <Motion.path d="M14.5 3.6a6 6 0 0 1 5.9 5.9" variants={draw(0.24, 0.32)} />
  </>
);

// Auto-affectation : un lead part de la source et se répartit entre trois sales.
const AUTO = (
  <>
    <Motion.circle cx="5" cy="12" r="2.2" variants={pop(0, 0.36)} />
    <Motion.path d="M7.2 12C11.4 12 11.8 5.5 16.5 5.5" variants={draw(0.08, 0.36)} />
    <Motion.path d="M7.2 12h9.3" variants={draw(0.13, 0.32)} />
    <Motion.path d="M7.2 12C11.4 12 11.8 18.5 16.5 18.5" variants={draw(0.18, 0.36)} />
    <Motion.circle cx="18.5" cy="5.5" r="2" variants={pop(0.38, 0.34)} />
    <Motion.circle cx="18.5" cy="12" r="2" variants={pop(0.43, 0.34)} />
    <Motion.circle cx="18.5" cy="18.5" r="2" variants={pop(0.48, 0.34)} />
  </>
);

const ICONS = {
  overview: { body: OVERVIEW },
  channels: { body: CHANNELS },
  leads: { body: LEADS },
  sales: { body: SALES },
  teams: { body: TEAMS },
  rdv: { body: RDV },
  reactivity: { body: REACTIVITY },
  cohort: { body: COHORT },
  ventes: { body: VENTES, root: gesture({ scale: [[1, 0.86, 1.08, 1], 0, 0.62] }), style: around(12, 12) },
  setters: { body: SETTERS },
  auto: { body: AUTO },
};

// `active` : onglet affiché ; `beat` : compteur de clics, pour rejouer le geste quand on reclique sur l'onglet affiché.
// Pas de geste au premier affichage : seulement quand l'onglet devient actif ou qu'on reclique dessus.
export default function TabIcon({ name, active, beat }) {
  const icon = ICONS[name];
  const controls = useAnimationControls();
  const last = useRef({ active, beat });
  useEffect(() => {
    const prev = last.current;
    last.current = { active, beat };
    if (!active || (prev.active === active && prev.beat === beat) || reducedMotion()) return;
    controls.start(prev.active ? 'again' : 'play');
  }, [active, beat, controls]);
  if (!icon) return null;
  return (
    <span className="ps2-tab-ico" aria-hidden="true">
      <Motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" focusable="false" initial="rest" animate={controls} variants={icon.root || STILL} style={icon.style}>
        {icon.body}
      </Motion.svg>
    </span>
  );
}
