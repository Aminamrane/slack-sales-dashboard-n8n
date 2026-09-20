import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarCheck2, CalendarClock, Check, CircleX, Clock3, FileCheck2, Landmark, MessageCircle, Pause, UserRoundX, UsersRound, Wallet, X } from 'lucide-react';
import './salesJourney.css';
export const RESULTS = [
  ['done','Prêt pour le contrat','Le client souhaite poursuivre',FileCheck2],
  ['comptable','Avis du comptable','Un échange reste nécessaire',Landmark],
  ['associe','Avis d’un associé','Une décision à plusieurs',UsersRound],
  ['reflexion','Temps de réflexion','Le client souhaite réfléchir',MessageCircle],
  ['relire_contrat','Relire le contrat','Le client souhaite le consulter',FileCheck2],
  ['pas_decision_jour','Décision en attente','Aucune décision à ce stade',Pause],
  ['tresorerie','Trésorerie à prévoir','Un point financier à résoudre',Wallet],
  ['pas_interesse','Pas intéressé','Le client ne poursuit pas',CircleX],
];
export function useDialogFocus(ref, onClose, busy = false) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    const key = e => {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,[contenteditable="true"]')].filter(x => x.getClientRects().length);
      if (!items.length) { e.preventDefault(); return; }
      const first=items[0],last=items.at(-1);
      if (e.shiftKey && (document.activeElement===first || document.activeElement===ref.current)) {e.preventDefault();last.focus();}
      else if (!e.shiftKey && (document.activeElement===last || document.activeElement===ref.current)) {e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.isConnected && previous.focus();};
  },[ref,busy]);
}
export default function QualificationDialog({lead,stage='r2',onClose,onSave,dark=false}) {
  const isR1=stage==='r1';
  const old=lead[`${stage}_result`];
  const [attended,setAttended]=useState(!['no_show','reporte','annule','rescheduled','cancelled'].includes(old));
  const [result,setResult]=useState(old || 'done');
  const [date,setDate]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const ref=useRef(null); useDialogFocus(ref,onClose,busy);
  const label=stage.toUpperCase();
  const options=attended ? (isR1?[['done','R1 effectué','Le rendez-vous a eu lieu. Vous pouvez préparer le contrat ou planifier un R2 depuis le dossier.',CalendarCheck2]]:RESULTS) : [['no_show','Client absent','Le rendez-vous n’a pas eu lieu',UserRoundX],[isR1?'rescheduled':'reporte','À reprogrammer','Choisir une nouvelle date',CalendarClock],[isR1?'cancelled':'annule','Rendez-vous annulé','Sans nouvelle date prévue',CircleX]];
  async function save(continueContract) {
    if(busy)return;
    if(['reporte','rescheduled'].includes(result) && !date){setError('Choisissez la nouvelle date du rendez-vous.');return;}
    setBusy(true);setError('');
    try {await onSave({result,attended,date,continueContract});} catch(e){setError(e.message || 'La qualification n’a pas été enregistrée. Réessayez.');} finally{setBusy(false);}
  }
  return createPortal(<div className={`sj-overlay ${dark?'sj-dark':''}`} onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section ref={ref} tabIndex={-1} className="sj-dialog" role="dialog" aria-modal="true" aria-labelledby="sj-title">
      <header className="sj-head"><span className="sj-icon"><CalendarCheck2 size={24}/></span><div><small>RENDEZ-VOUS COMMERCIAL</small><h2 id="sj-title">Qualifier le {label}</h2><p>{lead.company_name || lead.full_name}</p></div><button className="sj-close" aria-label="Fermer la qualification" onClick={onClose} disabled={busy}><X size={20}/></button></header>
      <div className="sj-body"><div className="sj-attendance" role="group" aria-label="Le rendez-vous a-t-il eu lieu ?">{[[true,`${label} effectué`,Check],[false,'Non effectué',Clock3]].map(([value,text,Icon])=><button key={text} disabled={busy} aria-pressed={attended===value} onClick={()=>{setAttended(value);setResult(value?'done':'no_show');setError('');}}><Icon size={18}/>{text}</button>)}</div>
      <h3>{attended?'Quelle est la suite ?':'Que s’est-il passé ?'}</h3><div className="sj-options">{options.map(([value,title,desc,Icon])=><button key={value} disabled={busy} className={result===value?'is-selected':''} aria-pressed={result===value} onClick={()=>{setResult(value);setError('');}}><Icon size={21}/><span><strong>{title}</strong><small>{desc}</small></span>{result===value&&<Check size={16}/>}</button>)}</div>
      {['reporte','rescheduled'].includes(result)&&<label className="sj-date">Nouveau rendez-vous<input aria-label="Nouveau rendez-vous" type="datetime-local" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>}
      {error&&<p className="sj-error" role="alert">{error}</p>}</div>
      <footer className="sj-footer"><button disabled={busy} onClick={()=>save(false)}>Enregistrer</button>{attended&&['done','relire_contrat'].includes(result)&&<button className="sj-primary" disabled={busy} onClick={()=>save(true)}>{busy?'Enregistrement…':'Préparer le contrat'}<ArrowRight size={17}/></button>}</footer>
    </section>
  </div>,document.body);
}
