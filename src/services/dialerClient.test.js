import test from 'node:test';
import assert from 'node:assert/strict';
import dialerClient from './dialerClient.js';

const json = (status, body = {}) => new Response(JSON.stringify(body), { status });

function setup(t, gate) {
  const values = new Map([['auth_token', 'access-0'], ['refresh_token', 'refresh-0']]);
  const calls = [];
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', auth: options.headers?.Authorization,
      type: options.headers?.['Content-Type'], body: options.body });
    if (url.endsWith('/api/v1/auth/refresh')) {
      values.set('auth_token', 'access-1');
      return json(200, { access_token: 'access-1', refresh_token: 'refresh-1' });
    }
    return gate(options.headers?.Authorization);
  };
  const globals = { localStorage, fetch, navigator: {}, window: { location: { href: '/dialer' } } };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  return calls;
}

test('every dialer call carries the CRM session and keeps its body', async t => {
  const calls = setup(t, () => json(200, { ok: true }));
  const file = new Blob(['first_name,last_name,phone\n']);
  await dialerClient.listCampaigns();
  await dialerClient.createCampaign('Relances', '+33100000000');
  await dialerClient.uploadCsv(7, file);
  await dialerClient.next(7);
  await dialerClient.call(7, 3, '', 'conf-a');
  await dialerClient.startSession('op', '+33600000000');
  await dialerClient.activeSession('op');
  await dialerClient.endSession('op');
  await dialerClient.hangup(7, 3);
  await dialerClient.stats(7);
  await dialerClient.items(7);
  await dialerClient.getOperator('op');
  await dialerClient.saveOperator('op', '+33600000000');
  assert.equal(calls.length, 13);
  assert.ok(calls.every(c => c.auth === 'Bearer access-0' && c.url.startsWith(`${dialerClient.base}/`)));
  assert.deepEqual(calls.map(c => `${c.method} ${c.url.slice(dialerClient.base.length)}`), [
    'GET /campaigns', 'POST /campaigns', 'POST /campaigns/7/upload-csv', 'GET /campaigns/7/next',
    'POST /campaigns/7/call', 'POST /sessions/start', 'GET /sessions/active?op_key=op', 'POST /sessions/end',
    'POST /campaigns/7/hangup', 'GET /campaigns/7/stats', 'GET /campaigns/7/items', 'GET /operators/op',
    'PUT /operators/op',
  ]);
  assert.equal(calls[1].type, 'application/x-www-form-urlencoded');
  assert.equal(calls[1].body, 'name=Relances&caller_id=%2B33100000000');
  assert.equal(calls[2].type, undefined);
  assert.equal(calls[2].body.get('file') instanceof Blob, true);
});

test('an expired session is renewed once, then the dialer call is replayed', async t => {
  const calls = setup(t, auth => auth === 'Bearer access-1' ? json(200, [{ id: 7 }]) : json(401));
  assert.deepEqual(await dialerClient.listCampaigns(), [{ id: 7 }]);
  assert.deepEqual(calls.map(c => [c.url.replace(dialerClient.base, '<dialer>'), c.auth]), [
    ['<dialer>/campaigns', 'Bearer access-0'],
    ['https://api.ownertechnology.com/api/v1/auth/refresh', undefined],
    ['<dialer>/campaigns', 'Bearer access-1'],
  ]);
});

test('a role without the dialer is refused without renewing the session', async t => {
  const calls = setup(t, () => json(403, { detail: 'Accès refusé' }));
  await assert.rejects(dialerClient.stats(7), { status: 403, message: 'Accès refusé' });
  assert.equal(calls.length, 1);
});
