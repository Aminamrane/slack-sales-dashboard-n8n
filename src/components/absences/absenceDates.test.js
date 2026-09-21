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

import {
  countDays,
  daySlots,
  isPast,
  isReview,
  monthEnd,
  newestFirst,
  shiftMonth,
} from "./absenceOverview.js";
test("RH : validations toutes dates, ordre par déclaration et non par début d’absence", () => {
  const older = {
    id: "a",
    kind: "absence",
    status: "declared",
    start_date: "2026-09-22",
    created_at: "2026-09-20T10:00:00Z",
  };
  const recentFuture = {
    ...older,
    id: "b",
    start_date: "2027-01-04",
    created_at: "2026-09-21T10:00:00Z",
  };
  const pending = {
    ...older,
    id: "c",
    kind: "request",
    status: "pending",
    created_at: "2026-09-21T11:00:00Z",
  };
  assert.deepEqual(
    [older, recentFuture, pending]
      .filter(isReview)
      .sort(newestFirst)
      .map((r) => r.id),
    ["c", "b", "a"],
  );
  assert.equal(isReview({ ...older, status: "approved" }), false);
  assert.equal(isReview({ ...pending, status: "rejected" }), false);
});
test("RH : historique et navigation ne dépendent pas du fuseau du navigateur", () => {
  assert.equal(isPast({ end_date: "2026-09-20" }, "2026-09-21"), true);
  assert.equal(isPast({ end_date: "2026-09-21" }, "2026-09-21"), false);
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(monthEnd("2028-02"), "2028-02-29");
});
test("RH : planning nominatif distingue les demi-journées sans compter les demandes", () => {
  const am = {
    id: "a",
    user_id: "u",
    kind: "absence",
    status: "approved",
    period: "am",
    absence_type: "conge",
    start_date: "2026-09-21",
    end_date: "2026-09-21",
    created_at: "2026-09-20T10:00:00Z",
  };
  const pending = { ...am, kind: "request", status: "pending", period: "pm" };
  assert.equal(daySlots([am, pending], am.start_date).pm, null);
  assert.equal(countDays([am, am, pending], am.start_date, am.end_date), 0.5);
  const pm = { ...am, period: "pm", absence_type: "autre" };
  assert.equal(daySlots([am, pm], am.start_date).pm.absence_type, "autre");
  assert.equal(countDays([am, pm], am.start_date, am.end_date), 1);
});
