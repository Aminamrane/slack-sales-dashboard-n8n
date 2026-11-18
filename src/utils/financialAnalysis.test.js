import test from 'node:test';
import assert from 'node:assert/strict';
import { afterFirstYear, asOfMonth, departures, financialAnalysis, fromApi, legalForms, lifetimeLabel, monthBounds, monthLabel,
  monthlyResiliations, retentionCurve, sectorBreakdown, sectorKey, worstMonth } from './financialAnalysis.js';

const row = (more) => ({ is_pending_contract: false, etat_affiche: 'Signé', etat_date: null, owner_signed_at: null, secteur_activite: '', legal_form: null, ...more });
const ASOF = '2026-11-17';

test('lifetimeLabel : une durée se lit en années, mois et jours', () => {
  assert.equal(lifetimeLabel(null), '–');
  assert.equal(lifetimeLabel(0), '0 jour');
  assert.equal(lifetimeLabel(1), '1 jour');
  assert.equal(lifetimeLabel(12), '12 jours');
  assert.equal(lifetimeLabel(274), '9 mois');
  assert.equal(lifetimeLabel(309), '10 mois 5 jours');
  assert.equal(lifetimeLabel(365), '1 an');
  assert.equal(lifetimeLabel(431), '1 an 2 mois 5 jours');
  assert.equal(lifetimeLabel(800), '2 ans 2 mois 9 jours');
  // Un jour de plus, et le libellé suit : la durée avance chaque jour.
  assert.notEqual(lifetimeLabel(310), lifetimeLabel(309));
});

test('fromApi : les lignes réduites de la route reprennent la forme du board', () => {
  assert.deepEqual(fromApi([{ pending: false, etat: 'Signé', etat_date: null, signed: '2026-01-02', sector: 'BTP', legal_form: 'SAS' }]).map((r) => ({ ...r })),
    [{ is_pending_contract: false, etat_affiche: 'Signé', etat_date: null, owner_signed_at: '2026-01-02', secteur_activite: 'BTP', legal_form: 'SAS' }]);
  assert.deepEqual(fromApi(null), []);
});

test('le mois regardé : arrêté au dernier jour, ou aujourd’hui pour le mois en cours', () => {
  assert.equal(asOfMonth('2026-10', '2026-11-17'), '2026-10-31');
  assert.equal(asOfMonth('2026-11', '2026-11-17'), '2026-11-17');
  assert.equal(monthLabel('2026-02'), 'février 2026');
  assert.deepEqual(monthBounds([row({ owner_signed_at: '2025-03-04T10:00:00' }), row({ owner_signed_at: '2024-12-01' }), row({})], '2026-11-17'),
    { first: '2024-12', last: '2026-11' });
});

test('retentionCurve : la part encore là au bout de N mois, tant qu’assez de clients le disent', () => {
  const lives = [
    { signed: '2025-01-10', days: 676, open: true },
    { signed: '2025-03-01', days: 200, open: false },
    { signed: '2026-01-05', days: 316, open: true },
    { signed: '2026-09-01', days: 77, open: true },
  ];
  const curve = retentionCurve(lives, ASOF, { minEligible: 2 });
  assert.deepEqual(curve[0], { month: 0, eligible: 4, kept: 4, rate: 1 });
  assert.deepEqual([curve[3].eligible, curve[3].kept], [3, 3]);
  assert.deepEqual([curve[12].eligible, curve[12].kept, curve[12].rate], [2, 1, 0.5]);
  // Au-delà de 20 mois, il ne reste qu'un client assez ancien : la courbe s'arrête.
  assert.equal(curve.at(-1).month, 20);
});

test('afterFirstYear et departures : après un an, et au bout de quand on résilie', () => {
  const year = afterFirstYear([{ days: 465, open: true }, { days: 665, open: false }, { days: 200, open: false }, { days: 364, open: true }]);
  assert.deepEqual([year.passed, year.stillHere, year.gone, year.extraDays], [2, 1, 1, 200]);
  const left = (days, etat) => ({ days, open: false, row: row({ etat_affiche: etat }) });
  const out = departures([left(60, 'Résiliation'), left(300, 'Self-Résiliation'), left(400, 'Résiliation'), left(500, 'Liquidation'), { days: 900, open: true, row: row({}) }]);
  assert.deepEqual([out.count, out.averageDays, out.medianDays, out.afterOneYear], [3, (60 + 300 + 400) / 3, 300, 1]);
  assert.deepEqual(out.buckets.map((b) => b.count), [1, 0, 1, 1, 0, 0]);
});

test('monthlyResiliations : chaque mois depuis le début, le mois en cours compté jusqu’à aujourd’hui', () => {
  const rows = [
    row({ owner_signed_at: '2025-01-01' }), row({ owner_signed_at: '2025-01-01' }),
    row({ owner_signed_at: '2025-01-01', etat_affiche: 'Résiliation', etat_date: '2026-10-12' }),
    row({ owner_signed_at: '2025-01-01', etat_affiche: 'Résiliation', etat_date: '2026-11-25' }),   // après aujourd'hui
  ];
  const months = monthlyResiliations(rows, '2026-09', '2026-11', ASOF, { minBase: 2 });
  assert.deepEqual(months.map((m) => [m.key, m.count, m.base]), [['2026-09', 0, 4], ['2026-10', 1, 4], ['2026-11', 0, 3]]);
  assert.equal(months[1].label, 'octobre 2026');
  assert.equal(monthlyResiliations(rows, '2024-11', '2026-11', ASOF).length, 25);
  // Le graphique part de la première signature, quel que soit le mois regardé.
  assert.equal(financialAnalysis(rows, '2026-03-31', null, { today: ASOF }).months[0].key, '2025-01');
});

test('worstMonth : le mois où l’on résilie le plus, parmi les mois assez peuplés pour comparer', () => {
  const m = (key, count, base) => ({ key, count, base, rate: base ? count / base : null, comparable: base >= 30 });
  assert.equal(worstMonth([m('2024-01', 1, 5), m('2025-06', 6, 300), m('2025-07', 3, 310)]).key, '2025-06');
  assert.equal(worstMonth([m('2025-06', 3, 300), m('2025-07', 3, 300)]).key, '2025-06');
  assert.equal(worstMonth([m('2025-06', 0, 300)]), null);
});

test('sectorBreakdown : les niches, nom corrigé, autres secteurs regroupés, non renseigné à part', () => {
  const life = (secteur, open, days, etat = 'Signé') => ({ row: row({ secteur_activite: secteur, etat_affiche: etat }), open, days });
  const out = sectorBreakdown([
    life('Micro créche', true, 400), life('micro-creche', true, 200), life('Micro créche', false, 300, 'Résiliation'),
    life('Restauration', true, 100), life('Restauration', false, 500, 'Liquidation'),
    life('', true, 50), life('BTP', true, 80),
  ], 2);
  assert.deepEqual(out.sectors.map((s) => [s.label, s.open, s.resiliated, s.clients]),
    [['Micro-crèche', 2, 1, 3], ['Restauration', 1, 0, 2], ['Autres secteurs (1)', 1, 0, 1], ['Secteur non renseigné', 1, 0, 1]]);
  assert.equal(out.sectors[0].averageDays, 300);
  assert.equal(out.sectors[0].resiliationRate, 1 / 3);
  assert.deepEqual([out.named, out.unknown], [3, 1]);
});

test('legalForms : SARL, SAS… parmi les clients en cours qui ont rempli leur NDA', () => {
  const life = (form, open = true) => ({ open, row: row({ legal_form: form }) });
  const out = legalForms([life('SARL'), life('sarl'), life('SAS'), life('SCI'), life(null), life('SAS', false)]);
  assert.deepEqual([out.known, out.unknown], [4, 1]);
  assert.deepEqual(out.forms.map((f) => [f.label, f.count]), [['SARL', 2], ['SAS', 1], ['Autres', 1]]);
});

test('financialAnalysis : la LTV posée comme une division, une niche restreint tout sauf la liste des niches', () => {
  assert.equal(financialAnalysis(null, ASOF), null);
  const rows = [
    row({ owner_signed_at: '2025-01-10', secteur_activite: 'BTP', legal_form: 'SARL' }),
    row({ owner_signed_at: '2025-03-01', etat_affiche: 'Résiliation', etat_date: '2025-09-17', secteur_activite: 'btp' }),
    row({ owner_signed_at: '2026-09-20', etat_affiche: 'Rétractation', etat_date: '2026-10-01' }),
    row({ owner_signed_at: '2026-06-01', is_pending_contract: true }),
    row({ owner_signed_at: '2026-01-05', secteur_activite: 'Micro créche' }),
  ];
  const all = financialAnalysis(rows, ASOF);
  assert.deepEqual([all.measured, all.inCourse, all.gone, all.retracted], [3, 2, 1, 1]);
  assert.equal(all.ltv.clients, 3);
  assert.equal(all.ltv.averageDays, all.ltv.totalDays / 3);
  assert.equal(all.ltv.averageDays, all.lifetime.averageDays, 'la même moyenne que le dashboard');
  assert.equal(all.forms.known, 1);
  const btp = financialAnalysis(rows, ASOF, sectorKey('BTP'));
  assert.deepEqual([btp.measured, btp.inCourse, btp.gone], [2, 1, 1]);
  // Le rétracté (sans secteur) n'est pas un client mesuré : il n'apparaît dans aucune niche.
  assert.deepEqual(btp.sectors.map((s) => s.label), ['BTP', 'Micro-crèche']);
  // Un mois passé : ce qui est arrivé après n'existe pas encore.
  assert.equal(financialAnalysis(rows, '2025-12-31').measured, 2);
});
