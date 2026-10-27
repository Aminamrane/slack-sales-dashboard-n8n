import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardStats, computeOnboarding, computeDirectors, periodEndISO, etatPeriodOptions } from './ceoDashboardStats.js';

const NOW = new Date(2026, 9, 27, 12); // 27/10/2026
const row = (over) => ({
  numero_client: 'n°1', is_pending_contract: false, owner_signed_at: '2026-03-10T10:00:00+00:00',
  etat_affiche: 'Signé', etat_date: null, meteo_score: null, rdv_onboarding_done: false,
  rdv_onboarding_date: null, rdv_onboarding_date_manual: null,
  ...over,
});

const ROWS = [
  row({ numero_client: 'n°1', meteo_score: 5 }),
  row({ numero_client: 'n°2', meteo_score: 3, rdv_onboarding_done: true }),
  row({ numero_client: 'n°3', etat_affiche: 'Résiliation', etat_date: '2026-10-05' }),
  row({ numero_client: 'n°4', etat_affiche: 'Résiliation', etat_date: '2026-08-20' }),
  row({ numero_client: 'n°5', etat_affiche: 'Rétractation', etat_date: '2026-10-12' }),
  row({ numero_client: 'n°6', etat_affiche: 'En cours de résiliation', meteo_score: 1 }),
  row({ numero_client: 'n°7', is_pending_contract: true }),            // contrat en vol : hors périmètre
  row({ numero_client: 'n°8', owner_signed_at: null }),                 // sans date : compté en « Tout » seulement
];
const ARR = { 'n°3': 1200, 'n°5': 600 };                                // n°4 sans montant

test('photo du parc en « Tout » : stocks, flux, météo et sorties en cours', () => {
  const s = computeBoardStats(ROWS, 'all', ARR, NOW);
  assert.equal(s.total, 7);
  assert.equal(s.actifs, 4);           // n°1, n°2, n°6 (en cours = encore membre), n°8
  assert.equal(s.resilies, 2);
  assert.equal(s.retractes, 1);
  assert.equal(s.resiliesThisMonth, 1);
  assert.equal(s.retractesThisMonth, 1);
  assert.deepEqual(s.resiliesSeries.slice(-3), [1, 0, 1]);   // août, sept., oct.
  assert.equal(s.pendingResiliation, 1);
  assert.equal(s.pendingRetraction, 0);
  assert.equal(s.onboarding, 0);
  assert.equal('integration' in s, false);   // les RDV d'intégration n'existent plus
  assert.equal(s.meteoRated, 3);
  assert.equal(s.meteoSigned, 4);
  assert.equal(s.meteoAvg, 3);
  assert.deepEqual(s.meteoBands, { rouge: 1, orange: 1, vert: 1 });
  assert.equal(s.currentMonthLabel, 'octobre 2026');
  assert.equal(s.periodLabel, null);
});

test('ARR perdu : même périmètre que les sorties, un montant inconnu est compté à part', () => {
  const s = computeBoardStats(ROWS, 'all', ARR, NOW);
  assert.deepEqual({ total: s.arrResilies.total, known: s.arrResilies.known, missing: s.arrResilies.missing }, { total: 1200, known: 1, missing: 1 });
  assert.equal(s.arrResilies.thisMonth.total, 1200);
  assert.deepEqual(s.arrResilies.series.slice(-3), [0, 0, 1200]);
  assert.equal(s.arrRetractes.total, 600);
  assert.equal(computeBoardStats(ROWS, 'all', null, NOW).arrResilies, null);
});

test('mois choisi : signés au plus tard fin de mois, sortis après = encore actifs', () => {
  const s = computeBoardStats(ROWS, '2026-09', ARR, NOW);
  assert.equal(s.total, 6);            // n°8 sans date de signature exclu
  assert.equal(s.actifs, 5);           // n°3 et n°5 sortis en octobre : encore actifs fin septembre ; n°4 sorti en août
  assert.equal(s.resilies, 0);
  assert.equal(s.retractes, 0);
  assert.equal(s.periodLabel, 'septembre 2026');
  const aug = computeBoardStats(ROWS, '2026-08', ARR, NOW);
  assert.equal(aug.resilies, 1);
  assert.equal(aug.arrResilies.total, 0);
  assert.equal(aug.arrResilies.missing, 1);
});

test('board absent = null, jamais des zéros', () => {
  assert.equal(computeBoardStats(null, 'all', ARR, NOW), null);
  assert.equal(computeOnboarding(undefined), null);
  assert.equal(computeDirectors([], null), null);
});

test('onboarding et dirigeants sur le parc produit courant', () => {
  const o = computeOnboarding(ROWS);
  assert.deepEqual(o, { done: 1, remaining: 3 });   // n°1, n°6, n°8 à réaliser ; sorties exclues
  const d = computeDirectors(ROWS, { clients: { 'n°1': { directors: 2, directors_documented: true }, 'n°2': { directors: 1, directors_documented: true } } });
  assert.deepEqual(d, { count: 3, missing: 2 });     // n°6 et n°8 sans dirigeant documenté
});

test('bornes de période', () => {
  assert.equal(periodEndISO('2026-02'), '2026-02-28');
  const opts = etatPeriodOptions(NOW);
  assert.equal(opts.length, 25);
  assert.deepEqual(opts[1], { key: '2026-10', label: 'Octobre 2026' });
});
