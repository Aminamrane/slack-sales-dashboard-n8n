// ClientFiles.jsx — rubrique Documents de la fiche Finance.
//
// Demande dev 10/11/2026 : « centraliser […] ils peuvent mettre n'importe quelles
// pièces jointes, comme dans le board ». La fiche montre donc le dossier du board
// lui-même (BoardClientFiles : mêmes routes /client-history, mêmes pièces, mêmes
// fenêtres d'aperçu), aux tons de la page (surcharges `.fd-tabpanel .bcf-…` de
// DetailLayout.css). Ce qui est joint ici se lit dans le board, et inversement.
//
// Les rôles en lecture seule consultent et téléchargent ; joindre, partager et
// retirer restent visibles et désactivés.

import React from 'react';

import { BoardCalls, BoardDocuments, useClientFiles } from '../../../components/BoardClientFiles.jsx';
import LatestClientCall from './LatestClientCall.jsx';

export default function ClientFiles({ clientId, numero, active, canViewCalls = false }) {
  const files = useClientFiles(numero, { clientId, viewers: true });
  if (!files.allowed) return <p className="fd-empty">Le dossier partagé n’est pas ouvert à votre rôle.</p>;
  return (
    <div className="fd-files">
      <BoardDocuments files={files} sharedWith="le Client Success" />
      {canViewCalls && <LatestClientCall key={`call-${clientId}`} clientId={clientId} />}
      <BoardCalls files={files} active={active} />
    </div>
  );
}
