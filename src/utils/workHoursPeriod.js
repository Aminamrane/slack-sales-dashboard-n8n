// workHoursPeriod.js — la logique pure de la page « Heures de travail ».
//
// Séparée de l'écran pour être testée (workHoursPeriod.test.js) : agrégation
// d'une période (semaine = 7 cellules-jours, mois = une cellule par semaine),
// attendu par personne (jours travaillés × heures/jour, absences déduites,
// prorata des jours écoulés), moyennes par jour et par semaine, classement.
// Aucun React ici.
//
// Règles (dev 2026-09-04) :
//   - Un jour travaillé vaut 8 h ; l'attendu = jours travaillés de la période
//     (user_working_days, défaut lundi-vendredi) × 8 h, absences déduites.
//     Ben à 2 j/sem attend 16 h par semaine.
//   - Le week-end compte dans le réalisé (bonus), jamais dans l'attendu.
//   - La moyenne par jour divise par les jours qui comptaient : 10 h × 4 jours
//     avec vendredi absent = 10 h/jour, pas 8. La moyenne par semaine est
//     l'équivalent semaine (moyenne/jour × jours travaillés par semaine).
//
// Planning daté (2026-11-05) : un jour compte dans l'attendu seulement si la
// personne était déjà arrivée (start_date) ET si ce jour de la semaine faisait
// partie du rythme EN VIGUEUR CE JOUR-LÀ (working_days_history : [{effective_from,
// days}], effective_from null = depuis toujours). Rien n'est rétroactif : un
// nouveau rythme ne joue qu'à partir de sa date. Sans start_date ni historique
// (anciens profils), repli sur le rythme unique `working_days`, comme avant.
// Le réalisé (heures d'agenda) n'est jamais touché par ces deux informations.

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const HOURS_PER_DAY = 8;
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
const DEFAULT_BASE = HOURS_PER_DAY * DEFAULT_WORKING_DAYS.length;

/* ─────────────────────────────── Dates ─────────────────────────────── */

const mondayOf = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
};
const iso = (d) => d.toLocaleDateString("fr-CA");
const fromIso = (s) => new Date(s + "T00:00:00");
const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtDay = (s) => fromIso(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
// Jour ISO : 1 = lundi … 7 = dimanche.
const isoWeekday = (s) => { const g = fromIso(s).getDay(); return g === 0 ? 7 : g; };
const isWeekend = (s) => isoWeekday(s) >= 6;
// Tous les lundis dont la semaine touche le mois.
const mondaysCovering = (y, m) => {
  const last = new Date(y, m + 1, 0);
  const out = [];
  let d = mondayOf(new Date(y, m, 1));
  while (d <= last) { out.push(iso(d)); d = new Date(d); d.setDate(d.getDate() + 7); }
  return out;
};
const fmtH = (h) => {
  const neg = h < 0;
  const a = Math.abs(h);
  let hh = Math.floor(a);
  let mm = Math.round((a - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  return `${neg ? "−" : ""}${mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`}`;
};

const GREEN = "#3e7d5a";
const VIOLET = "#7c3aed";
const RED = "#dc2626";
const MUTED = "#8a93a4";

// Statut vs attendu à ce stade : violet à partir de 87,5 % (35 h pour 40 h).
const statusFor = (total, expectedNow) => {
  if (!expectedNow || expectedNow <= 0) return { color: MUTED, bg: "#f3f4f6", label: "—" };
  if (total >= expectedNow) return { color: GREEN, bg: GREEN + "14", label: "objectif atteint" };
  if (total >= expectedNow * 0.875) return { color: VIOLET, bg: VIOLET + "12", label: "proche de l'objectif" };
  return { color: RED, bg: RED + "10", label: "sous l'objectif" };
};

// Jours travaillés d'une personne telle que servie par l'API (repli lun-ven).
const workingDaysOf = (p) => {
  const raw = Array.isArray(p.working_days) ? p.working_days.map(Number).filter((d) => d >= 1 && d <= 7) : [];
  return raw.length ? [...new Set(raw)].sort() : [...DEFAULT_WORKING_DAYS];
};
const hoursPerDayOf = (p, days) => {
  if (p.hours_per_day != null) return Number(p.hours_per_day);
  if (p.expected_base != null && p.expected_base !== DEFAULT_BASE) return Number(p.expected_base) / days.length;
  return HOURS_PER_DAY;
};

/* ─────────────── Planning daté : arrivée + rythme à chaque date ─────────────── */

// Jour calendaire valide « AAAA-MM-JJ » (refuse 2026-02-30).
const isIsoDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(fromIso(s)) === s;
const cleanDays = (raw) => [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);

// Historique de rythme trié par date (« depuis toujours » = null en tête). Deux
// entrées à la même date : la dernière gagne. Une entrée sans jour valide ou à la
// date invalide est écartée plutôt que de fausser un calcul.
function normalizeHistory(raw) {
  const byFrom = new Map();
  for (const e of Array.isArray(raw) ? raw : []) {
    const days = cleanDays(e?.days);
    const from = e?.effective_from ?? null;
    if (!days.length || (from !== null && !isIsoDay(from))) continue;
    byFrom.set(from, days);
  }
  return [...byFrom]
    .map(([from, days]) => ({ from, days }))
    .sort((a, b) => (a.from === b.from ? 0 : a.from === null ? -1 : b.from === null ? 1 : a.from < b.from ? -1 : 1));
}

// Le planning d'une personne tel que servi par l'API. Sans historique, un seul
// rythme (`working_days`) vaut pour toute la période : comportement d'avant.
function scheduleOf(p) {
  const legacy = workingDaysOf(p);
  const entries = normalizeHistory(p.working_days_history);
  const rhythms = entries.length ? entries : [{ from: null, days: legacy }];
  const start = isIsoDay(p.start_date) ? p.start_date : null;
  // Rythme en vigueur un jour donné : la dernière entrée dont la date est ≤ ce jour.
  // Avant la première date connue (aucun rythme initial), le premier rythme connu.
  const rhythmOn = (day) => {
    let found = rhythms[0];
    for (const r of rhythms) { if (r.from === null || r.from <= day) found = r; else break; }
    return found.days;
  };
  const employed = (day) => start === null || day >= start;
  return {
    start, entries, legacy, rhythmOn, employed,
    supported: Array.isArray(p.working_days_history),
    scheduled: (day) => employed(day) && rhythmOn(day).includes(isoWeekday(day)),
  };
}

/* ─────────────────────── Agrégation d'une période ─────────────────────── */
//
// Une seule forme de ligne, que la période soit une semaine (7 cellules-jours)
// ou un mois (une cellule par semaine) : le tableau et les cartes ne savent
// pas dans quel mode ils sont.

function buildPeriod({ mode, weeks, y, m, prevWeek }) {
  const cur = weeks[weeks.length - 1];
  const countedUntil = cur?.counted_until || null;
  const inPeriod = mode === "week" ? () => true : (day) => day.slice(0, 7) === monthKey(y, m);
  const counted = (day) => !countedUntil || day <= countedUntil;

  // Toutes les personnes vues sur la période (une semaine figée peut ne pas
  // contenir quelqu'un dont l'agenda n'était pas encore partagé).
  const byEmail = new Map();
  for (const w of weeks) {
    for (const p of w.people || []) {
      const cur0 = byEmail.get(p.email) || { ...p, accessible: false, weeksSeen: [] };
      cur0.accessible = cur0.accessible || !!p.accessible;
      cur0.name = p.name; cur0.pole = p.pole; cur0.avatar_url = p.avatar_url;
      cur0.working_days = p.working_days ?? cur0.working_days;
      cur0.hours_per_day = p.hours_per_day ?? cur0.hours_per_day;
      cur0.expected_base = p.expected_base ?? cur0.expected_base;
      // Arrivée et historique de rythme sont propres à la personne (pas à la semaine) : la plus récente gagne.
      if (p.start_date !== undefined) cur0.start_date = p.start_date;
      if (Array.isArray(p.working_days_history)) cur0.working_days_history = p.working_days_history;
      cur0.weeksSeen.push({ week: w, person: p });
      byEmail.set(p.email, cur0);
    }
  }

  // Colonnes.
  const cells = mode === "week"
    ? (cur?.days || []).map((day, i) => ({ key: day, label: DAY_LABELS[i], day, days: [day], weekend: i >= 5, future: !counted(day) }))
    : weeks.map((w) => {
      const days = (w.days || []).filter(inPeriod);
      return {
        key: w.week_start, label: days.length ? fmtDay(days[0]) : fmtDay(w.week_start),
        days, weekend: false,
        future: days.every((d) => !counted(d)),
      };
    });

  const rows = [];
  for (const p of byEmail.values()) {
    const sched = scheduleOf(p);
    // Les jours de la période, une fois chacun, dans l'ordre.
    const periodDays = [...new Set(p.weeksSeen.flatMap((s) => s.week.days || []).filter(inPeriod))].sort();
    // Rythme affiché : celui du dernier jour compté de la période (pas avant l'arrivée).
    const lastCounted = [...periodDays].reverse().find(counted) ?? periodDays[periodDays.length - 1];
    const refDay = lastCounted && sched.start && lastCounted < sched.start ? sched.start : lastCounted;
    const workingDays = refDay ? sched.rhythmOn(refDay) : sched.legacy;
    const perDay = hoursPerDayOf(p, workingDays);
    // Base hebdomadaire posée (35 h, mi-temps…) : elle se répartit sur les jours du rythme EN VIGUEUR ce jour-là
    // (20 h = 10 h/jour à 2 jours, 5 h/jour à 4 jours). Sans base, heures/jour constantes, comme avant.
    const weekly = p.weekly_expected_hours != null && Number.isFinite(Number(p.weekly_expected_hours)) ? Number(p.weekly_expected_hours) : null;
    const hoursOn = (rhythm) => (weekly !== null ? weekly / rhythm.length : perDay);
    const vac = new Map();
    let total = 0;

    const values = cells.map((cell) => {
      // Somme des jours de la cellule qui tombent dans la période et sont
      // déjà passés (les jours futurs ne comptent ni en réalisé ni en attendu).
      let h = 0;
      let vacDays = 0;
      for (const seen of p.weeksSeen) {
        (seen.week.days || []).forEach((day, i) => {
          if (!cell.days.includes(day)) return;
          const period = seen.person.vacation_periods?.[day] || ((seen.person.vacation_days || []).includes(day) ? 'full' : null);
          if (period) {
            const weight = period === 'full' ? 1 : 0.5;
            vac.set(day, weight);
            if (sched.scheduled(day)) vacDays += weight;
          }
          if (!counted(day)) return;
          h += seen.person.daily?.[i] ?? 0;
        });
      }
      total += h;
      const workDaysInCell = cell.days.filter(sched.scheduled).length;
      return {
        ...cell, hours: h, absenceDays: vacDays, vac: vacDays > 0,
        vacAll: vacDays > 0 && vacDays >= Math.max(1, workDaysInCell),
        // Cellule entièrement antérieure à l'arrivée : rien n'y est attendu.
        beforeStart: cell.days.length > 0 && cell.days.every((d) => !sched.employed(d)),
      };
    });

    // Attendu : heures/jour × jours travaillés disponibles de la période
    // (absences déduites) ; « à ce stade » = jours travaillés déjà écoulés.
    // Un jour compte s'il est après l'arrivée ET dans le rythme en vigueur CE jour-là.
    // Les mêmes jours alimentent les périodes (segments) montrées dans la bulle :
    // la somme des segments est, par construction, l'attendu.
    let availableDays = 0;
    let elapsedDays = 0;
    let weekDaysSum = 0;
    let weekDaysN = 0;
    let hoursFull = 0;
    let hoursNow = 0;
    const segments = [];
    for (const day of periodDays) {
      const employed = sched.employed(day);
      const rhythm = employed ? sched.rhythmOn(day) : [];
      const scheduled = employed && rhythm.includes(isoWeekday(day));
      const fraction = scheduled ? 1 - (vac.get(day) || 0) : 0;
      const dayHours = scheduled ? hoursOn(rhythm) * fraction : 0;
      availableDays += fraction;
      hoursFull += dayHours;
      if (counted(day)) {
        elapsedDays += fraction;
        hoursNow += dayHours;
        if (employed) { weekDaysSum += rhythm.length; weekDaysN += 1; }
      }
      const key = rhythm.join("");
      const last = segments[segments.length - 1];
      if (last && last.key === key) {
        last.to = day;
        last.scheduled += scheduled ? 1 : 0;
        last.available += fraction;
      } else {
        segments.push({ key, from: day, to: day, employed, days: rhythm, scheduled: scheduled ? 1 : 0, available: fraction, perDay: employed ? hoursOn(rhythm) : 0 });
      }
    }
    // Heures/jour constantes : le produit d'avant, à l'identique. Base posée : somme jour par jour.
    const expectedFull = weekly === null ? perDay * availableDays : hoursFull;
    const expectedNow = weekly === null ? perDay * elapsedDays : hoursNow;

    // Moyennes : par jour qui comptait (10 h × 4 j, vendredi absent = 10 h/j),
    // et l'équivalent semaine = moyenne/jour × jours travaillés par semaine.
    // Si le rythme a changé dans la période, les jours par semaine sont la moyenne
    // des rythmes pondérée par les jours écoulés (un seul rythme : sa longueur, comme avant).
    const avgDay = elapsedDays > 0 ? total / elapsedDays : null;
    const weekDays = weekDaysN > 0 ? weekDaysSum / weekDaysN : workingDays.length;
    const avgWeek = avgDay != null ? avgDay * weekDays : null;
    const worked = segments.filter((s) => s.employed);
    const rhythmLabel = worked.length
      ? `${worked.map((s) => s.days.length).filter((n, i, a) => i === 0 || n !== a[i - 1]).join(" → ")} j/sem`
      : "";

    // Évolution (semaine) : même portion (lun → jour courant) de la semaine précédente.
    let delta = null;
    if (mode === "week" && prevWeek) {
      const pp = (prevWeek.people || []).find((x) => x.email === p.email && x.accessible);
      if (pp) {
        const daysCounted = (cur?.days || []).filter(counted).length;
        const comparable = (pp.daily || []).slice(0, daysCounted).reduce((a, h) => a + h, 0);
        delta = total - comparable;
      }
    }

    rows.push({
      email: p.email, name: p.name, pole: p.pole, avatar_url: p.avatar_url,
      accessible: p.accessible,
      workingDays, perDay, base: perDay * workingDays.length,
      cells: values, total,
      expectedFull, expectedNow, availableDays, elapsedDays,
      vacCount: [...vac].reduce((sum, [d, weight]) => sum + (sched.scheduled(d) ? weight : 0), 0),
      avgDay, avgWeek, delta,
      // Planning daté : arrivée, historique, périodes de même rythme, libellé « 2 → 4 j/sem ».
      start: sched.start, history: sched.entries, legacyDays: sched.legacy, scheduleSupported: sched.supported,
      // Arrivée qui joue dans la période affichée (après son premier jour) ; rien à dire sinon.
      arrival: sched.start && periodDays.length && sched.start > periodDays[0] ? sched.start : null,
      notArrived: periodDays.length > 0 && worked.length === 0,
      segments, weekDays,
      rhythmChanged: new Set(worked.map((s) => s.key)).size > 1,
      rhythmLabel,
    });
  }

  const daysCounted = (cur?.days || []).filter(counted).length;
  return {
    cells, rows, countedUntil, daysCounted,
    refreshedAt: cur?.refreshed_at || null,
    closed: mode === "week"
      ? addDays(cur?.week_start || iso(mondayOf(new Date())), 7) <= iso(new Date())
      : monthKey(y, m) < iso(new Date()).slice(0, 7),
  };
}

// Agrégat d'un groupe de lignes (équipe cochée, pôle) : totaux, attendus et
// moyennes par personne (moyenne des moyennes, sur celles qui existent).
function aggregate(rows) {
  const total = rows.reduce((a, r) => a + r.total, 0);
  const expected = rows.reduce((a, r) => a + r.expectedFull, 0);
  const expectedNow = rows.reduce((a, r) => a + r.expectedNow, 0);
  const days = rows.map((r) => r.avgDay).filter((v) => v != null);
  const weeks = rows.map((r) => r.avgWeek).filter((v) => v != null);
  const mean = (xs) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : null);
  return { total, expected, expectedNow, avgDay: mean(days), avgWeek: mean(weeks), n: rows.length, avgN: days.length };
}

/* ─────────────────── Édition du planning (écran RH) ─────────────────── */
//
// Le formulaire travaille sur un brouillon { start: "AAAA-MM-JJ" | "", rows: [{ key, from, days }] } :
// la 1re ligne est le rythme initial (sans date : « depuis toujours »), les suivantes sont les
// changements, chacun avec sa date d'effet. Vers l'API part { start_date, history } (validé ici,
// revalidé par le serveur) : le serveur remplace le planning de la personne d'un seul bloc.

function draftFromRow(row) {
  let entries = row.history?.length ? row.history : [{ from: null, days: row.legacyDays }];
  // Un historique sans rythme initial se lit comme le calcul le lit : le 1er rythme vaut avant sa date.
  if (entries[0].from !== null) entries = [{ from: null, days: entries[0].days }, ...entries];
  return { start: row.start || "", rows: entries.map((e, i) => ({ key: `r${i}`, from: e.from || "", days: [...e.days] })) };
}

function validateDraft(draft) {
  const errors = [];
  const start = draft.start || null;
  if (start !== null && !isIsoDay(start)) errors.push("La date d'arrivée n'est pas valide.");
  const dates = new Set();
  const history = [];
  draft.rows.forEach((r, i) => {
    const days = cleanDays(r.days);
    if (!days.length) errors.push("Choisissez au moins un jour travaillé pour chaque ligne.");
    if (i === 0) { history.push({ effective_from: null, days }); return; }
    if (!isIsoDay(r.from)) { errors.push("Chaque changement a besoin d'une date d'effet valide."); return; }
    if (dates.has(r.from)) errors.push("Deux changements ont la même date d'effet.");
    dates.add(r.from);
    history.push({ effective_from: r.from, days });
  });
  history.sort((a, b) => (a.effective_from === null ? -1 : b.effective_from === null ? 1 : a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0));
  return { ok: errors.length === 0, errors, payload: { start_date: start, history } };
}

export {
  DAY_LABELS, MONTHS_FR, HOURS_PER_DAY, DEFAULT_BASE, DEFAULT_WORKING_DAYS,
  mondayOf, iso, fromIso, addDays, fmtDay, monthKey, isoWeekday, isWeekend, mondaysCovering, fmtH,
  statusFor, buildPeriod, aggregate,
  isIsoDay, normalizeHistory, scheduleOf, draftFromRow, validateDraft,
};
