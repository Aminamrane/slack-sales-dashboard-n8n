// src/components/sequenceMail/viewportBox.js
//
// Zone où un élément `position: fixed` est réellement visible et sur laquelle ses pourcentages se
// résolvent (`top: 50%`…) : le viewport SANS la barre de défilement ni la gouttière que
// `html { scrollbar-gutter: stable }` (index.css) réserve en permanence. Ni `innerWidth`, ni
// `documentElement.clientWidth` ne la donnent (l'un compte la gouttière, l'autre l'ignore tant
// qu'aucune barre n'est affichée) : on la MESURE avec une sonde, on ne la suppose jamais.
//
// La sonde est posée UNE fois et relue à la demande : avant, chaque mesure insérait puis retirait un
// élément (un reflux forcé par appel, six par redimensionnement avec trois fenêtres, un par mouvement
// d'icône glissée).

const PROBE_ID = 'smx-viewport-probe';
let probe = null;

/** @returns `{ left, top, width, height }` en px viewport. */
export function fixedViewport() {
  if (!probe || !probe.isConnected) {
    // Rechargement à chaud : une sonde du module précédent peut déjà exister.
    probe = document.getElementById(PROBE_ID);
    if (!probe) {
      probe = document.createElement('div');
      probe.id = PROBE_ID;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
  }
  const r = probe.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
