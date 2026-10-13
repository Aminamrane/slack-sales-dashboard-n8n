import test from 'node:test';
import assert from 'node:assert/strict';
import { exitAmounts, requiresExitDecision } from './boardFinanceExit.js';

test('only existing finance decision roles enter the connected exit flow', () => {
  for (const role of ['admin', 'ceo', 'finance_director']) {
    for (const state of ['Rétractation', 'Résiliation', 'Self-Résiliation']) assert.equal(requiresExitDecision(role, state), true);
    assert.equal(requiresExitDecision(role, 'En cours de résiliation'), false);
  }
  for (const role of ['finance_team', 'optilex', 'customer_success_manager']) assert.equal(requiresExitDecision(role, 'Résiliation'), false);
});
test('requires an explicit amount including zero and supports French cents', () => {
  const limits = { past: 1000, current: 100, future: 500 };
  assert.equal(exitAmounts({ past: '', current: '0', future: '0' }, limits), null);
  assert.deepEqual(exitAmounts({ past: '300,25', current: '0', future: '0' }, limits), { amount_past: 300.25, amount_current: 0, amount_future: 0 });
  for (const value of ['-1', '1000.01', 'NaN', 'Infinity', '0.001', '1e2']) assert.equal(exitAmounts({ past: value, current: '0', future: '0' }, limits), null);
});
