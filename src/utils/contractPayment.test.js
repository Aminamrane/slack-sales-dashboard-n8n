import test from 'node:test';
import assert from 'node:assert/strict';
import { signedContractPaymentMode } from './contractPayment.js';
test('new monthly agreement locks monthly; legacy keeps its choices', () => {
  assert.equal(signedContractPaymentMode([{yousign_status:'done',payment_mode:'MONTHLY'}]),'MONTHLY');
  assert.equal(signedContractPaymentMode([{yousign_status:'done'}]),null);
  assert.equal(signedContractPaymentMode([]),null);
});
test('an unsigned replacement cannot change the signed agreement', () => {
  assert.equal(signedContractPaymentMode([{yousign_status:'ongoing',payment_mode:'MONTHLY',created_at:'2026-10-06'}, {yousign_status:'done',created_at:'2026-09-01'}]),null);
});
test('latest signature, then creation time, selects the policy', () => {
  assert.equal(signedContractPaymentMode([{yousign_status:'done',signed_at:'2026-10-01',created_at:'2026-09-30'}, {yousign_status:'done',signed_at:'2026-10-06',created_at:'2026-10-05',payment_mode:'MONTHLY'}]),'MONTHLY');
});
