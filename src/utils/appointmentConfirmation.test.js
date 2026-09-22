import test from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';
import { appointmentConfirmation, appointmentFailure } from './appointmentConfirmation.js';
const slot = { date: '2026-10-26', slot: '12:00' };
test('only a verified calendar and saved appointment can show success', () => {
  for (const result of [null, {}, { success: true, calendar_moved: false }]) assert.throws(() => appointmentConfirmation(result, slot));
});
test('Paris wall time is preserved across daylight saving and device timezones', () => {
  for (const tz of ['America/New_York', 'Asia/Tokyo', 'Europe/Paris']) {
    const previous = process.env.TZ; process.env.TZ = tz;
    try { assert.equal(appointmentConfirmation({ success: true, calendar_moved: true, new_dt: '2026-10-26T12:00:00' }, slot).when, '26/10/2026 à 12 h 00'); }
    finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});
test('notification failure is a warning on a successfully moved appointment', () => {
  assert.equal(appointmentConfirmation({ success: true, calendar_moved: true, notification_sent: false }, slot).notificationWarning, true);
  assert.equal(appointmentConfirmation({ success: true, calendar_moved: true, unchanged: true, notification_sent: null }, slot).notificationWarning, false);
});
test('lost response prompts verifying the same target, conflicts stay distinct', () => {
  for (const status of [undefined, 502, 503]) assert.equal(appointmentFailure({ status }).uncertain, true);
  assert.deepEqual(appointmentFailure({ status: 409, data: { detail: 'Occupé' } }), { uncertain: false, message: 'Occupé' });
});
