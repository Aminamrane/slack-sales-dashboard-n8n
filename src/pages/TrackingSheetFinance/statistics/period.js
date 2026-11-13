// Période des Statistiques Finance (dev 10/11/2026) : un mois (le mois en cours par défaut, on peut remonter), les
// trois derniers mois, l'année, ou une période choisie. Tout est en mois entiers, « AAAA-MM », comme le serveur ;
// seuls les deux taux par sales se lisent aussi au jour près (« AAAA-MM-JJ », voir `dayRange`).
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

// ── Période au jour près, pour les deux taux par sales (dev 13/11/2026 : « une période définie, choisie ») ──
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// Un vrai jour du calendrier : le 31 février n'en est pas un.
export const isDay = (value) => DAY.test(String(value || '')) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const lastDayOf = (month) => `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
const dayFR = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

// Les jours que couvre une période en mois : du 1er au dernier jour, jamais après aujourd'hui.
export function daysOf({ from, to }, today) {
  const end = lastDayOf(to.slice(0, 7));
  return { from: isDay(from) ? from : `${from}-01`, to: isDay(to) ? to : end > today ? today : end };
}

// Deux jours choisis, remis dans l'ordre, jamais après aujourd'hui, 24 mois au plus. Un jour absent ou mal écrit
// (champ vidé) : pas de période, la carte garde la précédente.
export function dayRange(custom, today) {
  if (!isDay(custom?.from) || !isDay(custom?.to)) return null;
  const [first, last] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
  const to = last > today ? today : last;
  const from = first > to ? to : first;
  const oldest = `${shiftMonth(to.slice(0, 7), 1 - MAX_MONTHS)}-01`;
  return { from: from < oldest ? oldest : from, to };
}

export function rangeLabel({ from, to }) {
  if (isDay(from) && isDay(to)) return from === to ? `Le ${dayFR(from)}` : `Du ${dayFR(from)} au ${dayFR(to)}`;
  if (from === to) return capital(monthLabel(from));
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return from.endsWith('-01') && to.endsWith('-12') ? `Année ${to.slice(0, 4)}` : `${capital(monthShort(from))} – ${monthShort(to)} ${to.slice(0, 4)}`;
  }
  return `${capital(monthShort(from))} ${from.slice(0, 4)} – ${monthShort(to)} ${to.slice(0, 4)}`;
}

// Liste des mois proposés dans la période choisie : du plus récent au plus ancien.
export const monthChoices = (current, count = 36) => Array.from({ length: count }, (_, i) => shiftMonth(current, -i));
export const rangeQuery = ({ from, to }) => `from=${from}&to=${to}`;
