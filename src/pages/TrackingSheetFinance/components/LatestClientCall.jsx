import React, { useEffect, useState } from 'react';
import { Phone, RefreshCw } from 'lucide-react';
import apiClient from '../../../services/apiClient.js';
import { CallDetail } from './CallsView.jsx';

const RESULTS = { ANSWERED: 'Répondu', CLOSED: 'Non abouti', MISSED: 'Manqué', NO_ANSWER: 'Sans réponse', BUSY: 'Occupé', FAILED: 'Échoué', VOICEMAIL: 'Messagerie', TRANSFERRED: 'Transféré' };

// Dernier appel Allo du client, dans le périmètre de la personne (rapprochement par les téléphones de la fiche).
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
  const loading = !data && !error;
  const tone = !call ? '' : call.result === 'ANSWERED' ? ' is-ok' : ['MISSED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CLOSED'].includes(call.result) ? ' is-ko' : '';
  return (
    <section className="fd-call" aria-label="Dernier appel Allo">
      <header className="fd-call-head">
        <span className="fd-call-ic"><Phone size={15} /></span>
        <div className="fd-call-tx">
          <strong>Dernier appel Allo</strong>
          <span>Appels de votre périmètre · rapprochement par les téléphones de cette fiche</span>
        </div>
        <button type="button" className="fd-icon-btn" disabled={loading} onClick={() => setRevision(r => r + 1)}
          aria-label="Actualiser l’appel" title="Actualiser l’appel"><RefreshCw size={15} className={loading ? 'fd-spin' : ''} /></button>
      </header>
      {error ? <p role="alert" className="fd-call-line is-error">{error} <button type="button" onClick={() => setRevision(r => r + 1)}>Réessayer</button></p>
        : !data ? <p role="status" className="fd-call-line">Recherche du dernier appel…</p>
        : !call ? <p className="fd-call-line">{data.has_phone ? 'Aucun appel trouvé pour ces numéros.' : 'Aucun numéro de téléphone exploitable dans cette fiche.'}</p>
        : (
          <button type="button" className="fd-call-open" onClick={() => setOpened(true)} title="Voir le détail de l’appel">
            <span className="fd-call-main">
              <span className="fd-call-title">
                Appel {call.direction === 'INBOUND' ? 'entrant' : 'sortant'}
                <span className={`fd-call-chip${tone}`}>{RESULTS[call.result] || call.result}</span>
              </span>
              <span className="fd-call-sub">{[new Date(call.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), call.operator_name, call.contact_number].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="fd-call-cta">Voir le détail</span>
          </button>
        )}
      {opened && call && <CallDetail id={call.id} onClose={() => setOpened(false)} />}
    </section>
  );
}
