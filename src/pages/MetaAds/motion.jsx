// src/pages/MetaAds/motion.jsx — primitives animées de la page Meta Ads.
//
// Un compteur qui monte jusqu'à sa valeur, un anneau qui se trace, un
// entonnoir dont les barres poussent, une courbe qui se dessine. Toutes
// respectent `prefers-reduced-motion` et la même courbe d'ease que la page.

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1];
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Nombre animé de 0 (ou de la valeur précédente) vers `value`, formaté par
 * `format`. Se déclenche à l'entrée dans le viewport, une seule fois.
 */
export function CountUp({ value, format = (v) => String(Math.round(v)), duration = 0.9, style, className }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 400); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (value == null || !Number.isFinite(Number(value))) return undefined;
    if (reduce) { setShown(value); return undefined; }
    if (!inView && !armed) return undefined;
    const start = performance.now();
    const a = from.current;
    const b = Number(value);
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      setShown(a + (b - a) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    // Filet : si les images d'animation ne sont pas rendues (onglet caché, rendu
    // sans écran), la valeur finale s'affiche quand même à la fin de la durée.
    const settle = setTimeout(() => { setShown(b); from.current = b; }, duration * 1000 + 80);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [value, inView, armed, reduce, duration]);
  if (value == null || !Number.isFinite(Number(value))) return <span ref={ref} style={style} className={className}>—</span>;
  return <span ref={ref} style={style} className={className}>{format(shown)}</span>;
}

/** Anneau de progression : `value` entre 0 et 1, trait qui se trace à l'arrivée. */
export function Ring({ value = 0, size = 44, stroke = 4, color, track, label, sub, T, delay = 0 }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || T?.navySoft || 'rgba(0,0,0,0.08)'} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || T?.green || '#3e7d5a'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={reduce ? { strokeDashoffset: c * (1 - v) } : { strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - v) }} viewport={{ once: true }} transition={{ duration: 0.9, delay, ease: EASE }} />
      </svg>
      {(label != null) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: size >= 60 ? 16 : 11.5, fontWeight: 500, color: T?.text, fontVariantNumeric: 'tabular-nums' }}>{label}</span>
          {sub && <span style={{ fontSize: 9.5, color: T?.textFaint, marginTop: 2 }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Entonnoir horizontal : étapes `[{ label, value }]`, barres proportionnelles
 * à la première étape, taux de passage entre les étapes.
 */
export function Funnel({ steps, T, compact = false, delay = 0 }) {
  const reduce = useReducedMotion();
  const base = Math.max(1, steps[0]?.value || 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'auto minmax(0, 1fr) auto' : 'minmax(84px, auto) minmax(0, 1fr) auto auto', gap: compact ? '5px 8px' : '7px 10px', alignItems: 'center' }}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const rate = prev ? s.value / prev : null;
        const w = Math.max(0.02, (s.value || 0) / base);
        return (
          <React.Fragment key={s.label}>
            <span style={{ fontSize: compact ? 11 : 12, color: T.textMuted, whiteSpace: 'nowrap' }}>{s.label}</span>
            <div style={{ height: compact ? 8 : 10, borderRadius: 99, background: T.track, overflow: 'hidden' }}>
              <motion.div initial={reduce ? { scaleX: w } : { scaleX: 0 }} whileInView={{ scaleX: w }} viewport={{ once: true }}
                transition={{ duration: 0.7, delay: delay + i * 0.06, ease: EASE }}
                style={{ height: '100%', borderRadius: 99, transformOrigin: 'left center', background: i === steps.length - 1 ? T.green : T.primary, opacity: i === steps.length - 1 ? 1 : 1 - i * 0.18 }} />
            </div>
            <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 600, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 26 }}>{s.value ?? '—'}</span>
            {!compact && <span style={{ fontSize: 11, color: T.textFaint, textAlign: 'right', minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>{rate == null ? '' : `${Math.round(rate * 100)} %`}</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Courbe SVG minimale (sparkline) qui se dessine à l'arrivée. */
export function Spark({ values, width = 120, height = 32, color, T, fill = true }) {
  const reduce = useReducedMotion();
  const v = (values || []).map((x) => Number(x) || 0);
  if (v.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...v, 1);
  const pts = v.map((y, i) => [(i / (v.length - 1)) * (width - 2) + 1, height - 2 - (y / max) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const stroke = color || T?.green || '#3e7d5a';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {fill && <path d={area} fill={stroke} opacity="0.12" />}
      <motion.path d={d} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE }} />
    </svg>
  );
}

/** Pastille de recommandation / statut. */
export function Pill({ children, color, bg, T, size = 'sm', style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '3px 9px' : '5px 11px', borderRadius: 99,
      fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: 500, color: color || T?.textMuted, background: bg || T?.surfaceAlt, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}
