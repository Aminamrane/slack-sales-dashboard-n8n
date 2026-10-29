import { createCalculator, Rational, ZERO } from "./calculation.js";
import { resolveDeal, splitCoefficient } from "./dealCalculation.js";
// Paliers (dev 28/10/2026) : un seuil entier de ventes par palier, deux paliers jamais au même seuil, montants
// positifs qui progressent avec le nombre de ventes. Écrits par le serveur (PUT /variables/workbench/tiers).
export function validateTiers(tiers) {
  const seen = new Set();
  for (const tier of tiers) {
    if (
      !/^\d+$/.test(String(tier.sales)) ||
      Number(tier.sales) < 1 ||
      Number(tier.sales) > 10000
    )
      throw new Error(
        "Le seuil doit être un nombre entier de ventes, supérieur à zéro.",
      );
    if (seen.has(Number(tier.sales)))
      throw new Error("Deux paliers ne peuvent pas avoir le même seuil.");
    seen.add(Number(tier.sales));
    if (Rational.from(tier.amount).n < 0n)
      throw new Error("Le montant d’un palier ne peut pas être négatif.");
  }
  const sorted = [...tiers].sort((a, b) => Number(a.sales) - Number(b.sales));
  for (let i = 1; i < sorted.length; i++)
    if (
      Rational.from(sorted[i].amount).sub(Rational.from(sorted[i - 1].amount))
        .n < 0n
    )
      throw new Error(
        "Le montant doit progresser avec le nombre de ventes.",
      );
  return sorted;
}
// Palier du relevé (statement.tier, décidé par le serveur), règle de la feuille de paie « Apports d'affaires » : un
// minimum sur le total du mois, fixe + commissions des ventes du mois (tier.refs, aux coefficients du brouillon) +
// part d'un head sur les ventes de son équipe signées dans le mois (tier.teamRefs) + primes. Il ne joue que si ce total
// est en dessous (tier.binding) ; le complément est la différence, jamais négative.
export function tierOf(statement, calculator, { fixed = ZERO, bonuses = ZERO } = {}) {
  const tier = statement.tier;
  if (!tier?.reached || tier.binding === false) return null;
  const sum = (refs) => (refs || []).reduce((n, r) => n.add(calculator.value(r)), ZERO);
  const monthCommission = sum(tier.refs);
  const monthTotal = fixed.add(monthCommission).add(sum(tier.teamRefs)).add(bonuses);
  const gap = Rational.from(tier.reached.amount).sub(monthTotal);
  return {
    reached: tier.reached,
    monthSales: tier.monthSales,
    retracted: tier.retracted,
    monthCommission,
    monthTotal,
    complement: gap.n > 0n ? gap : ZERO,
  };
}
export function statementModel(data, statement, changes = {}, settings = {}) {
  const scopedChanges = { ...changes };
  const original = createCalculator(data.cells, changes);
  const commissionRefs = original
    .dependencies(statement.totalCell, {
      recursive: true,
      stopAt: (r) => /^E\d+$/.test(r),
    })
    .filter((r) => /^E\d+$/.test(r));
  const appliedAcquisition = {};
  for (const ref of statement.entryRefs || commissionRefs) {
    const deal = resolveDeal(data, {amountCell:ref}, settings.deals?.[ref], original);
    const rule = settings.acquisition?.[deal?.channel];
    if (!rule?.enabled || deal?.exception) continue;
    if (deal.base === "" || deal.base == null)
      throw new Error(
        `${ref} : précisez la base de calcul pour appliquer la règle ${deal.channel}.`,
      );
    const amount = deal.baseExpression ? original.evaluate("="+deal.baseExpression) : Rational.from(deal.base),
      coefficient = Rational.from(deal.plan === "A" ? rule.coefficientAnnual ?? rule.coefficient : rule.coefficient);
    if (amount.n < 0n || coefficient.n < 0n)
      throw new Error(
        "La base et le coefficient doivent être positifs ou nuls.",
      );
    scopedChanges[ref] = `=(${deal.baseExpression || deal.base})*(${deal.plan === "A" ? rule.coefficientAnnual ?? rule.coefficient : rule.coefficient})`;
    appliedAcquisition[ref] = deal.channel;
  }
  // Part d'équipe d'un head (cellules T, une par vente de son équipe) : base de la vente (celle de la formule
  // du serveur : prix Owner, ou total × 80 % à partir de 6 salariés) × coefficient « team » de la source, sans
  // mensuel/annuel. Source désactivée, coefficient absent ou part saisie à la main (exception) : la cellule
  // garde sa formule.
  const teamEntries = (statement.teamRefs || []).length
    ? new Map((data.entries || []).filter((e) => e.teamCell).map((e) => [e.teamCell, e]))
    : null;
  for (const ref of statement.teamRefs || []) {
    const entry = teamEntries.get(ref);
    const rule = settings.acquisition?.[entry?.originChannel];
    if (!entry || !rule?.enabled || rule.team == null || settings.deals?.[ref]?.exception) continue;
    if (Rational.from(rule.team).n < 0n)
      throw new Error("La base et le coefficient doivent être positifs ou nuls.");
    const base = splitCoefficient(data.cells?.[ref]?.input)?.baseExpression || `C${ref.slice(1)}/12`;
    scopedChanges[ref] = `=(${base})*(${rule.team})`;
    appliedAcquisition[ref] = entry.originChannel;
  }
  const base = createCalculator(data.cells, scopedChanges);
  const refs = base.dependencies(statement.totalCell, {
    recursive: true,
    stopAt: (r) => /^[ET]\d+$/.test(r),
  });
  const amountRefs = refs.filter((r) => /^E\d+$/.test(r));
  const teamRefs = refs.filter((r) => /^T\d+$/.test(r));
  const allRefs = base.dependencies(statement.totalCell, { recursive: true });
  const fixedRefs = allRefs.filter(
    (ref) =>
      /^H\d+$/.test(ref) &&
      String(data.cells[`G${ref.slice(1)}`]?.input || "").startsWith("Fixe"),
  );
  const fixedCell = fixedRefs.length === 1 ? fixedRefs[0] : null;
  const fixed = fixedCell ? base.value(fixedCell) : ZERO;
  const bonuses = (settings.bonuses || []).reduce(
    (n, b) => n.add(Rational.from(b.amount)),
    ZERO,
  );
  const tier = tierOf(statement, base, { fixed, bonuses });
  const complement = tier ? tier.complement : ZERO;
  const sourceTotal = createCalculator(data.cells).value(statement.totalCell);
  const baseTotal = base.value(statement.totalCell),
    effectiveTotal = baseTotal.add(complement);
  const commission = amountRefs.reduce((n, r) => n.add(base.value(r)), ZERO);
  const teamShare = teamRefs.reduce((n, r) => n.add(base.value(r)), ZERO);
  const total = effectiveTotal.add(bonuses);
  return {
    appliedAcquisition,
    fixedCell,
    fixed,
    tier,
    sourceTotal,
    baseTotal,
    effectiveTotal,
    commission,
    teamShare,
    bonuses,
    total,
    delta: total.sub(sourceTotal),
    remainder: baseTotal.sub(fixed).sub(commission).sub(teamShare),
    amountRefs,
    teamRefs,
    allRefs,
    calculator: base,
  };
}
export function impactedStatements(data, changes) {
  const original = createCalculator(data.cells),
    current = createCalculator(data.cells, changes);
  return data.statements.filter((s) => {
    try {
      return (
        current.value(s.totalCell).sub(original.value(s.totalCell)).n !== 0n
      );
    } catch {
      return true;
    }
  });
}
export const emptyDraft = (hash) => ({
  version: 1,
  sourceHash: hash,
  changes: {},
  settings: {},
  audit: [],
});
const isMap = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
// Brouillon partagé renvoyé par le serveur : forme vérifiée avant tout usage,
// jamais réparée en silence. Le sourceHash n'est pas comparé : les données sont
// lues en direct, leur empreinte change à chaque lecture.
export function parseDraft(value) {
  if (
    !isMap(value) ||
    value.version !== 1 ||
    !isMap(value.changes) ||
    !isMap(value.settings) ||
    !Array.isArray(value.audit) ||
    !Number.isInteger(value.revision) ||
    value.revision < 0
  )
    throw new Error("Brouillon enregistré illisible");
  return value;
}
