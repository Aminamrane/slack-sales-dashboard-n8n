import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedInstallment } from './installmentFollowup.js';
import { matchesLateOnboarding, matchesAnnualRenewal } from './followupFilters.js';
import { installmentSubline } from './installmentLabel.js';

test('a confirmed Owner installment does not settle OptiLex or modify receipts', () => {
  const p = {id: 'p1', expected_owner: 100, received_owner: 0, expected_optilex_ttc: 40, received_optilex_ttc: 0};
  const before = JSON.stringify(p);
  const reviews = [{period_id:'p1', entity:'owner', regularized:true}];
  assert.equal(reviewedInstallment(p, 'owner', reviews), true);
  assert.equal(reviewedInstallment(p, 'global', reviews), false);
  assert.equal(reviewedInstallment(p, 'optilex', reviews), false);
  assert.equal(reviewedInstallment(p, 'owner', [{...reviews[0], regularized:false}]), false);
  assert.equal(reviewedInstallment({...p, received_optilex_ttc:40}, 'global', reviews), true);
  assert.equal(reviewedInstallment({...p, received_optilex_ttc:40}, 'global', reviews, {optilex:10}), false);
  assert.equal(reviewedInstallment({...p, id:'p2'}, 'owner', reviews), false);
  assert.equal(JSON.stringify(p), before);
  assert.match(installmentSubline({status:'regularized', month:'2026-09'}), /régularisation confirmée/);
});
test('late onboarding subfilter partitions past vs upcoming and missing', () => {
  const today = new Date(2026, 9, 9);
  for (const raw of ['2026-10-08','2026-10-09']) {
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'past', today), true);
  }
  for (const raw of ['2026-10-10', null, 'invalide']) {
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'not_past', today), true);
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'past', today), false);
  }
});
test('renewal filter respects selected entity and server eligibility', () => {
  const map = new Map([[17, ['optilex']]]);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'owner', map), false);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'optilex', map), true);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'global', map), true);
  assert.equal(matchesAnnualRenewal({client_id:18}, 'global', map), false);
});
