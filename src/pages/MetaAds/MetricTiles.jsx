// src/pages/MetaAds/MetricTiles.jsx — les métriques de la période, à cocher.
//
// Comme dans Search Console : chaque tuile porte le total de la période ; les
// tuiles cochées se remplissent de la couleur de leur série et tracent la
// courbe du dessous (quatre au plus). Sous le total, l'écart avec la période
// précédente de même durée, en vert ou rouge selon le sens du bien.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Pict from './icons.jsx';
import { CountUp, EASE } from './motion.jsx';

function Delta({ current, previous, goodWhenDown, onColor, T }) {
  if (previous == null || current == null || !previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) return null;
  const flat = Math.abs(pct) < 1;
  const up = pct > 0;
  const good = flat ? null : (goodWhenDown ? !up : up);
  const color = onColor ? (T.isDark ? 'rgba(32,33,36,0.75)' : 'rgba(255,255,255,0.85)') : flat ? T.textFaint : good ? T.green : T.red;
  return <span title="par rapport à la période précédente de même durée" style={{ fontSize: 11.5, color, fontVariantNumeric: 'tabular-nums' }}>{flat ? 'stable' : `${up ? '↑' : '↓'} ${Math.abs(pct).toFixed(0)} %`}</span>;
}

export default function MetricTiles({ T, metrics, values, previous, selected, onToggle }) {
  const reduce = useReducedMotion();
  return (
    <div style={{ display: 'grid', gap: 0, gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.surface }}>
      {metrics.map((m, i) => {
        const on = selected.includes(m.key);
        const v = values?.[m.key];
        const p = previous?.[m.key];
        const ink = on ? (T.isDark ? '#202124' : '#ffffff') : T.text;
        const inkSoft = on ? (T.isDark ? 'rgba(32,33,36,0.72)' : 'rgba(255,255,255,0.92)') : T.textMuted;
        return (
          <motion.button key={m.key} type="button" onClick={() => onToggle(m.key)} aria-pressed={on} title={on ? 'Retirer de la courbe' : 'Tracer sur la courbe'}
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.03 * i, ease: EASE }}
            style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px 11px', minWidth: 0, border: 'none', fontFamily: 'inherit',
              borderLeft: i ? `1px solid ${on ? 'rgba(255,255,255,0.25)' : T.borderSoft}` : 'none',
              background: on ? m.color : T.surface, color: ink, transition: 'background 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 500, color: inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${on ? ink : T.textFaint}`, background: on ? ink : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5" /></svg>}
              </span>
              {m.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 500, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {typeof v === 'number' && Number.isFinite(v) ? <CountUp value={v} format={m.fmt} /> : (v ?? '—')}
            </div>
            <div style={{ marginTop: 5, minHeight: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Delta current={v} previous={p} goodWhenDown={m.goodWhenDown} onColor={on} T={T} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
