import { AnimatePresence, motion as Motion } from "framer-motion";
import { EXIT, SPRING_READ } from "./motion.js";

const offset = (axis, sign) => (axis === "x" ? { x: `${sign * 100}%` } : { y: `${sign * 100}%` });
const variants = {
  enter: ({ axis, direction }) => offset(axis, direction),
  center: ({ delay }) => ({ x: 0, y: 0, transition: { ...SPRING_READ, delay } }),
  exit: ({ axis, direction, delay }) => ({ ...offset(axis, -direction), transition: { ...EXIT, delay } }),
};

// Remplacement d'une valeur dans une fenêtre fermée (overflow: hidden) : l'ancienne sort
// par un bord pendant que la nouvelle entre par l'autre, les deux à pleine opacité.
// `id` change → animation ; même id → rien ne bouge. direction : 1 = vers le bas/la droite.
export function Slide({ id, children, axis = "y", direction = 1, delay = 0, align = "start", className = "" }) {
  const custom = { axis, direction: direction < 0 ? -1 : 1, delay };
  return (
    <span className={`vr-slide ${align} ${className}`}>
      <AnimatePresence initial={false} custom={custom}>
        <Motion.span key={id} className="vr-slide-item" custom={custom} variants={variants} initial="enter" animate="center" exit="exit">
          {children ?? id}
        </Motion.span>
      </AnimatePresence>
    </span>
  );
}
