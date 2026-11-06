// readOnlyAccess.test.js — la Finance s'ouvre aux RH (rôle hr) en lecture seule
// (dev 06/11/2026) : ils consultent tout, aucune garde d'écriture ne s'allume
// pour eux. Les autres rôles gardent exactement leurs droits.
//
// Lancement : `npm test` (fichier cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_ROLES, canWriteFinance, canEditContract, canEditAmounts, canProposeAmounts,
} from './constants.js';
import { canEditPaymentDates, paymentDateIdentity } from './paymentDateAccess.js';

test('hr ouvre la page Finance', () => {
  assert.ok(ALLOWED_ROLES.includes('hr'));
});

test('hr : toutes les gardes d\'écriture renvoient faux', () => {
  assert.equal(canWriteFinance('hr'), false);
  assert.equal(canEditContract('hr'), false);
  assert.equal(canEditAmounts('hr'), false);
  assert.equal(canProposeAmounts('hr'), false);
  const user = { id: 'rh-1', role: 'hr' };
  // Même avec une réponse d'accès favorable, les dates de paiement restent fermées.
  assert.equal(canEditPaymentDates(user, { identity: paymentDateIdentity(user), allowed: true }), false);
  assert.equal(canEditPaymentDates(user, null), false);
});

test('les rôles qui écrivaient gardent leurs droits', () => {
  assert.deepEqual(ALLOWED_ROLES.filter((r) => r !== 'hr'), ['admin', 'ceo', 'finance_director', 'finance_team']);
  for (const role of ['admin', 'ceo', 'finance_director']) {
    assert.equal(canWriteFinance(role), true, role);
    assert.equal(canEditContract(role), true, role);
    assert.equal(canEditAmounts(role), true, role);
    assert.equal(canProposeAmounts(role), false, role);
  }
  // Équipe finance : la fiche et les commentaires, pas les montants (demandes à valider).
  assert.equal(canWriteFinance('finance_team'), true);
  assert.equal(canEditContract('finance_team'), true);
  assert.equal(canEditAmounts('finance_team'), false);
  assert.equal(canProposeAmounts('finance_team'), true);
});

test('les rôles sans accès à la page ne gagnent rien', () => {
  for (const role of ['sales', 'customer_success_manager', 'marketing', 'acquisition_director', 'head_of_acquisition', undefined]) {
    assert.equal(ALLOWED_ROLES.includes(role), false, String(role));
    assert.equal(canWriteFinance(role), false, String(role));
    assert.equal(canEditContract(role), false, String(role));
  }
});
