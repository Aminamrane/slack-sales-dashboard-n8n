import test from 'node:test';
import assert from 'node:assert/strict';
import { monthClock, parisNow, projectToMonthEnd, salesPace } from './salesPace.js';

const at = (day, hour = 12, minute = 0, month = 10, year = 2026) => monthClock({ year, month, day, hour, minute });

test('Paris wall time, summer and winter offsets', () => {
  assert.deepEqual(parisNow(new Date('2026-10-13T07:40:00Z')), { year: 2026, month: 10, day: 13, hour: 9, minute: 40 });
  assert.deepEqual(parisNow(new Date('2026-12-31T23:30:00Z')), { year: 2027, month: 1, day: 1, hour: 0, minute: 30 });
});

test('elapsed time counts the started day, month length is exact', () => {
  assert.deepEqual(at(13, 12), { elapsed: 12.5, daysInMonth: 31, day: 13 });
  assert.equal(at(1, 0, 0, 2, 2027).daysInMonth, 28);
});

test("Yohan's message: 28/80 on the morning of the 9th gives TR 35 % and a pace above 80", () => {
  const pace = salesPace({ sales: 28, objective: 80, clock: at(9, 9, 47) });
  assert.equal(pace.tr, 35);
  assert.equal(pace.status, 'on_track');
  assert.ok(pace.onPace >= 100 && pace.onPace <= 110, `on pace ${pace.onPace}`);
});

test('13 October at noon: 41/80, on pace 102, objective on the 25th', () => {
  assert.deepEqual(salesPace({ sales: 41, objective: 80, clock: at(13, 12) }),
    { tr: 51, onPace: 102, status: 'on_track', reachDay: 25 });
});

test('behind, reached, too early and missing objective', () => {
  assert.equal(salesPace({ sales: 20, objective: 80, clock: at(13, 12) }).status, 'behind');
  assert.equal(salesPace({ sales: 80, objective: 80, clock: at(28) }).status, 'reached');
  assert.equal(salesPace({ sales: 2, objective: 80, clock: at(1, 6) }).status, 'too_early');
  assert.equal(projectToMonthEnd(1000, at(1, 6)), null);
  assert.equal(salesPace({ sales: 41, objective: null, clock: at(13) }).status, 'no_objective');
});
