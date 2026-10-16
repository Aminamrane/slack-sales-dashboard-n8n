import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP, monthOf, nodeLeads } from './intakeData.js';

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
  assert.deepEqual(nodeLeads({ id: 'ads:pool_waiting', group: 'ads', fate: 'pool_waiting', value: 1 }, 'octobre').groups, [GROUP.engine, GROUP.last]);
  assert.deepEqual(nodeLeads({ id: 'ads:ads_pool', group: 'ads', fate: 'ads_pool', value: 1 }, 'octobre').groups, [GROUP.engine, GROUP.now]);
  assert.deepEqual(nodeLeads({ id: 'ads:not_given_small', group: 'ads', fate: 'not_given_small', value: 1 }, 'octobre').groups, []);
  assert.equal(GROUP.last.key(leads[1]), 'Alexandre');
  assert.equal(GROUP.now.key(leads[1]), 'au pool');
});

test('les mois anciens portent leur année si elle diffère', () => {
  const year = new Date().getFullYear();
  assert.equal(monthOf(`${year}-09`), 'sept.');
  assert.equal(monthOf(`${year - 1}-12`), `déc. ${year - 1}`);
});
