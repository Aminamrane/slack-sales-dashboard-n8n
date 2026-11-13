import assert from 'node:assert/strict';
import test from 'node:test';
import { dayRange, daysOf, rangeFor, rangeLabel, shiftMonth, monthsBetween, monthChoices, rangeQuery } from './period.js';

const NOW = '2026-11';

test('un mois se décale et se compte sans date', () => {
  assert.equal(shiftMonth('2026-11', -11), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(monthsBetween('2025-12', '2026-11'), 12);
  assert.deepEqual(monthChoices(NOW, 3), ['2026-11', '2026-10', '2026-09']);
});

test('par défaut le mois en cours, et on peut remonter', () => {
  assert.deepEqual(rangeFor('month', NOW, NOW), { from: '2026-11', to: '2026-11' });
  assert.deepEqual(rangeFor('month', '2026-10', NOW), { from: '2026-10', to: '2026-10' });
  assert.deepEqual(rangeFor('month', '2027-02', NOW), { from: '2026-11', to: '2026-11' });
});

test('trois mois et année sont calés sur le mois choisi, jamais après le mois en cours', () => {
  assert.deepEqual(rangeFor('quarter', NOW, NOW), { from: '2026-09', to: '2026-11' });
  assert.deepEqual(rangeFor('quarter', '2026-01', NOW), { from: '2025-11', to: '2026-01' });
  assert.deepEqual(rangeFor('year', NOW, NOW), { from: '2026-01', to: '2026-11' });
  assert.deepEqual(rangeFor('year', '2025-06', NOW), { from: '2025-01', to: '2025-12' });
});

test('une période choisie est remise dans l\'ordre, bornée au mois en cours et à 24 mois', () => {
  assert.deepEqual(rangeFor('custom', NOW, NOW, { from: '2026-10', to: '2026-08' }), { from: '2026-08', to: '2026-10' });
  assert.deepEqual(rangeFor('custom', NOW, NOW, { from: '2026-10', to: '2027-03' }), { from: '2026-10', to: '2026-11' });
  assert.deepEqual(rangeFor('custom', NOW, NOW, { from: '2023-01', to: '2026-11' }), { from: '2024-12', to: '2026-11' });
  assert.deepEqual(rangeFor('custom', NOW, NOW, {}), { from: '2026-11', to: '2026-11' });
});

test('la période se lit en clair', () => {
  assert.equal(rangeLabel({ from: '2026-11', to: '2026-11' }), 'Novembre 2026');
  assert.equal(rangeLabel({ from: '2026-09', to: '2026-11' }), 'Sept. – nov. 2026');
  assert.equal(rangeLabel({ from: '2025-01', to: '2025-12' }), 'Année 2025');
  assert.equal(rangeLabel({ from: '2025-11', to: '2026-01' }), 'Nov. 2025 – janv. 2026');
  assert.equal(rangeQuery({ from: '2026-09', to: '2026-11' }), 'from=2026-09&to=2026-11');
});

test('les deux taux par sales se lisent aussi sur des jours choisis', () => {
  const TODAY = '2026-11-13';
  // Passer d'une période en mois à des jours : du 1er au dernier jour, jamais après aujourd'hui.
  assert.deepEqual(daysOf({ from: '2026-09', to: '2026-11' }, TODAY), { from: '2026-09-01', to: '2026-11-13' });
  assert.deepEqual(daysOf({ from: '2026-02', to: '2026-02' }, TODAY), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(daysOf({ from: '2024-02', to: '2024-02' }, TODAY), { from: '2024-02-01', to: '2024-02-29' });
  // Deux jours choisis : remis dans l'ordre, bornés à aujourd'hui et à 24 mois.
  assert.deepEqual(dayRange({ from: '2026-11-05', to: '2026-10-15' }, TODAY), { from: '2026-10-15', to: '2026-11-05' });
  assert.deepEqual(dayRange({ from: '2026-10-15', to: '2026-12-31' }, TODAY), { from: '2026-10-15', to: '2026-11-13' });
  assert.deepEqual(dayRange({ from: '2023-01-10', to: '2026-11-13' }, TODAY), { from: '2024-12-01', to: '2026-11-13' });
  assert.equal(dayRange({ from: '', to: '2026-11-13' }, TODAY), null);
  assert.equal(dayRange({ from: '2026-02-31', to: '2026-11-13' }, TODAY), null);
  assert.equal(rangeLabel({ from: '2026-10-15', to: '2026-11-13' }), 'Du 15/10/2026 au 13/11/2026');
  assert.equal(rangeLabel({ from: '2026-11-13', to: '2026-11-13' }), 'Le 13/11/2026');
  assert.equal(rangeQuery({ from: '2026-10-15', to: '2026-11-13' }), 'from=2026-10-15&to=2026-11-13');
});
