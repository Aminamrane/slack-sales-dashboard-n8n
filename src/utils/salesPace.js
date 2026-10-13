// Rythme du mois en cours (dev 13/10/2026), mots du CEO et de Yohan : « 28/80, TR 35 %, on pace 105 ».
// Le rythme se mesure sur le temps réellement écoulé depuis le 1er à minuit (heure de Paris) : le matin, la journée
// commencée ne fait pas chuter la projection comme une division par le numéro du jour.

export function parisNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

// Jours écoulés (fractionnaires) et nombre de jours du mois, à partir de l'heure de Paris.
export function monthClock(now = parisNow()) {
  const daysInMonth = new Date(Date.UTC(now.year, now.month, 0)).getUTCDate();
  const elapsed = now.day - 1 + (now.hour * 60 + now.minute) / 1440;
  return { elapsed, daysInMonth, day: now.day };
}

// Valeur projetée en fin de mois au rythme actuel ; null tant que moins d'une demi-journée s'est écoulée.
export function projectToMonthEnd(value, clock = monthClock()) {
  if (!(clock.elapsed >= 0.5)) return null;
  return (value / clock.elapsed) * clock.daysInMonth;
}

// Ventes face à l'objectif : TR (taux de réalisation), on pace (ventes projetées en fin de mois), jour d'atteinte.
export function salesPace({ sales, objective, clock = monthClock() }) {
  const tr = objective ? Math.round((sales / objective) * 100) : null;
  const projected = projectToMonthEnd(sales, clock);
  const onPace = projected == null ? null : Math.round(projected);
  if (!objective) return { tr, onPace, status: 'no_objective', reachDay: null };
  if (sales >= objective) return { tr, onPace, status: 'reached', reachDay: null };
  if (projected == null || sales <= 0) return { tr, onPace, status: 'too_early', reachDay: null };
  const reachAt = (objective / sales) * clock.elapsed;        // jours depuis le 1er à minuit
  const reachDay = Math.floor(reachAt) + 1;                    // jour du mois où l'objectif tombe
  return reachDay <= clock.daysInMonth
    ? { tr, onPace, status: 'on_track', reachDay }
    : { tr, onPace, status: 'behind', reachDay: null };
}
