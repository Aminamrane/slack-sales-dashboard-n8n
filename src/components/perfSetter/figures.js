// Chiffres du mois des setters : logique pure, extraite À L'IDENTIQUE de l'ancien onglet « Setters » de la Performance Sales
// (perfSales/v2/SettersTab.jsx, déplacé dans Perf Setter le 30/10/2026). Aucune règle de calcul n'a changé : mêmes lignes, mêmes totaux,
// mêmes ratios. Partagée par le bandeau de chiffres de Perf Setter et par le tableau « Chaque setter, des appels aux ventes ».

// Lignes du tableau : les setters actifs ou qui ont une vente dans le mois, triés par ventes, puis RDV posés, puis nom.
// `calls.setters[id].status === 'linked'` : seuls les setters reliés à Allo ont des appels (sinon null : jamais un 0 inventé).
export function setterRows(data, calls) {
  const month = data.month;
  return (data.setters || []).map((s) => {
    const m = s.months?.[month] || {};
    const rdv = m.rdv || {}, sales = m.sales || {};
    const c = calls?.setters?.[s.id];
    return { id: s.id, name: s.name, active: s.active, rdv, sales, calls: c?.status === 'linked' ? c : null, callsStatus: c?.status };
  }).filter((r) => r.active || r.sales.count)
    .sort((a, b) => (b.sales.count || 0) - (a.sales.count || 0) || (b.rdv.total || 0) - (a.rdv.total || 0) || (a.name || '').localeCompare(b.name || ''));
}

// Chiffres d'équipe du mois. `days` = pilotage.days de la Performance Sales (jours ouvrés écoulés / restants) ; absent : pas de moyenne par jour.
//   · appels pour 1 vente = appels Allo des setters reliés ÷ ventes de l'équipe ;
//   · moyenne par jour ouvré = chiffre du mois ÷ jours ouvrés écoulés (demande du 15/10/2026) ; aucun jour écoulé : le chiffre seul ;
//   · présence = honorés ÷ (honorés + no-show).
export function monthFigures(data, calls, days) {
  const month = data.month;
  const rows = setterRows(data, calls);
  const team = data.team?.months?.[month] || {};
  const callsTotal = rows.reduce((a, r) => a + (r.calls?.calls || 0), 0);
  const answeredTotal = rows.reduce((a, r) => a + (r.calls?.answered || 0), 0);
  const teamSales = team.sales?.count || 0;
  const callsPerSaleTeam = teamSales ? callsTotal / teamSales : null;
  const remaining = days?.remaining ?? null;
  const presenceTeam = (team.rdv?.held || 0) + (team.rdv?.no_show || 0) ? team.rdv.held / (team.rdv.held + team.rdv.no_show) : null;
  const elapsed = days?.elapsed > 0 ? days.elapsed : null;
  return { month, rows, team, callsTotal, answeredTotal, teamSales, callsPerSaleTeam, remaining, presenceTeam, elapsed };
}
