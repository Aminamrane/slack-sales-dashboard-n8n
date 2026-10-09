import React, { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import apiClient from '../../../services/apiClient.js';
import { CallDetail } from './CallsView.jsx';

export default function LatestClientCall({ clientId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true; setData(null); setError(''); setOpened(false);
    apiClient.get(`/api/v1/finance-calls/client/${clientId}/latest`).then(value => { if (live) setData(value); })
      .catch(() => { if (live) setError('Le dernier appel n’a pas pu être chargé.'); });
    return () => { live = false; };
  }, [clientId, revision]);
  const call = data?.call;
  return <div style={{ border: '1px solid #e9e9e7', borderRadius: 10, padding: 14, marginBottom: 22, fontSize: 12.5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={15}/> Dernier appel Allo</strong><button type="button" disabled={!data && !error} onClick={() => setRevision(r => r + 1)} style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', color: '#787774' }}>Actualiser l’appel</button></div>
    <p style={{ color: '#787774', margin: '6px 0' }}>Appels de votre périmètre · rapprochement par les téléphones de cette fiche</p>
    {error ? <p role="alert">{error} <button onClick={() => setRevision(r => r + 1)}>Réessayer</button></p> : !data ? <p role="status">Recherche du dernier appel…</p> : !call ?
      <p>{data.has_phone ? 'Aucun appel trouvé pour ces numéros.' : 'Aucun numéro de téléphone exploitable dans cette fiche.'}</p> : <>
      <div>{new Date(call.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} · {call.operator_name}</div>
      <div style={{ margin: '6px 0' }}>{call.contact_number} · {call.direction === 'INBOUND' ? 'Entrant' : 'Sortant'} · {({ANSWERED: 'Répondu', CLOSED: 'Non abouti', MISSED: 'Manqué', NO_ANSWER: 'Sans réponse', BUSY: 'Occupé', FAILED: 'Échoué', VOICEMAIL: 'Messagerie', TRANSFERRED: 'Transféré'})[call.result] || call.result}</div>
      <button type="button" onClick={() => setOpened(true)} style={{ font: 'inherit', padding: '6px 12px', background: '#fff', border: '1px solid #e9e9e7', borderRadius: 6 }}>Voir le détail de l’appel</button>
    </>}
    {opened && call && <CallDetail id={call.id} onClose={() => setOpened(false)}/>}
  </div>;
}
