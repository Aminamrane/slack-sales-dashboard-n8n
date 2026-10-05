import test from 'node:test';
import assert from 'node:assert/strict';
import { assignedLabel, fmtBooked, fmtRdv, orderRdv } from './setterWebinarRdv.js';

test('the meeting date is the CRM wall time, never converted', () => {
  assert.equal(fmtRdv('2026-10-08T20:00:00'), 'jeu. 8 oct. · 20 h');
  assert.equal(fmtRdv('2026-03-09T14:30:00'), 'lun. 9 mars · 14 h 30');
  assert.equal(fmtRdv('2026-09-22T00:00:00'), 'mar. 22 sept.');                 // saisi sans heure
  assert.equal(fmtRdv(null), 'Date inconnue');
  assert.equal(fmtRdv('pas une date'), 'Date inconnue');
});

test('the booking instant is shown in Paris time', () => {
  assert.equal(fmtBooked('2026-09-30T22:30:00+00:00'), '1 oct.');
  assert.equal(fmtBooked(null), '');
});

test('assignment says who received the meeting, or why nobody did', () => {
  assert.equal(assignedLabel({ state: 'assigned', name: 'David Dubois' }), 'David Dubois');
  assert.equal(assignedLabel({ state: 'unassigned', name: null }), 'En attente d\'affectation');
  assert.equal(assignedLabel({ state: 'archived', name: null }), 'Lead archivé');
  assert.equal(assignedLabel(null), 'En attente d\'affectation');
});

test('upcoming meetings come first, soonest first, then the past ones, latest first', () => {
  const items = [
    { lead_id: 1, outcome: 'held', rdv_at: '2026-10-01T10:00:00' },
    { lead_id: 2, outcome: 'upcoming', rdv_at: '2026-10-09T10:00:00' },
    { lead_id: 3, outcome: 'to_qualify', rdv_at: '2026-10-04T10:00:00' },
    { lead_id: 4, outcome: 'upcoming', rdv_at: '2026-10-07T10:00:00' },
    { lead_id: 5, outcome: 'removed', rdv_at: null },
  ];
  assert.deepEqual(orderRdv(items).map((r) => r.lead_id), [4, 2, 3, 1, 5]);
  assert.deepEqual(orderRdv(null), []);
});
