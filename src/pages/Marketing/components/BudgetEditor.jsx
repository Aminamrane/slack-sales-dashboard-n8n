import React, { useEffect, useState, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import Card from './Card';
import { fmtEur } from '../theme';

/**
 * Budget editor — daily ad-spend ledger. Lists existing budgets sorted
 * by date desc, with an inline form to add a new one (date + amount €
 * + optional source label). DELETE on each row.
 *
 * Refetches after every mutation + bubbles up via onChange so the
 * dashboard's overview can refresh its CPL calculations.
 *
 * Read-only for `marketing` role users : the parent gates the entire
 * card behind `canEditBudgets`, but we also disable submit/delete
 * defensively if `readOnly` is passed in.
 */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BudgetEditor({ webinarId, C, onChange, readOnly = false, dateFrom, dateTo }) {
  const [budgets, setBudgets] = useState([]);
  // Date initiale du formulaire = dateFrom de la cohorte si fournie
  // (ouverture de campagne), sinon today. Ré-init quand la cohorte change.
  const [date, setDate] = useState(() => dateFrom || todayIso());
  useEffect(() => { setDate(dateFrom || todayIso()); }, [dateFrom]);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Passe from/to pour scoper la liste à la fenêtre de la cohorte.
      // La landing `/api/admin/budgets` filtre par from/to (pas par
      // webinar), donc c'est le seul moyen de séparer les budgets 26 mai
      // vs 22 juin côté affichage.
      const params = [];
      if (dateFrom) params.push(`from=${encodeURIComponent(dateFrom)}`);
      if (dateTo) params.push(`to=${encodeURIComponent(dateTo)}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const json = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/budgets${qs}`);
      setBudgets((json?.budgets || []).slice().sort((a, b) => b.date.localeCompare(a.date)));
      setErr(null);
    } catch (e) {
      setErr(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [webinarId, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setErr(null);
    const n = parseFloat(String(amount).replace(',', '.'));
    if (!date || Number.isNaN(n) || n < 0) {
      setErr('Date et montant requis');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.put(`/api/v1/marketing/webinars/${webinarId}/budgets`, {
        date,
        amountEur: n,
        source: source.trim() || null,
      });
      setAmount('');
      setSource('');
      await load();
      if (onChange) onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (d) => {
    if (readOnly) return;
    if (!window.confirm(`Supprimer le budget du ${d} ?`)) return;
    try {
      await apiClient.delete(`/api/v1/marketing/webinars/${webinarId}/budgets?date=${encodeURIComponent(d)}`);
      await load();
      if (onChange) onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Card
      title="Budget marketing par jour"
      subtitle={readOnly
        ? 'Lecture seule (votre rôle ne permet pas la modification)'
        : 'Saisi par l\'équipe marketing · sert au calcul du CPL'}
      C={C}
    >
      {!readOnly && (
        <form onSubmit={submit} style={{
          display: 'grid',
          gridTemplateColumns: '160px 130px 1fr auto',
          gap: 8,
          alignItems: 'center',
        }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={INPUT(C)}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Montant €"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={INPUT(C)}
          />
          <input
            type="text"
            placeholder="Source (Meta Ads, Google, organique…)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            maxLength={100}
            style={INPUT(C)}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: 'none',
              background: C.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 14px ${C.accent}55`; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {submitting ? '…' : 'Enregistrer'}
          </button>
        </form>
      )}

      {err && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 10,
          background: C.rose.bg,
          color: C.rose.fg,
          fontSize: 12,
          fontWeight: 600,
        }}>
          {err}
        </div>
      )}

      {budgets.length > 0 ? (
        <div style={{ marginTop: 20, maxHeight: 280, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.hairline}` }}>
                <th style={BH(C)}>Date</th>
                <th style={BH(C)}>Montant</th>
                <th style={BH(C)}>Source</th>
                {!readOnly && <th style={BH(C)} />}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {budgets.map((b) => (
                  <motion.tr
                    key={b.date}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    style={{ borderTop: `1px solid ${C.hairline}` }}
                  >
                    <td style={BC(C)}>{b.date}</td>
                    <td style={{ ...BC(C), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(parseFloat(b.amountEur), { decimals: 2 })}
                    </td>
                    <td style={{ ...BC(C), color: C.muted }}>{b.source || '—'}</td>
                    {!readOnly && (
                      <td style={{ ...BC(C), textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => remove(b.date)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'transparent',
                            color: C.rose.fg,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.rose.bg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : !loading ? (
        <p style={{ marginTop: 16, marginBottom: 0, color: C.muted, fontSize: 13, fontWeight: 500 }}>
          Aucun budget enregistré pour ce webinaire pour le moment.
        </p>
      ) : null}
    </Card>
  );
}

const INPUT = (C) => ({
  padding: '9px 12px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border 0.15s',
});

const BH = (C) => ({
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 700,
  color: C.faded,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  textAlign: 'left',
});

const BC = (C) => ({
  padding: '10px 12px',
  fontSize: 13,
  color: C.text,
});
