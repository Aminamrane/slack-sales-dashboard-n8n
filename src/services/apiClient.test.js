import test from 'node:test';
import assert from 'node:assert/strict';
import apiClient from './apiClient.js';

const Client = apiClient.constructor;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const user = { id: 'fixture-user', role: 'sales', email: 'fixture@example.test' };
const json = (status, body = {}) => new Response(JSON.stringify(body), { status });
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

function setup(t, { locks = true } = {}) {
  const values = new Map([
    ['auth_token', 'access-0'], ['refresh_token', 'refresh-0'],
    ['auth_user', JSON.stringify(user)], ['permissions', '{"tracking_sheet":true}'],
  ]);
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  let lockTail = Promise.resolve();
  const navigator = locks ? { locks: { request: (_name, fn) => {
    const result = lockTail.then(fn);
    lockTail = result.catch(() => {});
    return result;
  } } } : {};
  const window = { location: { href: '/tracking-sheet' } };
  const state = { now: 0, expiry: 8 * HOUR, refreshExpiry: 90 * DAY, generation: 0, refreshes: 0, calls: [] };
  const server = async (url, options = {}) => {
    state.calls.push(url);
    if (url.endsWith('/auth/refresh')) {
      state.refreshes++;
      if (JSON.parse(options.body).refresh_token !== `refresh-${state.generation}` || state.now >= state.refreshExpiry) {
        return json(401);
      }
      state.generation++;
      state.expiry = state.now + 8 * HOUR;
      state.refreshExpiry = state.now + 90 * DAY;
      return json(200, { access_token: `access-${state.generation}`, refresh_token: `refresh-${state.generation}` });
    }
    if (options.headers?.Authorization !== `Bearer access-${state.generation}` || state.now >= state.expiry) return json(401);
    return json(200, user);
  };
  for (const [key, value] of Object.entries({ localStorage, window, navigator, fetch: server })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  return { client: new Client(), values, state, server, window };
}

for (const elapsed of [8 * HOUR + 1, 7 * DAY + 1]) {
  test(`opening a protected page after ${elapsed / HOUR} hours silently restores the session`, async t => {
    const { client, state, values, window } = setup(t);
    state.now = elapsed;
    assert.deepEqual(await client.getMe(), user);
    assert.equal(state.refreshes, 1);
    assert.equal(values.get('refresh_token'), 'refresh-1');
    assert.equal(window.location.href, '/tracking-sheet');
  });
}

test('eight days of activity can renew repeatedly without entering a password', async t => {
  const { client, state, window } = setup(t);
  for (let hour = 0; hour <= 8 * 24; hour += 9) {
    state.now = hour * HOUR;
    assert.deepEqual(await client.getMe(), user);
  }
  assert.ok(state.refreshes >= 20);
  assert.equal(window.location.href, '/tracking-sheet');
});

test('parallel calls share one rotation within an onglet, including without Web Locks', async t => {
  const { client, state } = setup(t, { locks: false });
  state.now = 9 * HOUR;
  const results = await Promise.all([client.getMe(), client.get('/leads'), client.get('/users')]);
  assert.equal(results.length, 3);
  assert.equal(state.refreshes, 1);
});

test('two tabs serialize rotation of the shared refresh token', async t => {
  const { client, state, window } = setup(t);
  state.now = 9 * HOUR;
  await Promise.all([client.getMe(), new Client().getMe()]);
  assert.equal(state.refreshes, 1);
  assert.equal(window.location.href, '/tracking-sheet');
});

test('late 401 from an old request reuses a token that was already renewed', async t => {
  const { client, state, server } = setup(t);
  state.now = 9 * HOUR;
  const arrived = deferred();
  const release = deferred();
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/slow') && options.headers.Authorization === 'Bearer access-0') {
      arrived.resolve();
      await release.promise;
      return json(401);
    }
    return server(url, options);
  };
  const slow = client.get('/slow');
  await arrived.promise;
  await client.getMe();
  release.resolve();
  await slow;
  assert.equal(state.refreshes, 1);
});

for (const failure of ['offline', 503, 429, 'malformed']) {
  test(`refresh failure ${failure} preserves credentials and a later retry succeeds`, async t => {
    const { client, state, server, values, window } = setup(t);
    state.now = 9 * HOUR;
    globalThis.fetch = async (url, options) => {
      if (!url.endsWith('/auth/refresh')) return server(url, options);
      if (failure === 'offline') throw new TypeError('Failed to fetch');
      return failure === 'malformed' ? json(200, {}) : json(failure);
    };
    await assert.rejects(client.getMe());
    assert.equal(values.get('refresh_token'), 'refresh-0');
    assert.equal(values.get('auth_token'), 'access-0');
    assert.equal(window.location.href, '/tracking-sheet');
    globalThis.fetch = server;
    assert.deepEqual(await client.getMe(), user);
  });
}

for (const kind of ['expired', 'revoked', 'missing']) {
  test(`${kind} refresh token requires a real login`, async t => {
    const { client, state, values, window } = setup(t);
    state.now = kind === 'expired' ? 91 * DAY : 9 * HOUR;
    if (kind === 'revoked') values.set('refresh_token', 'revoked');
    if (kind === 'missing') values.delete('refresh_token');
    await assert.rejects(client.getMe(), error => error.status === 401);
    assert.equal(values.has('auth_token'), false);
    assert.equal(values.has('refresh_token'), false);
    assert.equal(window.location.href, '/login');
  });
}

test('logout during an in-flight refresh cannot resurrect the session', async t => {
  const { client, state, server, values } = setup(t);
  state.now = 9 * HOUR;
  const arrived = deferred();
  const release = deferred();
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/logout')) return json(200);
    if (url.endsWith('/auth/refresh')) { arrived.resolve(); await release.promise; }
    return server(url, options);
  };
  const request = client.getMe();
  const rejected = assert.rejects(request, error => error.status === 401);
  await arrived.promise;
  await client.logout();
  release.resolve();
  await rejected;
  assert.equal(values.has('auth_token'), false);
  assert.equal(values.has('refresh_token'), false);
});

test('a stale refresh rejection cannot erase a newer login', async t => {
  const { client, state, server, values, window } = setup(t);
  state.now = 9 * HOUR;
  const arrived = deferred();
  const release = deferred();
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { arrived.resolve(); await release.promise; return json(401); }
    return server(url, options);
  };
  const request = client.getMe();
  await arrived.promise;
  state.generation = 10;
  state.expiry = 18 * HOUR;
  values.set('auth_token', 'access-10');
  values.set('refresh_token', 'refresh-10');
  release.resolve();
  await request;
  assert.equal(values.get('refresh_token'), 'refresh-10');
  assert.equal(window.location.href, '/tracking-sheet');
});

test('uploads renew with the same FormData body and preserve browser content type', async t => {
  const { client, state, server } = setup(t);
  state.now = 9 * HOUR;
  const bodies = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/upload')) {
      bodies.push(options.body);
      assert.equal(options.headers['Content-Type'], undefined);
    }
    return server(url, options);
  };
  await client.uploadFile('/upload', new Blob(['fixture']), 'file');
  assert.equal(state.refreshes, 1);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test('a resource 403 does not erase a valid session', async t => {
  const { client, values, window } = setup(t);
  globalThis.fetch = async () => json(403, { detail: 'Forbidden' });
  await assert.rejects(client.get('/restricted'), error => error.status === 403);
  assert.equal(values.get('refresh_token'), 'refresh-0');
  assert.equal(window.location.href, '/tracking-sheet');
});
