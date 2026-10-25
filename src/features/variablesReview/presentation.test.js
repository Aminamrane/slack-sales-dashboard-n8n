import { test } from "node:test";
import assert from "node:assert/strict";
import { dayMonthLabel } from "./presentation.js";

test("CRM reading day is the Paris calendar date, read as written", () => {
  assert.equal(dayMonthLabel("2026-10-25"), "25 octobre");
  assert.equal(dayMonthLabel("2026-08-01"), "1er août");
  assert.equal(dayMonthLabel("2026-12-31"), "31 décembre");
  for (const bad of ["", null, undefined, "25/10/2026", "2026-13-01", "2026-10-00", "2026-10-25T23:30:00Z"])
    assert.equal(dayMonthLabel(bad), "");
});
