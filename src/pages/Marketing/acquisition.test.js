import test from 'node:test';
import assert from 'node:assert/strict';
import { acquisitionPeriod, withAcquisition } from './acquisition.js';

const cohort = 'webinar-2026-09-21';
const period = { since: '2026-09-04', until: '2026-09-21' };
const stats = { summary: { leadsDb: 346, budgetEur: 999 }, timeseries: { budgetByDay: [{ day: '2026-09-10', amount: '999' }] } };
const meta = { ...period, rows: [{ name: 'WEBINAIRE BROAD SEPTEMBRE', spend: 6925.68, leads: 357 }, { name: 'OTHER WEBINAR', spend: 5000, leads: 20 }] };

test('campaign-specific spend and distinct Meta/received denominators without mutation', () => {
  const original = structuredClone(stats);
  const result = withAcquisition(stats, cohort, period, meta);
  assert.equal(result.summary.budgetEur, 6925.68);
  assert.equal(result.summary.cplEur, 6925.68 / 357);
  assert.equal(result.summary.costPerSignupEur, 6925.68 / 346);
  assert.deepEqual(result.timeseries.budgetByDay, []);
  assert.equal(result.metaDailyBudgetAvailable, false);
  assert.deepEqual(stats, original);
});

test('rejects unavailable or wrong-period data instead of showing manual budget', () => {
  for (const response of [null, { ...meta, since: '2026-07-01' }, { ...meta, rows: null }]) {
    const result = withAcquisition(stats, cohort, period, response);
    assert.equal(result.summary.metaBudgetStatus, 'unavailable');
    assert.equal(result.summary.budgetEur, null);
    assert.equal(result.summary.cplEur, null);
  }
});

test('empty period is zero spend, zero leads has no CPL', () => {
  const result = withAcquisition({ summary: { leadsDb: 0 } }, cohort, period, { ...period, rows: [] });
  assert.equal(result.summary.budgetEur, 0);
  assert.equal(result.summary.cplEur, null);
  assert.equal(result.summary.costPerSignupEur, null);
});

test('restricts requested dates to cohort and rejects missing dates', () => {
  const webinar = { date_start: '2026-08-31', date_end: '2026-10-05' };
  assert.deepEqual(acquisitionPeriod({ range: { from: '2026-07-01', to: '2026-11-01' } }, webinar), { since: '2026-08-31', until: '2026-10-05' });
  assert.equal(acquisitionPeriod({}, webinar), null);
});

test('unknown cohort leaves existing manual behavior unchanged', () => {
  assert.equal(withAcquisition(stats, 'unknown', period, meta), stats);
});

test('preserves historical daily budget only if it reconciles to Meta totals', () => {
  const historical = { ...stats, timeseries: { budgetByDay: [{ day: '2026-09-10', amount: '20' }, { day: '2026-08-01', amount: '100' }] } };
  const response = { ...period, rows: [{ name: 'WEBINAIRE - AMBU - Copie', spend: 20, leads: 2 }] };
  const result = withAcquisition(historical, 'webinar-2026-07-20', period, response);
  assert.equal(result.metaDailyBudgetAvailable, true);
  assert.equal(result.timeseries.budgetByDay.length, 1);
  response.rows[0].spend = 21;
  assert.equal(withAcquisition(historical, 'webinar-2026-07-20', period, response).metaDailyBudgetAvailable, false);
});
