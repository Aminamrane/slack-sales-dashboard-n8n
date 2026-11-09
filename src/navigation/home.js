// Page d'arrivée de chaque rôle : celle où mène la connexion, et le bouton « Accueil » du menu de gauche.
// Une seule règle pour les deux (09/11/2026). Rôle absent de la liste : le Suivi des ventes (« / »).
export const HOME_BY_ROLE = {
  ceo: "/ceo",
  finance_director: "/ceo",
  acquisition_director: "/acquisition-director",
  head_of_acquisition: "/acquisition-director",
  hr: "/ceo", // RH : les pages de la direction financière, en lecture seule (06/11/2026)
  customer_success_manager: "/ceo/leaderboard",
};

export const homeRouteFor = (role) => HOME_BY_ROLE[role] || "/";
