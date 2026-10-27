import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator } from "./calculation.js";
import { statementModel } from "./model.js";
import {
  activeChanges, closurePayload, closureSummary, heldCount, heldOf, isLocked, payrollOf, refusalMessage,
} from "./payroll.js";
import { closedLabel, groupText, rowStatus } from "./presentation.js";
import { payMonth, saleCounts, SALE_GROUPS, statementSettings, statusFor, teamStatusFor } from "./team.js";

// Septembre clôturé dans la page (relevé « s9 » figé), octobre ouvert. E1 : vente versée en septembre ; E2 : à
// confirmer en octobre (signée en août, mois versé par l'ancienne paie) ; E3 : versable en octobre.
const source = {
  profiles: { Alice: { name: "Alice A", role: "sales" } },
  cells: {
    C1: { input: "2400" }, E1: { input: "=C1/12*1.5" }, C2: { input: "1200" }, E2: { input: "=C2/12*1.2" },
    C3: { input: "3600" }, E3: { input: "=C3/12*1.2" },
    G9: { input: "Fixe 2026-09" }, H9: { input: "500" }, M9: { input: "=H9+E1" },
    G10: { input: "Fixe 2026-10" }, H10: { input: "500" }, M10: { input: "=H10+E3" },
  },
  entries: [
    { amountCell: "E1", crmLeadId: 1, counted: true, pay: { state: "versee", month: "2026-09", paidSource: "page", paidAmount: "300.00" } },
    { amountCell: "E2", crmLeadId: 2, counted: true, pay: { state: "a_confirmer", month: "2026-10", outsideMonth: "2026-08" } },
    { amountCell: "E3", crmLeadId: 3, counted: true, pay: { state: "a_verser", month: "2026-10" } },
  ],
  statements: [
    { id: "s9", person: "Alice", period: "2026-09", totalCell: "M9", fixedCell: "H9", entryRefs: ["E1"], countedRefs: ["E1"],
      heldRefs: [], defaults: { sales: "1" },
      payroll: { state: "page", closedAt: "2026-10-28T14:05:00+00:00", closedBy: "Direction", total: "800.00", settings: { tiers: [] } } },
    { id: "s10", person: "Alice", period: "2026-10", totalCell: "M10", fixedCell: "H10", entryRefs: ["E2", "E3"],
      countedRefs: ["E3"], heldRefs: ["E2"], defaults: { sales: "1" }, payroll: { state: "open" } },
  ],
  payroll: { firstOpen: "2026-10", closable: null, canMarkOutside: false, months: {}, frozenRefs: ["E1", "C1", "G9", "H9", "M9"] },
};
const entry = (ref) => source.entries.find((e) => e.amountCell === ref);

test("frozen cells ignore the draft: a closed month cannot be changed afterwards", () => {
  const changes = { E1: "=C1/12*3", H9: "9999", E3: "=C3/12*1.5" };
  assert.deepEqual(activeChanges(source, changes), { E3: "=C3/12*1.5" });
  assert.equal(activeChanges({ payroll: { frozenRefs: [] } }, changes), changes);
  const calc = createCalculator(source.cells, activeChanges(source, changes));
  assert.equal(calc.value("M9").toFixed(2), "800.00");
});

test("a statement closed in the page keeps its validated settings; an open one reads the draft", () => {
  const draft = { settings: { s9: { tiers: [{ sales: "1", amount: "5000" }] }, s10: { bonuses: [] } } };
  assert.deepEqual(statementSettings(source.statements[0], draft), { sales: "1", tiers: [] });
  assert.deepEqual(statementSettings(source.statements[1], draft), { sales: "1", bonuses: [] });
  assert.equal(isLocked(source.statements[0]), true);
  assert.equal(isLocked(source.statements[1]), false);
  assert.deepEqual(payrollOf({}), { state: "open" });
});

test("statuses read the register: counted, held, paid in another month", () => {
  const october = statusFor(source.statements[1]);
  assert.deepEqual(["E2", "E3"].map((ref) => october(entry(ref))), ["held", "counted"]);
  const september = statusFor(source.statements[0]);
  assert.equal(september(entry("E1")), "counted");
  assert.equal(statusFor({ period: "2026-08", countedRefs: [], heldRefs: [] })(entry("E2")), "deferred");
  assert.equal(payMonth(entry("E2")), "2026-10");
  assert.equal(payMonth({ pay: { state: "non_due", month: null } }), null);
  assert.equal(payMonth({ counted: true, countedMonth: "2026-07" }), "2026-07");   // source d'avant le registre
  const team = teamStatusFor({ period: "2026-10", countedTeamRefs: [], heldTeamRefs: ["T2"] });
  assert.equal(team({ amountCell: "T2", teamPay: { state: "a_confirmer", month: "2026-10" } }), "held");
});

test("held sales get their own group, chip and pill; paid ones say where they were paid", () => {
  assert.deepEqual(SALE_GROUPS.slice(0, 4), ["counted", "counted-before", "held", "deferred"]);
  assert.deepEqual(saleCounts([{ status: "held", channel: "ADS" }, { status: "counted", channel: "CC" }], { status: "ALL", channel: "ALL" }).status,
    { ALL: 2, counted: 1, held: 1, deferred: 0, pending: 0, lost: 0 });
  assert.deepEqual(groupText("held", "2026-10", 2), { tone: "check", title: "À confirmer", subtitle: "Peut-être déjà versées par l’ancienne paie · 2 ventes" });
  const held = rowStatus({ status: "held", pay: entry("E2").pay, timeline: "Signée le 20/08" });
  assert.deepEqual([held.tone, held.label], ["check", "À confirmer"]);
  assert.match(held.title, /Signée en août, mois versé par l’ancienne paie/);
  assert.deepEqual(rowStatus({ status: "deferred", pay: entry("E1").pay, payMonth: "2026-09" }), { tone: "paid", label: "Versée en septembre", title: undefined });
  assert.equal(rowStatus({ status: "deferred", pay: entry("E2").pay, payMonth: "2026-10" }).label, "À confirmer en octobre");
  assert.equal(rowStatus({ status: "deferred", pay: entry("E3").pay, payMonth: "2026-10", paidDay: "05/10" }).label, "Payée le 05/10");
});

test("held amounts are counted apart from the month's pay", () => {
  const model = statementModel(source, source.statements[1], {}, statementSettings(source.statements[1], {}));
  assert.equal(model.total.toFixed(2), "860.00");                      // 500 + E3 (360), E2 en attente
  const held = heldOf(source.statements[1], model);
  assert.deepEqual([held.count, held.amount.toFixed(2)], [1, "120.00"]);
  assert.equal(heldCount(source, "2026-10"), 1);
  assert.equal(heldCount(source, "2026-09"), 0);
});

test("the closure sends every statement of the month as displayed, with each paid line and its formula", () => {
  const draft = { changes: { E3: "=C3/12*1.5", H10: "600" }, settings: { s10: { bonuses: [{ id: "b", label: "Prime", amount: "50" }] } } };
  const sent = closurePayload(source, draft, "2026-10");
  assert.deepEqual(Object.keys(sent), ["s10"]);
  assert.deepEqual(sent.s10, {
    fixedRef: "H10", fixedInput: "600", settings: { sales: "1", bonuses: [{ id: "b", label: "Prime", amount: "50" }] },
    total: "1100.00", commission: "450.00", teamShare: "0.00", bonuses: "50.00",
    lines: { E3: { amount: "450.00", formula: "=C3/12*1.5", baseRef: "C3", baseInput: "3600" } },
  });
  const summary = closureSummary(sent, heldCount(source, "2026-10"));
  assert.deepEqual([summary.people, summary.lines, summary.total.toFixed(2), summary.held], [1, 1, "1100.00", 1]);
});

test("a statement that does not compute blocks the closure", () => {
  const broken = { ...source, cells: { ...source.cells, M10: { input: "=H10+" } } };
  assert.throws(() => closurePayload(broken, { changes: {}, settings: {} }, "2026-10"));
});

test("server refusals are explained in plain words, and a closure instant is read at Paris time", () => {
  assert.match(refusalMessage({ data: { detail: "source_changed" } }), /Les ventes du mois ont changé/);
  assert.match(refusalMessage({ data: { detail: "page_used" } }), /ne peut plus être déclaré versé ailleurs/);
  assert.match(refusalMessage(new Error("réseau")), /rien n’a été modifié/);
  assert.equal(closedLabel("2026-10-28T14:05:00+00:00"), "28 octobre à 15 h 05");
  assert.equal(closedLabel("2026-11-02T08:00:00+00:00"), "2 novembre à 9 h");
  assert.equal(closedLabel(""), "");
});
