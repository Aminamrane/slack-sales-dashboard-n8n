import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientState, conversion, fmtEuro, fmtMonth, fmtMonthShort, fmtRate, neighbourMonth, rowsForMonth,
} from './settersStats.js';

test('months read as words', () => {
  assert.equal(fmtMonth('2026-09'), 'Septembre 2026');
  assert.equal(fmtMonthShort('2026-10'), 'oct. 26');
  assert.equal(fmtMonth('n/a'), '');
});

test('conversion is clients over held meetings, never a misleading 0 %', () => {
  assert.equal(conversion({ held: 90, clients: 19 }), 21);
  assert.equal(conversion({ held: 0, clients: 0 }), null);
  assert.equal(fmtRate(null), 'n/a');
  assert.equal(fmtRate(21), '21 %');
});

test('amounts are whole euros', () => {
  assert.equal(fmtEuro(72936).replace(/\s/g, ' '), '72 936 €');
});

test('month navigation stays inside the covered months', () => {
  const months = ['2026-05', '2026-06', '2026-07'];
  assert.equal(neighbourMonth(months, '2026-06', -1), '2026-05');
  assert.equal(neighbourMonth(months, '2026-07', 1), null);
  assert.equal(neighbourMonth(months, '2025-01', 1), null);
});

test('a meeting shows whether the person became a client', () => {
  assert.equal(clientState({ client: { signed_at: '2026-06-20' } }), 'client');
  assert.equal(clientState({ already_client: true }), 'already_client');
  assert.equal(clientState({ signed_not_declared: true }), 'signed_not_declared');
  assert.equal(clientState({}), null);
});

test('setters with sales this month come first', () => {
  const setters = [
    { name: 'Bea', months: { '2026-09': { rdv: { total: 30 }, sales: { count: 1 } } }, totals: { sales: { count: 2 } } },
    { name: 'Aline', months: { '2026-09': { rdv: { total: 10 }, sales: { count: 3 } } }, totals: { sales: { count: 3 } } },
    { name: 'Chloé', months: {}, totals: { sales: { count: 0 } } },
  ];
  assert.deepEqual(rowsForMonth(setters, '2026-09').map((s) => s.name), ['Aline', 'Bea', 'Chloé']);
});
