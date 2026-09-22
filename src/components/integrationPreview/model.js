export const PREVIEW_OWNER = "y.amrane@ownertechnology.com";
export const canSeeIntegrationPreview = (user) =>
  user?.email?.toLowerCase() === PREVIEW_OWNER && user?.role === "admin";
export const MISSION_OPTIONS = [
  "Optimisation de la rémunération",
  "Structuration du groupe",
  "Approbation des comptes",
  "Contrats de travail",
  "Organisation de la paie",
  "Protection du dirigeant",
  "Projet de développement",
  "Autre mission",
];
export const WEATHER_LABELS = [
  "Très préoccupé",
  "Préoccupé",
  "Neutre",
  "Confiant",
  "Très confiant",
];
export const freshDraft = () => ({
  companies: [
    {
      id: "demo-holding",
      name: "Atelier Horizon — Holding",
      siren: "",
      selected: true,
    },
    {
      id: "demo-studio",
      name: "Atelier Horizon — Studio",
      siren: "",
      selected: true,
    },
    {
      id: "demo-patrimoine",
      name: "Horizon Patrimoine",
      siren: "",
      selected: true,
    },
  ],
  directors: [
    {
      id: "demo-camille",
      name: "Camille Martin",
      role: "Présidente",
      companies: ["demo-holding", "demo-studio", "demo-patrimoine"],
    },
    {
      id: "demo-alex",
      name: "Alex Bernard",
      role: "Directeur général",
      companies: ["demo-studio"],
    },
  ],
  weather: null,
  weather_note: "",
  notes: "",
  personal_situation: "",
  professional_situation: "",
  priorities: "",
  missions: [],
  mission_notes: "",
  objective: "",
  deadline: "",
  accountant: "",
  payroll: "",
  legal: "",
  contact: "",
  preferences: "",
});
export function completeness(draft) {
  const companies = draft.companies.filter((c) => c.selected);
  const directors = draft.directors.filter((d) =>
    d.companies.some((id) => companies.some((c) => c.id === id)),
  );
  return {
    companies,
    directors,
    checks: [
      {
        label: "Sociétés à accompagner",
        done: companies.length > 0 && companies.every((c) => c.name.trim())
          && (draft.flow_version < 2 || draft.flow_version == null || companies.every(c => (c.in_registration && !c.siren.trim()) || (!c.in_registration && c.siren.trim())))
          && draft.companies.every(c => !c.siren.trim() || /^\d{9}$/.test(c.siren.replace(/\s/g, '')))
          && new Set(draft.companies.filter(c => c.siren.trim()).map(c => c.siren.replace(/\s/g, ''))).size === draft.companies.filter(c => c.siren.trim()).length,
      },
      {
        label: "Dirigeants identifiés",
        done:
          directors.length > 0 &&
          directors.every((d) => d.name.trim()) &&
          companies.every((c) =>
            directors.some((d) => d.companies.includes(c.id)),
          ),
      },
      ...(draft.flow_version >= 2 ? [{
        label: "Accès des dirigeants",
        done: draft.directors.filter(d => d.provisional_access).every(d =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((d.email || '').trim()) && d.name.trim().split(/\s+/).length >= 2
          && d.companies.some(id => companies.some(c => c.id === id)))
          && new Set(draft.directors.filter(d => d.provisional_access).map(d => (d.email || '').trim().toLowerCase())).size === draft.directors.filter(d => d.provisional_access).length,
      }] : [{
        label: "Première météo client",
        done:
          Number.isInteger(draft.weather) &&
          draft.weather >= 1 &&
          draft.weather <= 5,
      }]),
    ],
  };
}
