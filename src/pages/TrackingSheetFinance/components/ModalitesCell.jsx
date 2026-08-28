// ModalitesCell.jsx — colonne « Modalités » compacte de la Tracking Finance.
//
// Phase 2 condensation (2026-08-18, raffinée après retour dev) : fusionne les
// 3 anciennes colonnes Mode (M/A) + Modalité de paiement + Prélèvement
// automatisé en UNE cellule :
//
//   [icône+chip]  [OW ✓] [OL —]
//
//   - Chip modalité : mini-icône SVG inline (carte bancaire pour « N× »,
//     calendrier pour M/A) + texte. « N× » si `payment_specificity` =
//     « Paye / N sct » ; sinon « M » (MONTHLY) / « A » (YEARLY) si
//     `payment_mode` renseigné ; sinon tiret discret qui devient chip
//     fantôme au hover (cible d'édition, pas un artefact visuel).
//     Tooltip = libellé complet. Clic → popover payment_specificity.
//   - Mini-pills entité « OW » (Owner) / « OL » (Opti'lex) dérivées de
//     `auto_debit` (mapping unique : constants.js → autoDebitPastilles).
//     Indicateur d'état intégré en SVG inline (style lucide, trait 2.5,
//     arrondi — cf. MeteoIcon d'OptilexBoard) : coche verte (automatisé),
//     trait rouge discret (non), point gris (en attente), cercle pointillé
//     neutre (non renseigné). Clic → popover d'édition de l'enum (7 valeurs
//     + effacer). Tooltip = valeur enum complète.
//
// Les commits passent par les callbacks du parent (onCommitSpec /
// onCommitAutoDebit → PATCH /finance-periods optimiste, erreurs toastées
// au niveau page). Popovers portalés via PortalDropdown (échappe à
// l'overflow de la table).

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PortalDropdown from './PortalDropdown.jsx';
import {
  PAYMENT_SPECIFICITIES,
  AUTO_DEBIT_OPTIONS,
  COLUMN_LABELS,
  parsePaymentSpecCount,
  autoDebitPastilles,
  normalizePaymentMode,
} from '../constants.js';

// Palette locale (sync charte board Owner/Opti'Lex — EtatBadge sobre).
const CHIP_STYLES = {
  spec:      { bg: '#dbeafe', fg: '#1e40af' }, // « N× » — Notion blue (ex-PAYMENT_SPECIFICITY_COLORS)
  monthly:   { bg: '#E9F3F7', fg: '#337EA9' }, // « M » — badge historique conservé
  yearly:    { bg: '#EEF3ED', fg: '#448361' }, // « A » — badge historique conservé
  quarterly: { bg: '#f3e8ff', fg: '#6940a5' }, // « T » — Trimestriel (client.payment_mode)
};

// États des mini-pills entité — mêmes familles de couleurs que ETAT_STYLE du
// board (Signé vert / Résiliation rouge / Pause grise) pour une finition
// homogène avec EtatBadge.
const PILL_STATE_STYLES = {
  green: { bg: '#e9f9f0', fg: '#15794a', border: '1px solid transparent' },
  red:   { bg: '#fdecec', fg: '#b42318', border: '1px solid transparent' },
  wait:  { bg: '#eef1f6', fg: '#5b6472', border: '1px solid transparent' },
  none:  { bg: 'transparent', fg: '#9b9a97', border: '1px dashed #c7c7c2' },
};

const pickerItemStyle = (active) => ({
  border: 'none',
  outline: 'none',
  background: active ? '#eef2ff' : 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#111827',
  borderRadius: 4,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// ── SVG inline (style lucide : viewBox 24, stroke currentColor, arrondi) ──

// « Paye / N sct » dit sur combien de STRUCTURES le client paie : l'icône est
// donc un bâtiment, pas une carte bancaire — celle-ci laissait croire à un
// moyen de paiement (retour dev 2026-08-28).
function CardIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
      <path d="M13 9h4a2 2 0 0 1 2 2v10" />
      <path d="M8 7h1M8 11h1M8 15h1M16 13h1M16 17h1" />
    </svg>
  );
}

function CalendarIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

// Indicateur d'état intégré aux mini-pills. Trait épais (2.5→3) pour rester
// lisible à 10 px — même logique que MeteoIcon (strokeWidth réglable).
function StatusGlyph({ state, size = 10 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round',
    strokeLinejoin: 'round', style: { flexShrink: 0 },
  };
  switch (state) {
    case 'green': // automatisé → coche
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case 'red':   // non automatisé → trait discret (pas de croix agressive)
      return <svg {...common}><line x1="5" x2="19" y1="12" y2="12" /></svg>;
    case 'wait':  // en attente → point plein
      return <svg {...common} stroke="none"><circle cx="12" cy="12" r="5.5" fill="currentColor" /></svg>;
    default:      // non renseigné → cercle pointillé neutre
      return <svg {...common} strokeWidth={2.6} strokeDasharray="3.5 3.5"><circle cx="12" cy="12" r="8" /></svg>;
  }
}

// Mini-pill entité « OW » / « OL » + glyphe d'état. Le glyphe s'anime au
// changement de valeur (spring court), la couleur transitionne en douceur.
function EntityPill({ label, state, size = 'normal' }) {
  const s = PILL_STATE_STYLES[state] || PILL_STATE_STYLES.none;
  const compact = size === 'compact';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: compact ? 3 : 4,
      height: compact ? 17 : 19,
      padding: compact ? '0 5px' : '0 6px',
      borderRadius: 5,
      background: s.bg,
      color: s.fg,
      border: s.border,
      fontSize: compact ? 8.5 : 9,
      fontWeight: 700,
      letterSpacing: '0.04em',
      fontFamily: 'inherit',
      flexShrink: 0,
      userSelect: 'none',
      boxSizing: 'border-box',
      lineHeight: 1,
      transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
    }}>
      {label}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          style={{ display: 'inline-flex' }}
        >
          <StatusGlyph state={state} size={compact ? 9 : 10} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function ModalitesCell({
  paymentSpecificity,
  paymentMode,
  autoDebit,
  onCommitSpec,       // (value|null) → PATCH payment_specificity
  onCommitAutoDebit,  // (value|null) → PATCH auto_debit
}) {
  const [specOpen, setSpecOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [chipHover, setChipHover] = useState(false);
  const specRef = useRef(null);
  const debitRef = useRef(null);

  // ── Chip modalité ──────────────────────────────────────────────────────
  // `paymentMode` peut venir de la period, du fallback `client.payment_mode`
  // (enum backend) OU de la `periodicite` du board (libellés FR) —
  // normalizePaymentMode canonicalise tout vers MONTHLY/YEARLY/QUARTERLY.
  const specCount = parsePaymentSpecCount(paymentSpecificity);
  const mode = normalizePaymentMode(paymentMode);
  let chipText = null;
  let chipStyle = null;
  let ChipIcon = null;
  let chipTitle = COLUMN_LABELS.paymentSpec; // fallback tooltip (chip vide)
  if (specCount !== null) {
    chipText = `${specCount}×`;
    chipStyle = CHIP_STYLES.spec;
    ChipIcon = CardIcon;
    chipTitle = paymentSpecificity;
  } else if (mode === 'MONTHLY') {
    chipText = 'M';
    chipStyle = CHIP_STYLES.monthly;
    ChipIcon = CalendarIcon;
    chipTitle = 'Mensuel';
  } else if (mode === 'YEARLY') {
    chipText = 'A';
    chipStyle = CHIP_STYLES.yearly;
    ChipIcon = CalendarIcon;
    chipTitle = 'Annuel';
  } else if (mode === 'QUARTERLY') {
    chipText = 'T';
    chipStyle = CHIP_STYLES.quarterly;
    ChipIcon = CalendarIcon;
    chipTitle = 'Trimestriel';
  }

  // ── Pastilles prélèvement ──────────────────────────────────────────────
  const pastilles = autoDebitPastilles(autoDebit);
  const debitTitle = autoDebit
    ? `${COLUMN_LABELS.autoDebit} : ${autoDebit}`
    : `${COLUMN_LABELS.autoDebit} — non renseigné`;

  const pickSpec = (value) => {
    setSpecOpen(false);
    if (value !== (paymentSpecificity || null)) onCommitSpec(value);
  };
  const pickDebit = (value) => {
    setDebitOpen(false);
    if (value !== (autoDebit || null)) onCommitAutoDebit(value);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {/* Chip modalité — clic = édition payment_specificity */}
      <button
        ref={specRef}
        type="button"
        title={chipTitle}
        onClick={(e) => { e.stopPropagation(); setSpecOpen((v) => !v); }}
        onMouseEnter={() => setChipHover(true)}
        onMouseLeave={() => setChipHover(false)}
        style={{
          border: 'none', background: 'transparent', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center',
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={chipText || 'empty'}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            style={chipText ? {
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 19, padding: '0 7px',
              borderRadius: 5,
              background: chipStyle.bg, color: chipStyle.fg,
              fontSize: 11, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            } : {
              // Vide : tiret discret ; au hover, chip fantôme propre qui
              // signale « cliquer pour définir » (pas un artefact pointillé).
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 19, padding: '0 7px',
              borderRadius: 5,
              background: chipHover ? '#f1f1ef' : 'transparent',
              color: chipHover ? '#787774' : '#c8cdd7',
              fontSize: 11, fontWeight: 500,
              lineHeight: 1,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {chipText ? (
              <>
                <ChipIcon size={11} />
                {chipText}
              </>
            ) : (
              chipHover ? <><CardIcon size={11} />définir</> : '—'
            )}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* Mini-pills OW / OL — clic = édition auto_debit */}
      <button
        ref={debitRef}
        type="button"
        title={debitTitle}
        onClick={(e) => { e.stopPropagation(); setDebitOpen((v) => !v); }}
        style={{
          border: 'none', background: 'transparent', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        <EntityPill label="OW" state={pastilles.owner} />
        <EntityPill label="OL" state={pastilles.optilex} />
      </button>

      {/* Popover payment_specificity */}
      <PortalDropdown
        open={specOpen}
        anchorRef={specRef}
        onClose={() => setSpecOpen(false)}
        minWidth={180}
        maxHeight={320}
        zIndex={2000}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={() => pickSpec(null)}
            style={pickerItemStyle(!paymentSpecificity)}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = !paymentSpecificity ? '#eef2ff' : 'transparent'; }}
          >
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>— effacer —</span>
          </button>
          <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
          {PAYMENT_SPECIFICITIES.map((opt) => {
            const isActive = opt === paymentSpecificity;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pickSpec(opt)}
                style={pickerItemStyle(isActive)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? '#eef2ff' : 'transparent'; }}
              >
                <span style={{ color: CHIP_STYLES.spec.fg, display: 'inline-flex' }}>
                  <CardIcon size={13} />
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      </PortalDropdown>

      {/* Popover auto_debit — chaque option montre sa paire de mini-pills,
          l'utilisateur voit l'effet visuel avant de choisir. */}
      <PortalDropdown
        open={debitOpen}
        anchorRef={debitRef}
        onClose={() => setDebitOpen(false)}
        minWidth={300}
        maxHeight={360}
        zIndex={2000}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={() => pickDebit(null)}
            style={pickerItemStyle(!autoDebit)}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = !autoDebit ? '#eef2ff' : 'transparent'; }}
          >
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>— effacer —</span>
          </button>
          <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
          {AUTO_DEBIT_OPTIONS.map((opt) => {
            const isActive = opt === autoDebit
              || (autoDebit && opt.toUpperCase() === String(autoDebit).trim().toUpperCase());
            const preview = autoDebitPastilles(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pickDebit(opt)}
                style={pickerItemStyle(isActive)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? '#eef2ff' : 'transparent'; }}
              >
                <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                  <EntityPill label="OW" state={preview.owner} size="compact" />
                  <EntityPill label="OL" state={preview.optilex} size="compact" />
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt}</span>
              </button>
            );
          })}
        </div>
      </PortalDropdown>
    </div>
  );
}
