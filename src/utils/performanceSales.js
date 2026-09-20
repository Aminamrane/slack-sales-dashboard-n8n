// The API owns identities, periods and channel membership. Never replace
// channel-specific appointments with the global tracking-sheet counters.
export const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator * 100 : null;

export function performanceRows(perfData, callsData, canal, keyForName) {
  const view = perfData?.[`${canal === 'global' ? 'global' : canal}_view`];
  const calls = new Map((callsData?.by_sales || []).map(row => [keyForName(row.sales), row]));
  return (view?.by_person || []).filter(p => isPerformanceSalesPerson(p.name)).filter(p =>
    ['leads_assigned', 'nbr_appel', 'r1p', 'r1r', 'r2p', 'r2r', 'nbr_signature', 'total_revenue', 'total_cash'].some(k => Number(p[k] || 0) !== 0)
  ).map(p => {
    const cr = calls.get(keyForName(p.name));
    const c = cr?.[canal === 'global' ? 'total' : canal];
    const r1p = p.r1p || 0, r2p = p.r2p || 0, r1d = p.r1r || 0, r2d = p.r2r || 0;
    const ct = c?.appels ?? p.nbr_appel ?? 0, ca = c?.repondu ?? p.nbr_appel_d ?? 0;
    const sig = p.nbr_signature || 0, la = p.leads_assigned || 0;
    return {
      salesName: p.name, salesKey: keyForName(p.name), calls_total: ct, calls_answered: ca,
      calls_available: cr ? cr.calls_available !== false : perfData.calls_available !== false,
      r1_placed: r1p, r1_done: r1d, r2_placed: r2p, r2_done: r2d,
      r1p_self: c?.r1p_self ?? r1p, r1p_s: c?.r1p_s ?? 0,
      r2p_self: c?.r2p_self ?? r2p, r2p_s: c?.r2p_s ?? 0,
      signatures: sig, revenue: p.total_revenue || 0, cashCollected: p.total_cash || 0,
      leads_assigned: la, leads_ads: p.leads_ads || 0, leads_cc: p.leads_cc || 0,
      unique_attempted: p.unique_attempted || 0, unique_answered: c?.repondu_lead ?? p.unique_answered ?? 0,
      r1_from_answered: c?.r1_from_answered ?? r1p,
      repondeur: c?.repondeur ?? 0, qualif: c?.qualif ?? 0,
      conv_global: ratio(sig, la), conv_calls_to_answered: ratio(ca, ct),
      conv_answered_to_r1p: ratio(c?.r1_from_answered ?? r1p, c?.repondu_lead ?? ca),
      conv_r1p_to_r1r: ratio(r1d, r1p), conv_r2p_to_r2r: ratio(r2d, r2p), conv_sales: ratio(sig, r2d),
    };
  }).sort((a, b) => b.signatures - a.signatures || b.conv_global - a.conv_global || a.salesName.localeCompare(b.salesName, 'fr'));
}

export function isPerformanceSalesPerson(name) {
  const key = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  return !['youcef', 'youcef amrane', 'youcef amran', 'y.amrane@ownertechnology.com'].includes(key);
}

export function visibleHeadcount(data) {
  if (!data) return data;
  const by_person = (data.by_person || []).filter(p => isPerformanceSalesPerson(p.person_name));
  const totals = {leads_assigned:0, unknown:0, headcount_breakdown:{}};
  for (const row of by_person) {
    totals.leads_assigned += row.leads_assigned || 0;
    totals.unknown += row.unknown || 0;
    for (const [key,value] of Object.entries(row.headcount_breakdown || {})) totals.headcount_breakdown[key] = (totals.headcount_breakdown[key] || 0) + value;
  }
  return {...data, by_person, totals};
}
