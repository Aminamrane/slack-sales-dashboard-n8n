import test from 'node:test';
import assert from 'node:assert/strict';
import { lossArr } from './lossArr.js';

test('a client without an Owner amount is reported apart, never counted as 0 €', () => {
  const rows = [{ numero_client: 'n°160' }, { numero_client: 'n°276' }, { numero_client: 'n°691' }];
  assert.deepEqual(lossArr(rows, { 'n°160': 5760, 'n°691': 4032 }), { total: 9792, known: 2, missing: 1 });
});

test('without the amounts every exit is unknown', () => {
  assert.deepEqual(lossArr([{ numero_client: 'n°1' }], null), { total: 0, known: 0, missing: 1 });
  assert.deepEqual(lossArr([], {}), { total: 0, known: 0, missing: 0 });
});
