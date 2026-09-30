// src/pages/MetaAds/profit.js — formats partagés par le tableau et le panneau pour le cumul « depuis le lancement ».

export const BRACKETS = ['1-2', '3-5', '6-10', '11-19', '20+'];

// « +58 % » / « −47 % » (vrai signe moins, espace insécable avant %).
export const fmtProfit = (p) => (p == null ? '—' : `${p >= 0 ? '+' : '\u2212'}${new Intl.NumberFormat('fr-FR').format(Math.abs(Math.round(p)))}\u00a0%`);

// « 2026-09 » → « 09/2026 ».
export const monthLabel = (key) => (key ? `${key.slice(5, 7)}/${key.slice(0, 4)}` : '—');
