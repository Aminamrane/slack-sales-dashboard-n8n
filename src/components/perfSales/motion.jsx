import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';

// Primitives de mouvement de la Performance Sales (dev 14/10/2026) : chiffres qui défilent, jauges en anneau, et la
// chorégraphie de la page (« tout doit être motion design, automatique, satisfaisant à regarder ») : chaque section se
// révèle quand elle entre dans l'écran, ses éléments suivent en cascade, et ses chiffres, anneaux et barres ne démarrent
// qu'à ce moment-là. Une seule courbe pour toute la page (sortie douce, sans rebond) ; tout s'arrête net si l'utilisateur
// réduit les animations.
export const EASE = [0.22, 1, 0.36, 1];
export const EASE_CSS = 'cubic-bezier(.22, 1, .36, 1)';

const easeOut = (t) => 1 - Math.pow(1 - t, 4);
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Section révélée ou non : vrai par défaut (un composant hors d'une section s'anime dès son affichage).
const RevealContext = createContext(true);
export const useRevealed = () => useContext(RevealContext);

// Vrai dès que l'élément a été vu une fois (au moins `amount` de sa hauteur dans l'écran).
export function useInViewOnce(ref, amount = 0.15) {
  const [seen, setSeen] = useState(() => reducedMotion() || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    }, { threshold: amount });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen, amount, ref]);
  return seen;
}

// Bloc HTML ordinaire (tableau, grille) révélé à l'entrée dans l'écran : il reçoit la classe `is-revealed`, que le CSS
// utilise pour lancer ses animations (lignes en cascade via la variable --i), et partage l'état avec ses enfants.
export function RevealBlock({ className = '', amount = 0.08, children, ...rest }) {
  const ref = useRef(null);
  const seen = useInViewOnce(ref, amount);
  return (
    <RevealContext.Provider value={seen}>
      <div ref={ref} className={`${className}${seen ? ' is-revealed' : ''}`} {...rest}>{children}</div>
    </RevealContext.Provider>
  );
}

// Élément d'une section révélée : il monte de 14 px et apparaît, à son tour dans la cascade.
export const ITEM = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// Section qui se révèle à l'entrée dans l'écran ; ses enfants à variantes (ITEM) suivent en cascade.
export function Reveal({ as = 'div', className, style, stagger = 0.07, delay = 0.05, amount, children, ...rest }) {
  const ref = useRef(null);
  const seen = useInViewOnce(ref, amount);
  const Tag = Motion[as];
  return (
    <RevealContext.Provider value={seen}>
      <Tag ref={ref} className={className} style={style} initial="hidden" animate={seen ? 'shown' : 'hidden'}
        variants={{
          hidden: { opacity: 0, y: 18 },
          shown: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE, staggerChildren: stagger, delayChildren: delay } },
        }} {...rest}>
        {children}
      </Tag>
    </RevealContext.Provider>
  );
}

// Valeur qui part de la précédente (0 au premier rendu) et rejoint la cible en `duration` ms.
export function useCountUp(target, { duration = 1100, delay = 0 } = {}) {
  const value = Number.isFinite(target) ? target : 0;
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) { setShown(value); from.current = value; return undefined; }
    let frame;
    const start = from.current;
    const begin = performance.now() + delay;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - begin) / duration));
      setShown(start + (value - start) * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = value; };
  }, [value, duration, delay]);
  return shown;
}

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('fr-FR'), duration, delay }) {
  const revealed = useRevealed();
  const shown = useCountUp(revealed ? value : 0, { duration, delay });
  return <span className="ps-num">{format(shown)}</span>;
}

// Anneau de progression : un seul arc (pathLength 100), tracé depuis midi dans le sens horaire.
export function Ring({ value, size = 64, stroke = 7, color, track, delay = 0, children, label }) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const drawn = useDrawn();
  const r = (size - stroke) / 2;
  return (
    <div className="ps-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          pathLength="100" strokeDasharray="100 100" strokeDashoffset={drawn ? 100 - pct : 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: `stroke-dashoffset 1200ms ${EASE_CSS} ${delay}ms` }} />
      </svg>
      <div className="ps-ring-center">{children}</div>
    </div>
  );
}

// Vrai une fois la section révélée, au rendu suivant : le passage de false à true déclenche les transitions CSS (barres,
// arcs). Ensuite il reste vrai : quand les données changent (onglet, mois), les barres glissent de l'ancienne valeur à la
// nouvelle au lieu de retomber à zéro.
export function useDrawn() {
  const revealed = useRevealed();
  const [drawn, setDrawn] = useState(reducedMotion());
  useEffect(() => {
    if (!revealed || drawn) return undefined;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [revealed, drawn]);
  return drawn;
}
