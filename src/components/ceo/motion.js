// Réglages de mouvement du dashboard CEO. Trois temps distincts, jamais une durée
// uniforme : une ENTRÉE est un ressort avec un léger dépassement (amortissement 26,
// il se sent sans se voir), un DÉPLACEMENT se fait à pleine opacité (c'est le
// mouvement qui raconte), une SORTIE est sèche et rapide (on ne fait pas rebondir
// ce qui s'en va). Les éléments d'un même bloc entrent décalés de ~70 ms.
import { useReducedMotion } from 'framer-motion';

export const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 };
export const SPRING_POP = { type: 'spring', stiffness: 420, damping: 22, mass: 0.7 };
export const SPRING_SLIDE = { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 };
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_IN = [0.4, 0, 1, 1];
export const DRY_EXIT = { duration: 0.15, ease: EASE_IN };
export const STAGGER = 0.07;
// Un repère réagit ~140 ms après la valeur qu'il commente : le regard suit.
export const FOLLOW_DELAY = 0.14;

// L'élément monte de 14 px sur un ressort ; l'opacité, elle, est réglée en 140 ms :
// il est visible sur l'essentiel de sa course, il ne « sort pas de nulle part ».
export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ...SPRING, opacity: { duration: 0.14, ease: 'linear' } } },
};
export const still = { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } };
export const cascade = (stagger = STAGGER, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});
const NO_CASCADE = { hidden: {}, show: {} };

// Un seul point d'entrée pour respecter « réduire les animations » : tout devient
// statique, aucun composant n'a à le gérer seul.
export function useMotionPrefs() {
  const reduce = !!useReducedMotion();
  return {
    reduce,
    item: reduce ? still : rise,
    list: (stagger, delay) => (reduce ? NO_CASCADE : cascade(stagger, delay)),
  };
}
