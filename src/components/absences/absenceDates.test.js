import test from "node:test";
import assert from "node:assert/strict";
import {
  restrictedFinance,
  duration,
  periodOnDay,
  nextDay,
} from "./absenceDates.js";
test("Finance : bornes exactes, mois court et années bissextiles", () => {
  for (const [start, end, expected] of [
    ["2026-09-05", "2026-09-05", true],
    ["2026-09-06", "2026-09-25", false],
    ["2026-09-26", "2026-09-26", true],
    ["2026-02-23", "2026-02-23", false],
    ["2026-02-24", "2026-02-24", true],
    ["2028-02-24", "2028-02-24", false],
    ["2028-02-25", "2028-02-25", true],
    ["2026-09-10", "2026-10-10", true],
  ])
    assert.equal(restrictedFinance(start, end), expected, start);
});
test("demi-journées et jours de travail spécifiques", () => {
  assert.equal(
    duration({
      start_date: "2026-09-21",
      end_date: "2026-09-21",
      period: "am",
    }),
    0.5,
  );
  assert.equal(
    duration({
      start_date: "2026-09-26",
      end_date: "2026-09-26",
      period: "pm",
    }),
    0,
  );
  assert.equal(
    duration(
      { start_date: "2026-09-26", end_date: "2026-09-26", period: "pm" },
      [6],
    ),
    0.5,
  );
});
test("les demandes en attente ne bloquent pas ; deux moitiés font une journée", () => {
  const a = { start_date: "2026-09-21", end_date: "2026-09-21", period: "am" };
  assert.equal(periodOnDay([{ ...a, status: "pending" }], a.start_date), null);
  assert.equal(periodOnDay([a, { ...a, period: "pm" }], a.start_date), "full");
  assert.equal(periodOnDay([a, a], a.start_date), "am");
});
test("les dates civiles traversent les changements d’heure", () => {
  assert.equal(nextDay("2026-10-25"), "2026-10-26");
  assert.equal(nextDay("2026-03-29"), "2026-03-30");
});
