// Bandes de la météo client (note 1-5 posée sur le board) : une seule définition,
// réexportée par components/meteo.jsx. Module sans JSX pour être lisible par les
// tests node (statistiques du dashboard CEO).
export const METEO_BANDS = {
  rouge:  { label: "Critique",  color: "#dc2626", bg: "#fdecec", dot: "#dc2626" },
  orange: { label: "Mécontent", color: "#d97706", bg: "#fff3e3", dot: "#d97706" },
  vert:   { label: "Satisfait", color: "#15a34a", bg: "#e9f9ef", dot: "#15a34a" },
};
export const meteoBandOf = (score) => (score == null ? null : score <= 2 ? "rouge" : score === 3 ? "orange" : "vert");
