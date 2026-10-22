// src/components/sequenceMail/store.test.js
//
// Store de l'interface (onglets, fenêtres flottantes, persistance) : `node --test src/components/sequenceMail/store.test.js`
// Le store lit `sessionStorage` et `window` à l'import : on les simule AVANT de l'importer.

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
const handlers = {};
globalThis.sessionStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener: (type, fn) => { handlers[type] = fn; },
  removeEventListener: () => {},
};
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (type, fn) => { handlers[`document:${type}`] = fn; },
  removeEventListener: () => {},
};

const KEY = 'owner.seqMail.v1';
const { actions, getSeqMailState, resetSeqMailState, clampRect, FLOAT_SAFE_TOP, MAX_BULK_OPEN } = await import('./store.js');

const A = 'c::a';
const B = 'c::b';
const C = 'c::c';
const D = 'c::d';
const state = () => getSeqMailState();
const stored = () => JSON.parse(memory.get(KEY) ?? 'null');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => resetSeqMailState());

test('état initial : liste active, rien d\'ouvert', () => {
  const s = state();
  assert.equal(s.cohortId, 'all');
  assert.equal(s.activeKey, null);
  assert.deepEqual(s.tabs, []);
  assert.deepEqual(s.floating, []);
  assert.equal(s.focusRequest, null);
});

test('resetSeqMailState : efface la clé persistée ET remet la mémoire à zéro', async () => {
  actions.openEmail(A);
  actions.openFloating(B);
  actions.selectCohort('webinar-2026-10-08');
  actions.setDensity('compact');
  handlers.pagehide(); // écrit tout de suite
  assert.ok(memory.has(KEY));
  assert.deepEqual(stored().tabs, [A]);

  resetSeqMailState();
  assert.equal(memory.has(KEY), false);
  const s = state();
  assert.deepEqual(s.tabs, []);
  assert.deepEqual(s.floating, []);
  assert.equal(s.activeKey, null);
  assert.equal(s.cohortId, 'all');
  assert.equal(s.density, 'comfortable');
  assert.deepEqual(s.history, []);

  // une écriture différée en attente avant la réinitialisation ne doit pas la ressusciter
  actions.openEmail(C);
  resetSeqMailState();
  await wait(260);
  assert.equal(memory.has(KEY), false);
});

test('persistance : différée (200 ms), immédiate sur « pagehide », absente pour le transitoire', async () => {
  actions.selectCohort('webinar-2026-09-21');
  assert.equal(memory.has(KEY), false);
  handlers.pagehide();
  assert.equal(stored().cohortId, 'webinar-2026-09-21');

  memory.delete(KEY);
  actions.setChecked([A]); // transitoire : aucune écriture
  actions.announce('Bonjour');
  await wait(260);
  assert.equal(memory.has(KEY), false);

  actions.setDensity('compact');
  await wait(260);
  assert.equal(stored().density, 'compact');
});

test('persistance : une page mise en arrière-plan (visibilitychange) écrit aussi tout de suite', () => {
  actions.setDensity('compact');
  assert.equal(memory.has(KEY), false);
  document.visibilityState = 'visible';
  handlers['document:visibilitychange']();
  assert.equal(memory.has(KEY), false, 'visible : rien à écrire de force');
  document.visibilityState = 'hidden';
  handlers['document:visibilitychange']();
  assert.equal(stored().density, 'compact');
  document.visibilityState = 'visible';
});

test('relecture : un état enregistré corrompu est assaini', async () => {
  memory.set(KEY, JSON.stringify({
    cohortId: 42, sequence: 'nimporte', tabs: [A, A, '', 7, B], activeKey: 'absent', collapsed: [1, 2], viewMode: 'x',
    floating: [{ key: C, x: 'a', y: null, w: 5, h: 5, z: 'x' }, { key: A }, null, { key: C }],
    layout: { navW: 9999, navCollapsed: 1 },
  }));
  const fresh = await import('./store.js?relecture');
  const s = fresh.getSeqMailState();
  assert.equal(s.cohortId, 'all');
  assert.equal(s.sequence, 'any');
  assert.deepEqual(s.tabs, [A, B]);
  assert.equal(s.activeKey, null);
  assert.deepEqual(s.collapsed, {});
  assert.deepEqual(s.viewMode, {});
  assert.deepEqual(s.floating.map((f) => f.key), [C]); // doublon, null et clé déjà en onglet écartés
  assert.ok(s.floating[0].w >= 340 && s.floating[0].h >= 240);
  assert.equal(s.floating[0].min, false);
  assert.equal(s.layout.navW, 360);
  assert.equal(s.layout.navCollapsed, true);
});

test('une annonce identique deux fois de suite alterne une espace de largeur nulle', () => {
  actions.announce('Onglet fermé');
  const first = state().announce;
  actions.announce('Onglet fermé');
  const second = state().announce;
  actions.announce('Onglet fermé');
  const third = state().announce;
  assert.equal(first, 'Onglet fermé');
  assert.notEqual(second, first);
  assert.equal(second.replace(String.fromCharCode(0x200b), ''), 'Onglet fermé');
  assert.notEqual(third, second);
  assert.equal(third, 'Onglet fermé');
  actions.announce('Autre message');
  assert.equal(state().announce, 'Autre message');
});

test('les annonces des actions (fermeture d\'onglet) sont relues aussi', () => {
  actions.openEmail(A, { background: true });
  actions.openEmail(B, { background: true });
  actions.closeTab(A);
  const first = state().announce;
  actions.closeTab(B);
  assert.notEqual(state().announce, first);
  assert.equal(state().announce.replace(String.fromCharCode(0x200b), ''), 'Onglet fermé');
});

test('openEmail : un nouvel onglet s\'ouvre à droite de l\'onglet courant, en fond sans l\'activer', () => {
  actions.openEmail(A);
  actions.openEmail(B);
  assert.deepEqual(state().tabs, [A, B]);
  assert.equal(state().activeKey, B);
  actions.activate(A);
  actions.openEmail(C);
  assert.deepEqual(state().tabs, [A, C, B]);
  actions.openEmail(D, { background: true });
  assert.equal(state().activeKey, C);
  assert.deepEqual(state().tabs, [A, C, D, B]);
});

test('closeTab : retour à l\'onglet précédemment consulté, liste comprise', () => {
  actions.openEmail(A);
  actions.openEmail(B);
  actions.closeTab(B);
  assert.equal(state().activeKey, A);
  actions.closeTab(A);
  assert.equal(state().activeKey, null);
});

test('replaceEmail : précédent/suivant garde la même place', () => {
  actions.openEmail(A);
  actions.replaceEmail(A, B);
  assert.deepEqual(state().tabs, [B]);
  assert.equal(state().activeKey, B);
  actions.openFloating(C);
  actions.replaceEmail(C, D);
  assert.equal(state().floating[0].key, D);
  // l'e-mail visé est déjà ouvert ailleurs : on y va, sans doublon
  actions.openEmail(A, { background: true });
  actions.replaceEmail(B, A);
  assert.equal(state().activeKey, A);
  assert.equal(new Set(state().tabs).size, state().tabs.length);
});

test('detachTab / openFloating : fenêtres créées non réduites, avec une demande de focus', () => {
  actions.openEmail(A);
  actions.detachTab(A);
  const w1 = state().floating[0];
  assert.equal(w1.min, false);
  assert.equal(w1.key, A);
  assert.deepEqual(state().tabs, []);
  assert.equal(state().focusRequest.key, A);
  actions.openFloating(B);
  assert.equal(state().floating[1].min, false);
  assert.equal(state().focusRequest.key, B);
  assert.ok(state().floating[1].y >= FLOAT_SAFE_TOP);
});

test('ackFocus : la demande n\'est pas rejouée et seule la bonne est effacée', () => {
  actions.openFloating(A);
  const first = state().focusRequest;
  actions.ackFocus(first.n + 99); // numéro inconnu : ignoré
  assert.deepEqual(state().focusRequest, first);
  actions.ackFocus(first.n);
  assert.equal(state().focusRequest, null);
});

test('showFloating : rouvre une fenêtre réduite, la met devant et demande le focus ; focusFloating ne demande rien', () => {
  actions.openFloating(A);
  actions.openFloating(B);
  actions.minimizeFloating(A);
  assert.equal(state().floating.find((f) => f.key === A).min, true);
  actions.ackFocus(state().focusRequest.n);
  actions.focusFloating(B); // z-order seulement
  assert.equal(state().focusRequest, null);
  actions.showFloating(A);
  const a = state().floating.find((f) => f.key === A);
  assert.equal(a.min, false);
  assert.equal(a.z, state().zTop);
  assert.equal(state().focusRequest.key, A);
  actions.showFloating('inconnue'); // sans effet
  assert.equal(state().focusRequest.key, A);
});

test('ouvrir un e-mail déjà détaché le ramène devant et lui donne le focus', () => {
  actions.openFloating(A);
  actions.openFloating(B);
  actions.ackFocus(state().focusRequest.n);
  actions.openEmail(A);
  assert.equal(state().floating.find((f) => f.key === A).z, state().zTop);
  assert.equal(state().focusRequest.key, A);
  assert.deepEqual(state().tabs, []);
});

test('dockFloating : l\'index compte les seuls onglets d\'e-mail (la liste épinglée n\'en est pas un)', () => {
  actions.openEmail(A, { background: true });
  actions.openEmail(B, { background: true });
  actions.openEmail(C, { background: true });
  actions.openFloating(D);
  actions.dockFloating(D, 1); // entre A et B
  assert.deepEqual(state().tabs, [A, D, B, C]);
  assert.equal(state().activeKey, D);
  assert.deepEqual(state().floating, []);
  actions.openFloating('c::e');
  actions.dockFloating('c::e', 0); // avant tout onglet d'e-mail
  assert.equal(state().tabs[0], 'c::e');
  actions.openFloating('c::f');
  actions.dockFloating('c::f'); // sans index : à la fin
  assert.equal(state().tabs.at(-1), 'c::f');
  actions.openFloating('c::g');
  actions.dockFloating('c::g', 999); // index trop grand : à la fin
  assert.equal(state().tabs.at(-1), 'c::g');
});

test('les rangs d\'empilement restent bornés (sous les icônes réduites)', () => {
  actions.openFloating(A);
  actions.openFloating(B);
  for (let i = 0; i < 600; i += 1) actions.focusFloating(i % 2 ? A : B);
  const z = state().floating.map((f) => f.z);
  assert.ok(Math.max(...z) <= 250, `z max = ${Math.max(...z)}`);
  assert.ok(state().zTop <= 250);
  assert.notEqual(z[0], z[1]);
});

test('clampRect : jamais sous la navbar, jamais plus petit que le minimum, toujours saisissable', () => {
  const r = clampRect({ x: -5000, y: -10, w: 10, h: 10 });
  assert.equal(r.y, FLOAT_SAFE_TOP);
  assert.equal(r.w, 340);
  assert.equal(r.h, 240);
  assert.ok(r.x + r.w >= 96);
  const far = clampRect({ x: 99999, y: 99999, w: 560, h: 460 });
  assert.ok(far.x <= 1440 - 96 && far.y <= 900 - 40);
});

test('plafond de l\'ouverture groupée', () => {
  assert.equal(MAX_BULK_OPEN, 8);
});
