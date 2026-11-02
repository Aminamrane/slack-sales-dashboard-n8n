// Appels Allo d'un setter dans le détail de ses RDV (page CEO « Setters », ticket du 23/10/2026) : logique pure, testée.
// Données : GET /api/v1/ceo-dashboard/setters/{id}/prospect-calls (backend : app/services/setter_prospect_calls.py). Le rapprochement
// appel ↔ prospect se fait côté serveur, par le NUMÉRO de téléphone ; ici on lit et on met en forme, sans rien recalculer d'autre que des
// repères de lecture (rang de l'appel, délai depuis le précédent, avant / après la pose du RDV).
// Jamais un 0 inventé : « pas de compte Allo », « Allo indisponible », « appels depuis telle date » sont dits.
// Toutes les heures sont celles de Paris, comme les RDV de la fiche.
import { fmtInt } from './settersStats.js';

export const prospectCallsPath = (setterId) => `/api/v1/ceo-dashboard/setters/${encodeURIComponent(setterId)}/prospect-calls`;

// ── États d'un appel ─────────────────────────────────────────────────────────────────────────────────────
// Calculés par le serveur : répondu par une personne, tombé sur une messagerie (Allo le classe « répondu »), resté sans réponse, ou
// appel entrant (le prospect a rappelé).
export const STATE_LABELS = { human: 'Répondu', voicemail: 'Répondeur', no_answer: 'Sans réponse', inbound: 'Entrant' };
// Couleur du point qui précède l'état d'un appel : foncée en clair, claire en sombre.
export const STATE_TONES = { human: '#047857', voicemail: '#92400e', no_answer: '#475569', inbound: '#1d4ed8' };
export const STATE_TONES_DARK = { human: '#34d399', voicemail: '#fbbf24', no_answer: '#94a3b8', inbound: '#60a5fa' };
export const toneOf = (state, dark = false) => (dark ? STATE_TONES_DARK : STATE_TONES)[state] || (dark ? STATE_TONES_DARK : STATE_TONES).no_answer;
export const STATE_HINTS = {
  human: 'Appel sortant : une personne a répondu.',
  voicemail: 'Appel sortant : tombé sur une messagerie. Allo compte ces appels « répondus » ; la messagerie est détectée à part.',
  no_answer: 'Appel sortant resté sans réponse.',
  inbound: 'Appel entrant : le prospect a rappelé le setter.',
};
const INBOUND_LABELS = { answered: 'Entrant · décroché', voicemail: 'Entrant · message vocal', missed: 'Entrant · non décroché' };
const WORDS = {
  human: ['répondu', 'répondus'], voicemail: ['répondeur', 'répondeurs'], no_answer: ['sans réponse', 'sans réponse'], inbound: ['entrant', 'entrants'],
};

// ── Étiquettes d'Allo sur un appel (« à rappeler », « RDV pris »…) ──────────────────────────────────────────
export const TAG_LABELS = {
  to_call_back: 'À rappeler', not_interested: 'Pas intéressé', follow_up_later: 'À relancer plus tard', interested: 'Intéressé',
  meeting_booked: 'RDV pris', demo: 'Démo',
};
const TAG_KINDS = { meeting_booked: 'good', interested: 'good', demo: 'info', to_call_back: 'todo', follow_up_later: 'todo', not_interested: 'bad' };
export const TAG_TONES = { good: '#047857', info: '#1d4ed8', todo: '#92400e', bad: '#b91c1c', other: '#475569' };
export const TAG_TONES_DARK = { good: '#34d399', info: '#60a5fa', todo: '#fbbf24', bad: '#f87171', other: '#94a3b8' };
export function tagLabel(tag) {
  const key = String(tag || '').trim().toLowerCase();
  if (TAG_LABELS[key]) return TAG_LABELS[key];
  const text = key.replace(/[_-]+/g, ' ').trim();                    // une étiquette qu'on ne connaît pas encore reste lisible
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}
export const tagTone = (tag, dark = false) => (dark ? TAG_TONES_DARK : TAG_TONES)[TAG_KINDS[String(tag || '').toLowerCase()] || 'other'];

// ── Dates et durées (heure de Paris) ─────────────────────────────────────────────────────────────────────
const PARIS = 'Europe/Paris';
const dayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'short', day: 'numeric', month: 'short' });
const hourFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' });
const wallFmt = new Intl.DateTimeFormat('en-US', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' });

const asDate = (iso) => {
  const date = new Date(iso);
  return !iso || Number.isNaN(date.getTime()) ? null : date;
};

// « jeu. 22 oct. · 14 h 05 » ; chaîne vide si la date est illisible.
export function fmtCallAt(iso) {
  const date = asDate(iso);
  if (!date) return '';
  const parts = Object.fromEntries(hourFmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.minute === '00' ? `${Number(parts.hour)} h` : `${Number(parts.hour)} h ${parts.minute}`;
  return `${dayFmt.format(date)} · ${hour}`;
}

// « 14 h 05 », toujours avec les minutes (la colonne des heures d'un tableau d'appels).
export function fmtClock(iso) {
  const date = asDate(iso);
  if (!date) return '';
  const parts = Object.fromEntries(hourFmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${Number(parts.hour)} h ${parts.minute}`;
}

// « ven. 16 oct. » : le jour de Paris d'un appel.
export function fmtDayLabel(iso) {
  const date = asDate(iso);
  return date ? dayFmt.format(date) : '';
}

// « 2026-10-16 » : le jour de Paris d'un appel, clé de regroupement (un appel passé après minuit appartient au jour suivant).
export function dayKey(iso) {
  const date = asDate(iso);
  return date ? keyFmt.format(date) : '';
}

// « 21 sept. » d'un jour « AAAA-MM-JJ ».
export function fmtDayMonth(day) {
  const date = new Date(`${String(day || '')}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : dayMonthFmt.format(date);
}

// Durée d'un appel : « – » quand elle est inconnue, « 45 s », « 4 min 12 s », « 1 h 02 min ».
export function fmtTalkSeconds(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '–';
  const total = Math.round(Number(seconds));
  if (total < 60) return `${total} s`;
  if (total < 3600) return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
  return `${Math.floor(total / 3600)} h ${String(Math.floor((total % 3600) / 60)).padStart(2, '0')} min`;
}

// Un cumul : « 52 min », « 4 h 18 » (comme la tuile « Appels Allo » de la fiche).
export function fmtTotal(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '–';
  const minutes = Math.round(Number(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

// Un délai : « moins d'1 min », « 12 min », « 2 h 38 », « 1 j 4 h » ; vide s'il est négatif ou inconnu.
export function fmtGap(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '';
  const total = Math.round(Number(seconds));
  if (total < 60) return "moins d'1 min";
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} j ${hours % 24} h` : `${days} j`;
}

export const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);

// Instant (ms) d'une heure-mur de Paris (« 2026-10-15T14:00:00 », celle des RDV du CRM) ; null si illisible.
function parisOffsetMs(ms) {
  const p = Object.fromEntries(wallFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(ms / 1000) * 1000;
}
export function parisWallToMs(wall) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(wall || ''));
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  const first = guess - parisOffsetMs(guess);
  return guess - parisOffsetMs(first);                               // deuxième passage : l'heure d'été / d'hiver tombe au bon instant
}

const plural = (n, [one, many]) => `${fmtInt(n)} ${n > 1 ? many : one}`;
// Une phrase se termine par un seul point, même quand sa dernière abréviation (« oct. ») en porte déjà un.
const sentence = (text) => (text.endsWith('.') ? text : `${text}.`);
const pct = (part, whole) => (whole ? Math.round((100 * part) / whole) : null);

// ── Ce que la fiche d'un RDV doit montrer ────────────────────────────────────────────────────────────────
// `calls` = { state: 'loading' | 'unavailable' | 'ready', data }.
//   hidden      : rien (route absente, refusée, ou prospect non interrogé) ; l'écran existant reste tel quel
//   loading / missing / error : rien sur la ligne ; le cadre d'ensemble (`overviewOf`) le dit une fois pour tous les RDV
//   calls       : au moins un appel de ce setter vers ce numéro (`entry`)
//   none / before_allo / no_phone : une phrase (`noteOf`)
export function rdvCallsView(calls, leadId) {
  if (!calls || calls.state === 'unavailable') return { kind: 'hidden' };
  if (calls.state === 'loading') return { kind: 'loading' };
  const data = calls.data;
  if (!data) return { kind: 'hidden' };
  if (data.status === 'missing') return { kind: 'missing' };
  if (data.status === 'error') return { kind: 'error' };
  const entry = data.rdv?.[String(leadId)];
  if (!entry) return { kind: 'hidden' };
  return { kind: entry.status, entry, since: data.allo_since };
}

export function noteOf(view) {
  const since = view?.since ? fmtDayMonth(view.since) : '';
  if (view?.kind === 'none') return sentence(`Aucun appel Allo vers ce prospect${since ? ` depuis le ${since}` : ''}`);
  if (view?.kind === 'before_allo') return `RDV posé avant l'arrivée d'Allo chez ce setter${since ? ` (${since})` : ''} : appels non relevés.`;
  if (view?.kind === 'no_phone') return 'Pas de numéro de téléphone exploitable sur la fiche de ce prospect : appels non rapprochables.';
  return '';
}

// Les décomptes en mots, sans zéros : « 2 répondus · 1 répondeur · 1 sans réponse · 1 entrant ».
function breakdown(counts) {
  const parts = [];
  if (counts?.human) parts.push(plural(counts.human, WORDS.human));
  if (counts?.voicemail) parts.push(plural(counts.voicemail, WORDS.voicemail));
  if (counts?.no_answer) parts.push(plural(counts.no_answer, WORDS.no_answer));
  if (counts?.inbound) parts.push(plural(counts.inbound, WORDS.inbound));
  return parts;
}

// La ligne d'un RDV, en une phrase : « ×5 · 2 répondus · 1 répondeur · 1 sans réponse · 1 entrant » (×N = combien de fois le setter a appelé
// ce prospect).
export function lineOf(entry) {
  const parts = [];
  if ((entry?.outbound || 0) > 0) parts.push(`×${fmtInt(entry.outbound)}`);
  parts.push(...breakdown(entry));
  return parts.join(' · ');
}

// Ce qu'on lit sur la ligne d'un appel : l'état, et ce qu'Allo sait en plus (message laissé sur la messagerie).
export function callLabel(item) {
  if (item?.state === 'inbound') return { label: INBOUND_LABELS[item.inbound] || STATE_LABELS.inbound, sub: '' };
  const label = STATE_LABELS[item?.state] || STATE_LABELS.no_answer;
  if (item?.state === 'voicemail') return { label, sub: item.left === true ? 'message laissé' : item.left === false ? 'sans message' : '' };
  return { label, sub: item?.left === true ? 'message laissé' : '' };
}

// Les trois durées d'un appel. Conversation = sans la sonnerie (appels enregistrés seulement) ; sonnerie = la durée totale moins la
// conversation, ou la durée totale d'un appel resté sans réponse ; null quand Allo ne permet pas de le dire (jamais un 0 inventé).
export function callTimes(item) {
  const total = Number.isFinite(Number(item?.total_s)) && item?.total_s != null ? Number(item.total_s) : null;
  const talk = Number.isFinite(Number(item?.talk_s)) && item?.talk_s != null ? Number(item.talk_s) : null;
  let ring = null;
  if (talk == null) ring = item?.state === 'no_answer' || item?.inbound === 'missed' ? total : null;
  else if (total != null) ring = Math.max(total - talk, 0);
  return { talk, ring, total };
}

const msOf = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

// La liste des appels d'un prospect, du plus ancien au plus récent, regroupés par JOUR de Paris (« ven. 16 oct. — 3 appels »), avec le rang
// de chaque appel, le délai depuis le précédent et les repères « RDV posé » et « RDV prévu » à leur place dans le temps.
export function callRows(entry, { rdvAt } = {}) {
  const items = entry?.items || [];
  const poseMs = entry?.pose_at ? msOf(entry.pose_at) : null;
  const rdvMs = rdvAt ? parisWallToMs(rdvAt) : null;
  const perDay = new Map();
  for (const item of items) {
    const key = dayKey(item.at);
    const day = perDay.get(key) || { calls: 0, outbound: 0, human: 0, voicemail: 0, no_answer: 0, inbound: 0 };
    day.calls += 1;
    if (item.direction === 'OUTBOUND') day.outbound += 1;
    day[item.state] = (day[item.state] || 0) + 1;
    perDay.set(key, day);
  }
  const events = items.map((item, index) => ({ type: 'call', ms: msOf(item.at), item, index }));
  if (poseMs != null) events.push({ type: 'pose', ms: poseMs, at: entry.pose_at, index: items.length });
  if (rdvMs != null) events.push({ type: 'rdv', ms: rdvMs, at: new Date(rdvMs).toISOString(), wall: rdvAt, index: items.length + 1 });
  const when = (e) => (e.ms == null ? Infinity : e.ms);
  events.sort((a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.index - b.index));
  const firstHuman = items.findIndex((i) => i.state === 'human');
  const rows = [];
  let currentDay = null;
  let rank = 0;
  let previousMs = null;
  for (const e of events) {
    if (e.type !== 'call') {
      rows.push({ type: e.type, key: e.type, at: e.at, wall: e.wall });
      continue;
    }
    const key = dayKey(e.item.at);
    if (key !== currentDay) {
      const day = perDay.get(key);
      rows.push({ type: 'day', key: `day-${key}`, label: fmtDayLabel(e.item.at), count: day.calls, summary: [plural(day.calls, ['appel', 'appels']), ...breakdown(day)].join(' · ') });
      currentDay = key;
    }
    rank += 1;
    rows.push({
      type: 'call', key: e.item.id, item: e.item, n: rank, of: items.length,
      gapS: previousMs != null && e.ms != null ? (e.ms - previousMs) / 1000 : null,
      firstAnswer: e.index === firstHuman, label: callLabel(e.item), times: callTimes(e.item),
    });
    if (e.ms != null) previousMs = e.ms;
  }
  return rows;
}

// ── La frise d'un prospect (panneau latéral, comme l'historique d'un lead dans « Gestion des leads ») ──────
const dayLongFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long' });

// « vendredi 16 octobre » : le jour de Paris en toutes lettres, avec l'année seulement hors de l'année en cours.
export function fmtDayLong(iso) {
  const date = asDate(iso);
  if (!date) return '';
  const year = dayKey(iso).slice(0, 4);
  return `${dayLongFmt.format(date)}${year !== dayKey(new Date().toISOString()).slice(0, 4) ? ` ${year}` : ''}`;
}

// « 09 h 24 » : l'heure d'un événement de la frise, l'heure sur deux chiffres comme dans l'historique d'un lead.
export const fmtHourPadded = (iso) => fmtClock(iso).replace(/^(\d) /, '0$1 ');

// « 0:07 », « 2:12 », « 1:02:03 » : la position dans un enregistrement.
export function fmtPlayTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

const CALL_TITLES = { human: 'Appel sortant — répondu', voicemail: 'Appel sortant — répondeur', no_answer: 'Appel sortant — sans réponse' };
const INBOUND_TITLES = { answered: 'Appel entrant — décroché', voicemail: 'Appel entrant — message vocal', missed: 'Appel entrant — non décroché' };

// Le titre d'un appel dans la frise.
export function callTitle(item) {
  if (item?.state === 'inbound') return INBOUND_TITLES[item.inbound] || 'Appel entrant';
  return CALL_TITLES[item?.state] || CALL_TITLES.no_answer;
}

// Ce qu'une carte d'appel dit en dehors de son titre : la durée principale (conversation, ou durée de l'appel quand personne n'a décroché), le
// repère dans la série d'appels (rang, délai depuis le précédent, premier décroché) et le complément (sonnerie, durée totale, message laissé). Jamais
// un 0 inventé : ce qu'Allo ne donne pas n'est pas écrit.
export function callDetails(row) {
  const { item, times } = row;
  const talked = times.talk != null;
  const main = talked ? times.talk : times.total;
  const extra = [];
  if (talked) {
    if (times.ring != null) extra.push(`sonnerie ${fmtTalkSeconds(times.ring)}`);
    if (times.total != null) extra.push(`total ${fmtTalkSeconds(times.total)}`);
  } else if (times.ring != null && times.ring !== times.total) {
    extra.push(`sonnerie ${fmtTalkSeconds(times.ring)}`);
  }
  const left = callLabel(item).sub;
  if (left) extra.push(left);
  const context = [];
  if (row.of > 1) {
    context.push(`Appel ${row.n} sur ${row.of}`);
    if (row.gapS != null && fmtGap(row.gapS)) context.push(`+${fmtGap(row.gapS)} depuis le précédent`);
  } else {
    context.push('Seul appel');
  }
  if (row.firstAnswer) context.push('Premier décroché');
  const text = extra.join(' · ');
  return {
    duration: main != null ? fmtTalkSeconds(main) : '',
    durationLabel: talked ? 'Durée de conversation' : "Durée de l'appel",
    measures: text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '',
    context: context.join(' · '),
  };
}

// Combien d'appels d'un prospect ont un enregistrement à écouter.
export const recordedOf = (entry) => (entry?.items || []).filter((item) => item.recorded).length;

// La frise : un groupe par JOUR de Paris (du plus ancien au plus récent), chaque groupe avec ses appels et les repères « RDV posé » / « RDV prévu »
// qui tombent ce jour-là. `summary` = le résumé du jour (« 2 appels · 1 répondu · 1 répondeur ») ; vide pour un jour sans appel.
export function callTimeline(entry, { rdvAt } = {}) {
  const rows = callRows(entry, { rdvAt });
  const summaries = new Map(rows.filter((r) => r.type === 'day').map((r) => [r.key.slice(4), r.summary]));
  const groups = [];
  for (const row of rows) {
    if (row.type === 'day') continue;
    const at = row.type === 'call' ? row.item.at : row.at;
    const key = dayKey(at);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: fmtDayLong(at) || 'Date inconnue', summary: summaries.get(key) || '', events: [] };
      groups.push(group);
    }
    group.events.push(row);
  }
  return groups;
}

// Étiquettes d'Allo d'un prospect, en comptes : [{ tag, label, n }], les plus fréquentes d'abord.
export function tagCounts(entry) {
  const counts = new Map();
  for (const item of entry?.items || []) for (const tag of item.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, label: tagLabel(tag), n }));
}

// Les étiquettes du dernier appel qui en porte : l'issue la plus récente relevée par Allo.
export function lastTags(entry) {
  const items = entry?.items || [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if ((items[i].tags || []).length) return { at: items[i].at, tags: items[i].tags.map((tag) => ({ tag, label: tagLabel(tag) })) };
  }
  return null;
}

// Les faits d'ensemble d'un prospect, en lecture directe : { key, label, value, note }.
export function entryFacts(entry, { rdvAt } = {}) {
  const items = entry?.items || [];
  const facts = [];
  if (!items.length) return facts;
  const poseMs = entry?.pose_at ? msOf(entry.pose_at) : null;
  const rdvMs = rdvAt ? parisWallToMs(rdvAt) : null;
  const first = items[0];
  const last = items[items.length - 1];
  let note = '';
  if (poseMs != null && msOf(first.at) != null) {
    const gap = (poseMs - msOf(first.at)) / 1000;
    note = gap >= 0 ? `${fmtGap(gap)} avant la pose du RDV` : `${fmtGap(-gap)} après la pose du RDV`;
  }
  facts.push({ key: 'first', label: 'Premier appel', value: fmtCallAt(first.at), note });
  if (items.length > 1) facts.push({ key: 'last', label: 'Dernier appel', value: fmtCallAt(last.at), note: '' });
  const answered = items.findIndex((i) => i.state === 'human');
  if (answered >= 0) {
    const tries = items.slice(0, answered + 1).filter((i) => i.direction === 'OUTBOUND').length;
    facts.push({ key: 'answer', label: 'Premier décroché', value: fmtCallAt(items[answered].at), note: tries === 1 ? 'dès le 1er appel' : `au ${ordinal(tries)} appel` });
  } else {
    facts.push({ key: 'answer', label: 'Premier décroché', value: 'Jamais', note: 'aucun appel sortant décroché par une personne' });
  }
  const days = new Set(items.map((i) => dayKey(i.at))).size;
  facts.push({ key: 'span', label: 'Étalement', value: `${fmtInt(days)} jour${days > 1 ? 's' : ''}`, note: '' });
  facts.push({ key: 'talk', label: 'Conversation', value: fmtTalkSeconds(entry.talk_s || 0), note: `${fmtTalkSeconds(entry.total_s || 0)} au total, sonnerie comprise` });
  if ((entry.voicemail || 0) > 0) {
    facts.push({ key: 'left', label: 'Messages laissés', value: fmtInt(entry.left || 0), note: `sur ${plural(entry.voicemail, WORDS.voicemail)}` });
  }
  if ((entry.before_pose || 0) + (entry.after_pose || 0) > 0) {
    facts.push({ key: 'pose', label: 'Autour de la pose du RDV', value: `${fmtInt(entry.before_pose)} avant · ${fmtInt(entry.after_pose)} après`, note: '' });
  }
  if (rdvMs != null) {
    const sameDay = items.filter((i) => dayKey(i.at) === dayKey(new Date(rdvMs).toISOString())).length;
    const after = items.filter((i) => msOf(i.at) != null && msOf(i.at) > rdvMs).length;
    if (sameDay || after) facts.push({ key: 'rdv', label: 'Autour du RDV', value: `${fmtInt(sameDay)} le jour même · ${fmtInt(after)} après l'heure du RDV`, note: '' });
  }
  return facts;
}

// ── Le cadre d'ensemble de la fiche d'un setter ──────────────────────────────────────────────────────────
// Toute son activité d'appel depuis son arrivée sur Allo (prospects de RDV ou non), ou la raison de son absence.
const ATTEMPT_LABELS = { 1: '1 fois', 2: '2 fois', 3: '3 fois', 4: '4 fois', '5+': '5 fois et plus' };

export function overviewOf(data) {
  if (!data) return null;
  if (data.status === 'missing') return { kind: 'missing', text: 'Pas de compte Allo : les appels de ce setter ne sont pas relevés.' };
  if (data.status === 'error') return { kind: 'error', text: 'Allo indisponible : appels non relevés.' };
  const t = data.totals;
  const since = data.allo_since ? fmtDayMonth(data.allo_since) : '';
  if (!t || !t.calls) return { kind: 'empty', since, text: sentence(`Aucun appel Allo relevé${since ? ` depuis le ${since}` : ''}`) };
  const n = (v) => Number(v) || 0;
  const rate = (part, whole) => (pct(part, whole) == null ? '' : `${pct(part, whole)} % `);
  const inboundParts = [
    n(t.inbound_answered) && plural(t.inbound_answered, ['décroché', 'décrochés']),
    n(t.inbound_missed) && plural(t.inbound_missed, ['manqué', 'manqués']),
    n(t.inbound_voicemail) && plural(t.inbound_voicemail, ['message vocal', 'messages vocaux']),
  ].filter(Boolean);
  const stats = [
    { key: 'outbound', label: 'Appels sortants', value: fmtInt(t.outbound), note: n(t.inbound) ? `${fmtInt(t.calls)} appels au total, entrants compris` : 'aucun appel entrant' },
    { key: 'prospects', label: 'Prospects appelés', value: fmtInt(t.prospects), note: t.calls_per_prospect != null ? `${String(t.calls_per_prospect).replace('.', ',')} appels en moyenne par prospect` : '' },
    { key: 'reached', label: 'Prospects joints', value: fmtInt(t.reached), note: n(t.prospects) ? `${rate(t.reached, t.prospects)}des prospects appelés ont décroché au moins une fois` : '' },
    { key: 'human', label: 'Répondus', value: fmtInt(t.human), note: n(t.outbound) ? `${rate(t.human, t.outbound)}des appels sortants` : '' },
    { key: 'voicemail', label: 'Répondeurs', value: fmtInt(t.voicemail), note: n(t.voicemail) ? `${plural(n(t.left), ['message laissé', 'messages laissés'])}` : '' },
    { key: 'no_answer', label: 'Sans réponse', value: fmtInt(t.no_answer), note: n(t.outbound) ? `${rate(t.no_answer, t.outbound)}des appels sortants` : '' },
    { key: 'inbound', label: 'Appels entrants', value: fmtInt(t.inbound), note: inboundParts.join(' · ') },
  ];
  const average = n(t.human) ? fmtTalkSeconds(n(t.human_talk_s) / n(t.human)) : '';
  const times = [
    { key: 'talk', label: 'Temps de conversation', value: fmtTotal(t.talk_s), note: average ? `${average} en moyenne par appel répondu` : '' },
    { key: 'total', label: 'Durée totale des appels', value: fmtTotal(t.total_s), note: 'sonnerie comprise' },
    { key: 'days', label: "Jours d'appel", value: fmtInt(t.days), note: t.last_at ? `dernier appel : ${fmtCallAt(t.last_at)}` : '' },
  ];
  const attempts = Object.keys(ATTEMPT_LABELS).map((key) => ({ key, label: ATTEMPT_LABELS[key], n: n(t.attempts?.[key]) }));
  const top = Math.max(1, ...attempts.map((a) => a.n));
  const tags = Object.entries(t.tags || {}).map(([tag, count]) => ({ tag, label: tagLabel(tag), n: n(count) })).sort((a, b) => b.n - a.n);
  return { kind: 'ready', since, stats, times, attempts: attempts.map((a) => ({ ...a, pct: Math.round((100 * a.n) / top) })), tags };
}
