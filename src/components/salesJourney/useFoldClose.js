import { useState } from 'react';

// Fermeture « rangée » d'une fenêtre (docs/STYLE-OWNER.md §19) : elle se replie vers l'élément qui l'a ouverte (sa
// position est retenue au montage, avant que la fenêtre ne prenne le focus), à défaut vers le bas de l'écran.
// Le composant pose `is-closing` sur le voile et `style` sur la feuille ; les règles sont dans salesJourney.css.
export const FOLD_MS = 300;

export default function useFoldClose(ref, onClose) {
  const [closing, setClosing] = useState(null);
  const [origin] = useState(() => {
    const el = typeof document !== 'undefined' ? document.activeElement : null;
    const r = el && el !== document.body ? el.getBoundingClientRect() : null;
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });
  const close = () => {
    if (closing) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !ref.current) { onClose(); return; }
    const box = ref.current.getBoundingClientRect();
    const to = origin || { x: box.left + box.width / 2, y: window.innerHeight };
    setClosing({ x: to.x - (box.left + box.width / 2), y: to.y - (box.top + box.height / 2) });
    setTimeout(onClose, FOLD_MS);
  };
  return { closing: !!closing, close, style: closing ? { '--sj-to-x': `${closing.x}px`, '--sj-to-y': `${closing.y}px` } : undefined };
}
