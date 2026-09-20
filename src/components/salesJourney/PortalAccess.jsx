import React, { useEffect, useState } from 'react';
import { KeyRound, Clock3, Check, LoaderCircle, CircleAlert } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './portalAccess.css';

export default function PortalAccess({ leadId, choice = false, selected = false, onSelect, revision = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, timer;
    const read = async () => {
      try {
        const value = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}/portal`);
        if (!active) return;
        setData(value); setError('');
        // Only reads Owner's saved operation, never invokes the external API.
        if (value.operations?.some(o => ['pending', 'sending'].includes(o.status))) timer = setTimeout(read, 15000);
      } catch { if (active) setError('Le suivi du compte est momentanément indisponible.'); }
    };
    setData(null); read();
    return () => { active = false; clearTimeout(timer); };
  }, [leadId, revision]);
  if (!data?.available) return null;
  const operation = data.operations?.at(-1);
  if (!choice && !operation) return null;
  const pending = operation && ['pending', 'sending'].includes(operation.status);
  const done = operation?.status === 'done';
  const problem = operation?.status === 'needs_review';
  const expired = done && operation.stage === 'prospect' && operation.expires_at && Date.parse(operation.expires_at) <= Date.now();
  const Icon = pending ? LoaderCircle : problem ? CircleAlert : done ? Check : KeyRound;
  const label = expired ? 'Période d’essai terminée' : pending ? 'Création du compte en cours' : problem ? 'Compte à vérifier' : done
    ? operation.stage === 'signed' ? 'Compte client créé' : 'Compte provisoire créé' : 'Ouvrir un compte provisoire';
  return <section className="portal-access" aria-live="polite">
    <div className="portal-access__icon"><Icon size={21} className={pending ? 'portal-access__spin' : ''} /></div>
    <div className="portal-access__body">
      <strong>{label}</strong>
      {!operation && <p>Permettre au client de découvrir son espace pendant 15 jours, après la génération du NDA.</p>}
      {pending && <p>La demande est enregistrée. Vous pouvez poursuivre votre travail.</p>}
      {problem && <p>{operation.last_error || 'La création nécessite une vérification.'}</p>}
      {done && <p>{expired ? 'Le délai de 15 jours est écoulé. La déclaration de vente ouvrira le compte définitif.' : operation.stage === 'signed' ? 'Interface client et dossier Opti’Lex reliés.' : 'L’accès est ouvert pour la période d’essai.'}</p>}
      {done && operation.expires_at && operation.stage === 'prospect' && <small><Clock3 size={13} /> Jusqu’au {new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(operation.expires_at))}</small>}
      {!operation && choice && <label className="portal-access__choice"><input type="checkbox" checked={selected} onChange={e => onSelect(e.target.checked)} /> Activer après la génération du NDA</label>}
      {done && data.identity?.client_code && <small>{data.identity.client_code}{data.identity.cabinet_code ? ` · ${data.identity.cabinet_code}` : ''}</small>}
      {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}
