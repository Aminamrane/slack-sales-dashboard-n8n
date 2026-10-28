import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_OUT, useMotionPrefs } from './motion.js';

// Bulle de détail : le calcul, la source, la ventilation d'un chiffre — au survol, au
// clavier ou au clic, jamais en phrase sous le chiffre. Une ligne = { label, value } ;
// une ligne de ventilation = { kind: 'part', sign: '+' | '−', label, value } ; son résultat =
// { kind: 'total', label, value } ; une explication = { note } (texte en bas de la bulle).
// Le chiffre s'annonce de lui-même : libellé souligné en pointillé au repos, plaque et trait plein
// au survol (antique.css), puis la bulle. Ancrée sous le CONTENU (le premier enfant), pas sous la
// cellule étirée de la grille. Elle grandit depuis sa pointe sur un ressort amorti, ses lignes
// arrivent l'une après l'autre ; elle se referme en douceur vers sa pointe. Un court délai
// d'ouverture au survol évite le clignotement quand la souris ne fait que passer.
// Rendue dans un portail pour échapper aux cadres masqués ; repositionnée au
// défilement tant qu'elle est ouverte ; bascule au-dessus si elle déborde en bas.
const OPEN_DELAY = 110;
const OPEN_SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 };
const CLOSE = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };
const ROW_STAGGER = 0.03;

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
  const below = pos.placement === 'bottom';
  const lines = rows.filter((row) => row.label != null);
  return (
    <div
      ref={anchorRef}
      className={`an-bubble-anchor${open ? ' is-open' : ''} ${className}`}
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
              initial={reduce ? { x: '-50%', opacity: 1 } : { x: '-50%', opacity: 0, y: below ? 8 : -8, scale: 0.94 }}
              animate={{ x: '-50%', opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : { ...OPEN_SPRING, opacity: { duration: 0.16, ease: 'linear' } } }}
              exit={reduce ? { x: '-50%', opacity: 0, transition: { duration: 0 } } : { x: '-50%', opacity: 0, y: below ? 6 : -6, scale: 0.96, transition: CLOSE }}
            >
              {title && <div className="an-bubble-title">{title}</div>}
              {lines.map((row, i) => (
                <motion.div
                  key={`${row.kind || 'row'}-${row.label}`}
                  className={`an-bubble-row${row.kind ? ` an-bubble-row--${row.kind}` : ''}`}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.06 + i * ROW_STAGGER, duration: 0.28, ease: EASE_OUT } }}
                >
                  <span>{row.sign && <i className="an-bubble-sign" aria-hidden="true">{row.sign}</i>}{row.label}</span>
                  <strong>{row.value}</strong>
                </motion.div>
              ))}
              {rows.filter((row) => row.note).map((row, i) => (
                <motion.p
                  key={`note-${i}`}
                  className="an-bubble-note"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.06 + lines.length * ROW_STAGGER, duration: 0.3, ease: 'linear' } }}
                >
                  {row.note}
                </motion.p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
