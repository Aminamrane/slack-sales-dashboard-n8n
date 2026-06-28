// src/utils/dashboardNavigation.js
//
// Centralise le "retour au dashboard" depuis n'importe quel wrapper /ceo/*.
// L'idée : selon le rôle, la home dashboard n'est pas la même :
//   - admin / ceo                       → /ceo (CeoDashboard, multi-onglets internes)
//   - acquisition_director / head_of_acquisition → /acquisition-director
//
// Sans ce helper, chaque wrapper faisait `navigate("/ceo")` en fallback,
// ce qui claquait /login pour AcqDir (CeoDashboard auth gate strict
// admin|ceo). Bug constaté 2026-06-03 par dev.

const ROLE_DASHBOARDS = {
  acquisition_director: "/acquisition-director",
  head_of_acquisition: "/acquisition-director",
  hr: "/rh-dashboard",
};

export function getDashboardRoute(role) {
  return ROLE_DASHBOARDS[role] || "/ceo";
}

// Navigue vers la dashboard home du user. Si la home est /ceo et qu'un
// `ceoTabId` est fourni, on pose `localStorage.ceoActiveTab` pour que
// CeoDashboard pré-sélectionne cet onglet à son mount (pattern existant).
// Pour /acquisition-director, ceoTabId est ignoré (single-tab dashboard).
export function navigateBackToDashboard(navigate, role, ceoTabId = null) {
  const route = getDashboardRoute(role);
  if (route === "/ceo" && ceoTabId) {
    try { localStorage.setItem("ceoActiveTab", ceoTabId); } catch { /* noop */ }
  }
  navigate(route);
}
