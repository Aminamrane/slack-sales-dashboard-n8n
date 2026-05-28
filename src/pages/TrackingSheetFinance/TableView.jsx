// TableView.jsx — virtualized Notion-style table for the Tracking Finance page.
//
// 2026-05-08 (v8) : refonte 3e passe aux 19 colonnes spécifiées par le dev.
// ─────────────────────────────────────────────────────────────────────────
// VOCABULAIRE FINANCE — SACRÉ. Les labels viennent de `COLUMN_LABELS` dans
// constants.js, qui est la source de vérité. Toute modification = casser le
// workflow de l'équipe finance.
//
// Layout (gauche → droite, ordre figé) :
//   1.  Numéro client                              (read-only, mono)
//   2.  Nom client + entreprise                    (read-only, hover → OUVRIR)
//   3.  État                                       (dropdown 8 valeurs)
//   4.  État détail                                (dropdown 16 valeurs)
//   5.  RDV lancement                              (read-only date)
//   6.  RDV onboarding                             (read-only date)
//   7.  Modalité de paiement                       (dropdown 4 valeurs)
//   8.  Prélèvement automatisé                     (dropdown 7 valeurs)
//   9.  Montant Attendu Owner                      (read-only EUR)
//  10.  Montant Attendu Opti'lex                   (read-only EUR)
//  11.  Montant Récupéré Owner                     (modifiable EUR)
//  12.  Montant Récupéré Opti'lex                  (modifiable EUR)
//  13.  Retard de paiement                         (pill rouge, somme courant)
//  14.  Retard ... mois précédents Owner           (pill rouge cumul)
//  15.  Retard ... mois précédents Opti'lex        (pill rouge cumul)
//  16.  Montant récupéré sur créances ... Owner    (modifiable EUR)
//  17.  Montant récupéré sur créances ... Opti'lex (modifiable EUR)
//  18.  Check Owner                                (dropdown PSP, pill verte)
//  19.  Check Opti'lex                             (dropdown PSP, pill verte)
//
// Notion styling :
//   - Row height 44px (aéré, lisibilité finance team)
//   - Font 14px, padding 12px horizontal
//   - `font-variant-numeric: tabular-nums` sur toutes les cellules numériques
//   - Cellules numériques right-aligned
//   - Border-bottom row 1px solid #f1f1ef (très subtil)
//   - Hover row : background #f7f7f5 sur toute la row (sticky inclus)
//   - Séparateurs verticaux 2px / #c7c7c2 entre blocs Owner|Opti'lex
//     (entre cols #10–#11, #15–#16, #17–#18)
//   - "OUVRIR" pill au hover de la cellule Nom (overlay, ne pousse pas)
//   - Pas de row-click générique : seul le bouton OUVRIR ouvre le panel
//
// Mode splitActive (DetailPanel ouvert) :
//   - 5 colonnes essentielles : Numéro / Nom / État / Att. Owner / Att. Opti'lex
//   - + Retard mois courant pour signal rouge

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import {
  GripVertical, Plus, Type, Hash, Calendar, Tag, CircleDot, AlignLeft,
  Square, Repeat, Edit3, MessageSquare, Check,
  EyeOff, Eye, Columns3, ChevronLeft, ChevronRight,
} from 'lucide-react';

import {
  PSP_OPTIONS,
  FINANCE_STATUS_DETAILS,
  PAYMENT_SPECIFICITIES,
  AUTO_DEBIT_OPTIONS,
  ETAT_OPTIONS,
  ETAT_COLORS,
  ETAT_FALLBACK,
  STATUS_DETAIL_COLORS,
  STATUS_DETAIL_FALLBACK,
  PSP_COLORS,
  PSP_FALLBACK,
  AUTO_DEBIT_COLORS,
  AUTO_DEBIT_FALLBACK,
  PAYMENT_SPECIFICITY_COLORS,
  PAYMENT_SPECIFICITY_FALLBACK,
  COLUMN_LABELS,
  COMMENTABLE_FIELDS,
  formatEUR,
  formatDateFR,
  parseDateFR,
  splitSocieteRep,
  toNumber,
} from './constants.js';
import { EditableNumber, EditableSelect, EditableDate } from './EditableCell.jsx';
import CommentPopup from './CommentPopup.jsx';
import apiClient from '../../services/apiClient.js';

// ── Notion palette (kept in sync with index.jsx N constant) ─────────────
const N = {
  pageBg:    '#ffffff',
  rowHover:  '#f5f4f1',     // hover row : très subtle, distinct des borders
  rowActive: '#efeeec',
  border:    '#d6d5d1',     // border plus marquée
  borderSft: '#d0cfcb',     // borders verticales/horizontales encore + foncées (demande dev 2026-05-11 : restent visibles au hover)
  borderHeavy: '#a8a7a2',   // séparateur Owner|Opti'lex (plus marqué)
  text:      '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  green:     '#0f7b6c',
  greenBg:   '#cfe9e3',
  red:       '#b74133',
  redBg:     '#ffe2dd',
  yellow:    '#cb912f',
  yellowBg:  '#fdecc8',
};

// ── Row layout constants (3e passe : tableau aéré) ──────────────────────
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 52; // augmenté pour permettre wrap sur 2 lignes (capture #36)
const CELL_FONT_SIZE = 14;
const CELL_PAD_X = 12;

// ── Column layout ─────────────────────────────────────────────────────────
//
// Format : { w, labelKey, kind, sticky?, splitVisible?, align, heavyRight? }
//   - labelKey : clé dans COLUMN_LABELS (source de vérité du vocabulaire)
//   - kind     : 'text' | 'amount' | 'date' | 'select' | 'state'
//   - sticky   : col épinglée à gauche (ne scrolle pas horizontalement)
//   - splitVisible : visible quand DetailPanel ouvert
//   - heavyRight : borderRight 2px #c7c7c2 (séparateur Owner|Opti'lex)
//
// Colonnes réorganisées 2026-05-11 par blocs Owner / Opti'lex pour group headers
// (avant : ordre alterné Owner/Opti — pas lisible quand on voit "Montant Attendu" 2x).
// `group` : identité | statut | modalites | retard | owner | optilex
// `shortLabel` : label compact affiché dans le sub-header (le label complet du
// vocabulaire métier reste dans COLUMN_LABELS, accessible via tooltip + DetailPanel)
const COLS_FULL = {
  numero:               { w: 85,  group: 'identite',  shortLabel: 'N° client',    labelKey: 'numero',               kind: 'text',   sticky: true,  splitVisible: true,  align: 'center', editable: false, hideKindIcon: true },
  societe:              { w: 240, group: 'identite',  shortLabel: 'Nom + entreprise', labelKey: 'societe',          kind: 'text',   sticky: true,  splitVisible: true,  align: 'left',  editable: false },
  etat:                 { w: 130, group: 'statut',    shortLabel: 'État',          labelKey: 'etat',                 kind: 'state',  sticky: true,  splitVisible: true,  align: 'left',  editable: true,  heavyRight: true },
  statusDetail:         { w: 200, group: 'statut',    shortLabel: 'État détail',   labelKey: 'statusDetail',         kind: 'select', sticky: false, splitVisible: false, align: 'left',  editable: true  },
  paymentMode:          { w: 50,  group: 'modalites', shortLabel: 'Mode',          labelKey: 'paymentMode',          kind: 'recurrence', sticky: false, splitVisible: false, align: 'center', editable: false, headerIconOnly: true },
  paymentSpec:          { w: 130, group: 'modalites', shortLabel: 'Modalité',      labelKey: 'paymentSpec',          kind: 'select', sticky: false, splitVisible: false, align: 'left',  editable: true  },
  autoDebit:            { w: 160, group: 'modalites', shortLabel: 'Prélèvement',   labelKey: 'autoDebit',            kind: 'select', sticky: false, splitVisible: false, align: 'center', editable: true  },
  overdueCurrent:       { w: 145, group: 'retard',    shortLabel: 'Retard global', labelKey: 'overdueCurrent', kind: 'amount', sticky: false, splitVisible: true,  align: 'right', editable: false, heavyRight: true },
  // ── OWNER block ─────────────────────────────────────────────────────────
  expectedOwner:        { w: 115, group: 'owner',     shortLabel: 'Attendu',          labelKey: 'expectedOwner',        kind: 'amount', sticky: false, splitVisible: true,  align: 'right', editable: false },
  receivedOwner:        { w: 185, group: 'owner',     shortLabel: 'Récupéré',         labelKey: 'receivedOwner',        kind: 'amount', sticky: false, splitVisible: false, align: 'center', editable: true  },
  overdueOwnerCum:      { w: 130, group: 'owner',     shortLabel: 'Retard antérieur', labelKey: 'overdueOwnerCum',      kind: 'amount', sticky: false, splitVisible: false, align: 'right', editable: false },
  receivedOverdueOwner: { w: 185, group: 'owner',     shortLabel: 'Récupéré antérieur', labelKey: 'receivedOverdueOwner', kind: 'amount', sticky: false, splitVisible: false, align: 'center', editable: true  },
  pspOwner:             { w: 110, group: 'owner',     shortLabel: 'Check',            labelKey: 'pspOwner',             kind: 'select', sticky: false, splitVisible: false, align: 'left',  editable: true  },
  payDateOwner:         { w: 115, group: 'owner',     shortLabel: 'Date paie.',       labelKey: 'payDateOwner',         kind: 'date',   sticky: false, splitVisible: false, align: 'center', editable: true, heavyRight: true },
  // ── OPTI'LEX block ──────────────────────────────────────────────────────
  expectedOptilex:      { w: 115, group: 'optilex',   shortLabel: 'Attendu',          labelKey: 'expectedOptilex',      kind: 'amount', sticky: false, splitVisible: true,  align: 'right', editable: false },
  receivedOptilex:      { w: 185, group: 'optilex',   shortLabel: 'Récupéré',         labelKey: 'receivedOptilex',      kind: 'amount', sticky: false, splitVisible: false, align: 'center', editable: true  },
  overdueOptilexCum:    { w: 130, group: 'optilex',   shortLabel: 'Retard antérieur', labelKey: 'overdueOptilexCum',    kind: 'amount', sticky: false, splitVisible: false, align: 'right', editable: false },
  receivedOverdueOpti:  { w: 185, group: 'optilex',   shortLabel: 'Récupéré antérieur', labelKey: 'receivedOverdueOpti', kind: 'amount', sticky: false, splitVisible: false, align: 'center', editable: true  },
  pspOptilex:           { w: 110, group: 'optilex',   shortLabel: 'Check',            labelKey: 'pspOptilex',           kind: 'select', sticky: false, splitVisible: false, align: 'left',  editable: true  },
  payDateOptilex:       { w: 115, group: 'optilex',   shortLabel: 'Date paie.',       labelKey: 'payDateOptilex',       kind: 'date',   sticky: false, splitVisible: false, align: 'center', editable: true },
};

// Group headers metadata — palette Notion light mode authentique
// Option A 2026-05-11 : pas de color band sur cells (cellBg = null partout),
// seul le group header est coloré. Cells restent blanches sauf status overdue.
const GROUPS = {
  identite:  { label: '',           cellBg: null, headerBg: '#ffffff' },
  statut:    { label: '',           cellBg: null, headerBg: '#ffffff' },
  modalites: { label: 'Modalités',  cellBg: null, headerBg: '#F1F1EF' }, // Notion gray
  retard:    { label: 'Retard',     cellBg: null, headerBg: '#F1F1EF' }, // Notion gray
  owner:     { label: 'Owner',      cellBg: null, headerBg: '#E9F3F7' }, // Notion blue light
  optilex:   { label: "Opti'lex",   cellBg: null, headerBg: '#F8ECDF' }, // Notion orange light
};

const COL_KEYS_FULL = Object.keys(COLS_FULL);

// Sticky columns can never be hidden (N° client, Nom + entreprise, Etat).
const STICKY_KEYS = new Set(COL_KEYS_FULL.filter((k) => COLS_FULL[k].sticky));

// localStorage key for hidden columns persistence.
const HIDDEN_COLS_LS_KEY = 'tsf-hidden-cols';

// Header type-icon (Notion convention).
function HeaderTypeIcon({ kind }) {
  const props = { size: 12, strokeWidth: 1.8, style: { color: N.textFaint, flexShrink: 0 } };
  switch (kind) {
    case 'text':       return <Type {...props} />;
    case 'amount':     return <Hash {...props} />;
    case 'date':       return <Calendar {...props} />;
    case 'select':     return <Tag {...props} />;
    case 'state':      return <CircleDot {...props} />;
    case 'recurrence': return <Repeat {...props} />;
    default:           return <AlignLeft {...props} />;
  }
}

const GUTTER = 0; // Retiré 2026-05-11 : drag handle pas branché, créait un espace inutile à gauche de N°

// ── Util : compute derived col config based on splitActive ─────────────────
function useColumnConfig(splitActive) {
  return useMemo(() => {
    const keys = splitActive
      ? COL_KEYS_FULL.filter((k) => COLS_FULL[k].splitVisible)
      : COL_KEYS_FULL;
    const cols = keys.reduce((acc, k) => { acc[k] = COLS_FULL[k]; return acc; }, {});
    const stickyKeys = keys.filter((k) => cols[k].sticky);
    const stickyLefts = stickyKeys.reduce((acc, k, i) => {
      acc[k] = i === 0 ? 0 : acc[stickyKeys[i - 1]] + cols[stickyKeys[i - 1]].w;
      return acc;
    }, {});
    const totalWidth = keys.reduce((acc, k) => acc + cols[k].w, 0);
    return { keys, cols, stickyKeys, stickyLefts, totalWidth };
  }, [splitActive]);
}

// ── Header (Notion-style label band) ──────────────────────────────────────
// Compute contiguous group segments from ordered keys.
// Split when group changes OR when sticky-ness changes within a group, so
// that sticky cols get a sticky segment header (mask scroll behind them).
function computeGroupSegments(keys, cols) {
  const segments = [];
  for (const k of keys) {
    const g = cols[k].group;
    const sticky = cols[k].sticky;
    const last = segments[segments.length - 1];
    if (last && last.group === g && last.sticky === sticky) {
      last.keys.push(k);
      last.width += cols[k].w;
    } else {
      segments.push({ group: g, keys: [k], width: cols[k].w, sticky });
    }
  }
  // Compute stickyLeft for sticky segments (cumulative)
  let stickyLeftCursor = 0;
  for (const seg of segments) {
    if (seg.sticky) {
      seg.stickyLeft = stickyLeftCursor;
      stickyLeftCursor += seg.width;
    }
  }
  return segments;
}

const GROUP_HEADER_HEIGHT = 32;

function getHiddenBetween(allKeys, visibleKeys, hiddenCols) {
  if (!hiddenCols?.size) return {};
  const result = {};
  for (let i = 0; i < visibleKeys.length; i++) {
    const curIdx = allKeys.indexOf(visibleKeys[i]);
    const nextIdx = i < visibleKeys.length - 1 ? allKeys.indexOf(visibleKeys[i + 1]) : allKeys.length;
    const between = [];
    for (let j = curIdx + 1; j < nextIdx; j++) {
      if (hiddenCols.has(allKeys[j])) between.push(allKeys[j]);
    }
    if (between.length > 0) result[visibleKeys[i]] = between;
  }
  return result;
}

function Header({ keys, cols, stickyLefts, hiddenCols, onHideCol, onShowCol, allKeys, collapsingCol }) {
  const segments = computeGroupSegments(keys, cols);
  const hiddenBetween = useMemo(() => getHiddenBetween(allKeys || keys, keys, hiddenCols), [allKeys, keys, hiddenCols]);

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      {/* Row 1 — Group headers (Owner / Opti'lex / etc.) */}
      <div style={{
        display: 'flex',
        height: GROUP_HEADER_HEIGHT,
        borderBottom: `1px solid ${N.borderSft}`,
      }}>
        {/* Gutter */}
        <div style={{
          width: GUTTER, flex: `0 0 ${GUTTER}px`,
          position: 'sticky', left: 0, zIndex: 4,
          background: N.pageBg,
        }} />
        {segments.map((seg, i) => {
          const g = GROUPS[seg.group];
          const isLast = i === segments.length - 1;
          const lastCol = cols[seg.keys[seg.keys.length - 1]];
          // Border 2px si la dernière col du segment a heavyRight (alignement
          // avec les borders verticales des cells en-dessous), sinon 1px subtil.
          // Pas de border sur le dernier segment.
          const segBorderRight = isLast
            ? 'none'
            : lastCol.heavyRight
              ? `3px solid ${N.borderHeavy}`
              : `1px solid ${N.border}`;
          return (
            <div
              key={`seg-${seg.group}-${i}`}
              style={{
                width: seg.width,
                flex: `0 0 ${seg.width}px`,
                background: g.headerBg,
                color: N.text,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                position: seg.sticky ? 'sticky' : 'relative',
                left: seg.sticky ? GUTTER + seg.stickyLeft : undefined,
                zIndex: seg.sticky ? 5 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
                borderRight: segBorderRight,
              }}
            >
              {g.label}
            </div>
          );
        })}
      </div>

      {/* Row 2 — Sub-headers (label court par colonne) */}
      <div style={{
        display: 'flex',
        height: HEADER_HEIGHT,
        borderBottom: `3px solid ${N.borderHeavy}`,  // séparateur header/data marqué (capture #6)
        background: N.pageBg,
      }}>
        {/* Gutter */}
        <div style={{
          width: GUTTER, flex: `0 0 ${GUTTER}px`,
          position: 'sticky', left: 0, zIndex: 4,
          background: N.pageBg,
        }} />
        {keys.map((k) => {
          const c = cols[k];
          const g = GROUPS[c.group];
          const subHeaderBg = g.cellBg ?? N.pageBg;
          const canHide = !STICKY_KEYS.has(k);
          const isCollapsing = collapsingCol === k;
          const cell = (
            <div
              key={k}
              className="tsf-subheader-cell"
              title={COLUMN_LABELS[c.labelKey]}
              style={{
                width: isCollapsing ? 0 : c.w,
                flex: isCollapsing ? '0 0 0px' : `0 0 ${c.w}px`,
                opacity: isCollapsing ? 0 : 1,
                overflow: 'hidden',
                transition: 'width 0.32s cubic-bezier(0.32, 0, 0.15, 1), flex 0.32s cubic-bezier(0.32, 0, 0.15, 1), opacity 0.18s ease-out, padding 0.32s cubic-bezier(0.32, 0, 0.15, 1)',
                padding: `8px ${CELL_PAD_X}px`,
                fontSize: 14,
                fontWeight: 700,
                color: N.text,
                position: c.sticky ? 'sticky' : 'relative',
                left: c.sticky ? GUTTER + stickyLefts[k] : undefined,
                background: subHeaderBg,
                zIndex: c.sticky ? 4 : 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: c.align === 'right'
                  ? 'flex-end'
                  : c.align === 'center'
                    ? 'center'
                    : 'flex-start',
                gap: 6,
                borderRight: c.heavyRight
                  ? `3px solid ${N.borderHeavy}`
                  : `1px solid ${N.borderSft}`,
                userSelect: 'none',
              }}
            >
              {!c.hideKindIcon && <HeaderTypeIcon kind={c.kind} />}
              {!c.headerIconOnly && (
                <span style={{
                  // Wrap sur 2 lignes max au lieu de tronquer (capture #36).
                  // L'utilisateur voit le label entier sans avoir à hover.
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {c.shortLabel || COLUMN_LABELS[c.labelKey]}
                </span>
              )}
              {/* Hide column button — invisible by default, appears on hover */}
              {canHide && (
                <button
                  type="button"
                  className="tsf-hide-col-btn"
                  title={`Masquer "${c.shortLabel || COLUMN_LABELS[c.labelKey]}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHideCol?.(k);
                  }}
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    padding: 0,
                    border: 'none',
                    borderRadius: 3,
                    background: 'transparent',
                    color: N.textFaint,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.12s',
                    zIndex: 5,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e3e2e0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <EyeOff size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          );

          return cell;
        })}
      </div>
    </div>
  );
}

// ── Hidden columns bar (above table, dropdown to re-show) ──────────────────
function HiddenColsBar({ hiddenCols, onShowCol, onShowAll }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = hiddenCols.size;

  return (
    <div ref={ref} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '5px 12px', background: N.pageBg, borderBottom: `1px solid ${N.borderSft}`,
      position: 'sticky', top: 0, zIndex: 21, gap: 8,
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          height: 28, padding: '0 14px',
          background: open ? '#d0e8fd' : '#e8f4fd', color: '#1e6bb8',
          border: '1px solid #bdd8ef', borderRadius: 6,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
      >
        <Eye size={14} strokeWidth={1.8} />
        <span>{count} colonne{count > 1 ? 's' : ''} masquée{count > 1 ? 's' : ''}</span>
      </button>
      <button
        type="button"
        onClick={onShowAll}
        style={{
          height: 28, padding: '0 10px',
          background: 'transparent', color: N.textMuted,
          border: `1px solid ${N.border}`, borderRadius: 6,
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        Tout réafficher
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 12,
          marginTop: 2, minWidth: 220, background: '#fff',
          border: `1px solid ${N.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(15,15,15,0.12), 0 2px 6px rgba(15,15,15,0.06)',
          padding: '6px 0', zIndex: 100,
        }}>
          <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: N.textFaint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Colonnes masquées
          </div>
          {[...hiddenCols].map((colKey) => {
            const colDef = COLS_FULL[colKey];
            if (!colDef) return null;
            const label = colDef.shortLabel || COLUMN_LABELS[colDef.labelKey] || colKey;
            const groupLabel = GROUPS[colDef.group]?.label;
            return (
              <button
                key={colKey}
                type="button"
                onClick={() => { onShowCol(colKey); if (hiddenCols.size <= 1) setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 14px', border: 'none', background: 'transparent',
                  color: N.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Eye size={14} strokeWidth={1.8} style={{ color: '#1e6bb8', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {groupLabel && <span style={{ fontSize: 11, color: N.textFaint }}>{groupLabel}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Overdue status (palette Notion light mode authentique) ──────────────────
// Priorité ORANGE > ROUGE > JAUNE (cf. brief dev 2026-05-11).
// Refonte 2026-05-11 avec hex officiels Notion (désaturation extrême + même
// luminance → harmonie auto). Hovers = -3% luminance.
const OVERDUE_STATUS_COLORS = {
  orange: { bg: '#F8ECDF', hover: '#F1DEC6' }, // Notion orange (1er paiement raté)
  red:    { bg: '#FAECEC', hover: '#F2D6D6' }, // Notion red (retard courant + cumul)
  yellow: { bg: '#FAF3DD', hover: '#F2E6C2' }, // Notion yellow (retard courant seul)
};

function getOverdueStatus(row) {
  const overdueCurrent =
    toNumber(row.overdue_owner_current_month) +
    toNumber(row.overdue_optilex_current_month);
  const overdueCumul =
    toNumber(row.overdue_owner_cumulative) +
    toNumber(row.overdue_optilex_cumulative);
  const received =
    toNumber(row.received_owner) + toNumber(row.received_optilex_ttc);

  // ORANGE (priorité haute) : rdv_onboarding > +1 jour ET aucun paiement reçu cette period
  const onboardingDate = parseDateFR(row.client?.rdv_onboarding);
  if (onboardingDate && received === 0) {
    const oneDayAfter = onboardingDate.getTime() + 86400000;
    if (oneDayAfter < Date.now()) return 'orange';
  }

  if (overdueCurrent > 0 && overdueCumul > 0) return 'red';
  if (overdueCurrent > 0) return 'yellow';
  return null;
}

// ── Cell wrapper helper ─────────────────────────────────────────────────────
function Cell({
  k, cols, stickyLefts, hover, isActive, children, extraStyle, rowBg, rowStatus,
  selected, onSelect, commentable, commentCount, onOpenCommentPopup, collapsingCol,
}) {
  const c = cols[k];
  const isCollapsing = collapsingCol === k;
  const group = GROUPS[c.group];
  // Hover bg uniforme subtle (demande dev capture #33 : pas de "conteneur"
  // marqué qui apparaît derrière la cell éditable au hover). Le row hover
  // bg subtle suffit comme affordance ; la sélection (outline + point cyan)
  // fait le reste.
  const baseBg = rowStatus
    ? rowBg
    : (isActive ? N.rowActive : (hover ? N.rowHover : (group?.cellBg ?? N.pageBg)));
  return (
    <div
      style={{
        width: isCollapsing ? 0 : c.w,
        flex: isCollapsing ? '0 0 0px' : `0 0 ${c.w}px`,
        padding: isCollapsing ? '4px 0' : `4px ${CELL_PAD_X}px`,
        opacity: isCollapsing ? 0 : 1,
        overflow: 'hidden',
        transition: isCollapsing ? 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1), flex 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, padding 0.28s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
        borderRight: c.heavyRight
          ? `3px solid ${N.borderHeavy}`
          : `1px solid ${N.borderSft}`,
        position: c.sticky ? 'sticky' : 'relative',
        left: c.sticky ? GUTTER + stickyLefts[k] : undefined,
        background: baseBg,
        // Cell sélectionnée boostée pour que le point cyan déborde au-dessus
        // de toutes les cells voisines (sticky ou non).
        zIndex: selected ? 50 : (c.sticky ? 10 : 0),
        cursor: c.editable ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: c.align === 'right'
          ? 'flex-end'
          : c.align === 'center'
            ? 'center'
            : 'flex-start',
        overflow: 'visible', // pour que le point cyan déborde
        fontSize: CELL_FONT_SIZE,
        fontVariantNumeric: c.kind === 'amount' ? 'tabular-nums' : undefined,
        // Outline sélection : appliqué partout (read-only ET éditables).
        // L'EditableNumber/Select interne ne montre plus de focus border native
        // pour éviter le doublé. Style Google Sheets / Notion (capture #32).
        outline: selected ? '2px solid #2383e2' : undefined,
        outlineOffset: '-2px',
        ...extraStyle,
      }}
      data-tsf-selectable="1"
      onClick={(e) => {
        // Ne pas trigger select sur le bouton OUVRIR ou autre child interactif
        if (e.target.closest('.tsf-open-btn')) return;
        onSelect?.(k);
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'inherit',
        overflow: 'hidden',
        padding: 0,
      }}>
        {children}
      </div>
      {/* Crayon permanent sur cells `amount` éditables (demande dev capture #34) :
          signale visuellement "tu peux saisir un montant ici" sans avoir à
          hover. Disparaît seulement quand la cell est sélectionnée (cadre bleu
          prend le relais). */}
      {c.editable && c.kind === 'amount' && !selected && (
        <Edit3
          size={11}
          strokeWidth={2}
          style={{
            position: 'absolute',
            top: '50%', right: 6,
            transform: 'translateY(-50%)',
            color: N.textFaint,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Bouton commentaire — Notion-style "Ouvrir la discussion" (capture #21).
          Toujours visible si la cell a des commentaires (count > 0).
          Visible au hover/selected si pas encore de commentaires (permet de
          créer le 1er). Style : pill blanche bordée + icône + count. */}
      {commentable && (commentCount > 0 || hover || selected) && (
        <button
          type="button"
          data-tsf-comment-trigger="1"
          title="Ouvrir la discussion"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenCommentPopup?.(k, rect);
          }}
          style={{
            position: 'absolute',
            top: '50%',
            right: 6,
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            height: 22,
            padding: commentCount > 0 ? '0 7px 0 6px' : '0 5px',
            background: '#ffffff',
            color: '#37352f',
            border: '1px solid #e3e2e0',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            lineHeight: 1,
            fontFamily: 'inherit',
            boxShadow: '0 1px 2px rgba(15,15,15,0.06)',
            zIndex: 12,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f7f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          <MessageSquare size={12} strokeWidth={2} style={{ color: N.textMuted }} />
          {commentCount > 0 && (
            <span style={{ fontSize: 11.5, color: N.text, fontWeight: 600 }}>
              {commentCount}
            </span>
          )}
        </button>
      )}
      {/* Point cyan bas-droite quand sélectionné (style Google Sheets).
          Appliqué à toutes les cells (read-only + éditables) pour cohérence
          visuelle (capture #32). */}
      {selected && (
        <span
          style={{
            position: 'absolute',
            right: -4, bottom: -4,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#2383e2',
            border: '1.5px solid #ffffff',
            pointerEvents: 'none',
            zIndex: 999,
          }}
        />
      )}
    </div>
  );
}

// ── Row renderer ────────────────────────────────────────────────────────────
const RowRenderer = React.memo(function RowRenderer({
  row,
  onPatchRow,
  onOpenRow,
  isActive,
  cols,
  keys,
  stickyLefts,
  selectedColKey,
  onSelectCell,
  rowCommentCounts,   // { [colKey]: number } — counts pour cette row, MVP option C
  onOpenCommentPopup, // (colKey, rect) — ouverture popup au niveau TableView
  collapsingCol,
}) {
  const [hover, setHover] = useState(false);

  const patch = useCallback((field) => (value) => onPatchRow(row.id, { [field]: value }), [row.id, onPatchRow]);

  // Numerical values
  const expectedOwner    = toNumber(row.expected_owner);
  const expectedOptilex  = toNumber(row.expected_optilex_ttc);
  const receivedOwner    = toNumber(row.received_owner);
  const receivedOptilex  = toNumber(row.received_optilex_ttc);
  const overdueOwnerCM   = toNumber(row.overdue_owner_current_month) || 0;
  const overdueOptilexCM = toNumber(row.overdue_optilex_current_month) || 0;
  const overdueOwnerCum  = toNumber(row.overdue_owner_cumulative) || 0;
  const overdueOptilexCum = toNumber(row.overdue_optilex_cumulative) || 0;
  const recoveredOverdueOwner    = toNumber(row.received_overdue_owner);
  const recoveredOverdueOptilex  = toNumber(row.received_overdue_optilex_ttc);
  const overdueCurrentTotal = overdueOwnerCM + overdueOptilexCM;

  // Delta Récupéré vs Attendu — pill verte si surplus, pill orange si manquement.
  // Brief dev 2026-05-12 : orange (pas rouge) pour différencier des vrais retards
  // de la colonne Retard mois courant. Pill cachée si reçu=0 (cell vide).
  const deltaOwner          = receivedOwner > 0          ? receivedOwner - expectedOwner            : 0;
  const deltaOptilex        = receivedOptilex > 0        ? receivedOptilex - expectedOptilex        : 0;
  const deltaOverdueOwner   = recoveredOverdueOwner > 0  ? recoveredOverdueOwner - overdueOwnerCum  : 0;
  const deltaOverdueOptilex = recoveredOverdueOptilex > 0 ? recoveredOverdueOptilex - overdueOptilexCum : 0;

  // Overdue status (color coding Notion-soft, cf. brief 2026-05-11)
  const overdueStatus = getOverdueStatus(row);
  const statusColors = overdueStatus ? OVERDUE_STATUS_COLORS[overdueStatus] : null;

  const rowBg = isActive
    ? N.rowActive
    : hover
      ? (statusColors?.hover ?? N.rowHover)
      : (statusColors?.bg ?? N.pageBg);

  // Cell wrapper bound to current row state (click → select cell, pas ouvrir row)
  const C = useCallback((k, children, extraStyle) => {
    const commentable = !!COMMENTABLE_FIELDS[k];
    const commentCount = commentable ? (rowCommentCounts?.[k] || 0) : 0;
    return (
      <Cell
        k={k}
        cols={cols}
        stickyLefts={stickyLefts}
        hover={hover}
        isActive={isActive}
        rowBg={rowBg}
        rowStatus={overdueStatus}
        selected={selectedColKey === k}
        onSelect={(colKey) => onSelectCell?.(row.id, colKey)}
        commentable={commentable}
        commentCount={commentCount}
        onOpenCommentPopup={(colKey, rect) => onOpenCommentPopup?.(row.id, colKey, rect)}
        collapsingCol={collapsingCol}
        extraStyle={extraStyle}
      >
        {children}
      </Cell>
    );
  }, [cols, stickyLefts, hover, isActive, rowBg, overdueStatus, selectedColKey, onSelectCell, row.id, rowCommentCounts, onOpenCommentPopup, collapsingCol]);

  return (
    <div
      className="tsf-row"
      style={{
        display: 'flex',
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${N.borderSft}`,
        transition: 'background 0.12s',
        background: rowBg,
        // Row boostée au-dessus des autres rows quand une cell est sélectionnée :
        // permet au point cyan débordant (bottom/right -4px) de passer au-dessus
        // des cells de la row d'en-dessous (notamment sticky cell État).
        position: 'relative',
        zIndex: selectedColKey ? 30 : 'auto',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Gutter : drag handle (icône visible on hover only, mais bg toujours opaque
          pour masquer le scroll horizontal derrière la zone sticky). */}
      <div
        style={{
          width: GUTTER, flex: `0 0 ${GUTTER}px`,
          position: 'sticky', left: 0, zIndex: 10,
          background: rowBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span
          title="Réorganiser"
          style={{
            color: N.textFaint, display: 'inline-flex', cursor: 'grab',
            opacity: hover ? 1 : 0,
            transition: 'opacity 0.12s',
          }}
        >
          <GripVertical size={12} />
        </span>
      </div>

      {/* Identité — Numéro client (font plus petite + centré, demande dev) */}
      {keys.includes('numero') && C('numero', (
        <span style={{
          fontSize: 12, color: N.textMuted,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {row.client?.numero_client || <EmptyCell />}
        </span>
      ))}

      {/* Identité — Nom client + entreprise + bouton OUVRIR au hover */}
      {keys.includes('societe') && C('societe', (
        <>
          <SocieteCell row={row} />
          <button
            type="button"
            className="tsf-open-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRow?.(row);
            }}
            title="Ouvrir le détail du client"
          >
            <Square size={12} strokeWidth={2} />
            <span>OUVRIR</span>
          </button>
        </>
      ))}

      {/* Statut — État */}
      {keys.includes('etat') && C('etat', (
        <EditableSelect
          value={row.client?.etat}
          options={ETAT_OPTIONS}
          onCommit={async (next) => { await onPatchRow(row.id, { etat: next }); }}
          pillColors={Object.fromEntries(
            Object.entries(ETAT_COLORS).map(([k, v]) => [k, { fg: v.fg, bg: v.bg }])
          )}
          pillFallback={ETAT_FALLBACK}
          optionLabels={Object.fromEntries(
            Object.entries(ETAT_COLORS).map(([k, v]) => [k, v.label])
          )}
          notionSolid
          placeholderItalic
          placeholder="État"
        />
      ))}

      {/* Statut — État détail */}
      {keys.includes('statusDetail') && C('statusDetail', (
        <EditableSelect
          value={row.finance_status_detail}
          options={FINANCE_STATUS_DETAILS}
          onCommit={patch('finance_status_detail')}
          pillColors={STATUS_DETAIL_COLORS}
          pillFallback={STATUS_DETAIL_FALLBACK}
          notionSolid
          placeholderItalic
          placeholder="État détail"
        />
      ))}

      {/* Modalités — Mode de paiement (badge A = Annuel / M = Mensuel, read-only) */}
      {keys.includes('paymentMode') && C('paymentMode', (
        row.payment_mode === 'YEARLY' ? (
          <span title="Annuel" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 18, padding: '0 6px',
            borderRadius: 4,
            background: '#EEF3ED', // Notion green light
            color: '#448361',       // Notion green text
            fontSize: 11, fontWeight: 600,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>A</span>
        ) : row.payment_mode === 'MONTHLY' ? (
          <span title="Mensuel" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 18, padding: '0 6px',
            borderRadius: 4,
            background: '#E9F3F7', // Notion blue light
            color: '#337EA9',       // Notion blue text
            fontSize: 11, fontWeight: 600,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>M</span>
        ) : <EmptyCell />
      ))}

      {/* Modalités — Modalité de paiement */}
      {keys.includes('paymentSpec') && C('paymentSpec', (
        <EditableSelect
          value={row.payment_specificity}
          options={PAYMENT_SPECIFICITIES}
          onCommit={patch('payment_specificity')}
          pillColors={PAYMENT_SPECIFICITY_COLORS}
          pillFallback={PAYMENT_SPECIFICITY_FALLBACK}
          notionSolid
          placeholderItalic
          placeholder="Modalité"
        />
      ))}

      {/* Modalités — Prélèvement automatisé */}
      {keys.includes('autoDebit') && C('autoDebit', (
        <EditableSelect
          value={row.auto_debit}
          options={AUTO_DEBIT_OPTIONS}
          onCommit={patch('auto_debit')}
          pillColors={AUTO_DEBIT_COLORS}
          pillFallback={AUTO_DEBIT_FALLBACK}
          notionSolid
          placeholderItalic
          truncate
          placeholder="Prélèvement"
        />
      ))}

      {/* Retard — Retard de paiement mois courant (somme owner+optilex) */}
      {keys.includes('overdueCurrent') && C('overdueCurrent', (
        <OverduePill amount={overdueCurrentTotal} />
      ))}

      {/* ── OWNER block ───────────────────────────────────────────────── */}

      {/* Owner — Montant Attendu (dynamique : reste à percevoir) */}
      {keys.includes('expectedOwner') && C('expectedOwner', (
        <RemainingAmount expected={expectedOwner} received={receivedOwner} />
      ))}

      {/* Owner — Montant Récupéré (simple vert + pill verte si surplus) */}
      {keys.includes('receivedOwner') && C('receivedOwner', (
        <AmountWithDelta delta={Math.max(0, receivedOwner - expectedOwner)}>
          <EditableNumber
            value={receivedOwner}
            onCommit={patch('received_owner')}
            align="center"
            placeholderItalic
            valueColor='#0f7b6c'
            valueBold
          />
        </AmountWithDelta>
      ))}

      {/* Owner — Retard sur les mois précédents (cumul) */}
      {keys.includes('overdueOwnerCum') && C('overdueOwnerCum', (
        <OverduePill amount={overdueOwnerCum} />
      ))}

      {/* Owner — Récupéré sur créances passées */}
      {keys.includes('receivedOverdueOwner') && C('receivedOverdueOwner', (
        <AmountWithDelta delta={deltaOverdueOwner}>
          <EditableNumber
            value={recoveredOverdueOwner}
            onCommit={patch('received_overdue_owner')}
            align="center"
            placeholderItalic
            valueColor={getReceivedColor(recoveredOverdueOwner, overdueOwnerCum)}
            valueBold
          />
        </AmountWithDelta>
      ))}

      {/* Owner — Check PSP */}
      {keys.includes('pspOwner') && C('pspOwner', (
        <EditableSelect
          value={row.psp_owner}
          options={PSP_OPTIONS}
          onCommit={patch('psp_owner')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          placeholder="Check"
        />
      ))}

      {/* Owner — Date paiement */}
      {keys.includes('payDateOwner') && C('payDateOwner', (
        <EditableDate
          value={row.payment_date_owner}
          onCommit={patch('payment_date_owner')}
        />
      ))}

      {/* ── OPTI'LEX block ─────────────────────────────────────────────── */}

      {/* Opti'lex — Montant Attendu (dynamique : reste à percevoir) */}
      {keys.includes('expectedOptilex') && C('expectedOptilex', (
        <RemainingAmount expected={expectedOptilex} received={receivedOptilex} />
      ))}

      {/* Opti'lex — Montant Récupéré (simple vert + pill verte si surplus) */}
      {keys.includes('receivedOptilex') && C('receivedOptilex', (
        <AmountWithDelta delta={Math.max(0, receivedOptilex - expectedOptilex)}>
          <EditableNumber
            value={receivedOptilex}
            onCommit={patch('received_optilex_ttc')}
            align="center"
            placeholderItalic
            valueColor='#0f7b6c'
            valueBold
          />
        </AmountWithDelta>
      ))}

      {/* Opti'lex — Retard sur les mois précédents (cumul) */}
      {keys.includes('overdueOptilexCum') && C('overdueOptilexCum', (
        <OverduePill amount={overdueOptilexCum} />
      ))}

      {/* Opti'lex — Récupéré sur créances passées */}
      {keys.includes('receivedOverdueOpti') && C('receivedOverdueOpti', (
        <AmountWithDelta delta={deltaOverdueOptilex}>
          <EditableNumber
            value={recoveredOverdueOptilex}
            onCommit={patch('received_overdue_optilex_ttc')}
            align="center"
            placeholderItalic
            valueColor={getReceivedColor(recoveredOverdueOptilex, overdueOptilexCum)}
            valueBold
          />
        </AmountWithDelta>
      ))}

      {/* Opti'lex — Check PSP */}
      {keys.includes('pspOptilex') && C('pspOptilex', (
        <EditableSelect
          value={row.psp_optilex}
          options={PSP_OPTIONS}
          onCommit={patch('psp_optilex')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          placeholder="Check"
        />
      ))}

      {/* Opti'lex — Date paiement */}
      {keys.includes('payDateOptilex') && C('payDateOptilex', (
        <EditableDate
          value={row.payment_date_optilex}
          onCommit={patch('payment_date_optilex')}
        />
      ))}
    </div>
  );
});

// ── Cell sub-components ─────────────────────────────────────────────────────
// EmptyCell : cellule vide reste vide visuellement (demande dev 2026-05-11
// "on marque pas 'vide', on sait déjà que c'est vide").
function EmptyCell() {
  return null;
}

function SocieteCell({ row }) {
  // Pattern "Société - Nom Prénom" présent sur ~89% des clients ; pour les
  // ~11% restants (clients récents généralement), `representant` sera null
  // et seul le nom de société est affiché. La logique est centralisée dans
  // `splitSocieteRep` (constants.js).
  const { societeName, representant: repFromSociete } = splitSocieteRep(row.client?.societe);
  const representant = row.client?.representative_name || repFromSociete;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      lineHeight: 1.25, minWidth: 0, maxWidth: '100%',
      flex: 1,
    }}>
      <span style={{
        fontSize: CELL_FONT_SIZE, fontWeight: 500, color: N.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
        title={societeName || ''}
      >
        {societeName || <EmptyCell />}
      </span>
      {representant && (
        <span style={{
          fontSize: 12, color: N.textMuted,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
          title={representant}
        >
          {representant}
        </span>
      )}
    </div>
  );
}

function DateReadOnly({ value }) {
  if (!value) return <EmptyCell />;
  return (
    <span style={{ fontSize: CELL_FONT_SIZE, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
      {formatDateFR(value)}
    </span>
  );
}

function ReadOnlyAmount({ value }) {
  if (value === null || value === undefined || value === 0) {
    return <EmptyCell />;
  }
  return (
    <span style={{ fontSize: CELL_FONT_SIZE, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
      {formatEUR(value)}
    </span>
  );
}

// RemainingAmount — colonne Attendu refonte 2026-05-12 (capture #7).
// Affiche dynamiquement le RESTE à percevoir, pas le tarif initial fixe.
//   received = 0           → expected brut (gris)
//   received < expected    → (expected − received) en ORANGE — manquement
//   received ≥ expected    → check ✓ animé en vert (objectif atteint, surplus
//                            géré côté cell Récupéré via pill verte)
function RemainingAmount({ expected, received }) {
  const exp = Number(expected || 0);
  const rec = Number(received || 0);
  const isChecked = rec >= exp && exp > 0;

  // Animation à jouer SEULEMENT si le check passe de false→true pendant que
  // le composant est monté (= validation utilisateur). Au mount initial avec
  // check déjà acquis (= remount virtuoso après scroll), l'animation est
  // skip et le check apparait directement statique.
  // Cf. retour dev capture #12 : l'animation se rejouait à chaque scroll.
  const wasCheckedAtMount = useRef(isChecked);
  const shouldAnimate = isChecked && !wasCheckedAtMount.current;

  if (exp === 0 && rec === 0) return <EmptyCell />;
  if (isChecked) {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <motion.svg
          width={26}
          height={26}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0f7b6c"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <motion.path
            d="M5 12.5 L10 17.5 L19 7"
            initial={shouldAnimate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
          />
        </motion.svg>
      </span>
    );
  }
  // Rien reçu encore → afficher le tarif initial en gris
  if (rec === 0) {
    return (
      <span style={{ fontSize: CELL_FONT_SIZE, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
        {formatEUR(exp)}
      </span>
    );
  }
  // Reçu partiel → restant en orange, animé
  const remaining = exp - rec;
  return (
    <AnimatedAmount
      value={remaining}
      style={{
        fontSize: CELL_FONT_SIZE,
        fontWeight: 700,
        color: '#a4581d',  // orange Notion dark — signal "à percevoir"
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
}

// Montant récupéré : VERT GRAS quand > 0 (demande dev 2026-05-11 capture #33).
function RecoveredAmount({ value, previous }) {
  if (value === null || value === undefined || value === 0) {
    return <EmptyCell />;
  }
  return (
    <AnimatedAmount
      value={Number(value)}
      previous={previous}
      style={{
        fontSize: CELL_FONT_SIZE,
        fontWeight: 700,
        color: '#0f7b6c', // Notion green dark
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
}

// Montant retard : ROUGE GRAS texte direct (avant : pill rouge avec bg).
// Animation décompte quand la valeur diminue (dev capture #33 : "voir descendre
// les chiffres tac tac tac"). MVP : interpole l'ancienne → nouvelle valeur en
// 700ms avec ease-out.
function OverduePill({ amount, previous }) {
  if (!amount || amount === 0) {
    return <EmptyCell />;
  }
  const isPositive = amount > 0;
  return (
    <AnimatedAmount
      value={Number(amount)}
      previous={previous}
      style={{
        fontSize: CELL_FONT_SIZE,
        fontWeight: 700,
        color: isPositive ? '#b74133' : '#0f7b6c', // rouge si retard, vert si trop perçu
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
}

// DeltaPill — pastille à droite du montant Récupéré, signal visuel sur l'écart
// avec le Montant Attendu. Demande dev 2026-05-12 :
//   delta > 0 (trop-perçu)  → pill VERTE  `+X €`
//   delta < 0 (manquement)  → pill ORANGE `−X €`  (orange et non rouge pour
//                            ne pas se confondre avec la colonne Retard mois
//                            courant qui est en rouge gras)
//   delta = 0               → pas de pill
// `pointer-events: none` pour ne pas gêner le clic sur l'EditableNumber voisin.
function DeltaPill({ delta }) {
  if (!delta || delta === 0) return null;
  const positive = delta > 0;
  const formatted = formatEUR(Math.abs(delta));
  return (
    <span
      title={positive ? `Trop-perçu de ${formatted}` : `Manquement de ${formatted}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: positive ? '#d3f1e5' : '#fdecd5',  // vert Notion / orange Notion light
        color:      positive ? '#0f7b6c' : '#a4581d',  // vert dark / orange dark
        borderRadius: 4,
        padding: '0 5px',
        marginLeft: 4,
        fontSize: 10,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.5,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {positive ? '+' : '−'}{formatted}
    </span>
  );
}

// AmountWithDelta — wrapper inline-flex qui pose l'EditableNumber à gauche
// et la DeltaPill à droite. Aligné à droite (justifyContent: flex-end) pour
// matcher le align="right" des cells `amount`.
function AmountWithDelta({ children, delta }) {
  // Brief dev 2026-05-12 : le children (EditableNumber) doit recevoir le click
  // n'importe où dans la cell pour entrer en édition. Donc on l'étend à 100%
  // de la zone via position:relative + wrapper fullsize. La pill est
  // superposée en position absolute à droite (non bloquante : pointerEvents
  // none déjà sur DeltaPill).
  return (
    <span style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }}>
      {children}
      {delta !== 0 && (
        <span style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}>
          <DeltaPill delta={delta} />
        </span>
      )}
    </span>
  );
}

// Helper : couleur du montant Récupéré selon comparaison à l'Attendu.
//   reçu = 0          → undefined (placeholder gris géré par EditableNumber)
//   reçu ≥ attendu    → vert (#0f7b6c)
//   reçu < attendu    → orange (#a4581d) — manquement
function getReceivedColor(received, expected) {
  if (!received || received === 0) return undefined;
  return received >= expected ? '#0f7b6c' : '#a4581d';
}

// Animation décompte / re-count entre ancienne et nouvelle valeur.
// Mémorise la dernière valeur affichée, et interpole vers la nouvelle au
// changement. Si pas de changement → affiche directement (pas de re-render).
export function AnimatedAmount({ value, previous, style }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const duration = 700;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setDisplay(v);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [value]);

  return <span style={style}>{formatEUR(display)}</span>;
}

// ── Public component ────────────────────────────────────────────────────────
// `onOpenClient` is a legacy prop kept so older callers don't break when
// imported. New callers should pass `onOpenRow`.
export default function TableView({
  rows,
  onPatchRow,
  onOpenClient,        // legacy (kept for back-compat)
  onOpenRow,           // (row) → opens the DetailPanel (only via OUVRIR button)
  activeRowId,         // currently focused row in the DetailPanel
  loading,
  searchQuery,
  splitActive = false,
  onShowToast,         // (msg, type) → for comment errors (optional)
  onHiddenColsChange,  // (hiddenCols: Set, labels: {}) → notify parent of hidden cols state
  showAllColsRef,      // ref whose .current = () => show all cols (called from parent)
  showColRef,          // ref whose .current = (key) => show one col (called from parent)
}) {
  const [scrollParent, setScrollParent] = useState(null);
  const { keys: allKeys, cols: allCols } = useColumnConfig(splitActive);

  // ── Hidden columns state ─────────────────────────────────────────────────
  // Persisted in localStorage so the user's column visibility survives page
  // reloads. Sticky columns (numero, societe, etat) can never be hidden.
  const [hiddenCols, setHiddenCols] = useState(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_COLS_LS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        // Filter out any stale keys or sticky keys that shouldn't be hidden.
        return new Set(arr.filter((k) => COLS_FULL[k] && !STICKY_KEYS.has(k)));
      }
    } catch { /* ignore corrupted localStorage */ }
    return new Set();
  });

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_COLS_LS_KEY, JSON.stringify([...hiddenCols]));
    } catch { /* quota exceeded — silent */ }
  }, [hiddenCols]);

  const [collapsingCol, setCollapsingCol] = useState(null);

  const handleHideCol = useCallback((colKey) => {
    if (STICKY_KEYS.has(colKey)) return;
    setCollapsingCol(colKey);
    setTimeout(() => {
      setHiddenCols((prev) => new Set([...prev, colKey]));
      setCollapsingCol(null);
    }, 350);
  }, []);

  const handleShowCol = useCallback((colKey) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.delete(colKey);
      return next;
    });
  }, []);

  const handleShowAllCols = useCallback(() => {
    setHiddenCols(new Set());
  }, []);

  useEffect(() => {
    const labels = {};
    hiddenCols.forEach((k) => {
      const def = COLS_FULL[k];
      if (def) labels[k] = def.shortLabel || COLUMN_LABELS[def.labelKey] || k;
    });
    onHiddenColsChange?.(hiddenCols, labels);
  }, [hiddenCols, onHiddenColsChange]);
  useEffect(() => { if (showAllColsRef) showAllColsRef.current = handleShowAllCols; });
  useEffect(() => { if (showColRef) showColRef.current = handleShowCol; });

  // Derive visible keys/cols/stickyLefts/totalWidth AFTER filtering out hidden.
  // Include collapsing col (still in DOM during animation, but with 0 width).
  const { keys, cols, stickyLefts, totalWidth } = useMemo(() => {
    const visibleKeys = allKeys.filter((k) => !hiddenCols.has(k));
    const visibleCols = visibleKeys.reduce((acc, k) => { acc[k] = allCols[k]; return acc; }, {});
    const stickyKeys = visibleKeys.filter((k) => visibleCols[k].sticky);
    const stickyL = stickyKeys.reduce((acc, k, i) => {
      acc[k] = i === 0 ? 0 : acc[stickyKeys[i - 1]] + visibleCols[stickyKeys[i - 1]].w;
      return acc;
    }, {});
    const tw = visibleKeys.reduce((acc, k) => acc + visibleCols[k].w, 0);
    return { keys: visibleKeys, cols: visibleCols, stickyLefts: stickyL, totalWidth: tw };
  }, [allKeys, allCols, hiddenCols]);

  // Selected cell (style Google Sheets / Notion) : border bleue + point cyan bas-droite.
  // {rowId, colKey} ou null. Click sur une cell → la sélectionne. Click ailleurs / ESC → désélection.
  const [selectedCell, setSelectedCell] = useState(null);

  // Comment popup state — {rowId, colKey, anchorRect} or null.
  // anchorRect is the DOMRect of the trigger button (bulle) so the popup can
  // position itself relative to the viewport.
  const [commentPopup, setCommentPopup] = useState(null);

  // Comment counts cache (MVP option C) : { [rowId]: { [colKey]: count } }.
  // Populated lazily : every time the user opens a popup, we update the count
  // here so the pastille appears next time. Lives in component state only (no
  // localStorage persistence — finance team works in single-session bursts).
  const [commentCounts, setCommentCounts] = useState({});

  // Current user (for ownership check on edit/delete). Read once on mount —
  // user identity doesn't change mid-session (auth flow redirects to /login).
  const currentUser = useMemo(() => apiClient.getUser(), []);

  useEffect(() => {
    if (!selectedCell && !commentPopup) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // ESC : ferme d'abord le popup commentaires (s'il est ouvert), puis
        // la sélection. Le popup gère son propre ESC interne aussi (priorité
        // au cancel edit s'il est en mode édition).
        if (commentPopup) setCommentPopup(null);
        else setSelectedCell(null);
      }
    };
    const onClick = (e) => {
      // Ignore clicks inside the comment popup (geré par CommentPopup lui-même).
      if (e.target.closest?.('[data-tsf-comment-trigger]')) return;
      if (!e.target.closest?.('.tsf-row') && !e.target.closest?.('[data-tsf-selectable]')) {
        setSelectedCell(null);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [selectedCell, commentPopup]);

  // Open the comment popup for a specific (rowId, colKey). Also sets the
  // selectedCell so the visual state stays consistent (border bleue).
  const handleOpenCommentPopup = useCallback((rowId, colKey, anchorRect) => {
    setSelectedCell({ rowId, colKey });
    setCommentPopup({ rowId, colKey, anchorRect });
  }, []);

  const handleCloseCommentPopup = useCallback(() => {
    setCommentPopup(null);
  }, []);

  // Called by CommentPopup whenever the comment list changes (fetch, add, delete)
  // so the pastille on the cell updates live.
  const updateCommentCount = useCallback((rowId, colKey, count) => {
    setCommentCounts((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [colKey]: count },
    }));
  }, []);

  // Local filter — search by société or numéro client (case-insensitive).
  const filtered = useMemo(() => {
    if (!searchQuery?.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) =>
      (r.client?.societe || '').toLowerCase().includes(q) ||
      (r.client?.numero_client || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  if (loading) {
    return <SkeletonTable keys={keys} cols={cols} stickyLefts={stickyLefts} />;
  }

  if (!filtered.length) {
    return (
      <div style={{
        padding: '64px 24px', textAlign: 'center',
        color: N.textMuted, fontSize: 13.5,
      }}>
        {searchQuery?.trim()
          ? `Aucun client ne correspond à « ${searchQuery} » sur cette période.`
          : 'Aucune ligne pour cette période.'}
      </div>
    );
  }

  // Resolve onOpenRow with legacy fallback (onOpenClient takes client_id).
  const handleOpenRow = (row) => {
    if (onOpenRow) onOpenRow(row);
    else if (onOpenClient) onOpenClient(row.client_id);
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      ref={setScrollParent}
      className="tsf-scroll"
      style={{
        marginTop: 8,
        background: N.pageBg,
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
        border: `1px solid ${N.borderSft}`,
        borderRadius: 14,
      }}
    >
      <div style={{
        width: totalWidth + GUTTER,
        minWidth: totalWidth + GUTTER,
        position: 'relative',
      }}>
        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: N.pageBg }}>
          <Header
            keys={keys}
            cols={cols}
            stickyLefts={stickyLefts}
            hiddenCols={hiddenCols}
            onHideCol={handleHideCol}
            onShowCol={handleShowCol}
            allKeys={allKeys}
            collapsingCol={collapsingCol}
          />
        </div>

        {/* Virtualized body */}
        {scrollParent && (
          <Virtuoso
            customScrollParent={scrollParent}
            data={filtered}
            totalCount={filtered.length}
            itemContent={(_, row) => (
              <RowRenderer
                row={row}
                onPatchRow={onPatchRow}
                onOpenRow={handleOpenRow}
                isActive={activeRowId === row.id}
                cols={cols}
                keys={keys}
                stickyLefts={stickyLefts}
                collapsingCol={collapsingCol}
                selectedColKey={selectedCell?.rowId === row.id ? selectedCell.colKey : null}
                onSelectCell={(rowId, colKey) => setSelectedCell({ rowId, colKey })}
                rowCommentCounts={commentCounts[row.id]}
                onOpenCommentPopup={handleOpenCommentPopup}
              />
            )}
          />
        )}

        {/* "+ Nouvelle ligne" footer (Notion-style) */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%',
            padding: '10px 12px 10px 38px',
            border: 'none', borderTop: `1px solid ${N.borderSft}`,
            background: 'transparent',
            color: N.textFaint,
            cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit',
            textAlign: 'left',
            position: 'sticky', left: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = N.rowHover; e.currentTarget.style.color = N.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N.textFaint; }}
        >
          <Plus size={13} />
          Nouvelle ligne
        </button>
      </div>
    </motion.div>

    {/* Comment popup — portalisé sur document.body via createPortal interne.
        Affiché au-dessus de la table, ancré au bouton bulle de la cell. */}
    <CommentPopup
      open={!!commentPopup}
      periodRowId={commentPopup?.rowId || null}
      fieldName={commentPopup ? COMMENTABLE_FIELDS[commentPopup.colKey] : null}
      anchorRect={commentPopup?.anchorRect || null}
      onClose={handleCloseCommentPopup}
      currentUser={currentUser}
      onCountChange={(count) => {
        if (!commentPopup) return;
        updateCommentCount(commentPopup.rowId, commentPopup.colKey, count);
      }}
      onError={(msg) => onShowToast?.(msg, 'error')}
    />
    </>
  );
}

// ── Skeleton (loading state) ────────────────────────────────────────────────
function SkeletonTable({ keys, cols, stickyLefts }) {
  return (
    <div style={{ background: N.pageBg, overflow: 'hidden' }}>
      <Header keys={keys} cols={cols} stickyLefts={stickyLefts} />
      <div style={{ padding: 0 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', height: ROW_HEIGHT,
            borderBottom: `1px solid ${N.borderSft}`,
            opacity: 1 - i * 0.06,
          }}>
            <div style={{ width: GUTTER, flex: `0 0 ${GUTTER}px` }} />
            {keys.map((k) => (
              <div key={k} style={{
                width: cols[k].w, flex: `0 0 ${cols[k].w}px`,
                padding: `8px ${CELL_PAD_X}px`,
                borderRight: cols[k].heavyRight
                  ? `3px solid ${N.borderHeavy}`
                  : `1px solid ${N.borderSft}`,
              }}>
                <div style={{
                  height: 12, background: '#ececeb',
                  borderRadius: 4, width: '70%',
                  animation: 'tsfPulse 1.4s ease-in-out infinite',
                }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
