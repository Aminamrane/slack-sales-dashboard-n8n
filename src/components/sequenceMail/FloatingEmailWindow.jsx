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
//
// Clavier : une fenêtre qui s'ouvre (ou qu'on ramène depuis le menu « Fenêtres flottantes » ou son icône) prend le
// focus ; Échap la ferme et rend le focus à l'élément qui l'avait ouverte ; « Réduire » envoie le focus sur l'icône.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, PictureInPicture, X } from 'lucide-react';
import { FLOAT_MIN_H, FLOAT_MIN_W, FLOAT_SAFE_TOP, actions, clampRect, useSeqStore } from './store';
import { useDragGesture, useEmailDetail, useLatest } from './hooks';
import { useThemeClass } from './themeContext';
import EmailViewer from './EmailViewer';
import { retryCohort } from './dataStore';
import { parseKey, titleOf } from './model.js';
import { Z_FLOATING_BASE } from './constants.js';
import MinimizedIcon from './MinimizedIcon';
import { playRestore, shrinkTransform } from './iconPlacement';
import subWindowIcon from '../../assets/sequence-icons/sous-fenetre.png';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

/**
 * @brief Index d'insertion dans la barre d'onglets pour un dépôt à l'abscisse `x`.
 * @note L'index compte les onglets d'e-mail SEULEMENT (c'est celui de `actions.dockFloating`) : l'onglet « liste »,
 * épinglé en tête, n'est pas un emplacement d'insertion.
 */
function dockIndexAt(strip, x) {
  const tabs = [...strip.querySelectorAll('[data-smx-tab]:not([data-smx-list-tab])')];
  let i = 0;
  for (const t of tabs) {
    const r = t.getBoundingClientRect();
    if (x > r.left + r.width / 2) i += 1;
  }
  return i;
}

/** @brief Donne le focus à l'élément `selector` dès qu'il existe dans la page (quelques images au plus). */
function focusWhenPresent(selector, tries = 12) {
  const attempt = (left) => {
    const el = document.querySelector(selector);
    if (el) el.focus({ preventScroll: true });
    else if (left > 0) requestAnimationFrame(() => attempt(left - 1));
  };
  requestAnimationFrame(() => attempt(tries));
}

function FloatingEmailWindow({ win, isTop, apiStatus }) {
  const elRef = useRef(null);
  // Transformation « réduite » (glisse vers l'icône, en haut à gauche), calculée au clic sur Réduire.
  const [shrink, setShrink] = useState(null);
  const winRef = useLatest(win);
  const detail = useEmailDetail(win.key);
  const startDrag = useDragGesture();
  const hintId = useId();
  /** Élément qui avait le focus quand la fenêtre l'a pris : il le retrouve à la fermeture. */
  const openerRef = useRef(null);
  const focusRequest = useSeqStore((s) => s.focusRequest);
  const title = detail.step ? titleOf(detail.step) : detail.state === 'loading' ? 'Chargement…' : 'E-mail';
  const sub = detail.cohort?.short ?? '';

  const setStyle = (r) => {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  // ── Focus ──────────────────────────────────────────────────────────────────
  // Ouverture, restauration depuis l'icône, menu « Fenêtres flottantes » : la fenêtre prend le focus clavier et
  // accuse réception de la demande (elle n'est pas rejouée).
  useEffect(() => {
    if (!focusRequest || focusRequest.key !== win.key || win.min) return;
    const el = elRef.current;
    if (!el) return;
    const active = document.activeElement;
    if (active && active !== document.body && !el.contains(active)) openerRef.current = active;
    el.focus({ preventScroll: true });
    actions.ackFocus(focusRequest.n);
  }, [focusRequest, win.key, win.min]);

  // Un clic DANS l'iframe du lecteur n'atteint jamais `onPointerDownCapture` : la fenêtre restait dessous. Le seul signe est le
  // `blur` de la fenêtre du navigateur, l'iframe devenant l'élément actif (même principe que SequenceWindow).
  useEffect(() => {
    const onWindowBlur = () => {
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (a && a.tagName === 'IFRAME' && elRef.current?.contains(a)) actions.focusFloating(win.key);
      });
    };
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, [win.key]);

  /** @brief Ferme la fenêtre et rend le focus à l'élément qui l'avait ouverte (à défaut : l'onglet actif de la gestion). */
  const closeWindow = () => {
    const opener = openerRef.current;
    actions.closeFloating(win.key);
    requestAnimationFrame(() => {
      const target = opener?.isConnected ? opener : document.querySelector('.smx-root [role="tab"][aria-selected="true"]');
      target?.focus({ preventScroll: true });
    });
  };

  // ── Déplacement (barre de titre) ─────────────────────────────────────────────
  const onHeadPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    actions.focusFloating(win.key);
    const el = elRef.current;
    const w0 = winRef.current;
    const start = { px: e.clientX, py: e.clientY, x: w0.x, y: w0.y };
    let last = { x: w0.x, y: w0.y };
    let dockIndex = null;
    startDrag(e, {
      cursor: 'grabbing',
      onMove: (ev) => {
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
        el?.classList.toggle('is-dock-target', over);
        dockIndex = over && strip ? dockIndexAt(strip, ev.clientX) : null;
      },
      onEnd: (_ev, completed) => {
        el?.classList.remove('is-dock-target');
        document.querySelector('[data-smx-tabstrip]')?.classList.remove('is-dock-hover');
        if (!completed) return; // démontée en plein geste : rien à valider
        if (dockIndex !== null) actions.dockFloating(win.key, dockIndex);
        else actions.setFloatingRect(win.key, last);
      },
    });
  };

  // ── Redimensionnement (poignées) ─────────────────────────────────────────────
  const onResizeDown = (dir) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    actions.focusFloating(win.key);
    const s = { ...winRef.current, px: e.clientX, py: e.clientY };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let last = { x: s.x, y: s.y, w: s.w, h: s.h };
    startDrag(e, {
      cursor: CURSOR[dir],
      onMove: (ev) => {
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
      },
      onEnd: (_ev, completed) => {
        if (completed) actions.setFloatingRect(win.key, last);
      },
    });
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

  // Réouverture (icône, menu « Fenêtres flottantes »…) : la fenêtre grandit depuis l'icône là où elle est
  // MAINTENANT, même déplacée depuis la réduction.
  const wasMin = useRef(Boolean(win.min));
  useLayoutEffect(() => {
    if (wasMin.current && !win.min) {
      const r = elRef.current?.getBoundingClientRect();
      if (r) playRestore(elRef.current, `float:${win.id}`, r);
    }
    wasMin.current = Boolean(win.min);
  }, [win.min, win.id]);

  const minimize = () => {
    const r = elRef.current?.getBoundingClientRect();
    if (r) setShrink(shrinkTransform(`float:${win.id}`, r));
    actions.minimizeFloating(win.key);
    // La fenêtre se cache : le focus la suit vers son icône réduite (qui n'existe qu'après le rendu).
    focusWhenPresent(`[data-smx-minimized="float:${win.id}"]`);
  };

  // Réduite : l'icône violette remplace la fenêtre, qui reste montée (le lecteur garde son état) mais cachée.
  return (
    <>
    <div
      ref={elRef}
      className={`smx-float${isTop ? '' : ' is-idle'}`}
      role="dialog"
      aria-modal="false"
      aria-label={`E-mail : ${title}`}
      aria-describedby={hintId}
      aria-hidden={win.min || undefined}
      tabIndex={-1}
      style={{
        left: win.x, top: win.y, width: win.w, height: win.h, zIndex: Z_FLOATING_BASE + win.z,
        ...(win.min ? {
          visibility: 'hidden', pointerEvents: 'none', animation: 'none', opacity: 0, transformOrigin: '0 0',
          transform: shrink || 'none',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s linear 0.1s, visibility 0s linear 0.22s',
        } : null),
      }}
      onPointerDownCapture={() => actions.focusFloating(win.key)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.stopPropagation();
        closeWindow();
      }}
    >
      <span id={hintId} className="smx-sr">
        Échap : fermer la fenêtre. Sur la barre de titre : flèches pour déplacer, Alt + flèches pour redimensionner.
      </span>
      {/* Le cadre porte le rognage arrondi : les poignées de redimensionnement, ses sœurs, dépassent librement. */}
      <div className="smx-float-frame">
        <div
          className="smx-float-head"
          role="group"
          tabIndex={0}
          aria-label={`Barre de titre : ${title}`}
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
          <button type="button" className="smx-float-btn" onClick={minimize} aria-label="Réduire en icône" title="Réduire en icône">
            <Minus size={16} aria-hidden />
          </button>
          <button type="button" className="smx-float-btn" onClick={() => actions.dockFloating(win.key)} aria-label="Réintégrer dans les onglets" title="Réintégrer dans les onglets">
            <PictureInPicture size={16} aria-hidden />
          </button>
          <button type="button" className="smx-float-btn" onClick={closeWindow} aria-label="Fermer la fenêtre" title="Fermer la fenêtre (Échap)">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="smx-float-body">
          <EmailViewer
            detail={detail}
            context="float"
            apiStatus={apiStatus}
            onNavigate={(toKey) => actions.replaceEmail(win.key, toKey)}
            onClose={closeWindow}
            onRetry={() => void retryCohort(parseKey(win.key).cohortId)}
          />
        </div>
      </div>
      {HANDLES.map((d) => (
        <span key={d} className={`smx-rs ${d}`} onPointerDown={onResizeDown(d)} aria-hidden />
      ))}
    </div>
    <MinimizedIcon
      active={Boolean(win.min)}
      origin={{ x: win.x, y: win.y }}
      id={`float:${win.id}`}
      src={subWindowIcon}
      label={sub ? `${title} · ${sub}` : title}
      onOpen={() => actions.showFloating(win.key)}
    />
    </>
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
  // La fenêtre « au premier plan » est la plus haute des fenêtres VISIBLES : une fenêtre réduite en icône ne
  // doit pas faire passer toutes les autres pour inactives.
  const visible = floating.filter((f) => !f.min);
  const top = visible.length ? Math.max(...visible.map((f) => f.z)) : -1;
  return createPortal(
    <div className={`smx-float-layer ${themeClass}`}>
      {floating.map((w) => (
        <FloatingEmailWindow key={w.id} win={w} isTop={w.z === top} apiStatus={apiStatus} />
      ))}
    </div>,
    document.body
  );
}
