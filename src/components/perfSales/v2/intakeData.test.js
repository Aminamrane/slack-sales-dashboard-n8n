import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP, REASONS, affectedLeads, monthOf, nodeLeads } from './intakeData.js';

// Une case du schéma ouvre exactement ses fiches (dev 16/10/2026 : le détail doit retomber sur le chiffre de la case).
const leads = [
  { id: 1, channel: 'ads', funnel: 'fr', fate: 'ads_affectation', engine: 'Léo', now: 'Léo' },
  { id: 2, channel: 'ads', funnel: 'fr', fate: 'pool_waiting', engine: 'Yanis', now: null, previous: 'Alexandre' },
  { id: 3, channel: 'ads', funnel: 'small', fate: 'not_given_small', engine: null, now: null },
  { id: 4, channel: 'webinar', funnel: 'fr', fate: 'other_webinar', engine: null, now: 'Yohan' },
  { id: 5, channel: 'ads', funnel: 'non_fr', fate: 'ads_pool', engine: 'Gary', now: 'Mehdi' },
];
const ids = (spec) => spec.pick({ leads }).map((r) => r.id);

test('chaque type de case filtre ses propres fiches', () => {
  assert.deepEqual(ids(nodeLeads({ id: 'root', kind: 'root', value: 5 }, 'octobre')), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(nodeLeads({ id: 'ch:ads', kind: 'channel', group: 'ads', value: 4 }, 'octobre')), [1, 2, 3, 5]);
  assert.deepEqual(ids(nodeLeads({ id: 'fun:fr', kind: 'funnel', funnel: 'fr', group: 'ads', value: 2 }, 'octobre')), [1, 2]);
  assert.deepEqual(ids(nodeLeads({ id: 'ads:pool_waiting', group: 'ads', fate: 'pool_waiting', value: 1 }, 'octobre')), [2]);
  assert.deepEqual(ids(nodeLeads({ id: 'webinar:other', group: 'webinar', fate: 'other', value: 1 }, 'octobre')), [4]);
});

test('les regroupements suivent la case', () => {
  assert.deepEqual(nodeLeads({ id: 'ads:pool_waiting', group: 'ads', fate: 'pool_waiting', value: 1 }, 'octobre').groups, [GROUP.reason, GROUP.engine, GROUP.last]);
  assert.deepEqual(nodeLeads({ id: 'ads:ads_pool', group: 'ads', fate: 'ads_pool', value: 1 }, 'octobre').groups, [GROUP.reason, GROUP.engine, GROUP.now]);
  assert.deepEqual(nodeLeads({ id: 'ads:not_given_small', group: 'ads', fate: 'not_given_small', value: 1 }, 'octobre').groups, []);
  assert.equal(GROUP.last.key(leads[1]), 'Alexandre');
  assert.equal(GROUP.now.key(leads[1]), 'au pool');
});

test('les mois anciens portent leur année si elle diffère', () => {
  const year = new Date().getFullYear();
  assert.equal(monthOf(`${year}-09`), 'sept.');
  assert.equal(monthOf(`${year - 1}-12`), `déc. ${year - 1}`);
});

test('la carte « Affectés » ouvre les fiches des trois cases, par raison et par sales', () => {
  const rows = [
    { id: 1, channel: 'ads', fate: 'ads_affectation', departure: 'kept', engine: 'Léo' },
    { id: 2, channel: 'ads', fate: 'pool_waiting', departure: 'barrier', engine: 'Léo' },
    { id: 3, channel: 'ads', fate: 'ads_pool', departure: 'sla_given', engine: 'Yanis' },
    { id: 4, channel: 'ads', fate: 'not_given_small', departure: 'other', engine: null },
    { id: 5, channel: 'webinar', fate: 'other_webinar', departure: 'other', engine: null },
  ];
  const ids = (spec) => spec.pick({ leads: rows }).map((r) => r.id);
  assert.deepEqual(ids(affectedLeads('octobre')), [1, 2, 3]);
  assert.deepEqual(ids(affectedLeads('octobre', { reason: 'barrier' })), [2]);
  assert.deepEqual(ids(affectedLeads('octobre', { sales: 'Léo' })), [1, 2]);
  assert.deepEqual(ids(affectedLeads('octobre', { sales: 'Léo', reason: 'kept' })), [1]);
  assert.deepEqual(affectedLeads('octobre', { reason: 'barrier' }).groups, [GROUP.engine, GROUP.now]);
  assert.equal(GROUP.reason.key(rows[1]), REASONS.barrier.label);
});
