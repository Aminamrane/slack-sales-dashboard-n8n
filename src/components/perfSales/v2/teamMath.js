// Calculs de l'onglet Équipes (dev 14/10/2026 : « comparer à volume égal, voir pourquoi ils sont en baisse par rapport
// aux autres »), sans React pour être testés seuls.

// Taux de l'équipe, rapportés à un sales pour comparer des équipes de tailles différentes.
export function rates(t) {
  const v = t.values;
  return {
    leadsPerSales: t.people ? v.leads / t.people : 0,
    r1PerLead: v.leads ? v.r1e / v.leads : 0,
    r2PerR1: v.r1e ? v.r2e / v.r1e : 0,
    salesPerR2: v.r2e ? v.sales / v.r2e : 0,
    noshow: (t.r1_done_due || 0) + (t.r1_noshow || 0) ? (t.r1_noshow || 0) / ((t.r1_done_due || 0) + (t.r1_noshow || 0)) : null,
    salesPer100: v.leads ? (v.sales / v.leads) * 100 : 0,
  };
}

// Taux des autres équipes réunies (le point de comparaison « à volume égal »).
export function othersRates(teams, team) {
  const others = teams.filter((t) => t.team !== team.team);
  const sum = (k) => others.reduce((a, t) => a + (t.values[k] || 0), 0);
  const people = others.reduce((a, t) => a + (t.people || 0), 0);
  const noshow = others.reduce((a, t) => a + (t.r1_noshow || 0), 0), done = others.reduce((a, t) => a + (t.r1_done_due || 0), 0);
  return {
    leadsPerSales: people ? sum('leads') / people : 0,
    r1PerLead: sum('leads') ? sum('r1e') / sum('leads') : 0,
    r2PerR1: sum('r1e') ? sum('r2e') / sum('r1e') : 0,
    salesPerR2: sum('r2e') ? sum('sales') / sum('r2e') : 0,
    noshow: noshow + done ? noshow / (noshow + done) : null,
    salesPer100: sum('leads') ? (sum('sales') / sum('leads')) * 100 : 0,
  };
}
