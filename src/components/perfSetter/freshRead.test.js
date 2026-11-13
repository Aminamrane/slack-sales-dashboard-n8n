import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadStore } from './freshRead.js';

// Horloge et lectures simulées : aucune requête, aucun délai réel.
const clock = (start = 1_000_000) => { let t = start; return { now: () => t, tick: (ms) => { t += ms; } }; };
const loader = (log, value) => () => { log.push('lecture'); return Promise.resolve(value); };

test('une première lecture charge puis garde la valeur ; peek la rend à jour', async () => {
  const c = clock(); const store = createReadStore({ ttl: 30_000, now: c.now }); const log = [];
  assert.equal(store.peek('a'), null);
  assert.equal(await store.load('a', loader(log, 1)), 1);
  assert.deepEqual(store.peek('a'), { value: 1, at: c.now(), fresh: true });
  assert.equal(log.length, 1);
});

test('dans le délai : la valeur gardée est servie sans relire', async () => {
  const c = clock(); const store = createReadStore({ ttl: 30_000, now: c.now }); const log = [];
  await store.load('a', loader(log, 1));
  c.tick(29_999);
  assert.equal(await store.load('a', loader(log, 2)), 1);
  assert.equal(log.length, 1);
});

test('passé le délai : la valeur reste visible (périmée) et une relecture la remplace', async () => {
  const c = clock(); const store = createReadStore({ ttl: 30_000, now: c.now }); const log = [];
  await store.load('a', loader(log, 1));
  c.tick(30_000);
  const seen = store.peek('a');
  assert.equal(seen.value, 1); assert.equal(seen.fresh, false, 'ne se présente plus comme à jour');
  assert.equal(await store.load('a', loader(log, 2)), 2);
  assert.equal(log.length, 2); assert.equal(store.peek('a').value, 2); assert.equal(store.peek('a').fresh, true);
});

test('le bouton « Actualiser » (version) impose une relecture même dans le délai', async () => {
  const c = clock(); const store = createReadStore({ ttl: 30_000, now: c.now }); const log = [];
  await store.load('a', loader(log, 1), 0);
  assert.equal(store.peek('a', 1).fresh, false);
  assert.equal(await store.load('a', loader(log, 2), 1), 2);
  assert.equal(log.length, 2);
});

test('deux demandes simultanées de la même clé partagent UNE requête', async () => {
  const store = createReadStore(); let calls = 0; let release;
  const slow = () => { calls += 1; return new Promise((r) => { release = r; }); };
  const p1 = store.load('a', slow); const p2 = store.load('a', slow);
  assert.equal(calls, 1);
  release(7);
  assert.deepEqual(await Promise.all([p1, p2]), [7, 7]);
});

test('une version plus récente ne réutilise pas la relecture en cours de l’ancienne', async () => {
  const store = createReadStore(); const resolvers = [];
  const slow = () => new Promise((r) => resolvers.push(r));
  const old = store.load('a', slow, 0); const fresh = store.load('a', slow, 1);
  assert.equal(resolvers.length, 2);
  resolvers[1]('nouvelle'); resolvers[0]('ancienne');
  assert.equal(await fresh, 'nouvelle'); assert.equal(await old, 'ancienne');
  assert.equal(store.peek('a', 1).value, 'nouvelle', 'l’ancienne réponse, arrivée après, n’écrase pas la nouvelle');
});

test('un échec garde la dernière valeur, rejette pour l’appelant et n’empêche pas la relecture suivante', async () => {
  const c = clock(); const store = createReadStore({ ttl: 30_000, now: c.now });
  await store.load('a', () => Promise.resolve('ok'));
  c.tick(60_000);
  await assert.rejects(store.load('a', () => Promise.reject(new Error('réseau'))));
  assert.equal(store.peek('a').value, 'ok'); assert.equal(store.peek('a').fresh, false);
  assert.equal(await store.load('a', () => Promise.resolve('de nouveau')), 'de nouveau');
});

test('un échec sans valeur ne laisse rien en mémoire et la relecture repart', async () => {
  const store = createReadStore();
  await assert.rejects(store.load('a', () => Promise.reject(new Error('x'))));
  assert.equal(store.peek('a'), null);
  assert.equal(await store.load('a', () => Promise.resolve(3)), 3);
});

test('les clés sont indépendantes (aujourd’hui, 7 jours, mois)', async () => {
  const store = createReadStore();
  await store.load('2026-11-13|2026-11-13', () => Promise.resolve('jour'));
  await store.load('2026-11-01|2026-11-30', () => Promise.resolve('mois'));
  assert.equal(store.peek('2026-11-13|2026-11-13').value, 'jour'); assert.equal(store.peek('2026-11-01|2026-11-30').value, 'mois');
  store.clear(); assert.equal(store.peek('2026-11-13|2026-11-13'), null);
});
