// src/components/sequenceMail/beigeStyles.js
//
// Habillage « beige » de la fenêtre « Gestion de séquence » : DEUX choses, et rien d'autre.
//   1. Le fond : papier beige à points d'impression (châssis, feuille principale, barre d'onglets, fenêtres flottantes).
//   2. La sélection des cohortes et des séquences (volet de navigation) : des cases, jaune pour l'élément actif, et des
//      repères carrés colorés par public.
// Formes, polices, boutons, onglets, lignes de la liste, lecteur et cadre de la fenêtre restent ceux de la feuille de base
// (styles.js), inchangés. Aucune police spéciale.
//
// Portée : la classe `smx-beige` (racine de la Gestion, couche des fenêtres flottantes et fantôme du glisser-déposer, via
// useThemeClass). L'Éditeur de mail réutilise les variables `smx-theme-*` et `.smx-btn` de la base SANS cette classe : il garde
// son apparence d'origine. Thème sombre : couleurs d'origine, avec les mêmes points et les mêmes cases de sélection.

import './styles'; // la feuille de base d'abord : celle-ci la complète (même spécificité, ordre d'injection)
import { ensureStyles } from './injectStyles';

export const BEIGE_CSS = `
/* ═══════════════ Jetons — thème clair : papier beige ═══════════════ */
.smx-beige.smx-theme-light {
  /* Surfaces et filets chauds (la base les avait gris-bleu). */
  --smx-app: #efe3c4;
  --smx-card: #fbf7e8;
  --smx-card-2: #f4ebd2;
  --smx-line: #d9ccaa;
  --smx-line-2: #cdbf99;
  --smx-line-soft: #e6dab6;
  --smx-hover: #f6ecc8;
  --smx-hover-2: #ebdfb9;
  --smx-search: #efe5c6;
  /* Sélection des cohortes et des séquences (variables à part : « --smx-nav-active » sert aussi au sélecteur Aperçu / Texte brut). */
  --smx-sel-active: #e6b84a;
  --smx-sel-active-text: #302a26;
  --smx-sel-hover: #fbf7e8;
  --smx-sel-edge: #302a26;
  --smx-sel-edge-soft: #bfae7f;
  --smx-sel-shadow: rgba(48, 42, 38, 0.28);
  --smx-dot-blue: #3e6970;
  --smx-dot-green: #5f7f4f;
  --smx-dot-grey: #8a7b66;
  /* Points d'impression : deux trames, à peine perceptibles. */
  --smx-tex:
    radial-gradient(rgba(96, 70, 56, 0.055) 0.6px, transparent 0.95px) 0 0 / 4px 4px,
    radial-gradient(rgba(96, 70, 56, 0.04) 0.5px, transparent 0.85px) 2px 2px / 7px 7px;
}

/* ═══════════════ Jetons — thème sombre : couleurs d'origine, mêmes points et mêmes cases ═══════════════ */
.smx-beige.smx-theme-dark {
  --smx-sel-active: #e6b84a;
  --smx-sel-active-text: #231d18;
  --smx-sel-hover: rgba(232, 234, 237, 0.08);
  --smx-sel-edge: #a08b63;
  --smx-sel-edge-soft: #4a4d51;
  --smx-sel-shadow: rgba(0, 0, 0, 0.5);
  --smx-dot-blue: #79a7a5;
  --smx-dot-green: #9bae7a;
  --smx-dot-grey: #9c8f78;
  --smx-tex:
    radial-gradient(rgba(239, 227, 196, 0.045) 0.6px, transparent 0.95px) 0 0 / 4px 4px,
    radial-gradient(rgba(239, 227, 196, 0.03) 0.5px, transparent 0.85px) 2px 2px / 7px 7px;
}

/* ═══════════════ Fond : points d'impression ═══════════════ */
.smx-root.smx-beige { background: var(--smx-tex), var(--smx-app); }
.smx-beige .smx-main { background: var(--smx-tex), var(--smx-card); }
/* Spécificité volontairement basse (:where) : les états d'origine (survol, ouvert, coché, dépôt d'onglet) gardent la main. */
:where(.smx-beige) .smx-tabstrip { background: var(--smx-tex), var(--smx-card-2); }
:where(.smx-beige) .smx-float { background: var(--smx-tex), var(--smx-card); }
/* Les surfaces opaques d'origine laissent voir les points du fond. */
:where(.smx-beige) .smx-listarea,
:where(.smx-beige) .smx-row,
:where(.smx-beige) .smx-viewer,
:where(.smx-beige) .smx-float-body { background: transparent; }

/* ═══════════════ Sélection des cohortes et des séquences : des cases ═══════════════ */
.smx-beige .smx-nav-item {
  padding: 0 8px 0 10px; gap: 10px; border: 2px solid transparent; border-radius: 3px;
  transition: background 0.1s ease, border-color 0.1s ease;
}
.smx-beige .smx-nav-item:hover { background: var(--smx-sel-hover); border-color: var(--smx-sel-edge-soft); }
.smx-beige .smx-nav-item.is-active {
  background: var(--smx-sel-active); border-color: var(--smx-sel-edge); color: var(--smx-sel-active-text);
  box-shadow: 2px 2px 0 var(--smx-sel-shadow);
}
.smx-beige .smx-nav-item:active { transform: translate(1px, 1px); box-shadow: none; }
.smx-beige .smx-nav-item.is-active .smx-nav-sub { opacity: 0.85; }
.smx-beige .smx-nav-dot { border-radius: 2px; border: 1.5px solid var(--smx-sel-edge); }
`;

ensureStyles('smx-beige-css', BEIGE_CSS);
