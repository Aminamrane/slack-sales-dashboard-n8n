import { test } from "node:test";
import assert from "node:assert/strict";
import { Rational } from "./calculation.js";
import {
  fixedByTiers,
  statementModel,
  impactedStatements,
  readDraft,
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
test("corrupt draft preserved without automatic overwrite", () => {
  const store = {
    getItem: () => "{bad",
    setItem: () => {
      throw Error("must not write");
    },
  };
  assert.match(readDraft(store, "test", "hash").error, /conservée/);
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
