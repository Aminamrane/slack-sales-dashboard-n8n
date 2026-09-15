// Exact accounts requested on 15 September; never hide navigation by first name or role.
const DASHBOARD_ONLY_USERS = new Set([
  '6b32dc17-528d-4e01-b955-2c49a5f44b6a', // Paul
  '94b5dcc1-a1bb-41ac-94fe-14cf047cffef', // Ismahane
  '868ef35d-2a9f-4216-8109-4f6ccf3f780c', // Gaylord
  'b9b6ca8c-7f87-4774-896b-a5fbb274ed28', // Mohamed
  'f6c461ae-5e38-473a-8fbf-dca601ded016', // Timothy
  '94db551c-f464-4360-a1c6-cbfd054055bd', // Faical Rahali
]);

export const usesDashboardOnlyNavbar = (user) => DASHBOARD_ONLY_USERS.has(user?.id);
