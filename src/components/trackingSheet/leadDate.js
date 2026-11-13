// Date d'un lead en clair : « 07 nov. 2026 ». La date est lue sur la chaîne (jour de Paris), sans conversion d'heure.
export const formatLeadDate = (d) => {
  if (!d) return null;
  const date = new Date(d.slice(0,10)+'T12:00:00Z');
  return date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
};
