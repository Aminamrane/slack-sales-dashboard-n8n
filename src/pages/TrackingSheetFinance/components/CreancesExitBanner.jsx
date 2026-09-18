// Masquage réversible des liquidations dans « Créances antérieures ».
// Le choix ne modifie ni l'état du client, ni ses créances.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

// Gris de la page (mêmes valeurs que la palette N d'index.jsx, non exportée).
const TEXT_MUTED = '#787774';
const TEXT_FAINT = '#9b9a97';

export default function CreancesExitBanner({ count, hidden, onToggle }) {
  // Ligne discrète, pas un bandeau : le suivi des créances est l'objet de
  // la vue, les liquidations n'en sont qu'une note de bas de page. Masquées
  // par défaut ; le lien les affiche ou les remasque (dev 2026-09-18 :
  // « il faut juste que ce soit plus discret »).
  const VisibilityIcon = hidden ? EyeOff : Eye;
  return (
    <AnimatePresence initial={false}>
      {(count > 0 || !hidden) && (
        <motion.div
          key="creances-exit"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '2px 4px', color: TEXT_FAINT, fontSize: 11.5, lineHeight: 1.4,
          }}>
            <VisibilityIcon size={13} style={{ flexShrink: 0 }} />
            <span>
              {count} client{count !== 1 ? 's' : ''} en liquidation
              {hidden ? ` masqué${count !== 1 ? 's' : ''}` : ` affiché${count !== 1 ? 's' : ''}`}
              {' · '}
            </span>
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={!hidden}
              title="Liquidations en cours incluses. Les créances restent enregistrées."
              style={{
                border: 'none', background: 'transparent', padding: 0,
                color: TEXT_MUTED, fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              {hidden ? 'Afficher' : 'Masquer'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
