// src/components/sequenceMail/Splitter.jsx
//
// Séparateur vertical redimensionnable entre deux volets, au pointeur ET au clavier.
//
// Pendant le geste, la nouvelle taille est écrite directement dans une variable CSS de
// l'élément cible (aucun re-rendu React, donc aucun re-rendu de la liste ni du lecteur) ;
// elle n'est validée (onCommit) qu'au relâchement. Le geste (capture du pointeur, nettoyage au démontage ou
// à la perte de la capture) est celui de `useDragGesture` : aucun curseur forcé ne peut rester bloqué.

import { useDragGesture, useLatest } from './hooks';

/**
 * @param targetRef Élément qui porte la variable CSS.
 * @param cssVar Variable CSS réglée (ex. `--smx-nav-w`).
 * @param value Largeur courante en px.
 * @param min Largeur minimale en px.
 * @param max Largeur maximale en px, ou fonction qui la calcule au début du geste.
 * @param step Pas du clavier en px (×4 avec Maj).
 * @param onCommit Reçoit la largeur finale en px.
 * @param onReset Double-clic ou Entrée : retour à la largeur par défaut.
 */
export default function Splitter({
  targetRef,
  cssVar,
  value,
  min,
  max,
  step = 16,
  onCommit,
  onReset,
  label,
  className = '',
}) {
  const valueRef = useLatest(value);
  const startDrag = useDragGesture();

  const limits = () => ({ lo: min, hi: Math.max(min, typeof max === 'function' ? max() : max) });
  const apply = (px) => targetRef.current?.style.setProperty(cssVar, `${px}px`);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    // `preventDefault` évite la sélection de texte pendant le glisser, mais supprime aussi la mise au point :
    // on la donne soi-même pour que les flèches du clavier puissent enchaîner après un clic.
    e.preventDefault();
    const el = e.currentTarget;
    el.focus({ preventScroll: true });
    el.classList.add('is-drag');
    const { lo, hi } = limits();
    const start = { p: e.clientX, v: valueRef.current };
    let current = start.v;
    startDrag(e, {
      cursor: 'col-resize',
      onMove: (ev) => {
        current = Math.round(Math.min(hi, Math.max(lo, start.v + ev.clientX - start.p)));
        apply(current);
      },
      onEnd: (_ev, completed) => {
        el.classList.remove('is-drag');
        if (!completed) {
          apply(start.v); // composant démonté en plein geste : on ne laisse pas la taille intermédiaire
          return;
        }
        if (current !== start.v) onCommit(current);
      },
    });
  };

  const onKeyDown = (e) => {
    const { lo, hi } = limits();
    let next = null;
    if (e.key === 'ArrowRight') next = valueRef.current + step * (e.shiftKey ? 4 : 1);
    else if (e.key === 'ArrowLeft') next = valueRef.current - step * (e.shiftKey ? 4 : 1);
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
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={lo}
      aria-valuemax={hi}
      tabIndex={0}
      className={`smx-split is-v ${className}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      title={`${label} — glisser, ou flèches du clavier ; double-clic pour réinitialiser`}
    />
  );
}
