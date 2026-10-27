// Registre des paies côté page (règles et garanties : app/services/variables_payroll.py, côté back).
// Logique pure, sans React (testée par payroll.test.js).
// - Un relevé est « open » (versé par la page), « page » (paie clôturée ici : montants, fixe et réglages figés) ou
//   « hors_page » (paie versée avant la page, par l'ancienne page ou l'Excel : relevé indicatif).
// - Les cellules figées par une clôture (source.payroll.frozenRefs) ne prennent plus le brouillon.
// - Une clôture envoie chaque relevé du mois tel qu'il est affiché ; le back vérifie que ses lignes sont exactement
//   celles qu'il rend versables ce mois-là, puis les inscrit une fois pour toutes.
import { createCalculator, Rational, ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import { statementSettings } from "./team.js";

export const OPEN = "open", CLOSED_HERE = "page", PAID_OUTSIDE = "hors_page";

export const payrollOf = (statement) => statement?.payroll || { state: OPEN };
export const isLocked = (statement) => payrollOf(statement).state !== OPEN;

// Brouillon sans les cellules figées : une clôture fixe leur valeur, rien ne la modifie ensuite.
export function activeChanges(source, changes) {
  const frozen = source?.payroll?.frozenRefs;
  if (!frozen?.length) return changes;
  const active = { ...changes };
  for (const ref of frozen) delete active[ref];
  return active;
}

const cents = (value) => value.toFixed(2);

// Corps de POST …/months/{mois}/close : chaque relevé du mois, calculé comme à l'écran (brouillon, règles, paliers,
// primes), avec ses lignes versées (cellules E et T comptées) et la formule de chacune. Lève l'erreur du premier relevé
// qui ne se calcule pas : la paie ne se clôture pas tant qu'il reste un calcul bloqué.
export function closurePayload(source, draft, month) {
  const changes = activeChanges(source, draft.changes);
  const entered = createCalculator(source.cells, changes);
  const statements = {};
  for (const statement of source.statements.filter((s) => s.period === month)) {
    const settings = statementSettings(statement, draft);
    const model = statementModel(source, statement, changes, settings);
    const lines = {};
    for (const ref of [...model.amountRefs, ...model.teamRefs]) {
      const baseRef = `C${ref.slice(1)}`;
      lines[ref] = { amount: cents(model.calculator.value(ref)), formula: String(model.calculator.raw(ref)),
        baseRef, baseInput: String(model.calculator.raw(baseRef)) };
    }
    statements[statement.id] = {
      fixedRef: statement.fixedCell, fixedInput: String(entered.raw(statement.fixedCell)), settings,
      total: cents(model.total), commission: cents(model.commission), teamShare: cents(model.teamShare),
      bonuses: cents(model.bonuses), lines,
    };
  }
  return statements;
}

// Récapitulatif de la paie d'un mois avant clôture : relevés, lignes versées, total, ventes à confirmer laissées de côté.
export function closureSummary(statements, heldCount) {
  const values = Object.values(statements);
  return {
    people: values.length,
    lines: values.reduce((n, s) => n + Object.keys(s.lines).length, 0),
    total: values.reduce((sum, s) => sum.add(Rational.from(s.total)), ZERO),
    held: heldCount,
  };
}

// Ventes « à confirmer » d'un mois (commission et part d'équipe), toutes personnes confondues.
export const heldCount = (source, month) =>
  new Set(source.statements.filter((s) => s.period === month)
    .flatMap((s) => [...(s.heldRefs || []), ...(s.heldTeamRefs || [])].map((ref) => ref.slice(1)))).size;

// À confirmer dans le relevé : montant et nombre de lignes, commission et part d'équipe (hors total du mois).
export function heldOf(statement, model) {
  const refs = [...(statement.heldRefs || []), ...(statement.heldTeamRefs || [])];
  let amount = ZERO;
  for (const ref of refs) {
    try {
      amount = amount.add(model.calculator.value(ref));
    } catch {
      /* compté dans le nombre, pas dans la somme */
    }
  }
  return { amount, count: refs.length };
}

// Message d'un refus du serveur (409 detail), en clair.
const REFUSALS = {
  stale_revision: "Un autre utilisateur a modifié les variables. Rechargez la page.",
  source_changed: "Les ventes du mois ont changé depuis l’affichage. Rechargez la page, puis clôturez.",
  not_closable: "Ce mois n’est plus à clôturer. Rechargez la page.",
  page_used: "Une paie a déjà été clôturée dans la page : ce mois ne peut plus être déclaré versé ailleurs.",
  not_held: "Cette vente n’est plus à confirmer. Rechargez la page.",
  already_closed: "Cette paie est déjà clôturée. Rechargez la page.",
  already_paid: "Une de ces ventes est déjà versée. Rechargez la page.",
  already_decided: "Cette vente a déjà été décidée. Rechargez la page.",
};
export const refusalMessage = (error) =>
  REFUSALS[error?.data?.detail ?? error?.detail] || "Enregistrement impossible : rien n’a été modifié. Réessayez.";
