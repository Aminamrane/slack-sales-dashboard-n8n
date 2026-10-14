import test from 'node:test';
import assert from 'node:assert/strict';
import { othersRates, rates } from './teamMath.js';

const team = (name, people, values, noshow = 0, done = 0) => ({ team: name, people, values, r1_noshow: noshow, r1_done_due: done });
const teams = [
  team('Équipe Yohan', 6, { leads: 221, r1e: 70, r2e: 44, sales: 24 }, 48, 69),
  team('Équipe Léo', 6, { leads: 174, r1e: 46, r2e: 37, sales: 10 }, 39, 45),
  team('Équipe David', 5, { leads: 92, r1e: 29, r2e: 25, sales: 8 }, 35, 28),
];

test('les autres équipes sont réunies, pas moyennées', () => {
  const ref = othersRates(teams, teams[2]);
  assert.equal(ref.leadsPerSales, (221 + 174) / 12);
  assert.equal(ref.salesPerR2, (24 + 10) / (44 + 37));
  assert.equal(rates(teams[2]).noshow, 35 / 63);
});
