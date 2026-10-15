// src/components/sequenceMail/MinimizedIcon.jsx
//
// Fenêtre « réduite » : elle devient une icône, comme sur un bureau. Un simple clic (ou appui bref du
// doigt) la rouvre ; appuyer et glisser la déplace. Le glissement ne rouvre jamais : au-delà d'un petit
// seuil de mouvement l'appui devient un déplacement et le « clic » qui le termine est ignoré. Au clavier :
// Entrée / Espace une fois qu'elle a le focus.
//
// Rendue en `position: fixed` par la fenêtre qu'elle représente (déjà dans un portail sous <body>).
// Elle naît au coin haut-gauche RÉEL de la fenêtre au moment de la réduction (cf. `spawnIcon`), ramené
// dans la zone autorisée : jamais sous la barre de gauche (même dépliée), jamais sous la navbar, jamais
// sur une autre icône. Les fenêtres se réduisent en glissant vers ce coin (cf. `shrinkTransform`) et
// grandissent depuis la position COURANTE de l'icône à la réouverture (cf. `playRestore`).
//
// Mise en page : l'icône (côté selon l'appareil : souris ou tactile) puis, dessous et centrée, sa légende
// (largeur = dérivée du côté, 2 lignes max). La légende est dans le flux sous l'icône : elle ne peut pas la
// recouvrir, quelle que soit sa longueur ; centrée par flexbox, elle déborde également des deux côtés.

import { useLayoutEffect, useRef, useState } from 'react';
import {
  DRAG_THRESHOLD, DRAG_THRESHOLD_TOUCH, MINIMIZED_ICON_Z,
  clamp, iconMetrics, iconTarget, mounted, onIconLayoutChange, placed, prefersReducedMotion,
} from './iconPlacement';

/** Apparition de l'icône : elle attend la fin (presque) de la réduction de la fenêtre, puis se fond. */
const ENTER_DELAY_MS = 110;
const ENTER_MS = 160;
/** Disparition à la réouverture, pendant que la fenêtre grandit depuis elle. */
const EXIT_MS = 110;
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/**
 * @param id Identifiant stable de la fenêtre représentée (sa place est mémorisée sous cet id).
 * @param src Image de l'icône (PNG).
 * @param label Nom de la fenêtre : légende sous l'icône et nom accessible.
 * @param onOpen Rouvre la fenêtre (clic, Entrée ou Espace).
 * @param active `true` tant que la fenêtre est réduite ; passé à `false`, l'icône se fond puis disparaît.
 * @param origin Coin haut-gauche de la fenêtre `{ x, y }`, pour une icône qui n'a pas encore de place réservée.
 * @param autoFocus `true` : l'icône prend le focus clavier à sa création (l'utilisateur vient de réduire la fenêtre :
 * son focus ne doit pas tomber sur <body>).
 */
export default function MinimizedIcon({ active = true, ...props }) {
  const [shown, setShown] = useState(active);
  // Une nouvelle réduction = une nouvelle icône (nouvelle place, nouvelle apparition).
  const [cycle, setCycle] = useState(0);
  const wasActive = useRef(active);

  useLayoutEffect(() => {
    if (active) {
      if (!wasActive.current) setCycle((c) => c + 1);
      wasActive.current = true;
      setShown(true);
      return undefined;
    }
    wasActive.current = false;
    const t = setTimeout(() => setShown(false), prefersReducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(t);
  }, [active]);

  if (!shown) return null;
  return <IconBody key={cycle} leaving={!active} {...props} />;
}

function IconBody({ id, src, label, onOpen, origin, leaving, autoFocus = false }) {
  const [pos, setPos] = useState(null);
  const [m, setM] = useState(iconMetrics);
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const swallowClickRef = useRef(false);
  const touchRef = useRef(false);
  // Valeur à la création seulement : un changement ultérieur de `autoFocus` ne doit pas rejouer l'apparition.
  const focusOnMount = useRef(autoFocus);

  useLayoutEffect(() => {
    const p = iconTarget(id, origin);
    mounted.add(id);
    setPos(p);
    // La zone autorisée a changé (fenêtre redimensionnée, barre de gauche, profil souris ↔ tactile) :
    // l'icône rentre dans la zone, sans jamais rester sous la barre.
    const reclamp = () => {
      setM(iconMetrics());
      setPos((cur) => {
        if (!cur) return cur;
        const next = clamp(cur);
        placed.set(id, next);
        return next.x === cur.x && next.y === cur.y ? cur : next;
      });
    };
    window.addEventListener('resize', reclamp);
    const offLayout = onIconLayoutChange(reclamp);
    const media = window.matchMedia?.('(pointer: coarse)');
    media?.addEventListener?.('change', reclamp);
    return () => {
      window.removeEventListener('resize', reclamp);
      offLayout();
      media?.removeEventListener?.('change', reclamp);
      mounted.delete(id);
    };
    // `origin` ne sert qu'à la première place : ses changements ultérieurs ne déplacent pas l'icône.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Apparition : fondu + léger grossissement, une fois la fenêtre arrivée sur place.
  const hasPos = pos !== null;
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (hasPos && focusOnMount.current) el?.focus({ preventScroll: true });
    if (!hasPos || !el?.animate) return;
    const reduced = prefersReducedMotion();
    el.animate(
      [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: reduced ? 1 : ENTER_MS, delay: reduced ? 0 : ENTER_DELAY_MS, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' },
    );
  }, [hasPos]);

  // Disparition : la fenêtre grandit déjà depuis l'icône (cf. playRestore) ; elle se fond pendant ce temps.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!leaving || !el?.animate) return;
    el.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
      { duration: prefersReducedMotion() ? 1 : EXIT_MS, easing: 'ease-out', fill: 'forwards' },
    );
  }, [leaving]);

  if (!pos) return null;

  const onPointerDown = (e) => {
    if (e.button !== 0 || leaving) return;
    touchRef.current = e.pointerType === 'touch' || e.pointerType === 'pen';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, moved: false,
      threshold: e.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD,
    };
    setPressed(true);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < d.threshold) return;
      d.moved = true;
      setDragging(true);
    }
    const next = clamp({ x: d.x + dx, y: d.y + dy });
    placed.set(id, next);
    setPos(next);
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPressed(false);
    if (d.moved) {
      // Le `click` qui suit un glissement ne doit pas rouvrir la fenêtre.
      swallowClickRef.current = true;
      setTimeout(() => { swallowClickRef.current = false; }, 0);
      setDragging(false);
    } else if (e.type === 'pointerup') {
      // Appui bref sans déplacement = ouverture, dès le relâchement : on ne dépend pas du `click` que le
      // navigateur synthétise (absent ou retardé sur certains écrans tactiles). Le `click` qui suit, s'il
      // vient, tombe sur une icône déjà en train de disparaître (`leaving`) et est ignoré.
      onOpen?.();
    }
  };
  // Repli (lecteur d'écran, `click` synthétique sans appui préalable) : même effet que l'appui bref.
  const onClick = () => {
    if (swallowClickRef.current || leaving || dragRef.current) return;
    onOpen?.();
  };
  const onKeyDown = (e) => {
    if (leaving) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={leaving ? -1 : 0}
      aria-hidden={leaving || undefined}
      data-smx-minimized={id}
      data-smx-icon-profile={m.icon > 60 ? 'touch' : 'pc'}
      aria-label={`${label} (réduite). Cliquer ou Entrée pour ouvrir ; glisser pour déplacer.`}
      title={`${label} — cliquer pour ouvrir, glisser pour déplacer`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      onContextMenu={(e) => { if (touchRef.current || e.ctrlKey) e.preventDefault(); }}
      onKeyDown={onKeyDown}
      onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: m.icon,
        zIndex: MINIMIZED_ICON_Z,
        display: 'flex',
        flexDirection: 'column',
        // Centre la légende sur l'icône : plus large qu'elle, elle déborde également des deux côtés.
        alignItems: 'center',
        cursor: dragging ? 'grabbing' : 'pointer',
        pointerEvents: leaving ? 'none' : 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        outline: 'none',
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          display: 'block',
          width: m.icon,
          height: m.icon,
          flexShrink: 0,
          pointerEvents: 'none',
          filter: dragging ? 'drop-shadow(0 10px 14px rgba(0,0,0,0.4))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          transform: dragging ? 'scale(1.06)' : pressed ? 'scale(0.96)' : 'none',
          transition: 'transform 0.12s ease, filter 0.12s ease',
          outline: focused ? '3px solid #2F4BFF' : 'none',
          outlineOffset: 2,
        }}
      />
      <span
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: m.lines,
          marginTop: m.labelGap,
          width: 'max-content',
          maxWidth: m.labelW,
          boxSizing: 'border-box',
          padding: `${m.labelPadY}px 6px`,
          borderRadius: 8,
          background: 'rgba(20,22,30,0.78)',
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: m.font,
          fontWeight: 600,
          lineHeight: `${m.lineH}px`,
          color: '#fff',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    </div>
  );
}
