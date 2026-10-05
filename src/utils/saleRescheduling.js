// Wait for the journey response: an unknown new-flow lead must never briefly
// expose the legacy date PATCH while its finalized state is still loading.
export function canRescheduleAfterSale(lead, journey) {
  if (!journey) return false;
  if (journey.preparation && journey.preparation.status !== 'finalized') return false;
  return !!(lead?.rdv_onboarding_date || (!journey.onboarding_only && lead?.rdv_lancement_date));
}
