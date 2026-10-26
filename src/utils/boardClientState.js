export const PENDING_EXITS = ['En cours de résiliation', 'En cours de rétractation'];

// État affiché d'un client du board : calculé UNE seule fois, par le back
// (champ `etat_affiche` de GET /optilex/board), jamais recalculé ici. Le board,
// sa fiche, le dashboard CEO, la page Finance et la synchro vers le SaaS
// Opti'Lex lisent tous cette valeur : ils ne peuvent plus diverger (décision
// dev 26/10/2026, le board fait foi). Aucune règle de repli côté front.
export const displayEtat = (row) => row.etat_affiche ?? null;

// Ligne après un POST /optilex/etat-change réussi : l'état posé tel que le
// serveur l'a enregistré, et l'état affiché qu'il en déduit. Sans cela, l'écran
// garderait l'ancien état jusqu'au prochain rechargement du board.
export function withConfirmedEtat(row, saved) {
  return {
    ...row,
    etat_manuel: saved.etat ?? null,
    etat_date: saved.etat_date ?? null,
    etat_affiche: saved.etat_affiche ?? null,
  };
}

// Deux poses peuvent partir coup sur coup sur un même client (l'état, puis sa
// date d'effet) : seule la réponse de la DERNIÈRE fait foi, quel que soit
// l'ordre d'arrivée des réponses. `start(clé)` renvoie un test « suis-je
// toujours la dernière demande pour cette clé ? ».
export function createLatestRequestTracker() {
  const latest = new Map();
  return {
    start(key) {
      const n = (latest.get(key) || 0) + 1;
      latest.set(key, n);
      return () => latest.get(key) === n;
    },
  };
}

// Signed remains a membership, while the visible badge retains the pending exit.
export function matchesSignedClient(row, displayedState) {
  return displayedState === 'Signé' || (
    PENDING_EXITS.includes(displayedState)
    && (!row.is_pending_contract || row.owner_status === 'done' || !!row.owner_signed_at)
  );
}

export function isCurrentProductClient(row, displayedState) {
  return !row.is_pending_contract && !!row.numero_client
    && !['Résiliation', 'Self-Résiliation', 'Rétractation', 'Liquidation', 'Sans suite'].includes(displayedState);
}
