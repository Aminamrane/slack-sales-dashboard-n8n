// Teintes et nombres du suivi de l'automatisation. La page est bâtie avec le kit de la page Finance
// (`TrackingSheetFinance/components/PageKit.jsx`) : ici, seulement ce que le kit ne porte pas (barres, frise).

// Ton de l'étiquette du kit (`Tag`) pour chaque classement ; sans ton, l'étiquette est beige.
export const TONE_OF = { automated: "green", pending_validation: "yellow", automated_unused: "blue", not_automated: undefined };

export function palette(C, dark) {
  return {
    ...C,
    page: dark ? "#141414" : "#f4f2ef",
    text: dark ? "#f2f2f2" : "#1c1b19",
    faint: dark ? "#7d7d7d" : "#9d9890",
    track: dark ? "#2e2e2e" : "#ebe8e3",
    accent: dark ? "#ededed" : "#2b2927",
    good: dark ? "#7cc49b" : "#1f9d57",
    warn: dark ? "#e8a877" : "#f08a24",
  };
}

export const number = (value) => (value == null ? "-" : Number(value).toLocaleString("fr-FR"));
