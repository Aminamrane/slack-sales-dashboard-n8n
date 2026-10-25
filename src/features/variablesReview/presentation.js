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
