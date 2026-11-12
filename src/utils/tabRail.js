// Rangée d'onglets qui défile à l'horizontale : amène l'onglet actif dans la partie visible de la rangée, sans jamais
// toucher au défilement de la page. `scrollIntoView` déplace aussi tous les ancêtres défilants, donc la page entière :
// rejoué à chaque rafraîchissement des données, il remontait la fiche en haut pendant que le sales lisait plus bas
// (signalé le 12/11/2026).
export function revealInRail(rail, tab, margin = 8) {
  if (!rail || !tab) return;
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  if (left - margin < rail.scrollLeft) rail.scrollLeft = Math.max(0, left - margin);
  else if (right + margin > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = right + margin - rail.clientWidth;
}
