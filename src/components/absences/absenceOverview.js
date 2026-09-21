import { dateObject, duration, nextDay, periodOnDay } from "./absenceDates.js";

export const teamLabel = (role) => {
  if (["finance_team", "finance_director"].includes(role)) return "Finance";
  if (
    ["sales", "head_of_sales", "head_of_sales_manager", "setter"].includes(role)
  )
    return "Commercial";
  if (role === "hr") return "RH";
  if (["admin", "ceo"].includes(role)) return "Direction";
  return "Autres équipes";
};
export const monthLabel = (month) =>
  dateObject(month + "-01").toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
export function shiftMonth(month, offset) {
  const d = dateObject(month + "-01");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export const monthEnd = (month) => nextDay(shiftMonth(month, 1) + "-01", -1);
export const newestFirst = (a, b) =>
  (b.created_at || "").localeCompare(a.created_at || "") ||
  b.start_date.localeCompare(a.start_date) ||
  String(b.id).localeCompare(String(a.id));
export const isReview = (row) =>
  row.kind === "request" ? row.status === "pending" : row.status === "declared";
export const isPast = (row, today) => row.end_date < today;
export function countDays(rows, start, end) {
  const people = new Map();
  for (const row of rows.filter((r) => r.kind === "absence")) {
    if (!people.has(row.user_id))
      people.set(row.user_id, { rows: [], working: row.working_days });
    people.get(row.user_id).rows.push(row);
  }
  let total = 0;
  for (const person of people.values()) {
    for (let day = start; day <= end; day = nextDay(day)) {
      const period = periodOnDay(person.rows, day);
      if (period)
        total += duration(
          { start_date: day, end_date: day, period },
          person.working,
        );
    }
  }
  return total;
}
export function daySlots(rows, day) {
  const slots = { am: null, pm: null };
  for (const row of [...rows].sort(newestFirst)) {
    if (row.kind !== "absence" || row.start_date > day || row.end_date < day)
      continue;
    const parts =
      row.period === "am"
        ? ["am"]
        : row.period === "pm"
          ? ["pm"]
          : ["am", "pm"];
    for (const part of parts) if (!slots[part]) slots[part] = row;
  }
  return slots;
}
