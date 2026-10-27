import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionPrefs } from './motion.js';

// Bulle de détail : le calcul, la source, la ventilation d'un chiffre — au survol, au
// clavier ou au clic, jamais en phrase sous le chiffre. Une ligne = { label, value } ;
// une explication = { note } (texte en bas de la bulle).
// Ancrée sous le CONTENU (le premier enfant), pas sous la cellule étirée de la grille.
// Entre sur un ressort (montée + légère échelle), sort sèchement ; un court délai
// d'ouverture au survol évite le clignotement quand la souris ne fait que passer.
// Rendue dans un portail pour échapper aux cadres masqués ; repositionnée au
// défilement tant qu'elle est ouverte ; bascule au-dessus si elle déborde en bas.
const OPEN_DELAY = 110;

export default function Bubble({ rows, title, children, className = '', dark = false, align = 'center' }) {
  const anchorRef = useRef(null);
  const bubbleRef = useRef(null);
  const timer = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'bottom' });
  const { reduce } = useMotionPrefs();
  const hasRows = Array.isArray(rows) && rows.length > 0;

  const recompute = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const target = a.firstElementChild || a;
    const r = target.getBoundingClientRect();
    const h = bubbleRef.current?.offsetHeight ?? 110;
    const w = bubbleRef.current?.offsetWidth ?? 220;
    const gap = 10;
    const placement = r.bottom + gap + h > window.innerHeight - 8 ? 'top' : 'bottom';
    const top = placement === 'bottom' ? r.bottom + gap : r.top - gap - h;
    let left = align === 'start' ? r.left + Math.min(w / 2, r.width / 2) : r.left + r.width / 2;
    left = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, left));
    setPos({ top, left, placement });
  }, [align]);

  useEffect(() => {
    if (!open) return undefined;
    recompute();
    const raf = requestAnimationFrame(recompute);
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [open, recompute]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (delay) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), delay); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); };

  if (!hasRows) return <div className={className}>{children}</div>;
  return (
    <div
      ref={anchorRef}
      className={`an-bubble-anchor ${className}`}
      tabIndex={0}
      onMouseEnter={() => show(OPEN_DELAY)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onClick={() => (open ? hide() : show(0))}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={bubbleRef}
              role="tooltip"
              className={`an-bubble an-bubble--${pos.placement}${dark ? ' is-dark' : ''}`}
              style={{ top: pos.top, left: pos.left }}
              initial={reduce ? { x: '-50%', opacity: 1 } : { x: '-50%', opacity: 0, y: pos.placement === 'bottom' ? 6 : -6, scale: 0.97 }}
              animate={{ x: '-50%', opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 26, mass: 0.8, opacity: { duration: 0.12 } } }}
              exit={reduce ? { x: '-50%', opacity: 0, transition: { duration: 0 } } : { x: '-50%', opacity: 0, y: pos.placement === 'bottom' ? 4 : -4, scale: 0.985, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            >
              {title && <div className="an-bubble-title">{title}</div>}
              {rows.filter((row) => row.label != null).map((row) => (
                <div key={row.label} className="an-bubble-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
              {rows.filter((row) => row.note).map((row, i) => <p key={`note-${i}`} className="an-bubble-note">{row.note}</p>)}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
