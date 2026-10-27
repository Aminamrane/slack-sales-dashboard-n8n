import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_OUT, FOLLOW_DELAY, SPRING, SPRING_POP, SPRING_SLIDE, useMotionPrefs } from './motion.js';

// ── Formats ───────────────────────────────────────────────────────────────────
export const intFr = (v) => (v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v));
export const euro = (v) => (v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v)).replace(/\u202f/g, '\u00a0'));
export const euroCents = (v) => (v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(v)).replace(/\u202f/g, '\u00a0'));
// 3 918 987 € se lit « 3,92 M€ » d'un coup d'œil ; le montant exact reste en légende.
export const compactEuro = (v) => (v == null ? '—' : v >= 1e6 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v / 1e6)} M€`
  : v >= 1e3 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v / 1e3)} k€` : euro(v));
export const nf = (v, digits = 1) => (v == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(v));
export const plural = (n, one, many) => (n > 1 ? many : one);

// ── Chiffre qui arrive ────────────────────────────────────────────────────────
// Pas de compteur : le chiffre ARRIVE, à pleine opacité, par glissement dans une
// fenêtre masquée (il monte depuis le bas et se pose sur un ressort dosé) ; quand sa
// valeur change, l'ancienne sort par le haut pendant que la nouvelle entre par le bas.
// La fenêtre a la largeur et la hauteur de la valeur finale (texte fantôme) : rien ne
// bouge autour. `delay` décale les chiffres d'une même carte (~70 ms entre eux).
function useInViewOnce(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

const ARRIVE = {
  initial: { y: '115%' },
  enter: { y: '0%', transition: SPRING_SLIDE },
  exit: { y: '-115%', transition: { ...SPRING_SLIDE, damping: 30 } },
};

export function Numeral({ value, format = intFr, className = '', unit, delay = 0 }) {
  const ref = useRef(null);
  const seen = useInViewOnce(ref);
  const { reduce } = useMotionPrefs();
  const text = value == null ? '—' : format(value);
  const still = reduce || !seen;
  return (
    <span ref={ref} className={`an-numeral${className ? ` ${className}` : ''}`} aria-label={value == null ? undefined : `${text}${unit ? ` ${unit}` : ''}`}>
      <span className="an-numeral-slot" aria-hidden="true">
        <span className="an-numeral-ghost">{text}</span>
        <AnimatePresence initial={false}>
          <motion.span
            key={text}
            className="an-numeral-live"
            variants={ARRIVE}
            initial={still ? false : 'initial'}
            animate={still ? { y: seen ? '0%' : '115%' } : 'enter'}
            exit={reduce ? undefined : 'exit'}
            transition={{ ...SPRING_SLIDE, delay }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      {value != null && unit && <span className="an-unit">{unit}</span>}
    </span>
  );
}

// ── Lectures alternées ────────────────────────────────────────────────────────
// Deux lectures d'un même chiffre (le cumul, puis le mois) se relaient toutes les
// 6 s : le temps de lire. Elles coexistent le temps du passage, à PLEINE opacité :
// l'ancienne monte et sort du cadre pendant que la nouvelle arrive par le bas.
// Le cadre est masqué, donc on voit un mouvement continu, pas une apparition.
// Au survol on revient sur la première lecture, celle qui porte le titre.
const SLIDE = {
  initial: { y: '112%' },
  enter: { y: '0%', transition: SPRING_SLIDE },
  exit: { y: '-112%', transition: { ...SPRING_SLIDE, damping: 30 } },
};
export function ReadingSwap({ readings, render, height, paused = false, interval = 6000, gutter = 10 }) {
  const list = Array.isArray(readings) && readings.length > 1 ? readings : null;
  // Tant que la donnée manque, la lecture est un tiret ; à son arrivée, la clé change et le
  // chiffre glisse en place (même mouvement que le relais des lectures).
  const loaded = Array.isArray(readings) && readings.some((r) => r && r.value != null);
  const [i, setI] = useState(0);
  const { reduce } = useMotionPrefs();
  useEffect(() => {
    if (!list || paused || reduce) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), interval);
    return () => clearInterval(id);
  }, [list, paused, reduce, interval]);
  const shown = list ? (paused || reduce ? 0 : i % list.length) : 0;
  const current = list ? list[shown] : (readings?.[0] ?? null);
  return (
    <div className="an-reading" style={{ height, marginLeft: -gutter, marginRight: -gutter }}>
      <AnimatePresence initial={false}>
        <motion.div key={`${loaded ? 'd' : 'l'}-${shown}`} variants={reduce ? undefined : SLIDE} initial="initial" animate="enter" exit="exit" style={{ position: 'absolute', left: gutter, right: gutter, top: 0 }}>
          {render(current, shown)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Courbe de tendance ────────────────────────────────────────────────────────
// Aire calée en bas, lissée (Catmull-Rom → Bézier) : elle donne la trajectoire,
// pas un chiffre. Elle se trace de gauche à droite, puis le repère du mois courant
// se pose, 140 ms après, là où la courbe finit : le regard suit.
const SW = 320, SH = 64;
function sparkPaths(values) {
  if (!Array.isArray(values) || values.length < 2) return { line: '', area: '', last: null };
  const max = Math.max(...values, 1);
  const pad = 7;
  const tail = SW * 0.04;
  const step = (SW - tail * 2) / Math.max(values.length - 1, 1);
  const y = (v) => SH - pad - (v / max) * (SH - pad * 2);
  const pts = values.map((v, i) => [tail + i * step, y(v)]);
  let line = `M 0 ${pts[0][1].toFixed(1)} L ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` L ${SW} ${last[1].toFixed(1)}`;
  return { line, area: `${line} L ${SW} ${SH} L 0 ${SH} Z`, last };
}

export function Spark({ values, color = 'currentColor', height = 56, className = '' }) {
  const { line, area, last } = useMemo(() => sparkPaths(values), [values]);
  const { reduce } = useMotionPrefs();
  if (!line) return null;
  return (
    <div className={`an-spark${reduce ? ' is-still' : ''} ${className}`} style={{ height }} aria-hidden="true">
      <svg width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none">
        {/* Aplat, pas de dégradé : une aire qui se dissout donne une tache, pas une surface. */}
        <path d={area} fill={color} fillOpacity="0.14" />
        <path className="an-spark-line" d={line} fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {last && (
        <svg className="an-spark-marker-layer" width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none">
          <circle className="an-spark-marker" cx={last[0]} cy={last[1]} r="3.4" fill={color} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

// ── Jauge de rythme ───────────────────────────────────────────────────────────
// Trois couches sur une même piste : l'ombre bleu clair = ce qu'on devrait avoir
// reçu à cette date (rythme calendaire), la barre marine = ce qu'on a reçu, la zone
// hachurée = l'écart (rouille en retard, vert en avance). Le repère daté se pose
// 140 ms après la barre, la hachure apparaît ensuite : le regard suit l'ordre de
// lecture. La couleur d'alerte ne colore jamais la barre entière.
export function PaceGauge({ ratio, benchmark, tone = 'neutral', markLabel, leftLabel, rightLabel }) {
  const { reduce } = useMotionPrefs();
  const pct = ratio == null ? 0 : Math.min(1, Math.max(0, ratio / 100));
  const pace = benchmark == null ? null : Math.min(1, Math.max(0, benchmark / 100));
  const gapFrom = pace == null ? 0 : Math.min(pct, pace);
  const gapTo = pace == null ? 0 : Math.max(pct, pace);
  const ahead = pace != null && pct > pace;
  const t = (delay, extra = {}) => (reduce ? { duration: 0 } : { ...SPRING, delay, ...extra });
  return (
    <div className={`an-pace an-pace--${tone}`}>
      <div className="an-pace-track" role="img" aria-label={[leftLabel, rightLabel].filter(Boolean).join(' · ')}>
        {pace != null && <motion.div className="an-pace-ghost" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: pace }} viewport={{ once: true, amount: 0.6 }} transition={t(FOLLOW_DELAY)} />}
        <motion.div className="an-pace-fill" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: pct }} viewport={{ once: true, amount: 0.6 }} transition={t(0)} />
        {pace != null && gapTo - gapFrom > 0.005 && (
          <motion.div className={`an-pace-gap${ahead ? ' is-ahead' : ''}`} style={{ left: `${gapFrom * 100}%`, width: `${(gapTo - gapFrom) * 100}%` }} initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.6 }} transition={reduce ? { duration: 0 } : { duration: 0.35, delay: FOLLOW_DELAY * 2 + 0.35 }} />
        )}
        {pace != null && (
          <motion.div className="an-pace-mark" style={{ left: `${pace * 100}%` }} initial={reduce ? false : { scaleY: 0, opacity: 0 }} whileInView={{ scaleY: 1, opacity: 1 }} viewport={{ once: true, amount: 0.6 }} transition={reduce ? { duration: 0 } : { ...SPRING_POP, delay: FOLLOW_DELAY + 0.3, opacity: { duration: 0.1, delay: FOLLOW_DELAY + 0.3 } }} aria-hidden="true">
            {markLabel && <span className="an-pace-mark-label">{markLabel}</span>}
          </motion.div>
        )}
      </div>
      <div className="an-pace-legend">
        <span className="an-pace-legend-left">{leftLabel}</span>
        {rightLabel && <span className="an-pace-legend-right">{rightLabel}</span>}
      </div>
    </div>
  );
}

// Part d'un total : un pourcentage avec sa barre (ex. « 38 % des comptes revenus »).
export function Share({ part, total, label, tone = 'good' }) {
  const { reduce } = useMotionPrefs();
  if (part == null || !total) return null;
  const pct = Math.round((part / total) * 100);
  return (
    <div className={`an-share an-share--${tone}`}>
      <div className="an-share-track" role="img" aria-label={`${pct} % ${label}`}>
        <motion.div className="an-share-fill" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: Math.min(1, part / total) }} viewport={{ once: true, amount: 0.6 }} transition={reduce ? { duration: 0 } : { duration: 1.1, ease: EASE_OUT, delay: 0.2 }} />
      </div>
      <span><strong>{pct} %</strong> {label}</span>
    </div>
  );
}

// ── Pictogrammes des statuts ──────────────────────────────────────────────────
// Dessinés ici, bicolores : un chronomètre (couronne, cadran teinté, aiguille) dont
// le secteur rempli dit le temps consommé par rapport au rythme : un quart pour
// « au rythme », la moitié pour « à renforcer », presque le tour pour « sous le rythme ».
const CX = 12, CY = 13.6, R = 7.4;
const polar = (deg) => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)];
const wedge = (sweep) => {
  if (!sweep) return '';
  const [x1, y1] = polar(-90);
  const [x2, y2] = polar(-90 + sweep);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
};
const STATUS_SWEEP = { good: 80, watch: 160, behind: 275, neutral: 0 };
export function StatusGlyph({ tone = 'neutral', size = 18 }) {
  const sweep = STATUS_SWEEP[tone] ?? 0;
  const [hx, hy] = polar(-90 + (sweep || 0));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9.8" y="1.2" width="4.4" height="2.4" rx=".8" fill="currentColor" />
      <path d="M12 3.6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.3 6.4l1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={R} fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="1.8" />
      {sweep > 0 && <path d={wedge(sweep)} fill="currentColor" fillOpacity=".3" />}
      <line x1={CX} y1={CY} x2={hx.toFixed(2)} y2={hy.toFixed(2)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="1.4" fill="currentColor" />
    </svg>
  );
}

// ── Carte de statut ───────────────────────────────────────────────────────────
// Un verdict et son chiffre, dans une carte teintée : badge rond à gauche avec le
// pictogramme du ton, libellé en gras dans la couleur, valeur à droite. La couleur
// d'alerte vit ici, et seulement ici. Entre sur un ressort, badge compris.
export function StatusCard({ tone = 'neutral', label, value, delay = 0.9, className = '' }) {
  const { reduce } = useMotionPrefs();
  return (
    <motion.div
      className={`an-status an-status--${tone}${className ? ` ${className}` : ''}`}
      initial={reduce ? false : { opacity: 0, scale: 0.92, y: 6 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={reduce ? { duration: 0 } : { ...SPRING_POP, delay, opacity: { duration: 0.12, delay } }}
      role="status"
    >
      <motion.span
        className="an-status-badge"
        aria-hidden="true"
        initial={reduce ? false : { scale: 0.6, rotate: -18 }}
        whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={reduce ? { duration: 0 } : { ...SPRING_POP, delay: delay + 0.08 }}
      >
        <StatusGlyph tone={tone} size={24} />
      </motion.span>
      <span className="an-status-label">{label}</span>
      {value != null && <span className="an-status-value">{value}</span>}
    </motion.div>
  );
}

// ── Pastille ──────────────────────────────────────────────────────────────────
// Contour fin dans la teinte, fond très léger, texte coloré, pictogramme filaire à
// gauche : une seule famille pour les états, les mois et les retards. Sur le panneau
// lapis, la pastille devient translucide (variante CSS .an-chip--onlapis).
export function Chip({ tone = 'neutral', icon: Icon, children, className = '', title }) {
  return (
    <span className={`an-chip an-chip--${tone}${className ? ` ${className}` : ''}`} title={title}>
      {Icon && <Icon size={13} strokeWidth={2.2} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
