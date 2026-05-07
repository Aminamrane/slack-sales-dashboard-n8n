// TableView.jsx — virtualized table for the Tracking Finance page.
//
// Why virtualization :
//   The endpoint returns one row per client per month. Today : 559 rows.
//   Tomorrow : 1500-2000. Mounting that many DOM nodes kills the page.
//   `react-virtuoso` (already in deps) renders only what's visible + a
//   small overscan window. ~30 row mounts at any time on a 1080p screen.
//
// Why a custom layout (not <table>) :
//   Sticky multi-column behavior + virtualization is fragile on real
//   tables. We use a CSS grid per row with a frozen left zone via
//   `position: sticky; left: 0; z-index`. Header repeats the same grid.
//   This is the same technique TrackingSheet uses (cf. sticky cols).
//
// All cells are pure functions of `row` props ; mutations are committed via
// the `onPatchRow(rowId, patch)` callback passed from the parent. The parent
// owns the data and applies optimistic updates.

import React, { useMemo, useState, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import { History, ExternalLink } from 'lucide-react';

import {
  PSP_OPTIONS,
  FINANCE_STATUS_DETAILS,
  PAYMENT_SPECIFICITIES,
  AUTO_DEBIT_OPTIONS,
  PAYMENT_MODES,
  EMPLOYEE_RANGES,
  STATUS_DETAIL_COLORS,
  STATUS_DETAIL_FALLBACK,
  ETAT_COLORS,
  ETAT_FALLBACK,
  formatEUR,
  toNumber,
} from './constants.js';
import { EditableNumber, EditableDate, EditableSelect } from './EditableCell.jsx';

// ── Column layout (px). Sums to the total grid width. ───────────────────
// Sticky cols on the left (frozen). Adjust here if labels grow.
const COLS = {
  societe:           { w: 220, label: 'Société',           sticky: true },
  etat:              { w: 110, label: 'État',              sticky: true },
  employeeRange:     { w:  90, label: 'Tranche',           sticky: true },
  paymentMode:       { w:  90, label: 'Mode',              sticky: true },
  expectedOwner:     { w: 110, label: 'Att. Owner',        group: 'Attendu' },
  expectedOptilex:   { w: 110, label: "Att. Opti'Lex",     group: 'Attendu' },
  expectedGlobal:    { w: 110, label: 'Att. Global TTC',   group: 'Attendu' },
  receivedOwner:     { w: 110, label: 'Reçu Owner',        group: 'Reçu' },
  receivedOptilex:   { w: 110, label: "Reçu Opti'Lex",     group: 'Reçu' },
  overdueOwnerCM:    { w: 110, label: 'Retard mois Owner', group: 'Retard mois' },
  overdueOptilexCM:  { w: 110, label: "Retard mois Opti'Lex", group: 'Retard mois' },
  overdueOwnerCum:   { w: 110, label: 'Cumul Owner',       group: 'Retard cumulé' },
  overdueOptilexCum: { w: 110, label: "Cumul Opti'Lex",    group: 'Retard cumulé' },
  recoveredOwner:    { w: 110, label: 'Reçu créance Owner',     group: 'Récupéré créances' },
  recoveredOptilex:  { w: 110, label: "Reçu créance Opti'Lex",  group: 'Récupéré créances' },
  paymentDateOwner:  { w: 120, label: 'Date paie. Owner',  group: 'Date paiement' },
  paymentDateOpti:   { w: 120, label: "Date paie. Opti'Lex", group: 'Date paiement' },
  pspOwner:          { w: 120, label: 'PSP Owner',         group: 'Check PSP' },
  pspOptilex:        { w: 120, label: "PSP Opti'Lex",      group: 'Check PSP' },
  statusDetail:      { w: 200, label: 'Détail état',       group: 'Statut & options' },
  paymentSpec:       { w: 130, label: 'Particularité',     group: 'Statut & options' },
  autoDebit:         { w: 150, label: 'Prélèv. auto',      group: 'Statut & options' },
  audit:             { w:  56, label: '',                  group: '' },
};

const COL_KEYS = Object.keys(COLS);

const stickyKeys = COL_KEYS.filter((k) => COLS[k].sticky);
const STICKY_WIDTH = stickyKeys.reduce((acc, k) => acc + COLS[k].w, 0);
const TOTAL_WIDTH = COL_KEYS.reduce((acc, k) => acc + COLS[k].w, 0);

// Cumulative left offsets for sticky cols.
const STICKY_LEFTS = stickyKeys.reduce((acc, k, i) => {
  acc[k] = i === 0 ? 0 : acc[stickyKeys[i - 1]] + COLS[stickyKeys[i - 1]].w;
  return acc;
}, {});

// ── Header (3 layers : group, label, dummy spacing) ──────────────────────
function Header() {
  // Build group chunks : list of { group, fromIdx, toIdx, w }.
  const groups = [];
  let i = 0;
  while (i < COL_KEYS.length) {
    const k = COL_KEYS[i];
    const g = COLS[k].group ?? null;
    let j = i;
    while (j < COL_KEYS.length && (COLS[COL_KEYS[j]].group ?? null) === g) j++;
    const w = COL_KEYS.slice(i, j).reduce((a, kk) => a + COLS[kk].w, 0);
    groups.push({ g, fromIdx: i, toIdx: j, w, sticky: COLS[k].sticky });
    i = j;
  }

  return (
    <div style={{ background: '#fff' }}>
      {/* Row 1 — group bands */}
      <div style={{
        display: 'flex',
        height: 28,
        borderBottom: '1px solid #e5e7eb',
        background: '#fafafa',
      }}>
        {groups.map((grp, idx) => (
          <div
            key={`grp-${idx}`}
            style={{
              width: grp.w,
              flex: `0 0 ${grp.w}px`,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderRight: '1px solid #e5e7eb',
              position: grp.sticky ? 'sticky' : undefined,
              left: grp.sticky ? 0 : undefined,
              background: '#fafafa',
              zIndex: grp.sticky ? 3 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {grp.g || ''}
          </div>
        ))}
      </div>

      {/* Row 2 — column labels */}
      <div style={{
        display: 'flex',
        height: 36,
        borderBottom: '1.5px solid #d1d5db',
        background: '#fff',
      }}>
        {COL_KEYS.map((k) => {
          const c = COLS[k];
          return (
            <div
              key={k}
              style={{
                width: c.w,
                flex: `0 0 ${c.w}px`,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: '#374151',
                borderRight: '1px solid #f3f4f6',
                position: c.sticky ? 'sticky' : undefined,
                left: c.sticky ? STICKY_LEFTS[k] : undefined,
                background: '#fff',
                zIndex: c.sticky ? 3 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {c.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Row renderer ────────────────────────────────────────────────────────
const RowRenderer = React.memo(function RowRenderer({ row, onPatchRow, onOpenClient, onOpenAudit, dimmed }) {
  const cellStyle = (k, extra = {}) => {
    const c = COLS[k];
    return {
      width: c.w,
      flex: `0 0 ${c.w}px`,
      padding: '4px 8px',
      borderRight: '1px solid #f3f4f6',
      position: c.sticky ? 'sticky' : undefined,
      left: c.sticky ? STICKY_LEFTS[k] : undefined,
      background: c.sticky ? '#fff' : undefined,
      zIndex: c.sticky ? 2 : 0,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      ...extra,
    };
  };

  const patch = useCallback((field) => (value) => onPatchRow(row.id, { [field]: value }), [row.id, onPatchRow]);

  const overdueOwnerCM = toNumber(row.overdue_owner_current_month) || 0;
  const overdueOptilexCM = toNumber(row.overdue_optilex_current_month) || 0;
  const overdueOwnerCum = toNumber(row.overdue_owner_cumulative) || 0;
  const overdueOptilexCum = toNumber(row.overdue_optilex_cumulative) || 0;

  const etatMeta = (row.client?.etat && ETAT_COLORS[row.client.etat]) || ETAT_FALLBACK;

  return (
    <div
      style={{
        display: 'flex',
        height: 38,
        borderBottom: '1px solid #f3f4f6',
        opacity: dimmed ? 0.45 : 1,
        transition: 'opacity 0.15s, background 0.12s',
        background: '#fff',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      {/* Société (clickable → modal) */}
      <div style={cellStyle('societe', { background: '#fff' })}>
        <button
          onClick={() => onOpenClient(row.client_id)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#1f2937', fontWeight: 500, fontSize: 13,
            padding: '2px 0', textAlign: 'left',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
            maxWidth: '100%',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#6366f1'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#1f2937'}
          title={row.client?.societe || `Client ${row.client_id}`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.client?.societe || `Client #${row.client_id}`}
          </span>
          <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
        </button>
      </div>

      {/* État */}
      <div style={cellStyle('etat')}>
        <span style={{
          background: etatMeta.bg, color: etatMeta.fg,
          padding: '2px 8px', borderRadius: 999,
          fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {etatMeta.label}
        </span>
      </div>

      {/* Tranche salariés (editable) */}
      <div style={cellStyle('employeeRange')}>
        <EditableSelect
          value={row.employee_range}
          options={EMPLOYEE_RANGES}
          onCommit={patch('employee_range')}
          width="100%"
        />
      </div>

      {/* Mode (editable) */}
      <div style={cellStyle('paymentMode')}>
        <EditableSelect
          value={row.payment_mode}
          options={PAYMENT_MODES}
          onCommit={patch('payment_mode')}
          width="100%"
        />
      </div>

      {/* Expected (read-only — server-managed via /recalculate) */}
      <div style={cellStyle('expectedOwner', { justifyContent: 'flex-end' })}>
        <span style={{ fontSize: 13, color: '#374151' }}>{formatEUR(row.expected_owner)}</span>
      </div>
      <div style={cellStyle('expectedOptilex', { justifyContent: 'flex-end' })}>
        <span style={{ fontSize: 13, color: '#374151' }}>{formatEUR(row.expected_optilex_ttc)}</span>
      </div>
      <div style={cellStyle('expectedGlobal', { justifyContent: 'flex-end' })}>
        <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{formatEUR(row.expected_global_ttc)}</span>
      </div>

      {/* Received (editable) */}
      <div style={cellStyle('receivedOwner', { justifyContent: 'flex-end' })}>
        <EditableNumber value={row.received_owner} onCommit={patch('received_owner')} />
      </div>
      <div style={cellStyle('receivedOptilex', { justifyContent: 'flex-end' })}>
        <EditableNumber value={row.received_optilex_ttc} onCommit={patch('received_optilex_ttc')} />
      </div>

      {/* Retard mois courant (read-only, badge if >0) */}
      <div style={cellStyle('overdueOwnerCM', { justifyContent: 'flex-end' })}>
        <OverdueBadge amount={overdueOwnerCM} />
      </div>
      <div style={cellStyle('overdueOptilexCM', { justifyContent: 'flex-end' })}>
        <OverdueBadge amount={overdueOptilexCM} />
      </div>

      {/* Retard cumulé (read-only) */}
      <div style={cellStyle('overdueOwnerCum', { justifyContent: 'flex-end' })}>
        <OverdueBadge amount={overdueOwnerCum} muted />
      </div>
      <div style={cellStyle('overdueOptilexCum', { justifyContent: 'flex-end' })}>
        <OverdueBadge amount={overdueOptilexCum} muted />
      </div>

      {/* Récupéré créances précédentes (editable) */}
      <div style={cellStyle('recoveredOwner', { justifyContent: 'flex-end' })}>
        <EditableNumber value={row.received_overdue_owner} onCommit={patch('received_overdue_owner')} />
      </div>
      <div style={cellStyle('recoveredOptilex', { justifyContent: 'flex-end' })}>
        <EditableNumber value={row.received_overdue_optilex_ttc} onCommit={patch('received_overdue_optilex_ttc')} />
      </div>

      {/* Date paiement (editable) */}
      <div style={cellStyle('paymentDateOwner')}>
        <EditableDate value={row.payment_date_owner} onCommit={patch('payment_date_owner')} />
      </div>
      <div style={cellStyle('paymentDateOpti')}>
        <EditableDate value={row.payment_date_optilex} onCommit={patch('payment_date_optilex')} />
      </div>

      {/* Check PSP (editable dropdown) */}
      <div style={cellStyle('pspOwner')}>
        <EditableSelect value={row.psp_owner} options={PSP_OPTIONS} onCommit={patch('psp_owner')} />
      </div>
      <div style={cellStyle('pspOptilex')}>
        <EditableSelect value={row.psp_optilex} options={PSP_OPTIONS} onCommit={patch('psp_optilex')} />
      </div>

      {/* Statut & options (3 dropdowns) */}
      <div style={cellStyle('statusDetail')}>
        <EditableSelect
          value={row.finance_status_detail}
          options={FINANCE_STATUS_DETAILS}
          onCommit={patch('finance_status_detail')}
          pillColors={STATUS_DETAIL_COLORS}
          pillFallback={STATUS_DETAIL_FALLBACK}
        />
      </div>
      <div style={cellStyle('paymentSpec')}>
        <EditableSelect
          value={row.payment_specificity}
          options={PAYMENT_SPECIFICITIES}
          onCommit={patch('payment_specificity')}
        />
      </div>
      <div style={cellStyle('autoDebit')}>
        <EditableSelect
          value={row.auto_debit}
          options={AUTO_DEBIT_OPTIONS}
          onCommit={patch('auto_debit')}
        />
      </div>

      {/* Audit trail */}
      <div style={cellStyle('audit', { justifyContent: 'center' })}>
        <button
          onClick={() => onOpenAudit(row.id)}
          title="Historique des modifications"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#9ca3af', padding: 4, borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#eef2ff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
        >
          <History size={14} />
        </button>
      </div>
    </div>
  );
});

function OverdueBadge({ amount, muted = false }) {
  if (!amount || amount <= 0) {
    return <span style={{ fontSize: 13, color: '#9ca3af' }}>—</span>;
  }
  return (
    <span style={{
      background: muted ? '#fff7ed' : '#fee2e2',
      color: muted ? '#9a3412' : '#991b1b',
      padding: '2px 8px', borderRadius: 4,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {formatEUR(amount)}
    </span>
  );
}

// ── Public component ────────────────────────────────────────────────────
export default function TableView({
  rows,
  onPatchRow,
  onOpenClient,
  onOpenAudit,
  loading,
  searchQuery,
}) {
  // We need the ref as state so Virtuoso re-renders once the parent is mounted.
  const [scrollParent, setScrollParent] = useState(null);

  // Local filter — search by société (client.societe, case-insensitive).
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => (r.client?.societe || '').toLowerCase().includes(q));
  }, [rows, searchQuery]);

  if (loading) {
    return <SkeletonTable />;
  }

  if (!filtered.length) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        color: '#6b7280', fontSize: 13,
      }}>
        {searchQuery.trim()
          ? `Aucun client ne correspond à « ${searchQuery} » sur cette période.`
          : 'Aucune ligne pour cette période.'}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      ref={setScrollParent}
      className="tsf-scroll"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        overflow: 'auto',          // horizontal scroll on the container
        height: 'min(70vh, 720px)',
        minHeight: 480,
      }}
    >
      {/* Inner content : fixed-width grid that triggers horizontal scroll */}
      <div style={{ width: TOTAL_WIDTH, minWidth: TOTAL_WIDTH, position: 'relative' }}>
        {/* Sticky header — sticks vertically inside the scroll container */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff' }}>
          <Header />
        </div>

        {/* Virtualized body. The Virtuoso scroller IS the parent (useWindowScroll
            equivalent on a custom element via `customScrollParent`). */}
        {scrollParent && (
          <Virtuoso
            customScrollParent={scrollParent}
            data={filtered}
            totalCount={filtered.length}
            itemContent={(_, row) => (
              <RowRenderer
                row={row}
                onPatchRow={onPatchRow}
                onOpenClient={onOpenClient}
                onOpenAudit={onOpenAudit}
                dimmed={row.__dimmed}
              />
            )}
          />
        )}
      </div>
    </motion.div>
  );
}

// ── Skeleton (loading state) ────────────────────────────────────────────
function SkeletonTable() {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
      background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <Header />
      <div style={{ padding: 0 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', height: 38,
            borderBottom: '1px solid #f3f4f6',
            opacity: 1 - i * 0.06,
          }}>
            {COL_KEYS.map((k) => (
              <div key={k} style={{
                width: COLS[k].w, flex: `0 0 ${COLS[k].w}px`,
                padding: '8px 10px', borderRight: '1px solid #f3f4f6',
              }}>
                <div style={{
                  height: 14, background: '#f3f4f6',
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
