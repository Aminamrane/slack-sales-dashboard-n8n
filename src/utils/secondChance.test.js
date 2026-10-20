import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMELINE_LIMIT, collapseEvents, countItems, filterItems, itemState, outcomeLabel, rdvHistory, untilLabel, wallLabel } from './secondChance.js';

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

test('rendez-vous déjà eus : R1 / R2 et absences du parcours, rien d’autre', () => {
  const events = [
    { at: '2026-10-01T09:00', kind: 'lead_created', title: 'Lead créé' },
    { at: '2026-10-05T10:00', kind: 'no_show', title: 'R1 : client absent' },
    { at: '2026-10-06T11:00', kind: 'rdv_placed', title: 'R1 posé', detail: 'Pour le 08/10/2026 à 14:00', actor: 'Jonathan' },
    { at: '2026-10-08T14:00', kind: 'rdv', title: 'R1 : effectué', detail: 'Suite : R2 prévu', actor: 'Jonathan' },
    { at: '2026-10-14T15:00', kind: 'rdv', title: 'R2 : pas intéressé' },
    { at: '2026-10-15T09:53', kind: 'second_chance', title: 'Repris en Seconde chance' },
    { at: '2026-10-16T08:00', kind: 'no_show', title: 'Client absent' },
  ];
  assert.deepEqual(rdvHistory(events), [
    { kind: 'r1', label: 'client absent', at: '2026-10-05T10:00', detail: '', actor: '' },
    { kind: 'r1', label: 'effectué', at: '2026-10-08T14:00', detail: 'Suite : R2 prévu', actor: 'Jonathan' },
    { kind: 'r2', label: 'pas intéressé', at: '2026-10-14T15:00', detail: '', actor: '' },
  ]);
  assert.deepEqual(rdvHistory(null), []);
});

test('parcours long : les 7 premiers restent visibles, la suite se déplie', () => {
  const events = (n) => Array.from({ length: n }, (_, i) => ({ at: `2026-10-${String(i + 1).padStart(2, '0')}T09:00`, title: `e${i + 1}` }));
  assert.equal(TIMELINE_LIMIT, 7);
  assert.deepEqual(collapseEvents(events(7), false), { shown: events(7), hidden: 0 });
  const eight = collapseEvents(events(8), false);
  assert.equal(eight.hidden, 1);
  assert.deepEqual(eight.shown.map((e) => e.title), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']);
  assert.deepEqual(collapseEvents(events(12), true), { shown: events(12), hidden: 0 });
  assert.deepEqual(collapseEvents(null, false), { shown: [], hidden: 0 });
});
