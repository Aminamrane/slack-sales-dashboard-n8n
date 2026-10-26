import { money, Rational } from "./calculation.js";
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
// « 2026-09 » → « Septembre 2026 ».
export function monthLabel(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ""));
  const name = m && MONTHS[Number(m[2]) - 1];
  return name ? `${name[0].toUpperCase()}${name.slice(1)} ${m[1]}` : String(period || "");
}
// Décimale affichée à la française : « 1.5 » → « 1,5 ». La saisie accepte virgule ou point.
export const decimalLabel = (value) => String(value ?? "").replace(".", ",");
// Montant prêt à éditer : 800 → « 800 », 1500.5 → « 1500,50 ».
export function amountInput(rational) {
  const fixed = rational.toFixed(2);
  return (fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed).replace(".", ",");
}

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août",
  "sept.", "oct.", "nov.", "déc."];
const PARIS_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
// Signature d'une vente, à l'heure de Paris. Avec décalage (« …+00:00 », « …Z ») :
// instant converti par Intl ; sans décalage : heure-mur lue telle quelle, jamais devinée.
// → { key: « AAAA-MM-JJ HH:MM:SS » triable, label: « 12 sept. » } ou null.
export function signedParis(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?)?$/
    .exec(String(raw || "").trim());
  if (!m) return null;
  let [, y, mo, d, h = "00", mi = "00", sec = "00"] = m;
  const offset = m[8];
  if (offset) {
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec}.${(m[7] || "").padEnd(3, "0").slice(0, 3)}${
      offset === "Z" ? "Z" : offset.replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2")}`;
    const instant = new Date(iso);
    if (!Number.isFinite(instant.getTime())) return null;
    const p = Object.fromEntries(PARIS_PARTS.formatToParts(instant).map((x) => [x.type, x.value]));
    [y, mo, d, h, mi, sec] = [p.year, p.month, p.day, p.hour, p.minute, p.second];
  }
  const month = SHORT_MONTHS[Number(mo) - 1], day = Number(d);
  if (!month || day < 1 || day > 31) return null;
  return { key: `${y}-${mo}-${d} ${h}:${mi}:${sec}`, label: `${day === 1 ? "1er" : day} ${month}` };
}

// Statut Finance d'une vente, calculé par le back (entry.finance.status / statusLabel).
// Sans client relié, ou tant que le back n'envoie pas le statut : « À rapprocher ».
const FINANCE_LABELS = {
  paid: "Première échéance payée",
  lost: "Client perdu",
  onboarding_pending: "Onboarding à venir",
  first_due_unpaid: "Première échéance non payée",
  no_schedule: "Aucune échéance en Finance",
};
const FINANCE_TONES = { paid: "paid", first_due_unpaid: "late" };
export const UNMATCHED = "unmatched";
export const NOT_DECLARED_HINT =
  "Contrat signé, vente pas encore déclarée dans le CRM : pas de fiche client, donc pas de suivi Finance.";
// Sans fiche Finance, le back précise pourquoi (entry.unlinkedReason) : « not_declared »
// (contrat signé, vente jamais déclarée) ou « no_client ». Sans le champ : « À rapprocher ».
export function financeBadge(finance, unlinkedReason) {
  if (!finance && unlinkedReason === "not_declared")
    return { key: "not_declared", label: "Vente non déclarée", tone: "neutral", hint: NOT_DECLARED_HINT };
  const key = typeof finance?.status === "string" ? finance.status : "";
  const label = (typeof finance?.statusLabel === "string" && finance.statusLabel.trim()) || FINANCE_LABELS[key];
  if (!key || !label) return { key: UNMATCHED, label: "À rapprocher", tone: "neutral" };
  return { key, label, tone: FINANCE_TONES[key] || "neutral" };
}

// Historique lisible : jamais de référence de cellule ni de formule brute.
export const auditDetail = (detail) => String(detail ?? "").replace(/^[A-Z]{1,3}\d+(?: · |$)/, "");
export function auditValue(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "vide";
  if (!s.startsWith("=")) {
    try {
      return money(Rational.from(s));
    } catch {
      return s;
    }
  }
  const m = s.replace(/\s/g, "").match(/\*\(?([0-9]+(?:\.[0-9]+)?)\)?$/);
  return m ? `coefficient ${decimalLabel(m[1])}` : "calcul personnalisé";
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
