// src/components/sequenceMail/FloatingEmailWindow.jsx
//
// Fenêtres flottantes indépendantes : un e-mail détaché d'un onglet devient une fenêtre qu'on
// déplace (barre de titre), redimensionne (8 poignées : bords et coins), met au premier plan
// (clic), réintègre dans les onglets (bouton, ou dépôt sur la barre d'onglets) et ferme.
//
// Elles vivent dans un portail sous <body> : la fenêtre « Gestion de séquence » porte un
// `transform` CSS qui ferait de tout `position: fixed` un positionnement relatif à elle et
// les enfermerait dans son cadre (`overflow: hidden`). Le déplacement et le redimensionnement
// écrivent directement dans le style de l'élément pendant le geste, et ne valident la
// géométrie dans le store qu'au relâchement.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture, X } from 'lucide-react';
import { FLOAT_MIN_H, FLOAT_MIN_W, FLOAT_SAFE_TOP, actions, clampRect, useSeqStore } from './store';
import { beginDragMode, useEmailDetail, useLatest } from './hooks';
import { useThemeClass } from './themeContext';
import EmailViewer from './EmailViewer';
import { ensureContent, reloadAll } from './dataStore';
import { parseKey } from './model';

const Z_BASE = 700;
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

/** @brief Index d'insertion dans la barre d'onglets pour un dépôt à l'abscisse `x`. */
function dockIndexAt(strip, x) {
  const tabs = [...strip.querySelectorAll('[data-smx-tab]')];
  let i = 0;
  for (const t of tabs) {
    const r = t.getBoundingClientRect();
    if (x > r.left + r.width / 2) i += 1;
  }
  return i;
}

function FloatingEmailWindow({ win, isTop, apiStatus }) {
  const elRef = useRef(null);
  const winRef = useLatest(win);
  const detail = useEmailDetail(win.key);
  const title = detail.step?.subject || (detail.state === 'loading' ? 'Chargement…' : detail.step ? '(sans objet)' : 'E-mail');
  const sub = detail.cohort?.short ?? '';

  const setStyle = (r) => {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  // ── Déplacement (barre de titre) ─────────────────────────────────────────────
  const onHeadPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const head = e.currentTarget;
    const el = elRef.current;
    head.setPointerCapture?.(e.pointerId);
    actions.focusFloating(win.key);
    const w0 = winRef.current;
    const start = { px: e.clientX, py: e.clientY, x: w0.x, y: w0.y };
    const endMode = beginDragMode('grabbing');
    let last = { x: w0.x, y: w0.y };
    let dockIndex = null;
    const move = (ev) => {
      const r = clampRect({ x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py, w: w0.w, h: w0.h });
      last = { x: r.x, y: r.y };
      setStyle({ ...r, w: w0.w, h: w0.h });
      // Au-dessus de la barre d'onglets : la fenêtre sera réintégrée au relâchement.
      const strip = document.querySelector('[data-smx-tabstrip]');
      let over = false;
      if (strip) {
        const b = strip.getBoundingClientRect();
        over = ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top - 6 && ev.clientY <= b.bottom + 6;
        strip.classList.toggle('is-dock-hover', over);
      }
      // Au-dessus de la cible, la fenêtre devient translucide pour laisser voir la barre d'onglets.
      el.classList.toggle('is-dock-target', over);
      dockIndex = over && strip ? dockIndexAt(strip, ev.clientX) : null;
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      head.releasePointerCapture?.(e.pointerId);
      endMode();
      el.classList.remove('is-dock-target');
      document.querySelector('[data-smx-tabstrip]')?.classList.remove('is-dock-hover');
      if (dockIndex !== null) actions.dockFloating(win.key, dockIndex);
      else actions.setFloatingRect(win.key, last);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  };

  // ── Redimensionnement (poignées) ─────────────────────────────────────────────
  const onResizeDown = (dir) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    actions.focusFloating(win.key);
    const s = { ...winRef.current, px: e.clientX, py: e.clientY };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const endMode = beginDragMode(CURSOR[dir]);
    let last = { x: s.x, y: s.y, w: s.w, h: s.h };
    const move = (ev) => {
      const dx = ev.clientX - s.px;
      const dy = ev.clientY - s.py;
      let { x, y, w, h } = s;
      if (dir.includes('e')) w = s.w + dx;
      if (dir.includes('s')) h = s.h + dy;
      if (dir.includes('w')) {
        w = s.w - dx;
        x = s.x + dx;
      }
      if (dir.includes('n')) {
        h = s.h - dy;
        y = s.y + dy;
      }
      // Bornes : jamais sous la navbar, jamais hors de l'écran, jamais sous la taille minimale.
      if (y < FLOAT_SAFE_TOP) {
        if (dir.includes('n')) h -= FLOAT_SAFE_TOP - y;
        y = FLOAT_SAFE_TOP;
      }
      if (x < 0) {
        if (dir.includes('w')) w += x;
        x = 0;
      }
      if (x + w > vw) w = vw - x;
      if (y + h > vh) h = vh - y;
      if (w < FLOAT_MIN_W) {
        if (dir.includes('w')) x -= FLOAT_MIN_W - w;
        w = FLOAT_MIN_W;
      }
      if (h < FLOAT_MIN_H) {
        if (dir.includes('n')) y -= FLOAT_MIN_H - h;
        h = FLOAT_MIN_H;
      }
      last = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      setStyle(last);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      handle.releasePointerCapture?.(e.pointerId);
      endMode();
      actions.setFloatingRect(win.key, last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  // Clavier : flèches = déplacer, Alt + flèches = redimensionner (Maj = pas de 40 px).
  const onHeadKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.shiftKey ? 40 : 10;
    const w = winRef.current;
    if (e.altKey) actions.setFloatingRect(win.key, { w: w.w + d[0] * step, h: w.h + d[1] * step });
    else actions.setFloatingRect(win.key, { x: w.x + d[0] * step, y: w.y + d[1] * step });
  };

  return (
    <div
      ref={elRef}
      className={`smx-float${isTop ? '' : ' is-idle'}`}
      role="dialog"
      aria-modal="false"
      aria-label={`E-mail : ${title}`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: Z_BASE + win.z }}
      onPointerDownCapture={() => actions.focusFloating(win.key)}
    >
      <div
        className="smx-float-head"
        tabIndex={0}
        aria-label={`Barre de titre de la fenêtre « ${title} ». Flèches : déplacer. Alt + flèches : redimensionner.`}
        onPointerDown={onHeadPointerDown}
        onKeyDown={onHeadKeyDown}
        onDoubleClick={(e) => {
          if (!e.target.closest('button')) actions.dockFloating(win.key);
        }}
        title="Glisser pour déplacer ; déposer sur la barre d'onglets pour réintégrer"
      >
        <span className="smx-float-title" title={title}>
          {title}
          {sub && <span className="smx-float-sub">{sub}</span>}
        </span>
        <button type="button" className="smx-float-btn" onClick={() => actions.dockFloating(win.key)} aria-label="Réintégrer dans les onglets" title="Réintégrer dans les onglets">
          <PictureInPicture size={16} aria-hidden />
        </button>
        <button type="button" className="smx-float-btn" onClick={() => actions.closeFloating(win.key)} aria-label="Fermer la fenêtre" title="Fermer la fenêtre">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="smx-float-body">
        <EmailViewer
          detail={detail}
          context="float"
          apiStatus={apiStatus}
          onNavigate={(toKey) => actions.replaceEmail(win.key, toKey)}
          onClose={() => actions.closeFloating(win.key)}
          onRetry={() => {
            const { cohortId } = parseKey(win.key);
            void ensureContent(cohortId, true);
            void reloadAll();
          }}
        />
      </div>
      {HANDLES.map((d) => (
        <span key={d} className={`smx-rs ${d}`} onPointerDown={onResizeDown(d)} aria-hidden />
      ))}
    </div>
  );
}

/** @brief Couche des fenêtres flottantes, rendue sous <body> (hors du cadre transformé de la fenêtre de gestion). */
export default function FloatingLayer({ apiStatus }) {
  const floating = useSeqStore((s) => s.floating);
  const themeClass = useThemeClass();

  // Le navigateur a changé de taille (ou les fenêtres viennent d'être restaurées) : aucune ne doit rester hors écran.
  useEffect(() => {
    actions.clampFloating();
    window.addEventListener('resize', actions.clampFloating);
    return () => window.removeEventListener('resize', actions.clampFloating);
  }, []);

  if (floating.length === 0) return null;
  const top = Math.max(...floating.map((f) => f.z));
  return createPortal(
    <div className={`smx-float-layer ${themeClass}`}>
      {floating.map((w) => (
        <FloatingEmailWindow key={w.id} win={w} isTop={w.z === top} apiStatus={apiStatus} />
      ))}
    </div>,
    document.body
  );
}
