// SignedContracts.jsx — les deux contrats du client, signés sur Yousign.
//
// Demande dev 2026-09-08 : « voir proprement dans la fiche Finance le contrat
// envoyé par le sales, celui qui a été signé sur Yousign ; les deux (Owner et
// Opti'lex) accessibles, cliquables, consultables dans une pop-up ».
// Demande dev 10/11/2026 : « qu'ils puissent consulter les contrats comme dans
// le board » : les deux dossiers en verre du board (ContractFolders), la feuille
// s'envole et devient le lecteur PDF.
//
// Toujours deux dossiers, pour que l'absence se voie : un client d'avant le flux
// contrats n'a pas de document dans le CRM, et le dossier vide le dit.
//
// Les PDF viennent de la route de lecture de la Finance
// (/finance-periods/client/{id}/documents/{kind}), jamais de /contracts/*.

import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { ContractFolders } from '../../../components/BoardClientFiles.jsx';
import { formatDateFR } from '../constants.js';

const GREEN = '#0b7a4b';
const NAMES = {
  owner: { label: 'Owner', title: 'Contrat Owner', open: 'Ouvrir le contrat Owner' },
  optilex: { label: 'Opti’Lex', title: 'Convention Opti’Lex', open: 'Ouvrir la convention Opti’Lex' },
};

function folderItem(it) {
  const names = NAMES[it.kind] || { label: it.label, title: it.label, open: `Ouvrir : ${it.label}` };
  const base = { key: it.kind, label: names.label, title: names.title, openLabel: names.open };
  if (!it.available) {
    return { ...base, empty: true, available: false, status: <span style={{ fontWeight: 400, color: '#a8a39b' }}>Pas de contrat signé dans le CRM</span> };
  }
  const day = it.signed_at ? formatDateFR(it.signed_at) : null;
  const date = day && day !== '—' ? `le ${day}` : '';
  return {
    ...base, signed: true, available: true,
    statusText: ['Signé', date].filter(Boolean).join(' '),
    status: <><Check size={13} strokeWidth={2.6} color={GREEN} /><b style={{ color: GREEN }}>Signé</b>{date}</>,
    sub: 'sur Yousign',
  };
}

export default function SignedContracts({ clientId }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!clientId) return undefined;
    let live = true;
    setItems(null); setError(null);
    apiClient.get(`/api/v1/finance-periods/client/${clientId}/documents`)
      .then((d) => { if (live) setItems(Array.isArray(d?.items) ? d.items : []); })
      .catch((e) => { if (live) { setItems([]); setError(e?.data?.detail || e?.message || 'Contrats indisponibles'); } });
    return () => { live = false; };
  }, [clientId, attempt]);

  const folders = useMemo(() => (items || []).map(folderItem), [items]);

  if (items === null) return <p className="fd-empty" role="status">Chargement des contrats…</p>;
  // Une section vide doit dire pourquoi : API injoignable, ou client sans contrat.
  if (!items.length) {
    return error
      ? <p className="fd-empty is-error" role="alert">Impossible de charger les contrats : {error} <button type="button" onClick={() => setAttempt((n) => n + 1)}>Réessayer</button></p>
      : <p className="fd-empty">Aucun contrat dans le CRM pour ce client.</p>;
  }
  return (
    <div className="fd-contracts">
      <ContractFolders items={folders} group={`finance-${clientId}`}
        source={(kind) => `/api/v1/finance-periods/client/${clientId}/documents/${kind}`} />
    </div>
  );
}
