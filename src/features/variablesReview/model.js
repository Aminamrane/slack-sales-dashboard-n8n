import { createCalculator, Rational, ZERO } from "./calculation.js";
import { resolveDeal } from "./dealCalculation.js";
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
      throw new Error("Le fixe garanti ne peut pas être négatif.");
  }
  const sorted = [...tiers].sort((a, b) => Number(a.sales) - Number(b.sales));
  for (let i = 1; i < sorted.length; i++)
    if (
      Rational.from(sorted[i].amount).sub(Rational.from(sorted[i - 1].amount))
        .n < 0n
    )
      throw new Error(
        "Le fixe garanti doit progresser avec le nombre de ventes.",
      );
  return sorted;
}
export function fixedByTiers(base, tiers, sales) {
  const sorted = validateTiers(tiers);
  if (tiers.length && (!/^\d+$/.test(String(sales)) || Number(sales) > 10000))
    throw new Error(
      "Renseignez le nombre de ventes validées pour appliquer les paliers.",
    );
  let effective = base,
    applied = null;
  for (const tier of sorted)
    if (
      Number(sales) >= Number(tier.sales) &&
      Rational.from(tier.amount).sub(effective).n > 0n
    ) {
      effective = Rational.from(tier.amount);
      applied = tier;
    }
  return { effective, applied };
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
  // Part d'équipe d'un head (cellules T, une par vente de son équipe) : abonnement mensuel de la vente
  // × coefficient « team » de la source, sans mensuel/annuel. Source désactivée, coefficient absent ou
  // part saisie à la main (exception) : la cellule garde sa formule.
  const teamEntries = (statement.teamRefs || []).length
    ? new Map((data.entries || []).filter((e) => e.teamCell).map((e) => [e.teamCell, e]))
    : null;
  for (const ref of statement.teamRefs || []) {
    const entry = teamEntries.get(ref);
    const rule = settings.acquisition?.[entry?.originChannel];
    if (!entry || !rule?.enabled || rule.team == null || settings.deals?.[ref]?.exception) continue;
    if (Rational.from(rule.team).n < 0n)
      throw new Error("La base et le coefficient doivent être positifs ou nuls.");
    scopedChanges[ref] = `=(C${ref.slice(1)}/12)*(${rule.team})`;
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
  const tierResult = fixedByTiers(fixed, settings.tiers || [], settings.sales);
  if ((settings.tiers || []).length && !fixedCell)
    throw new Error(
      "Le fixe de ce relevé doit être identifié avant d’appliquer un palier.",
    );
  const effective =
    fixedCell && tierResult.applied
      ? createCalculator(data.cells, {
          ...scopedChanges,
          [fixedCell]: tierResult.applied.amount,
        })
      : base;
  const sourceTotal = createCalculator(data.cells).value(statement.totalCell);
  const baseTotal = base.value(statement.totalCell),
    effectiveTotal = effective.value(statement.totalCell);
  const commission = amountRefs.reduce(
    (n, r) => n.add(effective.value(r)),
    ZERO,
  );
  const teamShare = teamRefs.reduce((n, r) => n.add(effective.value(r)), ZERO);
  const bonuses = (settings.bonuses || []).reduce(
    (n, b) => n.add(Rational.from(b.amount)),
    ZERO,
  );
  const total = effectiveTotal.add(bonuses);
  return {
    appliedAcquisition,
    fixedCell,
    fixed,
    appliedTier: tierResult.applied,
    effectiveFixed: tierResult.effective,
    sourceTotal,
    baseTotal,
    effectiveTotal,
    commission,
    teamShare,
    bonuses,
    total,
    delta: total.sub(sourceTotal),
    remainder: effectiveTotal.sub(tierResult.effective).sub(commission).sub(teamShare),
    amountRefs,
    teamRefs,
    allRefs,
    calculator: effective,
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
