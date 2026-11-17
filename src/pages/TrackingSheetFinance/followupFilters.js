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
// Clients rétractés (actés ou en cours) : ils ne doivent rien et ne seront pas
// onboardés, donc ni « Retard du mois » ni « Onboarding » (dev 17/11/2026).
const RETRACTED_ETATS = new Set(['Rétractation', 'En cours de rétractation']);
export function isRetractedEtat(displayedState) {
  return RETRACTED_ETATS.has(displayedState);
}
