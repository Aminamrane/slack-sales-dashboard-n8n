import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Rational,
  createCalculator,
  normalizeInput,
  reconcile,
  money,
} from "./calculation.js";
const cells = {
  C1: { input: "2772" },
  E1: { input: "=C1*80%/12*1.2" },
  E2: { input: "-15.25" },
  H1: { input: "500" },
  N1: { input: "=SUM(E1:E2)+H1" },
};
test("exact decimals, rounding on final sum only", () => {
  assert.equal(
    Rational.from("0.1").add(Rational.from("0.2")).toFixed(2),
    "0.30",
  );
  const x = Rational.from("1").div(Rational.from("3"));
  assert.equal(x.add(x).add(x).toFixed(2), "1.00");
  assert.equal(Rational.from("-1.005").toFixed(2), "-1.01");
  assert.equal(Rational.from("1.005").toFixed(2), "1.01");
  assert.equal(Rational.from("1e-3").toFixed(3), "0.001");
});
test("source commission, negative adjustment, fixed and dependencies", () => {
  const c = createCalculator(cells);
  assert.equal(c.value("N1").toFixed(2), "706.51");
  assert.deepEqual(c.dependencies("N1").sort(), ["E1", "E2", "H1"]);
  assert(c.dependencies("N1", { recursive: true }).includes("C1"));
  assert.equal(
    createCalculator(cells, { H1: "700" }).value("N1").toFixed(2),
    "906.51",
  );
  assert.equal(c.value("N1").toFixed(2), "706.51");
});
test("blank SUM refs and text ignored, arithmetic text rejected", () => {
  const c = createCalculator({ A1: { input: "texte" }, A2: { input: "4" } });
  assert.equal(c.evaluate("=SUM(A1:A3)+2").toFixed(2), "6.00");
  assert.throws(() => c.evaluate("=A1+2"), /texte/);
});
test("unsupported syntax, code, circular refs and division by zero fail closed", () => {
  const c = createCalculator({ A1: { input: "=B1" }, B1: { input: "=A1" } });
  assert.throws(() => c.value("A1"), /circulaire/);
  for (const formula of [
    "=1/0",
    '=fetch("https://example.com")',
    "=SUM(A3:A1)",
    "=IF(1,2,3)",
    "=1+",
  ])
    assert.throws(() => c.evaluate(formula));
});
test("precedence, percentages, absolute refs, French SUM and locale numbers", () => {
  const c = createCalculator(cells);
  assert.equal(c.evaluate("=SOMME($E$1;E2)+H1").toFixed(2), "706.51");
  assert.equal(c.evaluate("=-(2+3)*20%").toFixed(2), "-1.00");
  assert.equal(normalizeInput("1 500,25 €"), "1500.25");
  assert.equal(money(Rational.from("1500.25")), "1\u202f500,25\u00a0€");
});
test("reconciliation never silently accepts missing cached results", () => {
  assert.equal(
    reconcile({ A1: { kind: "formula", input: "=1+1", cached: 2 } })[0].match,
    true,
  );
  assert.equal(
    reconcile({ A1: { kind: "formula", input: "=1+1", cached: null } })[0]
      .match,
    false,
  );
});
