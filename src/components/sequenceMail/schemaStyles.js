// src/components/sequenceMail/schemaStyles.js
//
// Feuille de style de la fenêtre « Schéma de séquence » (SequenceSchema.jsx). Elle existe pour ce que des
// styles en ligne ne savent pas faire : survol et focus (le stylo d'une case), `(hover: none)` (écran
// tactile : le stylo reste affiché), en-têtes de chaîne collants, `line-clamp` des titres. Les couleurs
// viennent de schemaTheme.js (une seule source) ; les teintes de phase deviennent des variables CSS
// (`--sn-bg/--sn-fg/--sn-bd`) posées par la classe `t-<teinte>` de chaque case.
//
// La fenêtre est rendue dans un portail sous <body>, hors de la portée de styles.js : la feuille est
// posée une seule fois dans <head> (cf. injectStyles.js) quand SequenceSchema est importé.

import { ensureStyles } from './injectStyles';
import { SCHEMA_BACKGROUND, SCHEMA_BORDER, SCHEMA_CARD, SCHEMA_COLORS, SCHEMA_DANGER, SCHEMA_DOTS, SCHEMA_TONES } from './schemaTheme';

const { text: TEXT, muted: MUTED, subtle: SUBTLE } = SCHEMA_COLORS;

/** Une règle par teinte de phase / de statut : variables de la case et couleur du statut. */
const toneRules = Object.entries(SCHEMA_TONES)
  .map(
    ([name, t]) =>
      `.smx-sn.t-${name} { --sn-bg: ${t.bg}; --sn-fg: ${t.fg}; --sn-bd: ${t.border}; }\n` +
      `.smx-sn-status.t-${name} { color: ${name === 'grey' ? MUTED : t.fg}; }`
  )
  .join('\n');

export const SCHEMA_CSS = `
/* Le corps porte les points d'impression ; la barre de titre (SequenceWindow) reste unie. */
.smx-sch {
  position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0;
  overflow: hidden; background: ${SCHEMA_DOTS}, ${SCHEMA_BACKGROUND}; color: ${TEXT}; font-size: 13px; line-height: 1.4;
}
.smx-sch *, .smx-sch *::before, .smx-sch *::after { box-sizing: border-box; }
.smx-sch button { font-family: inherit; }
.smx-sch-sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}

/* ── États : aucune cohorte choisie, chargement, erreur, contenu local absent, vide ── */
.smx-sch-msg {
  flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 24px;
  text-align: center; overflow: auto;
}
/* Centrage « sûr » : si le contenu dépasse, il défile depuis le haut au lieu d'être coupé. */
.smx-sch-msg > :first-child { margin-top: auto; }
.smx-sch-msg > :last-child { margin-bottom: auto; }
.smx-sch-logo {
  width: clamp(72px, 24%, 160px); height: auto; flex-shrink: 0; opacity: 0.2; border: none; outline: none; background: none;
  user-select: none; pointer-events: none;
}
.smx-sch-text { margin: 0; max-width: 320px; font-size: 13.5px; line-height: 1.5; color: ${MUTED}; }
.smx-sch-text.is-danger { color: ${SCHEMA_DANGER}; font-weight: 600; }
.smx-sch-btn {
  padding: 6px 14px; border-radius: 8px; border: 1.5px solid ${SCHEMA_BORDER}; background: ${SCHEMA_CARD}; color: ${TEXT};
  font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.smx-sch-btn:hover { background: #fff; }
.smx-sch-btn:focus-visible, .smx-sn-btn:focus-visible, .smx-sn-edit:focus-visible {
  outline: 2px solid ${TEXT}; outline-offset: 2px;
}

/* ── Légende (toujours visible) et date de l'instantané ── */
.smx-sch-bar {
  flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 16px; padding: 7px 20px;
  border-bottom: 1px solid rgba(252, 100, 1, 0.35); font-size: 11.5px; line-height: 1.5; color: ${MUTED};
}
.smx-sch-hint { flex: 1 1 260px; min-width: 0; display: flex; flex-wrap: wrap; gap: 2px 14px; }
/* Chaque consigne reste d'un bloc : on passe à la ligne entre deux consignes, jamais au milieu. */
.smx-sch-seg { white-space: nowrap; }
.smx-sch-hint kbd {
  display: inline-block; margin: 0 1px; padding: 0 4px; border: 1px solid rgba(30, 35, 48, 0.35); border-bottom-width: 2px;
  border-radius: 4px; background: ${SCHEMA_CARD}; color: ${TEXT}; font: inherit; font-size: 10.5px; font-weight: 600; line-height: 1.35;
}
.smx-sch-hint svg { vertical-align: -2px; margin: 0 1px; }
.smx-sch-snap { flex-shrink: 0; white-space: nowrap; }

/* ── Chaînes ── */
.smx-sch-scroll { flex: 1; min-height: 0; overflow: auto; padding: 20px; overscroll-behavior: contain; }
.smx-sch-chains { display: flex; flex-direction: row; align-items: flex-start; gap: 28px; min-width: max-content; }
.smx-sch-chain { display: flex; flex-direction: column; width: 236px; flex-shrink: 0; }
/* En-tête collé en haut quand on fait défiler une longue chaîne : on sait toujours dans quelle séquence on est.
   Le navigateur colle une boîte « sticky » au bord du CONTENU du conteneur (après son remplissage de 20 px) : « top: -20px »
   la ramène au bord de la zone visible, sans bande de cases qui défilent au-dessus d'elle. */
.smx-sch-head {
  position: sticky; top: -20px; z-index: 2; margin-top: -6px; margin-bottom: 12px; padding-top: 6px; padding-bottom: 8px;
  border-bottom: 2px solid ${SCHEMA_BORDER};
  background: ${SCHEMA_DOTS}, ${SCHEMA_BACKGROUND}; font-size: 12px; font-weight: 700; color: ${TEXT}; text-transform: uppercase; letter-spacing: 0.3px;
}
.smx-sch-head span { font-weight: 500; color: ${MUTED}; text-transform: none; }
.smx-sch-steps { display: flex; flex-direction: column; }
.smx-sch-steps.is-row { flex-direction: row; flex-wrap: wrap; gap: 12px; }
.smx-sch-step { display: flex; flex-direction: column; }

/* ── Case d'une étape ── */
.smx-sn { position: relative; width: 236px; scroll-margin-top: 56px; scroll-margin-bottom: 16px; }
${toneRules}
.smx-sn-btn {
  display: flex; flex-direction: column; gap: 5px; width: 100%; margin: 0; padding: 10px 12px; border-radius: 10px;
  text-align: left; cursor: pointer; font: inherit; color: inherit; background: ${SCHEMA_CARD}; border: 1.5px solid var(--sn-bd);
}
.smx-sn-btn.is-selected { background: var(--sn-bg); border-color: var(--sn-fg); box-shadow: 0 0 0 3px var(--sn-bg); }
.smx-sn-top { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--sn-fg); }
.smx-sn-badge { background: var(--sn-bg); border: 1px solid var(--sn-bd); border-radius: 5px; padding: 1px 6px; }
.smx-sn-seg { color: ${MUTED}; font-weight: 500; }
.smx-sn-open { margin-left: auto; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: var(--sn-fg); }
.smx-sn-title {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
  overflow-wrap: anywhere; font-size: 13.5px; font-weight: 600; line-height: 1.35; color: ${TEXT};
}
.smx-sn-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2px 8px; font-size: 11.5px; color: ${MUTED}; }
.smx-sn-status { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
.smx-sn-sdot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.smx-sn-cond {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
  overflow-wrap: anywhere; font-size: 11px; font-style: italic; line-height: 1.35; color: ${MUTED};
}
.smx-sn-cond svg { vertical-align: -1px; margin-right: 4px; }

/* Le stylo : au survol, au focus (clavier ou clic) et en permanence sur une étape modifiée ou en cours d'édition ;
   toujours affiché sur un écran sans survol (tactile). */
.smx-sn-edit {
  position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; margin: 0; padding: 0; display: flex;
  align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; color: ${TEXT}; background: ${SCHEMA_CARD};
  border: 1.5px solid ${SCHEMA_BORDER}; box-shadow: 0 1px 3px rgba(30, 35, 48, 0.25);
  opacity: 0; transform: scale(0.8); pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
}
.smx-sn:hover .smx-sn-edit, .smx-sn:focus-within .smx-sn-edit, .smx-sn-edit.is-pinned, .smx-sn-edit:focus-visible {
  opacity: 1; transform: scale(1); pointer-events: auto;
}
.smx-sn-edit.is-active { color: #fff; background: ${SCHEMA_BORDER}; }
@media (hover: none) {
  .smx-sn-edit { opacity: 1; transform: scale(1); pointer-events: auto; }
}

/* ── Flèche entre deux étapes (pointillée quand l'étape suivante peut être sautée) ── */
.smx-sc { display: flex; flex-direction: column; align-items: center; padding: 2px 0; }
.smx-sc-line { width: 2px; height: 9px; background: ${SCHEMA_BORDER}; opacity: 0.5; }
.smx-sc.is-cond .smx-sc-line { width: 0; background: none; border-left: 2px dashed ${SCHEMA_BORDER}; }
.smx-sc-pill {
  margin: 2px 0; padding: 2px 9px; border: 1px solid ${SCHEMA_BORDER}; border-radius: 999px; background: ${SUBTLE};
  color: ${TEXT}; font-size: 11.5px; font-weight: 600; white-space: nowrap;
}
.smx-sc.is-cond .smx-sc-pill { border-style: dashed; }
.smx-sc-arrow { margin-top: -3px; color: ${SCHEMA_BORDER}; }

@media (prefers-reduced-motion: reduce) {
  .smx-sn-edit { transition: none; }
}
`;

ensureStyles('smx-schema-css', SCHEMA_CSS);
