// Qualification UI and mandatory intake are separate decisions: an old sent
// contract may exempt intake without removing qualification and R2 planning.
export function hasGuidedSalesJourney(rollout, lead, context) {
  if (!rollout?.available || !lead?.id) return false;
  if (context?.required || rollout.enabled) return true;
  return !!rollout.can_manage && !!rollout.pilot_enabled
    && (lead.assigned_to || '').trim().toLowerCase() === 'y.amrane@ownertechnology.com';
}
