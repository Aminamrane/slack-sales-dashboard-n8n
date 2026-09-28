// src/components/sequenceMail/model.js
//
// Vocabulaire et règles métier du mini client e-mail : phases, séquences, statuts, clé
// d'identification d'un e-mail, délai entre deux étapes. Aucun accès réseau ni React ici.

import { dayDiff, fmtWeekday, fmtWhenLong, fmtWhenShort, humanSpan, relToLive } from './format';

/** @brief Phases d'une séquence, dans l'ordre d'affichage. */
export const PHASES = {
  confirmation: { label: 'Confirmation', tone: 'blue', order: 0 },
  nurture: { label: 'Nurturing', tone: 'purple', order: 1 },
  reminder: { label: 'Rappels', tone: 'amber', order: 2 },
  liveday: { label: 'Jour J', tone: 'red', order: 3 },
  post: { label: 'Post-webinaire', tone: 'green', order: 4 },
  oneshot: { label: 'Envoi ponctuel', tone: 'grey', order: 5 },
};

export const SEQUENCES = {
  pre: { label: 'Pré-webinaire', order: 0 },
  post: { label: 'Post-webinaire', order: 1 },
  oneshot: { label: 'Envois ponctuels', order: 2 },
};

export const SEGMENTS = {
  missed: 'Absents',
  attended: 'Présents',
  all: 'Tous les inscrits',
};

/** @brief Couleur de repère d'une cohorte selon son public. */
export function audienceTone(audience) {
  return /ambulance/i.test(audience || '') ? 'green' : 'blue';
}

const SEP = '::';

/** @brief Clé stable d'un e-mail : cohorte + type d'e-mail. */
export const emailKey = (cohortId, kind) => `${cohortId}${SEP}${kind}`;

export function parseKey(key) {
  const i = String(key).indexOf(SEP);
  return i < 0 ? { cohortId: '', kind: String(key) } : { cohortId: key.slice(0, i), kind: key.slice(i + SEP.length) };
}

/** @brief Statuts d'un e-mail, déduits des vrais compteurs d'envoi (jamais inventés). */
const STATUS = {
  sent: { label: 'Envoyé', tone: 'green' },
  sending: { label: "En cours d'envoi", tone: 'amber' },
  scheduled: { label: 'Planifié', tone: 'blue' },
  upcoming: { label: 'À venir', tone: 'blue' },
  idle: { label: 'Aucun envoi', tone: 'grey' },
  loading: { label: 'Chargement…', tone: 'grey' },
  unknown: { label: 'Statut indisponible', tone: 'grey' },
};

/**
 * @brief Statut d'un e-mail à partir des compteurs d'envoi de sa cohorte.
 * @param step Étape (avec `timing`).
 * @param stats Entrée de `stats[cohorte]` (`{ status, byKind }`) ou undefined.
 * @param nowMs Instant de référence.
 */
export function stepStatus(step, stats, nowMs) {
  if (!stats || stats.status === 'idle' || stats.status === 'loading') return { key: 'loading', ...STATUS.loading };
  if (stats.status !== 'ready') return { key: 'unknown', ...STATUS.unknown };
  const s = stats.byKind?.[step.kind];
  const sent = s?.sent ?? 0;
  const pending = s?.pending ?? 0;
  const failed = s?.failed ?? 0;
  if (sent > 0 && pending > 0) return { key: 'sending', ...STATUS.sending };
  if (sent > 0) return { key: 'sent', ...STATUS.sent };
  if (pending > 0) return { key: 'scheduled', ...STATUS.scheduled };
  if (failed > 0) return { key: 'idle', ...STATUS.idle };
  if (step.timing?.mode === 'calendar' && Date.parse(step.timing.at) > nowMs) return { key: 'upcoming', ...STATUS.upcoming };
  return { key: 'idle', ...STATUS.idle };
}

/** @brief Voisins d'une étape dans sa séquence (et son segment), triés par ordre d'envoi. */
export function neighborsOf(steps, step) {
  const same = steps.filter((s) => s.sequence === step.sequence && (s.segment || null) === (step.segment || null));
  const i = same.findIndex((s) => s.kind === step.kind);
  return { prev: i > 0 ? same[i - 1] : null, next: i >= 0 && i < same.length - 1 ? same[i + 1] : null };
}

/** @brief Délai entre deux étapes consécutives, si les deux planifications sont comparables. */
export function delayBetween(from, to) {
  if (!from || !to) return null;
  const a = from.timing;
  const b = to.timing;
  if (a?.mode === 'calendar' && b?.mode === 'calendar') return humanSpan(Date.parse(b.at) - Date.parse(a.at));
  if (a?.mode === 'signup-days' && b?.mode === 'signup-days') {
    const d = b.days - a.days;
    return `${d} jour${d > 1 ? 's' : ''}`;
  }
  if (a?.mode === 'signup-delay' && b?.mode === 'signup-delay') return `${b.minutes - a.minutes} min`;
  return null;
}

/**
 * @brief Description humaine du moment d'envoi d'une étape.
 * @returns `{ when, note, relation, weekday }` — champs vides quand la donnée n'existe pas.
 */
export function describeTiming(step, liveAt, nowMs = Date.now()) {
  const t = step.timing || {};
  if (t.mode === 'calendar') {
    return {
      when: fmtWhenLong(t.at),
      note: t.label || '',
      relation: liveAt ? relToLiveText(t.at, liveAt) : '',
      weekday: fmtWeekday(t.at),
      short: fmtWhenShort(t.at, nowMs),
    };
  }
  const relation =
    t.mode === 'signup-days'
      ? `${t.days} jour${t.days > 1 ? 's' : ''} après l'inscription, avant le live`
      : 'Dès l\'inscription';
  return { when: t.label || '', note: 'Date propre à chaque inscrit', relation, weekday: '', short: shortRelative(t) };
}

/** @brief Libellé court de la colonne « heure » d'une ligne. */
export function shortRelative(t) {
  if (!t) return '';
  if (t.mode === 'signup-days') return `J+${t.days} · ${String(t.time || '').replace(':', 'h')}`;
  if (t.mode === 'signup-delay') return `+${t.minutes} min`;
  if (t.mode === 'paced') return 'Espacé 8–48 h';
  return t.label || '';
}

function relToLiveText(atIso, liveIso) {
  const n = dayDiff(liveIso, atIso);
  if (n === null) return '';
  const tag = relToLive(atIso, liveIso);
  if (n === 0) return `${tag} · jour du live`;
  const abs = Math.abs(n);
  return `${tag} · ${abs} jour${abs > 1 ? 's' : ''} ${n < 0 ? 'avant' : 'après'} le live`;
}

/** @brief Ordre d'affichage des groupes d'une cohorte : phase, puis segment. */
export const phaseOrder = (phase) => PHASES[phase]?.order ?? 99;
