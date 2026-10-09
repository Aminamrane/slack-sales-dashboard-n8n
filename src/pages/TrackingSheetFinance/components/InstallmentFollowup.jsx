import React, { useState } from 'react';
import apiClient from '../../../services/apiClient.js';
import { formatMonthLabel } from '../constants.js';

export default function InstallmentFollowup({ clientId, period, scope, reviews, onChanged }) {
  const [entity, setEntity] = useState(scope === 'optilex' ? 'optilex' : 'owner');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedEntity = scope === 'global' ? entity : scope;
  const review = reviews.find(r => r.period_id === period.id && r.entity === selectedEntity);
  const active = !!review?.regularized;
  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await apiClient.put(`/api/v1/finance-periods/client/${clientId}/installments/${period.id}/followup`, {
        entity: selectedEntity, regularized: !active, note,
      });
      onChanged(data.installment_followups); setNote('');
    } catch (e) { setError(e?.data?.detail || 'La confirmation n’a pas été enregistrée. Réessayez.'); }
    finally { setBusy(false); }
  };
  return <div style={{ padding: 12, marginTop: 8, border: '1px solid #e9e9e7', borderRadius: 8, fontSize: 12.5 }}>
    <strong>Suivi de {formatMonthLabel(period.period)}</strong>
    {scope === 'global' && <select aria-label="Entité de la régularisation" value={entity} disabled={busy}
      onChange={e => { setEntity(e.target.value); setNote(''); setError(''); }} style={{ marginLeft: 12 }}>
      <option value="owner">Owner</option><option value="optilex">Opti’Lex</option>
    </select>}
    <p style={{ color: '#787774', margin: '8px 0' }}>Le règlement est déjà enregistré dans un autre mois ? Confirmez cette échéance comme payée. Aucun montant ne sera ajouté ou déplacé.</p>
    {active && <p role="status" style={{ color: '#15794a' }}>Régularisation confirmée le {new Date(review.updated_at).toLocaleDateString('fr-FR')} par {review.updated_by}{review.note ? ` · ${review.note}` : ''}.</p>}
    <input aria-label="Précision sur la régularisation" placeholder="Précision facultative (ex. règlement saisi en octobre)" maxLength={1000}
      value={note} disabled={busy} onChange={e => setNote(e.target.value)} style={{ boxSizing: 'border-box', width: '100%', padding: 8, border: '1px solid #e9e9e7', borderRadius: 6, marginBottom: 8, font: 'inherit' }}/>
    <button type="button" onClick={save} disabled={busy} style={{ padding: '7px 12px', border: '1px solid #d7dfda', borderRadius: 6, background: '#fff', color: '#15794a', font: 'inherit', cursor: busy ? 'wait' : 'pointer' }}>
      {busy ? 'Enregistrement…' : active ? 'Annuler la confirmation de régularisation' : 'Confirmer la régularisation'}
    </button>
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
  </div>;
}
