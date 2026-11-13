// Un bloc est « vu » quand `amount` de sa hauteur est à l'écran. Un bloc plus haut que l'écran (une liste de 92 lignes)
// peut ne jamais y arriver : 15 % de 6 000 px, c'est plus que la fenêtre. Il restait alors invisible pour de bon (page
// « Automatisation des missions » vide sous les compteurs, 13/11/2026). Un tel bloc est donc vu dès qu'il entre dans l'écran.
export function inView(entry, amount, viewHeight) {
  if (!entry.isIntersecting) return false;
  return entry.intersectionRatio >= amount || entry.boundingClientRect.height > viewHeight;
}
