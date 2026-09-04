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
  while (d <= last) { out.push(iso(d)); d = new Date(d.getTime() + 7 * 864e5); }
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
    const workingDays = workingDaysOf(p);
    const perDay = hoursPerDayOf(p, workingDays);
    const working = new Set(workingDays);
    const vac = new Set();
    let total = 0;

    const values = cells.map((cell) => {
      // Somme des jours de la cellule qui tombent dans la période et sont
      // déjà passés (les jours futurs ne comptent ni en réalisé ni en attendu).
      let h = 0;
      let vacDays = 0;
      for (const seen of p.weeksSeen) {
        (seen.week.days || []).forEach((day, i) => {
          if (!cell.days.includes(day)) return;
          if ((seen.person.vacation_days || []).includes(day)) { vac.add(day); vacDays += 1; }
          if (!counted(day)) return;
          h += seen.person.daily?.[i] ?? 0;
        });
      }
      total += h;
      const workDaysInCell = cell.days.filter((d) => working.has(isoWeekday(d))).length;
      return { ...cell, hours: h, vac: vacDays > 0, vacAll: vacDays > 0 && vacDays >= Math.max(1, workDaysInCell) };
    });

    // Attendu : heures/jour × jours travaillés disponibles de la période
    // (absences déduites) ; « à ce stade » = jours travaillés déjà écoulés.
    let availableDays = 0;
    let elapsedDays = 0;
    const seenDays = new Set();
    for (const seen of p.weeksSeen) {
      for (const day of seen.week.days || []) {
        if (seenDays.has(day) || !inPeriod(day) || !working.has(isoWeekday(day)) || vac.has(day)) continue;
        seenDays.add(day);
        availableDays += 1;
        if (counted(day)) elapsedDays += 1;
      }
    }
    const expectedFull = perDay * availableDays;
    const expectedNow = perDay * elapsedDays;

    // Moyennes : par jour qui comptait (10 h × 4 j, vendredi absent = 10 h/j),
    // et l'équivalent semaine = moyenne/jour × jours travaillés par semaine.
    const avgDay = elapsedDays > 0 ? total / elapsedDays : null;
    const avgWeek = avgDay != null ? avgDay * workingDays.length : null;

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
      vacCount: [...vac].filter((d) => working.has(isoWeekday(d))).length,
      avgDay, avgWeek, delta,
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

export {
  DAY_LABELS, MONTHS_FR, HOURS_PER_DAY, DEFAULT_BASE, DEFAULT_WORKING_DAYS,
  mondayOf, iso, fromIso, addDays, fmtDay, monthKey, isoWeekday, isWeekend, mondaysCovering, fmtH,
  statusFor, buildPeriod, aggregate,
};
