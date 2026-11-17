// ClientFiles.jsx — rubriques Documents et Appels de la fiche Finance.
//
// Documents : d'abord la fiche d'intégration du client (dev 17/11/2026 : elle doit être dans les documents de
// chaque client), la même que sur le board (BoardIntegrationSheet, routes /optilex/integration-sheet, ouvertes à la
// finance) ; puis le dossier du board lui-même (demande dev 10/11/2026 : « centraliser […] ils peuvent mettre
// n'importe quelles pièces jointes, comme dans le board ») : mêmes routes /client-history, mêmes pièces, mêmes
// fenêtres d'aperçu. Ce qui est joint ici se lit dans le board, et inversement.
// Appels (dev 17/11/2026 : « ça doit être appel ») : le dernier appel Allo et les appels du dossier, qui étaient
// jusque-là au bas des Documents.
//
// Les rôles en lecture seule consultent et téléchargent ; joindre, partager et retirer restent visibles et
// désactivés.

import React from 'react';

import BoardIntegrationSheet from '../../../components/BoardIntegrationSheet.jsx';
import { BoardCalls, BoardDocuments } from '../../../components/BoardClientFiles.jsx';
import LatestClientCall from './LatestClientCall.jsx';

// `files` : le dossier du client (useClientFiles), lu une fois par la fiche pour les deux rubriques.
export function ClientDocuments({ files, numero }) {
  return (
    <div className="fd-files">
      {numero
        ? <BoardIntegrationSheet key={`sheet-${numero}`} numero={numero} compact />
        : <p className="fd-empty">La fiche d’intégration sera disponible une fois la vente déclarée.</p>}
      {files.allowed
        ? <BoardDocuments files={files} sharedWith="le Client Success" />
        : <p className="fd-empty">Le dossier partagé n’est pas ouvert à votre rôle.</p>}
    </div>
  );
}

export function ClientCalls({ files, clientId, active, canViewCalls = false }) {
  if (!files.allowed) return <p className="fd-empty">Le dossier partagé n’est pas ouvert à votre rôle.</p>;
  return (
    <div className="fd-files">
      {canViewCalls && <LatestClientCall key={`call-${clientId}`} clientId={clientId} />}
      <BoardCalls files={files} active={active} />
    </div>
  );
}
