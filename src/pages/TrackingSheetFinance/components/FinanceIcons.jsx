// FinanceIcons.jsx — le jeu d'icônes de la page finance, dessiné à la main.
//
// Référence donnée par le dev (2026-09-03) : la barre latérale d'un logiciel
// de facturation, icônes filaires monochromes à trait fin, angles arrondis,
// formes simples et « pleines » (une maison, un document, un bac de
// réception, une banque, une horloge, une fiche contact, une calculatrice,
// un graphique, un panier, une mallette, une liste cochée). Pas de détail
// inutile : chaque icône se reconnaît à 16 px.
//
// Toutes partagent la même grille (24 × 24), le même trait (1.6, bouts et
// jointures ronds) et prennent la couleur du texte parent (`currentColor`),
// donc la même icône sert grise dans la barre latérale et accentuée sur
// l'entrée active. `size` et `strokeWidth` restent réglables au cas par cas.

import React from 'react';

function Icon({ size = 18, strokeWidth = 1.6, style, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...rest}
    >
      {children}
    </svg>
  );
}

// Vue d'ensemble — la maison, toit et porte.
export const HomeIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5" />
    <path d="M10 20.5v-5.5h4v5.5" />
  </Icon>
);

// Suivi mensuel — le tableau, lignes et colonnes.
export const TableIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10" />
  </Icon>
);

// Document — la facture, coin plié et lignes de texte.
export const DocumentIcon = (p) => (
  <Icon {...p}>
    <path d="M7 3.5h7l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M8.5 12.5h7M8.5 16h5" />
  </Icon>
);

// Encaissements — le bac de réception, avec ce qui y tombe.
export const InboxIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3.5v8.5" />
    <path d="m9 9.5 3 3 3-3" />
    <path d="M4 14.5h4.5l1.5 2.5h4l1.5-2.5H20" />
    <path d="M6.5 8.5H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10.5a2 2 0 0 0-2-2h-.5" />
  </Icon>
);

// Pertes — la courbe qui descend.
export const LossIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 19.5h17" />
    <path d="m4.5 6.5 5 5.5 3.5-3 6 6.5" />
    <path d="M15 15.5h4v-4" />
  </Icon>
);

// À jour — le cercle coché.
export const CheckCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
  </Icon>
);

// Retard du mois — l'horloge.
export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

// Créances antérieures — le document qui alerte.
export const OverdueIcon = (p) => (
  <Icon {...p}>
    <path d="M7 3.5h7l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M12 10.5v4" />
    <path d="M12 17.3h.01" strokeWidth={2.4} />
  </Icon>
);

// Trop-perçu — la flèche qui revient.
export const RefundIcon = (p) => (
  <Icon {...p}>
    <path d="M8.5 7.5H15a4.5 4.5 0 0 1 0 9H6" />
    <path d="m9 11.5-3.5 5 3.5 5" transform="translate(0 -6.5)" />
  </Icon>
);

// Onboarding passé — le calendrier coché.
export const CalendarCheckIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    <path d="m9 14.8 2.2 2.2 4-4.2" />
  </Icon>
);

// Non automatisé — la banque, barrée.
export const BankOffIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 9.5 12 4.5l8.5 5" />
    <path d="M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8" />
    <path d="M3.5 20h17" />
    <path d="m4.5 3.5 15 17" />
  </Icon>
);

// Résiliés / Rétractés — la porte de sortie.
export const ExitIcon = (p) => (
  <Icon {...p}>
    <path d="M10 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5h4" />
    <path d="M14.5 8 19 12l-4.5 4" />
    <path d="M19 12H9.5" />
  </Icon>
);

// Exporter — la feuille de calcul qui sort.
export const ExportIcon = (p) => (
  <Icon {...p}>
    <path d="M7 3.5h7l4.5 4.5v4" />
    <path d="M14 3.5V8h4.5" />
    <path d="M5.5 5v14a1.5 1.5 0 0 0 1.5 1.5h5" />
    <path d="M8.5 12.5h5M8.5 16h3" />
    <path d="M15.5 17.5h5" />
    <path d="m18.5 15.5 2 2-2 2" />
  </Icon>
);

// Contact — la fiche, portrait et lignes.
export const ContactIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10.5" r="2" />
    <path d="M6 16.5c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4" />
    <path d="M15 9.5h3M15 13h3" />
  </Icon>
);

// Banque — le fronton et ses colonnes.
export const BankIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 9.5 12 4.5l8.5 5" />
    <path d="M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8" />
    <path d="M3.5 20h17" />
  </Icon>
);

// Rapports — les barres.
export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8.5 16.5v-6M13 16.5V7.5M17.5 16.5v-3.5" />
  </Icon>
);

// Liste cochée — les tâches.
export const ChecklistIcon = (p) => (
  <Icon {...p}>
    <path d="m4 7 1.5 1.5L8 6" />
    <path d="m4 13 1.5 1.5L8 12" />
    <path d="m4 19 1.5 1.5L8 18" />
    <path d="M11 7h9M11 13h9M11 19h9" />
  </Icon>
);
