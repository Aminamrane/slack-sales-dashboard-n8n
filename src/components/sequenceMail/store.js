// src/components/sequenceMail/store.js
//
// État de l'interface du mini client e-mail : cohorte/filtre courants, onglets ouverts,
// fenêtres flottantes, tailles des volets… Un store de module (et non un état de composant)
// pour deux raisons :
//   1. la fenêtre « Gestion de séquence » est démontée à sa fermeture (animation de chute) :
//      les onglets et fenêtres doivent survivre à une fermeture/réouverture ;
//   2. les gestes (drag, redimensionnement) écrivent dans le DOM pendant le mouvement et ne
//      valident dans le store qu'au relâchement, ce qui évite de re-rendre le lecteur d'e-mail
//      à chaque image.
// Le sous-ensemble persistant est enregistré dans sessionStorage : il survit aussi à un
// rechargement (y compris le rechargement à chaud de Vite) mais pas à la fermeture de l'onglet.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'owner.seqMail.v1';

export const FLOAT_MIN_W = 340;
export const FLOAT_MIN_H = 240;
const FLOAT_DEFAULT_W = 560;
const FLOAT_DEFAULT_H = 460;
/** @brief Sous la navbar fixe (64 px) : une fenêtre flottante ne doit jamais s'y glisser. */
export const FLOAT_SAFE_TOP = 64;

const DEFAULT_LAYOUT = Object.freeze({ navW: 232, navCollapsed: false });
const PERSISTED = [
  'cohortId', 'sequence', 'selectedKey', 'tabs', 'activeKey', 'floating', 'zTop',
  'layout', 'collapsed', 'density', 'search', 'viewMode', 'detailsOpen',
];

const initialState = () => ({
  // Navigation
  cohortId: 'all',
  sequence: 'any',
  search: '',
  density: 'comfortable',
  collapsed: {},
  layout: { ...DEFAULT_LAYOUT },
  // E-mails ouverts
  selectedKey: null,
  tabs: [],
  activeKey: null,
  floating: [],
  zTop: 0,
  viewMode: {},
  detailsOpen: {},
  // Transitoire (non persisté)
  checked: [],
  history: [],
  announce: '',
});

let state = initialState();
const listeners = new Set();
let saveTimer = null;
let idSeq = 0;
/** @brief Identifiant stable d'une fenêtre flottante (la clé de son e-mail change quand on navigue précédent/suivant). */
const newWindowId = () => `w${Date.now().toString(36)}${(idSeq++).toString(36)}`;

function readStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistNow() {
  saveTimer = null;
  try {
    const out = {};
    for (const k of PERSISTED) out[k] = state[k];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* stockage indisponible ou plein : l'interface fonctionne sans persistance */
  }
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const without = (arr, v) => arr.filter((x) => x !== v);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** @brief Reconstruit un état valide à partir d'un JSON stocké (jamais de confiance aveugle). */
function sanitize(raw) {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  const tabs = Array.isArray(raw.tabs) ? [...new Set(raw.tabs.filter(isStr))] : [];
  const floating = (Array.isArray(raw.floating) ? raw.floating : [])
    .filter((f, i, all) => f && isStr(f.key) && !tabs.includes(f.key) && all.findIndex((g) => g?.key === f.key) === i)
    .map((f, i) => ({
      id: isStr(f.id) ? f.id : `w0${i}`,
      key: f.key,
      x: num(f.x, 80 + i * 24),
      y: num(f.y, 120 + i * 24),
      w: Math.max(FLOAT_MIN_W, num(f.w, FLOAT_DEFAULT_W)),
      h: Math.max(FLOAT_MIN_H, num(f.h, FLOAT_DEFAULT_H)),
      z: num(f.z, i + 1),
    }));
  const layout = raw.layout && typeof raw.layout === 'object' ? raw.layout : {};
  // `null` = l'onglet « liste » : valeur légitime, et repli sûr quand l'onglet enregistré n'existe plus.
  const activeKey = isStr(raw.activeKey) && tabs.includes(raw.activeKey) ? raw.activeKey : null;
  return {
    ...base,
    cohortId: isStr(raw.cohortId) ? raw.cohortId : base.cohortId,
    sequence: ['any', 'pre', 'post', 'oneshot'].includes(raw.sequence) ? raw.sequence : 'any',
    search: typeof raw.search === 'string' ? raw.search : '',
    density: raw.density === 'compact' ? 'compact' : 'comfortable',
    collapsed: raw.collapsed && typeof raw.collapsed === 'object' ? raw.collapsed : {},
    layout: {
      navW: Math.min(360, Math.max(160, num(layout.navW, DEFAULT_LAYOUT.navW))),
      navCollapsed: Boolean(layout.navCollapsed),
    },
    selectedKey: isStr(raw.selectedKey) ? raw.selectedKey : null,
    tabs,
    activeKey,
    floating,
    zTop: Math.max(num(raw.zTop, 0), ...floating.map((f) => f.z), 0),
    viewMode: raw.viewMode && typeof raw.viewMode === 'object' ? raw.viewMode : {},
    detailsOpen: raw.detailsOpen && typeof raw.detailsOpen === 'object' ? raw.detailsOpen : {},
    history: [...without(tabs, activeKey), activeKey],
  };
}

state = sanitize(readStorage());

function set(updater) {
  const patch = typeof updater === 'function' ? updater(state) : updater;
  if (!patch) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  if (saveTimer === null) saveTimer = setTimeout(persistNow, 200);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @brief Lit une partie de l'état ; `selector` doit renvoyer une valeur stable (primitive ou référence de l'état). */
export function useSeqStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

// Comme dans un navigateur, les onglets sont ouverts dans la fenêtre : le premier est toujours la liste des
// e-mails (jamais fermé), suivi d'un onglet par e-mail ouvert. `activeKey === null` désigne la liste ;
// l'historique d'activation (`history`, le plus récent en dernier) la désigne aussi par `null`.

/** @brief Onglet à activer quand `key` disparaît : le précédent réellement consulté (la liste comprise), sinon un voisin. */
function pickNext(tabs, history, key) {
  const idx = tabs.indexOf(key);
  const remaining = without(tabs, key);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const h = history[i];
    if (h !== key && (h === null || remaining.includes(h))) return h;
  }
  return remaining[idx] ?? remaining[idx - 1] ?? remaining[remaining.length - 1] ?? null;
}

/** @brief Historique où `key` (ou `null`, la liste) devient le plus récent. */
const touch = (history, key) => [...without(history, key), key];

/** @brief Active `key` (`null` = la liste) en mémorisant l'onglet quitté : fermer le nouvel onglet y ramène. */
const switchTo = (s, key) => ({
  activeKey: key,
  history: touch(s.activeKey === key ? s.history : touch(s.history, s.activeKey), key),
});

/** @brief Ramène un rectangle dans le viewport (au moins 96 px de barre de titre visibles, jamais sous la navbar). */
export function clampRect(r) {
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;
  const w = Math.min(Math.max(r.w, FLOAT_MIN_W), Math.max(FLOAT_MIN_W, vw - 16));
  const h = Math.min(Math.max(r.h, FLOAT_MIN_H), Math.max(FLOAT_MIN_H, vh - FLOAT_SAFE_TOP - 8));
  const x = Math.min(Math.max(r.x, 96 - w), vw - 96);
  const y = Math.min(Math.max(r.y, FLOAT_SAFE_TOP), vh - 40);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** @brief Position d'ouverture d'une nouvelle fenêtre : décalée en cascade pour ne pas se superposer exactement. */
function cascadeRect(count, at) {
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;
  const w = Math.min(FLOAT_DEFAULT_W, vw - 48);
  const h = Math.min(FLOAT_DEFAULT_H, vh - FLOAT_SAFE_TOP - 32);
  if (at) return clampRect({ x: at.x, y: at.y, w, h });
  const step = (count % 8) * 28;
  return clampRect({ x: Math.round((vw - w) / 2) + step, y: FLOAT_SAFE_TOP + 24 + step, w, h });
}

function renumber(floating) {
  const sorted = [...floating].sort((a, b) => a.z - b.z);
  return sorted.map((f, i) => ({ ...f, z: i + 1 }));
}

// ── Actions ────────────────────────────────────────────────────────────────────

export const actions = {
  selectCohort: (cohortId) => set({ cohortId, checked: [] }),
  selectSequence: (sequence) => set({ sequence, checked: [] }),
  setSearch: (search) => set({ search, checked: [] }),
  setDensity: (density) => set({ density }),
  setLayout: (partial) => set((s) => ({ layout: { ...s.layout, ...partial } })),
  resetLayout: () => set({ layout: { ...DEFAULT_LAYOUT } }),
  toggleGroup: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
  setAllGroups: (ids, collapsedValue) =>
    set((s) => {
      const next = { ...s.collapsed };
      for (const id of ids) next[id] = collapsedValue;
      return { collapsed: next };
    }),
  announce: (announce) => set({ announce }),

  setChecked: (keys) => set({ checked: keys }),
  toggleChecked: (key) =>
    set((s) => ({ checked: s.checked.includes(key) ? without(s.checked, key) : [...s.checked, key] })),

  setViewMode: (key, mode) => set((s) => ({ viewMode: { ...s.viewMode, [key]: mode } })),
  setDetailsOpen: (key, open) => set((s) => ({ detailsOpen: { ...s.detailsOpen, [key]: open } })),

  /**
   * @brief Ouvre un e-mail dans un onglet (ou ramène au premier plan sa fenêtre s'il est détaché).
   * @param opts `{ background }` : ouvre sans changer d'onglet actif.
   */
  openEmail: (key, opts = {}) =>
    set((s) => {
      if (s.floating.some((f) => f.key === key)) {
        return { selectedKey: key, ...bringToFront(s, key) };
      }
      if (s.tabs.includes(key)) {
        if (opts.background) return { selectedKey: key };
        return { selectedKey: key, ...switchTo(s, key) };
      }
      // Un nouvel onglet s'ouvre à droite de l'onglet courant ; depuis la liste (premier onglet), il
      // s'ajoute à la fin, dans l'ordre d'ouverture.
      const at = s.activeKey ? s.tabs.indexOf(s.activeKey) + 1 : s.tabs.length;
      const tabs = [...s.tabs.slice(0, at), key, ...s.tabs.slice(at)];
      if (opts.background) return { selectedKey: key, tabs };
      return { selectedKey: key, tabs, ...switchTo(s, key) };
    }),

  /** @brief Active un onglet ; `null` = le premier onglet, la liste des e-mails. */
  activate: (key) =>
    set((s) => {
      if (key === null) return s.activeKey === null ? null : switchTo(s, null);
      return s.tabs.includes(key) ? { selectedKey: key, ...switchTo(s, key) } : null;
    }),

  closeTab: (key) =>
    set((s) => {
      if (!s.tabs.includes(key)) return null;
      const activeKey = s.activeKey === key ? pickNext(s.tabs, s.history, key) : s.activeKey;
      return {
        tabs: without(s.tabs, key),
        activeKey,
        history: without(s.history, key),
        announce: 'Onglet fermé',
      };
    }),

  /** @brief Déplace l'onglet `key` à la position de l'onglet `overKey`. */
  reorderTabs: (key, overKey) =>
    set((s) => {
      const from = s.tabs.indexOf(key);
      const to = s.tabs.indexOf(overKey);
      if (from < 0 || to < 0 || from === to) return null;
      const tabs = s.tabs.slice();
      tabs.splice(to, 0, tabs.splice(from, 1)[0]);
      return { tabs };
    }),

  /** @brief Transforme un onglet en fenêtre flottante indépendante. */
  detachTab: (key, at) =>
    set((s) => {
      if (!s.tabs.includes(key)) return null;
      const rect = cascadeRect(s.floating.length, at);
      const zTop = s.zTop + 1;
      const activeKey = s.activeKey === key ? pickNext(s.tabs, s.history, key) : s.activeKey;
      return {
        tabs: without(s.tabs, key),
        activeKey,
        history: without(s.history, key),
        floating: [...s.floating, { id: newWindowId(), key, ...rect, z: zTop }],
        zTop,
        selectedKey: key,
        announce: 'E-mail détaché dans une fenêtre flottante',
      };
    }),

  /** @brief Ouvre directement un e-mail dans une fenêtre flottante (sans passer par un onglet). */
  openFloating: (key, at) =>
    set((s) => {
      if (s.floating.some((f) => f.key === key)) return { selectedKey: key, ...bringToFront(s, key) };
      const tabs = without(s.tabs, key);
      const zTop = s.zTop + 1;
      const activeKey = s.activeKey === key ? pickNext(s.tabs, s.history, key) : s.activeKey;
      return {
        tabs,
        activeKey,
        history: without(s.history, key),
        floating: [...s.floating, { id: newWindowId(), key, ...cascadeRect(s.floating.length, at), z: zTop }],
        zTop,
        selectedKey: key,
        announce: 'E-mail ouvert dans une fenêtre flottante',
      };
    }),

  /** @brief Réintègre une fenêtre flottante dans la barre d'onglets (à `index`, sinon après l'onglet actif). */
  dockFloating: (key, index) =>
    set((s) => {
      if (!s.floating.some((f) => f.key === key)) return null;
      const tabs = s.tabs.slice();
      const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), tabs.length) : tabs.length;
      tabs.splice(at, 0, key);
      return {
        floating: s.floating.filter((f) => f.key !== key),
        tabs,
        selectedKey: key,
        ...switchTo(s, key),
        announce: 'Fenêtre réintégrée dans les onglets',
      };
    }),

  closeFloating: (key) =>
    set((s) => ({ floating: s.floating.filter((f) => f.key !== key), announce: 'Fenêtre fermée' })),

  focusFloating: (key) =>
    set((s) => {
      const me = s.floating.find((f) => f.key === key);
      if (!me || me.z === s.zTop) return null;
      return bringToFront(s, key);
    }),

  setFloatingRect: (key, rect) =>
    set((s) => ({ floating: s.floating.map((f) => (f.key === key ? { ...f, ...clampRect({ ...f, ...rect }) } : f)) })),

  /** @brief Ramène toutes les fenêtres flottantes dans le viewport (redimensionnement du navigateur). */
  clampFloating: () =>
    set((s) => {
      if (!s.floating.length) return null;
      let changed = false;
      const floating = s.floating.map((f) => {
        const r = clampRect(f);
        if (r.x === f.x && r.y === f.y && r.w === f.w && r.h === f.h) return f;
        changed = true;
        return { ...f, ...r };
      });
      return changed ? { floating } : null;
    }),

  /** @brief Navigue vers un autre e-mail depuis `fromKey` (précédent/suivant) en gardant la même place. */
  replaceEmail: (fromKey, toKey) =>
    set((s) => {
      if (fromKey === toKey) return null;
      if (s.tabs.includes(toKey)) return { selectedKey: toKey, ...switchTo(s, toKey) };
      if (s.floating.some((f) => f.key === toKey)) return { selectedKey: toKey, ...bringToFront(s, toKey) };
      if (s.tabs.includes(fromKey)) {
        return {
          tabs: s.tabs.map((k) => (k === fromKey ? toKey : k)),
          activeKey: s.activeKey === fromKey ? toKey : s.activeKey,
          selectedKey: toKey,
          history: [...without(s.history, fromKey), toKey],
        };
      }
      if (s.floating.some((f) => f.key === fromKey)) {
        return { floating: s.floating.map((f) => (f.key === fromKey ? { ...f, key: toKey } : f)), selectedKey: toKey };
      }
      return null;
    }),

  /** @brief Ferme tous les onglets d'e-mail sauf `key` (la liste et les fenêtres flottantes ne sont pas touchées). */
  closeOtherTabs: (key) =>
    set((s) => (s.tabs.includes(key) ? { tabs: [key], activeKey: key, history: [null, key], announce: 'Autres onglets fermés' } : null)),

  /** @brief Ferme tous les onglets d'e-mail : il reste la liste (les fenêtres flottantes ne sont pas touchées). */
  closeAllTabs: () => set({ tabs: [], activeKey: null, history: [null], announce: 'Tous les onglets sont fermés' }),
};

/** @brief Met la fenêtre `key` au premier plan ; renumérote les z quand ils deviennent trop grands. */
function bringToFront(s, key) {
  const top = s.zTop + 1;
  const floating = s.floating.map((f) => (f.key === key ? { ...f, z: top } : f));
  // Plafond bas : Z_BASE (700) + z reste sous la navbar (1000) même après beaucoup de clics.
  return top > 250 ? { floating: renumber(floating), zTop: floating.length } : { floating, zTop: top };
}
