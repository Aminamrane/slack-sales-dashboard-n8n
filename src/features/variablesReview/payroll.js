// Paie versée et alertes (règles : app/services/variables_payroll.py, côté back). Logique pure, sans React (testée par
// payroll.test.js). La page suit toujours les données ; la paie du mois M est versée le 1er du mois suivant, et ce qui
// change ensuite sur ce qui a été versé est signalé :
// - alertes du serveur (source.payroll.alerts) : écarts entre la photo de la paie et le calcul du jour ;
// - modifications faites dans la page sur un mois déjà versé (journal du brouillon) ;
// - photo manquante ou prise en retard : les changements ne peuvent pas tous être signalés.
import { Rational } from "./calculation.js";
import { CHANNELS, closedLabel, dayMonthLabel, euros, monthName, ofMonth } from "./presentation.js";

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const parisDay = (iso) => {
  const instant = new Date(String(iso || ""));
  return Number.isFinite(instant.getTime()) ? PARIS_DAY.format(instant) : null;
};
const statementMonth = (statementId) => /^crm:[^:]+:(\d{4}-\d{2})$/.exec(String(statementId || ""))?.[1] || null;

// Modifications faites dans la page (coefficient, fixe, prime, règles) sur un mois dont la paie était déjà versée.
export function editAlerts(source, audit = []) {
  const payDates = source.payroll?.payDates || {};
  return audit.flatMap((item) => {
    const month = statementMonth(item.statementId), day = parisDay(item.at);
    if (!month || !payDates[month] || !day || day < payDates[month]) return [];
    return [{ id: `edited:${item.id}`, type: "edited", month, payDate: payDates[month], person: item.person,
      action: item.action, detail: item.detail, at: item.at }];
  });
}

// Paies versées sans photo, ou photographiées après le jour de la paie.
export function noticeAlerts(source) {
  const payroll = source.payroll || {};
  const missing = (payroll.missing || []).map((month) => ({ id: `missing:${month}`, type: "missing", month, payDate: payroll.payDates?.[month] }));
  const late = Object.entries(payroll.snapshots || {}).filter(([, s]) => s.late)
    .map(([month, s]) => ({ id: `late:${month}`, type: "late", month, payDate: payroll.payDates?.[month], takenAt: s.takenAt }));
  return [...missing, ...late];
}

// Toutes les alertes de la page, du mois le plus récent au plus ancien.
export function payrollAlerts(source, audit) {
  return [...(source.payroll?.alerts || []), ...editAlerts(source, audit), ...noticeAlerts(source)]
    .sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

// Alertes d'une ligne (vente × nature) dans le relevé d'un mois : celles de son mois de paie, et pour une ligne
// redatée ou versée deux fois, aussi celles du mois où elle compte maintenant.
export function rowAlerts(alerts, leadId, kind, period) {
  const key = `${leadId}:${kind}`;
  return alerts.filter((a) => a.key === key && (a.month === period || a.toMonth === period || a.now?.month === period
    || (a.months || []).includes(period)));
}

const nameOf = (source, person) => source.profiles?.[person]?.name || person || "";
const amount = (value) => {
  try {
    return euros(Rational.from(value));
  } catch {
    return String(value ?? "");
  }
};
const FACTORS = {
  annual: (v) => `prix ${amount(v)}`,
  range: (v) => (v ? `tranche ${v}` : "tranche non renseignée"),
  baseRule: (v) => (v === "total" ? "base total × 80 %" : "base prix Owner"),
  plan: (v) => (v === "A" ? "annuel" : "mensuel"),
  channel: (v) => CHANNELS[v] || "canal non retrouvé",
  coefficient: (v) => `coefficient ${String(v ?? "").replace(".", ",")}`,
};
const change = ({ factor, paid, now }) => `${FACTORS[factor](paid)} → ${FACTORS[factor](now)}`;
const subject = (source, alert) => (alert.kind === "team"
  ? `${alert.client}, part d’équipe de ${nameOf(source, alert.person)}`
  : `${alert.client}, ${nameOf(source, alert.person)}`);

// Texte d'une alerte : titre court, phrase qui dit ce qui s'est passé et quoi faire, montant concerné.
export function alertText(source, alert) {
  const month = monthName(alert.month), paidOn = dayMonthLabel(alert.payDate);
  const paidWith = `versée avec la paie ${ofMonth(month)}${paidOn ? ` le ${paidOn}` : ""}`;
  switch (alert.type) {
    case "moved":
      return { title: "Paiement redaté après la paie", amount: alert.paid?.amount, subject: subject(source, alert),
        detail: `${paidWith} ; la Finance date maintenant le paiement en ${monthName(alert.toMonth)}. Elle compte aussi en ${monthName(alert.toMonth)} : ne pas la reverser.` };
    case "removed":
      return { title: "Paiement retiré après la paie", amount: alert.paid?.amount, subject: subject(source, alert),
        detail: `${paidWith} ; sa première échéance n’apparaît plus payée en Finance.` };
    case "added":
      return { title: "Paiement saisi après la paie", amount: alert.now?.amount, subject: subject(source, alert),
        detail: `payée en ${month}, saisie après la paie${paidOn ? ` du ${paidOn}` : ""} : pas encore versée, à ajouter.` };
    case "amount":
      return { title: "Montant changé après la paie", amount: alert.now?.amount, subject: subject(source, alert),
        detail: `${paidWith} : ${amount(alert.paid?.amount)} ; vaut maintenant ${amount(alert.now?.amount)} (${(alert.causes || []).map(change).join(", ")}).` };
    case "beneficiary":
      return { title: "Bénéficiaire changé après la paie", amount: alert.paid?.amount, subject: alert.client,
        detail: `${paidWith} à ${nameOf(source, alert.paid?.person)} ; revient maintenant à ${nameOf(source, alert.now?.person)}.` };
    case "fixed":
      return { title: "Fixe changé après la paie", amount: alert.now?.amount, subject: nameOf(source, alert.person),
        detail: `fixe ${ofMonth(month)} versé : ${amount(alert.paid?.amount)} ; maintenant ${amount(alert.now?.amount)}.` };
    case "double":
      return { title: "Versée deux fois", amount: alert.paid?.amount, subject: subject(source, alert),
        detail: `dans les paies ${(alert.months || []).map((m) => ofMonth(monthName(m))).join(" et ")}.` };
    case "edited":
      return { title: "Modifié dans la page après la paie", subject: nameOf(source, alert.person),
        detail: `${alert.action}${alert.detail ? ` (${String(alert.detail).replace(/^[A-Z]{1,3}\d+(?: · |$)/, "")})` : ""} sur ${month}, le ${closedLabel(alert.at)}, après la paie${paidOn ? ` du ${paidOn}` : ""}.` };
    case "missing":
      return { title: "Paie sans photo", subject: `Paie ${ofMonth(month)}`,
        detail: `aucune photo prise le jour de la paie : les changements faits depuis ne peuvent pas être signalés.` };
    case "late":
      return { title: "Photo prise en retard", subject: `Paie ${ofMonth(month)}`,
        detail: `photo prise le ${closedLabel(alert.takenAt)} : un changement fait entre la paie et cette date n’est pas signalé.` };
    default:
      return { title: "Changement après la paie", subject: alert.client || "", detail: "" };
  }
}
