// src/pages/MetaAds/theme.js — thème « outil de données » de la page Meta Ads.
//
// Référence : les interfaces de Google Analytics et de Meta Ads Manager
// (relevées le 2026-09-23) : une toile gris très clair, des cartes blanches à
// bordure fine et coins peu arrondis, une seule couleur d'action (le bleu),
// une hiérarchie de gris pour le texte, le vert et le rouge réservés au sens
// (mieux / moins bien), des séries de graphiques bleu / orange / vert. Les
// chiffres sont grands mais en graisse moyenne, les libellés petits et gris.

// bleu, orange, vert, violet, cyan, jaune, rose, sarcelle : la palette de séries de Google
export const SERIES_LIGHT = ['#1a73e8', '#e8710a', '#188038', '#9334e6', '#12b5cb', '#f9ab00', '#e52592', '#00796b'];
export const SERIES_DARK = ['#8ab4f8', '#fcad70', '#81c995', '#c58af9', '#78d9ec', '#fdd663', '#ff8bcb', '#5ed2c6'];

export function getTheme(dark) {
  const series = dark ? SERIES_DARK : SERIES_LIGHT;
  const base = dark
    ? {
        isDark: true,
        pageBg: '#202124', surface: '#292a2d', surfaceAlt: '#303134', border: '#3c4043', borderSoft: '#35363a',
        text: '#e8eaed', textMuted: '#9aa0a6', textFaint: '#80868b',
        primary: '#8ab4f8', primaryStrong: '#aecbfa', accentBg: 'rgba(138,180,248,0.16)', accentSoft: 'rgba(138,180,248,0.40)',
        track: '#3c4043', grid: 'rgba(232,234,237,0.10)',
        green: '#81c995', red: '#f28b82', amber: '#fdd663',
        rowHover: '#303134', shadow: '0 1px 2px rgba(0,0,0,0.3)',
        tooltipBg: '#3c4043', tooltipText: '#e8eaed', tooltipMuted: '#bdc1c6',
      }
    : {
        isDark: false,
        pageBg: '#f8f9fa', surface: '#ffffff', surfaceAlt: '#f1f3f4', border: '#dadce0', borderSoft: '#e8eaed',
        text: '#202124', textMuted: '#5f6368', textFaint: '#80868b',
        primary: '#1a73e8', primaryStrong: '#1967d2', accentBg: '#e8f0fe', accentSoft: '#aecbfa',
        track: '#e8eaed', grid: '#e8eaed',
        green: '#188038', red: '#d93025', amber: '#e37400',
        rowHover: '#f8f9fa', shadow: '0 1px 2px rgba(60,64,67,0.10)',
        tooltipBg: '#ffffff', tooltipText: '#202124', tooltipMuted: '#5f6368',
      };
  return {
    ...base,
    series,
    accent: base.primary,
    radius: 8,      // cartes, panneaux (Google Analytics : 8 px)
    radiusSm: 6,    // champs, puces, vignettes
    radiusPill: 999,
    font: 'Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
}

// ── formats fr-FR partagés par la page ─────────────────────────────────────
const nf = new Intl.NumberFormat('fr-FR');
const nfCompact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const fmtInt = (n) => (n == null ? '—' : nf.format(Math.round(n)));
export const fmtCompact = (n) => (n == null ? '—' : nfCompact.format(n));
export const fmtEur = (n) => (n == null ? '—' : eur.format(n));
export const fmtEur2 = (n) => (n == null ? '—' : eur2.format(n));
export const fmtPct = (n, d = 1) => (n == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n)} %`);
export const fmtShare = (s, d = 1) => (s == null ? '—' : fmtPct(s * 100, d));
export const fmtRoas = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}x`);
export const fmtDay = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const fmtShortDay = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
