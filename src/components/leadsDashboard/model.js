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
  const diff = Math.round((Number(current) - Number(previous)) * 100) / 100;
  return { diff, rate: Number(previous) ? diff / Number(previous) : null, tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
}

export const signed = (n) => (n > 0 ? `+${n.toLocaleString('fr-FR')}` : n.toLocaleString('fr-FR').replace('-', '−'));

// Teinte de chaque canal, reprise des Statistiques Finance pour les mêmes familles (ads en bleu, cold call setter en
// jaune, parrainage en pêche, LinkedIn en rouge, webinaire en vert tendre).
export const CHANNEL_COLOR = {
  meta_ads: '#8fbdf3', google_ads: '#7fd3df', chatgpt_ads: '#aaa5ee', partners: '#f1b76a', webinar: '#b9dc8a',
  ccs: '#ecd36a', cold_call: '#cfc8bd', referral: '#f4b183', linkedin: '#f2a0a0', web: '#86d3a6', simulator: '#c4e9d3', other: '#dedad3',
};
export const channelColor = (key) => CHANNEL_COLOR[key] || CHANNEL_COLOR.other;

// Ton de l'étiquette pastel (charte Owner) d'un canal et d'une catégorie Meta, et l'encre de chaque ton.
const CHANNEL_TONE = {
  meta_ads: 'blue', google_ads: 'cyan', chatgpt_ads: 'lilac', partners: 'peach', webinar: 'lime', ccs: 'yellow',
  cold_call: 'beige', referral: 'peach', linkedin: 'red', web: 'green', simulator: 'green', other: 'beige',
};
export const channelTone = (key) => CHANNEL_TONE[key] || 'beige';
const CATEGORY_TONE = { BROAD: 'blue', BTP: 'peach', RESTAURANTS: 'red', WEBINAIRE: 'lime' };
export const categoryTone = (name) => CATEGORY_TONE[name] || 'beige';
export const TONE_INK = {
  green: '#0b7a4b', red: '#c5221f', yellow: '#7a5a05', peach: '#c2500e', blue: '#1b6fd0', lilac: '#4a3fc4', cyan: '#0f7286',
  lime: '#3f6b12', beige: '#4a4540',
};

// Provenance d'un RDV posé par un setter (règle du classement des setters).
const PROVENANCE_COLOR = {
  second_chance: '#aaa5ee', ccs: '#ecd36a', webinar_pre: '#d4ebb5', webinar_live: '#b9dc8a', webinar_post: '#93c46a',
  webinar_recall: '#7fd3df', ads: '#8fbdf3', cold_call: '#cfc8bd', linkedin: '#f2a0a0',
};
export const provenanceColor = (key) => PROVENANCE_COLOR[key] || '#dedad3';

// Catégorie d'une campagne Meta.
const CATEGORY_COLOR = { BROAD: '#8fbdf3', BTP: '#f1b76a', RESTAURANTS: '#f2a0a0' };
export const categoryColor = (name) => CATEGORY_COLOR[name] || '#cfc8bd';

// Les canaux rangés par famille, dans l'ordre du serveur, avec leur teinte et leur part du total ; une famille vide
// reste visible (zéro, pas d'absence).
export function groupChannels(channels = [], groups = []) {
  const all = channels.reduce((sum, c) => sum + c.total, 0);
  const share = (n) => (all ? n / all : 0);
  return groups.map((g) => {
    const rows = channels.filter((c) => c.group === g.key).map((c) => ({ ...c, color: channelColor(c.key), share: share(c.total) }));
    const total = rows.reduce((sum, c) => sum + c.total, 0);
    return { ...g, total, share: share(total), channels: rows };
  });
}

// À quoi la période se compare, en mots : un jour choisi à la main se compare à la veille.
export const compareWord = (key, range) => (key === 'custom' && spanDays(range) === 1 ? 'la veille' : COMPARE_LABEL[key]);

// Étiquette d'une barre jour par jour : « lun. 16 » quand il y a la place, le seul quantième sinon (un sur deux au-delà
// de 20 jours).
export function dayLabel(day, i, n, short = false) {
  if (n > 20 && i % 2) return '';
  return short || n > 16 ? String(Number(day.slice(8, 10))) : `${weekdayShort(day)} ${Number(day.slice(8, 10))}`;
}

// Les réponses des formulaires telles qu'elles arrivent (« 1_-_2 », « entre_100_000_et_500_000€ ») remises en français :
// « 1 à 2 salariés », « CA entre 100 000 et 500 000 € ». Un nombre seul devient un montant ou un effectif.
const tidy = (v) => String(v).replace(/_/g, ' ').replace(/\s*-\s*/g, ' à ').replace(/\s*€/g, ' €').replace(/\s+/g, ' ').trim();
const amount = (n) => `${Number(n).toLocaleString('fr-FR')} €`;
export function headcountText(v) {
  if (v == null || String(v).trim() === '') return null;
  const t = tidy(v);
  return /salari/i.test(t) ? t : `${t} ${/^1$/.test(t) ? 'salarié' : 'salariés'}`;
}
export function revenueText(v) {
  if (v == null || String(v).trim() === '') return null;
  const raw = String(v).trim();
  return /^\d+([.,]\d+)?$/.test(raw) ? `CA ${amount(raw.replace(',', '.'))}` : `CA ${tidy(raw)}`;
}


// Au-delà d'un mois, le graphique passe à la semaine (du lundi) : leads additionnés, CPL Meta recalculé sur la semaine
// (dépense ÷ leads). `metaDays` : le CPL Meta jour par jour du serveur.
export function byWeek(history, metaDays = []) {
  if (!history || history.days.length <= 31) return history && { ...history, weeks: false, meta: metaDays };
  const starts = [];
  const index = history.days.map((day) => {
    const start = weekStart(day);
    if (starts[starts.length - 1] !== start) starts.push(start);
    return starts.length - 1;
  });
  const sum = (values) => starts.map((_, w) => values.reduce((acc, v, i) => (index[i] === w ? acc + (v || 0) : acc), 0));
  const meta = Object.fromEntries((metaDays || []).map((x) => [x.date, x]));
  return {
    weeks: true, days: starts,
    in_period: starts.map((_, w) => history.in_period.some((on, i) => on && index[i] === w)),
    total: sum(history.total),
    channels: Object.fromEntries(Object.entries(history.channels).map(([k, v]) => [k, sum(v)])),
    meta: starts.map((start, w) => {
      const days = history.days.filter((_, i) => index[i] === w).map((d) => meta[d]).filter((x) => x && x.leads != null);
      if (!days.length) return { date: start, leads: null };
      const leads = days.reduce((a, x) => a + x.leads, 0);
      const spend = days.reduce((a, x) => a + (x.spend_eur || 0), 0);
      return { date: start, leads, spend_eur: Math.round(spend * 100) / 100, cpl_eur: leads ? Math.round((spend / leads) * 100) / 100 : null };
    }),
  };
}

export const signedEur = (n) => `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Valeur d'un canal ou d'une provenance dans la réponse de comparaison.
export const byKey = (rows = []) => Object.fromEntries(rows.map((r) => [r.key, r]));

// La hauteur relative des barres d'un graphique, la plus haute à 1.
export const heights = (values) => { const max = Math.max(0, ...values); return values.map((v) => (max ? v / max : 0)); };

export const weekdayShort = (day) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][new Date(`${day}T12:00:00Z`).getUTCDay()];

// Rien n'est demandé pour les appels au-delà de 31 jours (limite d'Allo côté serveur).
export const CALLS_MAX_DAYS = 31;
export const canReadCalls = (range) => spanDays(range) <= CALLS_MAX_DAYS;

export { weekStart };
