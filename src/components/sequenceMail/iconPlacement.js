// src/components/sequenceMail/iconPlacement.js
//
// Placement des icônes de fenêtres réduites (cf. MinimizedIcon.jsx) : dimensions, mémoire des positions,
// zone interdite (barre de gauche, navbar), apparition au coin de la fenêtre réduite, cible de la
// réduction / de la réouverture. Hors du composant pour que celui-ci n'exporte que lui (rechargement
// à chaud de React).
//
// Toutes les dimensions dérivent d'UN profil d'icône (`iconMetrics`) : le côté de l'icône donne la
// largeur de la légende, sa hauteur (2 lignes) et l'emprise de l'ensemble. Rien n'est supposé ailleurs.

import { NAVBAR_SAFE_TOP, Z_MINIMIZED_ICON } from './constants';
import { fixedViewport } from './viewportBox';

/** Au-dessus des fenêtres flottantes (700 à 950), sous la navbar (1000). */
export const MINIMIZED_ICON_Z = Z_MINIMIZED_ICON;
const GAP = 12;
const MARGIN = 20;
/** Sous la navbar fixe : une icône ne doit jamais s'y glisser. */
const SAFE_TOP = NAVBAR_SAFE_TOP;
/** Marge minimale avec les bords droit et bas de la zone visible. */
const EDGE = 4;
/** Marge minimale entre la barre de gauche (dépliée) et une icône ou sa légende. */
const BAR_GAP = 8;

/** Déplacement (px) en dessous duquel un appui reste un clic : souris / doigt (qui tremble davantage). */
export const DRAG_THRESHOLD = 4;
export const DRAG_THRESHOLD_TOUCH = 8;

/** Légende : lignes max, marge sous l'icône, remplissage vertical, largeur = rapport × côté de l'icône. */
const LABEL_LINES = 2;
const LABEL_GAP = 4;
const LABEL_PAD_Y = 2;
const LABEL_RATIO = 1.5;
/** Profils d'icône : souris (PC) et écran tactile (mobile : cible plus grande, texte plus lisible). */
const PROFILES = { pc: { icon: 60, font: 10.5 }, touch: { icon: 72, font: 12 } };

const mq = (q) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
export const isTouchProfile = () => mq('(pointer: coarse)');
export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)');

/**
 * @brief Dimensions de l'icône selon l'appareil. `icon` = côté ; `labelW`/`labelH` = emprise de la légende
 * (sous l'icône, centrée) ; `overhang` = débord de la légende de chaque côté de l'icône ; `footW`/`footH` =
 * emprise totale (icône + légende), celle qui ne doit recouvrir ni une autre icône ni la barre de gauche.
 */
export function iconMetrics() {
  const p = isTouchProfile() ? PROFILES.touch : PROFILES.pc;
  const lineH = Math.round(p.font * 1.25);
  const labelW = Math.round(p.icon * LABEL_RATIO);
  const labelH = LABEL_GAP + LABEL_LINES * lineH + 2 * LABEL_PAD_Y;
  return {
    icon: p.icon,
    font: p.font,
    lineH,
    lines: LABEL_LINES,
    labelGap: LABEL_GAP,
    labelPadY: LABEL_PAD_Y,
    labelW,
    labelH,
    overhang: Math.max(0, Math.round((labelW - p.icon) / 2)),
    footW: Math.max(p.icon, labelW),
    footH: p.icon + labelH,
  };
}

/** Dernière position connue (coin haut-gauche de l'ICÔNE) de chaque icône, même démontée. */
export const placed = new Map();
/** Icônes actuellement affichées. */
export const mounted = new Set();
/**
 * Bord gauche (px) de la zone interdite : posé par les fenêtres de séquence — la barre dans son état le plus large
 * (épinglée dépliée ou dépliée au survol) sur un écran à souris, sa largeur réelle sur un petit écran tactile.
 */
let anchorLeft = 0;
const layoutListeners = new Set();

/** @brief Indique où commence la zone utile (à droite de la sidebar) ; les icônes affichées se remettent en règle. */
export function setIconAnchor(left) {
  const next = Math.max(0, Math.round(left) || 0);
  if (next === anchorLeft) return;
  anchorLeft = next;
  layoutListeners.forEach((fn) => fn());
}

/** @brief S'abonne aux changements de zone interdite (largeur de la barre) ; renvoie la désinscription. */
export function onIconLayoutChange(fn) {
  layoutListeners.add(fn);
  return () => layoutListeners.delete(fn);
}

/**
 * @brief Zone où le coin haut-gauche d'une icône peut se trouver. À gauche, la zone interdite est `anchorLeft`
 * (cf. `setIconAnchor`) : sur un écran à souris, la barre dans son état LE PLUS LARGE — repliée, elle s'ouvre
 * encore par-dessus au survol, une icône posée dessous serait recouverte. La légende, plus large que
 * l'icône, est comptée (`overhang`).
 */
function bounds() {
  const b = fixedViewport();
  const m = iconMetrics();
  const minX = b.left + anchorLeft + BAR_GAP + m.overhang;
  const minY = b.top + SAFE_TOP;
  return {
    minX,
    minY,
    maxX: Math.max(minX, b.left + b.width - m.icon - m.overhang - EDGE),
    maxY: Math.max(minY, b.top + b.height - m.footH - EDGE),
    box: b,
  };
}

const clampIn = (bn, p) => ({
  x: Math.round(Math.min(Math.max(p.x, bn.minX), bn.maxX)),
  y: Math.round(Math.min(Math.max(p.y, bn.minY), bn.maxY)),
});

/** @brief Ramène un point dans la zone autorisée (hors barre de gauche, sous la navbar, dans l'écran). */
export function clamp(p) {
  return clampIn(bounds(), p);
}

/** @brief `true` si une autre icône affichée occupe déjà (à peu près) cet emplacement. */
export function overlaps(id, p) {
  const m = iconMetrics();
  for (const other of mounted) {
    if (other === id) continue;
    const q = placed.get(other);
    if (q && Math.abs(q.x - p.x) < m.footW + 4 && Math.abs(q.y - p.y) < m.footH) return true;
  }
  return false;
}

/** @brief Première place libre en haut à gauche de la zone autorisée (de gauche à droite, puis ligne du dessous). */
function freeSlot(id) {
  const bn = bounds();
  const m = iconMetrics();
  const stepX = m.footW + GAP;
  const stepY = m.footH + GAP;
  const left = bn.minX + MARGIN;
  const top = bn.minY + MARGIN;
  const cols = Math.max(1, Math.floor((bn.maxX - left) / stepX) + 1);
  let last = clampIn(bn, { x: left, y: top });
  for (let i = 0; i < 200; i += 1) {
    last = clampIn(bn, { x: left + (i % cols) * stepX, y: top + Math.floor(i / cols) * stepY });
    if (!overlaps(id, last)) return last;
  }
  return last;
}

/**
 * @brief Fait naître l'icône `id` au point `origin` (coin haut-gauche réel de la fenêtre qu'elle remplace),
 * ramené dans la zone autorisée ; si une autre icône y est déjà, la place libre LA PLUS PROCHE (jamais un
 * coin d'écran prédéfini). La place est réservée tout de suite : la fenêtre se réduit vers elle avant que
 * l'icône n'existe.
 */
export function spawnIcon(id, origin) {
  const bn = bounds();
  const m = iconMetrics();
  const stepX = m.footW + GAP;
  const stepY = m.footH + GAP;
  const RINGS = 6;
  const cands = [];
  for (let ry = -RINGS; ry <= RINGS; ry += 1) {
    for (let rx = -RINGS; rx <= RINGS; rx += 1) {
      // Départage à égalité : plutôt vers la droite / le bas (sens de lecture) que vers la gauche / le haut.
      cands.push({ rx, ry, d: Math.hypot(rx * stepX, ry * stepY) + (rx < 0 ? 0.2 : 0) + (ry < 0 ? 0.1 : 0) });
    }
  }
  cands.sort((a, b) => a.d - b.d);
  let pick = clampIn(bn, origin);
  for (const c of cands) {
    const p = clampIn(bn, { x: origin.x + c.rx * stepX, y: origin.y + c.ry * stepY });
    if (!overlaps(id, p)) { pick = p; break; }
  }
  placed.set(id, pick);
  return pick;
}

/**
 * @brief Place de l'icône `id` à son affichage : la sienne (déjà réservée par `spawnIcon`), sinon née au point
 * `origin` s'il est connu, sinon la première place libre.
 */
export function iconTarget(id, origin) {
  let p = placed.get(id);
  p = p ? clamp(p) : null;
  if (!p) p = origin ? spawnIcon(id, origin) : freeSlot(id);
  else if (overlaps(id, p)) p = freeSlot(id);
  placed.set(id, p);
  return p;
}

/** @brief Place actuelle de l'icône `id` (là où l'utilisateur l'a laissée), sans jamais la déplacer ; `null` si inconnue. */
export function iconPosition(id) {
  const p = placed.get(id);
  return p ? clamp(p) : null;
}

/** @brief Transformation CSS (origine en haut à gauche) qui ramène un cadre de position `rect` sur le point `t`. */
function shrinkTo(t, rect) {
  const { icon } = iconMetrics();
  const scale = Math.min(1, icon / Math.max(rect.width, 1), icon / Math.max(rect.height, 1));
  return `translate(${Math.round(t.x - rect.left)}px, ${Math.round(t.y - rect.top)}px) scale(${scale.toFixed(3)})`;
}

/**
 * @brief Transformation de RÉDUCTION : l'icône naît au coin haut-gauche du cadre `rect` (sa position réelle
 * à cet instant) et le cadre se réduit en glissant vers elle.
 */
export function shrinkTransform(id, rect) {
  return shrinkTo(spawnIcon(id, { x: rect.left, y: rect.top }), rect);
}

/** Durée (ms) de la réouverture : la fenêtre grandit depuis son icône. */
export const RESTORE_MS = 220;

/**
 * @brief Anime la RÉOUVERTURE de `el` (cadre non transformé de position `rect`) : il grandit depuis l'endroit
 * où l'icône `id` se trouve MAINTENANT (même si on l'a déplacée depuis la réduction), puis reprend sa taille.
 */
export function playRestore(el, id, rect) {
  if (!el?.animate || prefersReducedMotion()) return;
  const t = iconPosition(id);
  if (!t) return;
  const from = shrinkTo(t, rect);
  el.animate(
    [{ transform: from, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
    { duration: RESTORE_MS, easing: 'cubic-bezier(0.4,0,0.2,1)' },
  );
  // Apparition plus vive que le déplacement : la fenêtre est déjà lisible quand elle a fini de grandir.
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RESTORE_MS / 2, easing: 'linear' });
}
