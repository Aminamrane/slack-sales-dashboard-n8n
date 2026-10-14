import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { EASE } from '../motion';

// Détail au clic (dev 14/10/2026 : « je préfère avoir le détail en pop-up quand j'appuie sur les informations, plutôt
// que ce genre de remarque ») : la page ne montre que les chiffres et les schémas ; chaque information cliquable ouvre
// une bulle ancrée sur elle, avec le calcul, les composantes et la source. Une seule bulle à la fois ; Échap, un clic
// ailleurs ou un second clic la ferment.
const PopContext = createContext(() => {});
export const usePop = () => useContext(PopContext);

const WIDTH = 360, GAP = 10, MARGIN = 16;

function place(rect, height) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - MARGIN * 2);
  const left = Math.min(Math.max(MARGIN, rect.left), vw - width - MARGIN);
  const below = rect.bottom + GAP + height <= vh - MARGIN || rect.top < height + GAP + MARGIN;
  const top = below ? Math.min(rect.bottom + GAP, vh - MARGIN - Math.min(height, vh - MARGIN * 2)) : rect.top - GAP - height;
  return { left, top: Math.max(MARGIN, top), width, below };
}

export function PopLayer({ children }) {
  const [pop, setPop] = useState(null);
  const box = useRef(null);
  const [pos, setPos] = useState(null);
  const open = useCallback((anchor, content) => {
    setPop((current) => (current?.anchor === anchor ? null : { anchor, content }));
  }, []);
  const close = useCallback(() => setPop(null), []);

  useLayoutEffect(() => {
    if (!pop) { setPos(null); return undefined; }
    const update = () => {
      if (!pop.anchor.isConnected) { setPop(null); return; }
      setPos(place(pop.anchor.getBoundingClientRect(), box.current?.offsetHeight || 220));
    };
    update();
    const raf = requestAnimationFrame(update);   // seconde mesure, une fois la hauteur réelle connue
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [pop]);

  useEffect(() => {
    if (!pop) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); pop.anchor.focus?.(); } };
    const onDown = (e) => { if (!box.current?.contains(e.target) && !pop.anchor.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [pop, close]);

  return (
    <PopContext.Provider value={open}>
      {children}
      <AnimatePresence>
        {pop && (
          <Motion.div key="pop" ref={box} className="ps2-pop" role="dialog" aria-modal="false"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: pos?.width ?? WIDTH, transformOrigin: pos?.below === false ? 'bottom left' : 'top left' }}
            initial={{ opacity: 0, scale: 0.96, y: pos?.below === false ? 6 : -6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }} transition={{ duration: 0.28, ease: EASE }}>
            {typeof pop.content === 'function' ? pop.content(close) : pop.content}
          </Motion.div>
        )}
      </AnimatePresence>
    </PopContext.Provider>
  );
}

// Élément cliquable qui ouvre sa bulle de détail. `detail` : un nœud, ou une fonction (dismiss) => nœud.
export function Info({ as = 'button', detail, className = '', children, label, ...rest }) {
  const open = usePop();
  const Tag = as === 'motion' ? Motion.button : as;
  return (
    <Tag type="button" className={`ps2-info ${className}`} aria-haspopup="dialog" aria-label={label}
      onClick={(e) => open(e.currentTarget, detail)} {...rest}>
      {children}
    </Tag>
  );
}

// Contenu type d'une bulle : surtitre, chiffre, lignes chiffrées, calcul, source.
export function Detail({ kicker, title, value, rows = [], lines = [], source, children, action }) {
  return (
    <div className="ps2-pop-body">
      {kicker && <div className="ps2-mono" style={{ fontSize: 10.5 }}>{kicker}</div>}
      {(title || value != null) && (
        <div className="ps2-pop-title">
          {title && <b>{title}</b>}
          {value != null && <span className="ps2-num">{value}</span>}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="ps2-pop-rows">
          {rows.filter(Boolean).map(([k, v, tone]) => (
            <React.Fragment key={k}><dt>{k}</dt><dd className={`ps2-num ${tone || ''}`}>{v}</dd></React.Fragment>
          ))}
        </dl>
      )}
      {lines.length > 0 && <div className="ps2-pop-calc">{lines.filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>}
      {children}
      {(source || action) && (
        <div className="ps2-pop-foot">
          {source && <span>{source}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
