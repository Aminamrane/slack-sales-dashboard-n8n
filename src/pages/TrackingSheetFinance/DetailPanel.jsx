// DetailPanel.jsx — Notion-style slide-in right panel for a client + period.
//
// Spec (2026-05-08, dev brief 3e passe) :
//   - Slide-in from the right (Framer x: 100% → 0, 250ms cubic-bezier)
//   - Width ~40% viewport (min 520px). Caller controls the main-area shrink.
//   - All values are EDITABLE inline (sauf calculés overdue_*) — réutilise
//     les mêmes EditableCell/EditableSelect/EditableNumber que la TableView.
//   - Every value gets a <CopyButton /> revealed at hover.
//   - Layout 2 cols Owner | Opti'lex pour toutes les paires (Attendu, Récupéré,
//     Retard cumul, Récupéré créances passées, Check PSP, Date paiement).
//   - Same PATCH endpoint as the table (/api/v1/finance-periods/{row_id}).
//
// Sections (ordre vertical) :
//   1. Header                  (existant : breadcrumb + 4 icônes + X)
//   2. TitleBlock              (société 28px bold + représentant + meta pills)
//   3. Identité client         (Numéro, Société, Représentant, État, État détail,
//                               RDV lancement, RDV onboarding)
//   4. Modalités               (Modalité de paiement, Prélèvement automatisé,
//                               Effectif, Fin contrat)
//   5. Owner | Opti'lex split  (Attendu, Récupéré, Retard mois courant,
//                               Retard cumul, Récupéré créances passées,
//                               Check PSP, Date paiement)
//   6. Audit                   (10 dernières modifs)
//   7. Timeline mensuelle      (périodes du client)
//
// Endpoints :
//   GET   /api/v1/finance-periods/client/{id}/timeline
//   GET   /api/v1/finance-periods/{row_id}/audit
//   PATCH /api/v1/finance-periods/{row_id}  (via onPatchRow prop)

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Maximize2, Minimize2, MoreHorizontal, ChevronsRight,
  Calendar, User, Briefcase, History,
} from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import {
  formatEUR, formatDateFR, formatMonthLabel, periodFromDate, splitSocieteRep,
  ETAT_COLORS, ETAT_FALLBACK,
  ETAT_OPTIONS,
  FINANCE_STATUS_DETAILS, STATUS_DETAIL_COLORS, STATUS_DETAIL_FALLBACK,
  PAYMENT_SPECIFICITIES, PAYMENT_SPECIFICITY_COLORS, PAYMENT_SPECIFICITY_FALLBACK,
  AUTO_DEBIT_OPTIONS, AUTO_DEBIT_COLORS, AUTO_DEBIT_FALLBACK,
  PSP_OPTIONS, PSP_COLORS, PSP_FALLBACK,
  EMPLOYEE_RANGES,
  AUDIT_FIELD_LABELS,
  toNumber,
} from './constants.js';
import {
  EditableNumber, EditableDate, EditableSelect, EditableText, CopyButton,
} from './EditableCell.jsx';

// Notion palette (sync with index.jsx N).
const N = {
  pageBg:    '#ffffff',
  sideBg:    '#f7f7f5',
  sideHover: '#efeeec',
  border:    '#e9e9e7',
  borderSft: '#f1f1ef',
  text:      '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  green:     '#0f7b6c',
  greenBg:   '#cfe9e3',
  red:       '#b74133',
  redBg:     '#ffe2dd',
};

const PANEL_MIN_WIDTH = 520;

export default function DetailPanel({
  open,
  clientId,
  rowId,           // currently focused period row (the one user clicked)
  onClose,
  onSelectRow,     // (rowId) → caller updates rowId
  onPatchRow,      // (rowId, patch) → reuses table's optimistic patch flow
  onShowToast,     // (msg, type?) → reuses page-level toast
  rows,            // current period rows (so we can find focused row immediately)
}) {
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [audit, setAudit] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeline(null);
      setAudit(null);
      setError(null);
      setFullscreen(false);
    }
  }, [open]);

  // Fetch timeline whenever clientId changes
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setLoadingTimeline(true);
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/timeline`)
      .then((data) => { if (!cancelled) { setTimeline(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoadingTimeline(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  // Fetch audit whenever rowId changes
  useEffect(() => {
    if (!open || !rowId) {
      setAudit(null);
      return;
    }
    let cancelled = false;
    setLoadingAudit(true);
    apiClient.get(`/api/v1/finance-periods/${rowId}/audit`)
      .then((data) => { if (!cancelled) setAudit(data); })
      .catch((e) => { if (!cancelled) console.error('[DetailPanel audit]', e); })
      .finally(() => { if (!cancelled) setLoadingAudit(false); });
    return () => { cancelled = true; };
  }, [open, rowId]);

  // ESC handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focused row : prefer the row coming from the table's `rows` prop (fresh
  // optimistic state) before falling back to the timeline payload (less fresh).
  // This guarantees the panel reflects edits made elsewhere immediately.
  const focusedRow = useMemo(() => {
    if (rowId && Array.isArray(rows)) {
      const fromTable = rows.find((r) => r.id === rowId);
      if (fromTable) return fromTable;
    }
    return (timeline?.periods || []).find((p) => p.id === rowId) || null;
  }, [rowId, rows, timeline]);

  const periods = timeline?.periods || [];
  const client = focusedRow?.client || periods[0]?.client || null;
  const etatMeta = (client?.etat && ETAT_COLORS[client.etat]) || ETAT_FALLBACK;

  // Patch helper bound to current rowId — reuses table's onPatchRow flow.
  // Falls back to a direct PATCH if the parent didn't wire onPatchRow.
  const patch = useCallback((field) => async (value) => {
    if (!rowId) return;
    if (onPatchRow) {
      await onPatchRow(rowId, { [field]: value });
    } else {
      await apiClient.patch(`/api/v1/finance-periods/${rowId}`, { [field]: value });
    }
  }, [rowId, onPatchRow]);

  // Etat is on the client, not on the row — backend currently treats `etat`
  // on the finance-periods PATCH as a routed update to clients.etat (cf.
  // existing TableView wiring). We mirror that here.
  const patchEtat = useCallback(async (value) => {
    if (!rowId) return;
    if (onPatchRow) await onPatchRow(rowId, { etat: value });
    else await apiClient.patch(`/api/v1/finance-periods/${rowId}`, { etat: value });
  }, [rowId, onPatchRow]);

  const onCopied = useCallback(() => {
    onShowToast?.('Copié dans le presse-papiers', 'info');
  }, [onShowToast]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="detail-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100vh',
            width: fullscreen ? '100vw' : `clamp(${PANEL_MIN_WIDTH}px, 40vw, 720px)`,
            background: N.pageBg,
            borderLeft: `1px solid ${N.border}`,
            boxShadow: '-12px 0 24px rgba(15,15,15,0.06)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {/* HEADER */}
          <PanelHeader
            client={client}
            onClose={onClose}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
          />

          {/* SCROLLABLE BODY */}
          <div className="tsf-scroll" style={{
            flex: 1, overflowY: 'auto',
            padding: '24px 32px 64px',
          }}>
            {/* Title block */}
            <TitleBlock client={client} etatMeta={etatMeta} focusedRow={focusedRow} onCopied={onCopied} />

            {/* Meta row */}
            <MetaRow client={client} focusedRow={focusedRow} />

            {/* Error state */}
            {error && (
              <div style={{
                marginTop: 20, padding: 12, background: N.redBg,
                color: N.red, borderRadius: 6, fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {/* Section : Identité client */}
            <Section title="Identité client" delay={0.05}>
              <IdentitySection
                client={client}
                focusedRow={focusedRow}
                patch={patch}
                patchEtat={patchEtat}
                onCopied={onCopied}
              />
            </Section>

            {/* Section : Modalités */}
            <Section title="Modalités" delay={0.08}>
              <ModalitesSection
                client={client}
                focusedRow={focusedRow}
                patch={patch}
                onCopied={onCopied}
              />
            </Section>

            {/* Section : Owner | Opti'lex (split 2 cols) */}
            <Section title="Owner | Opti'lex" delay={0.11}>
              <OwnerOptilexSection
                focusedRow={focusedRow}
                patch={patch}
                onCopied={onCopied}
              />
            </Section>

            {/* Section : Audit */}
            <Section title="Historique des modifications" delay={0.14}>
              <AuditList loading={loadingAudit} entries={audit?.entries} />
            </Section>

            {/* Section : Timeline périodes */}
            <Section title="Timeline mensuelle" delay={0.17}>
              <TimelineList
                periods={periods}
                loading={loadingTimeline}
                focusedRowId={rowId}
                onSelectRow={onSelectRow}
              />
            </Section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function PanelHeader({ client, onClose, fullscreen, onToggleFullscreen }) {
  const { societeName } = splitSocieteRep(client?.societe);
  return (
    <div style={{
      height: 44,
      flexShrink: 0,
      display: 'flex', alignItems: 'center',
      gap: 6, padding: '0 12px',
      borderBottom: `1px solid ${N.border}`,
      background: N.pageBg,
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: N.textMuted, minWidth: 0, flex: 1,
      }}>
        <span>Tracking Finance</span>
        <ChevronRight size={12} style={{ color: N.textFaint, flexShrink: 0 }} />
        <span style={{
          color: N.text, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {societeName || 'Client'}
        </span>
      </div>

      {/* Action icons */}
      <button
        onClick={onToggleFullscreen}
        title={fullscreen ? 'Réduire' : 'Étendre en plein écran'}
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        onClick={onClose}
        title="Réduire le panneau"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronsRight size={14} />
      </button>
      <button
        title="Plus d'actions"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <MoreHorizontal size={14} />
      </button>
      <button
        onClick={onClose}
        title="Fermer (Esc)"
        style={iconBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <X size={15} />
      </button>
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', cursor: 'pointer',
  borderRadius: 4, color: N.textMuted,
  transition: 'background 0.12s',
};

// ── Title Block ─────────────────────────────────────────────────────────────
// `focusedRow` reserved for future use (e.g. period badge in the title).
// Kept in the prop list so callers don't break if we re-introduce it.
// eslint-disable-next-line no-unused-vars
function TitleBlock({ client, etatMeta, focusedRow, onCopied }) {
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const rep = client?.representative_name || repFromSociete;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
      {/* État-color circle */}
      <div style={{
        width: 56, height: 56,
        borderRadius: 12,
        background: etatMeta.bg,
        color: etatMeta.fg,
        flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 0 rgba(15,15,15,0.04)',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: etatMeta.fg,
        }} />
      </div>

      {/* Titles */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: N.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          fontWeight: 600, marginBottom: 4,
        }}>
          {client?.numero_client ? `Client ${client.numero_client}` : 'Détail client'}
        </div>
        <span className="tsf-copy-wrap" style={{
          display: 'inline-flex', alignItems: 'flex-start', gap: 6,
          maxWidth: '100%',
        }}>
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: N.text,
            margin: 0, letterSpacing: '-0.02em',
            lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {societeName || '—'}
          </h1>
          {societeName && (
            <CopyButton value={societeName} onCopied={onCopied} size={14} style={{ marginTop: 4 }} />
          )}
        </span>
        {rep && (
          <span className="tsf-copy-wrap" style={{
            marginTop: 6,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, color: N.textMuted,
          }}>
            <span>{rep}</span>
            <CopyButton value={rep} onCopied={onCopied} size={12} />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Meta row (pills) ────────────────────────────────────────────────────────
function MetaRow({ client, focusedRow }) {
  const items = [];
  if (client?.etat) {
    const meta = ETAT_COLORS[client.etat] || ETAT_FALLBACK;
    items.push({
      icon: <span style={{
        width: 8, height: 8, borderRadius: '50%', background: meta.fg,
      }} />,
      label: 'État',
      value: meta.label,
      pillBg: meta.bg, pillFg: meta.fg,
    });
  }
  if (focusedRow?.period) {
    items.push({
      icon: <Calendar size={12} />,
      label: 'Période',
      value: formatMonthLabel(periodFromDate(focusedRow.period)),
    });
  }
  if (focusedRow?.employee_range || client?.employee_range) {
    items.push({
      icon: <Briefcase size={12} />,
      label: 'Effectif',
      value: focusedRow?.employee_range || client?.employee_range,
    });
  }

  if (!items.length) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      marginBottom: 28,
    }}>
      {items.map((it, idx) => (
        <div key={idx} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          borderRadius: 4,
          background: it.pillBg || 'transparent',
          color: it.pillFg || N.textMuted,
          fontSize: 12.5,
          border: it.pillBg ? 'none' : `1px solid ${N.borderSft}`,
          fontWeight: 500,
        }}>
          <span style={{ display: 'inline-flex', color: it.pillFg || N.textFaint }}>
            {it.icon}
          </span>
          <span style={{ color: it.pillFg || N.textMuted }}>{it.label}</span>
          <span style={{
            color: it.pillFg || N.text, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 180,
          }}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      style={{ marginTop: 28 }}
    >
      <h2 style={{
        fontSize: 11, fontWeight: 600, color: N.textMuted,
        margin: '0 0 12px',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

// ── Field row helper ────────────────────────────────────────────────────────
// Renders a label + a value control (any React node) in a horizontal row.
// `copyValue` triggers the hover-revealed Copy button next to the value.
// `controlWidth` lets the editable input take a natural width (Notion-style).
function Field({ label, children, copyValue, onCopied, align = 'right' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 0',
      borderBottom: `1px solid ${N.borderSft}`,
      fontSize: 13,
      minWidth: 0,
    }}>
      <span style={{
        color: N.textMuted, fontSize: 12.5,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flexShrink: 0,
        maxWidth: '55%',
      }}>
        {label}
      </span>
      <span
        className="tsf-copy-wrap"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          minWidth: 0, maxWidth: '100%',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          {children}
        </span>
        {copyValue !== null && copyValue !== undefined && copyValue !== '' && (
          <CopyButton value={copyValue} onCopied={onCopied} size={13} />
        )}
      </span>
    </div>
  );
}

// ── Section : Identité client ───────────────────────────────────────────────
function IdentitySection({ client, focusedRow, patch, patchEtat, onCopied }) {
  if (!focusedRow) return <Empty />;
  // Pattern "Société - Nom Prénom" présent sur la grande majorité des
  // clients (cf. splitSocieteRep dans constants.js). La donnée brute
  // (`client.societe`) reste la "vraie" valeur backend ; on extrait juste
  // l'affichage UI pour cohérence visuelle entre clients anciens et récents.
  const { societeName, representant: repFromSociete } = splitSocieteRep(client?.societe);
  const rep = client?.representative_name || repFromSociete;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Field label="Numéro client" copyValue={client?.numero_client} onCopied={onCopied}>
        <ReadOnlyText value={client?.numero_client} mono />
      </Field>

      <Field label="Société" copyValue={societeName} onCopied={onCopied}>
        <ReadOnlyText value={societeName} />
      </Field>

      <Field label="Représentant" copyValue={rep} onCopied={onCopied}>
        <ReadOnlyText value={rep} />
      </Field>

      <Field label="Téléphone" copyValue={client?.phone} onCopied={onCopied}>
        <ReadOnlyText value={client?.phone} />
      </Field>

      <Field label="Email" copyValue={client?.email} onCopied={onCopied}>
        <ReadOnlyText value={client?.email} />
      </Field>

      <Field label="Email finance" copyValue={focusedRow.finance_email || client?.email} onCopied={onCopied}>
        <EditableText
          value={focusedRow.finance_email}
          placeholder={client?.email || '—'}
          onCommit={patch('finance_email')}
          placeholderItalic={false}
          width="auto"
        />
      </Field>

      <Field label="État" copyValue={client?.etat && (ETAT_COLORS[client.etat]?.label || client.etat)} onCopied={onCopied}>
        <EditableSelect
          value={client?.etat}
          options={ETAT_OPTIONS}
          onCommit={patchEtat}
          pillColors={Object.fromEntries(
            Object.entries(ETAT_COLORS).map(([k, v]) => [k, { fg: v.fg, bg: v.bg }])
          )}
          pillFallback={ETAT_FALLBACK}
          optionLabels={Object.fromEntries(
            Object.entries(ETAT_COLORS).map(([k, v]) => [k, v.label])
          )}
          notionSolid
          placeholderItalic
          width="auto"
        />
      </Field>

      <Field label="État détail" copyValue={focusedRow.finance_status_detail} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.finance_status_detail}
          options={FINANCE_STATUS_DETAILS}
          onCommit={patch('finance_status_detail')}
          pillColors={STATUS_DETAIL_COLORS}
          pillFallback={STATUS_DETAIL_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      </Field>

      <Field label="RDV lancement" copyValue={client?.rdv_lancement && formatDateFR(client.rdv_lancement)} onCopied={onCopied}>
        <ReadOnlyDate value={client?.rdv_lancement} />
      </Field>

      <Field label="RDV onboarding" copyValue={client?.rdv_onboarding && formatDateFR(client.rdv_onboarding)} onCopied={onCopied}>
        <ReadOnlyDate value={client?.rdv_onboarding} />
      </Field>
    </div>
  );
}

// ── Section : Modalités ─────────────────────────────────────────────────────
function ModalitesSection({ client, focusedRow, patch, onCopied }) {
  if (!focusedRow) return <Empty />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Field label="Modalité de paiement" copyValue={focusedRow.payment_specificity} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.payment_specificity}
          options={PAYMENT_SPECIFICITIES}
          onCommit={patch('payment_specificity')}
          pillColors={PAYMENT_SPECIFICITY_COLORS}
          pillFallback={PAYMENT_SPECIFICITY_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      </Field>

      <Field label="Prélèvement automatisé" copyValue={focusedRow.auto_debit} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.auto_debit}
          options={AUTO_DEBIT_OPTIONS}
          onCommit={patch('auto_debit')}
          pillColors={AUTO_DEBIT_COLORS}
          pillFallback={AUTO_DEBIT_FALLBACK}
          notionSolid
          placeholderItalic
          truncate={false}
          width="auto"
        />
      </Field>

      <Field label="Effectif" copyValue={focusedRow.employee_range} onCopied={onCopied}>
        <EditableSelect
          value={focusedRow.employee_range}
          options={EMPLOYEE_RANGES}
          onCommit={patch('employee_range')}
          placeholderItalic
          width="auto"
        />
      </Field>

      <Field label="Fin contrat" copyValue={client?.finance_contract_end_date && formatDateFR(client.finance_contract_end_date)} onCopied={onCopied}>
        <ReadOnlyDate value={client?.finance_contract_end_date} />
      </Field>
    </div>
  );
}

// ── Section : Owner | Opti'lex split (2 cols) ───────────────────────────────
function OwnerOptilexSection({ focusedRow, patch, onCopied }) {
  if (!focusedRow) return <Empty />;

  const overdueOwnerCM   = toNumber(focusedRow.overdue_owner_current_month) || 0;
  const overdueOptilexCM = toNumber(focusedRow.overdue_optilex_current_month) || 0;
  const overdueOwnerCum  = toNumber(focusedRow.overdue_owner_cumulative) || 0;
  const overdueOptilexCum = toNumber(focusedRow.overdue_optilex_cumulative) || 0;

  // Each row in the split has : { label, ownerNode, optiNode, ownerCopy, optiCopy }
  const rowsDef = [
    {
      label: 'Montant Attendu',
      ownerNode: <ReadOnlyAmount value={focusedRow.expected_owner} />,
      optiNode:  <ReadOnlyAmount value={focusedRow.expected_optilex_ttc} />,
      ownerCopy: formatAmountForCopy(focusedRow.expected_owner),
      optiCopy:  formatAmountForCopy(focusedRow.expected_optilex_ttc),
    },
    {
      label: 'Montant Récupéré',
      ownerNode: <EditableNumber value={focusedRow.received_owner} onCommit={patch('received_owner')} align="right" placeholderItalic />,
      optiNode:  <EditableNumber value={focusedRow.received_optilex_ttc} onCommit={patch('received_optilex_ttc')} align="right" placeholderItalic />,
      ownerCopy: formatAmountForCopy(focusedRow.received_owner),
      optiCopy:  formatAmountForCopy(focusedRow.received_optilex_ttc),
    },
    {
      label: 'Retard mois courant',
      ownerNode: <OverdueInline amount={overdueOwnerCM} />,
      optiNode:  <OverdueInline amount={overdueOptilexCM} />,
      ownerCopy: overdueOwnerCM > 0 ? formatEUR(overdueOwnerCM) : null,
      optiCopy:  overdueOptilexCM > 0 ? formatEUR(overdueOptilexCM) : null,
    },
    {
      label: 'Retard mois précédents (cumul)',
      ownerNode: <OverdueInline amount={overdueOwnerCum} />,
      optiNode:  <OverdueInline amount={overdueOptilexCum} />,
      ownerCopy: overdueOwnerCum > 0 ? formatEUR(overdueOwnerCum) : null,
      optiCopy:  overdueOptilexCum > 0 ? formatEUR(overdueOptilexCum) : null,
    },
    {
      label: 'Récupéré sur créances passées',
      ownerNode: <EditableNumber value={focusedRow.received_overdue_owner} onCommit={patch('received_overdue_owner')} align="right" placeholderItalic />,
      optiNode:  <EditableNumber value={focusedRow.received_overdue_optilex_ttc} onCommit={patch('received_overdue_optilex_ttc')} align="right" placeholderItalic />,
      ownerCopy: formatAmountForCopy(focusedRow.received_overdue_owner),
      optiCopy:  formatAmountForCopy(focusedRow.received_overdue_optilex_ttc),
    },
    {
      label: 'Check (PSP)',
      ownerNode: (
        <EditableSelect
          value={focusedRow.psp_owner}
          options={PSP_OPTIONS}
          onCommit={patch('psp_owner')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      ),
      optiNode: (
        <EditableSelect
          value={focusedRow.psp_optilex}
          options={PSP_OPTIONS}
          onCommit={patch('psp_optilex')}
          pillColors={PSP_COLORS}
          pillFallback={PSP_FALLBACK}
          notionSolid
          placeholderItalic
          width="auto"
        />
      ),
      ownerCopy: focusedRow.psp_owner,
      optiCopy:  focusedRow.psp_optilex,
    },
    {
      label: 'Date paiement',
      ownerNode: <EditableDate value={focusedRow.payment_date_owner} onCommit={patch('payment_date_owner')} />,
      optiNode:  <EditableDate value={focusedRow.payment_date_optilex} onCommit={patch('payment_date_optilex')} />,
      ownerCopy: focusedRow.payment_date_owner && formatDateFR(focusedRow.payment_date_owner),
      optiCopy:  focusedRow.payment_date_optilex && formatDateFR(focusedRow.payment_date_optilex),
    },
  ];

  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Header bar : Owner | Opti'lex */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.1fr) 1fr 1fr',
        gap: 0,
        background: N.sideBg,
        fontSize: 11, fontWeight: 600,
        color: N.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        borderBottom: `1px solid ${N.borderSft}`,
      }}>
        <div style={{ padding: '8px 12px' }} />
        <div style={{ textAlign: 'right', padding: '8px 12px 8px 8px' }}>Owner</div>
        <div style={{ textAlign: 'right', padding: '8px 12px 8px 12px', borderLeft: `2px solid ${N.border}` }}>Opti'lex</div>
      </div>

      {rowsDef.map((r, idx) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1.1fr) 1fr 1fr',
            gap: 0,
            borderTop: idx === 0 ? 'none' : `1px solid ${N.borderSft}`,
            fontSize: 13,
            minHeight: 42,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 12px',
            color: N.textMuted, fontSize: 12.5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {r.label}
          </div>

          {/* Owner cell */}
          <div
            className="tsf-copy-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '8px 12px 8px 8px',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
              {r.ownerNode}
            </span>
            {r.ownerCopy !== null && r.ownerCopy !== undefined && r.ownerCopy !== '' && (
              <CopyButton value={r.ownerCopy} onCopied={onCopied} size={13} />
            )}
          </div>

          {/* Opti'lex cell */}
          <div
            className="tsf-copy-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '8px 12px 8px 12px',
              borderLeft: `2px solid ${N.border}`,
              minWidth: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
              {r.optiNode}
            </span>
            {r.optiCopy !== null && r.optiCopy !== undefined && r.optiCopy !== '' && (
              <CopyButton value={r.optiCopy} onCopied={onCopied} size={13} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Read-only / display helpers ─────────────────────────────────────────────
function ReadOnlyText({ value, mono = false }) {
  if (!value) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{
      fontSize: 13.5, color: N.text,
      fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      maxWidth: '100%',
    }}>
      {value}
    </span>
  );
}

function ReadOnlyDate({ value }) {
  if (!value) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{ fontSize: 13.5, color: N.text, fontVariantNumeric: 'tabular-nums' }}>
      {formatDateFR(value)}
    </span>
  );
}

function ReadOnlyAmount({ value }) {
  const n = toNumber(value);
  if (n === null || n === 0) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Vide</span>;
  }
  return (
    <span style={{ fontSize: 13.5, color: N.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
      {formatEUR(n)}
    </span>
  );
}

function OverdueInline({ amount }) {
  if (!amount || amount <= 0) {
    return <span style={{ color: '#c7c7c2', fontStyle: 'italic', fontSize: 13 }}>Aucun</span>;
  }
  return (
    <span style={{
      background: N.redBg,
      color: N.red,
      padding: '2px 10px',
      borderRadius: 4,
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {formatEUR(amount)}
    </span>
  );
}

function formatAmountForCopy(v) {
  const n = toNumber(v);
  if (n === null || n === 0) return null;
  return formatEUR(n);
}

// ── Section : Audit ─────────────────────────────────────────────────────────
function AuditList({ loading, entries }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            height: 52, background: '#f3f4f6', borderRadius: 6,
            animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.1,
          }} />
        ))}
      </div>
    );
  }
  if (!entries?.length) {
    return <Empty text="Aucune modification enregistrée pour cette période." />;
  }
  // Show only the last 10
  const slice = entries.slice(0, 10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {slice.map((e) => (
        <AuditRow key={e.id} entry={e} />
      ))}
    </div>
  );
}

function AuditRow({ entry }) {
  const label = AUDIT_FIELD_LABELS[entry.field_name] || entry.field_name;
  return (
    <div style={{
      padding: '10px 12px',
      background: N.sideBg,
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 4,
      fontSize: 12.5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: N.text,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <History size={11} style={{ color: N.textFaint }} />
          {label}
        </span>
        <span style={{ fontSize: 11, color: N.textFaint, whiteSpace: 'nowrap' }}>
          {formatAuditDate(entry.changed_at)} · {entry.changed_by_name || '—'}
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: N.textMuted, flexWrap: 'wrap',
      }}>
        <AuditValue v={entry.old_value} muted />
        <ChevronRight size={11} style={{ color: N.textFaint }} />
        <AuditValue v={entry.new_value} />
      </div>
    </div>
  );
}

function AuditValue({ v, muted = false }) {
  const display = v === null || v === undefined || v === '' ? '∅' : String(v);
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 3,
      background: muted ? '#ececeb' : '#e7f0fb',
      color: muted ? N.textMuted : '#1e40af',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11.5,
      maxWidth: 220,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {display}
    </span>
  );
}

function formatAuditDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Section : Timeline ──────────────────────────────────────────────────────
function TimelineList({ periods, loading, focusedRowId, onSelectRow }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: 32, background: '#f3f4f6', borderRadius: 4,
            animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.12,
          }} />
        ))}
      </div>
    );
  }
  if (!periods.length) return <Empty text="Aucune période disponible." />;

  return (
    <div style={{
      border: `1px solid ${N.borderSft}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 8,
        padding: '6px 10px',
        background: N.sideBg,
        fontSize: 11, fontWeight: 600,
        color: N.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <div>Période</div>
        <div style={{ textAlign: 'right' }}>Att. global</div>
        <div style={{ textAlign: 'right' }}>Reçu</div>
        <div style={{ textAlign: 'right' }}>Retard mois</div>
      </div>
      {periods.map((p) => {
        const isActive = focusedRowId === p.id;
        const overdue = (Number(p.overdue_owner_current_month) || 0) +
                        (Number(p.overdue_optilex_current_month) || 0);
        const received = (Number(p.received_owner) || 0) +
                         (Number(p.received_optilex_ttc) || 0);
        return (
          <button
            key={p.id}
            onClick={() => onSelectRow?.(p.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 8,
              padding: '8px 10px',
              border: 'none',
              background: isActive ? N.sideHover : 'transparent',
              cursor: 'pointer',
              borderTop: `1px solid ${N.borderSft}`,
              textAlign: 'left',
              fontSize: 13,
              fontFamily: 'inherit',
              color: N.text,
              transition: 'background 0.12s',
              alignItems: 'center',
              width: '100%',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = N.sideBg; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ fontWeight: isActive ? 600 : 500 }}>
              {formatMonthLabel(periodFromDate(p.period))}
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatEUR(p.expected_global_ttc)}
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: N.textMuted }}>
              {formatEUR(received)}
            </div>
            <div style={{ textAlign: 'right' }}>
              {overdue > 0 ? (
                <span style={{
                  background: N.redBg, color: N.red,
                  padding: '2px 8px', borderRadius: 4,
                  fontSize: 12, fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatEUR(overdue)}
                </span>
              ) : (
                <span style={{ color: N.textFaint }}>—</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function Empty({ text = 'Aucune donnée disponible.' }) {
  return (
    <div style={{
      padding: '20px 14px',
      background: N.sideBg,
      borderRadius: 6,
      color: N.textMuted,
      fontSize: 13,
      textAlign: 'center',
    }}>
      {text}
    </div>
  );
}
