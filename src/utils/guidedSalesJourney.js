// Qualification UI and mandatory intake are separate decisions: an old sent
// contract may exempt intake without removing qualification and R2 planning.
// Pilote privé : le serveur ne donne `can_manage` qu'au compte pilote ; le parcours guidé vaut alors pour ses propres
// leads, ceux qui lui sont assignés. Aucune adresse n'est écrite ici (dépôt public) : on compare au compte connecté.
export function hasGuidedSalesJourney(rollout, lead, context, viewerEmail) {
  if (!rollout?.available || !lead?.id) return false;
  if (context?.required || rollout.enabled) return true;
  const viewer = (viewerEmail || '').trim().toLowerCase();
  return !!rollout.can_manage && !!rollout.pilot_enabled && !!viewer
    && (lead.assigned_to || '').trim().toLowerCase() === viewer;
}
