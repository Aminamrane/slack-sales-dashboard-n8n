import { test } from "node:test";
import assert from "node:assert/strict";
import { payDayLabel, payslipReference } from "./payslip.js";

test("payslip: paid on the 1st of the next month, stable reference", () => {
  assert.equal(payDayLabel("2026-10"), "1er novembre 2026");
  assert.equal(payDayLabel("2026-12"), "1er janvier 2027");
  const ref = payslipReference({ id: "crm:abc:2026-10", period: "2026-10" });
  assert.match(ref, /^VAR-202610-\d{6}$/);
  assert.equal(ref, payslipReference({ id: "crm:abc:2026-10", period: "2026-10" }));
  assert.notEqual(ref, payslipReference({ id: "crm:abd:2026-10", period: "2026-10" }));
});
