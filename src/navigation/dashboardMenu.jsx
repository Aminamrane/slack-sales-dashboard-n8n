/* eslint-disable react-refresh/only-export-components -- module de données (icônes en JSX), aucun composant ici */
// Menu de gauche des tableaux de bord : une seule liste pour tous les rôles qui en ont un (CEO, admin, direction
// financière, RH, acquisition, Client Success). Chaque rôle n'en voit que sa part (`getVisibleSections`).
// Sorti de CeoDashboard.jsx le 21/11/2026 pour que les pages hors tableau de bord affichent le même menu sans charger
// tout le tableau de bord (dev : « le menu à gauche ne doit pas changer en fonction des pages où on va »).
import { getVisibleSections } from "../utils/sidebarPermissions";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { HOME_BY_ROLE } from "./home.js";

// ── SIDEBAR TABS ──────────────────────────────────────────────────────────
export const SIDEBAR_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  )},
  // Sa propre Tracking Sheet (demande dev 2026-09-30 : la direction envoie aussi des contrats).
  // Réservée ceo/admin (ITEM_ROLE_GATE) : la page refuse les autres rôles sans l'accès.
  { key: 'my_tracking_sheet', label: 'Ma Tracking Sheet', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
  )},
  { section: 'HUMAN' },
  { key: 'conges', label: 'Absence', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )},
  { key: 'variables', label: 'Variables Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  )},
  { key: 'work_hours', label: 'Heures de travail', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
  )},
  { section: 'ACQUISITION' },
  // Dashboard Leads (dev 18/11/2026) : les leads reçus par canal, jour par jour, le travail des setters, Meta.
  { key: 'leads_dashboard', label: 'Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
  )},
  { key: 'perf_sales', label: 'Perf Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
  { key: 'lead_quality', label: 'Qualité Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
  )},
  { key: 'leaderboard', label: 'Leaderboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )},
  { key: 'sales_team', label: 'Équipe Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  // RDV posés par les setters (CRM, lien webinaire) et clients amenés au mois de signature (05/10).
  // Icône : casque-micro, l'outil du setter (appels et prise de RDV). Page « Perf Setter » depuis le 30/10 (comme « Perf Sales »).
  { key: 'setters_stats', label: 'Perf Setters', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>
  )},
  // Agenda des RDV de l'équipe, jour par jour et par commercial : suivis par un setter ou à relancer
  // par la direction (05/10). Icône : calendrier avec une coche.
  { key: 'acquisition_agenda', label: 'Agenda des RDV', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
  )},
  { key: 'sales_recordings', label: 'Enregistrement sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
  )},
  { key: 'webinar', label: 'Webinaire', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  )},
  // Même mégaphone que l'en-tête de la page Meta Ads (MetaAds/icons.jsx « ads »).
  { key: 'meta_ads', label: 'Meta Ads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.6 10.2v3.6a1.6 1.6 0 001.6 1.6h2.2l6.4 3.6V5l-6.4 3.6H5.2a1.6 1.6 0 00-1.6 1.6z"/><path d="M17 9.4a3.4 3.4 0 010 5.2"/><path d="M19.4 7a6.6 6.6 0 010 10"/></svg>
  )},
  // « Campagnes » sert aux sales (les publicités) : rangé avec l'acquisition, plus dans la Finance (demande du 26/10/2026).
  { key: 'campaigns', label: 'Campagnes', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  )},
  { key: 'funnel_leads', label: 'Funnel Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  )},
  { key: 'leads_management', label: 'Gestion des leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  // Leads qui ont déclaré moins de 100 000 € de CA, la plupart non affectés (29/09).
  { key: 'small_leads', label: 'Leads < 100 k€', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  )},
  { key: 'autoassign', label: 'Auto-affectation', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  )},
  { key: 'sequences', label: 'Séquences email', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  )},
  // Sub Tickets : demandes des opérationnels (landing pages, séquences),
  // traitées par l'agent interne. Onglet réservé par rôle (sidebarPermissions).
  { key: 'bot_ia', label: 'Sub Tickets', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></svg>
  )},
  { section: 'FINANCE' },
  // « Suivi des paiements » : l'ancien onglet « Finance », à côté de « Analyse financière » (demande du 26/10/2026).
  { key: 'dispatch', label: 'Suivi des paiements', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  )},
  // Analyse financière : durée de vie des clients, résiliations, niches (17/11). Icône : caisse enregistreuse.
  { key: 'financial_analysis', label: 'Analyse financière', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="6" rx="1"/><path d="M12 9v4"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 17h.01"/><path d="M12 17h.01"/><path d="M17 17h.01"/></svg>
  )},
  { section: 'PRODUIT' },
  { key: 'optilex_board', label: "Board Owner/Opti'Lex", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
  )},
  { key: 'optilex_automation', label: 'Automatisation des missions', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
  )},
];

// ── Mapping SIDEBAR_TABS → sections (format Notion-style Sidebar) ─────────
// SIDEBAR_TABS est un flat array avec separators `{ section: 'NAME' }`. Le
// composant Sidebar attend `[{ key, label, items: [{ id, label, icon }] }]`.
// Les items avant le premier separator sont regroupés dans une section
// "Récentes" (équivalent du pattern TSF). Chaque `{ section }` ouvre une
// nouvelle section dont le label devient le suivant.
export const SIDEBAR_SECTIONS = (() => {
  const sections = [];
  let current = { key: 'recent', label: 'Récentes', items: [] };
  SIDEBAR_TABS.forEach((entry) => {
    if (entry.section) {
      if (current.items.length) sections.push(current);
      current = { key: entry.section.toLowerCase(), label: entry.section, items: [] };
    } else {
      current.items.push({ id: entry.key, label: entry.label, icon: entry.icon });
    }
  });
  if (current.items.length) sections.push(current);
  return sections;
})();

// Onglets de la barre latérale qui sont des routes à part entière (vues /ceo/*).
export const DASHBOARD_TAB_ROUTES = {
  dispatch: '/ceo/dispatch', leaderboard: '/ceo/leaderboard', perf_sales: '/ceo/perf-sales', lead_quality: '/ceo/lead-quality',
  webinar: '/ceo/webinar', funnel_leads: '/ceo/funnel-leads', leads_management: '/ceo/leads-management', small_leads: '/ceo/leads-moins-100k',
  setters_stats: '/ceo/setters', acquisition_agenda: '/ceo/agenda', autoassign: '/ceo/auto-affectation', sequences: '/ceo/sequences',
  variables: '/ceo/variables', conges: '/ceo/conges', work_hours: '/ceo/work-hours', campaigns: '/ceo/campaigns',
  my_tracking_sheet: '/tracking-sheet', optilex_board: '/ceo/optilex-board', sales_recordings: '/ceo/sales-recordings',
  meta_ads: '/ceo/meta-ads', bot_ia: '/ceo/Sub-Tickets', financial_analysis: '/ceo/analyse-financiere',
  optilex_automation: '/ceo/automatisation-missions', leads_dashboard: '/ceo/leads',
};

// Les rôles qui ont un tableau de bord (leur page d'arrivée en est un, et l'admin) : leur menu reste le même sur
// toutes les pages, y compris hors tableau de bord. Les autres rôles gardent « Mes pages ».
export const hasDashboardMenu = (role) => role === "admin" || Object.prototype.hasOwnProperty.call(HOME_BY_ROLE, role);

// Le menu du tableau de bord tel que le rôle le voit, mêmes règles que les vues /ceo/*.
export const dashboardMenuSections = (role) => getVisibleSections(SIDEBAR_SECTIONS, role);

// L'onglet du menu qui correspond à une page (pour le surligner), s'il y en a un.
export function dashboardTabForPath(pathname) {
  return Object.entries(DASHBOARD_TAB_ROUTES).find(([, route]) => route === pathname)?.[0] || null;
}

// Un clic dans le menu, hors tableau de bord : la page de l'onglet si elle a sa route, sinon le tableau de bord ouvert
// sur cet onglet (même chemin que les vues /ceo/*).
export function openDashboardTab(navigate, role, tabId) {
  const route = DASHBOARD_TAB_ROUTES[tabId];
  if (route) { navigate(route); return; }
  navigateBackToDashboard(navigate, role, tabId);
}

// La Finance est un onglet de son tableau de bord (admin, CEO, direction financière, RH) : /tracking-finance l'y ouvre.
export const financeInDashboard = (role) => hasDashboardMenu(role)
  && dashboardMenuSections(role).some((section) => (section.items || []).some((item) => item.id === "dispatch"));
