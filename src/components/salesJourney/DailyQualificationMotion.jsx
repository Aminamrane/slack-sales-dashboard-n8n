// Motion design du parcours « RDV à qualifier » (dev 14/10/2026 : « le bouton Commencer beaucoup plus motion design, et
// tout le parcours plus appliqué, pour que ce soit vraiment satisfaisant de faire la qualification »). Composants
// d'animation seulement : la logique reste dans DailyQualificationDeck. Tout se coupe si l'utilisateur réduit les
// animations.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion as Motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

const SPRING = { type: 'spring', stiffness: 420, damping: 26 };
const EASE = [0.22, 1, 0.36, 1];
const calm = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Bouton d'action principal : reflet qui passe, halo qui respire, flèche qui pousse au survol et s'élance au clic.
// `launch` : le clic fait d'abord partir la flèche, puis déclenche l'action (sensation de départ).
export function ActionButton({ children, onClick, disabled = false, busy = false, launch = false, className = '' }) {
  const [flying, setFlying] = useState(false);
  const wasDisabled = useRef(disabled);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (wasDisabled.current && !disabled) setPop((n) => n + 1);   // il devient actif : petit rebond
    wasDisabled.current = disabled;
  }, [disabled]);
  const click = () => {
    if (disabled || busy || flying) return;
    if (!launch || calm()) { onClick(); return; }
    setFlying(true);
    setTimeout(() => { setFlying(false); onClick(); }, 220);
  };
  return (
    <Motion.button type="button" className={`dq-action${disabled ? ' is-off' : ''}${busy ? ' is-busy' : ''} ${className}`} disabled={disabled || busy}
      onClick={click} initial="rest" animate={pop ? { scale: [1, 1.05, 1] } : 'rest'} whileHover={disabled ? undefined : 'hover'} whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.35, ease: EASE }} key={pop}>
      <span className="dq-action-shine" aria-hidden="true" />
      <span className="dq-action-label">{busy ? 'Enregistrement…' : children}</span>
      {!busy && (
        <Motion.span className="dq-action-arrow" aria-hidden="true" variants={{ rest: { x: 0 }, hover: { x: 4 } }} transition={SPRING}
          animate={flying ? { x: [0, 26], opacity: [1, 0] } : undefined}>
          <ArrowRight size={17} />
        </Motion.span>
      )}
      {busy && <span className="dq-action-spinner" aria-hidden="true" />}
    </Motion.button>
  );
}

// Nombre qui monte jusqu'à sa valeur.
export function CountUp({ value, duration = 0.7 }) {
  const mv = useMotionValue(calm() ? value : 0);
  const shown = useTransform(mv, (v) => Math.round(v).toLocaleString('fr-FR'));
  useEffect(() => {
    const controls = animate(mv, value, { duration: calm() ? 0 : duration, ease: EASE });
    return () => controls.stop();
  }, [mv, value, duration]);
  return <Motion.span>{shown}</Motion.span>;
}

// Une pastille par RDV : faite (verte, coche qui apparaît), en cours (marine, qui respire), à venir (grise).
export function ProgressSegments({ total, current, done }) {
  return (
    <div className="dq-segments" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => {
        const state = i < done ? 'is-done' : i === current - 1 ? 'is-current' : '';
        return (
          <span key={i} className={`dq-seg ${state}`}>
            <Motion.i initial={false} animate={{ scaleX: i < done ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} />
          </span>
        );
      })}
    </div>
  );
}

// Tampon de validation après l'enregistrement : cercle qui se dessine, coche, résultat choisi.
export function Stamp({ label }) {
  return (
    <AnimatePresence>
      {label && (
        <Motion.div className="dq-stamp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          <Motion.div className="dq-stamp-card" initial={{ scale: 0.7, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING}>
            <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <Motion.circle cx="27" cy="27" r="24" fill="none" stroke="#3e7d5a" strokeWidth="3.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: EASE }} />
              <Motion.path d="M17 28l7 7 13-15" fill="none" stroke="#3e7d5a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, delay: 0.25, ease: EASE }} />
            </svg>
            <b>{label}</b>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

// Fin du parcours (dev 14/10/2026 : « des confettis quand ils ont terminé, de plusieurs couleurs ; centré ») : deux
// canons multicolores tirent depuis les bords gauche et droit de l'écran vers le centre, puis une pluie légère tombe
// sur toute la largeur ; les confettis flottent (balancement, rotation 3D) et s'effacent. Canvas, une seule passe,
// en temps réel (même vitesse à 60 et 120 Hz).
const CONFETTI = ['#ff4d6d', '#ffb703', '#ffd60a', '#06d6a0', '#118ab2', '#8338ec', '#ff70a6', '#3e7d5a', '#4cc9f0', '#f77f00'];
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || calm()) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const parts = [];
    const piece = (extra) => ({
      size: 7 + Math.random() * 6, wobble: Math.random() * 10, wobbleSpeed: 0.05 + Math.random() * 0.06, tilt: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3, life: 0, color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      shape: Math.random() < 0.25 ? 'dot' : 'rect', ...extra,
    });
    const power = Math.min(70, Math.max(44, H / 13));
    const density = Math.min(1, W / 1200);   // un téléphone reçoit moins de confettis : le texte reste lisible
    const shoot = (side, n, strength) => {
      for (let i = 0; i < n; i += 1) {
        parts.push(piece({
          x: side < 0 ? -10 : W + 10, y: H * (0.6 + Math.random() * 0.1), v: strength * (0.45 + Math.random() * 0.6),
          angle: ((side < 0 ? -52 : -128) + (Math.random() * 48 - 24)) * (Math.PI / 180), fall: 2.6, sway: 0.9, ttl: 200 + Math.random() * 80,
        }));
      }
    };
    const rain = (n) => {
      for (let i = 0; i < n; i += 1) {
        const fall = 2.4 + Math.random() * 1.4;
        parts.push(piece({ x: Math.random() * W, y: -12 - Math.random() * 40, v: 0, angle: 0, fall, sway: 1.5, ttl: (H + 60) / fall }));
      }
    };
    shoot(-1, Math.round(80 * density), power); shoot(1, Math.round(80 * density), power);
    let raf = 0, last = performance.now(), clock = 0;
    const step = (now) => {
      const dt = Math.min(3, (now - last) / 16.67);
      last = now; clock += dt;
      if (clock < 50 && Math.random() < density) { shoot(-1, 2, power * 0.85); shoot(1, 2, power * 0.85); }
      if (clock > 20 && clock < 110 && Math.random() < density) rain(2);
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        p.life += dt;
        if (p.life > p.ttl || p.y > H + 20) continue;
        alive += 1;
        p.v *= 0.91 ** dt;
        p.wobble += p.wobbleSpeed * dt;
        p.tilt += p.spin * dt;
        p.x += (Math.cos(p.angle) * p.v + Math.cos(p.wobble) * p.sway) * dt;
        p.y += (Math.sin(p.angle) * p.v + p.fall) * dt;
        const fade = p.life / p.ttl;
        ctx.globalAlpha = fade < 0.75 ? 1 : 1 - (fade - 0.75) / 0.25;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt);
        ctx.scale(1, Math.abs(Math.sin(p.wobble)) * 0.75 + 0.25);
        if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (alive || clock < 110) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return createPortal(<canvas ref={ref} className="dq-confetti" aria-hidden="true" />, document.body);
}

export function Celebration({ total, children }) {
  return (
    <Motion.div className="dq-finale" initial="hidden" animate="shown" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}>
      <Confetti />
      <Motion.div className="dq-finale-check" variants={{ hidden: { scale: 0.4, opacity: 0 }, shown: { scale: 1, opacity: 1, transition: SPRING } }}>
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <Motion.circle cx="42" cy="42" r="38" fill="rgba(62,125,90,0.1)" stroke="#3e7d5a" strokeWidth="3.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.15 }} />
          <Motion.path d="M27 43.5l10 10L58 32" fill="none" stroke="#3e7d5a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, delay: 0.6, ease: EASE }} />
        </svg>
        <Motion.span className="dq-finale-ring" initial={{ scale: 0.8, opacity: 0.6 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.9, delay: 0.85, ease: 'easeOut' }} />
      </Motion.div>
      <Motion.h2 id="dq-title" variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}>
        <CountUp value={total} duration={0.8} /> rendez-vous qualifiés
      </Motion.h2>
      <Motion.p variants={{ hidden: { opacity: 0, y: 8 }, shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}>
        Vos setters et vos chiffres sont à jour.
      </Motion.p>
      <Motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}>{children}</Motion.div>
    </Motion.div>
  );
}

// Coche des cartes de choix, qui apparaît en tournant.
export function PickCheck({ on }) {
  return (
    <AnimatePresence>
      {on && (
        <Motion.span className="dq-pick-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, transition: { duration: 0.12 } }} transition={SPRING}>
          <Check size={13} strokeWidth={3} />
        </Motion.span>
      )}
    </AnimatePresence>
  );
}
