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
      r1p_self: p.r1p_self ?? r1p, r1p_s: p.r1p_s ?? 0, r1r_s: p.r1r_s ?? 0,
      r2p_self: p.r2p_self ?? r2p, r2p_s: p.r2p_s ?? 0, r2r_s: p.r2r_s ?? 0,
      r1_cc_setter_placed:p.r1_cc_setter_placed||0, r1_cc_setter_done:p.r1_cc_setter_done||0,
      r2_cc_setter_placed:p.r2_cc_setter_placed||0, r2_cc_setter_done:p.r2_cc_setter_done||0,
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


// Cards and footer use exactly the same visible rows; rates are recomputed,
// never averaged between sellers.
export function performanceTotals(rows) {
  const fields = ['calls_total','calls_answered','repondeur','qualif','r1_placed','r1_done','r2_placed','r2_done',
    'r1p_self','r1p_s','r1r_s','r2p_self','r2p_s','r2r_s','r1_cc_setter_placed','r1_cc_setter_done',
    'r2_cc_setter_placed','r2_cc_setter_done','signatures','revenue','cashCollected','leads_assigned',
    'leads_ads','leads_cc','unique_attempted','unique_answered','r1_from_answered'];
  const t = Object.fromEntries(fields.map(k=>[k,rows.reduce((sum,r)=>sum+(Number(r[k])||0),0)]));
  return {...t, calls:t.calls_total, answered:t.calls_answered, calls_available:rows.every(r=>r.calls_available),
    lead_qualifie:ratio(t.qualif,t.calls_answered), closing_r1:ratio(t.r1_done,t.r1_placed),
    closing_r2:ratio(t.r2_done,t.r2_placed), closing_audit:ratio(t.signatures,t.r2_done),
    conv_global:ratio(t.signatures,t.leads_assigned), conv_calls_to_answered:ratio(t.calls_total? t.calls_answered:0,t.calls_total),
    conv_answered_to_r1p:ratio(t.r1_from_answered,t.unique_answered), conv_r1p_to_r1r:ratio(t.r1_done,t.r1_placed),
    conv_r2p_to_r2r:ratio(t.r2_done,t.r2_placed), conv_sales:ratio(t.signatures,t.r2_done)};
}
