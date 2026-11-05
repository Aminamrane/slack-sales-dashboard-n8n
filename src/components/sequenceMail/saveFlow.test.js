// Tests de saveFlow.js : l'enregistrement réel (validation, clé d'idempotence, issues). node --test src/components/sequenceMail/saveFlow.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSignature, saveEmail } from './saveFlow.js';

const html = '<p>Bonjour <a href="https://e.test/r/EVENT_ID">lien</a></p>';
const step = (over = {}) => ({ kind: 'k', subject: 'Objet', html, text: 'Bonjour\n', ...over });
const base = (over = {}) => ({ step: step(), cohortId: 'webinar-2026-10-08', kind: 'email_confirmation', expectedVersion: 0, keyState: { key: null, signature: null }, ...over });
const failure = (status, detail) => Object.assign(new Error('x'), { status, data: detail === undefined ? undefined : { detail } });
let n = 0;
const newKey = () => `cle-test-${++n}`;

test('contenu invalide : refusé localement, AUCUN appel au serveur', async () => {
  let calls = 0;
  const r = await saveEmail({ ...base({ step: step({ subject: '   ' }) }), put: async () => { calls += 1; }, newKey });
  assert.equal(calls, 0);
  assert.equal(r.ok, false);
  assert.equal(r.local, true);
  assert.equal(r.error.kind, 'invalid');
});

test('succès : la demande contient exactement le contenu, la clé est libérée', async () => {
  let seen;
  const keyState = { key: null, signature: null };
  const r = await saveEmail({ ...base({ keyState, baseHash: 'a1b2c3d4' }), put: async (args) => { seen = args; return { version: 1, subject: 'Objet' }; }, newKey });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, { cohortId: 'webinar-2026-10-08', kind: 'email_confirmation', expectedVersion: 0, subject: 'Objet', html, text: null, baseHash: 'a1b2c3d4', note: null, idempotencyKey: seen.idempotencyKey });
  assert.match(seen.idempotencyKey, /^cle-test-/);
  assert.deepEqual(keyState, { key: null, signature: null });
});

test('un e-mail texte seul : le texte est envoyé, pas de HTML', async () => {
  let seen;
  await saveEmail({ ...base({ step: step({ html: undefined, text: 'Seulement du texte\n' }) }), put: async (a) => { seen = a; return { version: 1 }; }, newKey });
  assert.equal(seen.html, null);
  assert.equal(seen.text, 'Seulement du texte\n');
});

test('échec réseau puis nouvel essai du MÊME contenu : la MÊME clé d\'idempotence (jamais deux versions)', async () => {
  const keyState = { key: null, signature: null };
  const keys = [];
  const put = async ({ idempotencyKey }) => { keys.push(idempotencyKey); if (keys.length === 1) throw new TypeError('Failed to fetch'); return { version: 1 }; };
  const first = await saveEmail({ ...base({ keyState }), put, newKey });
  assert.equal(first.ok, false);
  assert.equal(first.error.kind, 'network');
  assert.equal(first.error.retryable, true);
  const second = await saveEmail({ ...base({ keyState }), put, newKey });
  assert.equal(second.ok, true);
  assert.equal(keys[0], keys[1]);
});

test('un contenu différent reçoit une clé neuve', async () => {
  const keyState = { key: null, signature: null };
  const keys = [];
  const put = async ({ idempotencyKey }) => { keys.push(idempotencyKey); throw failure(503, 'indisponible'); };
  await saveEmail({ ...base({ keyState }), put, newKey });
  await saveEmail({ ...base({ keyState, step: step({ subject: 'Objet modifié' }) }), put, newKey });
  assert.notEqual(keys[0], keys[1]);
});

test('une autre version de départ reçoit aussi une clé neuve', async () => {
  const keyState = { key: null, signature: null };
  const keys = [];
  const put = async ({ idempotencyKey }) => { keys.push(idempotencyKey); throw failure(503); };
  await saveEmail({ ...base({ keyState, expectedVersion: 1 }), put, newKey });
  await saveEmail({ ...base({ keyState, expectedVersion: 2 }), put, newKey });
  assert.notEqual(keys[0], keys[1]);
});

test('refus définitif (conflit, contenu refusé, droits) : la clé est abandonnée et l\'erreur est classée', async () => {
  for (const [status, detail, kind] of [[409, { message: 'Modifié', current_version: 2 }, 'conflict'], [422, { message: 'Refusé', problems: ['x'] }, 'invalid'], [403, { message: 'Non' }, 'forbidden']]) {
    const keyState = { key: null, signature: null };
    const r = await saveEmail({ ...base({ keyState }), put: async () => { throw failure(status, detail); }, newKey });
    assert.equal(r.ok, false);
    assert.equal(r.error.kind, kind);
    assert.deepEqual(keyState, { key: null, signature: null });
  }
});

test('échecs réessayables (429, 5xx) : la clé est conservée pour le rejeu', async () => {
  for (const status of [429, 500, 502, 503]) {
    const keyState = { key: null, signature: null };
    const r = await saveEmail({ ...base({ keyState }), put: async () => { throw failure(status); }, newKey });
    assert.equal(r.error.retryable, true);
    assert.ok(keyState.key);
  }
});

test('requestSignature : identique pour la même demande, différente dès qu\'un élément change', () => {
  const content = { subject: 'S', html: '<p>x</p>', text: null };
  const sig = requestSignature({ cohortId: 'c', kind: 'k', expectedVersion: 0, content });
  assert.equal(sig, requestSignature({ cohortId: 'c', kind: 'k', expectedVersion: 0, content: { ...content } }));
  for (const other of [{ cohortId: 'd' }, { kind: 'l' }, { expectedVersion: 1 }, { content: { ...content, subject: 'T' } }, { content: { ...content, html: '<p>y</p>' } }, { content: { ...content, text: 't' } }]) {
    assert.notEqual(sig, requestSignature({ cohortId: 'c', kind: 'k', expectedVersion: 0, content, ...other }));
  }
});
