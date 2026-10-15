// src/components/sequenceMail/model.js
//
// Vocabulaire et règles métier du mini client e-mail : phases, séquences, statuts, clé
// d'identification d'un e-mail, délai entre deux étapes. Aucun accès réseau ni React ici : module
// pur, testé sous Node (`model.test.js`).

import { MINUTE_MS, dayDiff, fmtWeekday, fmtWhenLong, fmtWhenShort, humanSpan, relToLive } from './format.js';

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

/** @brief Couleur de repère d'une cohorte selon son public (`grey` quand le public n'est pas connu). */
export function audienceTone(audience) {
  if (!audience) return 'grey';
  return /ambulance/i.test(audience) ? 'green' : 'blue';
}

const SEP = '::';

/** @brief Clé stable d'un e-mail : cohorte + type d'e-mail. */
export const emailKey = (cohortId, kind) => `${cohortId}${SEP}${kind}`;

export function parseKey(key) {
  const s = String(key);
  const i = s.indexOf(SEP);
  return i < 0 ? { cohortId: '', kind: s } : { cohortId: s.slice(0, i), kind: s.slice(i + SEP.length) };
}

/**
 * @brief Titre affiché d'un e-mail (liste, onglet, fenêtre, précédent/suivant) : son objet ; sans objet,
 * « (sans objet) » s'il a un corps, sinon son type technique.
 * @param item E-mail de liste (`hasContent`) ou étape de séquence (`html` / `text`).
 */
export function titleOf(item) {
  if (!item) return '';
  if (item.subject) return item.subject;
  const hasBody = item.hasContent ?? Boolean(item.html || item.text);
  return hasBody ? '(sans objet)' : String(item.kind ?? '');
}

/**
 * @brief Statuts d'un e-mail, déduits des vrais compteurs d'envoi (jamais inventés).
 * @note Objets figés et PARTAGÉS : un même statut est toujours le même objet, ce qui garde stables les e-mails
 * dérivés (et donc les lignes mémoïsées de la liste) quand rien n'a changé.
 */
const status = (key, label, tone) => Object.freeze({ key, label, tone });
const STATUS = {
  sent: status('sent', 'Envoyé', 'green'),
  sending: status('sending', "En cours d'envoi", 'amber'),
  scheduled: status('scheduled', 'Planifié', 'blue'),
  upcoming: status('upcoming', 'À venir', 'blue'),
  idle: status('idle', 'Aucun envoi', 'grey'),
  loading: status('loading', 'Chargement…', 'grey'),
  notloaded: status('notloaded', 'Compteurs non relevés : ouvrez la cohorte', 'grey'),
  unknown: status('unknown', 'Statut indisponible', 'grey'),
};

/**
 * @brief Statut d'un e-mail à partir des compteurs d'envoi de sa cohorte.
 * @param step Étape (avec `timing`).
 * @param stats Entrée de `stats[cohorte]` (`{ status, fetchedAt, byKind }`) ou undefined.
 * @param nowMs Instant de référence.
 * @returns Un statut `{ key, label, tone }` :
 *  - `notloaded` : les compteurs de cette cohorte n'ont JAMAIS été demandés (vue « Toutes les cohortes ») ;
 *  - `loading` : un premier relevé est réellement en vol ; pendant un NOUVEAU relevé, les statuts du dernier
 *    relevé réussi restent affichés (pas de clignotement) ;
 *  - `unknown` : le relevé a échoué, ou la cohorte n'existe pas dans le CRM.
 */
export function stepStatus(step, stats, nowMs) {
  if (!stats || stats.status === 'idle') return STATUS.notloaded;
  if (stats.status === 'loading') {
    if (!Number.isFinite(stats.fetchedAt)) return STATUS.loading;
  } else if (stats.status !== 'ready') {
    return STATUS.unknown;
  }
  const s = stats.byKind?.[step.kind];
  const sent = s?.sent ?? 0;
  const pending = s?.pending ?? 0;
  const failed = s?.failed ?? 0;
  if (sent > 0 && pending > 0) return STATUS.sending;
  if (sent > 0) return STATUS.sent;
  if (pending > 0) return STATUS.scheduled;
  if (failed > 0) return STATUS.idle;
  if (step.timing?.mode === 'calendar' && Date.parse(step.timing.at) > nowMs) return STATUS.upcoming;
  return STATUS.idle;
}

/** @brief Voisins d'une étape dans sa séquence (et son segment), triés par ordre d'envoi. */
export function neighborsOf(steps, step) {
  const same = steps.filter((s) => s.sequence === step.sequence && (s.segment || null) === (step.segment || null));
  const i = same.findIndex((s) => s.kind === step.kind);
  return { prev: i > 0 ? same[i - 1] : null, next: i >= 0 && i < same.length - 1 ? same[i + 1] : null };
}

/** @brief Minutes depuis minuit d'une heure « HH:MM », ou `null`. */
function clockMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** @brief « 8 à 48 h » lu dans le libellé d'un envoi espacé (« Espacé de 8 à 48 h après l'inscription… »), ou `null`. */
function pacedSpan(label) {
  const m = /(\d+)\s*(?:à|-|–|—)\s*(\d+)\s*h\b/i.exec(String(label ?? ''));
  return m ? `${m[1]} à ${m[2]} h` : null;
}

/**
 * @brief Délai entre deux étapes consécutives, si les deux planifications sont comparables.
 * @returns Un texte (« 3 j 7 h », « 1 jour », « 22 h », « 8 à 48 h »…) ou `null` quand le délai n'est pas
 * calculable : jamais « NaN », jamais un délai inventé.
 * @note `signup-days` tient compte de l'heure (J+1 11h → J+2 9h = 22 h, pas « 1 jour ») ; `paced` reprend
 * l'intervalle écrit dans `timing.label` ; deux modes différents ne sont pas comparables.
 */
export function delayBetween(from, to) {
  if (!from || !to) return null;
  const a = from.timing;
  const b = to.timing;
  if (a?.mode === 'calendar' && b?.mode === 'calendar') {
    const ms = Date.parse(b.at) - Date.parse(a.at);
    return Number.isFinite(ms) && ms >= 0 ? humanSpan(ms) : null;
  }
  if (a?.mode === 'signup-days' && b?.mode === 'signup-days') {
    const days = Number(b.days) - Number(a.days);
    if (!Number.isFinite(days) || days < 0) return null;
    const ta = clockMinutes(a.time);
    const tb = clockMinutes(b.time);
    if (ta !== null && tb !== null && ta !== tb) {
      const minutes = days * 1440 + (tb - ta);
      return minutes >= 0 ? humanSpan(minutes * 60000) : null;
    }
    // Même format que les autres délais (« 1 j », « 3 j 7 h ») : le schéma mélangeait « 1 jour » et « 1 j ».
    return humanSpan(days * 1440 * MINUTE_MS);
  }
  if (a?.mode === 'signup-delay' && b?.mode === 'signup-delay') {
    const minutes = Number(b.minutes) - Number(a.minutes);
    return Number.isFinite(minutes) && minutes >= 0 ? humanSpan(minutes * 60000) : null;
  }
  if (a?.mode === 'paced' && b?.mode === 'paced') return pacedSpan(b.label) ?? pacedSpan(a.label);
  return null;
}

const PER_SIGNUP_NOTE = 'Date propre à chaque inscrit';

/**
 * @brief Description humaine du moment d'envoi d'une étape, un libellé par mode de planification.
 * @returns `{ when, note, relation, weekday, short }` — champs vides quand la donnée n'existe pas :
 *  - `calendar` : date longue, jour de la semaine, position par rapport au live ;
 *  - `signup-days` / `signup-delay` : libellé de l'étape + délai depuis l'inscription ;
 *  - `paced` : l'intervalle écrit dans `timing.label` ;
 *  - tout autre mode (`unknown`…) : rien — aucun texte n'est deviné.
 */
export function describeTiming(step, liveAt, nowMs = Date.now()) {
  const t = step?.timing || {};
  switch (t.mode) {
    case 'calendar':
      return {
        when: fmtWhenLong(t.at),
        note: t.label || '',
        relation: liveAt ? relToLiveText(t.at, liveAt) : '',
        weekday: fmtWeekday(t.at),
        short: fmtWhenShort(t.at, nowMs),
      };
    case 'signup-days': {
      const days = Number(t.days);
      const relation = Number.isFinite(days)
        ? `${days} jour${days > 1 ? 's' : ''} après l'inscription${step?.sequence === 'pre' ? ', avant le live' : ''}`
        : '';
      return { when: t.label || relation, note: PER_SIGNUP_NOTE, relation, weekday: '', short: shortRelative(t) };
    }
    case 'signup-delay': {
      const minutes = Number(t.minutes);
      const relation = Number.isFinite(minutes) ? `${humanSpan(minutes * 60000)} après l'inscription` : '';
      return { when: t.label || relation, note: PER_SIGNUP_NOTE, relation, weekday: '', short: shortRelative(t) };
    }
    case 'paced':
      return { when: t.label || '', note: PER_SIGNUP_NOTE, relation: t.label || '', weekday: '', short: shortRelative(t) };
    default:
      return { when: '', note: '', relation: '', weekday: '', short: '' };
  }
}

/** @brief Libellé court de la colonne « heure » d'une ligne. */
export function shortRelative(t) {
  if (!t) return '';
  if (t.mode === 'signup-days') return `J+${t.days}${t.time ? ` · ${String(t.time).replace(':', 'h')}` : ''}`;
  if (t.mode === 'signup-delay') {
    const minutes = Number(t.minutes);
    return Number.isFinite(minutes) ? `+${humanSpan(minutes * 60000)}` : '';
  }
  if (t.mode === 'paced') {
    const span = pacedSpan(t.label);
    return span ? `Espacé ${span}` : 'Espacé';
  }
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

/**
 * @brief Étape SYNTHÉTISÉE pour un type d'e-mail connu du seul CRM (aucun contenu local pour sa cohorte).
 * @param kind Type technique de l'e-mail (`email_marc_story`…).
 * @param index Rang (0-based) parmi les types connus de la cohorte, triés par nom.
 * @param count Nombre de types connus de la cohorte.
 * @note `fallback: true` marque l'étape comme synthétisée : l'interface dit « contenu local absent » au lieu
 * de présenter ces champs comme des données. Source UNIQUE de ces étapes (liste et lecteur).
 */
export function fallbackStep(kind, index = 0, count = 1) {
  return {
    kind,
    fallback: true,
    order: index + 1,
    sequence: 'pre',
    sequenceIndex: index + 1,
    sequenceCount: count,
    phase: kind.includes('post') ? 'post' : 'nurture',
    segment: null,
    subject: '',
    snippet: '',
    timing: { mode: 'unknown' },
    conditions: [],
    tags: [],
    headers: [],
    attachments: [],
    links: [],
    text: '',
  };
}

/** @brief Deux e-mails dérivés portent exactement les mêmes valeurs (comparaison superficielle). */
function sameEmail(a, b) {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

/**
 * @brief Réutilise les objets de `prev` qui n'ont pas changé : des e-mails identiques gardent leur identité,
 * ce qui permet aux lignes mémoïsées de la liste de ne pas se redessiner (tic d'horloge, brouillon d'une
 * AUTRE cohorte…).
 * @returns `prev` lui-même si rien n'a changé (même tableau), sinon un nouveau tableau mêlant objets réutilisés
 * et objets neufs.
 */
export function reuseStable(prev, next) {
  if (!prev || prev.length === 0) return next;
  const before = new Map(prev.map((e) => [e.key, e]));
  const out = next.map((e) => {
    const old = before.get(e.key);
    return old && sameEmail(old, e) ? old : e;
  });
  return out.length === prev.length && out.every((e, i) => e === prev[i]) ? prev : out;
}
