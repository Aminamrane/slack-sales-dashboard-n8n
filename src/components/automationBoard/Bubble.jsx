// Une bulle ancrée à son bouton (dev 17/11/2026 : le suivi se fait depuis le tableau). Elle sort du flux de la page
// (`createPortal`) pour ne pas être rognée par le tableau, qui défile ; elle se pose sous le bouton, passe au-dessus
// s'il n'y a pas la place, et reste dans la fenêtre. Un clic ailleurs ou Échap la referme. Les clics faits dedans ne
// remontent pas à la ligne du tableau : en React, un évènement traverse le portail.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];
const GAP = 8;
const EDGE = 10;

export default function Bubble({ open, anchor, onClose, label, className = "", children }) {
  const box = useRef(null);
  const [place, setPlace] = useState(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined; }
    const compute = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const height = box.current?.offsetHeight || 0;
      const width = box.current?.offsetWidth || 340;
      const below = rect.bottom + GAP;
      const up = below + height > window.innerHeight - EDGE && rect.top - GAP - height > EDGE;
      const top = up ? rect.top - GAP - height : Math.max(EDGE, Math.min(below, window.innerHeight - EDGE - height));
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - EDGE - width));
      setPlace({ top, left, up });
    };
    compute();
    const frame = requestAnimationFrame(compute);
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", compute, true); window.removeEventListener("resize", compute); };
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); anchor.current?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key, true); };
  }, [open, anchor, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <Motion.div ref={box} className={`ab-bubble ${className}`.trim()} role="dialog" aria-label={label}
          style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, transformOrigin: place?.up ? "bottom left" : "top left" }}
          initial={reduce ? false : { opacity: 0, y: place?.up ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }} transition={{ duration: 0.18, ease: EASE }}
          onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {children}
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
