import test from 'node:test';
import assert from 'node:assert/strict';
import { assignableCsms, csmIndex, csmMenuEntries, csmTagLabel, initials, matchesCsm, NO_CSM } from './boardCsm.js';

const csms = [
  { id: 'a', name: 'Alice Martin', avatar_url: '/a.png', active: true },
  { id: 'b', name: 'Bruno Petit', avatar_url: null, active: true },
  { id: 'z', name: 'Zoé Partie', avatar_url: null, active: false },
];
const rows = [{ csm_user_id: 'a' }, { csm_user_id: 'a' }, { csm_user_id: 'z' }, { csm_user_id: null }, { csm_user_id: 'inconnu' }];
const index = csmIndex(csms);

test('no selection lets every client through', () => {
  assert.ok(rows.every((r) => matchesCsm(r, [], index)));
});

test('several CSM are a union, and « Sans CSM » takes clients without one or with an unknown one', () => {
  assert.equal(rows.filter((r) => matchesCsm(r, ['a'], index)).length, 2);
  assert.equal(rows.filter((r) => matchesCsm(r, ['a', 'z'], index)).length, 3);
  assert.equal(rows.filter((r) => matchesCsm(r, [NO_CSM], index)).length, 2);
});

test('the menu lists active CSM, a departed one while they still hold clients, then « Sans CSM »', () => {
  const entries = csmMenuEntries(csms, rows);
  assert.deepEqual(entries.map((e) => [e.key, e.count]), [['a', 2], ['b', 0], ['z', 1], [NO_CSM, 2]]);
  assert.deepEqual(csmMenuEntries(csms, [{ csm_user_id: 'a' }]).map((e) => e.key), ['a', 'b', NO_CSM]);
});

test('only active CSM can receive a client', () => {
  assert.deepEqual(assignableCsms(csms).map((c) => c.id), ['a', 'b']);
});

test('tags and initials', () => {
  assert.equal(csmTagLabel('a', index), 'Alice Martin');
  assert.equal(csmTagLabel(NO_CSM, index), 'Sans CSM');
  assert.equal(initials('Alice  Martin'), 'AM');
  assert.equal(initials('Vincent'), 'V');
  assert.equal(initials(''), '?');
});
