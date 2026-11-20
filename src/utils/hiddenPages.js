// src/utils/hiddenPages.js
//
// Pages retirées des menus (dev 19/11/2026 : « retire pas réellement, enlève juste la visibilité pour tout le monde »).
// Seule la VISIBILITÉ dans la navigation change : les pages, leurs routes et leur code restent en place, et une adresse
// directe ouvre toujours la page. La liste porte les ids d'onglet du menu du CEO (SIDEBAR_SECTIONS) : le même id sert
// aux entrées des autres menus (« Mes pages », menu des tracking sheets, barre du haut).
//
// Pour rendre une page de nouveau visible : retirer sa ligne ici, rien d'autre à toucher.

// Masquées pour tout le monde : Qualité Leads, Funnel Leads, Auto-affectation, Leads < 100 k€.
export const HIDDEN_FOR_ALL = new Set(["lead_quality", "funnel_leads", "autoassign", "small_leads"]);

// Masquée sauf pour les rôles listés : « Gestion des leads » ne reste visible que pour les comptes admin (la direction
// technique). Aucun nom ni aucune adresse ici : le dépôt est public, et la garde qui fait foi reste celle de la page et de l'API.
export const VISIBLE_ONLY_TO = new Map([["leads_management", new Set(["admin"])]]);

// `role` : le rôle de la personne connectée ; dans le menu d'un dashboard de rôle (navScope), le rôle de ce périmètre : un admin
// y voit la barre de ce rôle, comme pour tous les autres filtres de `sidebarPermissions.js`.
export function isHiddenTab(tab, role) {
  if (HIDDEN_FOR_ALL.has(tab)) return true;
  const only = VISIBLE_ONLY_TO.get(tab);
  return only ? !only.has(role) : false;
}

// Sections du menu du CEO ({ items: [{ id }] }) sans les onglets masqués ; les séparateurs sans `items` passent tels quels.
export function withoutHiddenTabs(sections, role) {
  return sections.map((s) => (s.items ? { ...s, items: s.items.filter((it) => !isHiddenTab(it.id, role)) } : s));
}
