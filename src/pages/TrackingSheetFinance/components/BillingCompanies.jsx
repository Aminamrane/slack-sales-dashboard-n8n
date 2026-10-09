import React, { useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient.js';

export default function BillingCompanies({ clientId, canEdit, reloadKey = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError('');
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/structures`)
      .then(result => { if (alive) setData(result); })
      .catch(() => { if (alive) setError('Les sociétés de facturation n’ont pas pu être chargées.'); });
    return () => { alive = false; };
  }, [clientId, reloadKey, version]);
  async function save(entity, value) {
    setBusy(true); setError('');
    try {
      const result = await apiClient.put(`/api/v1/finance-periods/client/${clientId}/billing-companies/${entity}`,
        { structure_id: value ? Number(value) : null });
      setData(previous => ({ ...previous, billing_companies: result.billing_companies }));
    } catch (e) { setError(e?.data?.detail || 'Le rattachement n’a pas été enregistré.'); }
    finally { setBusy(false); }
  }
  return <div style={{ display: 'grid', gap: 10, fontSize: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>

    {error && <div role="alert">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Réessayer</button></div>}
    {!data && !error && <span role="status">Chargement…</span>}
    {data && ['owner', 'optilex'].map(entity => {
      const link = data.billing_companies?.[entity];
      return <label key={entity} style={{ display: 'grid', gap: 5 }}><strong>{entity === 'owner' ? 'Contrat Owner' : 'Contrat Opti’Lex'}</strong>
        <select aria-label={`Société de facturation ${entity}`} disabled={!canEdit || busy}
          value={link?.structure_id || ''} onChange={e => save(entity, e.target.value)}
          style={{ padding: 9, border: '1px solid #e3e2e0', borderRadius: 7, background: '#fff', width: '100%' }}>
          <option value="">Société principale du dossier</option>
          {link?.unavailable && <option value={link.structure_id}>Société retirée — choisissez un nouveau rattachement</option>}
          {data.items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>;
    })}
    {data && !data.items.length && <span>Ajoutez les sociétés dans « Informations contractuelles » pour les sélectionner ici.</span>}
  </div>;
}
