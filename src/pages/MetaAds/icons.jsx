// src/pages/MetaAds/icons.jsx — pictogrammes de la page Meta Ads.
//
// Dessinés pour la page, sur une grille 24, un seul trait (1.6 px, bouts
// ronds), sans remplissage : la couleur vient du contexte. Chaque glyphe
// dit une chose du métier acquisition (dépense, lead, vente, portée…)
// plutôt que de ressembler à une barre d'outils.

import React from 'react';

const GLYPHS = {
  overview: <><rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2" /><rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2" /><rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2" /><rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2" /></>,
  creatives: <><rect x="3.2" y="5" width="14.6" height="14.6" rx="2.6" /><path d="M3.2 15.6l4.2-4.2 3.6 3.6 2.6-2.6 4.2 4.2" /><circle cx="8.4" cy="9.2" r="1.4" /><path d="M19.6 3.4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" /></>,
  structure: <><path d="M12 3.6l8.4 4.4L12 12.4 3.6 8z" /><path d="M3.6 12.2l8.4 4.4 8.4-4.4" /><path d="M3.6 16.4l8.4 4.4 8.4-4.4" /></>,
  spend: <><rect x="2.8" y="6.4" width="18.4" height="11.2" rx="2.4" /><circle cx="12" cy="12" r="2.6" /><path d="M6.2 9.6v4.8M17.8 9.6v4.8" /></>,
  leads: <><rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.6" /><circle cx="9.4" cy="10.4" r="2.2" /><path d="M5.9 16.2c.7-1.7 2-2.6 3.5-2.6s2.8.9 3.5 2.6" /><path d="M15.4 9.6h3.2M15.4 13h3.2" /></>,
  sales: <><path d="M8 4.2h8v4.2a4 4 0 01-8 0z" /><path d="M8 5.4H5.4a2.4 2.4 0 002.4 2.4M16 5.4h2.6a2.4 2.4 0 01-2.4 2.4" /><path d="M12 12.4v3.4M9 19.4h6M9.8 15.8h4.4l.6 3.6H9.2z" /></>,
  roas: <><path d="M3.4 17.6l5-5.2 3.4 3.2 4.2-5.4 4.6 4" /><path d="M20.6 8.4v4.2h-4.2" /><path d="M3.4 20.4h17.2" /></>,
  reach: <><circle cx="12" cy="12" r="2.2" /><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4" /><path d="M5 5a10 10 0 000 14M19 5a10 10 0 010 14" /></>,
  impressions: <><path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z" /><circle cx="12" cy="12" r="2.8" /></>,
  clicks: <><path d="M7.4 6.2l10.4 6-4.6 1.4-1.6 4.6z" /><path d="M13.6 13.8l3.4 3.4" /><path d="M4.6 4.6l1.6 1.6M4.2 9.6h2.2M9.6 4.2v2.2" /></>,
  ads: <><path d="M3.6 10.2v3.6a1.6 1.6 0 001.6 1.6h2.2l6.4 3.6V5l-6.4 3.6H5.2a1.6 1.6 0 00-1.6 1.6z" /><path d="M17 9.4a3.4 3.4 0 010 5.2" /><path d="M19.4 7a6.6 6.6 0 010 10" /></>,
  audience: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.2c.6-3.3 2.7-5.2 5.6-5.2s5 1.9 5.6 5.2" /><circle cx="16.8" cy="9.4" r="2.4" /><path d="M16.2 13.6c2.4.2 4 1.9 4.4 4.8" /></>,
  region: <><path d="M12 21s-6.2-6.1-6.2-11a6.2 6.2 0 0112.4 0c0 4.9-6.2 11-6.2 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  format: <><rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.4" /><path d="M3.2 9h17.6M3.2 15h17.6M7.6 5.2v13.6M16.4 5.2v13.6" /></>,
  placement: <><rect x="6.4" y="2.8" width="11.2" height="18.4" rx="2.6" /><path d="M9.2 6.4h5.6M9 10h6M9 13.2h6M9 16.4h3.6" /></>,
  launch: <><path d="M12 3.4c3.4 1.6 5 5.4 4.4 9.6l-4.4 4.4-4.4-4.4C7 8.8 8.6 5 12 3.4z" /><circle cx="12" cy="9.6" r="1.6" /><path d="M8.2 14.4l-2.4 1.2.8 2.6M15.8 14.4l2.4 1.2-.8 2.6M10.6 17.8l1.4 2.8 1.4-2.8" /></>,
  portfolio: <><rect x="3.2" y="7.2" width="17.6" height="12.4" rx="2.4" /><path d="M8.6 7.2V5.6a1.6 1.6 0 011.6-1.6h3.6a1.6 1.6 0 011.6 1.6v1.6" /><path d="M3.2 12.2h17.6M12 11v2.6" /></>,
  funnel: <><path d="M3.6 4.6h16.8l-6.2 7.6v5.6l-4.4 2.2v-7.8z" /></>,
  calendar: <><rect x="3.4" y="5.2" width="17.2" height="15" rx="2.6" /><path d="M3.4 9.8h17.2M8.2 3.2v4M15.8 3.2v4" /><circle cx="8.6" cy="14" r="1" /><circle cx="12" cy="14" r="1" /><circle cx="15.4" cy="14" r="1" /><circle cx="8.6" cy="17.2" r="1" /><circle cx="12" cy="17.2" r="1" /></>,
  flow: <><path d="M3.4 8.2h11.2M11.8 5.4l2.8 2.8-2.8 2.8" /><path d="M20.6 15.8H9.4M12.2 13l-2.8 2.8 2.8 2.8" /></>,
  score: <><path d="M4 16.6a8 8 0 0116 0" /><path d="M12 16.6l3.6-5.4" /><circle cx="12" cy="16.6" r="1.4" /><path d="M4 20h16" /></>,
  match: <><circle cx="9.2" cy="12" r="5.2" /><circle cx="14.8" cy="12" r="5.2" /></>,
  search: <><circle cx="10.6" cy="10.6" r="6" /><path d="M15.2 15.2l5.2 5.2" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  back: <><path d="M14.4 5.6L8 12l6.4 6.4" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.2M12 7.6v.4" /></>,
  sort: <><path d="M4 7h12M4 12h8M4 17h5" /><path d="M17.6 10.4l2.6 2.6 2.6-2.6M20.2 13V4.6" /></>,
  active: <><circle cx="12" cy="12" r="3.4" /><circle cx="12" cy="12" r="8" /></>,
};

export const PICT_NAMES = Object.keys(GLYPHS);

/** Un pictogramme de la page. `name` ∈ PICT_NAMES ; `color` par défaut = currentColor. */
export default function Pict({ name, size = 18, color = 'currentColor', strokeWidth = 1.6, style }) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      {glyph}
    </svg>
  );
}
