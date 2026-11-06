// Date d'onboarding connue pour un lead : celle du lead, sinon (parcours guidé, entre la réservation et la déclaration) celle de la
// réservation de la partie 1 : la liste des leads ne se rafraîchit qu'au prochain passage de la synchro. Après la déclaration, et hors
// parcours guidé, rien ne change : seule la date du lead compte, comme avant.
export function onboardingDateOf(lead, journey) {
  if (lead?.rdv_onboarding_date) return lead.rdv_onboarding_date;
  const reservation = journey?.preparation;
  return journey?.onboarding_only && reservation && ['booked', 'pending_confirmation'].includes(reservation.status) ? (reservation.slot || '') : '';
}

// Wait for the journey response: an unknown new-flow lead must never briefly
// expose the legacy date PATCH while its finalized state is still loading.
// Une réservation confirmée (« booked ») porte déjà ses deux événements d'agenda : elle se reprogramme AVANT la
// déclaration de la vente (dev 2026-11-05). Tant qu'elle n'est pas confirmée (« pending_confirmation »), le serveur
// ne peut pas déplacer d'événement : la date s'affiche, la reprogrammation attend la confirmation.
export function canRescheduleAfterSale(lead, journey) {
  if (!journey) return false;
  if (journey.preparation && !['finalized', 'booked'].includes(journey.preparation.status)) return false;
  // Une réservation confirmée mais pas encore déclarée ne se reprogramme que dans le parcours guidé, qui l'a réservée : hors de ce parcours le
  // front reste ce qu'il était (le PATCH de date d'origine ne déplace aucun événement avant la déclaration).
  if (journey.preparation?.status === 'booked' && !journey.onboarding_only) return false;
  return !!(onboardingDateOf(lead, journey) || (!journey.onboarding_only && lead?.rdv_lancement_date));
}

// Date d'onboarding à AFFICHER sans pouvoir la modifier : réservation pas encore confirmée par les deux agendas.
export function onboardingAwaitingConfirmation(lead, journey) {
  return !!(journey?.onboarding_only && journey.preparation?.status === 'pending_confirmation' && onboardingDateOf(lead, journey));
}
