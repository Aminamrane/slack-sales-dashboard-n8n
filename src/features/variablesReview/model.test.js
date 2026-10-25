import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator, Rational } from "./calculation.js";
import { calculationParts, resolveDeal } from "./dealCalculation.js";
import {
  fixedByTiers,
  statementModel,
  impactedStatements,
  parseDraft,
  validateTiers,
} from "./model.js";
const data = {
  cells: {
    G1: { input: "Fixe Septembre" },
    H1: { input: "500" },
    E1: { input: "200" },
    N1: { input: "=H1+E1" },
    N2: { input: "=N1+10" },
  },
  statements: [{ totalCell: "N1" }, { totalCell: "N2" }],
};
test("paliers non cumulés, seuil inclusif, base jamais réduite", () => {
  const tiers = [
      { sales: 5, amount: "1000" },
      { sales: 10, amount: "2000" },
    ],
    base = Rational.from("500");
  assert.equal(fixedByTiers(base, tiers, "4").effective.toFixed(2), "500.00");
  assert.equal(fixedByTiers(base, tiers, "5").effective.toFixed(2), "1000.00");
  assert.equal(fixedByTiers(base, tiers, "10").effective.toFixed(2), "2000.00");
  assert.equal(
    fixedByTiers(Rational.from("2500"), tiers, "10").effective.toFixed(2),
    "2500.00",
  );
});
test("source unchanged, fixed substitution and negative prime do not double count", () => {
  const model = statementModel(
    data,
    data.statements[0],
    {},
    {
      sales: "5",
      tiers: [{ sales: "5", amount: "1000" }],
      bonuses: [{ label: "Reprise", amount: "-10.25" }],
    },
  );
  assert.equal(model.total.toFixed(2), "1189.75");
  assert.equal(model.sourceTotal.toFixed(2), "700.00");
  assert.equal(model.delta.toFixed(2), "489.75");
  assert.equal(data.cells.H1.input, "500");
});
test("invalid rules and missing verified sales block calculation", () => {
  for (const tiers of [
    [{ sales: "2.5", amount: "100" }],
    [{ sales: "2", amount: "-1" }],
    [
      { sales: "2", amount: "100" },
      { sales: "2", amount: "200" },
    ],
    [
      { sales: "2", amount: "200" },
      { sales: "5", amount: "100" },
    ],
  ])
    assert.throws(() => validateTiers(tiers));
  assert.throws(
    () =>
      fixedByTiers(Rational.from("500"), [{ sales: "5", amount: "1000" }], ""),
    /ventes/,
  );
});
test("editing a shared source lists all affected statements", () => {
  assert.equal(impactedStatements(data, { E1: "300" }).length, 2);
});
test("server draft with an unexpected shape is rejected, never repaired", () => {
  const valid = {
    version: 1,
    sourceHash: "any",
    changes: {},
    settings: {},
    audit: [],
    revision: 0,
  };
  assert.equal(parseDraft(valid), valid);
  for (const bad of [
    null,
    "{bad",
    { ...valid, version: 2 },
    { ...valid, changes: [] },
    { ...valid, settings: null },
    { ...valid, audit: {} },
    { ...valid, revision: "3" },
    { ...valid, revision: -1 },
  ])
    assert.throws(() => parseDraft(bad), /illisible/);
});
test("CCS independent from CC; no acquisition inference; exception retains sheet", () => {
  const settings = {
    acquisition: {
      CC: { enabled: true, coefficient: "2" },
      CCS: { enabled: true, coefficient: "3" },
    },
    deals: { E1: { channel: "CCS", base: "88" } },
  };
  assert.equal(
    statementModel(data, data.statements[0], {}, settings).total.toFixed(2),
    "764.00",
  );
  settings.deals.E1.exception = true;
  assert.equal(
    statementModel(data, data.statements[0], {}, settings).total.toFixed(2),
    "700.00",
  );
  settings.deals = {};
  assert.equal(
    statementModel(data, data.statements[0], {}, settings).total.toFixed(2),
    "700.00",
  );
});
test("readable coefficient agrees exactly with the underlying formula", () => {
  const c = createCalculator({ C1: { input: "2112" }, E1: { input: "=(C1/12)*(1.7)" } });
  assert.equal(calculationParts(c, "E1").label, "176,00\u00a0€ × 1,7");
});
test("counted and pending commissions display, only counted ones enter the total; override preserves origin", () => {
  const data = {
    cells: { C1: { input: "1200" }, C2: { input: "1200" }, E1: { input: "=C1/12*1" }, E2: { input: "=C2/12*1" }, G3: { input: "Fixe" }, H3: { input: "500" }, M3: { input: "=H3+E1" } },
    entries: [{ amountCell: "E1", originChannel: "WEB", plan: "M" }, { amountCell: "E2", originChannel: "WEB", plan: "M" }],
  };
  const st = { totalCell: "M3", entryRefs: ["E1", "E2"] };
  const settings = { acquisition: { WEB: { enabled: true, coefficient: "1" }, ADS: { enabled: true, coefficient: "1.2" } }, deals: { E1: { channel: "ADS" } } };
  const m = statementModel(data, st, {}, settings);
  assert.equal(m.total.toFixed(2), "620.00");
  assert.equal(m.calculator.value("E2").toFixed(2), "100.00");
  assert.equal(data.entries[0].originChannel, "WEB");
  assert.equal(resolveDeal(data, data.entries[0], settings.deals.E1).overridden, true);
});
