import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowRight, Building2, CalendarDays, CirclePause, CircleX, ClipboardCheck, ClipboardList, Clock3, Gavel, Link2, RotateCcw, Search, Tags, Undo2, User,
  UserX, Users, X,
} from 'lucide-react';
import apiClient from '../../../services/apiClient.js';
import { READ_ONLY_PROPS } from '../../../utils/readOnlyRoles.js';
import { formatEUR, formatDateFR } from '../constants.js';
import { Card, Empty, OpenCue, Page, RefreshButton, Reveal, Stat, Stats, TableBox, Tag, Th, Who } from './PageKit.jsx';
import { Breakdown } from './ValidationsView.jsx';
import './FollowupTabs.css';

const box = { border: '1px solid #f0e09a', background: '#fdf9e6', borderRadius: 14, padding: 16, marginTop: 18, fontSize: 13, lineHeight: 1.55 };
const button = { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 13px', border:'1px solid #e8e4de', borderRadius:12, background:'#fff', cursor:'pointer', font:'inherit', fontSize:12.5, color:'#1c1b19' };
const terminal = new Set(['Résiliation','Self-Résiliation','Liquidation','Pause']);
// La file « États à traiter » (refonte dev 10/11/2026, langage des Statistiques) : chiffres clés, répartition par
// état et par déclarant qui filtrent la liste, puis le tableau des dossiers. Même chargement, même rafraîchissement
// toutes les 30 secondes, même geste : examiner le dossier ouvre la fiche du client.
const STATE_LOOK = {
  'Rétractation': { tone: 'peach', color: '#f4b183', Icon: Undo2 },
  'Résiliation': { tone: 'red', color: '#ee8f8a', Icon: CircleX },
  'Self-Résiliation': { tone: 'lilac', color: '#aaa5ee', Icon: UserX },
  'Liquidation': { tone: 'yellow', color: '#ecd36a', Icon: Gavel },
  'Pause': { tone: 'blue', color: '#8fbdf3', Icon: CirclePause },
  'Retour automatique': { tone: 'cyan', color: '#7fd3df', Icon: RotateCcw },
};
const stateLook = (state) => STATE_LOOK[state] || { tone: undefined, color: '#cfc8bd', Icon: ClipboardList };
const stateOf = (r) => r.requested_state || 'Retour automatique';
const daysSince = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : Math.max(Math.floor((Date.now() - d.getTime()) / 86400000), 0);
};
const ago = (iso) => {
  const days = daysSince(iso);
  return days == null ? null : days === 0 ? 'aujourd’hui' : `il y a ${days} j`;
};
const foldText = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function StateReviewQueue({ onOpenClient }) {
  const [items,setItems] = useState([]), [error,setError] = useState('');
  const [loaded,setLoaded] = useState(false), [busy,setBusy] = useState(false);
  const [filter,setFilter] = useState({ state: null, by: null }), [query,setQuery] = useState('');
  const load = useCallback(() => apiClient.get('/api/v1/finance-periods/client/state-reviews').then(d => {setItems(d.items || []);setError('');}).catch(() => setError('Impossible de charger les états à traiter. Réessayez.')).finally(() => setLoaded(true)),[]);
  useEffect(() => {load();const t=setInterval(load,30000);return()=>clearInterval(t);},[load]);
  const refresh = () => { setBusy(true); load().finally(() => setBusy(false)); };

  const facts = useMemo(() => {
    const states = new Map(), people = new Map();
    let oldest = null;
    for (const r of items) {
      const state = stateOf(r), look = stateLook(state);
      const s = states.get(state) || { key: state, name: state, total: 0, Icon: look.Icon, color: look.color };
      s.total += 1; states.set(state, s);
      const by = r.requested_by || 'Non renseigné';
      const p = people.get(by) || { key: by, name: by, total: 0, color: '#cfc8bd' };
      p.total += 1; people.set(by, p);
      if (r.requested_at && (!oldest || r.requested_at < oldest)) oldest = r.requested_at;
    }
    const rank = (map) => [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'fr'))
      .map((row) => ({ ...row, segments: [{ color: row.color, n: row.total }] }));
    return { states: rank(states), people: rank(people), oldest };
  }, [items]);

  const visible = useMemo(() => {
    const q = foldText(query.trim());
    return items.filter((r) => (!filter.state || stateOf(r) === filter.state)
      && (!filter.by || (r.requested_by || 'Non renseigné') === filter.by)
      && (!q || foldText([r.company_name, r.numero_client, stateOf(r), r.requested_by].join(' ')).includes(q)));
  }, [items, filter, query]);

  const toggle = (key, value) => setFilter((f) => ({ ...f, [key]: f[key] === value ? null : value }));
  const chips = [filter.state && { key: 'state', label: filter.state }, filter.by && { key: 'by', label: filter.by }].filter(Boolean);
  const oldestDays = facts.oldest ? daysSince(facts.oldest) : null;

  return (
    <Page title="États à traiter" actions={<RefreshButton onClick={refresh} busy={busy} />}
      sub="Les situations déclarées dans le board dont les montants restent à traiter en finance, dossier par dossier.">
      {error && <div className="fst-error" role="alert">{error}<button type="button" onClick={refresh}>Réessayer</button></div>}

      <Stats>
        <Stat label="À traiter" Icon={Clock3} value={items.length} tone={items.length ? 'amber' : undefined}
          note={items.length ? 'en attente de traitement financier' : 'aucun état en attente'} />
        <Stat label="Plus ancienne déclaration" Icon={CalendarDays} text={facts.oldest ? formatDateFR(facts.oldest) : '—'}
          tone={oldestDays != null && oldestDays > 14 ? 'red' : undefined} note={facts.oldest ? ago(facts.oldest) : 'rien en attente'} />
        <Stat label="États différents" Icon={Tags} value={facts.states.length} note={facts.states[0] ? `le plus fréquent : ${facts.states[0].name}` : 'aucun pour l’instant'} />
        <Stat label="Déclarants" Icon={Users} value={facts.people.length} note="personnes à l’origine des déclarations" />
      </Stats>

      {items.length > 0 && (
        <Reveal className="fst-grid is-even">
          <Card title="Par état" Icon={Tags} hint="Ce qui a été déclaré dans le board. Un clic filtre la liste.">
            <Breakdown rows={facts.states} active={filter.state} onPick={(key) => toggle('state', key)} wide />
          </Card>
          <Card title="Par déclarant" Icon={Users} hint="Qui a déclaré la situation. Un clic filtre la liste.">
            <Breakdown rows={facts.people} active={filter.by} onPick={(key) => toggle('by', key)} />
          </Card>
        </Reveal>
      )}

      <Reveal amount={0.03}>
        <Card title="Dossiers à examiner" Icon={ClipboardList}
          hint="Les décisions de sortie de la direction appliquent les montants directement en Finance. Cette liste rassemble les autres situations et les anciennes déclarations restant à traiter.">
          {!error && loaded && !items.length && <Empty boxed>Aucun état en attente de traitement financier.</Empty>}
          {!loaded && !error && <Empty boxed>Chargement des états à traiter…</Empty>}
          {items.length > 0 && (
            <>
              <div className="fst-tools">
                <span className="fst-cell-muted fst-num">{visible.length} dossier{visible.length > 1 ? 's' : ''}</span>
                <AnimatePresence initial={false}>
                  {chips.map((chip) => (
                    <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} title="Retirer ce filtre" onClick={() => toggle(chip.key, chip.label)}>
                      {chip.label}<X size={13} />
                    </Motion.button>
                  ))}
                </AnimatePresence>
                <label className="fst-search" style={{ marginLeft: 'auto' }}>
                  <Search size={14} />
                  <input type="search" placeholder="Client, état, déclarant…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un dossier" />
                </label>
              </div>
              <TableBox minWidth={900} after={visible.length === 0 && <Empty>Aucun dossier ne correspond à ces filtres.</Empty>}>
                <thead>
                  <tr>
                    <Th Icon={Building2}>Client</Th>
                    <Th Icon={Tags}>État demandé</Th>
                    <Th Icon={CalendarDays}>Date d’effet</Th>
                    <Th Icon={User}>Déclaré par</Th>
                    <Th Icon={Clock3}>Déclaré le</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.client_id} style={{ '--i': Math.min(i, 14) }} data-open="true" onClick={() => onOpenClient(r.client_id)} title="Examiner le dossier">
                      <td>
                        <div className="fst-cell-main">{r.company_name}<OpenCue /></div>
                        <div className="fst-cell-sub fst-num">n° {r.numero_client}</div>
                      </td>
                      <td><Tag tone={stateLook(stateOf(r)).tone}>{stateOf(r)}</Tag></td>
                      <td className="is-nowrap fst-num">{r.requested_date ? formatDateFR(r.requested_date) : <span className="fst-cell-muted">–</span>}</td>
                      <td><Who name={r.requested_by} /></td>
                      <td className="is-nowrap">
                        <div className="fst-num">{formatDateFR(r.requested_at)}</div>
                        {ago(r.requested_at) && <div className="fst-cell-sub">{ago(r.requested_at)}</div>}
                      </td>
                      <td className="is-num">
                        <button type="button" className="fst-btn is-small" onClick={(e) => { e.stopPropagation(); onOpenClient(r.client_id); }}>
                          Examiner le dossier <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableBox>
            </>
          )}
        </Card>
      </Reveal>
    </Page>
  );
}

// `readOnly` (rôles en lecture seule) : le formulaire de traitement reste visible, désactivé.
export default function StateReview({ clientId, version, canProcess, onChanged, onReview, readOnly = false }) {
  const [review,setReview] = useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [action,setAction]=useState(''),[month,setMonth]=useState(''),[link,setLink]=useState(false),[confirmed,setConfirmed]=useState(false);
  const load = useCallback(async()=>{
    try { const d=await apiClient.get(`/api/v1/finance-periods/client/${clientId}/state-review`);setReview(d);onReview?.(d);setError(''); }
    catch {setError('Le suivi financier est indisponible. Actualisez avant de traiter cet état.');}
  },[clientId,onReview]);
  useEffect(()=>{setReview(null);load();},[load,version]);
  useEffect(()=>{setAction('');setMonth('');setLink(false);setConfirmed(false);},[review?.revision,clientId]);
  const ro = readOnly ? READ_ONLY_PROPS : {};
  const process = async()=>{
    if (readOnly) return;
    setBusy(true);setError('');
    try { const d=await apiClient.post(`/api/v1/finance-periods/client/${clientId}/state-review`,{revision:review.revision,action,last_month:/^(0[1-9]|1[0-2])\/\d{4}$/.test(month) ? `${month.slice(3)}-${month.slice(0,2)}` : null,link_loss_id:link ? review.active_loss?.id : null});setReview(d);setConfirmed(false);onChanged?.(); }
    catch(e){setError(e?.data?.detail || 'Traitement non enregistré. Actualisez et réessayez.');}
    finally{setBusy(false);}
  };
  if (!review && !error) return null;
  if (review?.status==='none' || (review?.status==='processed' && !review.reviewed_at && !review.finance_withdrawn_at)) return null;
  const pending=review?.status==='pending', loss=review?.active_loss, state=review?.requested_state;
  const Wrapper = pending || error ? 'section' : 'details';
  const Heading = pending || error ? 'div' : 'summary';
  return <Wrapper style={{...box,padding:pending?16:10,background:pending?'#fdf9e6':'#f1faf5',borderColor:pending?'#f0e09a':'#c3ebd3'}} aria-label="Traitement financier de la situation">
    <Heading style={{display:'flex',gap:8,alignItems:'center',fontWeight:500,cursor:pending?'default':'pointer',fontSize:12}}>{pending?<Clock3 size={17}/>:<ClipboardCheck size={17}/>} {pending?'Traitement financier à effectuer':'Traitement financier effectué · voir le détail'}</Heading>
    {!pending && review?.decision && <p>Traitement effectué : {({withdrawal:'rétractation traitée', 'board-loss':'perte choisie depuis le board, reste à recouvrer conservé', 'billing-stop':'fin de facturation fixée', resume:'facturation rétablie', keep:'traitement financier conservé, aucun montant modifié'})[review.decision]} · {review.reviewed_by}</p>}
    {pending && <p style={{margin:'8px 0'}}><strong>{state || 'Retour automatique'}</strong> : situation enregistrée dans le board. Le traitement des montants reste à effectuer par la finance, sans modifier cette situation.</p>}
    {review?.finance_withdrawn_at && <p>Rétractation déjà traitée en finance, avec effet au {formatDateFR(review.finance_withdrawn_at)}. Un changement dans le board ne restaure pas les attendus.</p>}
    {review?.linked_loss_id && <p style={{display:'flex',gap:6,alignItems:'center'}}><Link2 size={15}/>Perte n°{review.linked_loss_id} rattachée et conservée.</p>}
    {pending && loss && <div style={{padding:12,background:'#fff',border:'1px solid #ece9e4',borderRadius:12,margin:'12px 0'}}>
      <strong>Perte existante n°{loss.id} · {loss.declared_by_name || 'Finance'}</strong>
      <div>{formatDateFR(loss.declared_at)} · {loss.periods_cleared} échéances</div>
      <div>Créances : Owner {formatEUR(loss.amount_owner)} · Opti’Lex {formatEUR(loss.amount_optilex_ttc)}</div>
      <div>Futur : Owner {formatEUR(loss.future_owner)} · Opti’Lex {formatEUR(loss.future_optilex_ttc)}</div>
      <div>Motif : {loss.reason || 'Non renseigné'}</div>
      {loss.snapshot?.periods?.length>0 && <details><summary style={{cursor:'pointer'}}>Voir les échéances concernées</summary>{loss.snapshot.periods.map(p=><div key={p.period}>{formatDateFR(p.period)} · Owner {formatEUR(p.expected_owner)} → {formatEUR(p.new_expected_owner)} · Opti’Lex {formatEUR(p.expected_optilex_ttc)} → {formatEUR(p.new_expected_optilex_ttc)}</div>)}</details>}
    </div>}
    {pending && (canProcess || readOnly) && <div style={{display:'grid',gap:10}}>
      <label>Traitement financier<select aria-label="Traitement financier" value={action} onChange={e=>{setAction(e.target.value);setConfirmed(false);}} style={{...button,display:'block',width:'100%',marginTop:5}} {...ro}>
        <option value="">Choisir le traitement…</option>
        {state==='Rétractation' && <option value="withdrawal">Appliquer les conséquences financières de la rétractation</option>}
        {terminal.has(state) && <option value="billing-stop">Fixer le dernier mois facturé</option>}
        {!terminal.has(state) && state!=='Rétractation' && !review.finance_withdrawn_at && <option value="resume">Rétablir la facturation</option>}
        <option value="keep">Conserver le traitement financier actuel</option>
      </select></label>
      {action==='billing-stop' && <label>Dernier mois facturé (MM/AAAA)<input aria-label="Dernier mois facturé" placeholder="10/2026" value={month} onChange={e=>{setMonth(e.target.value);setConfirmed(false);}} style={{...button,display:'block'}}/></label>}
      {action==='withdrawal' && <p>Les attendus sont annulés depuis la signature. Les encaissements et remboursements sont conservés. {loss ? 'La perte existante sera conservée, sans doublon.' : 'Une perte de rétractation sera enregistrée.'}</p>}
      {loss && action && <label style={{display:'flex',gap:8,alignItems:'flex-start'}}><input type="checkbox" checked={link} onChange={e=>{setLink(e.target.checked);setConfirmed(false);}}/>J’ai vérifié le périmètre : cette perte correspond à la situation déclarée. La rattacher.</label>}
      {action==='resume' && <p>Le calendrier sera recalculé selon le contrat ; les montants fixés manuellement et les encaissements seront conservés.</p>}
      {action==='keep' && <p>Le suivi financier sera marqué comme traité, sans modifier les montants ni la situation actée dans le board.</p>}
      {action && <label style={{display:'flex',gap:8}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Je confirme ce traitement des montants. La situation du client reste inchangée.</label>}
      <button style={{...button,justifyContent:'center',background:'#2b2927',color:'#fff',borderColor:'#2b2927',opacity:(!confirmed || busy) ? 0.5 : 1}} disabled={!confirmed || busy || (action==='withdrawal' && loss && !link) || (action==='billing-stop' && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(month))} onClick={process} {...ro}>{busy?'Enregistrement…':'Enregistrer le traitement financier'}</button>
    </div>}
    {pending && !canProcess && !readOnly && <p>La direction financière peut traiter cet état depuis cette fiche.</p>}
    {error && <p role="alert" style={{color:'#c5221f'}}>{error}</p>}
  </Wrapper>;
}
