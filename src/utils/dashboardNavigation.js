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

// Page d'arrivée par rôle (même règle que Login.jsx). Les RH arrivent sur /ceo
// comme la direction financière depuis le 06/11/2026.
const ROLE_DASHBOARDS = {
  acquisition_director: "/acquisition-director",
  head_of_acquisition: "/acquisition-director",
};
// Dashboard d'un contexte de navigation (navScope posé par un dashboard de rôle).
// /rh-dashboard reste un contexte : qui l'ouvre y revient.
const SCOPE_DASHBOARDS = { ...ROLE_DASHBOARDS, hr: "/rh-dashboard" };

export function getDashboardRoute(role) {
  // En contexte de dashboard de rôle (navScope posé par HrDashboard /
  // AcquisitionDirectorDashboard), le "Dashboard" / retour renvoie au dashboard
  // de CE contexte, pas à /ceo. Sinon, le dashboard d'arrivée du rôle.
  let scope = null;
  try {
    scope = sessionStorage.getItem("navScope");
  } catch { /* noop */ }
  if (scope) return SCOPE_DASHBOARDS[scope] || "/ceo";
  return ROLE_DASHBOARDS[role] || "/ceo";
}

// Navigue vers la dashboard home du user. Si la home est /ceo et qu'un
// `ceoTabId` est fourni, on pose `localStorage.ceoActiveTab` pour que
// CeoDashboard pré-sélectionne cet onglet à son mount (pattern existant).
// Pour /acquisition-director, ceoTabId est ignoré (single-tab dashboard).
// Onglets qui ont leur propre route : toutes les vues /ceo/* retombent ici
// pour un onglet qu'elles ne connaissent pas, donc un seul endroit suffit.
// work_hours, sequences, optilex_board (06/11/2026) : quelques vues ne les routaient pas
// et ouvraient /ceo sur un onglet vide.
export const CEO_TAB_ROUTES = {
  meta_ads: "/ceo/meta-ads", bot_ia: "/ceo/Sub-Tickets", small_leads: "/ceo/leads-moins-100k", setters_stats: "/ceo/setters", acquisition_agenda: "/ceo/agenda",
  work_hours: "/ceo/work-hours", sequences: "/ceo/sequences", optilex_board: "/ceo/optilex-board",
  financial_analysis: "/ceo/analyse-financiere",
  optilex_automation: "/ceo/automatisation-missions",
};

export function navigateBackToDashboard(navigate, role, ceoTabId = null) {
  if (ceoTabId && CEO_TAB_ROUTES[ceoTabId]) { navigate(CEO_TAB_ROUTES[ceoTabId]); return; }
  const route = getDashboardRoute(role);
  if (route === "/ceo" && ceoTabId) {
    try { localStorage.setItem("ceoActiveTab", ceoTabId); } catch { /* noop */ }
  }
  navigate(route);
}
