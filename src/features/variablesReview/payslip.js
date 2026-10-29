// Relevé du mois envoyé au sales (dev 28/10/2026 : « un PDF avec les infos du mois qu'on peut envoyer aux sales »,
// en ticket). Données prêtes à imprimer, sans React : le montant versé et sa date, les lignes du ticket de la carte
// (ticketLines, même source), puis le détail des ventes et des parts d'équipe. Logique pure, testée par payslip.test.js.
import { money } from "./calculation.js";
import { CHANNELS, initials, monthLabel, ofMonth, rowStatus } from "./presentation.js";
import { ticketLines, tierNote } from "./ticket.js";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// Paie du mois M versée le 1er de M+1 : « 1er novembre 2026 ».
export function payDayLabel(period) {
  const [year, month] = String(period).split("-").map(Number);
  return month === 12 ? `1er janvier ${year + 1}` : `1er ${MONTHS[month]} ${year}`;
}
// Référence lisible et stable du relevé : mois + 6 chiffres tirés de l'identifiant du relevé.
export function payslipReference(statement) {
  let hash = 0;
  for (const ch of String(statement.id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `VAR-${statement.period.replace("-", "")}-${String(hash % 1_000_000).padStart(6, "0")}`;
}
// La police du PDF n'a pas l'espace fine insécable des milliers (« 4 000 » deviendrait « 4000 ») : espace insécable.
const pdfText = (text) => String(text ?? "").replace(/\u202F/g, "\u00A0");
const amount = (value) => pdfText(money(value));
const slug = (text) => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

// saleRows / teamRows : lignes des tableaux de la page (statut, dates, canal, montant), déjà calculées pour l'écran.
export function payslipOf({ statement, row, model, gross, teamShare, bonuses = [], saleRows = [], teamRows = [], readingDay, today }) {
  const period = statement.period;
  const { lines } = ticketLines({ period, model, gross, teamShare, bonuses });
  const month = monthLabel(period).toLowerCase();
  const sale = (r) => ({
    client: r.client,
    meta: [r.signedDay && `Signée le ${r.signedDay}`, CHANNELS[r.channel], r.range && `${r.range} salariés`].filter(Boolean).join(" · "),
    status: rowStatus(r).label,
    tone: rowStatus(r).tone,
    amount: pdfText(r.value),
    struck: r.status === "lost",
  });
  const bySigned = (a, b) => String(a.signedAt || "").localeCompare(String(b.signedAt || ""));
  return {
    fileName: `Remuneration-${period}-${slug(row.name)}.pdf`,
    reference: payslipReference(statement),
    person: row.name,
    initials: initials(row.name),
    role: row.head ? "Head of sales" : "Sales",
    title: `Rémunération ${ofMonth(month)}`,
    total: amount(model.total),
    payDay: payDayLabel(period),
    monthSales: statement.tier?.monthSales ?? 0,
    tier: model.tier ? `Palier ${model.tier.reached.sales} ventes atteint` : null,
    lines: lines.map((l) => (l.kind === "note"
      ? { key: l.key, kind: "note", label: tierNote(l.tier, amount) }
      : { key: l.key, kind: l.kind || "line", label: l.detail ? `${l.label} · ${l.detail}` : l.label, pill: !!l.pill,
        count: l.count || "", struck: !!l.struck,
        amount: typeof l.amount === "string" ? l.amount : `${l.sign ? `${l.sign}\u00A0` : ""}${amount(l.amount)}` })),
    sales: saleRows.filter((r) => !r.signedBefore).sort(bySigned).map(sale),
    before: saleRows.filter((r) => r.signedBefore).sort(bySigned).map(sale),
    team: [...teamRows].sort(bySigned).map((r) => ({ client: r.client, meta: r.sellerName ? `Vente de ${r.sellerName}` : "", amount: pdfText(r.value) })),
    readingDay: readingDay || "",
    generatedOn: today || "",
  };
}
