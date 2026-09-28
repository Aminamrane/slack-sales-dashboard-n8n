// src/components/sequenceMail/viewportBox.js
//
// Zone où un élément `position: fixed` est réellement visible et sur laquelle ses pourcentages se
// résolvent (`top: 50%`…) : le viewport SANS la barre de défilement ni la gouttière que
// `html { scrollbar-gutter: stable }` (index.css) réserve en permanence. Ni `innerWidth`, ni
// `documentElement.clientWidth` ne la donnent (l'un compte la gouttière, l'autre l'ignore tant
// qu'aucune barre n'est affichée) : on la MESURE avec une sonde, on ne la suppose jamais.

/** @returns `{ left, top, width, height }` en px viewport. */
export function fixedViewport() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
