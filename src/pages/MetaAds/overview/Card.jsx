// src/pages/MetaAds/overview/Card.jsx — briques visuelles de la vue d'ensemble.
//
// Une carte blanche à coins doux sur le bleu clair Owner, un titre navy, un
// sous-titre discret, et des barres horizontales navy / vert pour lire une
// répartition d'un coup d'œil. Les entrées sont animées à l'arrivée dans le
// viewport, avec un léger décalage entre cartes.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fmtShare } from '../theme.js';

export const EASE = [0.22, 1, 0.36, 1];

export function Card({ T, title, subtitle, right, children, index = 0, style, minHeight }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.42, delay: 0.05 * index, ease: EASE }}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow,
        padding: '18px 20px 20px', minHeight, display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}
    >
      {(title || right) && (
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: T.text }}>{title}</h3>}
            {subtitle && <div style={{ marginTop: 3, fontSize: 12.5, color: T.textFaint }}>{subtitle}</div>}
          </div>
          {right && <div style={{ flexShrink: 0 }}>{right}</div>}
        </header>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </motion.section>
  );
}

/** Barre horizontale de part : `share` entre 0 et 1, couleur navy par défaut. */
export function ShareBar({ T, share, color, height = 8, delay = 0 }) {
  const reduce = useReducedMotion();
  const w = Math.max(0, Math.min(1, share || 0));
  return (
    <div style={{ height, borderRadius: 99, background: T.navySoft, overflow: 'hidden' }}>
      <motion.div
        initial={reduce ? { scaleX: w } : { scaleX: 0 }}
        whileInView={{ scaleX: w }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay, ease: EASE }}
        style={{ height: '100%', width: '100%', transformOrigin: 'left center', borderRadius: 99, background: color || T.navy }}
      />
    </div>
  );
}

/** Ligne « libellé · valeur · barre » utilisée par les classements (régions, formats, placements). */
export function RankedRow({ T, label, sub, value, share, color, index = 0 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 14px', padding: '9px 0', borderTop: index ? `1px solid ${T.borderSoft}` : 'none' }}>
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: T.textFaint, whiteSpace: 'nowrap' }}>{sub}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{value}</span>
        <span style={{ fontSize: 12, color: T.textFaint, minWidth: 44, textAlign: 'right' }}>{fmtShare(share)}</span>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><ShareBar T={T} share={share} color={color} delay={0.04 * index} /></div>
    </div>
  );
}

export function Legend({ T, items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12, color: T.textMuted }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: it.round ? 99 : 3, background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function Empty({ T, children }) {
  return <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 13, color: T.textFaint }}>{children}</div>;
}
