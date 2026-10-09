import { onboardingPhaseOf } from './constants.js';
export function matchesLateOnboarding(row, choice, today = new Date()) {
  if (choice === 'all') return true;
  const past = onboardingPhaseOf(row, today) === 'past';
  return choice === 'past' ? past : !past;
}
export function matchesAnnualRenewal(row, scope, renewals) {
  const entities = renewals.get(row.client_id) || [];
  return scope === 'global' ? entities.length > 0 : entities.includes(scope);
}
