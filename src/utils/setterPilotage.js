// setterPilotage.js : la logique pure de l'onglet « Pilotage setting » (tracking sheet setter).
//
// Demande dev 01/10/2026, pour le manager des setters : la feuille « PILOTAGE SETTING, SAISIE
// RAPIDE » en ligne. Une ligne par setter et par jour : chiffres calculés (appels Allo, RDV pris,
// honorés, no-show) et trois cellules saisies par le manager (discours 1 à 5, blocage principal,
// action de coaching). Séparée de l'écran pour être testée (setterPilotage.test.js), aucun React ici.
//
// Règles :
//   - Les jours sont des jours de Paris en « YYYY-MM-DD », manipulés comme des chaînes : jamais de
//     new Date(iso) sur une date CRM (heure-mur).
//   - « Mois en cours » va du 1er à aujourd'hui ; une plage personnalisée fait au plus 31 jours
//     (même limite que l'API, qui refuse end - start >= 31 jours) et ne dépasse pas aujourd'hui.
//   - La colonne « R2 posés » n'apparaît que si la période en contient au moins un (show_r2).
//   - Une saisie vide part en null, seuls les champs modifiés partent ; le serveur renvoie la ligne
//     enregistrée, fusionnée dans l'état.

import { parisToday, PARIS_ZONE } from './parisDates.js';

export { parisToday };

export const MAX_RANGE_DAYS = 31;
export const BLOCAGE_MAX = 200;
export const ACTION_MAX = 2000;
export const SUGGESTIONS_MAX = 30;
export const DISCOURS_SCORES = [1, 2, 3, 4, 5];

// « Blocage principal » : texte libre avec suggestions tant que la liste n'est pas arrêtée.
// Pour passer à une liste fermée, remplacer null par le tableau des libellés : la cellule devient
// une liste déroulante, sans autre changement.
export const BLOCAGE_CHOICES = null;

export const PERIOD_MODES = [
  { key: 'day', label: 'Jour' },
  { key: 'month', label: 'Mois en cours' },
  { key: 'last_month', label: 'Mois dernier' },
  { key: 'custom', label: 'Période' },
];

export const ALLO_LABELS = { missing: 'Pas de compte Allo', error: 'Allo indisponible' };

/* ─────────────────────────────── Dates ─────────────────────────────── */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDay(value) {
  const m = ISO_DAY.exec(String(value || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

const toUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export function shiftDay(iso, days) {
  return new Date(toUtc(iso) + days * 86400000).toISOString().slice(0, 10);
}

// Nombre de jours de la plage, bornes comprises (1 pour un seul jour).
export function daysInclusive(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / 86400000) + 1;
}

export function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function lastMonthRange(today) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, '0');
  return { start: `${py}-${mm}-01`, end: `${py}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

// Contrôle d'une plage saisie : '' si elle est valable, sinon le message à afficher.
export function customRangeError(start, end, today) {
  if (!start || !end) return 'Choisissez une date de début et une date de fin.';
  if (!isIsoDay(start) || !isIsoDay(end)) return 'Date invalide.';
  if (start > end) return 'La date de début doit précéder la date de fin.';
  if (end > today) return "La période ne peut pas dépasser aujourd'hui.";
  if (daysInclusive(start, end) > MAX_RANGE_DAYS) return `Période limitée à ${MAX_RANGE_DAYS} jours.`;
  return '';
}

// Période demandée à l'API selon le mode choisi. `error` non vide : rien à charger.
export function resolvePeriod({ mode, day, from, to }, today = parisToday()) {
  if (mode === 'day') {
    const d = isIsoDay(day) && day <= today ? day : today;
    return { start: d, end: d, error: '' };
  }
  if (mode === 'month') return { start: monthStart(today), end: today, error: '' };
  if (mode === 'last_month') return { ...lastMonthRange(today), error: '' };
  const error = customRangeError(from, to, today);
  return { start: from || '', end: to || '', error };
}

/* ───────────────────────────── Formats ───────────────────────────── */

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEKDAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

const weekday = (iso) => new Date(toUtc(iso)).getUTCDay();
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// « Lun. 28 sept. »
export function fmtDayShort(iso) {
  return `${WEEKDAYS_SHORT[weekday(iso)]} ${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
}

// « Mercredi 1 octobre 2026 »
export function fmtDayLong(iso) {
  return capitalize(`${WEEKDAYS[weekday(iso)]} ${Number(iso.slice(8, 10))} ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`);
}

// « Du 1 sept. au 30 sept. 2026 », ou le jour seul.
export function fmtPeriod(start, end) {
  if (!start || !end) return '';
  if (start === end) return fmtDayLong(start);
  const d = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
  const startYear = start.slice(0, 4) === end.slice(0, 4) ? '' : ` ${start.slice(0, 4)}`;
  return `Du ${d(start)}${startYear} au ${d(end)} ${end.slice(0, 4)}`;
}

// Arrondi à la minute d'abord, pour que 59 min 59 s donne « 1 h 00 » et jamais « 60 min ».
export function fmtTalk(seconds) {
  if (seconds == null) return '–';
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

export function fmtAverage(seconds, calls) {
  if (seconds == null || !calls) return '–';
  const avg = Math.round(seconds / calls);
  return avg < 60 ? `${avg} s` : `${Math.floor(avg / 60)} min ${String(avg % 60).padStart(2, '0')}`;
}

export function fmtScore(value) {
  if (value == null || !Number.isFinite(Number(value))) return '–';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.round(Number(value) * 10) / 10);
}

// updated_at est un vrai instant serveur (timestamptz), pas une date CRM : affiché à l'heure de Paris.
export function fmtSavedAt(instant) {
  const d = instant ? new Date(instant) : null;
  if (!d || !Number.isFinite(d.getTime())) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_ZONE, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS_SHORT[Number(p.month) - 1]} ${p.year} à ${p.hour} h ${p.minute}`;
}

export function reviewTooltip(review) {
  if (!review?.updated_at) return '';
  const at = fmtSavedAt(review.updated_at);
  return review.updated_by_name ? `Saisi par ${review.updated_by_name}, le ${at}` : `Saisi le ${at}`;
}

/* ─────────────────────────── Tableau ─────────────────────────── */

// Ordre des colonnes de la feuille ; « R2 posés » seulement si la période en contient.
export function columnsFor(showR2) {
  return [
    'calls', 'answered', 'r1', 'held', 'no_show',
    ...(showR2 ? ['r2'] : []),
    'duration', 'average', 'discours', 'blocage', 'action',
  ];
}

export const COLUMN_LABELS = {
  calls: 'Appels', answered: 'Appels répondus', r1: 'RDV pris', held: 'RDV honorés', no_show: 'No-show',
  r2: 'R2 posés', duration: 'Temps au téléphone', average: 'Durée moyenne',
  discours: 'Discours (1-5)', blocage: 'Blocage principal', action: 'Action / coaching',
};

export const MANUAL_COLUMNS = ['discours', 'blocage', 'action'];

// show_r2 vient de l'API ; recalculé seulement si le champ manque.
export function shouldShowR2(data) {
  if (typeof data?.show_r2 === 'boolean') return data.show_r2;
  return (data?.setters || []).some((s) => (s.totals?.r2 || 0) > 0 || (s.days || []).some((d) => (d.r2 || 0) > 0));
}

// Les setters actifs d'abord, l'ordre de l'API (par nom) conservé : la feuille ne saute pas.
export function sortSetters(setters) {
  return [...(setters || [])].sort((a, b) => Number(b.active !== false) - Number(a.active !== false));
}

export function newestFirst(days) {
  return [...(days || [])].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

// Totaux de l'équipe pour les cartes du haut. Les appels ne comptent que les setters reliés à Allo.
export function teamTotals(setters) {
  const t = { calls: null, answered: null, duration: null, r1: 0, r2: 0, held: 0, no_show: 0, to_qualify: 0 };
  for (const s of setters || []) {
    const x = s.totals || {};
    if (s.allo === 'linked') {
      t.calls = (t.calls || 0) + (x.calls || 0);
      t.answered = (t.answered || 0) + (x.answered || 0);
      t.duration = (t.duration || 0) + (x.duration || 0);
    }
    for (const k of ['r1', 'r2', 'held', 'no_show', 'to_qualify']) t[k] += x[k] || 0;
  }
  return t;
}

// Blocage le plus cité sur la période (à égalité, le plus récent), avec son nombre de jours.
export function topBlocage(days) {
  const counts = new Map();
  for (const d of newestFirst(days)) {
    const label = (d.review?.blocage || '').trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase('fr');
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  let best = null;
  for (const v of counts.values()) if (!best || v.count > best.count) best = v;
  return best;
}

export function notedDays(days) {
  return (days || []).filter((d) => d.review && (d.review.discours != null || d.review.blocage || d.review.action)).length;
}

export function discoursAverage(days) {
  const scores = (days || []).map((d) => d.review?.discours).filter((v) => Number.isFinite(v));
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

/* ─────────────────────────── Saisie ─────────────────────────── */

export const reviewKey = (setterId, day) => `${setterId}|${day}`;

const cleanText = (value) => {
  const s = typeof value === 'string' ? value.trim() : '';
  return s ? s : null;
};

const cleanScore = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

// Valeurs telles qu'elles partent à l'API : texte rogné, vide = null, note entière de 1 à 5.
export function normalizeReview(review) {
  return {
    discours: cleanScore(review?.discours),
    blocage: cleanText(review?.blocage),
    action: cleanText(review?.action),
  };
}

// Ce qui s'affiche dans une ligne : la saisie en cours l'emporte sur la valeur enregistrée.
export function effectiveReview(serverReview, draft) {
  return {
    discours: serverReview?.discours ?? null,
    blocage: serverReview?.blocage ?? '',
    action: serverReview?.action ?? '',
    ...(draft || {}),
  };
}

export function sameReview(a, b) {
  const x = normalizeReview(a);
  const y = normalizeReview(b);
  return x.discours === y.discours && x.blocage === y.blocage && x.action === y.action;
}

// Corps du PUT : seuls les champs qui diffèrent de la ligne connue (`base`) partent. Le serveur
// garde les champs absents : une page ouverte depuis longtemps, ou un second éditeur, n'efface
// pas ce qu'un autre a saisi entre-temps sur les cellules qu'il n'a pas touchées.
export function reviewPayload(setterId, day, review, base = null) {
  const next = normalizeReview(review);
  const known = normalizeReview(base);
  const changed = Object.fromEntries(Object.entries(next).filter(([field, value]) => value !== known[field]));
  return { setter_id: setterId, day, ...changed };
}

// Après un enregistrement, une saisie identique à la valeur enregistrée n'a plus lieu d'être ;
// une saisie différente (texte tapé pendant l'envoi) est gardée. Le champ où le curseur se trouve
// (`focused`) n'est retiré que s'il est identique au caractère près, pour ne pas déplacer le curseur.
export function pruneDraft(draft, saved, focused = null) {
  if (!draft) return null;
  const next = {};
  for (const [field, value] of Object.entries(draft)) {
    const stored = saved?.[field] ?? null;
    let same;
    if (field === 'discours') same = cleanScore(value) === stored;
    else if (field === focused) same = value === stored || (value === '' && stored === null);
    else same = cleanText(value) === stored;
    if (!same) next[field] = value;
  }
  return Object.keys(next).length ? next : null;
}

// Suggestions de blocage : la valeur enregistrée passe en tête, sans doublon, 30 au plus.
export function mergeSuggestions(suggestions, blocage) {
  const list = [...(suggestions || [])];
  const label = cleanText(blocage);
  if (!label) return list.slice(0, SUGGESTIONS_MAX);
  const key = label.toLocaleLowerCase('fr');
  return [label, ...list.filter((s) => String(s).toLocaleLowerCase('fr') !== key)].slice(0, SUGGESTIONS_MAX);
}

// Fusion de la réponse du PUT dans la réponse du GET, sans la recharger (Allo n'est pas relu).
export function mergeSavedReview(data, saved) {
  if (!data || !saved) return data;
  const review = {
    discours: saved.discours ?? null,
    blocage: saved.blocage ?? null,
    action: saved.action ?? null,
    updated_at: saved.updated_at ?? null,
    updated_by_name: saved.updated_by_name ?? null,
  };
  let touched = false;
  const setters = (data.setters || []).map((s) => {
    if (s.id !== saved.setter_id) return s;
    let hit = false;
    const days = (s.days || []).map((d) => {
      if (d.day !== saved.day) return d;
      hit = true;
      return { ...d, review };
    });
    if (!hit) return s;
    touched = true;
    return { ...s, days, totals: { ...s.totals, discours_avg: discoursAverage(days) } };
  });
  if (!touched) return data;
  return { ...data, setters, blocage_suggestions: mergeSuggestions(data.blocage_suggestions, review.blocage) };
}

// Choix proposés pour le blocage : liste fermée si BLOCAGE_CHOICES est renseigné, sinon suggestions.
export function blocageChoices(suggestions, fixed = BLOCAGE_CHOICES) {
  if (Array.isArray(fixed)) return { mode: 'fixed', options: fixed };
  return { mode: 'free', options: (suggestions || []).slice(0, SUGGESTIONS_MAX) };
}
