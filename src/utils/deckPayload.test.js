import test from 'node:test';
import assert from 'node:assert/strict';
import { deckPayload, needsDeckDate } from './deckPayload.js';

test('absent : il faut choisir de relancer ou non ; le choix part dans la qualification', () => {
  assert.equal(deckPayload('r1', { choice: 'no_show' }), null);
  assert.deepEqual(deckPayload('r1', { choice: 'no_show', relance: 'relance' }), { result: 'no_show', attended: false, date: '', relance: true });
  assert.deepEqual(deckPayload('r2', { choice: 'no_show', relance: 'silence' }), { result: 'no_show', attended: false, date: '', relance: false });
});

test('reporté : nouvelle date maintenant, ou à reporter sans date', () => {
  assert.equal(deckPayload('r1', { choice: 'rescheduled' }), null);
  assert.equal(deckPayload('r1', { choice: 'rescheduled', when: 'date' }), null);
  assert.deepEqual(deckPayload('r1', { choice: 'rescheduled', when: 'date', date: '2026-10-21T14:30' }), { result: 'rescheduled', attended: false, date: '2026-10-21T14:30' });
  assert.deepEqual(deckPayload('r1', { choice: 'rescheduled', when: 'later' }), { result: 'to_reschedule', attended: false, date: '' });
  assert.deepEqual(deckPayload('r2', { choice: 'reporte', when: 'later' }), { result: 'a_reporter', attended: false, date: '' });
  assert.equal(needsDeckDate('r2', { choice: 'reporte', when: 'date' }), true);
  assert.equal(needsDeckDate('r2', { choice: 'reporte', when: 'later' }), false);
});

test('les autres choix ne changent pas', () => {
  assert.deepEqual(deckPayload('r1', { choice: 'done', next: 'later' }), { result: 'done', attended: true, date: '', followUp: 'later' });
  assert.equal(deckPayload('r1', { choice: 'done', next: 'r2_set' }), null);
  assert.equal(needsDeckDate('r1', { choice: 'done', next: 'r2_set' }), true);
  assert.deepEqual(deckPayload('r1', { choice: 'cancelled' }), { result: 'cancelled', attended: false, date: '' });
  assert.deepEqual(deckPayload('r2', { choice: 'present', result: 'reflexion' }), { result: 'reflexion', attended: true, date: '' });
  assert.deepEqual(deckPayload('r2', { choice: 'annule' }), { result: 'annule', attended: false, date: '' });
});
