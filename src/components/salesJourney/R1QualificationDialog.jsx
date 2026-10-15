import {ParisDateTimeInput} from './FrenchDateInput';
import React,{useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarCheck2,CalendarClock,CalendarPlus,UserRoundX,CircleX,FileCheck2,Check,X,ArrowRight,Clock3} from 'lucide-react';
import {useDialogFocus} from './QualificationDialog';
import {RELANCE_CHOICES,REPORT_CHOICES,TO_RESCHEDULE} from './missedChoices';
import ChoiceButtons from './ChoiceButtons';
const outcomes=[['done','R1 effectué','Le rendez-vous a eu lieu',CalendarCheck2],['no_show','Client absent','Le client ne s’est pas présenté',UserRoundX],['rescheduled','Reporter le R1','Avec ou sans nouvelle date',CalendarClock],['cancelled','R1 annulé','Le rendez-vous est annulé',CircleX]];
export default function R1QualificationDialog({lead,onClose,onSave,dark=false}){
 // « À reporter » (dev 15/10/2026) : rouvert comme « Reporter le R1 », date à fixer.
 const [result,setResult]=useState(lead.r1_result===TO_RESCHEDULE.r1?'rescheduled':(lead.r1_result||''));
 const [relance,setRelance]=useState('relance');
 const [when,setWhen]=useState(lead.r1_result===TO_RESCHEDULE.r1?'later':'date');
 const [next,setNext]=useState('r2_set');
 const [date,setDate]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const ref=useRef(null);useDialogFocus(ref,onClose,busy);
 const needsDate=(result==='rescheduled'&&when==='date')||(result==='done'&&next==='r2_set');
 async function save(){
  if(busy)return;
  if(!result){setError('Choisissez le résultat du R1.');return;}
  if(needsDate&&!date){setError(result==='rescheduled'?'Choisissez la nouvelle date du R1.':'Choisissez la date et l’heure du R2.');return;}
  setBusy(true);setError('');
  const saved=result==='rescheduled'&&when==='later'?TO_RESCHEDULE.r1:result;
  try{await onSave({result:saved,attended:result==='done',date:needsDate?date:'',followUp:result==='done'?next:undefined,continueContract:result==='done'&&next==='contract',relance:result==='no_show'?relance==='relance':undefined});}catch(e){setError(e.message||'La qualification n’a pas été enregistrée.');}finally{setBusy(false);}
 }
 return createPortal(<div className={`sj-overlay ${dark?'sj-dark':''}`} onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="sj-dialog" role="dialog" aria-modal="true" aria-labelledby="sj-r1-title" ref={ref} tabIndex={-1}>
 <header className="sj-head"><span className="sj-icon"><CalendarCheck2 size={24}/></span><div><small>RENDEZ-VOUS COMMERCIAL</small><h2 id="sj-r1-title">Qualifier le R1</h2><p>{lead.company_name||lead.full_name}</p></div><button className="sj-close" disabled={busy} onClick={onClose} aria-label="Fermer la qualification"><X size={20}/></button></header>
 <div className="sj-body"><h3 style={{marginTop:0}}>Comment s’est passé le rendez-vous ?</h3><div className="sj-options">{outcomes.map(([key,title,desc,Icon])=><button key={key} disabled={busy} aria-pressed={result===key} className={result===key?'is-selected':''} onClick={()=>{setResult(key);setDate('');setError('');}}><Icon size={21}/><span><strong>{title}</strong><small>{desc}</small></span>{result===key&&<Check size={16}/>}</button>)}</div>
 {result==='done'&&<div className="sj-r1-next"><h3>Quelle est la prochaine étape ?</h3><div className="sj-options">{[['r2_set','Placer le R2','Planifier le rendez-vous d’audit',CalendarPlus],['later','Décider plus tard','Enregistrer le R1 effectué',Clock3]].map(([key,title,desc,Icon])=><button key={key} disabled={busy} aria-pressed={next===key} className={next===key?'is-selected':''} onClick={()=>{setNext(key);setError('');}}><Icon size={21}/><span><strong>{title}</strong><small>{desc}</small></span>{next===key&&<Check size={16}/>}</button>)}</div><button className="sj-contract-alternative" disabled={busy} aria-pressed={next==='contract'} onClick={()=>{setNext('contract');setError('');}}><FileCheck2 size={18}/><span>Le client est déjà prêt à signer<strong>Passer directement au contrat</strong></span>{next==='contract'?<Check size={17}/>:<ArrowRight size={17}/>}</button></div>}
 {result==='no_show'&&<div className="sj-r1-next"><h3>Relancer le client ?</h3><ChoiceButtons items={RELANCE_CHOICES} value={relance} disabled={busy} onPick={key=>{setRelance(key);setError('');}}/></div>}
 {result==='rescheduled'&&<div className="sj-r1-next"><h3>La nouvelle date ?</h3><ChoiceButtons items={REPORT_CHOICES} value={when} disabled={busy} onPick={key=>{setWhen(key);setDate('');setError('');}}/></div>}
 {needsDate&&<ParisDateTimeInput key={result} label={result==='rescheduled'?'Nouvelle date du R1':'Date et heure du R2'} value={date} disabled={busy} onChange={value=>{setDate(value);setError('');}}/>}
 {error&&<p className="sj-error" role="alert">{error}</p>}</div><footer className="sj-footer"><button disabled={busy} onClick={onClose}>Annuler</button><button className="sj-primary" disabled={busy||!result} onClick={save}>{busy?'Enregistrement…':result==='done'&&next==='r2_set'?'Confirmer et placer le R2':result==='done'&&next==='contract'?'Continuer vers le contrat':'Enregistrer'}<ArrowRight size={17}/></button></footer></section></div>,document.body);
}
