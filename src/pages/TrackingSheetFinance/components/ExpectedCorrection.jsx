// ExpectedCorrection.jsx — corriger l'attendu, mois par mois.
//
// Demande dev 2026-09-02 : « Ismahane doit pouvoir supprimer des attendus pour
// le mois ou sur des mois précédents, supprimer des créances antérieures, et
// si elle le veut les reporter sur les mois d'après. C'est son choix. »
//
// À NE PAS CONFONDRE AVEC UNE PERTE. Une perte, c'est de l'argent abandonné,
// compté comme tel dans l'onglet Pertes. Une correction, c'est un montant qui
// n'aurait jamais dû être facturé. Mélanger les deux fausserait les pertes,
// d'où deux gestes séparés et deux libellés distincts.
//
// Un seul mécanisme couvre les trois cas, parce que c'est le même geste :
// retirer un montant à des mois, et éventuellement le reporter ailleurs.

import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Check, CornerDownRight } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatMonthLabel, currentPeriod } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  red: '#b42318',
  amber: '#b45309',
  green: '#15794a',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function ExpectedCorrection({
  open, onClose, clientId, periods, scope, onDone, onShowToast,
}) {
  const entity = scope === 'optilex' ? 'optilex' : 'owner';
  const col = entity === 'owner' ? 'expected_owner' : 'expected_optilex_ttc';
  const colRecu = entity === 'owner' ? 'received_owner' : 'received_optilex_ttc';
  const colArr = entity === 'owner' ? 'received_overdue_owner' : 'received_overdue_optilex_ttc';

  const [picks, setPicks] = useState({});     // period_id -> montant retiré
  const [deferTo, setDeferTo] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const mois = useMemo(() => {
    const cur = currentPeriod();
    return (periods || [])
      .map((p) => {
        const att = Number(p[col] || 0);
        const paye = Number(p[colRecu] || 0) + Number(p[colArr] || 0);
        return {
          id: p.id,
          key: String(p.period).slice(0, 7),
          attendu: att,
          reste: round2(Math.max(att - paye, 0)),
          passe: String(p.period).slice(0, 7) < cur,
          futur: String(p.period).slice(0, 7) > cur,
        };
      })
      .filter((m) => m.attendu > 0)
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [periods, col, colRecu, colArr]);

  const futurs = mois.filter((m) => m.futur);
  const total = round2(Object.values(picks).reduce((a, b) => a + (Number(b) || 0), 0));

  // Raccourci : tout ce qui reste dû sur les mois PASSÉS, c'est-à-dire
  // exactement les créances antérieures.
  const preselectArrieres = useCallback(() => {
    const next = {};
    for (const m of mois) if (m.passe && m.reste > 0) next[m.id] = m.reste;
    setPicks(next);
  }, [mois]);

  const submit = useCallback(async () => {
    if (saving || !total) return;
    setSaving(true);
    try {
      const r = await apiClient.post(
        `/api/v1/finance-periods/client/${clientId}/expected-correction`,
        {
          entity,
          removals: Object.entries(picks)
            .filter(([, v]) => Number(v) > 0)
            .map(([period_id, amount]) => ({ period_id, amount: round2(amount) })),
          defer_to: deferTo || null,
          reason: reason.trim() || null,
        },
      );
      onShowToast?.(
        deferTo
          ? `${formatEUR(r.retire)} reporté`
          : `${formatEUR(r.retire)} retiré de l'attendu`,
        'success',
      );
      setPicks({});
      setDeferTo('');
      setReason('');
      onDone?.();
      onClose?.();
    } catch (e) {
      onShowToast?.(e?.data?.detail || 'Correction impossible', 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, total, clientId, entity, picks, deferTo, reason, onDone, onClose, onShowToast]);

  if (!open) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10060,
        background: 'rgba(23,23,26,0.34)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(540px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: '#fff', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(17,24,39,0.22)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, padding: '18px 20px 12px', borderBottom: `1px solid ${N.borderSft}`,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: N.text }}>
              Corriger l’attendu {entity === 'owner' ? 'Owner' : "Opti'lex"}
            </div>
            <div style={{ fontSize: 11.5, color: N.textMuted, marginTop: 3, lineHeight: 1.5 }}>
              Un montant qui n’aurait pas dû être facturé. Ce n’est pas une perte :
              rien n’est abandonné, la facturation est corrigée.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: N.textFaint, padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 20px' }}>
          <button
            type="button"
            onClick={preselectArrieres}
            style={{
              border: `1px solid ${N.border}`, background: '#fff', borderRadius: 6,
              padding: '5px 11px', fontSize: 12, fontFamily: 'inherit',
              cursor: 'pointer', color: N.textMuted, marginBottom: 10,
            }}
          >
            Sélectionner les créances antérieures
          </button>

          <div style={{
            border: `1px solid ${N.borderSft}`, borderRadius: 9, overflow: 'hidden',
            maxHeight: 260, overflowY: 'auto',
          }}>
            {mois.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
                borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                background: picks[m.id] ? '#fffafa' : 'transparent',
              }}>
                <span style={{
                  width: 74, fontSize: 12, fontWeight: 600,
                  color: m.passe ? N.textMuted : N.text,
                }}>
                  {formatMonthLabel(m.key)}
                </span>
                <span style={{
                  flex: 1, fontSize: 11.5, color: N.textFaint,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  attendu {formatEUR(m.attendu)}
                  {m.reste !== m.attendu && ` · reste dû ${formatEUR(m.reste)}`}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={m.attendu}
                  value={picks[m.id] ?? ''}
                  placeholder="0,00"
                  onChange={(e) => setPicks((p) => ({ ...p, [m.id]: e.target.value }))}
                  style={{
                    width: 96, border: `1px solid ${N.border}`, borderRadius: 5,
                    padding: '4px 7px', fontSize: 12, fontFamily: 'inherit',
                    textAlign: 'right', outline: 'none', color: N.red,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </div>
            ))}
            {!mois.length && (
              <div style={{ padding: 14, fontSize: 12, color: N.textMuted }}>
                Aucun mois facturé sur cette vision.
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap',
          }}>
            <CornerDownRight size={13} style={{ color: N.textFaint }} />
            <span style={{ fontSize: 12, color: N.textMuted }}>Reporter sur</span>
            <select
              value={deferTo}
              onChange={(e) => setDeferTo(e.target.value)}
              style={{
                border: `1px solid ${N.border}`, borderRadius: 6, padding: '5px 8px',
                fontSize: 12.5, fontFamily: 'inherit', background: '#fff',
                color: N.text, outline: 'none',
              }}
            >
              <option value="">— ne pas reporter (supprimer) —</option>
              {futurs.map((m) => (
                <option key={m.id} value={m.id}>{formatMonthLabel(m.key)}</option>
              ))}
            </select>
          </div>

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (facturé à tort, geste commercial, décalage…)"
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 10,
              border: `1px solid ${N.border}`, borderRadius: 6, padding: '7px 9px',
              fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: N.text,
            }}
          />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
            justifyContent: 'flex-end',
          }}>
            <span style={{ marginRight: 'auto', fontSize: 12, color: N.textMuted }}>
              Total retiré <strong style={{ color: total > 0 ? N.red : N.text }}>
                {formatEUR(total)}
              </strong>
              {deferTo ? ' · reporté' : ''}
            </span>
            <button type="button" onClick={onClose} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: N.textMuted, fontSize: 12.5, fontFamily: 'inherit', padding: '6px 8px',
            }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!total || saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: 'none', borderRadius: 6, padding: '7px 13px',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                cursor: total && !saving ? 'pointer' : 'default',
                background: total && !saving ? N.text : N.sideBg,
                color: total && !saving ? '#fff' : N.textFaint,
              }}
            >
              <Check size={13} />
              {saving ? 'Enregistrement…' : (deferTo ? 'Corriger et reporter' : 'Corriger')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
