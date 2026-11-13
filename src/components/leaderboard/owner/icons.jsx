// Dessin du Suivi des ventes (dev 12/11/2026) : la coche de la vente déclarée. Le reste de la page garde ses images
// d'origine (médailles, trophées, couronne, fusée).

/** Coche de la vente déclarée : le cercle puis la coche se tracent. */
export const DoneCheck = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-90 28 28)" />
    <path d="m18.5 28.8 6.4 6.4 12.6-13.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
