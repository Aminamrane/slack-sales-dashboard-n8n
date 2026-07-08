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
  // CSM (Vincent) : Leaderboard (page d'arrivée) + Funnel Leads + Board Owner/Opti'Lex.
  customer_success_manager: new Set(["acquisition", "produit"]),
};

// Filtre au niveau ONGLET (optionnel) : certains rôles n'ont qu'une partie des
// onglets d'une section. rôle -> { sectionKey: Set(itemIds) }. Une section
// autorisée sans entrée ici garde tous ses onglets.
const ROLE_ITEMS = {
  customer_success_manager: {
    acquisition: new Set(["leaderboard", "funnel_leads"]),
    produit: new Set(["optilex_board"]),
  },
};

// ── Scope de navigation persistant (sessionStorage) ────────────────
// Les vues /ceo/* sont PARTAGÉES entre contextes (CEO, RH, Acquisition) et
// filtrent la sidebar selon le rôle du viewer -> un admin/ceo y voit TOUT.
// Pour qu'un dashboard de rôle (ex: RH) reste scopé à CE rôle même quand un
// admin/ceo navigue dans ses sous-vues, le dashboard pose un `navScope` ;
// les vues le lisent en priorité sur le rôle réel. Le dashboard CEO (vue
// "tout") le nettoie. sessionStorage -> pas de fuite entre onglets/sessions.
export function setNavScope(scope) {
  try {
    if (scope) sessionStorage.setItem("navScope", scope);
    else sessionStorage.removeItem("navScope");
  } catch { /* noop */ }
}

/**
 * Retourne la liste des sections autorisées pour ce rôle (ou le navScope
 * actif s'il est posé). Si aucune restriction, on retourne la liste complète
 * (admin / ceo / marketing voient tout).
 */
export function getVisibleSections(allSections, role) {
  let effective = role;
  try {
    const scope = sessionStorage.getItem("navScope");
    if (scope) effective = scope;
  } catch { /* noop */ }
  const allowed = ROLE_SECTIONS[effective];
  if (!allowed) return allSections;
  const itemsFilter = ROLE_ITEMS[effective];
  return allSections
    .filter((s) => allowed.has(s.key))
    .map((s) => {
      const f = itemsFilter && itemsFilter[s.key];
      if (!f) return s;
      return { ...s, items: (s.items || []).filter((it) => f.has(it.id)) };
    })
    // Une section vidée par le filtre d'onglets ne s'affiche pas.
    .filter((s) => (s.items || []).length > 0);
}

export function isAcquisitionOnly(role) {
  return ROLE_SECTIONS[role] !== undefined;
}
