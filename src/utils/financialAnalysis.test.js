import test from 'node:test';
import assert from 'node:assert/strict';
import { afterFirstYear, financialAnalysis, lifetimeLabel, sectorBreakdown, survival } from './financialAnalysis.js';

const row = (more) => ({ is_pending_contract: false, etat_affiche: 'Signé', etat_date: null, owner_signed_at: null, secteur_activite: '', ...more });
const ASOF = '2026-11-17';

test('lifetimeLabel : une durée se lit en années et mois', () => {
  assert.equal(lifetimeLabel(null), '–');
  assert.equal(lifetimeLabel(12), '12 jours');
  assert.equal(lifetimeLabel(274), '9 mois');
  assert.equal(lifetimeLabel(365), '1 an');
  assert.equal(lifetimeLabel(670), '1 an 10 mois');
  assert.equal(lifetimeLabel(800), '2 ans 2 mois');
});

test('survival : la part encore là au bout de N mois, parmi les clients assez anciens pour le dire', () => {
  const lives = [
    { signed: '2025-01-10', days: 676, open: true },    // encore là après 22 mois
    { signed: '2025-03-01', days: 200, open: false },   // parti au bout de 6 mois et demi
    { signed: '2026-01-05', days: 316, open: true },    // 10 mois : trop récent pour les 12 mois
    { signed: '2026-09-01', days: 77, open: true },     // 2 mois et demi : trop récent pour tout
  ];
  assert.deepEqual(survival(lives, ASOF).map((step) => [step.months, step.eligible, step.kept]), [[3, 3, 3], [6, 3, 3], [12, 2, 1], [18, 2, 1]]);
  assert.equal(survival(lives, ASOF)[2].rate, 0.5);
});

test('afterFirstYear : ceux qui ont passé un an, et le temps resté au-delà', () => {
  const stats = afterFirstYear([{ days: 365 + 100, open: true }, { days: 365 + 300, open: false }, { days: 200, open: false }, { days: 364, open: true }]);
  assert.deepEqual([stats.passed, stats.stillHere, stats.gone, stats.extraDays, stats.goneExtraDays], [2, 1, 1, 200, 300]);
  assert.equal(afterFirstYear([]).extraDays, null);
});

test('sectorBreakdown : les niches, écriture la plus fréquente, non renseigné à part', () => {
  const life = (secteur, open, days, etat = 'Signé') => ({ row: row({ secteur_activite: secteur, etat_affiche: etat }), open, days });
  const out = sectorBreakdown([
    life('Micro-crèche', true, 400), life('micro-creche', true, 200), life('Micro-crèche', false, 300, 'Résiliation'),
    life('Restauration', true, 100), life('Restauration', false, 500, 'Liquidation'),
    life('', true, 50), life('BTP', true, 80),
  ], 2);
  assert.deepEqual(out.sectors.map((s) => [s.label, s.open, s.resiliated, s.clients]),
    [['Micro-crèche', 2, 1, 3], ['Restauration', 1, 0, 2], ['Autres secteurs', 1, 0, 1], ['Secteur non renseigné', 1, 0, 1]]);
  assert.equal(out.sectors[0].averageDays, 300);
  assert.equal(out.sectors[0].share, 2 / 5);
  assert.deepEqual([out.named, out.known, out.unknown], [3, 6, 1]);
});

test('financialAnalysis : mêmes chiffres que le dashboard, plus la rétention et les niches', () => {
  assert.equal(financialAnalysis(null, ASOF), null);
  const out = financialAnalysis([
    row({ owner_signed_at: '2025-01-10', secteur_activite: 'BTP' }),
    row({ owner_signed_at: '2025-03-01', etat_affiche: 'Résiliation', etat_date: '2025-09-17', secteur_activite: 'BTP' }),
    row({ owner_signed_at: '2026-09-20', etat_affiche: 'Rétractation', etat_date: '2026-10-01' }),   // jamais vraiment client
    row({ owner_signed_at: '2026-06-01', is_pending_contract: true }),                                // contrat en vol
    row({ owner_signed_at: '2026-01-05' }),
  ], ASOF);
  assert.equal(out.inCourse, 2);
  assert.deepEqual([out.lifetime.measured, out.lifetime.open, out.lifetime.closed], [3, 2, 1]);
  assert.deepEqual([out.resiliationGlobal.count, out.resiliationGlobal.base], [1, 2]);
  assert.deepEqual(out.sectors.map((s) => [s.label, s.open, s.resiliated]), [['BTP', 1, 1], ['Secteur non renseigné', 1, 0]]);
  assert.equal(out.afterFirstYear.passed, 1);
});
