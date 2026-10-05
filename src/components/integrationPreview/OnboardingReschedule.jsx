import {useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarClock, X} from 'lucide-react';
import apiClient from '../../services/apiClient';
import './integrationPreview.css';

export default function OnboardingReschedule({lead, SlotPicker, C, darkMode, onClose, onSaved}) {
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const save = async () => {
    if (!slot || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = await apiClient.post(`/api/v1/owner-integration/leads/${lead.id}/onboarding-reschedule`, {new_dt: slot});
      if (!result?.success || !result?.calendar_moved) throw new Error('La reprogrammation n’a pas été confirmée. Réessayez le même créneau.');
      onSaved(result);
    } catch (e) { setError(e.message || 'Impossible de reprogrammer. Réessayez le même créneau.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return createPortal(<div style={{position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.55)', display:'grid', placeItems:'center', padding:20}}>
    <section role="dialog" aria-modal="true" aria-labelledby="onboarding-reschedule-title" className="integration-preview ip-embedded" style={{width:700, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', background:C.bg, color:C.text, borderRadius:20, padding:28}}>
      <header style={{display:'flex', alignItems:'flex-start', gap:14, marginBottom:20}}>
        <CalendarClock size={28}/><div style={{flex:1}}><h2 id="onboarding-reschedule-title" style={{margin:'0 0 8px'}}>Reprogrammer l’onboarding</h2><p style={{margin:0, color:C.muted}}>{lead.full_name} · Heure de Paris</p></div>
        <button aria-label="Fermer" disabled={busy} onClick={onClose} className="ip-secondary"><X size={20}/></button>
      </header>
      <p>Choisissez un nouveau créneau. L’onboarding et le rendez-vous de facturation seront déplacés ensemble, avec le même interlocuteur. Le client recevra la mise à jour.</p>
      <fieldset disabled={busy} style={{border:0, margin:0, padding:0}}>
        <SlotPicker kind="onboarding" slotsPath={`/api/v1/owner-integration/leads/${lead.id}/onboarding-slots`} value={slot} onChange={setSlot} C={C} darkMode={darkMode}/>
      </fieldset>
      {slot && <p><strong>Nouveau rendez-vous : {slot.slice(0,10).split('-').reverse().join('/')} à {slot.slice(11,16)}</strong></p>}
      {error && <p className="si-error" role="alert">{error}</p>}
      <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onClose}>Annuler</button><button className="ip-primary" disabled={!slot || busy} onClick={save}>{busy ? 'Reprogrammation…' : 'Confirmer la reprogrammation'}</button></footer>
    </section>
  </div>, document.body);
}
