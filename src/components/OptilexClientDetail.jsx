import { useId, useLayoutEffect, useRef, useState } from 'react';
import './OptilexClientDetail.css';

export function DetailFold({ title, children }) {
  return <details className="ob-detail-fold"><summary>{title}<span aria-hidden="true">⌄</span></summary><div className="ob-detail-fold-body">{children}</div></details>;
}

// `measureKey` : quand `text` est un nœud React reconstruit à chaque rendu (mentions surlignées),
// la mesure du débordement se cale sur la chaîne d'origine, pas sur l'identité du nœud.
export function DetailText({ text, measureKey }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const contentKey = measureKey ?? text;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [contentKey, expanded]);
  return <div className="ob-detail-text-wrap"><div id={id} ref={ref} className={`ob-detail-text ${expanded ? '' : 'is-collapsed'}`}>{text}</div>
    {(expanded || overflow) && <button type="button" className="ob-detail-link" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(v => !v)}>{expanded ? 'Voir moins' : 'Voir plus'}</button>}
  </div>;
}
