import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ClipboardList, Users, ArrowDownRight } from 'lucide-react';
import apiClient from '../services/apiClient';
import MentionTextarea from './MentionTextarea';
import { mentionedIds } from '../utils/mentions';
import { MeteoIcon } from './meteo';
import { WEATHER, QUALIFICATION_FIELDS, qualificationComplete } from '../utils/weatherCase';
import './weatherCase.css';

export function WeatherQualification({ context }) {
  if (!context?.qualification) return null;
  return <dl className="wc-summary">{QUALIFICATION_FIELDS.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{context.qualification[key]}</dd></div>)}</dl>;
}

export default function WeatherCaseComposer({ onSave, onCancel, requireNote = false, saveLabel = "Enregistrer et partager" }) {
  const [score, setScore] = useState(null);
  const [form, setForm] = useState({reason:'',expectation:'',actions:''});
  const [note,setNote] = useState('');
  const [people,setPeople] = useState([]);
  const [tagged,setTagged] = useState([]);
  const request = useRef({ fingerprint:null, key:null });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => { let active=true; apiClient.get('/api/v1/optilex/comments/mentionables').then(r => { if(active)setPeople(r.people || []); }).catch(() => {}); return () => {active=false;}; },[]);
  const save = async () => {
    if (busy || (!qualificationComplete(score,form) || (requireNote && score>3 && !note.trim()))) return;
    setBusy(true);setError('');
    const body=score<=3 ? Object.values(form).join('\n') : note;
    try {
      const payload={version:2,score,note:score<=3?'':note,qualification:score<=3?form:null,
        mentions:[...new Set([...tagged,...mentionedIds(body,people)])]};
      const fingerprint=JSON.stringify(payload);
      if(request.current.fingerprint!==fingerprint)request.current={fingerprint,key:crypto.randomUUID()};
      const ok=await onSave({...payload,request_key:request.current.key});
      if(ok===false) throw Error();
      setScore(null);setNote('');setForm({reason:'',expectation:'',actions:''});setTagged([]);request.current={fingerprint:null,key:null};
    } catch {setError('La météo n’a pas été enregistrée. Votre saisie est conservée. Réessayez.');}
    finally {setBusy(false);}
  };
  return <section className="wc-composer" aria-label="Nouvelle météo client">
    <div className="wc-heading"><span className="wc-symbol"><ClipboardList size={21}/></span><div><h3>Faire le point sur le client</h3><p>Une météo, un contexte partagé, un suivi commun.</p></div></div>
    <div className="wc-choices" role="group" aria-label="Choisir la météo">{[5,4,3,2,1].map(n => <button type="button" key={n} aria-pressed={score===n} onClick={() => setScore(n)} style={{'--wc-color':WEATHER[n].color,'--wc-bg':WEATHER[n].bg}}><MeteoIcon score={n} size={24} color={WEATHER[n].color}/><strong>{n} · {WEATHER[n].label}</strong></button>)}</div>
    {score && <p className="wc-description"><ArrowDownRight size={16}/>{WEATHER[score].description}</p>}
    {score<=3 && score ? <div className="wc-form"><div className="wc-form-heading"><MessageSquare size={18}/><strong>Qualifier la situation</strong><span>3 champs obligatoires</span></div>{QUALIFICATION_FIELDS.map(([field,label,question]) => <label key={field}>{label}<MentionTextarea value={form[field]} onChange={value=>setForm({...form,[field]:value})} people={people} placeholder={question} rows={2} maxLength={1000}/></label>)}</div> : score ? <label className="wc-note">Commentaire<MentionTextarea value={note} onChange={setNote} people={people} rows={2} placeholder="Contexte utile à partager…" maxLength={4000}/></label> : null}
    {score && <details className="wc-recipients"><summary><Users size={16}/>Mentionner un collègue {tagged.length>0?`(${tagged.length})`:''}</summary><div>{people.map(p=><label key={p.id}><input type="checkbox" checked={tagged.includes(p.id)} onChange={e=>setTagged(e.target.checked?[...tagged,p.id]:tagged.filter(id=>id!==p.id))}/><span>{p.name}<small>{p.group}</small></span></label>)}</div></details>}
    {score && <p className="wc-delivery">La météo et le formulaire sont enregistrés ensemble. Les personnes concernées reçoivent un seul email récapitulatif.</p>}
    {error && <p role="alert" className="wc-error">{error}</p>}
    <footer>{onCancel && <button type="button" onClick={onCancel} disabled={busy}>Annuler</button>}<button className="wc-primary" type="button" disabled={busy || (!qualificationComplete(score,form) || (requireNote && score>3 && !note.trim()))} onClick={save}><Send size={16}/>{busy?'Enregistrement…':saveLabel}</button></footer>
  </section>;
}
