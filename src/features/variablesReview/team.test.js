import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator } from "./calculation.js";
import {
  filterSales,
  pendingBreakdown,
  pendingOf,
  periodsOf,
  saleCounts,
  saleStatus,
  sortSales,
  teamRows,
  teamTotals,
} from "./team.js";

const source = {
  profiles: {
    Alice: { name: "Alice A", role: "sales" },
    Bob: { name: "Bob B", role: "head_of_sales" },
    Chloe: { name: "Chloé C", role: "sales" },
  },
  cells: {
    G1: { input: "Fixe" }, H1: { input: "500" }, E1: { input: "100" }, E2: { input: "50" }, E4: { input: "70" },
    M1: { input: "=H1+E1" },
    G2: { input: "Fixe" }, H2: { input: "1000" }, E3: { input: "10" }, M2: { input: "=H2+E3" },
    G3: { input: "Fixe" }, H3: { input: "0" }, M3: { input: "=H3" },
    G4: { input: "Fixe" }, H4: { input: "300" }, M4: { input: "=H4" },
  },
  entries: [
    { amountCell: "E1", counted: true, finance: { status: "paid" } },
    { amountCell: "E2", counted: false, finance: { status: "first_due_unpaid" } },
    { amountCell: "E4", counted: false, finance: { status: "lost" } },
    { amountCell: "E3", counted: true, finance: null },
  ],
  statements: [
    { id: "a", person: "Alice", period: "2026-09", totalCell: "M1", entryRefs: ["E1", "E2", "E4"], defaults: {} },
    { id: "b", person: "Bob", period: "2026-09", totalCell: "M2", entryRefs: ["E3"], defaults: {} },
    { id: "c", person: "Chloe", period: "2026-09", totalCell: "M3", entryRefs: [], defaults: {} },
    { id: "d", person: "Alice", period: "2026-08", totalCell: "M4", entryRefs: [], defaults: {} },
  ],
};
const emptyDraft = { changes: {}, settings: {} };
const summary = (rows) => rows.map((r) => `${r.person}:${r.total.toFixed(2)}`);

test("team list: one row per person of the month, heads first then total descending", () => {
  const rows = teamRows(source, emptyDraft, "2026-09");
  assert.deepEqual(summary(rows), ["Bob:1010.00", "Alice:600.00", "Chloe:0.00"]);
  assert.deepEqual(rows.map((r) => `${r.counted}/${r.signed}`), ["1/1", "1/3", "0/0"]);
  assert.deepEqual(periodsOf(source), ["2026-08", "2026-09"]);
});

test("team totals and order include the shared draft (adjustments, primes)", () => {
  const draft = { changes: { E1: "300" }, settings: { c: { bonuses: [{ id: "x", label: "Prime", amount: "2000" }] } } };
  const rows = teamRows(source, draft, "2026-09");
  assert.deepEqual(summary(rows), ["Bob:1010.00", "Chloe:2000.00", "Alice:800.00"]);
  const totals = teamTotals(rows);
  assert.equal(totals.total.toFixed(2), "3810.00");
  assert.equal(totals.pending.toFixed(2), "50.00");
});

test("pending amount: commissions of sales not counted yet, lost clients excluded, never in the total", () => {
  const entries = new Map(source.entries.map((e) => [e.amountCell, e]));
  const pending = pendingOf(source.statements[0], entries, createCalculator(source.cells));
  assert.equal(pending.amount.toFixed(2), "50.00");
  assert.equal(pending.count, 1);
  const alice = teamRows(source, emptyDraft, "2026-09").find((r) => r.person === "Alice");
  assert.equal(alice.total.toFixed(2), "600.00");
});

test("a statement whose calculation fails is listed last, without breaking the team total", () => {
  const broken = { ...source, cells: { ...source.cells, M3: { input: "=H3+" } } };
  const rows = teamRows(broken, emptyDraft, "2026-09");
  assert.equal(rows.at(-1).person, "Chloe");
  assert.ok(rows.at(-1).error);
  assert.equal(teamTotals(rows).blocked, 1);
  assert.equal(teamTotals(rows).total.toFixed(2), "1610.00");
});

const sale = (client, status, signedAt, channel = "ADS", finance = { key: "paid", label: "Payée" }) =>
  ({ client, status, signedAt, channel, finance, search: client });

test("one status per sale: counted, pending, or lost (not counted, lost client)", () => {
  assert.equal(saleStatus({ counted: true, finance: { status: "paid" } }), "counted");
  assert.equal(saleStatus({ counted: false, finance: { status: "first_due_unpaid" } }), "pending");
  assert.equal(saleStatus({ counted: false, finance: null }), "pending");
  assert.equal(saleStatus({ counted: false, finance: { status: "lost" } }), "lost");
  assert.equal(saleStatus({ counted: true, finance: { status: "lost" } }), "counted");
});

test("sales order: counted, then pending, then lost, each group by Paris signing time", () => {
  const rows = [
    sale("L1", "lost", "2026-08-30 10:00:00+00:00"),
    sale("P1", "pending", "2026-09-01 10:00:00+00:00"),
    sale("C20", "counted", "2026-09-20 10:00:00+00:00"),
    sale("C02", "counted", "2026-09-02 10:00:00+00:00"),
    sale("Late UTC", "counted", "2026-09-01 22:30:00+00:00"),
  ];
  assert.deepEqual(sortSales(rows).map((r) => r.client), ["Late UTC", "C02", "C20", "P1", "L1"]);
});

test("filter chips: each count equals the rows shown when clicked; statuses add up to all", () => {
  const rows = [
    sale("A", "counted", "2026-09-01", "ADS"),
    sale("B", "lost", "2026-09-02", "ADS", { key: "lost", label: "Client perdu" }),
    sale("E", "pending", "2026-09-05", "ADS", { key: "first_due_unpaid", label: "Première échéance non payée" }),
    sale("C", "counted", "2026-09-03", "CC"),
    sale("D", "pending", "2026-09-04", "UNKNOWN", { key: "unmatched", label: "À rapprocher" }),
  ];
  for (const filters of [{}, { channel: "ADS" }, { status: "pending" }, { status: "counted", channel: "CC" }, { query: "a" }]) {
    const counts = saleCounts(rows, filters);
    assert.equal(counts.status.counted + counts.status.pending + counts.status.lost, counts.status.ALL);
    for (const status of ["ALL", "counted", "pending", "lost"])
      assert.equal(filterSales(rows, { ...filters, status }).length, counts.status[status]);
    for (const channel of ["ALL", "ADS", "CC", "UNKNOWN"])
      assert.equal(filterSales(rows, { ...filters, channel }).length, counts.channel[channel] || 0);
  }
  assert.deepEqual(pendingBreakdown(rows).map((g) => `${g.label}:${g.count}`), ["À rapprocher:1", "Première échéance non payée:1"]);
});
