import { useEffect, useRef } from "react";
import { motion as Motion } from "framer-motion";
import { X } from "lucide-react";
import { InfoTip } from "./InfoTip.jsx";
import { EXIT, SPRING_UI } from "./motion.js";

export const IconButton = ({ label, children, className = "", ...props }) => (
  <button type="button" className={`vr-icon ${className}`} aria-label={label} title={label} {...props}>
    {children}
  </button>
);

// Fenêtre modale. Le fond s'assombrit seul (opacité, sans mouvement) ; la fenêtre, à pleine
// opacité, arrive en ressort et repart en se refermant vers le haut. Monter dans <AnimatePresence>.
export function Modal({ title, subtitle, info, onClose, children, wide = false }) {
  const container = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...container.current.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
      ),
    ];
    // Champ déjà focalisé par autoFocus (React ne pose pas l'attribut) : on le garde ;
    // sinon le premier élément du contenu, jamais le (i) ni la croix de l'en-tête.
    if (!container.current.contains(document.activeElement))
      (focusable().find((el) => !el.closest("header")) || focusable()[0])?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const el = container.current;
    el.addEventListener("keydown", trap);
    return () => {
      el.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="vr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Motion.div
        className="vr-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.18 } }}
        exit={{ opacity: 0, transition: EXIT }}
      />
      <Motion.section
        ref={container}
        className={`vr-dialog ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        initial={{ y: 28, scale: 0.985, clipPath: "inset(0% 0% 0% 0% round 16px)" }}
        animate={{ y: 0, scale: 1, transition: SPRING_UI }}
        exit={{ y: -8, clipPath: "inset(0% 0% 100% 0% round 16px)", transition: EXIT }}
      >
        <header>
          <div>
            <h2>{title}{info && <InfoTip label={`À propos : ${title}`}>{info}</InfoTip>}</h2>
            {subtitle && <div className="vr-dialog-subtitle">{subtitle}</div>}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </Motion.section>
    </div>
  );
}
