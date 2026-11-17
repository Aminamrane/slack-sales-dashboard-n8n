import test from 'node:test';
import assert from 'node:assert/strict';
import { assignableCsms, assignInBatches, assignLabel, createLongPress, csmIndex, csmMenuEntries, csmTagLabel, initials, isPickable, matchesCsm, NO_CSM, pickModeAvailable } from './boardCsm.js';

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

test('group selection exists only on « Sans CSM », for people who may assign', () => {
  assert.equal(pickModeAvailable([NO_CSM], true), true);
  assert.equal(pickModeAvailable(['a', NO_CSM], true), true);
  assert.equal(pickModeAvailable(['a'], true), false);
  assert.equal(pickModeAvailable([], true), false);
  assert.equal(pickModeAvailable([NO_CSM], false), false);
});

test('a client can be picked when established and without a known CSM', () => {
  assert.equal(isPickable({ numero_client: 'N1', csm_user_id: null }, index), true);
  assert.equal(isPickable({ numero_client: 'N1', csm_user_id: 'inconnu' }, index), true);
  assert.equal(isPickable({ numero_client: 'N1', csm_user_id: 'a' }, index), false);
  assert.equal(isPickable({ numero_client: null, csm_user_id: null }, index), false);
  assert.equal(isPickable(null, index), false);
});

test('long press fires after the delay, not before, and not after moving or releasing', () => {
  const timers = []; let fired = 0;
  const make = () => createLongPress({ delay: 450, slop: 8, onFire: () => { fired++; }, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: (id) => { timers[id - 1].dead = true; } });
  const fire = () => { const t = timers[timers.length - 1]; if (!t.dead) t.fn(); };
  let lp = make();
  lp.start(10, 10); assert.equal(lp.pending, true); assert.equal(timers[0].ms, 450);
  lp.move(14, 12); fire(); assert.equal(fired, 1); assert.equal(lp.end(), true);        // petit tremblement toléré
  assert.equal(lp.end(), false);                                                        // le clic suivant n'est ignoré qu'une fois
  lp = make(); lp.start(0, 0); lp.move(0, 30); fire(); assert.equal(fired, 1);           // défilement : annulé
  lp = make(); lp.start(0, 0); assert.equal(lp.end(), false); fire(); assert.equal(fired, 1);   // relâché avant : simple clic
  lp = make(); lp.start(0, 0); lp.cancel(); fire(); assert.equal(fired, 1);
});

test('assignments go out in small parallel batches, a failure stops nobody, order is kept', async () => {
  let running = 0, peak = 0;
  const patchOne = async (n, id) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 3)); running--; if (n === 'N3') throw new Error('refus'); assert.equal(id, 'a'); };
  const out = await assignInBatches(patchOne, ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N2'], 'a', 3);
  assert.deepEqual(out.ok, ['N1', 'N2', 'N4', 'N5', 'N6']);
  assert.deepEqual(out.failed.map((f) => f.numero), ['N3']);
  assert.ok(peak <= 3 && peak >= 2, `parallélisme ${peak}`);
  assert.deepEqual(await assignInBatches(patchOne, [], 'a'), { ok: [], failed: [] });
});

test('the action label counts the clients', () => {
  assert.equal(assignLabel(1), 'Attribuer à 1 client');
  assert.equal(assignLabel(5), 'Attribuer à 5 clients');
});
