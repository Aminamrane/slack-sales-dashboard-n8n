import test from 'node:test';
import assert from 'node:assert/strict';
import { monthFigures, setterRows } from './figures.js';
import { monthOptions } from './months.js';

// Les chiffres du mois de Perf Setter sont ceux de l'ancien onglet « Setters » de la Performance Sales : ce test garde, mot pour mot, le calcul
// d'origine (perfSales/v2/SettersTab.jsx avant le 30/10/2026) et vérifie que l'extraction rend les mêmes valeurs.
function originalFigures(data, calls, days) {
  const month = data.month;
  const rows = data.setters.map((s) => {
    const m = s.months?.[month] || {};
    const rdv = m.rdv || {}, sales = m.sales || {};
    const c = calls?.setters?.[s.id];
    return { id: s.id, name: s.name, active: s.active, rdv, sales, calls: c?.status === 'linked' ? c : null, callsStatus: c?.status };
  }).filter((r) => r.active || r.sales.count)
    .sort((a, b) => (b.sales.count || 0) - (a.sales.count || 0) || (b.rdv.total || 0) - (a.rdv.total || 0) || (a.name || '').localeCompare(b.name || ''));
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

const data = {
  month: '2026-10',
  setters: [
    { id: 'a', name: 'Inès', active: true, months: { '2026-10': { rdv: { total: 20, held: 9, no_show: 4 }, sales: { count: 2, amount: 9600 } } } },
    { id: 'b', name: 'Karim', active: true, months: { '2026-10': { rdv: { total: 13, held: 5, no_show: 2 }, sales: { count: 1, amount: 4800 } } } },
    { id: 'c', name: 'Léa', active: true, months: { '2026-10': { rdv: { total: 13, held: 4, no_show: 2 }, sales: { count: 1, amount: 4800 } } } },
    { id: 'd', name: 'Marc', active: false, months: { '2026-10': { rdv: { total: 2 }, sales: { count: 0 } } } },   // inactif sans vente : écarté
    { id: 'e', name: 'Zoé', active: false, months: { '2026-10': { rdv: { total: 1 }, sales: { count: 3 } } } },    // inactive mais avec des ventes : gardée
    { id: 'f', name: 'Sans mois', active: true, months: {} },
  ],
  team: { months: { '2026-10': { rdv: { total: 49, held: 18, no_show: 8, upcoming: 8, to_qualify: 4 }, sales: { count: 4, amount: 19200 } } } },
};
const calls = { status: 'ok', setters: { a: { status: 'linked', calls: 330, answered: 130 }, b: { status: 'linked', calls: 280, answered: 110 }, c: { status: 'missing' }, e: { status: 'error' } } };
const days = { elapsed: 11, remaining: 11, total: 22 };

test('Perf Setter : mêmes lignes et mêmes chiffres que l\'ancien onglet Setters', () => {
  assert.deepEqual(monthFigures(data, calls, days), originalFigures(data, calls, days));
  assert.deepEqual(monthFigures(data, null, null), originalFigures(data, null, null));
  assert.deepEqual(monthFigures(data, { status: 'error', setters: {} }, { elapsed: 0, remaining: 22, total: 22 }), originalFigures(data, { status: 'error', setters: {} }, { elapsed: 0, remaining: 22, total: 22 }));
});

test('lignes : actifs ou avec une vente, triés par ventes, puis RDV posés, puis nom ; appels seulement pour les setters reliés à Allo', () => {
  const rows = setterRows(data, calls);
  assert.deepEqual(rows.map((r) => r.name), ['Zoé', 'Inès', 'Karim', 'Léa', 'Sans mois']);
  assert.equal(rows.find((r) => r.id === 'a').calls.calls, 330);
  assert.equal(rows.find((r) => r.id === 'c').calls, null);              // pas de compte Allo : jamais un 0 inventé
  assert.equal(rows.find((r) => r.id === 'c').callsStatus, 'missing');
  assert.equal(rows.find((r) => r.id === 'e').calls, null);              // Allo en erreur
});

test('chiffres d\'équipe : appels pour 1 vente, présence, moyenne par jour ouvré', () => {
  const f = monthFigures(data, calls, days);
  assert.equal(f.callsTotal, 610);
  assert.equal(f.answeredTotal, 240);
  assert.equal(f.teamSales, 4);
  assert.equal(f.callsPerSaleTeam, 610 / 4);
  assert.equal(f.presenceTeam, 18 / 26);
  assert.equal(f.elapsed, 11);
  assert.equal(f.remaining, 11);
});

test('sans appel, sans vente ni jour écoulé : pas de ratio inventé', () => {
  const none = monthFigures({ month: '2026-10', setters: [], team: { months: {} } }, null, null);
  assert.equal(none.callsPerSaleTeam, null);
  assert.equal(none.presenceTeam, null);
  assert.equal(none.elapsed, null);
  assert.equal(none.remaining, null);
  assert.equal(monthFigures(data, calls, { elapsed: 0, remaining: 22 }).elapsed, null);   // « aucun jour écoulé : le chiffre seul »
});

test('mois du sélecteur : du plus récent au premier mois du journal, libellé capitalisé', () => {
  const options = monthOptions('2026-05', '2026-10');
  assert.deepEqual(options.map((o) => o.value), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
  assert.equal(options[0].label, 'Octobre 2026');
  assert.equal(options[5].label, 'Mai 2026');
  assert.deepEqual(monthOptions('2025-11', '2026-02').map((o) => o.value), ['2026-02', '2026-01', '2025-12', '2025-11']);   // passage d'année
  assert.deepEqual(monthOptions('2026-10', '2026-10').map((o) => o.value), ['2026-10']);
});
