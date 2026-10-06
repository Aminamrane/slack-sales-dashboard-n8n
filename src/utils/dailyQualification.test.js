import test from 'node:test';
import assert from 'node:assert/strict';
import { rdvLabel, rdvsToQualify } from './dailyQualification.js';

const TODAY = '2026-10-07';

test('ne garde que les RDV des 7 jours précédents sans résultat', () => {
  const leads = [
    { id: 1, status: 'r1', r1: '2026-10-06T10:30:00+00:00', r1_result: null },
    { id: 2, status: 'r1', r1: '2026-10-07T09:00:00+00:00', r1_result: null },
    { id: 3, status: 'r1', r1: '2026-09-29T09:00:00+00:00', r1_result: null },
    { id: 4, status: 'r1', r1: '2026-10-06T14:00:00+00:00', r1_result: 'done' },
    { id: 5, status: 'r2', r2: '2026-10-05T16:00:00', r2_result: '' },
    { id: 6, status: 'r1', r1: '2026-10-02T11:00:00', r1_result: 'rescheduled' },
  ];
  assert.deepEqual(rdvsToQualify(leads, TODAY).map((r) => `${r.lead.id}:${r.stage}`), ['6:r1', '5:r2', '1:r1']);
});

test('un R2 reporté dont la nouvelle date est passée reste à qualifier, un R2 en attente non', () => {
  const leads = [
    { id: 7, status: 'r2', r2: '2026-10-03T10:00:00', r2_result: 'reporte' },
    { id: 8, status: 'r2', r2: '2026-10-03T11:00:00', r2_result: 'reflexion' },
    { id: 9, status: 'r3', r3: '2026-10-04T10:00:00', r3_result: null },
  ];
  assert.deepEqual(rdvsToQualify(leads, TODAY).map((r) => `${r.lead.id}:${r.stage}`), ['7:r2', '9:r3']);
});

test('ignore les leads signés et les dates absentes ou invalides', () => {
  const leads = [
    { id: 10, status: 'signed', r2: '2026-10-06T10:00:00', r2_result: null },
    { id: 11, status: 'r1', r1: null },
    { id: 12, status: 'r1', r1: 'n/a' },
  ];
  assert.deepEqual(rdvsToQualify(leads, TODAY), []);
});

test('lit aussi les champs r1_date / r2_date de l’API', () => {
  const leads = [{ id: 13, status: 'r1', r1_date: '2026-10-06T08:15:00+00:00', r1_result: null }];
  assert.equal(rdvsToQualify(leads, TODAY)[0].at, '2026-10-06T08:15');
});

test('libellé en heure-mur, sans conversion', () => {
  assert.equal(rdvLabel('2026-10-06T08:05'), 'mardi 6 octobre à 8 h 05');
  assert.equal(rdvLabel(''), '');
});
