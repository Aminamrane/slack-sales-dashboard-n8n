import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchContractsOfLead, contractSentLine } from './leadContracts.js';

test('the lead endpoint returns contracts sent by anyone, with senders', async () => {
  const api = { get: async (url) => { assert.equal(url, '/api/v1/contracts/lead/8664'); return { contracts: [{ id: 'c1' }], senders: { u1: 'Alexandre V' } }; } };
  assert.deepEqual(await fetchContractsOfLead(api, 8664), { list: [{ id: 'c1' }], senders: { u1: 'Alexandre V' } });
});

test('falls back to my contracts only while the backend is not updated', async () => {
  const calls = [];
  const api = { get: async (url) => { calls.push(url); if (url.includes('/lead/')) throw Object.assign(new Error('nf'), { status: 404 }); return { contracts: [{ id: 'mine' }] }; } };
  assert.deepEqual(await fetchContractsOfLead(api, 1), { list: [{ id: 'mine' }], senders: {} });
  assert.equal(calls[1], '/api/v1/contracts/my-contracts?lead_id=1');
});

test('a refusal is not hidden behind the fallback', async () => {
  const api = { get: async () => { throw Object.assign(new Error('no'), { status: 403 }); } };
  await assert.rejects(fetchContractsOfLead(api, 1), /no/);
});

test('sent line names the sender, Paris time and the signer', () => {
  const line = contractSentLine({ commercial_user_id: 'u1', sent_at: '2026-09-24T21:55:51Z', client_name: 'Hugues Bouchard', client_email: 'h@serr.fr' }, { u1: 'Alexandre Voratovic' });
  assert.equal(line, 'Envoyé par Alexandre Voratovic le 24/09 à 23:55 à Hugues Bouchard (h@serr.fr)');
});

test('unknown sender and missing fields are simply left out', () => {
  assert.equal(contractSentLine({ commercial_user_id: 'x', client_name: 'SERR' }, {}), 'Envoyé à SERR');
});
