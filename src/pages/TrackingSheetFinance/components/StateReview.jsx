import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Clock3, Link2, RefreshCw, ArrowRight } from 'lucide-react';
import apiClient from '../../../services/apiClient.js';
import { formatEUR, formatDateFR } from '../constants.js';

const box = { border: '1px solid #e6d7b2', background: '#fffcf4', borderRadius: 10, padding: 16, marginTop: 18, fontSize: 13, lineHeight: 1.55 };
const button = { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px', border:'1px solid #dedbd4', borderRadius:7, background:'#fff', cursor:'pointer', font:'inherit' };
const terminal = new Set(['Résiliation','Self-Résiliation','Liquidation','Pause']);
export function StateReviewQueue({ onOpenClient }) {
  const [items,setItems] = useState([]), [error,setError] = useState('');
  const load = useCallback(() => apiClient.get('/api/v1/finance-periods/client/state-reviews').then(d => {setItems(d.items || []);setError('');}).catch(() => setError('Impossible de charger les états à traiter. Réessayez.')),[]);
  useEffect(() => {load();const t=setInterval(load,30000);return()=>clearInterval(t);},[load]);
  return <section style={{padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12}}><h3 style={{margin:0}}>États à traiter · {items.length}</h3><button style={button} onClick={load}><RefreshCw size={15}/>Actualiser</button></div>
    <p style={{color:'#787774'}}>Les situations déclarées dans le board attendent une décision financière. Les montants restent inchangés jusqu’au traitement.</p>
    {error && <p role="alert" style={{color:'#b42318'}}>{error}</p>}
    {!error && !items.length && <p>Aucun état en attente de traitement financier.</p>}
    {items.map(r=><article key={r.client_id} style={box}>
      <strong>{r.company_name} · {r.numero_client}</strong><div>{r.requested_state || 'Retour automatique'}{r.requested_date ? ` · ${formatDateFR(r.requested_date)}`:''}</div>
      <div style={{color:'#787774',marginBottom:10}}>Déclaré par {r.requested_by} · {formatDateFR(r.requested_at)}</div>
      <button style={button} onClick={()=>onOpenClient(r.client_id)}>Examiner le dossier <ArrowRight size={15}/></button>
    </article>)}
  </section>;
}

export default function StateReview({ clientId, version, canProcess, onChanged, onReview }) {
  const [review,setReview] = useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [action,setAction]=useState(''),[month,setMonth]=useState(''),[link,setLink]=useState(false),[confirmed,setConfirmed]=useState(false);
  const load = useCallback(async()=>{
    try { const d=await apiClient.get(`/api/v1/finance-periods/client/${clientId}/state-review`);setReview(d);onReview?.(d);setError(''); }
    catch {setError('Le suivi financier est indisponible. Actualisez avant de traiter cet état.');}
  },[clientId,onReview]);
  useEffect(()=>{setReview(null);load();},[load,version]);
  useEffect(()=>{setAction('');setMonth('');setLink(false);setConfirmed(false);},[review?.revision,clientId]);
  const process = async()=>{
    setBusy(true);setError('');
    try { const d=await apiClient.post(`/api/v1/finance-periods/client/${clientId}/state-review`,{revision:review.revision,action,last_month:/^(0[1-9]|1[0-2])\/\d{4}$/.test(month) ? `${month.slice(3)}-${month.slice(0,2)}` : null,link_loss_id:link ? review.active_loss?.id : null});setReview(d);setConfirmed(false);onChanged?.(); }
    catch(e){setError(e?.data?.detail || 'Traitement non enregistré. Actualisez et réessayez.');}
    finally{setBusy(false);}
  };
  if (!review && !error) return null;
  if (review?.status==='none' || (review?.status==='processed' && !review.reviewed_at && !review.finance_withdrawn_at)) return null;
  const pending=review?.status==='pending', loss=review?.active_loss, state=review?.requested_state;
  return <section style={{...box,background:pending?'#fffcf4':'#f6faf7',borderColor:pending?'#e6d7b2':'#d9e6dc'}} aria-label="Traitement financier de la situation">
    <div style={{display:'flex',gap:8,alignItems:'center',fontWeight:650}}>{pending?<Clock3 size={17}/>:<ClipboardCheck size={17}/>} {pending?'Traitement financier à effectuer':'Situation examinée en finance'}</div>
    {!pending && review?.decision && <p>Décision : {({withdrawal:'rétractation traitée', 'billing-stop':'fin de facturation fixée', resume:'facturation rétablie', keep:'traitement financier conservé, aucun montant modifié'})[review.decision]} · {review.reviewed_by}</p>}
    {pending && <p style={{margin:'8px 0'}}><strong>{state || 'Retour automatique'}</strong> : déclaration enregistrée dans le board. Les montants restent ceux du dernier traitement financier.</p>}
    {review?.finance_withdrawn_at && <p>Rétractation déjà traitée en finance, avec effet au {formatDateFR(review.finance_withdrawn_at)}. Un changement dans le board ne restaure pas les attendus.</p>}
    {review?.linked_loss_id && <p style={{display:'flex',gap:6,alignItems:'center'}}><Link2 size={15}/>Perte n°{review.linked_loss_id} rattachée et conservée.</p>}
    {pending && loss && <div style={{padding:12,background:'#fff',border:'1px solid #e6e3dc',borderRadius:8,margin:'12px 0'}}>
      <strong>Perte existante n°{loss.id} · {loss.declared_by_name || 'Finance'}</strong>
      <div>{formatDateFR(loss.declared_at)} · {loss.periods_cleared} échéances</div>
      <div>Créances : Owner {formatEUR(loss.amount_owner)} · Opti’Lex {formatEUR(loss.amount_optilex_ttc)}</div>
      <div>Futur : Owner {formatEUR(loss.future_owner)} · Opti’Lex {formatEUR(loss.future_optilex_ttc)}</div>
      <div>Motif : {loss.reason || 'Non renseigné'}</div>
      {loss.snapshot?.periods?.length>0 && <details><summary style={{cursor:'pointer'}}>Voir les échéances concernées</summary>{loss.snapshot.periods.map(p=><div key={p.period}>{formatDateFR(p.period)} · Owner {formatEUR(p.expected_owner)} → {formatEUR(p.new_expected_owner)} · Opti’Lex {formatEUR(p.expected_optilex_ttc)} → {formatEUR(p.new_expected_optilex_ttc)}</div>)}</details>}
    </div>}
    {pending && canProcess && <div style={{display:'grid',gap:10}}>
      <label>Décision financière<select aria-label="Décision financière" value={action} onChange={e=>{setAction(e.target.value);setConfirmed(false);}} style={{...button,display:'block',width:'100%',marginTop:5}}>
        <option value="">Choisir le traitement…</option>
        {state==='Rétractation' && <option value="withdrawal">Acter la rétractation en finance</option>}
        {terminal.has(state) && <option value="billing-stop">Fixer le dernier mois facturé</option>}
        {!terminal.has(state) && state!=='Rétractation' && !review.finance_withdrawn_at && <option value="resume">Rétablir la facturation</option>}
        <option value="keep">Conserver le traitement financier actuel</option>
      </select></label>
      {action==='billing-stop' && <label>Dernier mois facturé (MM/AAAA)<input aria-label="Dernier mois facturé" placeholder="10/2026" value={month} onChange={e=>{setMonth(e.target.value);setConfirmed(false);}} style={{...button,display:'block'}}/></label>}
      {action==='withdrawal' && <p>Les attendus sont annulés depuis la signature. Les encaissements et remboursements sont conservés. {loss ? 'La perte existante sera conservée, sans doublon.' : 'Une perte de rétractation sera enregistrée.'}</p>}
      {loss && action && <label style={{display:'flex',gap:8,alignItems:'flex-start'}}><input type="checkbox" checked={link} onChange={e=>{setLink(e.target.checked);setConfirmed(false);}}/>J’ai vérifié le périmètre : cette perte correspond à la situation déclarée. La rattacher.</label>}
      {action==='resume' && <p>Le calendrier sera recalculé selon le contrat ; les montants fixés manuellement et les encaissements seront conservés.</p>}
      {action==='keep' && <p>La situation sera marquée comme examinée, sans modifier les montants ni annuler une opération existante.</p>}
      {action && <label style={{display:'flex',gap:8}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Je confirme cette décision financière.</label>}
      <button style={{...button,justifyContent:'center',background:'#292b31',color:'#fff',opacity:(!confirmed || busy) ? 0.5 : 1}} disabled={!confirmed || busy || (action==='withdrawal' && loss && !link) || (action==='billing-stop' && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(month))} onClick={process}>{busy?'Enregistrement…':'Enregistrer le traitement financier'}</button>
    </div>}
    {pending && !canProcess && <p>La direction financière peut traiter cet état depuis cette fiche.</p>}
    {error && <p role="alert" style={{color:'#b42318'}}>{error}</p>}
  </section>;
}
