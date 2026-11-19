// freeMonth.test.js — le mois offert pour parrainage (dev 2026-11-19).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { freeMonthBody, freeMonthChoices, FREE_MONTH_LABEL } from './freeMonth.js';

const row = (period, eo, ex, ro = null, rx = null, mode = null) => ({
  period, expected_owner: eo, expected_optilex_ttc: ex, received_owner: ro, received_optilex_ttc: rx, payment_mode: mode,
});

test('propose les échéances à venir, attendues et pas encore payées, dans l’ordre', () => {
  const periods = [
    row('2027-01-01', 198, 96),
    row('2026-10-01', 198, 96),            // passé
    row('2026-11-01', 198, 96, 198, 96),   // déjà payé
    row('2026-12-01', 198, 96),
    row('2027-02-01', 0, 0),               // rien d'attendu
  ];
  assert.deepEqual(freeMonthChoices(periods, { nowKey: '2026-11' }), [
    { key: '2026-12', owner: 198, optilex: 96 },
    { key: '2027-01', owner: 198, optilex: 96 },
  ]);
});

test('un mois payé en partie n’est pas proposé', () => {
  assert.deepEqual(freeMonthChoices([row('2026-12-01', 198, 96, null, 96)], { nowKey: '2026-11' }), []);
});

test('jamais d’échéance annuelle ou trimestrielle', () => {
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 5760, 1728)], { clientMode: 'Annuel', nowKey: '2026-11' }), []);
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 5760, 1728, null, null, 'YEARLY')], { nowKey: '2026-11' }), []);
});

test('au plus douze échéances proposées', () => {
  const periods = Array.from({ length: 15 }, (_, i) => row(`2027-${String(i + 1).padStart(2, '0')}-01`, 198, 96));
  assert.equal(freeMonthChoices(periods, { nowKey: '2026-11' }).length, 12);
});

test('le geste envoyé : Owner et Opti’Lex à 0 € sur le mois, réduction de 100 % nommée', () => {
  assert.deepEqual(freeMonthBody('2026-12'), {
    entries: [{ period: '2026-12', owner: 0, optilex: 0 }],
    reason: FREE_MONTH_LABEL,
    kind: 'discount',
    discount_label: FREE_MONTH_LABEL,
    discount_percent: 100,
  });
});
