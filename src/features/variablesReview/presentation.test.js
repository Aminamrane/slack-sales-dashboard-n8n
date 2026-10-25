import { test } from "node:test";
import assert from "node:assert/strict";
import { Rational } from "./calculation.js";
import {
  amountInput,
  auditDetail,
  auditValue,
  dayMonthLabel,
  decimalLabel,
  financeBadge,
  monthLabel,
  signedParis,
} from "./presentation.js";

test("CRM reading day is the Paris calendar date, read as written", () => {
  assert.equal(dayMonthLabel("2026-10-25"), "25 octobre");
  assert.equal(dayMonthLabel("2026-08-01"), "1er août");
  assert.equal(dayMonthLabel("2026-12-31"), "31 décembre");
  for (const bad of ["", null, undefined, "25/10/2026", "2026-13-01", "2026-10-00", "2026-10-25T23:30:00Z"])
    assert.equal(dayMonthLabel(bad), "");
});

test("signing day: timestamp with offset converted to Paris; without offset, wall-clock as written", () => {
  assert.deepEqual(signedParis("2026-09-11 22:30:00.123456+00:00"), { key: "2026-09-12 00:30:00", label: "12 sept." });
  assert.equal(signedParis("2026-01-31T23:15:00Z").label, "1er févr.");
  assert.equal(signedParis("2026-09-12T08:00:00+0200").key, "2026-09-12 08:00:00");
  assert.equal(signedParis("2026-09-12 23:50:00").label, "12 sept.");
  for (const bad of ["", null, "12/09/2026", "2026-13-01 10:00:00+00:00"]) assert.equal(signedParis(bad), null);
});

test("French decimals and editable amounts", () => {
  assert.equal(monthLabel("2026-09"), "Septembre 2026");
  assert.equal(decimalLabel("1.25"), "1,25");
  assert.equal(amountInput(Rational.from("800")), "800");
  assert.equal(amountInput(Rational.from("1500.5")), "1500,50");
});

test("finance status comes from the back; missing or unknown status falls back to « À rapprocher »", () => {
  assert.deepEqual(financeBadge({ status: "paid", statusLabel: "Première échéance payée" }),
    { key: "paid", label: "Première échéance payée", tone: "paid" });
  assert.equal(financeBadge({ status: "first_due_unpaid" }).tone, "late");
  assert.equal(financeBadge({ status: "lost", statusLabel: "Client perdu" }).tone, "neutral");
  for (const missing of [null, undefined, {}, { receivedOwner: "0" }, { status: "mystery" }])
    assert.deepEqual(financeBadge(missing), { key: "unmatched", label: "À rapprocher", tone: "neutral" });
});

test("history never shows cell references or raw formulas", () => {
  assert.equal(auditDetail("E123456789 · Ajustement validé"), "Ajustement validé");
  assert.equal(auditDetail("H12 · Fixe"), "Fixe");
  assert.equal(auditDetail("Alice · règles"), "Alice · règles");
  assert.equal(auditValue("=(C12/12)*(1.5)"), "coefficient 1,5");
  assert.equal(auditValue("=((C12/12))*1.3"), "coefficient 1,3");
  assert.equal(auditValue("1500"), "1 500,00 €");
  assert.equal(auditValue("=C1+C2"), "calcul personnalisé");
});
