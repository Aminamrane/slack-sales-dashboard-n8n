import test from 'node:test';
import assert from 'node:assert/strict';
import { usesDashboardOnlyNavbar } from './dashboardAudience.js';
import { matchesSignedClient, resolvePendingExit, isCurrentProductClient } from './boardClientState.js';

test('navbar restriction targets exactly the six requested accounts, preserving admin and sales', () => {
  for (const id of ['6b32dc17-528d-4e01-b955-2c49a5f44b6a','94b5dcc1-a1bb-41ac-94fe-14cf047cffef','868ef35d-2a9f-4216-8109-4f6ccf3f780c','b9b6ca8c-7f87-4774-896b-a5fbb274ed28','f6c461ae-5e38-473a-8fbf-dca601ded016','94db551c-f464-4360-a1c6-cbfd054055bd']) assert.equal(usesDashboardOnlyNavbar({ id }), true);
  assert.equal(usesDashboardOnlyNavbar({ id:'445a5b0d-61e3-4e3b-b1fc-77b04b66df12', role:'admin' }), false);
  for (const role of ['sales','head_of_sales','finance_team','ceo','hr']) assert.equal(usesDashboardOnlyNavbar({ id:'other', role }), false);
  assert.equal(usesDashboardOnlyNavbar(null), false);
});

test('pending exits remain signed until their effective day, retaining the pending badge', () => {
  for (const [pending, final] of [['En cours de résiliation','Résiliation'],['En cours de rétractation','Rétractation']]) {
    const state = resolvePendingExit(pending, '2026-10-13', '2026-10-12');
    assert.equal(state, pending);
    assert.equal(matchesSignedClient({ is_pending_contract:false }, state), true);
    const effective = resolvePendingExit(pending, '2026-10-13', '2026-10-13');
    assert.equal(effective, final);
    assert.equal(matchesSignedClient({}, effective), false);
    assert.equal(resolvePendingExit(pending, null, '2026-10-14'), pending);
  }
  assert.equal(matchesSignedClient({ is_pending_contract:true }, 'En cours de résiliation'), false);
  assert.equal(matchesSignedClient({}, 'Pause'), false);
});

test('product includes new established clients waiting for Optilex and excludes effective exits', () => {
  for (const state of ['Signé', "Attente Opti'Lex", 'En cours de résiliation', 'En cours de rétractation'])
    assert.equal(isCurrentProductClient({ numero_client:'n°1' }, state), true);
  for (const state of ['Résiliation', 'Rétractation', 'Liquidation'])
    assert.equal(isCurrentProductClient({ numero_client:'n°1' }, state), false);
  assert.equal(isCurrentProductClient({ numero_client:'n°1', is_pending_contract:true }, 'En cours'), false);
});
