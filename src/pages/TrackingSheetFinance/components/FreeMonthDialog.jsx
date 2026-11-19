// FreeMonthDialog.jsx — offrir une échéance au client qui a parrainé (dev 2026-11-19).
//
// « Si le parrainage est validé, la facturation a un bouton dans Actions qui annule une des échéances : le client a
// droit à un mois gratuit Owner et Opti'Lex. » Pas de mécanique nouvelle : le geste existant « réduction » à 100 %
// sur le mois choisi (POST /expected, kind 'discount'). Il est donc tracé dans l'historique, annulable dans le
// journal, et une demande de l'équipe passe par la direction comme toute modification d'attendu.

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift } from 'lucide-react';

import { formatEUR, formatMonthLabel } from '../constants.js';
import { freeMonthBody, freeMonthChoices } from '../freeMonth.js';

const N = {
  text: '#1c1b19',
  textMuted: '#8b867e',
  textFaint: '#a8a39b',
  border: '#e3ded6',
  borderSft: '#ebe8e3',
  sideBg: '#f7f5f2',
  red: '#c5221f',
};

export default function FreeMonthDialog({ open, client, periods, clientMode, onClose, onSubmit }) {
  const choices = useMemo(() => freeMonthChoices(periods, { clientMode }), [periods, clientMode]);
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setMonth(choices[0]?.key || ''); setError(null); setBusy(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = choices.find((c) => c.key === month) || null;
  const ready = !!picked;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(freeMonthBody(picked.key), picked);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Enregistrement impossible');
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="free-month-backdrop"
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
          role="dialog"
          aria-label="Offrir un mois"
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
              <Gift size={18} style={{ color: N.textMuted, marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: N.text }}>Offrir un mois (parrainage)</div>
                <div style={{
                  fontSize: 12, color: N.textMuted, marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {client?.company_name || client?.societe || '—'}
                  {client?.numero_client ? ` · ${client.numero_client}` : ''}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" style={{
              border: 'none', background: 'transparent', color: N.textMuted, cursor: 'pointer', padding: 4,
            }}>
              <X size={16} />
            </button>
          </div>

          <section style={{ padding: '16px 20px 6px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: N.text, marginBottom: 8 }}>Échéance offerte</div>
            {choices.length === 0 ? (
              <div style={{ fontSize: 12.5, color: N.textMuted }}>Aucune échéance à venir sans paiement.</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Échéance offerte"
                  style={{
                    border: `1px solid ${N.border}`, borderRadius: 7, padding: '7px 9px', minWidth: 170,
                    fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: N.text, outline: 'none',
                  }}
                >
                  {choices.map((c) => (
                    <option key={c.key} value={c.key}>{formatMonthLabel(c.key)}</option>
                  ))}
                </select>
                {picked && (
                  <span style={{ fontSize: 12, color: N.textMuted }}>
                    Owner {formatEUR(picked.owner)} · Opti&apos;Lex {formatEUR(picked.optilex)}
                  </span>
                )}
              </div>
            )}
          </section>

          {error && (
            <div style={{ margin: '8px 20px 0', fontSize: 12, color: N.red }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px' }}>
            <button type="button" onClick={onClose} style={{
              border: `1px solid ${N.border}`, background: '#fff', color: N.text, borderRadius: 7,
              padding: '8px 14px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready || busy}
              style={{
                border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12.5, fontWeight: 500,
                fontFamily: 'inherit',
                background: ready ? N.text : N.sideBg, color: ready ? '#fff' : N.textFaint,
                cursor: ready && !busy ? 'pointer' : 'default',
              }}
            >
              {busy ? 'Enregistrement…' : picked ? `Offrir ${formatMonthLabel(picked.key).toLowerCase()}` : 'Offrir le mois'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
