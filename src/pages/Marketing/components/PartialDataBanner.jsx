import React from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';

/**
 * Discrete amber banner shown when the overview endpoint flags
 * `_partial: true` — typically one of the parallel legs (leadScores,
 * leads, stats) failed. We don't crash the page : the rest of the
 * dashboard renders fine, the banner just hints at degraded data.
 */
export default function PartialDataBanner({ errors = [], C }) {
  if (!errors || errors.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '12px 18px',
        background: C.amber.bg,
        border: `1px solid ${C.amber.strong}33`,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber.fg} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber.fg }}>
          Données partielles
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: C.amber.fg, fontWeight: 500, opacity: 0.9 }}>
          {errors.length === 1
            ? `Une jambe de l'agrégateur a échoué : ${errors[0]}.`
            : `${errors.length} jambes ont échoué : ${errors.join(', ')}.`}
          {' '}Le reste de la vue reste à jour.
        </div>
      </div>
    </motion.div>
  );
}
