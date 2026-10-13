import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, ArrowRight, RefreshCw } from 'lucide-react';
import apiClient from '../services/apiClient.js';
import { exitAmounts } from '../utils/boardFinanceExit.js';

const money = value => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #dce0e6', borderRadius: 8, font: 'inherit' };
const button = { ...input, width: 'auto', cursor: 'pointer', background: '#fff' };
const labels = { past: 'Créances antérieures', current: 'Mois en cours', future: 'Reste du contrat' };

export function BoardFinanceExitDialog({ numero, payload, onResolve }) {
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  const [date, setDate] = useState(payload.etat_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }));
  const [values, setValues] = useState({ past: '', current: '', future: '' });
  const [linked, setLinked] = useState(false), [reason, setReason] = useState('');
  const [allRemaining, setAllRemaining] = useState(false);
  const [version, setVersion] = useState(0);
  const dialog = useRef(null);
  const withdrawal = payload.etat === 'Rétractation';
  useEffect(() => {
    let alive = true;
    setPreview(null); setError(''); setLinked(false); setAllRemaining(false);
    apiClient.get(`/api/v1/optilex/exit-finance-preview?numero_client=${encodeURIComponent(numero)}`)
      .then(data => {
        if (!alive) return;
        setPreview(data);
        setValues(Object.fromEntries(Object.entries(data.amounts).map(([key, amount]) => [key, Number(amount) === 0 || data.review.active_loss ? '0' : ''])));
      }).catch(e => { if (alive) setError(typeof e?.data?.detail === 'string' ? e.data.detail : 'Impossible de charger les montants. Réessayez.'); });
    return () => { alive = false; };
  }, [numero, version]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const loss = preview?.review?.active_loss;
  const amounts = preview ? exitAmounts(values, preview.amounts) : null;
  const total = amounts ? Object.values(amounts).reduce((a, b) => a + b, 0) : null;
  const needsLink = loss && !preview?.review?.finance_withdrawn_at;
  const canConfirm = preview && date && (withdrawal || amounts) && (!needsLink || linked);
  const keyDown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); onResolve(null); }
    if (e.key === 'Tab') {
      const els = [...dialog.current.querySelectorAll('button, input, textarea')].filter(el => !el.disabled);
      const first = els[0], last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  return <div style={{ position: 'fixed', inset: 0, zIndex: 10100, background: '#17212b66', display: 'grid', placeItems: 'center', padding: 16 }}>
    <section role="dialog" aria-modal="true" aria-labelledby="finance-exit-title" ref={dialog} tabIndex={-1} onKeyDown={keyDown}
      style={{ background: '#fff', color: '#252a34', borderRadius: 16, width: 'min(560px,100%)', maxHeight: '90vh', overflow: 'auto', padding: 24, boxSizing: 'border-box', font: '14px/1.5 Inter, system-ui, sans-serif', boxShadow: '0 20px 80px #17212b33' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
        <div><h2 id="finance-exit-title" style={{ margin: 0, fontSize: 20 }}>{payload.etat} · {numero}</h2><div style={{ color: '#647084', display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>Board <ArrowRight size={14}/> Finance</div></div>
        <button style={{ ...button, padding: 6, border: 0 }} aria-label="Fermer" onClick={() => onResolve(null)}><X size={20}/></button>
      </div>
      <label style={{ display: 'block', marginTop: 20 }}>Date d’effet<input required aria-label="Date d’effet" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, marginTop: 6 }}/></label>
      {!preview && !error && <p role="status">Chargement des montants financiers…</p>}
      {error && <div role="alert"><p style={{ color: '#b42318' }}>{error}</p><button style={button} onClick={() => setVersion(v => v + 1)}><RefreshCw size={14}/> Réessayer</button></div>}
      {preview && <>
        {withdrawal ? <p style={{ padding: 14, background: '#fff7e9', borderRadius: 10 }}>Les attendus Owner et Opti’Lex seront automatiquement annulés depuis la signature. Les encaissements et remboursements restent dans l’historique.</p> : <>
          <p>Choisissez les montants à passer en perte. <strong>Le reste demeure à recouvrer.</strong></p>
          {Object.entries(labels).map(([key, label]) => <label key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12, alignItems: 'center', marginTop: 12 }}>
            <span>{label}<small style={{ display: 'block', color: '#647084' }}>Disponible : {money(preview.amounts[key])}</small>{amounts && <small style={{ display: 'block', color: '#24735a' }}>Restant : {money(Number(preview.amounts[key]) - amounts[`amount_${key}`])}</small>}</span>
            <span><input aria-label={`Perte · ${label}`} inputMode="decimal" value={values[key]} disabled={Boolean(loss)} placeholder="0,00" style={{ ...input, textAlign: 'right' }} onChange={e => { setAllRemaining(false); setValues(v => ({ ...v, [key]: e.target.value })); }}/></span>
          </label>)}
          {!loss && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button style={{ ...button, fontSize: 12, borderColor: '#efc8c3', color: '#a32b22' }} onClick={() => { setAllRemaining(true); setValues(Object.fromEntries(Object.entries(preview.amounts).map(([k, v]) => [k, Number(v).toFixed(2)]))); }}>Tout passer en perte</button>
            <button style={{ ...button, fontSize: 12 }} onClick={() => { setAllRemaining(false); setValues({ past: '0', current: '0', future: '0' }); }}>Conserver les montants · 0 € de perte</button>
          </div>}
          <p style={{ fontSize: 12, color: '#647084' }}>La répartition Owner / Opti’Lex est conservée. La fin de facturation configurée reste inchangée ; elle est ajustable dans la fiche Finance.</p>
          <label>Motif (facultatif)<textarea maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} style={{ ...input, marginTop: 6 }} rows={2}/></label>
          <div style={{ background: '#f5f7fa', padding: 14, borderRadius: 10, marginTop: 12, display: 'flex', justifyContent: 'space-between' }}><strong>Nouvelle perte</strong><strong>{total === null ? 'À renseigner' : money(total)}</strong></div>
          {!amounts && <p style={{ fontSize: 12, color: '#647084' }}>Renseignez chaque montant, même 0 €, sans dépasser le disponible.</p>}
        </>}
        {loss && <div style={{ padding: 14, background: '#f5f7fa', borderRadius: 10, marginTop: 12 }}>
          <strong>Perte existante n°{loss.id} conservée</strong><div>{loss.declared_by_name} · {loss.reason || 'Motif non renseigné'}</div>
          <div>Créances : {money(Number(loss.amount_owner) + Number(loss.amount_optilex_ttc))} · Futur : {money(Number(loss.future_owner) + Number(loss.future_optilex_ttc))}</div>
          {loss.snapshot?.periods?.length > 0 && <details><summary>Voir les échéances</summary>{loss.snapshot.periods.map(p => <div key={p.period}>{p.period} · Owner {money(p.expected_owner)} → {money(p.new_expected_owner)} · Opti’Lex {money(p.expected_optilex_ttc)} → {money(p.new_expected_optilex_ttc)}</div>)}</details>}
          {needsLink && <label style={{ display: 'flex', gap: 8, marginTop: 10 }}><input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)}/>J’ai vérifié cette perte et confirme son rattachement.</label>}
        </div>}
      </>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <button style={button} onClick={() => onResolve(null)}>Annuler</button>
        <button disabled={!canConfirm} style={{ ...button, background: '#1e293b', color: '#fff', opacity: canConfirm ? 1 : 0.45 }} onClick={() => onResolve({ ...payload, etat_date: date, finance_decision: { token: preview.token, ...(withdrawal ? {} : { ...amounts, all_remaining: allRemaining }), reason, link_loss_id: linked ? loss?.id : null } })}>Confirmer et appliquer en Finance</button>
      </div>
    </section>
  </div>;
}

// One shared confirmation for board cells, client details and the Finance exit dialog.
export function confirmBoardFinanceExit(numero, payload) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const done = result => { root.unmount(); host.remove(); resolve(result); };
    root.render(<BoardFinanceExitDialog numero={numero} payload={payload} onResolve={done}/>);
  });
}
