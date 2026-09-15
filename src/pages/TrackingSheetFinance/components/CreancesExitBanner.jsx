// Masquage réversible des liquidations dans « Créances antérieures ».
// Le choix ne modifie ni l'état du client, ni ses créances.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

const AMBER = '#b45309';
const AMBER_BG = '#fff8ed';
const AMBER_BORDER = '#f5dcb5';

export default function CreancesExitBanner({ count, hidden, onToggle }) {
  const VisibilityIcon = hidden ? EyeOff : Eye;
  return (
    <AnimatePresence initial={false}>
      {(count > 0 || hidden) && (
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
            <VisibilityIcon size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: '1 1 320px' }}>
              <strong>{count} client{count !== 1 ? 's' : ''} en liquidation</strong>
              {hidden ? ` masqué${count !== 1 ? 's' : ''} dans cette vue.` : ' avec des créances antérieures.'}
              <span style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
                Liquidations en cours incluses. Les créances restent enregistrées.
              </span>
            </span>
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={hidden}
              style={{
                border: `1px solid ${hidden ? AMBER : AMBER_BORDER}`,
                background: hidden ? AMBER : '#fff',
                color: hidden ? '#fff' : AMBER,
                borderRadius: 999, padding: '4px 12px',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', whiteSpace: 'normal', textAlign: 'center',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
            >
              {hidden ? 'Réafficher les clients en liquidation' : 'Masquer tous les clients en liquidation'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
