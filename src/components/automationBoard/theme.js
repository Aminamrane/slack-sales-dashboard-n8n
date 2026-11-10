// Teintes et nombres du suivi de l'automatisation (tableau et fiche d'un process).

// Une teinte par classement, lisible en clair et en sombre.
const TONES = {
  automated: { light: ["#1a8a55", "#e7f6ee"], dark: ["#56c995", "rgba(86,201,149,0.14)"] },
  pending_validation: { light: ["#a96a12", "#fdf2dc"], dark: ["#e3ae52", "rgba(227,174,82,0.14)"] },
  automated_unused: { light: ["#3565c9", "#e8effc"], dark: ["#86abf5", "rgba(134,171,245,0.14)"] },
  not_automated: { light: ["#636a78", "#f0f1f4"], dark: ["#a0a6b6", "rgba(255,255,255,0.07)"] },
};

export function tone(classification, dark) {
  const [fg, bg] = (TONES[classification] || TONES.not_automated)[dark ? "dark" : "light"];
  return { fg, bg };
}

export function palette(C, dark) {
  return {
    ...C,
    page: dark ? "#13141b" : "#ffffff",
    card: dark ? "#1a1b24" : "#ffffff",
    soft: dark ? "#1f2029" : "#f7f8fa",
    line: dark ? "#272833" : "#e8eaf0",
    faint: dark ? "#8b8fa0" : "#6b7280",
    track: dark ? "rgba(255,255,255,0.08)" : "#eceef3",
    good: dark ? "#56c995" : "#1a8a55",
    warn: dark ? "#e3ae52" : "#a96a12",
    bad: dark ? "#f08a8a" : "#c0392b",
  };
}

export const number = (value) => (value == null ? "-" : Number(value).toLocaleString("fr-FR"));
