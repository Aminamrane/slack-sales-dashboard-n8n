// BillingStopDialog.jsx — fin de facturation d'un client qui sort.
//
// Demande dev 2026-09-28 : « Résiliation : conserver les montants attendus
// jusqu'à une date choisie », et « il faut que ce soit intuitif dans la page ».
// Le réglage existait (18/09), mais caché dans « Sortie client » et sans rien
// dire de ses effets. Ici : deux choix explicites, et l'aperçu, mois par mois,
// de ce qui reste dû ou tombe à zéro, calculé par le serveur avec le même
// moteur que l'enregistrement (rien n'est écrit avant « Enregistrer »).

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarRange } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatMonthLabel, formatDateFR, shiftMonth } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  green: '#15794a',
  greenBg: '#eaf7f0',
  red: '#b42318',
  redBg: '#fdecec',
};

// Mois (« AAAA-MM ») qui précède une date ISO : le dernier mois facturé par
// défaut quand un état prend effet à cette date.
const monthBefore = (iso) => (iso ? shiftMonth(String(iso).slice(0, 7), -1) : null);

export default function BillingStopDialog({
  open, onClose, clientId, client, etat, etatDate,
  // Dernier mois facturé choisi par la direction (« AAAA-MM »), null = règle automatique.
  billingLastMonth = null,
  onSaved, onShowToast,
}) {
  const autoLast = monthBefore(etatDate);
  const [mode, setMode] = useState('auto');      // 'auto' | 'keep'
  const [month, setMonth] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // À l'ouverture : on part de la situation enregistrée.
  useEffect(() => {
    if (!open) return;
    setMode(billingLastMonth ? 'keep' : 'auto');
    setMonth(billingLastMonth || (autoLast ? shiftMonth(autoLast, 1) : ''));
    setPreview(null);
    setError('');
  }, [open, billingLastMonth, autoLast]);

  // Ce qu'on enregistrerait : null = règle automatique.
  const target = mode === 'keep' ? (month || null) : null;
  const unchanged = (target || null) === (billingLastMonth || null);

  // Aperçu serveur, à chaque changement de choix (léger délai de frappe).
  useEffect(() => {
    if (!open || (mode === 'keep' && !month)) return undefined;
    let live = true;
    setLoading(true);
    setError('');
    const t = setTimeout(async () => {
      try {
        const d = await apiClient.post(
          `/api/v1/finance-periods/client/${clientId}/billing-stop/preview`, { last_month: target },
        );
        if (live) setPreview(d);
      } catch (e) {
        if (live) { setPreview(null); setError(e?.data?.detail || 'Aperçu indisponible'); }
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [open, clientId, mode, month, target]);

  const total = (x) => (x?.owner || 0) + (x?.optilex || 0);
  const lastShown = mode === 'keep' ? month : autoLast;
  const quick = useMemo(() => (autoLast ? [1, 2, 3].map((n) => shiftMonth(autoLast, n)) : []), [autoLast]);

  const save = async () => {
    if (saving || unchanged) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/api/v1/finance-periods/client/${clientId}/billing-stop`, { last_month: target });
      onShowToast?.(target
        ? `Attendus conservés jusqu’à ${formatMonthLabel(target).toLowerCase()} inclus`
        : 'Facturation arrêtée à la date d’effet', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.data?.detail || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const option = (key, title, detail, children) => {
    const actif = mode === key;
    return (
      <label style={{
        display: 'block', cursor: 'pointer', borderRadius: 10, padding: '11px 13px',
        border: `1px solid ${actif ? N.text : N.border}`, background: actif ? '#fafaf9' : '#fff',
      }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <input type="radio" checked={actif} onChange={() => setMode(key)} style={{ marginTop: 2, accentColor: N.text }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: N.text }}>{title}</span>
            <span style={{ display: 'block', fontSize: 12, color: N.textMuted, marginTop: 2, lineHeight: 1.45 }}>{detail}</span>
            {actif && children}
          </span>
        </span>
      </label>
    );
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="billing-stop-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(23,23,26,0.34)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: '#fff', borderRadius: 14,
            boxShadow: '0 24px 64px rgba(17,24,39,0.22)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            padding: '18px 20px 14px', borderBottom: `1px solid ${N.borderSft}`,
          }}>
            <div style={{ minWidth: 0, display: 'flex', gap: 10 }}>
              <CalendarRange size={18} style={{ color: N.textMuted, marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: N.text }}>Fin de facturation</div>
                <div style={{ fontSize: 12, color: N.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client?.company_name || client?.societe || '—'}{client?.numero_client ? ` · ${client.numero_client}` : ''}
                  {etat ? ` · ${etat}${etatDate ? ` le ${formatDateFR(etatDate)}` : ''}` : ''}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: N.textMuted, cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '14px 20px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {option('auto', 'Arrêter à la date d’effet',
              autoLast
                ? <>Dernier mois facturé : <strong>{formatMonthLabel(autoLast).toLowerCase()}</strong>. Plus aucun attendu ensuite.</>
                : 'Sans date d’effet, la facturation s’arrête tout de suite.')}
            {option('keep', 'Conserver les attendus jusqu’à…',
              'Le client reste redevable jusqu’au mois choisi, inclus (préavis, engagement…).',
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    border: `1px solid ${N.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 12.5,
                    fontFamily: 'inherit', background: '#fff', color: N.text, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 12, color: N.textMuted }}>inclus</span>
                {quick.map((q, i) => (
                  <button key={q} type="button" onClick={(e) => { e.preventDefault(); setMonth(q); }} style={{
                    height: 26, padding: '0 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
                    border: `1px solid ${month === q ? N.text : N.border}`,
                    background: month === q ? N.text : '#fff', color: month === q ? '#fff' : N.text,
                  }}>
                    +{i + 1} mois
                  </button>
                ))}
              </span>)}
          </div>

          <section style={{ padding: '12px 20px 4px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: N.text, marginBottom: 6 }}>
              Ce que ça change
              {lastShown && <span style={{ fontWeight: 500, color: N.textMuted }}> · facturé jusqu’à {formatMonthLabel(lastShown).toLowerCase()} inclus</span>}
            </div>
            {loading && !preview ? (
              <div style={{ fontSize: 12, color: N.textMuted, padding: '8px 0' }}>Calcul…</div>
            ) : preview && preview.months.length === 0 ? (
              <div style={{ fontSize: 12, color: N.textMuted, padding: '8px 0' }}>Aucun attendu ne change par rapport à aujourd’hui.</div>
            ) : preview ? (
              <div style={{ border: `1px solid ${N.borderSft}`, borderRadius: 8, opacity: loading ? 0.6 : 1 }}>
                {preview.months.map((m, i) => {
                  const avant = total(m.before); const apres = total(m.after);
                  const garde = apres > avant;
                  return (
                    <div key={m.period} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '7px 11px', fontSize: 12.5,
                      borderTop: i === 0 ? 'none' : `1px solid ${N.borderSft}`,
                    }}>
                      <span style={{ color: N.text }}>{formatMonthLabel(m.period)}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: garde ? N.green : N.red, fontWeight: 600 }}
                        title={`Owner ${formatEUR(m.before.owner)} → ${formatEUR(m.after.owner)} · Opti’Lex ${formatEUR(m.before.optilex)} → ${formatEUR(m.after.optilex)}`}>
                        {formatEUR(avant)} → {formatEUR(apres)}
                      </span>
                    </div>
                  );
                })}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 11px', fontSize: 12.5,
                  borderTop: `1px solid ${N.border}`, background: N.sideBg, fontWeight: 700,
                }}>
                  <span style={{ color: N.text }}>Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {preview.kept_total > 0 && <span style={{ color: N.green }}>+{formatEUR(preview.kept_total)} conservés</span>}
                    {preview.kept_total > 0 && preview.removed_total > 0 && ' · '}
                    {preview.removed_total > 0 && <span style={{ color: N.red }}>−{formatEUR(preview.removed_total)} retirés</span>}
                  </span>
                </div>
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: N.textFaint, marginTop: 7, lineHeight: 1.45 }}>
              Montants recalculés au dernier montant facturé. Un mois déjà encaissé ou fixé à la main n’est jamais retouché.
            </div>
          </section>

          {error && <div style={{ margin: '8px 20px 0', fontSize: 12, color: N.red }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px' }}>
            <button type="button" onClick={onClose} style={{
              border: `1px solid ${N.border}`, background: '#fff', color: N.text, borderRadius: 7,
              padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || unchanged || (mode === 'keep' && !month)}
              title={unchanged ? 'C’est déjà la situation enregistrée' : ''}
              style={{
                border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                background: unchanged ? N.sideBg : N.text, color: unchanged ? N.textFaint : '#fff',
                cursor: unchanged || saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
