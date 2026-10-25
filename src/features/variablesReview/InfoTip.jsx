import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Info } from "lucide-react";
import { EXIT, SPRING_UI } from "./motion.js";

// Bulle (i) au clic : les explications ne sont jamais écrites sous les blocs.
// Un second clic, un clic ailleurs ou Échap la ferment.
export function InfoTip({ label = "Explications", align = "start", children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span className="vr-info" ref={root}>
      <button type="button" className={`vr-info-button ${open ? "open" : ""}`} aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Info size={14} strokeWidth={2.2} />
      </button>
      <AnimatePresence>
        {open && (
          <Motion.div
            className={`vr-info-pop ${align}`}
            role="dialog"
            aria-label={label}
            initial={{ y: -6, scale: 0.97, clipPath: "inset(0% 0% 0% 0% round 12px)" }}
            animate={{ y: 0, scale: 1, transition: SPRING_UI }}
            exit={{ clipPath: "inset(0% 0% 100% 0% round 12px)", transition: EXIT }}
          >
            {children}
          </Motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
