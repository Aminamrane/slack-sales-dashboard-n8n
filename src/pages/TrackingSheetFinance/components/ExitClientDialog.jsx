// ExitClientDialog.jsx — sortie d'un client, côté finance.
//
// Demande dev 2026-08-28 : « Ismah doit pouvoir acter des résiliations et
// rétractations depuis finance, et mettre des clients comme perte, supprimer
// leur attendu présent futur et passé, donc complètement les sortir. Il reste
// visible mais n'a plus d'attendu. »
//
// Deux gestes distincts, réunis ici parce que c'est la même conversation :
//
//   1. ACTER UN ÉTAT — Résiliation, Rétractation, Liquidation… avec sa date
//      d'effet. Le client ne bascule QU'À cette date : d'ici là il reste
//      actif, et le board affiche « prévu le … ». Même mécanique que le
//      board Owner/Opti'Lex, même table, même historique : ce qui est acté
//      ici est acté là-bas, il n'y a qu'une vérité.
//
//   2. DÉCLARER UNE PERTE — l'attendu tombe à zéro sur toute la fiche, passé
//      compris. Le client reste dans la liste, sa créance est actée
//      abandonnée. C'est réversible : le serveur garde la photo de chaque
//      montant effacé et sait tout restaurer au centime.
//
// Les deux sont réservés à la direction (admin, direction financière) : ce
// sont des décisions qui engagent, pas des corrections de saisie.

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TriangleAlert, RotateCcw, CalendarDays, Check } from 'lucide-react';

import { ETAT_DATE_CONFIG } from '../../OptilexBoard.jsx';
import { formatEUR, formatDateFR } from '../constants.js';

const N = {
  text: '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  border: '#e3e2e0',
  borderSft: '#ededec',
  sideBg: '#f7f7f5',
  red: '#b42318',
  redBg: '#fdecec',
  amber: '#b45309',
  amberBg: '#fff8ed',
};

// États actés depuis la finance. Les « En cours de … » ne sont pas ici :
// ce sont des marqueurs de travail, ils se posent depuis le badge d'état.
const ACTED_ETATS = ['Résiliation', 'Rétractation', 'Self-Résiliation', 'Liquidation'];

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

const btn = (kind) => ({
  border: kind === 'ghost' ? 'none' : `1px solid ${N.border}`,
  background: kind === 'danger' ? N.red : kind === 'ghost' ? 'transparent' : '#fff',
  color: kind === 'danger' ? '#fff' : kind === 'ghost' ? N.textMuted : N.text,
  borderRadius: 7,
  padding: kind === 'ghost' ? '8px 10px' : '8px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
});

// Ce que la perte effacerait, ventilé sur les TROIS périmètres que la finance
// choisit séparément (demande dev 2026-08-28) : les créances antérieures, le
// mois en cours, le reste du contrat. Calculé sur la timeline déjà chargée par
// le panneau — le montant se voit AVANT de valider, jamais après.
//
// On n'abandonne QUE ce qui reste dû : attendu moins encaissé, plancher à
// zéro. Un mois déjà soldé ne compte pas — il n'y a rien à y abandonner, et
// son attendu ne bougera pas (sinon la page afficherait un crédit imaginaire
// en faveur d'un client qu'on passe justement en perte).
//
// EXACTEMENT la même formule que le serveur : ce que l'écran annonce ici est
// ce qui sera écrit, au centime.
const abandonable = (r) => {
  const eo = Number(r.expected_owner || 0);
  const ep = Number(r.expected_optilex_ttc || 0);
  const paidO = Number(r.received_owner || 0) + Number(r.received_overdue_owner || 0);
  const paidP = Number(r.received_optilex_ttc || 0)
    + Number(r.received_overdue_optilex_ttc || 0);
  return Math.max(eo - Math.max(paidO, 0), 0) + Math.max(ep - Math.max(paidP, 0), 0);
};

function useLossPreview(periods) {
  return useMemo(() => {
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    const empty = () => ({ amount: 0, months: 0 });
    const out = { past: empty(), current: empty(), future: empty() };
    for (const r of periods || []) {
      const amount = abandonable(r);
      if (amount <= 0) continue;
      const key = String(r.period || '').slice(0, 7);
      const bucket = key < curKey ? 'past' : key === curKey ? 'current' : 'future';
      out[bucket].months += 1;
      out[bucket].amount += amount;
    }
    return out;
  }, [periods]);
}

// Une ligne à cocher : le périmètre, son montant, et ce qu'il représente.
function ScopeRow({ checked, onToggle, label, hint, amount, months, disabled }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 11px', borderRadius: 9,
        border: `1px solid ${checked && !disabled ? '#f0c8c4' : N.borderSft}`,
        background: checked && !disabled ? '#fffafa' : '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.14s, border-color 0.14s',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        style={{ marginTop: 2, accentColor: N.red, cursor: disabled ? 'default' : 'pointer' }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: N.text }}>{label}</span>
          <span style={{
            fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: checked && !disabled && amount > 0 ? N.red : N.textMuted,
          }}>
            {formatEUR(amount)}
          </span>
        </span>
        <span style={{ display: 'block', fontSize: 11, color: N.textFaint, marginTop: 2 }}>
          {disabled ? 'Rien sur ce périmètre' : `${hint} · ${months} mois`}
        </span>
      </span>
    </label>
  );
}

export default function ExitClientDialog({
  open, onClose, client, boardRow, periods,
  onEtatChange, onDeclareLoss, onRevertLoss, loss,
}) {
  const [etat, setEtat] = useState('');
  const [etatDate, setEtatDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [etatDone, setEtatDone] = useState(null);
  // Périmètre de la perte. Tout coché par défaut — c'est le cas courant —
  // mais chaque bloc se décoche indépendamment.
  const [scope, setScope] = useState({ past: true, current: true, future: true });

  const preview = useLossPreview(periods);
  const selectedTotal = ['past', 'current', 'future']
    .reduce((sum, k) => sum + (scope[k] ? preview[k].amount : 0), 0);
  const selectedMonths = ['past', 'current', 'future']
    .reduce((sum, k) => sum + (scope[k] ? preview[k].months : 0), 0);
  const nothingSelected = selectedMonths === 0;
  const posedEtat = boardRow?.etat_manuel || null;
  const posedDate = boardRow?.etat_date || null;

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  const submitEtat = () => run('etat', async () => {
    await onEtatChange({ etat, etat_date: etatDate || null });
    // Confirmation explicite (retour dev 2026-08-28) : acter un état est une
    // décision lourde, on ne se contente pas de refermer une liste. On répète
    // ce qui a été posé ET quand ça prendra effet — la nuance qui compte.
    setEtatDone({ etat, date: etatDate });
    setEtat('');
  });

  const submitLoss = () => run('loss', async () => {
    await onDeclareLoss({
      reason: reason.trim(),
      clear_past: scope.past,
      clear_current: scope.current,
      clear_future: scope.future,
    });
    setReason('');
    setConfirming(false);
  });

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="exit-backdrop"
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
            width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto',
            background: '#fff', borderRadius: 14,
            boxShadow: '0 24px 64px rgba(17,24,39,0.22)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}
        >
          {/* En-tête */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '18px 20px 14px', borderBottom: `1px solid ${N.borderSft}`,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: N.text }}>
                Sortie client
              </div>
              <div style={{
                fontSize: 12, color: N.textMuted, marginTop: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {client?.societe || '—'}
                {client?.numero_client ? ` · ${client.numero_client}` : ''}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ ...btn('ghost'), padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* ── 1. Acter un état ─────────────────────────────────────── */}
          <section style={{ padding: '16px 20px', borderBottom: `1px solid ${N.borderSft}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: N.text, marginBottom: 4 }}>
              Acter un état
            </div>
            <div style={{ fontSize: 11.5, color: N.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
              Le client bascule <strong>à la date d’effet</strong>, pas avant, ici
              comme sur le board Owner/Opti’Lex. Le changement est daté, signé,
              et visible dans l’historique des actions.
            </div>

            {etatDone && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10,
                  padding: '9px 11px', borderRadius: 8,
                  background: '#eaf7f0', color: '#15794a', fontSize: 12, lineHeight: 1.45,
                }}
              >
                <Check size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>{etatDone.etat} actée.</strong>{' '}
                  {etatDone.date && new Date(etatDone.date) > new Date()
                    ? <>Le client basculera le {formatDateFR(etatDone.date)} ; d’ici là il reste actif.</>
                    : <>Effective depuis le {formatDateFR(etatDone.date)}.</>}
                  {' '}Le board Owner/Opti’Lex est à jour.
                </span>
              </motion.div>
            )}

            {posedEtat && !etatDone && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
                padding: '7px 10px', borderRadius: 8,
                background: N.amberBg, color: N.amber, fontSize: 11.5, fontWeight: 600,
              }}>
                <CalendarDays size={13} />
                État posé : {posedEtat}
                {posedDate ? ` · effet ${formatDateFR(posedDate)}` : ' · date à renseigner'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={etat}
                onChange={(e) => setEtat(e.target.value)}
                style={{
                  flex: '1 1 190px', border: `1px solid ${N.border}`, borderRadius: 7,
                  padding: '8px 9px', fontSize: 12.5, fontFamily: 'inherit',
                  background: '#fff', color: N.text, outline: 'none',
                }}
              >
                <option value="">Choisir un état…</option>
                {ACTED_ETATS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="date"
                value={etatDate}
                onChange={(e) => setEtatDate(e.target.value)}
                title={etat ? (ETAT_DATE_CONFIG[etat]?.label || "Date d'effet") : "Date d'effet"}
                style={{
                  border: `1px solid ${N.border}`, borderRadius: 7, padding: '8px 9px',
                  fontSize: 12.5, fontFamily: 'inherit', background: '#fff',
                  color: N.text, outline: 'none', width: 148,
                }}
              />
              <button
                type="button"
                onClick={submitEtat}
                disabled={!etat || !etatDate || busy === 'etat'}
                style={{
                  ...btn('solid'),
                  background: etat && etatDate ? N.text : N.sideBg,
                  color: etat && etatDate ? '#fff' : N.textFaint,
                  border: 'none',
                  cursor: etat && etatDate && !busy ? 'pointer' : 'default',
                }}
              >
                {busy === 'etat' ? 'Enregistrement…' : 'Acter'}
              </button>
            </div>
          </section>

          {/* ── 2. Perte ─────────────────────────────────────────────── */}
          <section style={{ padding: '16px 20px 20px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: N.text, marginBottom: 4 }}>
              Déclarer une perte
            </div>

            {loss ? (
              <>
                <div style={{
                  padding: '11px 12px', borderRadius: 9, background: N.redBg,
                  color: N.red, fontSize: 12, lineHeight: 1.55, marginBottom: 12,
                }}>
                  <strong>Client déclaré en perte</strong>
                  {loss.declared_by_name ? ` par ${loss.declared_by_name}` : ''}
                  {loss.declared_at ? ` le ${formatDateFR(loss.declared_at)}` : ''}.
                  <div style={{ marginTop: 5 }}>
                    Créance abandonnée{' '}
                    <strong>{formatEUR(loss.amount_owner + loss.amount_optilex_ttc)}</strong>
                    {(loss.future_owner + loss.future_optilex_ttc) > 0 && (
                      <> · attendu futur annulé{' '}
                        <strong>{formatEUR(loss.future_owner + loss.future_optilex_ttc)}</strong>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: 5 }}>
                    Périmètre :{' '}
                    {[
                      loss.clear_past ? 'créances antérieures' : null,
                      loss.clear_current ? 'mois en cours' : null,
                      loss.clear_future ? 'reste du contrat' : null,
                    ].filter(Boolean).join(', ') || '—'}
                  </div>
                  {loss.reason && (
                    <div style={{ marginTop: 5, fontStyle: 'italic' }}>« {loss.reason} »</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => run('revert', onRevertLoss)}
                  disabled={busy === 'revert'}
                  style={{ ...btn('solid'), display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RotateCcw size={13} />
                  {busy === 'revert' ? 'Restauration…' : "Annuler la perte et restaurer l’attendu"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: N.textMuted, lineHeight: 1.5, marginBottom: 11 }}>
                  Choisissez ce qui est abandonné. Ce qui reste coché passe à zéro,
                  le reste est <strong>conservé tel quel</strong>. Le client reste
                  visible, et les encaissements déjà reçus ne bougent jamais.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 11 }}>
                  <ScopeRow
                    checked={scope.past}
                    onToggle={(v) => setScope((s) => ({ ...s, past: v }))}
                    label="Créances antérieures"
                    hint="Impayés des mois précédents"
                    amount={preview.past.amount}
                    months={preview.past.months}
                    disabled={preview.past.months === 0}
                  />
                  <ScopeRow
                    checked={scope.current}
                    onToggle={(v) => setScope((s) => ({ ...s, current: v }))}
                    label="Attendu du mois en cours"
                    hint="Reste dû sur le mois"
                    amount={preview.current.amount}
                    months={preview.current.months}
                    disabled={preview.current.months === 0}
                  />
                  <ScopeRow
                    checked={scope.future}
                    onToggle={(v) => setScope((s) => ({ ...s, future: v }))}
                    label="Reste du contrat"
                    hint="Mois à venir"
                    amount={preview.future.amount}
                    months={preview.future.months}
                    disabled={preview.future.months === 0}
                  />
                </div>

                {/* Ce que le choix implique — dit ici, pas découvert après.
                    Abandonner de vieilles créances n'arrête pas la facturation ;
                    couper le mois en cours ou le futur, si. */}
                {(scope.current || scope.future) ? (
                  <div style={{
                    fontSize: 11, color: N.textFaint, lineHeight: 1.5, marginBottom: 11,
                  }}>
                    Les montants de ce client ne seront plus recalculés
                    automatiquement (formule, effectif) tant que la perte est active.
                  </div>
                ) : (
                  <div style={{
                    fontSize: 11, color: N.textFaint, lineHeight: 1.5, marginBottom: 11,
                  }}>
                    Le contrat continue normalement : seules les créances passées
                    sont abandonnées.
                  </div>
                )}

                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motif (liquidation, impayé définitif, geste commercial…)"
                  style={{
                    width: '100%', boxSizing: 'border-box', border: `1px solid ${N.border}`,
                    borderRadius: 7, padding: '8px 10px', fontSize: 12.5,
                    fontFamily: 'inherit', color: N.text, outline: 'none', marginBottom: 11,
                  }}
                />

                {confirming ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
                    padding: '10px 12px', borderRadius: 9,
                    background: N.redBg, color: N.red, fontSize: 12,
                  }}>
                    <TriangleAlert size={15} style={{ flexShrink: 0 }} />
                    <span style={{ flex: '1 1 180px', lineHeight: 1.45 }}>
                      Passer <strong>{formatEUR(selectedTotal)}</strong> en perte sur{' '}
                      {selectedMonths} mois pour <strong>{client?.societe}</strong> ?
                    </span>
                    <button
                      type="button"
                      onClick={submitLoss}
                      disabled={busy === 'loss'}
                      style={{ ...btn('danger'), border: 'none' }}
                    >
                      {busy === 'loss' ? 'En cours…' : 'Confirmer'}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} style={btn('ghost')}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={nothingSelected}
                    title={nothingSelected ? 'Cocher au moins un périmètre' : undefined}
                    style={{
                      ...btn('solid'),
                      border: `1px solid ${nothingSelected ? N.border : `${N.red}33`}`,
                      color: nothingSelected ? N.textFaint : N.red,
                      cursor: nothingSelected ? 'default' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <TriangleAlert size={13} />
                    {nothingSelected
                      ? 'Rien à passer en perte'
                      : `Passer ${formatEUR(selectedTotal)} en perte`}
                  </button>
                )}
              </>
            )}
          </section>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

