// Calendrier interne (demande dev 05/10/2026) : logique pure du calendrier des sales, des setters et de la
// direction acquisition. Données : GET /api/v1/calendar/events, lecture seule (copie de Google Agenda + CRM).
// Toutes les dates sont des heures-mur de Paris (« 2026-10-08T20:00:00 », « 2026-10-09 » pour une journée
// entière) : lues telles quelles, jamais converties. Le placement des événements qui se chevauchent reprend
// celui du calendrier Linked, lui-même calqué sur Google Agenda.

export const DAY_MINUTES = 1440;
export const MIN_VISIBLE_MINUTES = 20;      // un événement très court reste lisible et cliquable

// ── Jours (clés « YYYY-MM-DD », calcul en UTC : aucun fuseau du navigateur n'intervient) ─────────────

export function parseKey(key) {
  const [y, m, d] = String(key).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function keyOf(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

export function mondayOf(key) {
  const dow = parseKey(key).getUTCDay();            // 0 = dimanche
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export function weekDays(monday, withWeekend = false) {
  return Array.from({ length: withWeekend ? 7 : 5 }, (_, i) => addDays(monday, i));
}

// Heure-mur de Paris maintenant (le navigateur peut être réglé sur un autre fuseau).
export function parisNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { key, minutes, iso: `${key}T${parts.hour}:${parts.minute}:00` };
}

export function dayOf(iso) {
  return String(iso || '').slice(0, 10);
}

export function minutesOf(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function wallAt(key, minutes) {
  const day = addDays(key, Math.floor(minutes / DAY_MINUTES));
  const rest = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${day}T${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}:00`;
}

// ── Libellés (français) ──────────────────────────────────────────────────────────────────────────────

const DOW_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DOW_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Heure compacte façon Tedeles : « 9h », « 10h30 ».
export function fmtTime(iso) {
  const m = minutesOf(iso);
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
}

export function fmtDayHead(key) {
  const d = parseKey(key);
  return { dow: DOW_SHORT[d.getUTCDay()], day: d.getUTCDate() };
}

export function fmtLongDate(key) {
  const d = parseKey(key);
  return `${DOW_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// « Lundi 5 octobre 2026 » (vue direction, jour par jour).
export function fmtDayTitle(key) {
  const label = `${fmtLongDate(key)} ${parseKey(key).getUTCFullYear()}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Jour ouvré précédent ou suivant (la direction navigue du lundi au vendredi).
export function stepWorkday(key, dir) {
  let next = addDays(key, dir);
  while ([0, 6].includes(parseKey(next).getUTCDay())) next = addDays(next, dir);
  return next;
}

// « Du 5 au 9 octobre 2026 », « Du 29 septembre au 3 octobre 2026 », « Du 29 décembre 2025 au 2 janvier 2026 ».
export function fmtWeekLabel(days) {
  const a = parseKey(days[0]);
  const b = parseKey(days[days.length - 1]);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  const left = sameMonth ? `${a.getUTCDate()}` : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}${sameYear ? '' : ` ${a.getUTCFullYear()}`}`;
  return `Du ${left} au ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function fmtRange(ev) {
  if (ev.all_day) {
    const last = addDays(dayOf(ev.end), -1);
    return last > dayOf(ev.start) ? `Du ${fmtLongDate(dayOf(ev.start))} au ${fmtLongDate(last)}` : `${fmtLongDate(dayOf(ev.start))}, toute la journée`;
  }
  const sameDay = dayOf(ev.start) === dayOf(ev.end) || (dayOf(ev.end) === addDays(dayOf(ev.start), 1) && minutesOf(ev.end) === 0);
  return sameDay
    ? `${fmtLongDate(dayOf(ev.start))}, ${fmtTime(ev.start)} à ${fmtTime(ev.end)}`
    : `Du ${fmtLongDate(dayOf(ev.start))} ${fmtTime(ev.start)} au ${fmtLongDate(dayOf(ev.end))} ${fmtTime(ev.end)}`;
}

// « il y a 4 min », « il y a 2 h », « le 03/10 à 14:05 ».
export function fmtSince(isoInstant, now = new Date()) {
  if (!isoInstant) return null;
  const t = new Date(isoInstant).getTime();
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  const p = parisNow(new Date(t));
  return `le ${p.key.slice(8, 10)}/${p.key.slice(5, 7)} à ${p.iso.slice(11, 16)}`;
}

// ── Répartition : bandeau « journée entière » et grille horaire, jour par jour ───────────────────────

export function splitEvents(events, days) {
  const allDay = new Map(days.map((d) => [d, []]));
  const timed = new Map(days.map((d) => [d, []]));
  for (const ev of events || []) {
    if (!ev?.start) continue;
    if (ev.all_day) {
      const last = ev.end ? addDays(dayOf(ev.end), -1) : dayOf(ev.start);
      for (const d of days) if (d >= dayOf(ev.start) && d <= last) allDay.get(d).push(ev);
      continue;
    }
    const end = ev.end && ev.end > ev.start ? ev.end : wallAt(dayOf(ev.start), minutesOf(ev.start) + MIN_VISIBLE_MINUTES);
    for (const d of days) {
      const dayStart = `${d}T00:00:00`;
      const dayEnd = `${addDays(d, 1)}T00:00:00`;
      if (ev.start >= dayEnd || end <= dayStart) continue;
      const segStart = ev.start > dayStart ? minutesOf(ev.start) : 0;
      const segEnd = end < dayEnd ? minutesOf(end) : DAY_MINUTES;
      timed.get(d).push({ ...ev, segStart, segEnd: Math.max(segEnd, segStart + MIN_VISIBLE_MINUTES) });
    }
  }
  return { allDay, timed };
}

export function hasWeekendEvents(events, monday) {
  const sat = addDays(monday, 5);
  const mon = addDays(monday, 7);
  return (events || []).some((ev) => {
    if (ev.kind !== 'rdv' && ev.kind !== 'callback') return false;   // agenda perso ou absence : le week-end reste masqué
    const s = dayOf(ev.start);
    const e = ev.all_day ? addDays(dayOf(ev.end || ev.start), -1) : dayOf(ev.end || ev.start);
    return s < mon && e >= sat;
  });
}

// ── Placement des événements qui se chevauchent (calendrier Linked, mesuré sur Google Agenda) ────────
// Trois cas : un seul événement (pleine largeur) ; une « ancre » longue avec des événements imbriqués en
// cascade (décalage de 5 % par niveau) ; sinon des colonnes qui se recouvrent légèrement (×1,7).
// Entrée : segments { id, segStart, segEnd } (minutes depuis minuit). Sortie : + leftPct, widthPct, zIndex.

const LANE_Z_BASE = 5;
const NESTED_OFFSET_PCT = 5;
const SHINGLE_FACTOR = 1.7;
const LATE_THRESHOLD_MIN = 30;

function byStartThenLongest(a, b) {
  return a.segStart - b.segStart || b.segEnd - a.segEnd;
}

function assignLanes(items) {
  const laneEnds = [];
  const lanes = new Map();
  for (const it of [...items].sort(byStartThenLongest)) {
    let lane = laneEnds.findIndex((end) => end <= it.segStart);
    if (lane < 0) { laneEnds.push(it.segEnd); lane = laneEnds.length - 1; } else laneEnds[lane] = it.segEnd;
    lanes.set(it.id, lane);
  }
  return { lanes, count: laneEnds.length };
}

export function layoutDay(items) {
  if (!items?.length) return [];
  const sorted = [...items].sort(byStartThenLongest);
  const clusters = [];
  let current = [];
  let clusterEnd = -1;
  for (const it of sorted) {
    if (!current.length || it.segStart >= clusterEnd) {
      if (current.length) clusters.push(current);
      current = [it];
      clusterEnd = it.segEnd;
    } else {
      current.push(it);
      clusterEnd = Math.max(clusterEnd, it.segEnd);
    }
  }
  if (current.length) clusters.push(current);

  const out = [];
  const place = (it, leftPct, widthPct, zIndex) => out.push({ ...it, leftPct, widthPct, zIndex });
  const scaled = (list, zOf) => {
    const { lanes, count } = assignLanes(list);
    const range = 100 - NESTED_OFFSET_PCT;
    for (const it of list) {
      const k = lanes.get(it.id);
      const innerLeft = k * (100 / count);
      const innerWidth = k === count - 1 ? 100 / count : (100 * SHINGLE_FACTOR) / count;
      place(it, NESTED_OFFSET_PCT + (innerLeft * range) / 100, (innerWidth * range) / 100, zOf(it, k));
    }
  };

  for (const cluster of clusters) {
    if (cluster.length === 1) { place(cluster[0], 0, 100, LANE_Z_BASE); continue; }
    const { lanes, count } = assignLanes(cluster);
    const cStart = Math.min(...cluster.map((e) => e.segStart));
    const cEnd = Math.max(...cluster.map((e) => e.segEnd));
    const atStart = cluster.filter((e) => e.segStart === cStart);
    const dur = (e) => e.segEnd - e.segStart;

    let anchor = null;
    if (atStart.length === 1) anchor = atStart[0];
    else {
      anchor = cluster.find((e) => e.segStart === cStart && e.segEnd === cEnd) || null;
      if (!anchor) {
        const longest = [...atStart].sort((a, b) => dur(b) - dur(a));
        if (dur(longest[0]) >= 2 * dur(longest[1])) anchor = longest[0];
      }
    }

    const others = anchor ? cluster.filter((e) => e.id !== anchor.id) : [];
    const pureNested = anchor && others.length
      && Math.min(...others.map((e) => e.segStart)) - anchor.segStart > LATE_THRESHOLD_MIN;

    if (pureNested) {
      const starts = new Map();
      for (const e of others) starts.set(e.segStart, (starts.get(e.segStart) || 0) + 1);
      if (![...starts.values()].some((c) => c >= 2)) {
        for (const it of cluster) {
          const lane = lanes.get(it.id);
          place(it, NESTED_OFFSET_PCT * lane, 100 - NESTED_OFFSET_PCT * lane, LANE_Z_BASE + lane);
        }
      } else {
        place(anchor, 0, 100, LANE_Z_BASE);
        scaled(others, (_, k) => LANE_Z_BASE + 1 + k);
      }
      continue;
    }

    const startEvents = cluster.filter((e) => e.segStart - cStart <= LATE_THRESHOLD_MIN);
    const lateEvents = cluster.filter((e) => e.segStart - cStart > LATE_THRESHOLD_MIN);
    const widthOf = (it, lane) => {
      if (lane === count - 1) return 100 / count;
      if (lane === 0) return (100 * SHINGLE_FACTOR) / count;
      const nextBusy = cluster.some((o) => o.id !== it.id && lanes.get(o.id) === lane + 1
        && o.segStart <= it.segStart && o.segEnd > it.segStart);
      return nextBusy ? (100 * SHINGLE_FACTOR) / count : 100 - lane * (100 / count);
    };
    for (const it of startEvents) {
      const lane = lanes.get(it.id);
      place(it, lane * (100 / count), widthOf(it, lane), LANE_Z_BASE + lane);
    }
    if (lateEvents.length && anchor) scaled(lateEvents, (it) => LANE_Z_BASE + lanes.get(it.id));
    else {
      for (const it of lateEvents) {
        const lane = lanes.get(it.id);
        place(it, lane * (100 / count), widthOf(it, lane), LANE_Z_BASE + lane);
      }
    }
  }
  return out;
}

// ── Apparence ─────────────────────────────────────────────────────────────────────────────────────────

export const RDV_COLORS = { r1: '#3b82f6', r2: '#f97316', r3: '#8b5cf6' };
export const GOOGLE_COLOR = '#121b35';          // marine Owner
export const GOOGLE_COLOR_DARK = '#8b9bc7';     // le marine disparaît sur fond sombre
export const CALLBACK_COLOR = '#0891b2';         // distinct du R2 (orange) et de « À qualifier » (ambre)
export const ABSENCE_COLOR = '#64748b';

export const OUTCOME = {
  upcoming: { label: 'À venir', color: '#3b82f6', hint: 'Le rendez-vous n\'a pas encore eu lieu.' },
  held: { label: 'Honoré', color: '#10b981', hint: 'Le commercial a indiqué que le rendez-vous a eu lieu.' },
  no_show: { label: 'No-show', color: '#dc2626', hint: 'Le prospect ne s\'est pas présenté.' },
  to_qualify: { label: 'À qualifier', color: '#d97706', hint: 'Rendez-vous passé : le résultat n\'est pas encore saisi.' },
  removed: { label: 'Retiré', color: '#94a3b8', hint: 'Le rendez-vous a été retiré de la fiche, sans résultat.' },
  cancelled: { label: 'Annulé', color: '#94a3b8', hint: 'Le commercial a indiqué que le rendez-vous est annulé.' },
};

function channels(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return [100, 116, 139];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Fond doux teinté + texte de la même teinte assombrie (fond plein, pour rester lisible quand ça se superpose).
export function chipColors(hex, dark = false) {
  const [r, g, b] = channels(hex);
  if (dark) {
    const base = [30, 31, 40];
    const mix = [r, g, b].map((c, i) => Math.round(base[i] + (c - base[i]) * 0.26));
    const text = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.45));
    return { bg: `rgb(${mix.join(', ')})`, text: `rgb(${text.join(', ')})`, line: hex };
  }
  const bg = [r, g, b].map((c) => Math.round(255 - (255 - c) * 0.16));     // mêmes teintes que Tedeles
  const text = [r, g, b].map((c) => Math.round(c * 0.58));
  return { bg: `rgb(${bg.join(', ')})`, text: `rgb(${text.join(', ')})`, line: hex };
}

export function eventColor(ev, dark = false) {
  if (ev.kind === 'rdv') return ev.outcome === 'no_show' ? OUTCOME.no_show.color : (RDV_COLORS[ev.rdv_type] || RDV_COLORS.r1);
  if (ev.kind === 'callback') return CALLBACK_COLOR;
  if (ev.kind === 'absence') return ABSENCE_COLOR;
  if (ev.private) return ABSENCE_COLOR;
  return dark ? GOOGLE_COLOR_DARK : GOOGLE_COLOR;
}

export function rdvLabel(ev) {
  return String(ev.rdv_type || '').toUpperCase();
}

// Vue direction : qui doit suivre ce rendez-vous.
export const HANDLED = {
  setter: { label: 'Géré par un setter', short: 'Setter' },
  direction: { label: 'À relancer par moi', short: 'Moi' },
};

export function filterHandled(events, mode) {
  if (!mode || mode === 'all') return events || [];
  return (events || []).filter((ev) => ev.kind !== 'rdv' || ev.handled_by === mode);
}

// Vue direction : une colonne par commercial (ordre alphabétique, RDV non affectés et leads archivés à la fin).
export function groupBySales(events) {
  const groups = new Map();
  for (const ev of events || []) {
    if (ev.kind !== 'rdv') continue;
    const state = ev.assigned?.state || 'unassigned';
    const key = state === 'assigned' ? `a:${ev.assigned.name}` : `z:${state}`;
    const name = state === 'assigned' ? ev.assigned.name : state === 'archived' ? 'Lead archivé' : 'Non affecté';
    if (!groups.has(key)) groups.set(key, { key, name, events: [] });
    groups.get(key).events.push(ev);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, 'fr'));
}

export function countByOutcome(events) {
  const out = { total: 0, upcoming: 0, held: 0, no_show: 0, to_qualify: 0 };
  for (const ev of events || []) {
    if (ev.kind !== 'rdv') continue;
    out.total += 1;
    if (ev.outcome in out) out[ev.outcome] += 1;
  }
  return out;
}
