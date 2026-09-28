// PromiseDialog.jsx — noter une promesse de règlement.
//
// Demande dev 2026-09-28 : poser une promesse ouvre une fenêtre qui demande la
// date à laquelle le client s'est engagé à régler (« sûrement le mois
// prochain », « peut-être dans deux mois ») et un commentaire OBLIGATOIRE.
// Les raccourcis posent le dernier jour du mois visé ; une date précise reste
// possible.

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Handshake } from 'lucide-react';

import { formatDateFR } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  red: '#b42318',
};

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

// Dernier jour du mois, `offset` mois après le mois courant (heure de Paris).
const endOfMonthISO = (offset) => {
  const [y, m] = todayISO().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset + 1, 0));
  return d.toISOString().slice(0, 10);
};

const QUICK = [
  { key: 0, label: 'Ce mois-ci' },
  { key: 1, label: 'Le mois prochain' },
  { key: 2, label: 'Dans 2 mois' },
  { key: 3, label: 'Dans 3 mois' },
];

export default function PromiseDialog({ open, client, onClose, onSubmit }) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setDate(endOfMonthISO(1)); setNote(''); setError(null); setBusy(false); }
  }, [open]);

  const quickDates = useMemo(() => QUICK.map((q) => ({ ...q, date: endOfMonthISO(q.key) })), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = !!date && date >= todayISO() && note.trim().length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ promised_for: date, note: note.trim() });
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Enregistrement impossible');
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="promise-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10060,
          background: 'rgba(23,23,26,0.34)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(480px, 100%)', maxHeight: '86vh', overflowY: 'auto',
            background: '#fff', borderRadius: 14,
            boxShadow: '0 24px 64px rgba(17,24,39,0.22)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '18px 20px 14px', borderBottom: `1px solid ${N.borderSft}`,
          }}>
            <div style={{ minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Handshake size={18} style={{ color: N.textMuted, marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: N.text }}>Noter une promesse de règlement</div>
                <div style={{
                  fontSize: 12, color: N.textMuted, marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {client?.company_name || client?.societe || '—'}
                  {client?.numero_client ? ` · ${client.numero_client}` : ''}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{
              border: 'none', background: 'transparent', color: N.textMuted, cursor: 'pointer', padding: 4,
            }}>
              <X size={16} />
            </button>
          </div>

          <section style={{ padding: '16px 20px 6px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: N.text, marginBottom: 8 }}>
              Règlement promis pour
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {quickDates.map((q) => {
                const actif = date === q.date;
                return (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => setDate(q.date)}
                    title={`Jusqu'au ${formatDateFR(q.date)}`}
                    style={{
                      height: 30, padding: '0 11px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${actif ? N.text : N.border}`,
                      background: actif ? N.text : '#fff', color: actif ? '#fff' : N.text,
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: actif ? 600 : 500,
                    }}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                value={date}
                min={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  border: `1px solid ${N.border}`, borderRadius: 7, padding: '7px 9px',
                  fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: N.text, outline: 'none',
                }}
              />
              <span style={{ fontSize: 11.5, color: N.textMuted }}>
                {date ? `Le client s'engage à régler au plus tard le ${formatDateFR(date)}.` : 'Choisissez une date.'}
              </span>
            </div>
          </section>

          <section style={{ padding: '14px 20px 4px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: N.text, marginBottom: 6 }}>
              Commentaire <span style={{ color: N.red, fontWeight: 600 }}>obligatoire</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Ce que le client a dit, par quel canal, le montant annoncé…"
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                border: `1px solid ${N.border}`, borderRadius: 8, padding: '9px 10px',
                fontSize: 12.5, fontFamily: 'inherit', color: N.text, outline: 'none', lineHeight: 1.45,
              }}
            />
          </section>

          {error && (
            <div style={{ margin: '8px 20px 0', fontSize: 12, color: N.red }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px' }}>
            <button type="button" onClick={onClose} style={{
              border: `1px solid ${N.border}`, background: '#fff', color: N.text, borderRadius: 7,
              padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready || busy}
              title={ready ? '' : 'Une date et un commentaire sont nécessaires'}
              style={{
                border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                fontFamily: 'inherit',
                background: ready ? N.text : N.sideBg, color: ready ? '#fff' : N.textFaint,
                cursor: ready && !busy ? 'pointer' : 'default',
              }}
            >
              {busy ? 'Enregistrement…' : 'Noter la promesse'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
