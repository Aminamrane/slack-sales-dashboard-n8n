// src/components/sequenceMail/schemaTheme.js
//
// Apparence de la fenêtre « Schéma de séquence » : contour et fond demandés, et palette de sa barre de
// titre. Séparé du composant (SequenceSchema.jsx) pour que celui-ci n'exporte que lui-même.

/** Contour de la fenêtre. */
export const SCHEMA_BORDER = '#fc6401';
/** Fond (intérieur) de la fenêtre. */
export const SCHEMA_BACKGROUND = '#ffe1bb';

/**
 * Palette de la fenêtre (mêmes clés que `getColors` de CeoDashboard). Fixe, quel que soit le mode
 * sombre : le fond est clair, les textes et icônes de la barre de titre doivent donc rester foncés
 * (rapports de contraste supérieurs à 6 sur #ffe1bb).
 */
export const SCHEMA_COLORS = {
  bg: SCHEMA_BACKGROUND,
  surface: SCHEMA_BACKGROUND,
  border: SCHEMA_BORDER,
  text: '#1e2330',
  secondary: '#1e2330',
  muted: '#4b5563',
  subtle: 'rgba(252, 100, 1, 0.16)',
  accent: SCHEMA_BORDER,
  shadow: 'none',
};

/**
 * Couleurs par ton de phase (`PHASES[phase].tone` dans model.js), pour les nœuds du schéma de
 * séquence. Indépendantes des variables `--smx-chip-*` de styles.js : celles-ci sont portées par
 * `.smx-theme-light`/`.smx-theme-dark` (appliquées sur le composant Gestion de séquence), hors de
 * portée du Schéma, rendu dans un portail frère sous <body> — cf. SequenceWindow.jsx.
 */
export const SCHEMA_TONES = {
  blue: { bg: '#e4edff', fg: '#1d4ed8', border: '#b7cbff' },
  purple: { bg: '#f1e7fb', fg: '#7c3aed', border: '#ddc7f5' },
  amber: { bg: '#fff2d6', fg: '#a45c00', border: '#ffd98f' },
  red: { bg: '#fde3e1', fg: '#c0311b', border: '#f9c2bd' },
  green: { bg: '#e2f5e8', fg: '#0d652d', border: '#bfe6cc' },
  grey: { bg: '#eceef1', fg: '#4b5563', border: '#d7dbe0' },
};
