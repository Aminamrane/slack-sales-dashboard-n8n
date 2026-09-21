// Date-only arithmetic deliberately uses UTC: no DST or browser-timezone drift.
export const TYPES = {
  conge: "Congé vacances",
  maladie: "Maladie",
  absence: "Absence",
  autre: "Autre",
};
export const PERIODS = {
  full: "Journée entière",
  am: "Matin",
  pm: "Après-midi",
};
export const STATUSES = {
  pending: "En attente",
  declared: "Déclarée",
  approved: "Validée",
  rejected: "Refusée",
  cancelled: "Annulée",
};
export const todayParis = () =>
  new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateObject = (day) => new Date(`${day}T12:00:00Z`);
export const nextDay = (day, offset = 1) => {
  const d = dateObject(day);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
export const fmtDate = (day) =>
  dateObject(day).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export const rangeLabel = (item) =>
  item.start_date === item.end_date
    ? fmtDate(item.start_date)
    : `${fmtDate(item.start_date)} → ${fmtDate(item.end_date)}`;
export const daysLabel = (n) => `${Number(n).toLocaleString("fr-FR")} j`;
export function restrictedFinance(start, end) {
  if (!start || !end || end < start) return false;
  const d = dateObject(start),
    last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
  return d.getUTCDate() <= 5 || end >= `${start.slice(0, 7)}-${last - 4}`;
}
export function duration(item, workingDays = [1, 2, 3, 4, 5]) {
  if (!item.start_date || !item.end_date || item.end_date < item.start_date)
    return 0;
  let total = 0;
  for (let day = item.start_date; day <= item.end_date; day = nextDay(day)) {
    if (workingDays.includes(dateObject(day).getUTCDay() || 7))
      total += item.period === "am" || item.period === "pm" ? 0.5 : 1;
  }
  return total;
}
export function periodOnDay(items, day) {
  const periods = items
    .filter(
      (a) =>
        a.start_date <= day &&
        a.end_date >= day &&
        (!a.status || ["declared", "approved"].includes(a.status)),
    )
    .map((a) => a.period || "full");
  if (
    periods.includes("full") ||
    (periods.includes("am") && periods.includes("pm"))
  )
    return "full";
  return periods[0] || null;
}
