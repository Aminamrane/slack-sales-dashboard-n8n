// Libellés des rôles affichés sous le nom de la personne (menu de gauche). Mêmes intitulés que la navbar.
export const ROLE_LABELS = {
  admin: "Admin",
  sales: "Sales",
  head_of_sales: "Head of Sales",
  head_of_sales_manager: "Head of Sales Manager",
  setter: "Setter",
  setter_manager: "Setter Manager",
  ceo: "CEO",
  tech: "Tech",
  marketing: "Marketing",
  hr: "HR",
  finance_director: "Finance Director",
  finance_team: "Finance",
  customer_success_manager: "Customer Success Manager",
  acquisition_director: "Acquisition Director",
  head_of_acquisition: "Head of Acquisition",
};

export const roleLabel = (role) => ROLE_LABELS[role] || role || "Membre";

// Sous le nom : le poste de la personne quand il est renseigné, sinon le libellé de son rôle. Le rôle garde les accès.
export const userTitle = (user) => (user?.job_title || "").trim() || roleLabel(user?.role);
