// src/components/sequenceMail/styles.js
//
// Feuille de style du mini client e-mail. Direction artistique volontairement CELLE D'UN CLIENT
// GMAIL (fond clair, bordures fines, listes denses, onglet actif net) et non celle du reste du
// site : toutes les couleurs passent par des variables CSS portées par `.smx-theme-light` /
// `.smx-theme-dark`, appliquées au composant ET à la couche des fenêtres flottantes (qui vit
// sous <body>, hors de l'arbre DOM du composant).
//
// Toutes les classes sont préfixées `smx-` pour ne rien heurter dans le reste de l'application.

const SMX_FONT =
  "'Google Sans Text', 'Google Sans', Roboto, 'Segoe UI', Inter, system-ui, -apple-system, sans-serif";

export const SMX_CSS = `
.smx-theme-light {
  --smx-app: #f6f8fc;
  --smx-card: #ffffff;
  --smx-card-2: #f8fafd;
  --smx-text: #1f1f1f;
  --smx-text-2: #444746;
  --smx-text-3: #5f6368;
  --smx-line: #e3e3e3;
  --smx-line-2: #dadce0;
  --smx-line-soft: #f1f3f4;
  --smx-hover: #f2f6fc;
  --smx-hover-2: #eaf1fb;
  --smx-press: rgba(31, 31, 31, 0.08);
  --smx-nav-hover: rgba(32, 33, 36, 0.059);
  --smx-nav-active: #d3e3fd;
  --smx-nav-active-text: #041e49;
  --smx-active: #e8f0fe;
  --smx-checked: #c2dbff;
  --smx-accent: #0b57d0;
  --smx-accent-text: #ffffff;
  --smx-search: #eaf1fb;
  --smx-shadow-1: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
  --smx-shadow-2: 0 4px 8px 3px rgba(60, 64, 67, 0.15), 0 1px 3px rgba(60, 64, 67, 0.3);
  --smx-shadow-win: 0 8px 10px 1px rgba(60, 64, 67, 0.14), 0 3px 14px 2px rgba(60, 64, 67, 0.12), 0 5px 5px -3px rgba(60, 64, 67, 0.2);
  --smx-float-head: #404040;
  --smx-float-head-idle: #6b6f73;
  --smx-ok: #137333;
  --smx-warn-bg: #fef7e0;
  --smx-warn-line: #f5d97a;
  --smx-warn-text: #5f3b00;
  --smx-danger: #b3261e;
  --smx-danger-bg: #fce8e6;
  --smx-brand: #3e7d5a;
  --smx-merge-bg: #e8f0fe;
  --smx-merge-text: #174ea6;
  --smx-chip-blue-bg: #e8f0fe;   --smx-chip-blue-fg: #174ea6;
  --smx-chip-purple-bg: #f3e8fd; --smx-chip-purple-fg: #681da8;
  --smx-chip-amber-bg: #fef1cf;  --smx-chip-amber-fg: #7a4a00;
  --smx-chip-red-bg: #fce8e6;    --smx-chip-red-fg: #a50e0e;
  --smx-chip-green-bg: #e6f4ea;  --smx-chip-green-fg: #0d652d;
  --smx-chip-grey-bg: #f1f3f4;   --smx-chip-grey-fg: #3c4043;
  color-scheme: light;
}
.smx-theme-dark {
  --smx-app: #1b1c1e;
  --smx-card: #202124;
  --smx-card-2: #26272b;
  --smx-text: #e8eaed;
  --smx-text-2: #c4c7c5;
  --smx-text-3: #9aa0a6;
  --smx-line: #3c4043;
  --smx-line-2: #4a4d51;
  --smx-line-soft: #2c2d31;
  --smx-hover: #2b2c31;
  --smx-hover-2: #33353a;
  --smx-press: rgba(232, 234, 237, 0.12);
  --smx-nav-hover: rgba(232, 234, 237, 0.08);
  --smx-nav-active: #004a77;
  --smx-nav-active-text: #c2e7ff;
  --smx-active: #263246;
  --smx-checked: #1e3a5f;
  --smx-accent: #a8c7fa;
  --smx-accent-text: #062e6f;
  --smx-search: #2f3033;
  --smx-shadow-1: 0 1px 2px 0 rgba(0, 0, 0, 0.6), 0 1px 3px 1px rgba(0, 0, 0, 0.35);
  --smx-shadow-2: 0 4px 8px 3px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6);
  --smx-shadow-win: 0 8px 10px 1px rgba(0, 0, 0, 0.5), 0 3px 14px 2px rgba(0, 0, 0, 0.4), 0 5px 5px -3px rgba(0, 0, 0, 0.5);
  --smx-float-head: #3c4043;
  --smx-float-head-idle: #2f3033;
  --smx-ok: #81c995;
  --smx-warn-bg: #3a3320;
  --smx-warn-line: #6b5a1f;
  --smx-warn-text: #f3d98b;
  --smx-danger: #f28b82;
  --smx-danger-bg: #4a2a28;
  --smx-brand: #6fbf95;
  --smx-merge-bg: #263246;
  --smx-merge-text: #a8c7fa;
  --smx-chip-blue-bg: #263246;   --smx-chip-blue-fg: #a8c7fa;
  --smx-chip-purple-bg: #3a2a4d; --smx-chip-purple-fg: #d7aefb;
  --smx-chip-amber-bg: #4a3a1a;  --smx-chip-amber-fg: #fdd663;
  --smx-chip-red-bg: #4a2a28;    --smx-chip-red-fg: #f28b82;
  --smx-chip-green-bg: #1f3a2a;  --smx-chip-green-fg: #81c995;
  --smx-chip-grey-bg: #35363a;   --smx-chip-grey-fg: #c4c7c5;
  color-scheme: dark;
}

.smx-root, .smx-float, .smx-ghost, .smx-menu-portal {
  font-family: ${SMX_FONT};
  font-size: 13px;
  line-height: 1.4;
  color: var(--smx-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.smx-root *, .smx-root *::before, .smx-root *::after,
.smx-float *, .smx-float *::before, .smx-float *::after,
.smx-ghost *, .smx-menu-portal * { box-sizing: border-box; }
.smx-root {
  position: relative; display: flex; flex-direction: column;
  width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden;
  background: var(--smx-app);
  container-type: inline-size; container-name: smx;
}
.smx-root button, .smx-float button { font-family: inherit; }
.smx-sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* Geste en cours : les iframes ne captent plus la souris, le curseur du geste reste partout. */
html.smx-dragging, html.smx-dragging * { cursor: var(--smx-drag-cursor, default) !important; user-select: none !important; }
html.smx-dragging iframe { pointer-events: none !important; }

/* Focus clavier visible, cohérent partout. */
.smx-root :focus-visible, .smx-float :focus-visible, .smx-menu-portal :focus-visible {
  outline: 2px solid var(--smx-accent); outline-offset: -2px; border-radius: 4px;
}
.smx-float-head :focus-visible { outline-color: #fff; }

/* ── Barre du haut ── */
.smx-top { display: flex; align-items: center; gap: 8px; height: 52px; padding: 6px 12px 0 8px; flex-shrink: 0; }
.smx-brand { display: flex; align-items: center; gap: 10px; min-width: 0; padding-right: 8px; }
.smx-brand-mark {
  width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: #fff; background: var(--smx-brand);
}
.smx-brand-name { font-size: 18px; font-weight: 400; color: var(--smx-text-2); white-space: nowrap; letter-spacing: -0.1px; }
.smx-iconbtn {
  position: relative; width: 36px; height: 36px; flex-shrink: 0; border: 0; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--smx-text-2); cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.smx-iconbtn:hover:not(:disabled) { background: var(--smx-press); }
.smx-iconbtn:active:not(:disabled) { background: var(--smx-hover-2); }
.smx-iconbtn:disabled { opacity: 0.38; cursor: default; }
.smx-iconbtn.is-sm { width: 28px; height: 28px; }
.smx-iconbtn.is-on { background: var(--smx-nav-active); color: var(--smx-nav-active-text); }
.smx-badge {
  position: absolute; top: 1px; right: 1px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background: var(--smx-accent); color: var(--smx-accent-text); font-size: 10px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
}
.smx-search {
  flex: 1; max-width: 720px; min-width: 120px; height: 40px; border-radius: 24px;
  display: flex; align-items: center; gap: 4px; padding: 0 6px 0 6px;
  background: var(--smx-search); color: var(--smx-text-2);
  transition: background 0.12s ease, box-shadow 0.12s ease;
}
.smx-search:focus-within { background: var(--smx-card); box-shadow: var(--smx-shadow-1); }
.smx-search input {
  flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent;
  color: var(--smx-text); font: inherit; font-size: 14px;
}
.smx-search input::placeholder { color: var(--smx-text-3); }
.smx-top-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; flex-shrink: 0; }
@keyframes smx-spin { to { transform: rotate(360deg); } }
.smx-spin { animation: smx-spin 0.8s linear infinite; }

/* ── Corps : navigation + panneau principal ── */
.smx-body { display: flex; flex: 1; min-height: 0; min-width: 0; padding: 0 0 8px 0; }
.smx-nav {
  width: var(--smx-nav-w, 232px); flex-shrink: 0; min-height: 0; overflow-x: hidden; overflow-y: auto;
  padding: 4px 6px 8px 8px; scrollbar-width: thin;
}
.smx-nav.is-collapsed { width: 56px; padding-left: 4px; padding-right: 4px; }
.smx-nav-title {
  padding: 10px 16px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;
  color: var(--smx-text-3); white-space: nowrap;
}
.smx-nav.is-collapsed .smx-nav-title { visibility: hidden; height: 8px; padding: 0; }
.smx-nav-item {
  display: flex; align-items: center; gap: 12px; width: 100%; height: 32px; padding: 0 12px 0 14px;
  border: 0; border-radius: 16px; background: transparent; color: var(--smx-text-2);
  text-align: left; cursor: pointer; transition: background 0.1s ease; position: relative;
}
.smx-nav-item:hover { background: var(--smx-nav-hover); }
.smx-nav-item.is-active { background: var(--smx-nav-active); color: var(--smx-nav-active-text); font-weight: 600; }
.smx-nav-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.smx-nav-ico { flex-shrink: 0; display: inline-flex; }
.smx-nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smx-nav-sub { color: var(--smx-text-3); font-weight: 400; margin-left: 6px; font-size: 12px; }
.smx-nav-item.is-active .smx-nav-sub { color: inherit; opacity: 0.75; }
.smx-nav-count { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--smx-text-3); flex-shrink: 0; }
.smx-nav-item.is-active .smx-nav-count { color: inherit; }
.smx-nav.is-collapsed .smx-nav-item { padding: 0; justify-content: center; }
.smx-nav.is-collapsed .smx-nav-label, .smx-nav.is-collapsed .smx-nav-count, .smx-nav.is-collapsed .smx-nav-sub { display: none; }
.smx-nav-note { margin: 8px 12px; font-size: 11px; color: var(--smx-text-3); line-height: 1.4; }

.smx-main {
  flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;
  background: var(--smx-card); border-radius: 16px; margin-right: 8px; overflow: hidden;
  container-type: inline-size; container-name: smxmain;
}

/* ── Séparateurs redimensionnables ── */
.smx-split {
  position: relative; flex-shrink: 0; z-index: 4; touch-action: none; outline: none;
}
.smx-split.is-v { width: 8px; margin: 0 -3px 0 -5px; cursor: col-resize; }
.smx-split.is-h { height: 9px; margin: -4px 0; cursor: row-resize; }
.smx-split::after {
  content: ''; position: absolute; background: transparent; transition: background 0.12s ease;
}
.smx-split.is-v::after { top: 0; bottom: 0; left: 3px; width: 2px; }
.smx-split.is-h::after { left: 0; right: 0; top: 4px; height: 2px; }
.smx-split:hover::after, .smx-split.is-drag::after, .smx-split:focus-visible::after { background: var(--smx-accent); }
.smx-split:focus-visible { outline: none; }

/* ── Scène : sous la barre d'onglets, le panneau de l'onglet actif occupe toute la zone ── */
.smx-stage { position: relative; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }

/* ── Liste (premier onglet) ── */
.smx-listarea { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: var(--smx-card); }
/* Masquée, pas démontée : elle garde sa taille (donc son défilement et ses mesures) sous le lecteur. */
.smx-listarea.is-hidden { position: absolute; inset: 0; visibility: hidden; pointer-events: none; }
.smx-toolbar {
  display: flex; align-items: center; gap: 2px; height: 44px; padding: 0 8px 0 6px; flex-shrink: 0;
  border-bottom: 1px solid var(--smx-line); color: var(--smx-text-2);
}
.smx-toolbar-sep { width: 1px; height: 20px; background: var(--smx-line); margin: 0 6px; }
.smx-toolbar-title { font-size: 14px; font-weight: 500; color: var(--smx-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; min-width: 0; }
.smx-toolbar-info { margin-left: auto; padding: 0 8px; font-size: 12px; color: var(--smx-text-3); white-space: nowrap; }
.smx-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 14px;
  border: 1px solid var(--smx-line-2); background: transparent; color: var(--smx-accent); font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: background 0.1s ease;
}
.smx-btn:hover { background: var(--smx-hover-2); }
.smx-btn.is-solid { background: var(--smx-accent); color: var(--smx-accent-text); border-color: transparent; }
.smx-btn.is-solid:hover { filter: brightness(1.08); background: var(--smx-accent); }
.smx-cohortbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px 14px; padding: 6px 16px; flex-shrink: 0;
  background: var(--smx-card-2); border-bottom: 1px solid var(--smx-line); font-size: 12px; color: var(--smx-text-3);
}
.smx-cohortbar strong { color: var(--smx-text-2); font-weight: 500; }
.smx-cohortbar .smx-cb-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.smx-listbody { position: relative; flex: 1; min-height: 0; }
.smx-listbody > div { position: absolute; inset: 0; }

.smx-group {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 8px; width: 100%;
  border: 0; border-bottom: 1px solid var(--smx-line-soft); background: var(--smx-card-2);
  color: var(--smx-text-2); font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;
}
.smx-group-cell { flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 8px; }
.smx-group:hover { background: var(--smx-hover-2); }
.smx-group-chev { display: inline-flex; transition: transform 0.15s ease; color: var(--smx-text-3); }
.smx-group.is-collapsed .smx-group-chev { transform: rotate(-90deg); }
.smx-group-count { font-weight: 400; color: var(--smx-text-3); font-variant-numeric: tabular-nums; }
.smx-group-meta { margin-left: auto; font-weight: 400; color: var(--smx-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.smx-row {
  position: relative; display: flex; align-items: center; gap: 6px; padding: 0 12px 0 6px; width: 100%;
  height: var(--smx-row-h, 44px); border-bottom: 1px solid var(--smx-line-soft); background: var(--smx-card);
  cursor: pointer; text-align: left; outline: none;
}
.smx-row:hover, .smx-row.is-focus {
  background: var(--smx-hover); z-index: 1;
  box-shadow: inset 1px 0 0 var(--smx-line-2), inset -1px 0 0 var(--smx-line-2), 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
}
.smx-row.is-open { background: var(--smx-active); }
.smx-row.is-open::before, .smx-row.is-active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--smx-accent); opacity: 0.55; }
.smx-row.is-active::before { opacity: 1; }
.smx-row.is-checked { background: var(--smx-checked); }
.smx-row-check { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
.smx-row-check:hover { background: var(--smx-press); }
.smx-row-check input { width: 15px; height: 15px; margin: 0; cursor: pointer; accent-color: var(--smx-accent); }
.smx-row-n { flex-shrink: 0; width: 26px; text-align: right; font-size: 11px; color: var(--smx-text-3); font-variant-numeric: tabular-nums; }
.smx-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; border: 2px solid transparent; }
.smx-dot.is-sent { background: #188038; }
.smx-dot.is-sending { background: #f29900; }
.smx-dot.is-scheduled, .smx-dot.is-upcoming { background: #1a73e8; }
.smx-dot.is-idle { background: var(--smx-line-2); }
.smx-dot.is-loading, .smx-dot.is-unknown { border-color: var(--smx-line-2); background: transparent; }
.smx-row-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; overflow: hidden; white-space: nowrap; }
.smx-row-tags { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.smx-row-subject { font-weight: 500; color: var(--smx-text); overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 40px; }
.smx-row-subject.is-empty { font-style: italic; font-weight: 400; color: var(--smx-text-3); }
.smx-row-snippet { color: var(--smx-text-3); overflow: hidden; text-overflow: ellipsis; flex: 1 1 0; min-width: 0; }
.smx-row-side { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 6px; }
.smx-row-time { font-size: 12px; color: var(--smx-text-2); white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 92px; text-align: right; }
.smx-row-stat { font-size: 11px; color: var(--smx-text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.smx-row-actions { display: none; align-items: center; gap: 0; }
.smx-row:hover .smx-row-actions, .smx-row.is-focus .smx-row-actions { display: inline-flex; }
.smx-row:hover .smx-row-time, .smx-row.is-focus .smx-row-time { display: none; }
.smx-root.is-compact { --smx-row-h: 32px; }
.smx-root.is-compact .smx-row-check { width: 24px; height: 24px; }
.smx-list-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 24px; text-align: center; color: var(--smx-text-3); }
.smx-list-empty strong { color: var(--smx-text-2); font-weight: 500; font-size: 14px; }
.smx-hl { background: #fff1a8; color: inherit; border-radius: 2px; }
.smx-theme-dark .smx-hl { background: #5c4b00; }

/* ── Puces (chips) ── */
.smx-chip {
  display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 7px; border-radius: 5px;
  font-size: 11px; font-weight: 500; white-space: nowrap; flex-shrink: 0; line-height: 1;
  background: var(--smx-chip-grey-bg); color: var(--smx-chip-grey-fg);
}
.smx-chip.is-blue { background: var(--smx-chip-blue-bg); color: var(--smx-chip-blue-fg); }
.smx-chip.is-purple { background: var(--smx-chip-purple-bg); color: var(--smx-chip-purple-fg); }
.smx-chip.is-amber { background: var(--smx-chip-amber-bg); color: var(--smx-chip-amber-fg); }
.smx-chip.is-red { background: var(--smx-chip-red-bg); color: var(--smx-chip-red-fg); }
.smx-chip.is-green { background: var(--smx-chip-green-bg); color: var(--smx-chip-green-fg); }
.smx-chip.is-lg { height: 22px; padding: 0 9px; font-size: 12px; border-radius: 6px; }

/* ── Onglets ── */
.smx-tabstrip {
  display: flex; align-items: flex-end; flex-shrink: 0; height: 46px; gap: 2px; padding: 6px 4px 0 8px;
  background: var(--smx-card-2); border-bottom: 1px solid var(--smx-line); position: relative;
  transition: box-shadow 0.12s ease, background 0.12s ease;
}
.smx-tabstrip.is-dock-hover { background: var(--smx-hover-2); box-shadow: inset 0 0 0 2px var(--smx-accent); }
.smx-tabstrip.is-dock-hover::after {
  content: 'Relâcher pour réintégrer dans les onglets'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 500; color: var(--smx-accent); background: color-mix(in srgb, var(--smx-hover-2) 82%, transparent); pointer-events: none; z-index: 5;
}
.smx-tabs-scroll {
  flex: 0 1 auto; min-width: 0; display: flex; align-items: flex-end; gap: 2px; overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none; height: 100%; scroll-behavior: smooth;
}
.smx-tabs-scroll::-webkit-scrollbar { display: none; }
.smx-tabs-end { display: flex; align-items: center; gap: 2px; padding: 0 2px 4px 4px; flex-shrink: 0; margin-left: auto; }
.smx-tab {
  position: relative; display: flex; align-items: center; gap: 2px; flex: 0 1 200px; min-width: 112px; max-width: 220px;
  height: 40px; padding: 0 4px 0 0; border: 1px solid transparent; border-bottom: 0; border-radius: 10px 10px 0 0;
  background: transparent; color: var(--smx-text-2); touch-action: none; user-select: none;
  transition: background 0.1s ease;
}
.smx-tab-main {
  flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 6px; padding: 0 0 0 10px;
  cursor: pointer; border-radius: 10px 0 0 0; color: inherit;
}
.smx-tab:hover { background: var(--smx-hover-2); }
.smx-tab.is-active { background: var(--smx-card); border-color: var(--smx-line); color: var(--smx-text); margin-bottom: -1px; height: 41px; }
.smx-tab.is-active::before { content: ''; position: absolute; left: -1px; right: -1px; top: -1px; height: 3px; border-radius: 10px 10px 0 0; background: var(--smx-accent); }
.smx-tab.is-dragging { opacity: 0.35; }
.smx-tab.is-pinned { position: sticky; left: 0; z-index: 2; flex: none; width: 184px; padding-right: 10px; background: var(--smx-card-2); }
.smx-tab.is-pinned:hover:not(.is-active) { background: var(--smx-hover-2); }
.smx-tab.is-pinned.is-active { background: var(--smx-card); }
.smx-tab-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; text-align: left; }
.smx-tab-title { font-size: 12.5px; font-weight: 500; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smx-tab-sub { font-size: 10.5px; line-height: 1.2; color: var(--smx-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smx-tab-close {
  width: 22px; height: 22px; flex-shrink: 0; border: 0; border-radius: 50%; background: transparent; color: var(--smx-text-3);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.75;
}
.smx-tab:hover .smx-tab-close, .smx-tab.is-active .smx-tab-close, .smx-tab-close:focus-visible { opacity: 1; }
.smx-tab-main:focus-visible { outline-offset: -3px; }
.smx-tab-close:hover { background: var(--smx-press); color: var(--smx-text); }
.smx-ghost {
  display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 10px; min-width: 150px; max-width: 260px;
  background: var(--smx-card); border: 1px solid var(--smx-line-2); border-radius: 10px; box-shadow: var(--smx-shadow-2);
  cursor: grabbing; pointer-events: none;
}
.smx-ghost.is-detach { height: 56px; min-width: 300px; max-width: 340px; border-radius: 8px; border-color: var(--smx-accent); }
.smx-ghost-hint { font-size: 10.5px; color: var(--smx-accent); font-weight: 500; }

/* ── Menus ── */
.smx-menu {
  position: absolute; z-index: 30; min-width: 220px; max-width: 320px; max-height: 320px; overflow-y: auto; padding: 6px 0;
  background: var(--smx-card); border: 1px solid var(--smx-line); border-radius: 8px; box-shadow: var(--smx-shadow-2);
}
.smx-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 4px 12px; border: 0; background: transparent;
  color: var(--smx-text); font-size: 13px; text-align: left; cursor: pointer;
}
.smx-menu-item:hover, .smx-menu-item:focus-visible { background: var(--smx-hover-2); }
.smx-menu-item.is-current { font-weight: 600; color: var(--smx-accent); }
.smx-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smx-menu-sep { height: 1px; background: var(--smx-line); margin: 6px 0; }
.smx-menu-title { padding: 4px 12px; font-size: 11px; font-weight: 600; color: var(--smx-text-3); text-transform: uppercase; letter-spacing: 0.5px; }

/* ── Lecteur ── */
.smx-viewer {
  flex: 1; min-height: 0; min-width: 0; overflow: auto; background: var(--smx-card); scrollbar-width: thin;
  container-type: inline-size; container-name: smxview; position: relative;
}
.smx-viewer:focus-visible { outline: none; }
.smx-viewer-in { padding: 8px 20px 40px 20px; max-width: 1040px; }
.smx-vbar { display: flex; align-items: center; gap: 2px; margin: 0 -8px 0 -8px; flex-wrap: wrap; }
.smx-vbar-count { font-size: 12px; color: var(--smx-text-3); padding: 0 6px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.smx-vbar-spacer { flex: 1; }
.smx-subject {
  margin: 4px 0 10px; font-size: 22px; font-weight: 400; line-height: 28px; color: var(--smx-text);
  word-break: break-word; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.smx-subject.is-empty { font-style: italic; color: var(--smx-text-3); }
.smx-subject.is-full { display: block; -webkit-line-clamp: unset; }
.smx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.smx-msg-head { display: flex; align-items: flex-start; gap: 12px; margin-top: 4px; }
.smx-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--smx-brand); color: #fff; font-size: 17px; font-weight: 500;
}
.smx-msg-who { flex: 1; min-width: 0; }
.smx-msg-from { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.smx-msg-from strong { font-size: 14px; font-weight: 600; }
.smx-msg-addr { font-size: 12px; color: var(--smx-text-3); overflow-wrap: anywhere; }
.smx-msg-to { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--smx-text-3); }
.smx-msg-to button {
  display: inline-flex; align-items: center; gap: 2px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer;
  border-radius: 4px; padding: 0 2px; min-width: 0;
}
.smx-msg-to button:hover { background: var(--smx-press); }
.smx-msg-to-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 46ch; }
.smx-msg-date { text-align: right; font-size: 12px; color: var(--smx-text-3); white-space: nowrap; flex-shrink: 0; }
.smx-msg-date strong { display: block; color: var(--smx-text-2); font-weight: 500; }
.smx-details {
  margin: 8px 0 0 52px; padding: 10px 14px; border: 1px solid var(--smx-line); border-radius: 8px; background: var(--smx-card-2);
  font-size: 12px; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px;
}
.smx-details dt { color: var(--smx-text-3); text-align: right; }
.smx-details dd { margin: 0; color: var(--smx-text-2); overflow-wrap: anywhere; }
.smx-preheader { margin: 10px 0 0 52px; font-size: 12px; color: var(--smx-text-3); font-style: italic; }
.smx-attach { margin: 10px 0 0 52px; display: flex; flex-wrap: wrap; gap: 6px; }
.smx-attach-item { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--smx-line-2); border-radius: 14px; font-size: 12px; color: var(--smx-text-2); }
.smx-body-tools { margin: 14px 0 6px 52px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.smx-seg { display: inline-flex; border: 1px solid var(--smx-line-2); border-radius: 14px; overflow: hidden; }
.smx-seg button { height: 26px; padding: 0 12px; border: 0; background: transparent; color: var(--smx-text-2); font-size: 12px; cursor: pointer; }
.smx-seg button + button { border-left: 1px solid var(--smx-line-2); }
.smx-seg button.is-on { background: var(--smx-nav-active); color: var(--smx-nav-active-text); font-weight: 600; }
.smx-paper {
  margin: 0 0 0 52px; background: #fff; color: #1a1a1a; border: 1px solid var(--smx-line); border-radius: 8px; overflow: hidden;
  box-shadow: 0 1px 2px rgba(60, 64, 67, 0.08);
}
.smx-paper iframe { display: block; width: 100%; border: 0; background: #fff; min-height: 120px; }
.smx-plain { margin: 0; padding: 16px 20px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12.5px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #1a1a1a; }
.smx-nobody { margin: 0 0 0 52px; padding: 22px; border: 1px dashed var(--smx-line-2); border-radius: 8px; color: var(--smx-text-3); text-align: center; }
@container smxview (max-width: 560px) {
  .smx-details, .smx-preheader, .smx-attach, .smx-body-tools, .smx-paper, .smx-nobody { margin-left: 0; }
  .smx-msg-head { flex-wrap: wrap; }
  .smx-msg-date { text-align: left; width: 100%; margin-left: 52px; }
  .smx-viewer-in { padding-left: 12px; padding-right: 12px; }
}

/* ── Informations de séquence ── */
.smx-info { margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--smx-line); }
.smx-info-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 14px; font-weight: 500; color: var(--smx-text); }
.smx-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; align-items: start; }
.smx-card { border: 1px solid var(--smx-line); border-radius: 12px; padding: 12px 14px; background: var(--smx-card); min-width: 0; }
.smx-card h4 { margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--smx-text-3); }
.smx-kv { display: grid; grid-template-columns: minmax(96px, max-content) minmax(0, 1fr); gap: 5px 12px; margin: 0; font-size: 12.5px; }
.smx-kv dt { color: var(--smx-text-3); }
.smx-kv dd { margin: 0; color: var(--smx-text); overflow-wrap: anywhere; min-width: 0; }
.smx-kv dd .smx-sub { display: block; font-size: 11.5px; color: var(--smx-text-3); }
.smx-cond { margin: 0; padding-left: 16px; font-size: 12.5px; color: var(--smx-text-2); }
.smx-cond li + li { margin-top: 3px; }
.smx-meter { height: 4px; border-radius: 2px; background: var(--smx-line); overflow: hidden; margin-top: 3px; }
.smx-meter > span { display: block; height: 100%; background: var(--smx-accent); border-radius: 2px; }
.smx-linklist { margin: 0; padding: 0; list-style: none; font-size: 12px; }
.smx-linklist li { display: flex; gap: 6px; align-items: baseline; min-width: 0; padding: 2px 0; }
.smx-linklist span:first-child { flex-shrink: 0; color: var(--smx-text-2); font-weight: 500; }
.smx-linklist span:last-child { color: var(--smx-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.smx-code { font: 11.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--smx-card-2); border: 1px solid var(--smx-line); border-radius: 4px; padding: 0 5px; }
.smx-note { font-size: 11.5px; color: var(--smx-text-3); margin: 8px 0 0; line-height: 1.45; }

/* ── États ── */
.smx-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 160px; height: 100%;
  padding: 28px 24px; text-align: center; color: var(--smx-text-3);
}
.smx-state strong { color: var(--smx-text-2); font-size: 14px; font-weight: 500; }
.smx-state p { margin: 0; max-width: 46ch; }
.smx-banner {
  display: flex; align-items: center; gap: 10px; padding: 8px 16px; flex-shrink: 0; font-size: 12.5px;
  background: var(--smx-warn-bg); color: var(--smx-warn-text); border-bottom: 1px solid var(--smx-warn-line);
}
.smx-banner.is-danger { background: var(--smx-danger-bg); color: var(--smx-danger); border-bottom-color: transparent; }
.smx-banner span { flex: 1; min-width: 0; }
.smx-banner button { border: 0; background: transparent; color: inherit; font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; padding: 0 4px; }
@keyframes smx-shimmer { 0% { background-position: -240px 0; } 100% { background-position: 240px 0; } }
.smx-skel {
  height: 14px; border-radius: 7px; background: linear-gradient(90deg, var(--smx-line-soft) 0, var(--smx-line) 40px, var(--smx-line-soft) 80px);
  background-size: 240px 100%; animation: smx-shimmer 1.3s linear infinite;
}

/* ── Fenêtres flottantes ── */
.smx-float {
  position: fixed; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: var(--smx-card); border-radius: 8px; box-shadow: var(--smx-shadow-win); border: 1px solid var(--smx-line-2);
  overflow: hidden; animation: smx-pop 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes smx-pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
.smx-float.is-idle { box-shadow: var(--smx-shadow-1); }
.smx-float.is-dock-target { opacity: 0.55; }
.smx-float-head {
  display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 4px 0 12px; flex-shrink: 0;
  background: var(--smx-float-head); color: #fff; cursor: grab; user-select: none; touch-action: none; outline: none;
}
.smx-float.is-idle .smx-float-head { background: var(--smx-float-head-idle); }
.smx-float-head:focus-visible { box-shadow: inset 0 0 0 2px #fff; border-radius: 0; }
.smx-float-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smx-float-sub { font-weight: 400; opacity: 0.75; margin-left: 8px; font-size: 11.5px; }
.smx-float-btn {
  width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: #fff; cursor: pointer; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center; opacity: 0.9;
}
.smx-float-btn:hover { background: rgba(255, 255, 255, 0.18); opacity: 1; }
.smx-float-body { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; background: var(--smx-card); }
.smx-float-body .smx-viewer { flex: 1; }
.smx-rs { position: absolute; z-index: 3; touch-action: none; }
.smx-rs.n { top: -3px; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
.smx-rs.s { bottom: -3px; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
.smx-rs.e { right: -3px; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
.smx-rs.w { left: -3px; top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
.smx-rs.ne { top: -3px; right: -3px; width: 14px; height: 14px; cursor: nesw-resize; }
.smx-rs.nw { top: -3px; left: -3px; width: 14px; height: 14px; cursor: nwse-resize; }
.smx-rs.se { bottom: -3px; right: -3px; width: 14px; height: 14px; cursor: nwse-resize; }
.smx-rs.sw { bottom: -3px; left: -3px; width: 14px; height: 14px; cursor: nesw-resize; }

/* ── Cadre de la fenêtre « Gestion de séquence » : poignées de redimensionnement ── */
.smx-frame-rs { position: absolute; z-index: 6; touch-action: none; }
.smx-frame-rs.n { top: -4px; left: 14px; right: 14px; height: 9px; cursor: ns-resize; }
.smx-frame-rs.s { bottom: -4px; left: 14px; right: 14px; height: 9px; cursor: ns-resize; }
.smx-frame-rs.e { right: -4px; top: 14px; bottom: 14px; width: 9px; cursor: ew-resize; }
.smx-frame-rs.w { left: -4px; top: 14px; bottom: 14px; width: 9px; cursor: ew-resize; }
.smx-frame-rs.ne { top: -4px; right: -4px; width: 18px; height: 18px; cursor: nesw-resize; }
.smx-frame-rs.nw { top: -4px; left: -4px; width: 18px; height: 18px; cursor: nwse-resize; }
.smx-frame-rs.se { bottom: -4px; right: -4px; width: 18px; height: 18px; cursor: nwse-resize; }
.smx-frame-rs.sw { bottom: -4px; left: -4px; width: 18px; height: 18px; cursor: nesw-resize; }

@media (prefers-reduced-motion: reduce) {
  .smx-float, .smx-spin, .smx-skel { animation: none !important; }
  .smx-root *, .smx-float * { transition: none !important; }
}
@container smx (max-width: 720px) {
  .smx-brand-name { display: none; }
  .smx-row-stat { display: none; }
}
@container smxmain (max-width: 640px) {
  .smx-tab.is-pinned { width: 148px; }
  .smx-row-snippet { display: none; }
  .smx-row-tags .smx-chip.is-seg { display: none; }
}
@container smxmain (max-width: 480px) {
  .smx-row-tags { display: none; }
  .smx-row-time { min-width: 0; }
}
`;
