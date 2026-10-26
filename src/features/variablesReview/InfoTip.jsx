import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Info } from "lucide-react";
import { EXIT, SPRING_UI } from "./motion.js";

const WIDTH = 310, GAP = 8, MARGIN = 16;

// Bulle d'explication au clic : les explications ne sont jamais écrites sous les blocs.
// Rendue dans la racine de la page en position fixe : aucune carte ni fenêtre ne la coupe.
// Un second clic, un clic ailleurs ou Échap la ferment. `trigger` remplace l'icône (i).
export function InfoTip({ label = "Explications", align = "start", trigger, triggerClassName = "", children }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const button = useRef(null), pop = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);
      const wanted = align === "end" ? r.right + GAP - width : r.left - GAP;
      const left = Math.min(Math.max(MARGIN, wanted), window.innerWidth - width - MARGIN);
      const height = pop.current?.offsetHeight || 0;
      const above = height && r.bottom + GAP + height > window.innerHeight - MARGIN && r.top - GAP - height > MARGIN;
      setPlace({ left, width, top: above ? r.top - GAP - height : r.bottom + GAP, above });
    };
    update();
    const frame = requestAnimationFrame(update); // seconde mesure, hauteur réelle connue
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!button.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const root = button.current?.closest(".vr-app") || null;
  return (
    <>
      <button ref={button} type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={trigger ? `vr-info-trigger ${triggerClassName}` : `vr-info-button ${open ? "open" : ""}`}>
        {trigger ?? <Info size={14} strokeWidth={2.2} />}
      </button>
      {root && createPortal(
        <AnimatePresence>
          {open && (
            <Motion.div
              ref={pop}
              className="vr-info-pop"
              role="dialog"
              aria-label={label}
              style={{ left: place?.left ?? -9999, top: place?.top ?? 0, width: place?.width ?? WIDTH, transformOrigin: place?.above ? "bottom left" : "top left" }}
              initial={{ y: -6, scale: 0.97, clipPath: "inset(0% 0% 0% 0% round 12px)" }}
              animate={{ y: 0, scale: 1, transition: SPRING_UI }}
              exit={{ clipPath: "inset(0% 0% 100% 0% round 12px)", transition: EXIT }}
            >
              {children}
            </Motion.div>
          )}
        </AnimatePresence>,
        root,
      )}
    </>
  );
}
