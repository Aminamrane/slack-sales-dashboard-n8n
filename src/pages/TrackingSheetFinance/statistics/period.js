// Période des Statistiques Finance (dev 10/11/2026) : un mois (le mois en cours par défaut, on peut remonter), les
// trois derniers mois, l'année, ou une période choisie. Tout est en mois entiers, « AAAA-MM », comme le serveur.
export const MAX_MONTHS = 24;
export const MODES = [
  { key: 'month', label: 'Mois' },
  { key: 'quarter', label: '3 mois' },
  { key: 'year', label: 'Année' },
  { key: 'custom', label: 'Période' },
];

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const index = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
const keyOf = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

export const shiftMonth = (key, count) => keyOf(index(key) + count);
export const monthsBetween = (from, to) => index(to) - index(from) + 1;
export const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthShort = (key) => SHORT[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key) => `${monthName(key)} ${key.slice(0, 4)}`;
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Mois couverts par un mode, calés sur le mois choisi (`anchor`) et jamais au-delà du mois en cours (`current`).
export function rangeFor(mode, anchor, current, custom) {
  const last = anchor > current ? current : anchor;
  if (mode === 'quarter') return { from: shiftMonth(last, -2), to: last };
  if (mode === 'year') {
    const year = last.slice(0, 4);
    return { from: `${year}-01`, to: `${year}-12` > current ? current : `${year}-12` };
  }
  if (mode === 'custom' && custom?.from && custom?.to) {
    const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
    const end = to > current ? current : to;
    const start = from > end ? end : from;
    return { from: monthsBetween(start, end) > MAX_MONTHS ? shiftMonth(end, 1 - MAX_MONTHS) : start, to: end };
  }
  return { from: last, to: last };
}

export function rangeLabel({ from, to }) {
  if (from === to) return capital(monthLabel(from));
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return from.endsWith('-01') && to.endsWith('-12') ? `Année ${to.slice(0, 4)}` : `${capital(monthShort(from))} – ${monthShort(to)} ${to.slice(0, 4)}`;
  }
  return `${capital(monthShort(from))} ${from.slice(0, 4)} – ${monthShort(to)} ${to.slice(0, 4)}`;
}

// Liste des mois proposés dans la période choisie : du plus récent au plus ancien.
export const monthChoices = (current, count = 36) => Array.from({ length: count }, (_, i) => shiftMonth(current, -i));
export const rangeQuery = ({ from, to }) => `from=${from}&to=${to}`;

// ── Périodes en JOURS (les deux taux par sales de la Performance Sales) ───────────────────────────────
// Jours de Paris, « AAAA-MM-JJ », bornes incluses : le serveur lit les ventes par jour de signature (heure de Paris). Les calculs passent par le
// temps universel à midi : aucun changement d'heure ne décale un jour.
const DAY_MS = 86400000;
const dayIndex = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12) / DAY_MS;
const dayOf = (index) => new Date(index * DAY_MS).toISOString().slice(0, 10);
export const isDay = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value) && dayOf(dayIndex(value)) === value;
export const addDays = (day, count) => dayOf(dayIndex(day) + count);
export const monthStart = (day) => `${day.slice(0, 7)}-01`;
// Lundi de la semaine d'un jour (la semaine française commence le lundi).
const weekday = (day) => (new Date(dayIndex(day) * DAY_MS).getUTCDay() + 6) % 7;   // 0 = lundi … 6 = dimanche
export const weekStart = (day) => addDays(day, -weekday(day));
export const daysInMonth = (month) => Number(addDays(`${shiftMonth(month, 1)}-01`, -1).slice(8, 10));
// Les semaines d'un mois « AAAA-MM », lundi d'abord : 7 cases par ligne, null hors du mois.
export function monthGrid(month) {
  const cells = [...Array(weekday(`${month}-01`)).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}
// Deux jours remis dans l'ordre.
export const orderDays = (a, b) => (a <= b ? { from: a, to: b } : { from: b, to: a });
// Les moitiés d'un mois (1–15, 16–fin) et le mois entier, jamais au-delà d'aujourd'hui ; null quand rien n'est encore arrivé.
export function monthHalves(month, today) {
  const clamp = (from, to) => (from > today ? null : { from, to: to > today ? today : to });
  const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  return { first: clamp(`${month}-01`, `${month}-15`), second: clamp(`${month}-16`, end), whole: clamp(`${month}-01`, end) };
}

// Les mois qui contiennent la période (le serveur les demande avec les jours).
export const monthsOf = ({ from, to }) => ({ from: from.slice(0, 7), to: to.slice(0, 7) });

// `label` : le nom dans le menu ; `short` : le même sur le bouton, qui ne doit pas élargir l'en-tête de la carte.
export const DAY_PRESETS = [
  { key: '7d', label: '7 derniers jours', short: '7 jours' },
  { key: '15d', label: '15 derniers jours', short: '15 jours' },
  { key: '30d', label: '30 derniers jours', short: '30 jours' },
  { key: '90d', label: '90 derniers jours', short: '90 jours' },
  { key: 'this-week', label: 'Cette semaine', short: 'Cette semaine' },
  { key: 'last-week', label: 'Semaine dernière', short: 'Sem. dernière' },
  { key: 'this-month', label: 'Ce mois-ci', short: 'Ce mois-ci' },
  { key: 'last-month', label: 'Le mois dernier', short: 'Mois dernier' },
  { key: 'this-year', label: 'Cette année', short: 'Cette année' },
];

// `today` : le jour d'aujourd'hui à Paris. « N derniers jours » = aujourd'hui compris.
export function presetDays(key, today) {
  switch (key) {
    case '7d': return { from: addDays(today, -6), to: today };
    case '15d': return { from: addDays(today, -14), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case '90d': return { from: addDays(today, -89), to: today };
    case 'this-week': return { from: weekStart(today), to: today };
    case 'last-week': { const monday = addDays(weekStart(today), -7); return { from: monday, to: addDays(monday, 6) }; }
    case 'this-month': return { from: monthStart(today), to: today };
    case 'last-month': { const before = addDays(monthStart(today), -1); return { from: monthStart(before), to: before }; }
    case 'this-year': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default: return null;
  }
}

// Une période choisie à la main : `null` si elle est valable, sinon la raison. Rien n'est corrigé en silence.
export function daysProblem({ from, to }, today) {
  if (!isDay(from) || !isDay(to)) return 'format';
  if (to < from) return 'order';
  if (to > today) return 'future';
  if (monthsBetween(from.slice(0, 7), to.slice(0, 7)) > MAX_MONTHS) return 'span';
  return null;
}

const dayNumber = (day) => Number(day.slice(8, 10));
export function dayRangeLabel({ from, to }) {
  const short = (day) => SHORT[Number(day.slice(5, 7)) - 1];
  if (from === to) return `${dayNumber(to)} ${short(to)} ${to.slice(0, 4)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayNumber(from)} – ${dayNumber(to)} ${short(to)} ${to.slice(0, 4)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${dayNumber(from)} ${short(from)} – ${dayNumber(to)} ${short(to)} ${to.slice(0, 4)}`;
  return `${dayNumber(from)} ${short(from)} ${from.slice(0, 4)} – ${dayNumber(to)} ${short(to)} ${to.slice(0, 4)}`;
}
// Libellé court d'une présélection (sans l'année) : « 7 – 13 nov. », « 15 oct. – 13 nov. ».
export function dayRangeShort({ from, to }) {
  const short = (day) => SHORT[Number(day.slice(5, 7)) - 1];
  if (from === to) return `${dayNumber(to)} ${short(to)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayNumber(from)} – ${dayNumber(to)} ${short(to)}`;
  return `${dayNumber(from)} ${short(from)}${from.slice(0, 4) === to.slice(0, 4) ? '' : ` ${from.slice(0, 4)}`} – ${dayNumber(to)} ${short(to)}`;
}

// Requête des deux taux : les mois qui contiennent la période (comme avant) + ses jours.
export const dayQuery = ({ from, to }) => `${rangeQuery(monthsOf({ from, to }))}&date_from=${from}&date_to=${to}`;
