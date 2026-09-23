// src/pages/MetaAds/theme.js — charte Owner pour la page Meta Ads.
//
// Navy #121b35 pour les titres et les valeurs, vert #3e7d5a comme seul accent
// (actif, positif, sélection), bleu clair #e9eef6 pour le fond de page et les
// surfaces discrètes, blanc pour les cartes. Aucune couleur hors charte : les
// variations se font par opacité du navy et du vert. Le mode sombre garde les
// mêmes rôles sur un fond navy profond.

export const OWNER = {
  navy: '#121b35',
  green: '#3e7d5a',
  sky: '#e9eef6',
  white: '#ffffff',
};

export function getTheme(dark) {
  return dark
    ? {
        isDark: true,
        pageBg: '#0d1327', surface: '#151d38', surfaceAlt: '#1b2444', border: '#243057', borderSoft: '#1f2a4d',
        text: '#eef1f8', textMuted: '#9aa4c2', textFaint: '#6b7699',
        accent: '#5fa37e', accentBg: 'rgba(95,163,126,0.16)', accentSoft: 'rgba(95,163,126,0.32)',
        navy: '#eef1f8', navySoft: 'rgba(238,241,248,0.14)', sky: '#1b2444',
        green: '#5fa37e', red: '#d97b6c', amber: '#d9a35c',
        rowHover: '#1b2444', shadow: '0 2px 10px rgba(0,0,0,0.35)',
        grid: 'rgba(238,241,248,0.08)',
      }
    : {
        isDark: false,
        pageBg: OWNER.sky, surface: OWNER.white, surfaceAlt: '#f3f6fb', border: '#d9e0ee', borderSoft: '#e7ecf5',
        text: OWNER.navy, textMuted: '#5b6584', textFaint: '#8a93ad',
        accent: OWNER.green, accentBg: 'rgba(62,125,90,0.10)', accentSoft: 'rgba(62,125,90,0.28)',
        navy: OWNER.navy, navySoft: 'rgba(18,27,53,0.08)', sky: OWNER.sky,
        green: OWNER.green, red: '#b5544a', amber: '#b98a3a',
        rowHover: '#f3f6fb', shadow: '0 1px 2px rgba(18,27,53,0.04), 0 6px 18px rgba(18,27,53,0.06)',
        grid: 'rgba(18,27,53,0.08)',
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
