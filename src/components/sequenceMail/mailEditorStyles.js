// src/components/sequenceMail/mailEditorStyles.js
//
// Feuille de style de l'éditeur de mail. Elle ne définit que ce qui lui est propre (`smx-ed-*`) :
// couleurs, boutons (`smx-btn`, `smx-iconbtn`), puces (`smx-chip`) et mode sombre viennent des
// variables et classes de styles.js, que l'éditeur charge avec elle — il a donc exactement
// l'apparence de « Gestion de séquence » et suit le même mode clair/sombre.

import { SMX_FONT } from './styles';
import { ensureStyles } from './injectStyles';

export const MAIL_EDITOR_CSS = `
.smx-ed {
  position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0;
  overflow: hidden; background: var(--smx-app); color: var(--smx-text);
  font-family: ${SMX_FONT}; font-size: 13px; line-height: 1.4;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.smx-ed *, .smx-ed *::before, .smx-ed *::after { box-sizing: border-box; }
.smx-ed button, .smx-ed input, .smx-ed textarea { font-family: inherit; }
.smx-ed :focus-visible { outline: 2px solid var(--smx-accent); outline-offset: -2px; border-radius: 4px; }

/* ── Bandeau PERMANENT : le prototype n'enregistre rien et n'envoie que le test, à soi-même (jamais réduit à une infobulle) ── */
.smx-ed-banner {
  display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; margin: 0; padding: 6px 14px; font-size: 12px; line-height: 1.4;
  color: var(--smx-warn-text); background: var(--smx-warn-bg); border-bottom: 1px solid var(--smx-warn-line);
}
.smx-ed-banner svg { flex-shrink: 0; margin-top: 1px; }

/* ── En-tête : titre, expéditeur, destinataires, objet (comme la fenêtre de rédaction d'un client mail) ── */
.smx-ed-head { flex-shrink: 0; padding: 10px 18px 0; background: var(--smx-card); border-bottom: 1px solid var(--smx-line); }
.smx-ed-title { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 8px; }
.smx-ed-title-mark {
  width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0; color: #fff; background: var(--smx-brand);
  display: inline-flex; align-items: center; justify-content: center;
}
.smx-ed-title h2 { margin: 0; min-width: 0; font-size: 15px; font-weight: 500; color: var(--smx-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.smx-ed-title .smx-chip { margin-left: auto; flex-shrink: 0; }
.smx-ed-ctx { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.smx-ed-field { display: flex; align-items: center; gap: 10px; min-height: 36px; border-top: 1px solid var(--smx-line-soft); }
.smx-ed-field:focus-within { box-shadow: inset 0 -2px 0 var(--smx-accent); }
.smx-ed-label { width: 44px; flex-shrink: 0; font-size: 12px; color: var(--smx-text-3); }
.smx-ed-static { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--smx-text-2); }
.smx-ed-input {
  flex: 1; min-width: 0; height: 34px; border: 0; outline: 0; background: transparent; color: var(--smx-text);
  font-size: 14px; font-weight: 500;
}
.smx-ed-input::placeholder { color: var(--smx-text-3); font-weight: 400; }
.smx-ed-input:focus-visible { outline: 0; }

/* ── Barre d'outils de mise en forme ── */
.smx-ed-toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px; flex-shrink: 0; padding: 5px 10px;
  background: var(--smx-card-2); border-bottom: 1px solid var(--smx-line);
}
.smx-ed-sep { width: 1px; height: 20px; margin: 0 6px; flex-shrink: 0; background: var(--smx-line); }
.smx-ed-toolbar .smx-iconbtn { width: 32px; height: 32px; border-radius: 8px; }
.smx-ed-toolbar .smx-iconbtn[aria-pressed='true'] { background: var(--smx-nav-active); color: var(--smx-nav-active-text); }
.smx-ed-toolhint { margin-left: auto; padding-left: 10px; font-size: 11.5px; color: var(--smx-text-3); white-space: nowrap; }
.smx-ed-linkbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0; padding: 8px 12px;
  background: var(--smx-card-2); border-bottom: 1px solid var(--smx-line);
}
.smx-ed-linkbar label { font-size: 12px; color: var(--smx-text-3); }
.smx-ed-linkbar input {
  flex: 1; min-width: 160px; height: 30px; padding: 0 10px; border-radius: 15px; border: 1px solid var(--smx-line-2);
  background: var(--smx-card); color: var(--smx-text); font-size: 13px; outline: 0;
}
.smx-ed-linkbar input:focus { border-color: var(--smx-accent); box-shadow: 0 0 0 2px var(--smx-active); }
.smx-ed-linkbar input[aria-invalid='true'] { border-color: var(--smx-danger); }
.smx-ed-linkerr { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--smx-danger); }

/* ── Zone de rédaction : l'e-mail sur une feuille blanche, comme dans l'aperçu ── */
.smx-ed-canvas { position: relative; flex: 1; min-height: 0; padding: 12px 14px; }
.smx-ed-paper {
  width: 100%; height: 100%; overflow: hidden; background: #fff; color: #1a1a1a;
  border: 1px solid var(--smx-line); border-radius: 8px; box-shadow: 0 1px 2px rgba(60, 64, 67, 0.08);
}
.smx-ed-paper:focus-within { border-color: var(--smx-accent); box-shadow: 0 0 0 2px var(--smx-active); }
.smx-ed-frame { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.smx-ed-textarea {
  display: block; width: 100%; height: 100%; margin: 0; padding: 16px 20px; resize: none; border: 0; outline: 0;
  background: #fff; color: #1a1a1a; font: 12.5px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.smx-ed-note {
  margin: 0; padding: 6px 14px; flex-shrink: 0; font-size: 12px; color: var(--smx-warn-text);
  background: var(--smx-warn-bg); border-bottom: 1px solid var(--smx-warn-line);
}
.smx-ed-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--smx-text-3); }
.smx-ed-state .smx-btn { margin-top: 6px; }

/* ── Pied : état de synchronisation et actions ── */
.smx-ed-foot {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; flex-shrink: 0; padding: 10px 14px;
  background: var(--smx-card); border-top: 1px solid var(--smx-line);
}
.smx-ed-status { display: inline-flex; align-items: center; gap: 7px; flex: 1 1 280px; min-width: 0; font-size: 12px; color: var(--smx-text-3); }
/* Les trois actions restent groupées : si le pied est trop étroit, elles passent ensemble sous l'état. */
.smx-ed-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-left: auto; }
.smx-ed-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--smx-line-2); }
.smx-ed-status.is-editing { color: var(--smx-text-2); }
.smx-ed-status.is-editing .smx-ed-dot { background: #f29900; animation: smx-ed-pulse 1.6s ease-in-out infinite; }
.smx-ed-status.is-confirmed { color: var(--smx-ok); }
.smx-ed-status.is-confirmed .smx-ed-dot { background: var(--smx-ok); }
@keyframes smx-ed-pulse { 50% { opacity: 0.35; } }
.smx-ed-foot .smx-btn { height: 32px; padding: 0 14px; border-radius: 16px; font-size: 12.5px; }
.smx-ed-foot .smx-btn:disabled { opacity: 0.45; cursor: default; }
.smx-ed-foot .smx-btn.is-ghost { border-color: transparent; color: var(--smx-text-2); }
.smx-ed-foot .smx-btn.is-ghost:hover:not(:disabled) { background: var(--smx-press); }

/* ── Retour d'information (confirmation simulée, bloc protégé rétabli) ── */
.smx-ed-toast {
  /* Centré par ses marges automatiques, pas par un transform : l'animation d'entrée (smx-pop) en pose un. */
  position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 5; display: flex; align-items: flex-start; gap: 10px;
  max-width: 460px; margin: 0 auto; padding: 10px 10px 10px 14px;
  border-radius: 12px; border: 1px solid var(--smx-line-2); background: var(--smx-card); color: var(--smx-text);
  box-shadow: var(--smx-shadow-2); animation: smx-pop 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.smx-ed-toast.is-ok { border-color: var(--smx-ok); }
.smx-ed-toast-ico { flex-shrink: 0; margin-top: 1px; color: var(--smx-ok); }
.smx-ed-toast-body { flex: 1; min-width: 0; font-size: 12.5px; }
.smx-ed-toast-body strong { display: block; font-size: 13px; font-weight: 600; }
.smx-ed-toast-body span { color: var(--smx-text-3); }

/* ── « Tester son mail » : fenêtre d'envoi du test ── */
.smx-ed-scrim {
  position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(32, 33, 36, 0.45); animation: smx-pop 0.14s ease both;
}
.smx-ed-dialog {
  width: min(440px, 100%); max-height: 100%; overflow: auto; padding: 18px 20px 16px; border-radius: 16px;
  background: var(--smx-card); color: var(--smx-text); box-shadow: var(--smx-shadow-win);
}
.smx-ed-dialog:focus { outline: none; }
.smx-ed-dialog-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.smx-ed-dialog-head h3 { margin: 0; flex: 1; font-size: 16px; font-weight: 500; }
.smx-ed-dialog p { margin: 0 0 12px; color: var(--smx-text-3); font-size: 12.5px; }
.smx-ed-dialog label { display: block; margin: 12px 0 4px; font-size: 12px; font-weight: 500; color: var(--smx-text-2); }
.smx-ed-dialog input[type='email'] {
  width: 100%; height: 38px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--smx-line-2);
  background: var(--smx-card); color: var(--smx-text); font-size: 14px; outline: 0;
}
.smx-ed-dialog input[type='email']:focus { border-color: var(--smx-accent); box-shadow: 0 0 0 2px var(--smx-active); }
.smx-ed-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.smx-ed-dialog .smx-btn { height: 32px; padding: 0 14px; border-radius: 16px; font-size: 12.5px; }
.smx-ed-dialog .smx-btn:disabled { opacity: 0.45; cursor: default; }
.smx-ed-result { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 6px 0 2px; }
.smx-ed-result-ico {
  width: 44px; height: 44px; margin-bottom: 8px; border-radius: 50%; color: var(--smx-ok); background: var(--smx-chip-green-bg);
  display: inline-flex; align-items: center; justify-content: center;
}
.smx-ed-result strong { font-size: 15px; font-weight: 600; }
.smx-ed-result p { margin: 4px 0 0; }
.smx-ed-recap { width: 100%; margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--smx-card-2); border: 1px solid var(--smx-line); text-align: left; }
.smx-ed-recap div { display: flex; gap: 10px; padding: 3px 0; font-size: 12.5px; }
.smx-ed-recap dt { width: 86px; flex-shrink: 0; color: var(--smx-text-3); }
.smx-ed-recap dd { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; color: var(--smx-text); }
.smx-ed-recap .smx-ed-sub { display: block; margin-top: 2px; font-size: 12px; color: var(--smx-text-3); }
.smx-ed-dialog .smx-ed-recap + p { margin-top: 12px; text-align: left; }
.smx-ed-dialog .smx-ed-dialog-err { margin: 12px 0 0; font-size: 12.5px; color: var(--smx-danger); }

@media (prefers-reduced-motion: reduce) {
  .smx-ed-toast, .smx-ed-scrim, .smx-ed-status.is-editing .smx-ed-dot { animation: none !important; }
}
`;

// Posée une seule fois dans <head> avec celle de styles.js (cf. injectStyles.js).
ensureStyles('smx-editor-css', MAIL_EDITOR_CSS);
