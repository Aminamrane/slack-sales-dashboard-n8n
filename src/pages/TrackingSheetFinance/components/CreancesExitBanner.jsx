// CreancesExitBanner.jsx — alerte du filtre « Créances antérieures ».
//
// Règle dev 2026-09-03 : un client en liquidation ou en résiliation ne sort
// pas des créances antérieures tant qu'elles n'ont pas été récupérées ou
// passées en perte. « Il ne faut pas les invisibiliser, au contraire : on
// devrait avoir une alerte. » Ce bandeau compte ces clients et permet de ne
// voir qu'eux, le temps de les traiter depuis leur fiche (Sortie client).

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';

const AMBER = '#b45309';
const AMBER_BG = '#fff8ed';
const AMBER_BORDER = '#f5dcb5';

export default function CreancesExitBanner({ count, only, onToggle }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.div
          key="creances-exit"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '9px 12px', borderRadius: 9,
            background: AMBER_BG, border: `1px solid ${AMBER_BORDER}`,
            color: AMBER, fontSize: 12.5, lineHeight: 1.45,
          }}>
            <TriangleAlert size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: '1 1 320px' }}>
              <strong>{count} client{count > 1 ? 's' : ''}</strong> en liquidation ou en
              résiliation {count > 1 ? 'ont' : 'a'} encore des créances antérieures non
              soldées. {count > 1 ? 'Ils restent' : 'Il reste'} ici tant que la sortie client
              n’est pas actée : à récupérer, ou à passer en perte.
            </span>
            <button
              type="button"
              onClick={onToggle}
              style={{
                border: `1px solid ${only ? AMBER : AMBER_BORDER}`,
                background: only ? AMBER : '#fff',
                color: only ? '#fff' : AMBER,
                borderRadius: 999, padding: '4px 12px',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
            >
              {only ? 'Voir toutes les créances' : 'Ne voir que ces clients'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
