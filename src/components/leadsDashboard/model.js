// Dashboard Leads du CEO (dev 18/11/2026) : périodes, comparaison et écarts. Le serveur compte
// (/api/v1/lead-statistics), la page présente ; rien n'est recalculé ici.
import { addDays, daysInMonth, monthStart, presetDays, weekStart } from '../../pages/TrackingSheetFinance/statistics/period.js';

export const PRESETS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'this-week', label: 'Cette semaine' },
  { key: 'last-week', label: 'Semaine dernière' },
  { key: 'this-month', label: 'Ce mois-ci' },
  { key: 'last-month', label: 'Mois dernier' },
];

const dayIndex = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86400000;
export const spanDays = ({ from, to }) => dayIndex(to) - dayIndex(from) + 1;

// `today` : le jour de Paris (AAAA-MM-JJ).
export function presetRange(key, today) {
  if (key === 'today') return { from: today, to: today };
  if (key === 'yesterday') { const day = addDays(today, -1); return { from: day, to: day }; }
  return presetDays(key, today);
}

// Même jour du mois précédent, borné à la fin de ce mois (31 mars → 28 ou 29 février).
function sameDayPreviousMonth(day) {
  const prev = addDays(monthStart(day), -1).slice(0, 7);
  return `${prev}-${String(Math.min(Number(day.slice(8, 10)), daysInMonth(prev))).padStart(2, '0')}`;
}

// La période de comparaison : la veille, la semaine d'avant aux mêmes jours, le mois d'avant aux mêmes dates ; une
// période choisie à la main se compare à la même durée juste avant.
export function comparisonFor(key, range) {
  const n = spanDays(range);
  switch (key) {
    case 'this-week': case 'last-week': return { from: addDays(range.from, -7), to: addDays(range.to, -7) };
    case 'this-month': case 'last-month': return { from: sameDayPreviousMonth(range.from), to: sameDayPreviousMonth(range.to) };
    default: return { from: addDays(range.from, -n), to: addDays(range.from, -1) };
  }
}

export const COMPARE_LABEL = {
  today: 'hier', yesterday: 'la veille', 'this-week': 'la semaine précédente', 'last-week': 'la semaine précédente',
  'this-month': 'le mois précédent', 'last-month': 'le mois précédent', custom: 'la période précédente',
};

// Écart avec la période de comparaison : null quand il n'y en a pas.
export function delta(current, previous) {
  if (previous == null || current == null) return null;
  const diff = Number(current) - Number(previous);
  return { diff, rate: Number(previous) ? diff / Number(previous) : null, tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
}

export const signed = (n) => (n > 0 ? `+${n.toLocaleString('fr-FR')}` : n.toLocaleString('fr-FR').replace('-', '−'));

// Les canaux rangés par famille, dans l'ordre du serveur ; une famille vide reste visible (zéro, pas d'absence).
export function groupChannels(channels = [], groups = []) {
  return groups.map((g) => {
    const rows = channels.filter((c) => c.group === g.key);
    return { ...g, total: rows.reduce((sum, c) => sum + c.total, 0), channels: rows };
  });
}

// Valeur d'un canal ou d'une provenance dans la réponse de comparaison.
export const byKey = (rows = []) => Object.fromEntries(rows.map((r) => [r.key, r]));

// La hauteur relative des barres d'un graphique, la plus haute à 1.
export const heights = (values) => { const max = Math.max(0, ...values); return values.map((v) => (max ? v / max : 0)); };

export const weekdayShort = (day) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][new Date(`${day}T12:00:00Z`).getUTCDay()];

// Rien n'est demandé pour les appels au-delà de 31 jours (limite d'Allo côté serveur).
export const CALLS_MAX_DAYS = 31;
export const canReadCalls = (range) => spanDays(range) <= CALLS_MAX_DAYS;

export { weekStart };
