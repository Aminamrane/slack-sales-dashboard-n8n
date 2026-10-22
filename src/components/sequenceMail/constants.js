// src/components/sequenceMail/constants.js
//
// Constantes partagées par les fenêtres de séquence (Gestion, Schéma, Éditeur, fenêtres flottantes,
// icônes réduites). Une seule source pour des valeurs qui étaient recopiées dans cinq fichiers.

/** Hauteur (px) réservée en haut à la navbar flottante : aucune fenêtre ni icône ne passe dessous. */
export const NAVBAR_SAFE_TOP = 64;

/**
 * Largeur (px) de la barre latérale dépliée (épinglée ou dépliée au survol) : zone interdite aux icônes.
 * Doit rester égale à `EXPANDED_W` de components/shared/Sidebar/Sidebar.jsx (non exporté : on ne dépend pas de ce fichier).
 */
export const SIDEBAR_OPEN_WIDTH = 260;

/** Largeur (px) de la barre latérale repliée. */
export const SIDEBAR_RAIL_WIDTH = 56;

/** Largeur d'écran (px) en dessous de laquelle les fenêtres de séquence ne se partagent plus l'écran. */
export const COMPACT_VIEWPORT_WIDTH = 900;

/**
 * Piles d'empilement : fenêtres de séquence < barre latérale (40) < fenêtres flottantes < icônes < navbar (1000).
 * Les trois fenêtres de séquence occupent les rangs 37, 38 et 39 (la dernière utilisée est au-dessus) : jamais sous
 * le même z-index, jamais au-dessus de la barre latérale.
 */
export const Z_SEQUENCE_WINDOW = 37;
export const Z_FLOATING_BASE = 700;
export const Z_MINIMIZED_ICON = 960;
