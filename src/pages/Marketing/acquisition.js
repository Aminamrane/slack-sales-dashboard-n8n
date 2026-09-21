// Exact campaign names verified against Meta. No account-wide totals or fuzzy matching.
export const WEBINAR_CAMPAIGNS = {
  'webinar-2026-06-22': ['WEBINAIRE BROAD 2 - Copie', 'WEBINAIRE BROAD 2 - Copie 2'],
  'webinar-2026-07-20': ['WEBINAIRE - AMBU - Copie'],
  'webinar-2026-09-07': ['WEBINAIRE - AMBU - 7/9 - Copie'],
  'webinar-2026-09-21': ['WEBINAIRE BROAD SEPTEMBRE'],
};

export function acquisitionPeriod(stats, webinar) {
  const { from, to } = stats?.range || {};
  const dates = [from, to, webinar?.date_start, webinar?.date_end];
  if (dates.some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value || ''))) return null;
  return { since: from > webinar.date_start ? from : webinar.date_start,
    until: to < webinar.date_end ? to : webinar.date_end };
}

export function withAcquisition(stats, webinarId, period, meta) {
  if (!stats?.summary || !WEBINAR_CAMPAIGNS[webinarId]) return stats;
  const summary = { ...stats.summary, budgetSource: 'meta', metaBudgetStatus: 'unavailable',
    budgetEur: null, cplEur: null, metaLeads: null, costPerSignupEur: null };
  // The existing endpoint provides totals, not daily spend. Never display the
  // manual ledger (or another cohort's ledger) as a Meta daily series.
  const result = { ...stats, summary, metaDailyBudgetAvailable: false,
    timeseries: { ...stats.timeseries, budgetByDay: [] } };
  if (!period || !meta || meta.since !== period.since || meta.until !== period.until || !Array.isArray(meta.rows)) return result;
  const wanted = WEBINAR_CAMPAIGNS[webinarId];
  const rows = meta.rows.filter((row) => wanted.includes(row.name?.trim()));
  if (rows.some((row) => !Number.isFinite(row.spend) || row.spend < 0 || !Number.isFinite(row.leads) || row.leads < 0)) return result;
  const spend = Math.round(rows.reduce((sum, row) => sum + row.spend, 0) * 100) / 100;
  const leads = rows.reduce((sum, row) => sum + row.leads, 0);
  Object.assign(summary, { metaBudgetStatus: 'available', budgetEur: spend, metaLeads: leads,
    cplEur: leads ? spend / leads : null,
    costPerSignupEur: summary.leadsDb > 0 ? spend / summary.leadsDb : null,
    landingBudgetStatus: 'not_attributable', metaSyncedAt: meta.synced_at });
  // These historical cohorts already receive a genuine Meta daily series
  // from overview. Preserve it only when its selected-period sum reconciles.
  if (['webinar-2026-06-22', 'webinar-2026-07-20'].includes(webinarId)) {
    const days = (stats.timeseries?.budgetByDay || []).filter((row) => period.since <= row.day && row.day <= period.until);
    const dailyTotal = days.reduce((sum, row) => sum + Number(row.amount), 0);
    if (Math.abs(dailyTotal - spend) < 0.01) {
      result.timeseries.budgetByDay = days;
      result.metaDailyBudgetAvailable = true;
    }
  }
  return result;
}
