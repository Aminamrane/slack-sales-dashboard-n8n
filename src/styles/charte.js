// Charte graphique Owner Technology — neutre, propre, 1 accent bleu sobre (style Attio / Linear).
// Reutilisable sur tout le site : makeCharte(darkMode) -> tokens ; CHARTE_CAT -> couleurs categories.
// Principe : beaucoup de blanc/gris, texte presque noir, boutons primaires sombres, accent bleu rare,
// statuts en teintes douces. Fini les couleurs vives.

export function makeCharte(dark) {
  return {
    bg:           dark ? "#16181d" : "#ffffff",
    surface:      dark ? "#0f1116" : "#f7f8fa",
    surfaceAlt:   dark ? "#1b1e25" : "#fbfcfd",
    border:       dark ? "#262a32" : "#ececef",
    borderStrong: dark ? "#333843" : "#e0e2e8",
    text:         dark ? "#eceef2" : "#1a1d23",
    text2:        dark ? "#aab0bb" : "#565b66",
    muted:        dark ? "#6b7280" : "#9aa0ab",
    accent:       "#2563eb",
    accentText:   dark ? "#7aa2f7" : "#2563eb",
    accentSoft:   dark ? "rgba(37,99,235,0.20)" : "rgba(37,99,235,0.08)",
    ok:           dark ? "#34d399" : "#15a34a",   // actif
    warn:         dark ? "#f0b53e" : "#b06a12",   // absent / attention
    slate:        dark ? "#94a3b8" : "#5a6473",   // stoppe (neutre)
    primary:      dark ? "#eceef2" : "#1a1d23",   // bouton primaire (sombre)
    onPrimary:    dark ? "#16181d" : "#ffffff",
    shadow:       dark ? "none" : "0 1px 2px rgba(16,24,40,0.04)",
    shadowLg:     dark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 16px 48px rgba(16,24,40,0.14)",
  };
}

// Couleurs des 5 categories (taille d'entreprise) : desaturees, sobres, mais distinguables.
// 1-3 = ramp froid (slate -> bleu), 4-5 = teintes chaudes douces (bonus closers).
export const CHARTE_CAT = [
  { c: 1, label: "1-2",   color: "#8b94a6" },
  { c: 2, label: "3-5",   color: "#7385b4" },
  { c: 3, label: "6-10",  color: "#5b7fc4" },
  { c: 4, label: "11-19", color: "#bf945f" },
  { c: 5, label: "20+",   color: "#5fa085" },
];
