import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardStats, computeOnboarding, computeDirectors, periodEndISO, etatPeriodOptions, monthsAndDays } from './ceoDashboardStats.js';

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

test('RDV onboarding à venir : même compteur que le menu Onboarding du board, clients partis exclus', () => {
  // Heures en heure-mur de Paris (étiquetées UTC, comme en base) ; NOW = 27/10, entre 9 h et 13 h à Paris.
  const rows = [
    row({ numero_client: 'n°11', rdv_onboarding_date: '2026-11-03T10:00:00+00:00' }),           // à venir
    row({ numero_client: 'n°12', rdv_onboarding_date_manual: '2026-10-27T18:00:00+00:00' }),    // ce soir
    row({ numero_client: 'n°13', rdv_onboarding_date: '2026-10-27T08:00:00+00:00' }),           // ce matin, non coché : en retard
    row({ numero_client: 'n°14', rdv_onboarding_date: '2026-11-05', rdv_onboarding_done: true }), // déjà réalisé
    row({ numero_client: 'n°15', etat_affiche: 'Résiliation', rdv_onboarding_date: '2026-11-04T09:00:00+00:00' }),
    row({ numero_client: 'n°16', etat_affiche: 'Sans suite', rdv_onboarding_date: '2026-10-27T08:30:00+00:00' }),
    row({ numero_client: 'n°17', etat_affiche: 'En cours de résiliation', rdv_onboarding_date: '2026-11-06T09:00:00+00:00' }), // encore client
    row({ numero_client: 'n°18', is_pending_contract: true, rdv_onboarding_date: '2026-11-07T09:00:00+00:00' }),
  ];
  const s = computeBoardStats(rows, 'all', null, NOW);
  assert.equal(s.onboarding, 4);          // n°11, n°12, n°13, n°17 ; n°15 et n°16 partis, n°14 réalisé, n°18 contrat en vol
  assert.equal(s.onboardingOverdue, 1);   // n°13 ; n°16 (parti) n'est pas compté en retard
  // Bulle : les mêmes 4 RDV par échéance (aujourd'hui n°12 et n°13, sous 7 jours n°11, plus tard n°17) ;
  // le prochain n'est pas celui de ce matin, déjà passé.
  assert.deepEqual(s.onboardingDetail, { today: 2, week: 1, later: 1, next: '2026-10-27T18:00:00+00:00' });
});

test('bulles des sorties : 12 mois + avant + après + sans date = total de l’état', () => {
  const s = computeBoardStats([
    ...ROWS,
    row({ numero_client: 'n°20', etat_affiche: 'Résiliation', etat_date: '2025-06-01' }),   // avant la courbe
    row({ numero_client: 'n°21', etat_affiche: 'Résiliation' }),                           // sans date d'effet
    row({ numero_client: 'n°22', etat_affiche: 'Self-Résiliation', etat_date: '2026-10-09' }),
  ], 'all', ARR, NOW);
  assert.deepEqual(s.resiliesDetail, { total: 4, last12: 2, older: 1, later: 0, undated: 1, peak: { key: '2026-08', count: 1 } });
  assert.equal(s.resilies, s.resiliesDetail.total);
  assert.deepEqual(s.retractesDetail, { total: 1, last12: 1, older: 0, later: 0, undated: 0, peak: { key: '2026-10', count: 1 } });
  assert.equal(s.selfResilies, 1);
});

test('rétention : taux de résiliation (définitions de la Finance) et durée de vie moyenne', () => {
  const rows = [
    row({ numero_client: 'a', owner_signed_at: '2026-01-01' }),                                                    // encore là : 299 j
    row({ numero_client: 'b', owner_signed_at: '2025-10-05', etat_affiche: 'Résiliation', etat_date: '2026-10-05' }), // 365 j
    row({ numero_client: 'c', owner_signed_at: '2026-04-10', etat_affiche: 'Self-Résiliation', etat_date: '2026-10-10' }), // 183 j
    row({ numero_client: 'd', owner_signed_at: '2026-09-20', etat_affiche: 'Rétractation', etat_date: '2026-10-01' }), // hors durée de vie
    row({ numero_client: 'e', owner_signed_at: '2026-05-01', etat_affiche: 'Pause' }),                              // en cours : 179 j
    row({ numero_client: 'f', owner_signed_at: '2026-10-20' }),                                                    // signé après le 1er : 7 j
    row({ numero_client: 'g', owner_signed_at: '2025-06-30', etat_affiche: 'Liquidation', etat_date: '2026-06-30' }), // 365 j
    row({ numero_client: 'h', owner_signed_at: '2026-01-15', etat_affiche: 'Résiliation', etat_date: '2026-09-15' }), // 243 j
    row({ numero_client: 'i', owner_signed_at: '2026-02-01', etat_affiche: 'Résiliation' }),                       // sortie sans date
    row({ numero_client: 'j', is_pending_contract: true }),                                                        // contrat en vol
    row({ numero_client: 'k', owner_signed_at: null }),                                                            // sans signature
  ];
  const s = computeBoardStats(rows, 'all', null, NOW);
  assert.equal(s.retentionAsOf, '2026-10-27');
  // Octobre : b et c (self-résiliation comprise) sur 5 clients en cours le 30/09 (a, b, c, d, e).
  assert.deepEqual(s.resiliationMonth, { key: '2026-10', count: 2, base: 5, rate: 0.4 });
  // Septembre, complet : h sur 5 en cours le 31/08 (a, b, c, e, h).
  assert.deepEqual(s.resiliationPreviousMonth, { key: '2026-09', count: 1, base: 5, rate: 0.2 });
  // Global : b, c, h sur 3 clients en cours aujourd'hui (a, e, f) ; i, sans date, est signalé à part.
  assert.deepEqual(s.resiliationGlobal, { count: 3, base: 3, rate: 1, undated: 1 });
  // Durée de vie : 299, 365, 183, 179, 7, 365, 243 j ; d rétracté exclu ; i et k non mesurables.
  assert.deepEqual({ ...s.lifetime, averageDays: Math.round(s.lifetime.averageDays * 100) / 100 },
    { averageDays: 234.43, medianDays: 243, measured: 7, open: 3, closed: 4, unmeasured: 2, incoherent: 0 });
  assert.deepEqual(monthsAndDays(s.lifetime.averageDays), { months: 7, days: 21 });

  // Mois choisi : tout est lu à la fin du mois (30/09), jamais au-delà d'aujourd'hui.
  const sept = computeBoardStats(rows, '2026-09', null, NOW);
  assert.equal(sept.retentionAsOf, '2026-09-30');
  assert.deepEqual(sept.resiliationMonth, { key: '2026-09', count: 1, base: 5, rate: 0.2 });
  assert.deepEqual(sept.resiliationGlobal, { count: 1, base: 5, rate: 0.2, undated: 1 });
  assert.equal(sept.lifetime.measured, 6);   // f pas encore signé ; b et c encore clients le 30/09
  assert.equal(computeBoardStats(rows, '2026-10', null, NOW).retentionAsOf, '2026-10-27');
});

test('écart avec les clients actifs : actifs + ajoutés − retirés = clients en cours', () => {
  const rows = [
    row({ numero_client: 'a' }),
    row({ numero_client: 'b', etat_affiche: 'En cours de résiliation' }),   // actif et en cours
    row({ numero_client: 'c', etat_affiche: 'Pause' }),
    row({ numero_client: 'd', etat_affiche: "Attente Opti'Lex" }),
    row({ numero_client: 'e', etat_affiche: "Attente Opti'Lex" }),
    row({ numero_client: 'f', etat_affiche: 'En cours de liquidation' }),
    row({ numero_client: 'g', owner_signed_at: null }),                     // actif, mais placé nulle part
    row({ numero_client: 'h', etat_affiche: 'Résiliation', etat_date: '2026-11-30' }),   // effet à venir
    row({ numero_client: 'i', etat_affiche: 'Résiliation', etat_date: '2026-09-01' }),   // parti
    row({ numero_client: 'j', etat_affiche: 'Rétractation', etat_date: '2026-10-02' }),  // parti
  ];
  const s = computeBoardStats(rows, 'all', null, NOW);
  assert.equal(s.actifs, 3);                 // a, b, g
  assert.equal(s.lifetime.open, 7);          // a, b, c, d, e, f, h
  assert.deepEqual(s.lifetimeGap, {
    added: [
      { label: "Attente Opti'Lex", count: 2 },
      { label: 'En cours de liquidation', count: 1 },
      { label: 'Pause', count: 1 },
      { label: 'Résiliation, effet après le 27/10/2026', count: 1 },
    ],
    removed: [{ label: 'Sans date de signature', count: 1 }],
  });
  const sum = (list) => list.reduce((n, g) => n + g.count, 0);
  assert.equal(s.actifs + sum(s.lifetimeGap.added) - sum(s.lifetimeGap.removed), s.lifetime.open);
  assert.equal(s.actifs + sum(s.inCourseGap.added) - sum(s.inCourseGap.removed), s.resiliationGlobal.base);

  // Mois passé : les actifs comptent aussi les sortis après la fin du mois, la durée de vie pas les rétractés.
  const sept = computeBoardStats(rows, '2026-09', null, NOW);
  assert.deepEqual(sept.lifetimeGap.removed, [{ label: 'Rétractés', count: 1 }]);
  assert.equal(sept.actifs + sum(sept.lifetimeGap.added) - sum(sept.lifetimeGap.removed), sept.lifetime.open);
  assert.equal(sept.actifs + sum(sept.inCourseGap.added) - sum(sept.inCourseGap.removed), sept.resiliationGlobal.base);
});

test('durée en mois et jours', () => {
  assert.deepEqual(monthsAndDays(293), { months: 9, days: 19 });
  assert.deepEqual(monthsAndDays(30), { months: 1, days: 0 });   // 30 j ne s'affiche jamais « 0 mois 30 j »
  assert.equal(monthsAndDays(null), null);
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
