import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {PhoneCall, Voicemail, UserRoundX, CircleX, CircleAlert, RotateCcw, CalendarPlus, CalendarClock, PhoneOff, Check, X, ArrowRight} from 'lucide-react';
import FrenchDateInput, {ParisDateTimeInput} from './FrenchDateInput';
import {useDialogFocus} from './QualificationDialog';
import {CALLBACK_NOTE_MAX, CALLBACK_RULE_HELP, recallInPast, recallRuleNote} from '../../utils/contactQualification';
import './salesJourney.css';

const outcomes = [
  ['reached', 'A décroché', 'Choisir la suite de l’échange', PhoneCall],
  ['voicemail', 'Répondeur', 'Le prospect n’a pas répondu', Voicemail],
  ['not_relevant', 'Non pertinent', 'Le prospect ne correspond pas', UserRoundX],
  ['not_processable', 'Non traitable', 'Le contact ne peut pas être traité', CircleAlert],
  ['to_recontact', 'À relancer', 'Prévoir une date de reprise de contact', RotateCcw],
  ['unreachable', 'Injoignable', 'Le contact ne peut pas être joint', PhoneOff],
];
const followUps = [
  ['r1', 'Placer le R1', 'Premier rendez-vous commercial', CalendarPlus],
  ['r2', 'Placer un R2 directement', 'Passer directement au rendez-vous d’audit', CalendarClock],
  ['callback', 'À rappeler', 'Poursuivre le suivi téléphonique', RotateCcw],
  ['not_interested', 'Pas intéressé', 'Le prospect ne souhaite pas poursuivre', CircleX],
];
export default function ContactQualificationDialog({lead, category, dark = false, onClose, onSave}) {
  const [result, setResult] = useState('');
  const [next, setNext] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false), ref = useRef(null), panelRef = useRef(null);
  useDialogFocus(ref, onClose, busy);
  const appointment = result === 'reached' && ['r1', 'r2'].includes(next);
  const callback = result === 'reached' && next === 'callback';
  const past = callback && recallInPast(date);
  const ruleNote = callback ? recallRuleNote(lead) : '';        // 4 réaffectations déjà faites : la règle des 3 jours ne se décale plus
  const canSave = !!result && (result !== 'reached' || !!next) && (!(appointment || callback || result === 'to_recontact') || !!date) && !past;
  const attemptNote = ['callback', 'voicemail'].includes(category) && (result === 'voicemail' || callback);
  // Une erreur d'enregistrement se lit tout de suite : sur un écran juste assez haut elle tombait sous la barre de boutons.
  useEffect(() => { if (error && callback) ref.current?.scrollTo({top: ref.current.scrollHeight, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }, [error, callback]);
  // Date et description s'affichent sous les cartes : sur un écran plus bas que la fenêtre, le panneau vient tout seul à l'écran
  // (jamais de défilement à faire à la main). Rien ne bouge s'il est déjà entièrement visible ; la marge basse évite la barre de boutons.
  useEffect(() => { if (callback) panelRef.current?.scrollIntoView?.({block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }, [callback, pickerKey]);
  async function save() {
    if (lock.current || !canSave) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave({result, next, date, ...(callback ? {note} : {})}); }
    catch (e) { setError(e.message || 'Le contact n’a pas pu être enregistré. Réessayez.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function options(items, selected, choose) {
    return <div className="sj-options">{items.map(([value, title, description, Icon]) => <button type="button" key={value} disabled={busy} aria-pressed={selected === value} className={selected === value ? 'is-selected' : ''} onClick={() => {choose(value); setDate(''); setPickerKey(k => k + 1); setError('');}}><Icon size={21}/><span><strong>{title}</strong><small>{description}</small></span>{selected === value && <Check size={16}/>}</button>)}</div>;
  }
  return createPortal(<div className={`sj-overlay ${dark ? 'sj-dark' : ''}`} onClick={e => {if (e.target === e.currentTarget && !lock.current) onClose();}}>
    <section className={`sj-dialog${callback ? ' sj-dialog-callback' : ''}`} role="dialog" aria-modal="true" aria-labelledby="sj-contact-title" ref={ref} tabIndex={-1}>
      <header className="sj-head"><span className="sj-icon"><PhoneCall size={24}/></span><div><small>PARCOURS COMMERCIAL</small><h2 id="sj-contact-title">Qualifier le contact</h2><p>{lead.full_name || lead.company_name}</p></div><button className="sj-close" disabled={busy} onClick={onClose} aria-label="Fermer la qualification"><X size={20}/></button></header>
      <div className="sj-body"><h3 style={{marginTop: 0}}>Quel est le résultat de l’appel ?</h3>
        {options(outcomes, result, value => {setResult(value); setNext('');})}
        {result === 'reached' && <div className="sj-r1-next"><h3>Quelle est la prochaine étape ?</h3>{options(followUps, next, setNext)}</div>}
        {appointment && <ParisDateTimeInput key={next} label={`Date et heure du ${next.toUpperCase()}`} value={date} disabled={busy} onChange={value => {setDate(value); setError('');}}/>}
        {callback && <div className={`sj-callback${past ? ' is-past' : ''}`} ref={panelRef}>
          <div className="sj-callback-when">
            <ParisDateTimeInput key={`callback-${pickerKey}`} label="Date et heure du rappel" value={date} disabled={busy} onChange={value => {setDate(value); setError('');}}/>
            {past && <small className="sj-callback-past" role="alert">Cette heure est déjà passée.</small>}
          </div>
          <label className="sj-callback-note"><span>Description <small>(facultatif)</small></span><textarea rows={2} maxLength={CALLBACK_NOTE_MAX} disabled={busy} value={note} onChange={e => setNote(e.target.value)} placeholder="Ce dont vous avez convenu avec le prospect…"/></label>
          {ruleNote && <p className="sj-callback-rule" role="note" title={CALLBACK_RULE_HELP}>{ruleNote}</p>}
        </div>}
        {result === 'to_recontact' && <fieldset className="sj-paris-date" disabled={busy}><legend>Quand le recontacter ?</legend><FrenchDateInput aria-label="Date de relance" value={date} onChange={value => {setDate(value); setError('');}}/><small>Date approximative, modifiable plus tard.</small></fieldset>}
        {attemptNote && !callback && <p>Cette tentative sera ajoutée au suivi, sans déplacer le prospect.</p>}
        {error && <p className="sj-error" role="alert">{error}</p>}
      </div>
      <footer className="sj-footer">{attemptNote && callback && <span className="sj-footer-note">Cette tentative sera ajoutée au suivi, sans déplacer le prospect.</span>}<button disabled={busy} onClick={onClose}>Annuler</button><button className="sj-primary" disabled={busy || !canSave} onClick={save}>{busy ? 'Enregistrement…' : appointment ? `Confirmer le ${next.toUpperCase()}` : 'Enregistrer la qualification'}<ArrowRight size={17}/></button></footer>
    </section>
  </div>, document.body);
}
