import test from 'node:test';
import assert from 'node:assert/strict';
import { countItems, filterItems, itemState, outcomeLabel, untilLabel, wallLabel } from './secondChance.js';

const items = [
  { lead_id: 1, stage: 'r1', result: 'cancelled', company: 'Crèche des Lilas', contact_first_name: 'Anne', sales_name: 'Yanis Zaïri', claim: null },
  { lead_id: 2, stage: 'r2', result: 'pas_interesse', company: 'BTP Martin', contact_first_name: 'Paul', sales_name: 'Léo Mafrici', claim: { claimed_by_me: true } },
  { lead_id: 3, stage: 'r2', result: 'annule', company: 'Resto du Port', contact_first_name: 'Lina', sales_name: 'Gary Meynier', claim: { claimed_by_me: false, setter_name: 'Lamia' } },
];

test('libellé du résultat qui a fermé le parcours', () => {
  assert.equal(outcomeLabel('r1', 'cancelled'), 'R1 annulé');
  assert.equal(outcomeLabel('r2', 'annule'), 'R2 annulé');
  assert.equal(outcomeLabel('r2', 'pas_interesse'), 'R2 · pas intéressé');
});

test('état d’un lead : libre, repris par moi, repris par un autre setter', () => {
  assert.deepEqual(items.map(itemState), ['free', 'mine', 'taken']);
  assert.deepEqual(countItems(items), { free: 1, mine: 1, taken: 1 });
});

test('onglets, étape et recherche', () => {
  assert.deepEqual(filterItems(items, { tab: 'free' }).map((i) => i.lead_id), [1, 3]);
  assert.deepEqual(filterItems(items, { tab: 'mine' }).map((i) => i.lead_id), [2]);
  assert.deepEqual(filterItems(items, { tab: 'free', stage: 'r2' }).map((i) => i.lead_id), [3]);
  assert.deepEqual(filterItems(items, { tab: 'free', query: 'yanis' }).map((i) => i.lead_id), [1]);
});

test('dates en heure-mur, sans conversion', () => {
  assert.equal(wallLabel('2026-09-29T10:00'), 'mar. 29 sept. · 10 h 00');
  assert.equal(wallLabel('2026-09-29T10:00', { time: false }), 'mar. 29 sept.');
  assert.equal(wallLabel(null), '');
});

test('échéance d’une reprise, déjà en heure de Paris', () => {
  assert.equal(untilLabel('2026-10-09T17:00'), 'ven. 9 oct.');
  assert.equal(untilLabel(null), '');
});
