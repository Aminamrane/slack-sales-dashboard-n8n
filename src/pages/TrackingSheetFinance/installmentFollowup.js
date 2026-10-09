// A review affects the installment's follow-up badge, never cash or debt totals.
export function reviewedInstallment(period, scope, reviews = [], extraDue = {}) {
  const entities = scope === 'global' ? ['owner', 'optilex'] : [scope];
  let confirmed = false;
  const settled = entities.every(entity => {
    const review = reviews.find(r => r.period_id === period.id && r.entity === entity && r.regularized);
    if (review) confirmed = true;
    const suffix = entity === 'owner' ? 'owner' : 'optilex_ttc';
    const due = Number(period[`expected_${suffix}`] || 0) + Number(extraDue[entity] || 0);
    return !!review || Number(period[`received_${suffix}`] || 0) >= due;
  });
  return confirmed && settled;
}
