import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator, Rational } from "./calculation.js";
import { calculationParts, resolveDeal } from "./dealCalculation.js";
import {
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
test("palier : un minimum sur le total du mois, fixe, commissions et primes compris (feuille Apports d'affaires)", () => {
  const tiered = (amount, { refs = ["E1"], changes = {}, settings = {}, binding } = {}) => statementModel(data, {
    totalCell: "N1", tier: { reached: { sales: 5, amount }, monthSales: 5, retracted: 0, refs, binding },
  }, changes, settings);
  const under = tiered("2500", { binding: true });
  assert.deepEqual([under.tier.monthTotal.toFixed(2), under.tier.complement.toFixed(2)], ["700.00", "1800.00"]);
  assert.equal(under.total.toFixed(2), "2500.00");                   // 500 de fixe + 200 + 1 800 = le palier
  assert.equal(under.remainder.toFixed(2), "0.00");
  const withBonus = tiered("2500", { binding: true, settings: { bonuses: [{ label: "Prime", amount: "300" }] } });
  assert.deepEqual([withBonus.tier.complement.toFixed(2), withBonus.total.toFixed(2)], ["1500.00", "2500.00"]);
  const over = tiered("650", { binding: true });
  assert.equal(over.tier.complement.toFixed(2), "0.00");             // 700 ≥ 650 : aucun complément
  assert.equal(over.total.toFixed(2), "700.00");
  const edited = tiered("2500", { binding: true, changes: { E1: "1000" } });
  assert.equal(edited.tier.complement.toFixed(2), "1000.00");       // commission corrigée à la main : complément recalculé
  const head = statementModel({ ...data, cells: { ...data.cells, T1: { input: "300" } } }, {
    totalCell: "N1", tier: { reached: { sales: 5, amount: "2500" }, refs: ["E1"], teamRefs: ["T1"], binding: true },
  });
  assert.equal(head.tier.complement.toFixed(2), "1500.00");          // head : sa part d'équipe du mois compte aussi
  const notBinding = tiered("2500", { binding: false });              // le serveur : total au-dessus, le palier ne joue pas
  assert.deepEqual([notBinding.tier, notBinding.total.toFixed(2)], [null, "700.00"]);
  assert.equal(statementModel(data, { totalCell: "N1", tier: { reached: null, refs: [] } }).tier, null);
});
test("negative prime does not double count", () => {
  const model = statementModel(data, data.statements[0], {}, { bonuses: [{ label: "Reprise", amount: "-10.25" }] });
  assert.equal(model.total.toFixed(2), "689.75");
  assert.equal(model.sourceTotal.toFixed(2), "700.00");
  assert.equal(model.delta.toFixed(2), "-10.25");
  assert.equal(data.cells.H1.input, "500");
});
test("invalid tiers are refused", () => {
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
test("a channel corrected by hand takes the base of that channel (baseByChannel from the server)", () => {
  // Webinaire 6-10 vendu 4 032 € / an : base Owner 336 € ; corrigé en cold call : (5 760 × 80 %) / 12 = 384 €.
  const data = {
    cells: { C1: { input: "4032" }, E1: { input: "=C1/12*1" }, G3: { input: "Fixe" }, H3: { input: "500" }, M3: { input: "=H3+E1" } },
    entries: [{ amountCell: "E1", originChannel: "WEB", plan: "M",
      baseByChannel: { ADS: "C1/0.7*0.8/12", CC: "C1/0.7*0.8/12", CCS: "C1/0.7*0.8/12", WEB: "C1/12" } }],
  };
  const st = { totalCell: "M3", entryRefs: ["E1"] };
  const rules = { WEB: { enabled: true, coefficient: "1" }, CC: { enabled: true, coefficient: "1.5" } };
  assert.equal(statementModel(data, st, {}, { acquisition: rules }).total.toFixed(2), "836.00");
  const corrected = statementModel(data, st, {}, { acquisition: rules, deals: { E1: { channel: "CC" } } });
  assert.equal(corrected.total.toFixed(2), "1076.00"); // 500 + 384 × 1,5
  const deal = resolveDeal(data, data.entries[0], { channel: "CC" }, createCalculator(data.cells));
  assert.deepEqual([deal.base, deal.baseExpression], ["384", "C1/0.7*0.8/12"]);
  // Base saisie à la main : elle reste celle du dev, quel que soit le canal.
  assert.equal(resolveDeal(data, data.entries[0], { channel: "CC", base: "300" }, createCalculator(data.cells)).base, "300");
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
