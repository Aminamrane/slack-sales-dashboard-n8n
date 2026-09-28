// src/components/sequenceMail/Splitter.jsx
//
// Séparateur redimensionnable entre deux volets, au pointeur ET au clavier.
//
// Pendant le geste, la nouvelle taille est écrite directement dans une variable CSS de
// l'élément cible (aucun re-rendu React, donc aucun re-rendu de la liste ni du lecteur) ;
// elle n'est validée (onCommit) qu'au relâchement.

import { useRef } from 'react';
import { beginDragMode, useLatest } from './hooks';

/**
 * @param orientation `'v'` : barre verticale (règle une largeur) | `'h'` : barre horizontale (règle une hauteur).
 * @param targetRef Élément qui porte la variable CSS.
 * @param cssVar Variable CSS réglée (ex. `--smx-nav-w`).
 * @param value Taille courante en px.
 * @param min Taille minimale en px.
 * @param max Taille maximale en px, ou fonction qui la calcule au début du geste.
 * @param invert Vrai si tirer vers le bas/la droite REDUIT la taille (volet placé après la barre).
 * @param onCommit Reçoit la taille finale en px.
 * @param onReset Double-clic : retour à la taille par défaut.
 */
export default function Splitter({
  orientation,
  targetRef,
  cssVar,
  value,
  min,
  max,
  invert = false,
  step = 16,
  onCommit,
  onReset,
  label,
  className = '',
}) {
  const ref = useRef(null);
  const valueRef = useLatest(value);
  const vertical = orientation === 'v';

  const limits = () => ({ lo: min, hi: Math.max(min, typeof max === 'function' ? max() : max) });
  const apply = (px) => targetRef.current?.style.setProperty(cssVar, `${px}px`);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('is-drag');
    const { lo, hi } = limits();
    const start = { p: vertical ? e.clientX : e.clientY, v: valueRef.current };
    let current = start.v;
    const endMode = beginDragMode(vertical ? 'col-resize' : 'row-resize');
    const move = (ev) => {
      const delta = (vertical ? ev.clientX : ev.clientY) - start.p;
      current = Math.round(Math.min(hi, Math.max(lo, start.v + (invert ? -delta : delta))));
      apply(current);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.releasePointerCapture?.(e.pointerId);
      el.classList.remove('is-drag');
      endMode();
      if (current !== start.v) onCommit(current);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e) => {
    const grow = vertical ? 'ArrowRight' : 'ArrowDown';
    const shrink = vertical ? 'ArrowLeft' : 'ArrowUp';
    const { lo, hi } = limits();
    let next = null;
    const dir = invert ? -1 : 1;
    if (e.key === grow) next = valueRef.current + dir * step * (e.shiftKey ? 4 : 1);
    else if (e.key === shrink) next = valueRef.current - dir * step * (e.shiftKey ? 4 : 1);
    else if (e.key === 'Home') next = lo;
    else if (e.key === 'End') next = hi;
    else if (e.key === 'Enter') {
      e.preventDefault();
      onReset?.();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    next = Math.round(Math.min(hi, Math.max(lo, next)));
    apply(next);
    onCommit(next);
  };

  const { lo, hi } = limits();
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={lo}
      aria-valuemax={hi}
      tabIndex={0}
      className={`smx-split ${vertical ? 'is-v' : 'is-h'} ${className}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      title={`${label} — glisser, ou flèches du clavier ; double-clic pour réinitialiser`}
    />
  );
}
