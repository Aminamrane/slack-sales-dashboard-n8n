import { useState } from 'react';
import { Pencil } from 'lucide-react';
import apiClient from '../services/apiClient';

const button = { padding: '7px 11px', borderRadius: 8, border: '1px solid #ece9e4', background: '#fff', color: '#1c1b19', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer' };

export default function BoardOnboardingDateCorrection({ numero, initialDate, onSaved, completed = false }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(initialDate || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const field = completed ? 'rdv_onboarding_done_date' : 'rdv_onboarding_date_manual';

  async function save(event) {
    event.preventDefault();
    if (!date || busy) return;
    if (completed && date > today) { setError('La date de réalisation ne peut pas être dans le futur.'); return; }
    setBusy(true); setError('');
    try {
      // Same manual date correction as the board table. Never call rescheduling.
      const result = await apiClient.patch('/api/v1/optilex/board-tracking', {
        numero_client: numero, [field]: date,
      });
      if (!result.updated || !result.fields?.includes(field)) throw new Error('La date n’a pas été enregistrée.');
      setEditing(false); setSaved(true);
      await onSaved?.(date);
    } catch (err) {
      setError(err.message || 'Impossible d’enregistrer la date. Réessayez.');
    } finally { setBusy(false); }
  }

  return <div style={{ marginTop: -3 }}>
    {!editing ? <>
      <button type="button" onClick={() => { setDate(initialDate || ''); setError(''); setSaved(false); setEditing(true); }} style={{ ...button, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Pencil size={13} />{completed ? 'Modifier la date de réalisation' : 'Corriger la date'}
      </button>
      {saved && <span role="status" style={{ marginLeft: 9, fontSize: 12, color: '#0b7a4b' }}>Date enregistrée</span>}
    </> : <form onSubmit={save} style={{ padding: 12, border: '1px solid #ece9e4', borderRadius: 10, background: '#faf9f7' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#1c1b19' }}>
        {completed ? 'Date de réalisation de l’onboarding' : 'Date réelle de l’onboarding'}
        <input type="date" required autoFocus disabled={busy} max={completed ? today : undefined} value={date} onChange={e => setDate(e.target.value)}
          style={{ display: 'block', marginTop: 7, padding: '8px 10px', border: '1px solid #e3ded6', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#1c1b19' }} />
      </label>
      <p style={{ margin: '9px 0 12px', fontSize: 12, lineHeight: 1.5, color: '#8b867e' }}>{completed
        ? 'L’onboarding reste réalisé. Seule sa date de réalisation est corrigée : aucun changement dans Google Agenda, aucune invitation envoyée et aucune modification de facturation.'
        : 'Corrige la date du suivi, sans déplacer ni annuler le rendez-vous Google Agenda et sans envoyer d’invitation.'}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={!date || busy} style={{ ...button, background: '#2b2927', color: '#fff', opacity: !date || busy ? .6 : 1 }}>{busy ? 'Enregistrement…' : 'Enregistrer la date'}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(''); }} style={button}>Annuler</button>
      </div>
    </form>}
    {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#c5221f' }}>{error}</p>}
  </div>;
}
