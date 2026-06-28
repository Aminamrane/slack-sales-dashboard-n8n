// src/utils/sidebarPermissions.js
//
// Filtre des sections sidebar selon le rôle utilisateur. Partagé entre
// AcquisitionDirectorDashboard et les 3 wrappers d'embed CEO
// (CeoSheetView, CeoDispatchView, CeoLeaderboardView) pour qu'un
// Acquisition Director qui rejoint une de ces routes garde une sidebar
// cohérente avec ses permissions (pas la sidebar CEO complète).
//
// Pattern hardcoded — quand `role_permissions` devient la source de
// vérité pour la nav, remplacer par un fetch ou un lookup.

const ROLE_SECTIONS = {
  acquisition_director: new Set(["recent", "acquisition"]),
  head_of_acquisition: new Set(["recent", "acquisition"]),
  hr: new Set(["recent", "human", "acquisition"]),  // RH : coin Humain (Congés + Variables) + tout l'Acquisition
};

/**
 * Retourne la liste des sections autorisées pour ce rôle.
 * Si aucune restriction n'est définie pour le rôle, on retourne la
 * liste complète (admin / ceo / marketing voient tout).
 */
export function getVisibleSections(allSections, role) {
  const allowed = ROLE_SECTIONS[role];
  if (!allowed) return allSections;
  return allSections.filter((s) => allowed.has(s.key));
}

export function isAcquisitionOnly(role) {
  return ROLE_SECTIONS[role] !== undefined;
}
