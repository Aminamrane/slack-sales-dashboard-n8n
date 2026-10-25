import { money } from "./calculation.js";
export const CHANNELS = {
  ADS: "Ads",
  WEB: "Webinaire",
  CC: "Cold call",
  CCS: "Cold call setter",
};
export const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const formatTime = (value) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];
// « 2026-10-25 » → « 25 octobre ». Date calendaire de Paris lue telle quelle :
// pas de new Date(), qui la décalerait selon le fuseau du navigateur.
export function dayMonthLabel(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  const month = m && MONTHS[Number(m[2]) - 1], day = m && Number(m[3]);
  if (!month || day < 1 || day > 31) return "";
  return `${day === 1 ? "1er" : day} ${month}`;
}
export function safeMoney(calc, ref) {
  try {
    return money(calc.value(ref));
  } catch {
    return "À vérifier";
  }
}
export function saveFile(filename, contents) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
