// Lignes du ticket « Brut du mois » (dev 28/10/2026 : « clair comme un ticket de caisse ») : une seule source pour la
// carte de la personne et le relevé PDF envoyé au sales. D'abord le variable, ligne par ligne (commissions des ventes
// du mois et leur détail, complément du palier avec son calcul, ventes antérieures, part d'équipe) et son sous-total,
// puis le fixe et les primes ; brut − clients qui paient plus tard = va toucher ce mois. Les clients perdus sont
// montrés barrés, hors brut (ils restent dans le manque à gagner).
//
// Ligne : { key, label, kind (sub | note | subtotal | total | net), count, amount (Rational ou texte), struck, pill
// (« au palier »), attention, sign, action, icon }. action / icon : ce que la carte branche au clic ; le PDF les ignore.
import { Rational } from "./calculation.js";
import { monthName } from "./presentation.js";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
const s = (n) => (n > 1 ? "s" : "");
const salesText = (n) => (n ? plural(n, "vente") : "");

// Calcul du complément, sous sa ligne : « 3 200,00 € garantis − 2 154,00 € de commissions ».
export const tierNote = ({ guaranteed, commission, over }, format) => (over
  ? `commissions au-dessus des ${format(guaranteed)} garantis`
  : `${format(guaranteed)} garantis − ${format(commission)} de commissions`);

export function ticketLines({ period, model, gross, teamShare, bonuses = [], fixedMissing = false }) {
  const month = monthName(period);
  const g = gross.groups;
  const brut = model.total.add(gross.later.amount);
  const variable = brut.sub(model.fixed).sub(model.bonuses).sub(model.remainder);
  const tier = model.tier;
  const tieredMonths = g.tiered.months, deferredMonths = g.deferred.months;
  const lines = [];
  const add = (line) => lines.push(line);

  add({ key: "month", label: "Commissions des ventes du mois", count: salesText(gross.count - g.lost.count) || "0 vente",
    amount: g.counted.amount.add(g.tiered.amount).add(g.tieredUnpaid.amount).add(gross.later.amount),
    action: "sales:ALL", icon: "chevron" });
  if (g.counted.count) add({ key: "month-paid", kind: "sub", label: `dont payée${s(g.counted.count)} en ${month}`,
    count: salesText(g.counted.count), amount: g.counted.amount, action: "sales:counted" });
  if (g.tiered.count) add({ key: "month-tiered", kind: "sub", pill: true,
    label: `dont payée${s(g.tiered.count)} ${tieredMonths.length === 1 ? `en ${monthName(tieredMonths[0], period)}` : "plus tard"}`,
    count: salesText(g.tiered.count), amount: g.tiered.amount, action: "sales:counted" });
  if (g.tieredUnpaid.count) add({ key: "month-tiered-unpaid", kind: "sub", pill: true,
    label: `dont pas encore payée${s(g.tieredUnpaid.count)}`, count: salesText(g.tieredUnpaid.count),
    amount: g.tieredUnpaid.amount, action: "sales:counted" });
  if (g.deferred.count) add({ key: "month-deferred", kind: "sub",
    label: `dont payée${s(g.deferred.count)} ${deferredMonths.length === 1 ? `en ${monthName(deferredMonths[0], period)}` : "plus tard"}`,
    count: salesText(g.deferred.count), amount: g.deferred.amount, action: "sales:deferred" });
  if (g.pending.count) add({ key: "month-pending", kind: "sub", label: `dont pas encore payée${s(g.pending.count)}`,
    count: salesText(g.pending.count), amount: g.pending.amount, action: "sales:pending" });
  if (g.lost.count) add({ key: "month-lost", kind: "sub", struck: true,
    label: `client${s(g.lost.count)} perdu${s(g.lost.count)}, non compté${s(g.lost.count)}`,
    count: salesText(g.lost.count), amount: g.lost.amount, action: "sales:lost" });
  if (tier) {
    const guaranteed = Rational.from(tier.reached.amount);
    add({ key: "tier", label: `Complément palier ${tier.reached.sales} ventes`, amount: tier.complement, action: "tiers", icon: "pencil" });
    add({ key: "tier-math", kind: "note", tier: { guaranteed, commission: tier.monthCommission, over: tier.complement.n === 0n } });
  }
  if (gross.before.count) {
    add({ key: "before", label: "Commissions ventes antérieures", count: salesText(gross.before.count),
      amount: gross.before.amount, action: "sales:counted", icon: "chevron" });
    for (const [signed, b] of Object.entries(gross.before.bySigned).sort(([a], [c]) => a.localeCompare(c)))
      add({ key: `before-${signed}`, kind: "sub", label: `dont signée${s(b.count)} en ${monthName(signed, period)}`,
        count: salesText(b.count), amount: b.amount, action: "sales:counted" });
  }
  if (teamShare) add({ key: "team", label: "Part d’équipe", count: salesText(teamShare.counted.length),
    amount: teamShare.amount, action: "team", icon: "chevron" });
  // Sous-total du variable dès qu'il additionne plus d'une ligne.
  if (1 + (tier ? 1 : 0) + (gross.before.count ? 1 : 0) + (teamShare ? 1 : 0) > 1)
    add({ key: "variable", kind: "subtotal", label: tier ? `Variable du mois · palier ${tier.reached.sales} ventes` : "Variable du mois",
      amount: variable });
  add({ key: "fixed", label: "Fixe", amount: model.fixedCell ? model.fixed : "Non identifié", attention: fixedMissing ? "Fixe à saisir" : null,
    disabled: !model.fixedCell, action: "fixed", icon: "pencil" });
  add({ key: "bonuses", label: "Primes", amount: model.bonuses, action: "bonus", icon: "plus" });
  for (const b of bonuses) add({ key: `bonus-${b.id}`, kind: "sub", label: b.label, detail: b.reason, amount: Rational.from(b.amount),
    bonus: b, action: "bonus-remove" });
  if (model.remainder.n !== 0n) add({ key: "remainder", label: "Autres ajustements", amount: model.remainder });
  // Rien à payer plus tard (tout est payé ou soldé par le palier) : le brut est la paie, une seule ligne.
  if (gross.later.count) {
    add({ key: "brut", kind: "total", label: "Brut du mois", amount: brut });
    add({ key: "later", label: "Clients qui paient plus tard", count: salesText(gross.later.count), amount: gross.later.amount,
      sign: "−", action: g.pending.count ? "sales:pending" : "sales:deferred", icon: "chevron" });
  }
  add({ key: "pay", kind: "net", label: "Va toucher ce mois", amount: model.total, action: "breakdown", icon: "chevron" });
  return { brut, variable, lines };
}
