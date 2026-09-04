// PoleIcons.jsx — icônes dessinées pour la page « Heures de travail ».
//
// Demande dev 2026-09-04 : « Total attendu, Marketing, Finances, RH,
// Direction… je n'ai pas créé de SVG qui soient vraiment bien. » Un jeu
// cohérent, filaire, trait 1.7 sur grille 24, bouts ronds, `currentColor` :
// la même icône sert grise dans un en-tête et colorée dans une carte de pôle.
// Statiques : rien ne se dessine ni ne clignote, une icône reconnaît, elle
// ne distrait pas.

import React from 'react';

function Icon({ size = 16, strokeWidth = 1.7, style, children, ...rest }) {
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

// ── Indicateurs ─────────────────────────────────────────────────────────────

// Total équipe : l'horloge.
export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

// Total attendu : la cible.
export const TargetIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

// Moyenne : la jauge.
export const GaugeIcon = (p) => (
  <Icon {...p}>
    <path d="M4 16.5a8.5 8.5 0 1 1 16 0" />
    <path d="M12 16.5 15.5 11" />
    <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

// Période : le calendrier.
export const CalendarIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
  </Icon>
);

// Filtre : les trois lignes.
export const FilterIcon = (p) => (
  <Icon {...p}>
    <path d="M4 6.5h16M7 12h10M10 17.5h4" />
  </Icon>
);

// Crayon : modifier.
export const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="m14.5 5.5 4 4L8 20H4v-4z" />
    <path d="m12.5 7.5 4 4" />
  </Icon>
);

// Chevrons de navigation.
export const ChevronLeftIcon = (p) => (
  <Icon {...p}><path d="m14.5 6-6 6 6 6" /></Icon>
);
export const ChevronRightIcon = (p) => (
  <Icon {...p}><path d="m9.5 6 6 6-6 6" /></Icon>
);

// ── Pôles ───────────────────────────────────────────────────────────────────

// Devs : les chevrons de code.
export const DevsIcon = (p) => (
  <Icon {...p}>
    <path d="m8 8-4.5 4L8 16" />
    <path d="m16 8 4.5 4L16 16" />
    <path d="m13.5 5-3 14" />
  </Icon>
);

// Sales : le combiné.
export const SalesIcon = (p) => (
  <Icon {...p}>
    <path d="M5.5 4h3l1.8 4.2-2 1.4a11 11 0 0 0 6.1 6.1l1.4-2 4.2 1.8v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4Z" />
  </Icon>
);

// Setters : le casque.
export const SettersIcon = (p) => (
  <Icon {...p}>
    <path d="M4.5 13.5V12a7.5 7.5 0 0 1 15 0v1.5" />
    <rect x="3.5" y="13" width="4" height="6" rx="1.5" />
    <rect x="16.5" y="13" width="4" height="6" rx="1.5" />
    <path d="M18.5 19v.5a2 2 0 0 1-2 2H13" />
  </Icon>
);

// Finance : les pièces.
export const FinanceIcon = (p) => (
  <Icon {...p}>
    <ellipse cx="10" cy="7" rx="6.5" ry="2.8" />
    <path d="M3.5 7v4c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V7" />
    <path d="M3.5 11v4c0 1.5 2.9 2.8 6.5 2.8 1 0 2-.1 2.8-.3" />
    <ellipse cx="15.5" cy="15.5" rx="5" ry="2.3" />
    <path d="M10.5 15.5v2.5c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3v-2.5" />
  </Icon>
);

// Marketing : le mégaphone.
export const MarketingIcon = (p) => (
  <Icon {...p}>
    <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l7.5 4V4.5L8 8.5H5.5A1.5 1.5 0 0 0 4 10Z" />
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M8 15.5v3.5a1.5 1.5 0 0 0 1.5 1.5H10" />
  </Icon>
);

// Direction : la boussole.
export const DirectionIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

// RH : les personnes.
export const RhIcon = (p) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
    <path d="M17.5 14.6c1.8.6 2.8 2.2 3 4.9" />
  </Icon>
);

// Client Success : le cœur dans la main.
export const ClientSuccessIcon = (p) => (
  <Icon {...p}>
    <path d="M12 10.5c-1.8-2.2-4.5-1-4.5 1 0 1.8 2.5 3.5 4.5 5 2-1.5 4.5-3.2 4.5-5 0-2-2.7-3.2-4.5-1Z" />
    <path d="M3.5 13.5V20h3l3.5 1.5h5.5c1 0 1.8-.6 2-1.5" />
    <path d="M20.5 13.5V20" />
  </Icon>
);

// Autre : les points.
export const OtherIcon = (p) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);
