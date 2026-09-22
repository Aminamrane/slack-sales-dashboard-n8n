import test from 'node:test';
import assert from 'node:assert/strict';
import {contactQualificationPatch} from './contactQualification.js';
const lead = {id: 1, status: 'new', email: 'fixture@example.invalid'};
const patch = (values, category = 'new', source = lead) => contactQualificationPatch(source, category, values, '2026-09-22');
test('contact outcomes preserve the existing statuses and create no appointments', () => {
  for (const [result, status] of [['voicemail','voicemail'],['not_relevant','not_relevant'],['not_processable','not_relevant'],['unreachable','unreachable']]) {
    assert.deepEqual(patch({result, date:'2026-09-24T10:00'}), {first_contact_date:'2026-09-22', contact_result:result, status});
  }
  assert.deepEqual(patch({result:'reached',next:'callback'}), {first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'no_appointment',status:'callback'});
  assert.deepEqual(patch({result:'reached',next:'not_interested'}), {first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'not_interested',status:'not_relevant'});
});
test('only the explicitly selected appointment is created, never a fictitious R1 for a direct R2', () => {
  for (const next of ['r1','r2']) assert.deepEqual(patch({result:'reached',next,date:'2026-09-24T10:35'}), {
    first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'appointment_set',status:next,[`${next}_date`]:'2026-09-24T10:35',
  });
});
test('missing/invalid dates, Paris spring gap and missing email cannot schedule a meeting', () => {
  for (const date of ['', '2026-09-24', '2026-02-30T10:00', '2027-03-28T02:30']) assert.throws(() => patch({result:'reached',next:'r1',date}));
  assert.throws(() => patch({result:'reached',next:'r2',date:'2026-09-24T10:00'},'new',{...lead,email:''}));
  assert.throws(() => patch({result:'reached',next:'r1',date:'2026-09-24T10:00'},'new',{...lead,email:'  '}));
});
test('recontact attempts preserve the original first contact, tab and backend call hook', () => {
  for (const category of ['callback','voicemail']) for (const values of [{result:'voicemail'}, {result:'reached',next:'callback'}]) {
    assert.deepEqual(patch(values, category, {...lead,call_attempts:3,first_contact_date:'2026-08-01T09:00:00'}), {
      first_contact_date:'2026-08-01', call_attempts:4, status:category,
    });
  }
});
test('a reminder carries only its date, and cannot manufacture appointments', () => {
  assert.deepEqual(patch({result:'to_recontact',date:'2026-10-02'}), {first_contact_date:'2026-09-22',status:'to_recontact',recontact_date:'2026-10-02'});
  for (const date of ['', '2026-02-30','2026-10-02T09:00']) assert.throws(() => patch({result:'to_recontact',date}));
});
test('unknown choices or an incompatible stage cannot change the pipeline', () => {
  assert.throws(() => patch({result:''}));
  assert.throws(() => patch({result:'reached',next:'contract'}));
  assert.throws(() => patch({result:'reached',next:'r1',date:'2026-09-24T10:00'},'signed'));
});
