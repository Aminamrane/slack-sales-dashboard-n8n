// lossPreview.test.js : le reste du contrat s'arrête à l'échéance du contrat.
//
// Retour dev 2026-09-30, n°255 PASTEL BAKERY : signée le 10/10/2025, résiliation
// le 10/10/2026 (jour de l'anniversaire). La fenêtre de perte annonçait 5 mois
// (1 725 €) ; seul octobre restait dû au contrat.
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { lossPreview } from './lossPreview.js';

const month = (period, owner, optilex, paidOwner = 0, paidOptilex = 0) => ({
  period, expected_owner: owner, expected_optilex_ttc: optilex,
  received_owner: paidOwner, received_optilex_ttc: paidOptilex,
});

const pastel = [
  month('2025-10-01', 165, 180),                // impayé : créance antérieure
  month('2026-09-01', 165, 180, 165, 180),      // mois en cours, réglé
  month('2026-10-01', 165, 180),
  month('2026-11-01', 165, 180),
  month('2026-12-01', 165, 180),
  month('2027-01-01', 165, 180),
  month('2027-02-01', 165, 180),
];
const now = new Date(2026, 8, 30);

test("le reste du contrat s'arrête à l'anniversaire : 1 mois, pas 5", () => {
  const out = lossPreview(pastel, { now, contractEnd: '2026-10-10' });
  assert.deepEqual(out.past, { amount: 345, months: 1 });
  assert.deepEqual(out.current, { amount: 0, months: 0 });
  assert.deepEqual(out.future, { amount: 345, months: 1 });
});

test("sans échéance connue, tous les mois à venir comptent (comme avant)", () => {
  assert.deepEqual(lossPreview(pastel, { now }).future, { amount: 1725, months: 5 });
});
