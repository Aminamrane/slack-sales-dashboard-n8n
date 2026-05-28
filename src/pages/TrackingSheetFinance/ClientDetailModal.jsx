// ⚠️ LEGACY — superseded by `DetailPanel.jsx` (slide-in right panel) on 2026-05-08.
// Kept on disk for safety + visual reference. No longer imported by index.jsx.
// Do not delete without explicit dev validation.
//
// ClientDetailModal.jsx — modal showing a full client timeline + audit.
//
// Two views (toggled via tabs) :
//   1. Timeline : table of all monthly periods for this client (8+ months).
//      Used to navigate the client's history without changing the main
//      month selector. Each period row links to the audit panel.
//   2. Audit   : history of changes for the currently focused row
//      (defaults to the row that triggered the modal opening).
//
// Pure UI — fetches via apiClient on mount. Closes via Escape, backdrop
// click, or the X button. Mounted as a portal (document.body).

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, Calendar, ChevronRight } from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import {
  formatEUR,
  formatDateFR,
  formatMonthLabel,
  periodFromDate,
  ETAT_COLORS,
  ETAT_FALLBACK,
  STATUS_DETAIL_COLORS,
  AUDIT_FIELD_LABELS,
} from './constants.js';

const BACKDROP_STYLE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(2px)',
  zIndex: 9000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const PANEL_STYLE = {
  background: '#fff',
  borderRadius: 14,
  width: 'min(960px, 100%)',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 28px 56px rgba(0,0,0,0.22)',
  overflow: 'hidden',
};

export default function ClientDetailModal({
  open,
  clientId,
  initialRowId,
  onClose,
}) {
  const [tab, setTab] = useState('timeline'); // 'timeline' | 'audit'
  const [timeline, setTimeline] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditRowId, setAuditRowId] = useState(null);
  const [auditEntries, setAuditEntries] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Reset state on open / close.
  useEffect(() => {
    if (!open) {
      setTimeline(null);
      setError(null);
      setAuditRowId(null);
      setAuditEntries(null);
      setTab('timeline');
      return;
    }
    setAuditRowId(initialRowId || null);
    setTab(initialRowId ? 'audit' : 'timeline');
  }, [open, initialRowId]);

  // Fetch timeline.
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setLoading(true);
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/timeline`)
      .then((data) => { if (!cancelled) { setTimeline(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  // Fetch audit when a row is focused.
  useEffect(() => {
    if (!open || !auditRowId) {
      setAuditEntries(null);
      return;
    }
    let cancelled = false;
    setAuditLoading(true);
    apiClient.get(`/api/v1/finance-periods/${auditRowId}/audit`)
      .then((data) => { if (!cancelled) setAuditEntries(data); })
      .catch((e) => { if (!cancelled) console.error('[audit]', e); })
      .finally(() => { if (!cancelled) setAuditLoading(false); });
    return () => { cancelled = true; };
  }, [open, auditRowId]);

  // Escape key → close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const client = timeline?.periods?.[0]?.client;
  const periods = timeline?.periods || [];

  const focusedRow = useMemo(
    () => periods.find((p) => p.id === auditRowId) || null,
    [periods, auditRowId]
  );

  const onRowClick = useCallback((rowId) => {
    setAuditRowId(rowId);
    setTab('audit');
  }, []);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={BACKDROP_STYLE}
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.34, 1.2, 0.64, 1] }}
          style={PANEL_STYLE}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            flexShrink: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: '#9ca3af', textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4,
              }}>
                Détail finance client
              </div>
              <h2 style={{
                fontSize: 22, fontWeight: 700, color: '#111827',
                margin: 0, letterSpacing: '-0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {client?.societe || (clientId ? `Client #${clientId}` : '—')}
              </h2>
              {client?.etat && (
                <div style={{ marginTop: 8 }}>
                  <EtatPill etat={client.etat} />
                  {client.finance_contract_end_date && (
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 12 }}>
                      Fin contrat : {formatDateFR(client.finance_contract_end_date)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              title="Fermer"
              style={{
                border: 'none', background: '#f3f4f6', cursor: 'pointer',
                width: 32, height: 32, borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#6b7280', flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#111827'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: '8px 24px 0',
            borderBottom: '1px solid #f3f4f6', flexShrink: 0,
          }}>
            <TabButton
              active={tab === 'timeline'}
              onClick={() => setTab('timeline')}
              icon={Calendar}
              label="Timeline"
              count={periods.length}
            />
            <TabButton
              active={tab === 'audit'}
              onClick={() => setTab('audit')}
              icon={History}
              label="Historique"
              count={auditEntries?.total ?? null}
            />
          </div>

          {/* Body */}
          <div className="tsf-scroll" style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
            {error && (
              <div style={{
                margin: '20px 0', padding: 14,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#991b1b', borderRadius: 8, fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {tab === 'timeline' && (
              <TimelineTable
                periods={periods}
                loading={loading}
                onRowClick={onRowClick}
              />
            )}
            {tab === 'audit' && (
              <AuditPanel
                focusedRow={focusedRow}
                periods={periods}
                onPickRow={setAuditRowId}
                entries={auditEntries}
                loading={auditLoading}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        padding: '10px 14px', fontSize: 13, fontWeight: 500,
        color: active ? '#111827' : '#6b7280',
        borderBottom: `2px solid ${active ? '#6366f1' : 'transparent'}`,
        marginBottom: -1, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      <Icon size={14} />
      {label}
      {count !== null && count !== undefined && (
        <span style={{
          background: active ? '#eef2ff' : '#f3f4f6',
          color: active ? '#4338ca' : '#6b7280',
          padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function EtatPill({ etat }) {
  const meta = ETAT_COLORS[etat] || ETAT_FALLBACK;
  return (
    <span style={{
      background: meta.bg, color: meta.fg,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 500,
    }}>
      {meta.label}
    </span>
  );
}

function TimelineTable({ periods, loading, onRowClick }) {
  if (loading) {
    return (
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: 36, background: '#f3f4f6', borderRadius: 6,
            animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.1,
          }} />
        ))}
      </div>
    );
  }
  if (!periods.length) {
    return <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>Aucune ligne.</div>;
  }
  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 56px',
        gap: 8, padding: '8px 12px',
        fontSize: 11, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <div>Période</div>
        <div style={{ textAlign: 'right' }}>Att. global</div>
        <div style={{ textAlign: 'right' }}>Reçu Owner</div>
        <div style={{ textAlign: 'right' }}>Reçu Opti'Lex</div>
        <div>Statut</div>
        <div></div>
      </div>
      {periods.map((p) => {
        const detailMeta = (p.finance_status_detail && STATUS_DETAIL_COLORS[p.finance_status_detail]) || null;
        return (
          <button
            key={p.id}
            onClick={() => onRowClick(p.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 56px',
              gap: 8,
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: '1px solid #f9fafb',
              textAlign: 'left',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1f2937',
              transition: 'background 0.12s',
              alignItems: 'center',
              width: '100%',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontWeight: 500 }}>{formatMonthLabel(periodFromDate(p.period))}</div>
            <div style={{ textAlign: 'right' }}>{formatEUR(p.expected_global_ttc)}</div>
            <div style={{ textAlign: 'right', color: '#374151' }}>{formatEUR(p.received_owner)}</div>
            <div style={{ textAlign: 'right', color: '#374151' }}>{formatEUR(p.received_optilex_ttc)}</div>
            <div>
              {p.finance_status_detail ? (
                <span style={{
                  background: detailMeta?.bg || '#f3f4f6',
                  color: detailMeta?.fg || '#6b7280',
                  padding: '2px 8px', borderRadius: 999,
                  fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                  display: 'inline-block', maxWidth: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.finance_status_detail}
                </span>
              ) : (
                <span style={{ color: '#9ca3af' }}>—</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ChevronRight size={14} style={{ color: '#9ca3af' }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AuditPanel({ focusedRow, periods, onPickRow, entries, loading }) {
  return (
    <div style={{ paddingTop: 16 }}>
      {/* Period picker (compact) */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16,
      }}>
        {periods.map((p) => {
          const isActive = focusedRow?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onPickRow(p.id)}
              style={{
                border: 'none', outline: 'none',
                background: isActive ? '#1f2937' : '#f3f4f6',
                color: isActive ? '#fff' : '#374151',
                padding: '5px 10px', borderRadius: 999, fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s',
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {formatMonthLabel(periodFromDate(p.period))}
            </button>
          );
        })}
      </div>

      {!focusedRow ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Sélectionne une période pour voir son historique.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              height: 56, background: '#f3f4f6', borderRadius: 8,
              animation: 'tsfPulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.12,
            }} />
          ))}
        </div>
      ) : !entries?.entries?.length ? (
        <div style={{
          padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13,
          background: '#fafafa', borderRadius: 8,
        }}>
          Aucune modification enregistrée pour cette période.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.entries.map((e) => (
            <AuditRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }) {
  const label = AUDIT_FIELD_LABELS[entry.field_name] || entry.field_name;
  return (
    <div style={{
      padding: '12px 14px',
      background: '#fff',
      border: '1px solid #f3f4f6',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {formatAuditDate(entry.changed_at)} · {entry.changed_by_name || '—'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <AuditValue v={entry.old_value} muted />
        <span style={{ color: '#9ca3af' }}>→</span>
        <AuditValue v={entry.new_value} />
      </div>
    </div>
  );
}

function AuditValue({ v, muted = false }) {
  const display = v === null || v === undefined || v === '' ? '∅' : String(v);
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      background: muted ? '#f9fafb' : '#eef2ff',
      color: muted ? '#9ca3af' : '#3730a3',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      maxWidth: 360,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
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
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
