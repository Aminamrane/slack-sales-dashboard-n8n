import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion, useIsPresent, useReducedMotion } from "framer-motion";
import { GLIDE, HEIGHT, ROLL } from "./motion.js";

// Un roulement n'anime que son axe, toujours en % (aucune conversion d'unité) : l'autre axe
// n'est jamais touché, donc aucune vitesse ne s'y applique.
const at = (axis, percent) => ({ [axis]: `${percent}%` });
const rollVariants = {
  enter: ({ axis, direction }) => at(axis, direction * 100),
  center: ({ axis, transition }) => ({ ...at(axis, 0), transition }),
  exit: ({ axis, direction, transition }) => ({ ...at(axis, -direction * 100), transition }),
};

function RollItem({ custom, children }) {
  const present = useIsPresent();
  return (
    <Motion.span className={`vr-roll-item ${present ? "" : "vr-roll-exiting"}`} custom={custom} variants={rollVariants}
      initial="enter" animate="center" exit="exit">
      {children}
    </Motion.span>
  );
}

// Valeur qui roule dans sa fenêtre (overflow: hidden, hauteur de la ligne + jambages) :
// l'ancienne sort par un bord pendant que la nouvelle entre par l'autre, à pleine opacité,
// sur la même courbe : elles restent bord à bord, jamais superposées.
// `sizers` : contenus qui fixent la largeur de la fenêtre (libellé le plus long).
export function Roll({ id, children, axis = "y", direction = 1, transition = ROLL, align = "start", sizers, className = "" }) {
  const reduce = useReducedMotion();
  const custom = { axis, direction: direction < 0 ? -1 : 1, transition };
  return (
    <span className={`vr-roll ${axis} ${align} ${className}`}>
      {sizers?.map((s) => <span key={s} className="vr-roll-sizer" aria-hidden="true">{s}</span>)}
      {reduce ? (
        <span className="vr-roll-item">{children ?? id}</span>
      ) : (
        <AnimatePresence initial={false} custom={custom}>
          <RollItem key={id} custom={custom}>{children ?? id}</RollItem>
        </AnimatePresence>
      )}
    </span>
  );
}

// Remplacement net : l'ancien contenu disparaît dans l'image même, le nouveau est là, à pleine
// opacité, décalé de quelques pixels, et glisse à sa place. Aucune fenêtre : rien n'est coupé.
export function Glide({ id, from, delay = 0, as = "span", className = "", children }) {
  const reduce = useReducedMotion();
  const Tag = as === "div" ? Motion.div : Motion.span;
  return (
    <Tag key={id} className={`vr-glide ${className}`} initial={reduce || !from ? false : from}
      animate={{ x: 0, y: 0, transition: { ...GLIDE, delay } }}>
      {children}
    </Tag>
  );
}

// Hauteur qui suit son contenu en ressort (le tableau grandit ou se resserre sans à-coup).
export function AutoHeight({ className = "", children }) {
  const inner = useRef(null);
  const [height, setHeight] = useState("auto");
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduce]);
  // Mouvement réduit : hauteur naturelle, sans aucune image de décalage.
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <Motion.div className={`vr-autoheight ${className}`} initial={false} animate={{ height }} transition={HEIGHT}>
      <div ref={inner}>{children}</div>
    </Motion.div>
  );
}
