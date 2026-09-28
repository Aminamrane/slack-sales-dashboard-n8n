// src/components/sequenceMail/WindowResizeHandles.jsx
//
// Poignées de redimensionnement (bords et coins) du cadre d'une fenêtre de séquence.
//
// Ce cadre est positionné par son CENTRE (`top: 50%` + `translate(-50%, -50%)` + décalage de
// déplacement, cf. SequenceWindow) : redimensionner depuis un bord doit donc déplacer le centre de
// la moitié de la variation pour que le bord opposé reste immobile. On travaille en rectangle
// absolu (gauche/haut/droite/bas), on borne, puis on reconvertit en taille + décalage.
//
// Le centre de repos (décalage nul) n'est PAS supposé : il est déduit du rectangle réellement
// mesuré du cadre, donc juste quel que soit le bloc conteneur du `position: fixed`.

import { useEffect, useRef } from 'react';
import { beginDragMode, useLatest } from './hooks';
import { fixedViewport } from './viewportBox';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

/**
 * @param geometry `{ w, h, x, y }` : taille du cadre et décalage de son centre par rapport à la position centrée.
 * @param safeTop Hauteur réservée en haut (navbar flottante) : le cadre ne la recouvre jamais.
 * @param min Taille minimale `{ w, h }`.
 * @param onChange Reçoit la nouvelle géométrie `{ w, h, x, y }`.
 */
export default function WindowResizeHandles({ geometry, safeTop = 64, min = { w: 640, h: 440 }, disabled = false, onChange }) {
  const geoRef = useLatest(geometry);
  const frameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const onDown = (dir) => (e) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    const g0 = { ...geoRef.current };
    // Zone où le cadre est réellement visible (sans la barre de défilement ni sa gouttière, cf. viewportBox.js).
    const box = fixedViewport();
    const vw = box.left + box.width;
    const vh = box.top + box.height;
    // Rectangle réel du cadre (les poignées en sont les enfants directs) et centre de repos déduit.
    const frame = handle.parentElement.getBoundingClientRect();
    const L0 = frame.left;
    const R0 = frame.right;
    const T0 = frame.top;
    const B0 = frame.bottom;
    const baseX = (L0 + R0) / 2 - g0.x;
    const baseY = (T0 + B0) / 2 - g0.y;
    const maxW = vw - 16;
    const maxH = vh - safeTop - 8;
    const start = { x: e.clientX, y: e.clientY };
    const endMode = beginDragMode(CURSOR[dir]);
    let pending = null;

    const flush = () => {
      frameRef.current = 0;
      if (pending) onChange(pending);
      pending = null;
    };
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let L = L0;
      let R = R0;
      let T = T0;
      let B = B0;
      if (dir.includes('e')) R = Math.max(L0 + min.w, Math.min(R0 + dx, L0 + maxW, vw - 8));
      if (dir.includes('w')) L = Math.min(R0 - min.w, Math.max(L0 + dx, R0 - maxW, 8));
      if (dir.includes('s')) B = Math.max(T0 + min.h, Math.min(B0 + dy, T0 + maxH, vh - 8));
      if (dir.includes('n')) T = Math.min(B0 - min.h, Math.max(T0 + dy, B0 - maxH, safeTop));
      pending = {
        w: Math.round(R - L),
        h: Math.round(B - T),
        x: Math.round((L + R) / 2 - baseX),
        y: Math.round((T + B) / 2 - baseY),
      };
      if (!frameRef.current) frameRef.current = requestAnimationFrame(flush);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      handle.releasePointerCapture?.(e.pointerId);
      endMode();
      cancelAnimationFrame(frameRef.current);
      flush();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  if (disabled) return null;
  return HANDLES.map((d) => <span key={d} className={`smx-frame-rs ${d}`} data-resize={d} onPointerDown={onDown(d)} aria-hidden />);
}
