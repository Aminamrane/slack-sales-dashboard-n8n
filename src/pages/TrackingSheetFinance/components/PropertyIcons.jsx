// Icônes des PROPRIÉTÉS de la finance (en-têtes du tableau, lignes de la
// fiche), dessinées pour la page (dev 2026-09-25, référence : propriétés
// Notion). Les icônes de navigation restent dans FinanceIcons.jsx. Grille 16 px, glyphes pleins et gris doux :
// une icône par propriété, pour que l'œil trouve la colonne avant de lire.
// Toutes héritent de `currentColor`.

const base = (size, style) => ({
  width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
  'aria-hidden': true, focusable: false,
  style: { flexShrink: 0, display: 'block', ...style },
});

// « Nº » : numéro client.
export function NumeroIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path d="M2 12.5V3.5h1.2l4 6.3V3.5h1.3v9H7.3L3.3 6.2v6.3H2Z" fill="currentColor" />
      <circle cx="12" cy="6.6" r="2.1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.8 11.6h4.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Client : silhouette dans un cercle.
export function ClientIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="6.5" r="2.1" fill="currentColor" />
      <path d="M4.3 12.3c.8-1.5 2.1-2.3 3.7-2.3s2.9.8 3.7 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Société : immeuble plein, fenêtres en creux.
export function CompanyIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M3.5 2A1.5 1.5 0 0 0 2 3.5V14h7V3.5A1.5 1.5 0 0 0 7.5 2h-4Zm.75 2.25h1.25V5.5H4.25V4.25Zm2.25 0h1.25V5.5H6.5V4.25ZM4.25 7h1.25v1.25H4.25V7Zm2.25 0h1.25v1.25H6.5V7ZM4.25 9.75h1.25V11H4.25V9.75Zm2.25 0h1.25V11H6.5V9.75Z" />
      <path fill="currentColor" d="M10 6h2.5A1.5 1.5 0 0 1 14 7.5V14h-4V6Z" opacity=".55" />
    </svg>
  );
}

// Personne : buste plein (responsable, sales).
export function PersonIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <circle cx="8" cy="5" r="2.9" fill="currentColor" />
      <path d="M2.5 14c.3-3 2.6-5 5.5-5s5.2 2 5.5 5h-11Z" fill="currentColor" />
    </svg>
  );
}

// Personnes : deux bustes (personnes du NDA).
export function PeopleIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <circle cx="5.6" cy="5.4" r="2.3" fill="currentColor" />
      <path d="M1.2 13.2c.2-2.5 2-4.1 4.4-4.1s4.2 1.6 4.4 4.1H1.2Z" fill="currentColor" />
      <circle cx="11.2" cy="5.9" r="1.9" fill="currentColor" opacity=".55" />
      <path d="M10.9 9.4c2.1 0 3.6 1.5 3.9 3.8h-3.6a5.6 5.6 0 0 0-1.6-3.6c.4-.1.8-.2 1.3-.2Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}

// Calendrier plein, bandeau haut en creux.
export function CalendarIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M4.5 1.5a.75.75 0 0 1 .75.75V3h5.5v-.75a.75.75 0 0 1 1.5 0V3h.25A1.5 1.5 0 0 1 14 4.5v8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3h.25v-.75a.75.75 0 0 1 .75-.75ZM3.5 6.5v6h9v-6h-9Z" />
    </svg>
  );
}

// Calendrier coché : rendez-vous fixé (onboarding).
export function CalendarCheckIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M4.5 1.5a.75.75 0 0 1 .75.75V3h5.5v-.75a.75.75 0 0 1 1.5 0V3h.25A1.5 1.5 0 0 1 14 4.5v8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3h.25v-.75a.75.75 0 0 1 .75-.75ZM3.5 6.5v6h9v-6h-9Z" />
      <path d="m5.8 9.6 1.5 1.4 2.9-2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Signature : plume.
export function SignatureIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fill="currentColor" d="M11.1 1.9a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L6.6 12.4l-3.4.9a.5.5 0 0 1-.6-.6l.9-3.4 7.6-7.4Z" />
      <path d="M8.5 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Horloge pleine : échéance, retard.
export function ClockIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm.75-9.75a.75.75 0 0 0-1.5 0V8c0 .2.08.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.75Z" />
    </svg>
  );
}

// Billet : montant attendu.
export function BanknoteIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M2.5 3.5A1.5 1.5 0 0 0 1 5v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 15 11V5a1.5 1.5 0 0 0-1.5-1.5h-11ZM8 10.1a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM3.2 5.6a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Zm9.6 3.6a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z" />
    </svg>
  );
}

// Coche pleine : récupéré.
export function ReceivedIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm3.03-8.22a.75.75 0 0 0-1.06-1.06L7 8.19 5.78 6.97a.75.75 0 0 0-1.06 1.06l1.75 1.75c.3.3.77.3 1.06 0l3.5-3.5Z" />
    </svg>
  );
}

// Demi-disque : créance (ce qui reste d'avant).
export function DebtIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <circle cx="8" cy="8" r="5.9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 2.1a5.9 5.9 0 0 1 0 11.8V2.1Z" fill="currentColor" />
    </svg>
  );
}

// Disque plein, flèche entrante : récupéré sur l'antérieur.
export function RecoveredPriorIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm-.47-9.53a.75.75 0 0 1 0 1.06L6.31 7.25h4.44a.75.75 0 0 1 0 1.5H6.31l1.22 1.22a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06l2.5-2.5a.75.75 0 0 1 1.06 0Z" />
    </svg>
  );
}

// Cycle : modalité de paiement (le rythme).
export function CycleIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path d="M13 6.2A5.2 5.2 0 0 0 3.6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 9.8A5.2 5.2 0 0 0 12.4 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.6 2.6v3.2h3.2L2.6 2.6ZM13.4 13.4v-3.2h-3.2l3.2 3.2Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

// Carte : moyen de paiement (PSP).
export function CardIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M1 4.5A1.5 1.5 0 0 1 2.5 3h11A1.5 1.5 0 0 1 15 4.5V5.5H1v-1ZM1 7.5V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V7.5H1Zm2.5 2.25h3v1.25h-3V9.75Z" />
    </svg>
  );
}

// Colis : formule (tranche d'effectif).
export function FormulaIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fill="currentColor" d="M7.4 1.6a1.3 1.3 0 0 1 1.2 0l4.6 2.3L8 6.5 2.8 3.9l4.6-2.3Z" />
      <path fill="currentColor" d="M2 5.1 7.3 7.8v6.7l-4.6-2.3A1.3 1.3 0 0 1 2 11V5.1Z" />
      <path fill="currentColor" opacity=".55" d="M14 5.1 8.7 7.8v6.7l4.6-2.3c.43-.22.7-.66.7-1.15V5.1Z" />
    </svg>
  );
}

// Courbe en creux dans un carré plein : retard à date (dû aujourd'hui).
export function TrendIcon({ size = 14, style }) {
  return (
    <svg {...base(size, style)}>
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor"
        d="M3.7 2.5A2.2 2.2 0 0 0 1.5 4.7v6.6a2.2 2.2 0 0 0 2.2 2.2h8.6a2.2 2.2 0 0 0 2.2-2.2V4.7a2.2 2.2 0 0 0-2.2-2.2H3.7Zm8.85 3.3a.75.75 0 0 0-1.1-1.02L8.24 8.24 6.7 6.93a.75.75 0 0 0-1.04.06L3.26 9.6a.75.75 0 1 0 1.1 1.02L6.27 8.54l1.55 1.33a.75.75 0 0 0 1.04-.06l3.69-3.99Z" />
    </svg>
  );
}
