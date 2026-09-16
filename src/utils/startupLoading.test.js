import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function startup(online = true) {
  const message = { textContent: '' };
  const retry = { hidden: true, addEventListener: (_, fn) => { retry.click = fn; } };
  const listeners = new Map();
  let timer;
  let reloads = 0;
  const window = {
    location: { reload: () => { reloads++; } },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const navigator = { onLine: online };
  vm.runInNewContext(script, {
    window, navigator,
    document: { getElementById: id => id.endsWith('message') ? message : retry },
    setTimeout: fn => { timer = fn; return 1; },
    clearTimeout: () => { timer = null; },
  });
  return { window, navigator, message, retry, listeners,
    expire: () => timer?.(), emit: (name, event) => listeners.get(name)?.(event),
    reloads: () => reloads };
}

test('slow boot keeps a message and waits for an explicit retry', () => {
  const s = startup();
  assert.match(s.message.textContent, /quelques instants/);
  assert.equal(s.retry.hidden, true);
  s.expire();
  assert.match(s.message.textContent, /patienter ou réessayer/);
  assert.equal(s.retry.hidden, false);
  assert.equal(s.reloads(), 0);
  s.retry.click();
  assert.equal(s.reloads(), 1);
});

test('failed entry module offers recovery even before the app runs', () => {
  const s = startup();
  s.emit('error', { target: { tagName: 'SCRIPT', type: 'module' } });
  assert.match(s.message.textContent, /interrompu/);
  assert.equal(s.retry.hidden, false);
  assert.equal(s.reloads(), 0);
});

test('unrelated asset errors do not report that the app failed', () => {
  const s = startup();
  s.emit('error', { target: { tagName: 'IMG' } });
  assert.equal(s.retry.hidden, true);
  assert.match(s.message.textContent, /quelques instants/);
});

test('offline and online transitions update the message without reloading', () => {
  const s = startup(false);
  assert.match(s.message.textContent, /Connexion interrompue/);
  assert.equal(s.retry.hidden, false);
  s.navigator.onLine = true;
  s.emit('online');
  assert.match(s.message.textContent, /quelques instants/);
  assert.equal(s.retry.hidden, true);
  assert.equal(s.reloads(), 0);
});

test('an app import failure remains recoverable after network restoration', () => {
  const s = startup();
  s.window.ownerStartup.fail();
  s.navigator.onLine = false;s.emit('offline');
  s.navigator.onLine = true;s.emit('online');
  assert.match(s.message.textContent, /chargement a été interrompu/);
  assert.equal(s.retry.hidden, false);
});

test('successful startup removes pending hints and network listeners', () => {
  const s = startup();
  s.window.ownerStartup.finish();
  s.expire();s.emit('offline');
  assert.equal(s.window.ownerStartup, undefined);
  assert.equal(s.listeners.size, 0);
  assert.equal(s.retry.hidden, true);
  assert.match(s.message.textContent, /quelques instants/);
});
