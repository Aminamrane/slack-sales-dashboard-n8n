import apiClient from "../services/apiClient";

// URL absolue d'un asset servi par l'API (/uploads/...) : créas des campagnes, vignettes.
export const mediaUrl = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${apiClient.baseUrl}${p}`;
};
