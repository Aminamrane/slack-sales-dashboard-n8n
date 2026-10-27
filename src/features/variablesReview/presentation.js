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

// Tranche de salariés, clé de lecture de l'Excel : « 6-10 salariés ».
export const rangeLabel = (range) => (range ? `${range} salariés` : "Tranche non renseignée");

// Montant sans centimes quand il est rond : « 5 760 € », sinon « 2 798,40 € ».
export const euros = (value) => money(value).replace(/,00(?=\u00a0€$)/, "");

// Base d'une vente écrite comme dans l'Excel : « (5 760 € × 80 %) / 12 » (total = prix Owner / 0,7) ou
// « 2 160 € / 12 » (prix Owner). null pour une base saisie à la main ou une formule libre.
export function baseCaption(cells, baseExpression) {
  const expr = String(baseExpression || "").replace(/\s/g, "").replace(/^\((.*)\)$/, "$1");
  const total = /^C(\d+)\/0\.7\*0\.8\/12$/.exec(expr), owner = /^C(\d+)\/12$/.exec(expr);
  const annual = (row) => {
    try {
      return Rational.from(String(cells?.[`C${row}`]?.input ?? ""));
    } catch {
      return null;
    }
  };
  if (total) {
    const price = annual(total[1]);
    return price ? `(${euros(price.div(Rational.from("0.7")))} × 80 %) / 12` : null;
  }
  if (owner) {
    const price = annual(owner[1]);
    return price ? `${euros(price)} / 12` : null;
  }
  return null;
}
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

// Mois d'un relevé ou d'un paiement, relatif au mois affiché : « septembre », ou
// « décembre 2025 » quand l'année diffère de celle du mois affiché.
export function monthName(period, reference) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ""));
  const name = m && MONTHS[Number(m[2]) - 1];
  if (!name) return "";
  return reference && String(reference).slice(0, 4) !== m[1] ? `${name} ${m[1]}` : name;
}
// « 2026-10-22 » → « 22/10 » ; l'année est ajoutée quand elle diffère de la référence.
function shortDay(isoDay, referenceYear) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDay || ""));
  if (!m) return "";
  return referenceYear && referenceYear !== m[1] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[3]}/${m[2]}`;
}
// « 21/09 » : signature (heure de Paris) ou paiement d'une vente, colonne du tableau.
export const signedDayOf = (entry) => shortDay(signedParis(entry?.signedAt)?.key, null);
export const paidDayOf = (entry) => shortDay(entry?.paidOn, (signedParis(entry?.signedAt)?.key || "").slice(0, 4) || null);

// Mois de signature d'une vente (champ du back, sinon déduit de signedAt à l'heure de Paris).
export const signedMonthOf = (entry) => entry?.signedMonth || signedParis(entry?.signedAt)?.key.slice(0, 7) || "";

// Chronologie factuelle d'une vente : « Signée le 30/09 · 1re échéance octobre · payée le 22/10 ».
export function saleTimeline(entry) {
  const signedKey = signedParis(entry?.signedAt)?.key || "";
  const year = signedKey.slice(0, 4) || null;
  const parts = [];
  if (signedKey) parts.push(`Signée le ${shortDay(signedKey, null)}`);
  if (entry?.finance?.firstDuePeriod) parts.push(`1re échéance ${monthName(entry.finance.firstDuePeriod, year ? `${year}-01` : null)}`);
  if (entry?.paidOnUnknown) parts.push("date de paiement inconnue");
  else if (entry?.paidOn) parts.push(`payée le ${shortDay(entry.paidOn, year)}`);
  return parts.join(" · ");
}

// Pastille de mois croisé dans le relevé du mois P (aucune notion de retard, factuel) :
// vente comptée en P mais signée avant → « Signée en septembre » ;
// vente signée en P mais comptée un autre mois → « Comptée en octobre ».
export function crossMonthLabel(status, entry, period) {
  const signed = signedMonthOf(entry);
  if (status === "counted" && signed && signed !== period) return `Signée en ${monthName(signed, period)}`;
  if (status === "deferred" && entry?.countedMonth) return `Comptée en ${monthName(entry.countedMonth, period)}`;
  return null;
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
// Non payée : pastille d'attention (marine), jamais de saumon ni de moutarde (charte des dashboards Owner).
const FINANCE_TONES = { paid: "paid", first_due_unpaid: "attention" };
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

// État d'une vente hors rémunération : un mot pour la colonne « Payée » (short), le libellé complet en bulle.
// Une 1re échéance qui tombe après le mois en cours (reportée par la facturation, ou fixée plus tard) n'est pas
// « non payée » : « 1re échéance en janvier ». currentMonth : mois de lecture des données (AAAA-MM).
const SHORT_STATUS = {
  paid: "Payée", lost: "Client perdu", onboarding_pending: "Onboarding", first_due_unpaid: "Non payée",
  no_schedule: "Sans échéance", not_declared: "Non déclarée", unmatched: "À rapprocher",
};
// Board (entry.finance.boardState, boardLost) : client fini au board = raison de la perte (« Rétractation ») ;
// client en pause = « En pause ».
export function saleState(entry, currentMonth) {
  const badge = financeBadge(entry?.finance, entry?.unlinkedReason);
  const board = entry?.finance?.boardState;
  if (badge.key === "lost" && board && entry?.finance?.boardLost)
    return { key: `lost:${board}`, label: `${board} au board`, short: board, tone: "neutral" };
  if (board === "Pause" && badge.key !== "paid" && badge.key !== "lost")
    return { key: "pause", label: "Client en pause au board", short: "En pause", tone: "neutral" };
  const due = entry?.finance?.firstDuePeriod;
  if (badge.key === "first_due_unpaid" && due && currentMonth && due > currentMonth) {
    const month = monthName(due, currentMonth);
    return { key: `due:${due}`, label: `1re échéance en ${month}`, short: `Échéance ${month}`, tone: "neutral" };
  }
  return { ...badge, short: SHORT_STATUS[badge.key] || badge.label };
}

// « d’octobre », « de septembre ».
export const ofMonth = (month) => (/^[aeiouh]/i.test(month) ? `d’${month}` : `de ${month}`);
const sales = (n) => `${n} vente${n > 1 ? "s" : ""}`;

// Statut d'une ligne (ventes, part d'équipe), en pastille : où va l'argent, sans lire le reste.
// tone : paid (dans la paie du mois), later (client payé après le mois : paie suivante), waiting (1re échéance
// passée et pas payée), upcoming (onboarding ou 1re échéance à venir), lost (client perdu), unknown (non déclarée…).
export function rowStatus(row) {
  const timeline = row.timeline || undefined;
  if (row.status === "counted") return { tone: "paid", label: row.paidDay ? `Payée le ${row.paidDay}` : "Payée", title: timeline };
  if (row.status === "deferred") return { tone: "later", label: row.paidDay ? `Payée le ${row.paidDay}` : "Payée plus tard", title: timeline };
  const state = row.saleState || {};
  const title = [state.label, state.hint, timeline].filter(Boolean).join(" · ") || undefined;
  if (row.status === "lost") return { tone: "lost", label: String(state.key).startsWith("lost:") ? state.short : "Client perdu", title };
  if (state.key === "pause") return { tone: "unknown", label: "En pause", title };
  if (String(state.key).startsWith("due:")) return { tone: "upcoming", label: String(state.label).replace("1re échéance", "Échéance"), title };
  if (state.key === "onboarding_pending") return { tone: "upcoming", label: "Onboarding à venir", title };
  if (state.key === "first_due_unpaid") return { tone: "waiting", label: "Non payée", title };
  return { tone: "unknown", label: state.short || "À rapprocher", title };
}

// Groupes des tableaux : où va l'argent. Titre, sous-titre (avec le nombre de ventes) et ton de l'en-tête.
// « counted-before » est un intertitre du groupe « Dans la paie » (même paie, signées un mois précédent).
export function groupText(key, period, count, laterMonths = []) {
  const month = monthName(period, period);
  if (key === "counted") return { tone: "paid", title: `Dans la paie ${ofMonth(month)}`, subtitle: sales(count) };
  if (key === "counted-before") return { tone: "paid", title: `Signées avant ${month}, payées en ${month}`, subtitle: sales(count) };
  if (key === "deferred") {
    const later = laterMonths.length === 1 ? monthName(laterMonths[0], period) : null;
    return later
      ? { tone: "later", title: `Dans la paie ${ofMonth(later)}`, subtitle: `Client payé en ${later} · ${sales(count)}` }
      : { tone: "later", title: "Dans une paie suivante", subtitle: `Client payé plus tard · ${sales(count)}` };
  }
  if (key === "pending") return { tone: "waiting", title: "Pas encore payées", subtitle: `Hors paie, en attente du client · ${sales(count)}` };
  return { tone: "lost", title: "Clients perdus", subtitle: `Hors paie · ${sales(count)}` };
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
