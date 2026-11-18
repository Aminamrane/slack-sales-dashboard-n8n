// Toute sortie ou suspension posée par la direction passe par la pop-up finance : perte et dernier mois facturé
// se décident au moment où l'état est posé (dev 2026-11-18).
export const EXIT_DECISION_STATES = ['Rétractation', 'Résiliation', 'Self-Résiliation', 'Liquidation', 'Pause'];
export const requiresExitDecision = (role, state) =>
  ['admin', 'ceo', 'finance_director'].includes(role) && EXIT_DECISION_STATES.includes(state);

export function exitAmounts(values, limits) {
  const amounts = {};
  for (const key of ['past', 'current', 'future']) {
    const raw = String(values[key] ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount > Number(limits[key])) return null;
    amounts[`amount_${key}`] = amount;
  }
  return amounts;
}
