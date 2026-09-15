export const PENDING_EXITS = ['En cours de résiliation', 'En cours de rétractation'];
const FINAL_STATE = {
  'En cours de résiliation': 'Résiliation',
  'En cours de rétractation': 'Rétractation',
};

export function resolvePendingExit(state, effectiveDate, today) {
  return FINAL_STATE[state] && effectiveDate && String(effectiveDate).slice(0, 10) <= today
    ? FINAL_STATE[state] : state;
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
