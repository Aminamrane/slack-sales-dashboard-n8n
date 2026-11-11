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
