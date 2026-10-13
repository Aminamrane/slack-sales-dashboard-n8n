export const requiresExitDecision = (role, state) =>
  ['admin', 'ceo', 'finance_director'].includes(role)
  && ['Rétractation', 'Résiliation', 'Self-Résiliation'].includes(state);

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
