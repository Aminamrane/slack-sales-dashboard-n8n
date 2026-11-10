import { useEffect, useImperativeHandle, useRef, useState } from 'react';
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

export function WeatherScaleGuide() {
  return <details className="wc-scale-guide"><summary>Comprendre les 5 niveaux de météo</summary>
    <dl>{[5,4,3,2,1].map(score => <div key={score}><dt style={{color:WEATHER[score].color}}>{score} · {WEATHER[score].label}</dt><dd>{WEATHER[score].description}</dd></div>)}</dl>
  </details>;
}

// `controlRef` (parcours « Faire l'onboarding ») : le parcours lit la saisie en cours (`dirty`, `complete`), l'enregistre
// (`save`) ou montre ce qui manque (`reveal`) avant de quitter l'étape, pour qu'une météo choisie ne soit jamais perdue.
export default function WeatherCaseComposer({ onSave, onCancel, requireNote = false, saveLabel = "Enregistrer et partager", controlRef }) {
  const [score, setScore] = useState(null);
  const [form, setForm] = useState({reason:'',expectation:'',actions:''});
  const [note,setNote] = useState('');
  const [people,setPeople] = useState([]);
  const [tagged,setTagged] = useState([]);
  const request = useRef({ fingerprint:null, key:null });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const root = useRef(null);
  const complete = qualificationComplete(score,form) && !(requireNote && score>3 && !note.trim());
  useEffect(() => { let active=true; apiClient.get('/api/v1/optilex/comments/mentionables').then(r => { if(active)setPeople(r.people || []); }).catch(() => {}); return () => {active=false;}; },[]);
  const save = async () => {
    if (busy || !complete) return false;
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
      return true;
    } catch {setError('La météo n’a pas été enregistrée. Votre saisie est conservée. Réessayez.');return false;}
    finally {setBusy(false);}
  };
  const reveal = () => {
    setError(score<=3 ? 'Remplissez le motif, l’attente client et l’action à envisager pour enregistrer la météo.' : 'Écrivez un commentaire pour enregistrer la météo.');
    [...(root.current?.querySelectorAll('textarea') || [])].find(t => !t.value.trim())?.focus();
  };
  useImperativeHandle(controlRef, () => ({ dirty: score!=null, complete, save, reveal }));
  return <section ref={root} className="wc-composer" aria-label="Nouvelle météo client">
    <div className="wc-heading"><span className="wc-symbol"><ClipboardList size={21}/></span><div><h3>Faire le point sur le client</h3><p>À chaque échange avec le client, avant ou après l’onboarding.</p></div></div>
    <div className="wc-choices" role="group" aria-label="Choisir la météo">{[5,4,3,2,1].map(n => <button type="button" key={n} title={WEATHER[n].description} aria-pressed={score===n} onClick={() => setScore(n)} style={{'--wc-tile':WEATHER[n].tile,'--wc-ink':WEATHER[n].ink}}><MeteoIcon score={n} size={30} color={WEATHER[n].ink}/><strong>{WEATHER[n].label}</strong><small>{n}/5</small></button>)}</div>
    {score && <p className="wc-description" style={{'--wc-tile':WEATHER[score].tile,'--wc-ink':WEATHER[score].ink}}><ArrowDownRight size={16}/>{WEATHER[score].description}</p>}
    {score<=3 && score ? <div className="wc-form"><div className="wc-form-heading"><MessageSquare size={18}/><strong>Qualifier la situation</strong><span>3 champs obligatoires</span></div>{QUALIFICATION_FIELDS.map(([field,label,question]) => <label key={field}>{label}<MentionTextarea value={form[field]} onChange={value=>setForm({...form,[field]:value})} people={people} placeholder={question} rows={2} maxLength={1000}/></label>)}</div> : score ? <label className="wc-note">Commentaire{requireNote ? ' (obligatoire)' : ''}<MentionTextarea value={note} onChange={setNote} people={people} rows={2} placeholder="Contexte utile à partager…" maxLength={4000}/></label> : null}
    {score && <details className="wc-recipients"><summary><Users size={16}/>Mentionner un collègue {tagged.length>0?`(${tagged.length})`:''}</summary><div>{people.map(p=><label key={p.id}><input type="checkbox" checked={tagged.includes(p.id)} onChange={e=>setTagged(e.target.checked?[...tagged,p.id]:tagged.filter(id=>id!==p.id))}/><span>{p.name}<small>{p.group}</small></span></label>)}</div></details>}
    {score && <p className="wc-delivery">La météo et le formulaire sont enregistrés ensemble. Les personnes concernées reçoivent un seul email récapitulatif.</p>}
    {error && <p role="alert" className="wc-error">{error}</p>}
    <footer>{onCancel && <button type="button" onClick={onCancel} disabled={busy}>Annuler</button>}<button className="wc-primary" type="button" disabled={busy || !complete} onClick={save}><Send size={16}/>{busy?'Enregistrement…':saveLabel}</button></footer>
  </section>;
}
