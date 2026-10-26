import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator, ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import {
  filterSales,
  pendingBreakdown,
  pendingOf,
  periodsOf,
  entryIndex,
  saleCounts,
  salesFlow,
  sortSales,
  statusFor,
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

test("without countedRefs (data before 26/10), the former rule applies: entry.counted", () => {
  const status = statusFor({ period: "2026-09" });
  assert.equal(status({ counted: true, finance: { status: "paid" } }), "counted");
  assert.equal(status({ counted: false, finance: { status: "first_due_unpaid" } }), "pending");
  assert.equal(status({ counted: false, finance: null }), "pending");
  assert.equal(status({ counted: false, finance: { status: "lost" } }), "lost");
  assert.equal(status({ counted: true, finance: { status: "lost" } }), "counted");
});

test("rule of 26/10: a sale counts in the month its first due is paid; signed in P and paid later = deferred", () => {
  const september = { period: "2026-09", countedRefs: ["E1", "E9"] };
  const status = statusFor(september);
  assert.equal(status({ amountCell: "E1", counted: true, countedMonth: "2026-09" }), "counted");
  assert.equal(status({ amountCell: "E9", counted: true, countedMonth: "2026-09", signedMonth: "2026-08" }), "counted");
  assert.equal(status({ amountCell: "E2", counted: true, countedMonth: "2026-10", signedMonth: "2026-09" }), "deferred");
  assert.equal(status({ amountCell: "E3", counted: false, countedMonth: null, finance: { status: "first_due_unpaid" } }), "pending");
  assert.equal(status({ amountCell: "E4", counted: false, countedMonth: null, finance: null }), "pending");
  assert.equal(status({ amountCell: "E5", counted: false, countedMonth: null, finance: { status: "lost" } }), "lost");
  // countedRefs fait foi : même entry.counted à vrai, une vente absente du total n'est pas « comptée » ici.
  assert.notEqual(status({ amountCell: "E6", counted: true, countedMonth: "2026-09" }), "counted");
});

test("sales order: counted, deferred, pending, then lost, each group by Paris signing time", () => {
  const rows = [
    sale("L1", "lost", "2026-08-30 10:00:00+00:00"),
    sale("D1", "deferred", "2026-09-03 10:00:00+00:00"),
    sale("P1", "pending", "2026-09-01 10:00:00+00:00"),
    sale("C20", "counted", "2026-09-20 10:00:00+00:00"),
    sale("C02", "counted", "2026-09-02 10:00:00+00:00"),
    sale("Late UTC", "counted", "2026-09-01 22:30:00+00:00"),
  ];
  assert.deepEqual(sortSales(rows).map((r) => r.client), ["Late UTC", "C02", "C20", "D1", "P1", "L1"]);
});

test("filter chips: each count equals the rows shown when clicked; statuses add up to all", () => {
  const rows = [
    sale("A", "counted", "2026-09-01", "ADS"),
    sale("B", "lost", "2026-09-02", "ADS", { key: "lost", label: "Client perdu" }),
    sale("E", "pending", "2026-09-05", "ADS", { key: "first_due_unpaid", label: "Première échéance non payée" }),
    sale("F", "deferred", "2026-09-06", "CC", { key: "paid", label: "Première échéance payée" }),
    sale("C", "counted", "2026-09-03", "CC"),
    sale("D", "pending", "2026-09-04", "UNKNOWN", { key: "unmatched", label: "À rapprocher" }),
  ];
  for (const filters of [{}, { channel: "ADS" }, { status: "pending" }, { status: "counted", channel: "CC" }, { query: "a" }]) {
    const counts = saleCounts(rows, filters);
    assert.equal(counts.status.counted + counts.status.deferred + counts.status.pending + counts.status.lost, counts.status.ALL);
    for (const status of ["ALL", "counted", "deferred", "pending", "lost"])
      assert.equal(filterSales(rows, { ...filters, status }).length, counts.status[status]);
    for (const channel of ["ALL", "ADS", "CC", "UNKNOWN"])
      assert.equal(filterSales(rows, { ...filters, channel }).length, counts.channel[channel] || 0);
  }
  assert.deepEqual(pendingBreakdown(rows).map((g) => `${g.label}:${g.count}`), ["À rapprocher:1", "Première échéance non payée:1"]);
});

// Deux mois d'une même personne sous la règle du 26/10 : E1 signée en septembre, payée en octobre.
const twoMonths = {
  profiles: { Alice: { name: "Alice A", role: "sales" } },
  cells: {
    G1: { input: "Fixe" }, H1: { input: "500" }, M1: { input: "=H1+E2" },
    G2: { input: "Fixe" }, H2: { input: "600" }, M2: { input: "=H2+E1" },
    E1: { input: "300" }, E2: { input: "100" }, E3: { input: "40" }, E4: { input: "70" },
  },
  entries: [
    { amountCell: "E1", counted: true, signedMonth: "2026-09", countedMonth: "2026-10", paidOn: "2026-10-22", finance: { status: "paid" } },
    { amountCell: "E2", counted: true, signedMonth: "2026-09", countedMonth: "2026-09", paidOn: "2026-09-12", finance: { status: "paid" } },
    { amountCell: "E3", counted: false, signedMonth: "2026-09", countedMonth: null, finance: { status: "first_due_unpaid" } },
    { amountCell: "E4", counted: false, signedMonth: "2026-10", countedMonth: null, finance: { status: "lost" } },
  ],
  statements: [
    { id: "s9", person: "Alice", period: "2026-09", totalCell: "M1", entryRefs: ["E1", "E2", "E3"], countedRefs: ["E2"], defaults: {} },
    { id: "s10", person: "Alice", period: "2026-10", totalCell: "M2", entryRefs: ["E1", "E4"], countedRefs: ["E1"], defaults: {} },
  ],
};

test("a sale paid a month after its signature: counted (and summed) only in the payment month", () => {
  const [sep] = teamRows(twoMonths, emptyDraft, "2026-09");
  const [oct] = teamRows(twoMonths, emptyDraft, "2026-10");
  assert.equal(sep.total.toFixed(2), "600.00"); // fixe 500 + E2
  assert.equal(oct.total.toFixed(2), "900.00"); // fixe 600 + E1, signée en septembre
  assert.deepEqual([sep.counted, sep.signed, oct.counted, oct.signed], [1, 3, 1, 2]);
  // En attente : E3 seulement (E1 est reportée, pas en attente ; E4 est perdue).
  assert.equal(sep.pending.count, 1);
  assert.equal(sep.pending.amount.toFixed(2), "40.00");
  assert.equal(oct.pending.count, 0);
  assert.equal(teamTotals([sep]).total.add(teamTotals([oct]).total).toFixed(2), "1500.00");
});

test("chips per person and month: Comptées + Reportées + En attente + Perdues = Toutes", () => {
  for (const statement of twoMonths.statements) {
    const status = statusFor(statement);
    const rows = statement.entryRefs.map((ref) => {
      const e = twoMonths.entries.find((x) => x.amountCell === ref);
      return { client: ref, status: status(e), channel: "ADS", search: ref, finance: { key: e.finance?.status || "unmatched", label: "x" } };
    });
    const counts = saleCounts(rows, {});
    assert.equal(counts.status.counted + counts.status.deferred + counts.status.pending + counts.status.lost, counts.status.ALL);
    assert.equal(counts.status.counted, statement.countedRefs.length);
  }
});

// Flux de la carte (salesFlow), données fictives : relevé de septembre d'une personne.
const flowSource = {
  profiles: { Alice: { name: "Alice A", role: "sales" } },
  cells: {
    G1: { input: "Fixe" }, H1: { input: "500" }, M1: { input: "=H1+E1+E6+E9" },
    E1: { input: "100" }, E2: { input: "200" }, E3: { input: "40" }, E4: { input: "50" }, E5: { input: "60" },
    E6: { input: "70" }, E7: { input: "80" }, E8: { input: "texte" }, E9: { input: "15" }, E10: { input: "90" }, E11: { input: "25" },
  },
  entries: [
    { amountCell: "E1", signedMonth: "2026-09", counted: true, countedMonth: "2026-09", finance: { status: "lost", firstDuePeriod: "2026-10" } },
    { amountCell: "E2", signedMonth: "2026-09", counted: false, finance: { status: "lost", firstDuePeriod: "2026-10" } },
    { amountCell: "E3", signedMonth: "2026-09", counted: false, finance: { status: "onboarding_pending", firstDuePeriod: "2026-10" } },
    { amountCell: "E4", signedMonth: "2026-09", counted: true, countedMonth: "2026-10", finance: { status: "paid", firstDuePeriod: "2026-09" } },
    { amountCell: "E5", signedMonth: "2026-09", counted: false, finance: { status: "onboarding_pending" } },
    { amountCell: "E6", signedMonth: "2026-08", counted: true, countedMonth: "2026-09", finance: { status: "paid", firstDuePeriod: "2026-09" } },
    { amountCell: "E7", signedMonth: "2026-09", counted: false, finance: null, unlinkedReason: "not_declared" },
    { amountCell: "E8", signedMonth: "2026-09", counted: false, finance: { status: "no_schedule" } },
    { amountCell: "E10", signedMonth: "2026-09", counted: false, finance: { status: "first_due_unpaid", firstDuePeriod: "2026-11" } },
    { amountCell: "E11", signedMonth: "2026-09", counted: false, finance: { status: "onboarding_pending", firstDuePeriod: "2026-09" } },
  ],
  statements: [{ id: "s9", person: "Alice", period: "2026-09", totalCell: "M1",
    entryRefs: ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E10", "E11"], countedRefs: ["E1", "E6"], defaults: {} }],
};
const flowOf = (source, statement = source.statements[0]) => {
  const model = statementModel(source, statement, {}, { ...statement.defaults });
  return { flow: salesFlow(statement, entryIndex(source), model), model };
};
const part = (group, key) => group.parts.find((p) => p.key === key);

test("sales flow: each sale signed this month in exactly one category, by priority", () => {
  const { flow } = flowOf(flowSource);
  assert.deepEqual(flow.signed.parts.map((p) => p.key), ["paid", "lost", "laterDue", "onboarding", "laterPayment", "noFinance"]);
  assert.deepEqual(part(flow.signed, "paid").refs, ["E1"]); // comptée avant tout, même client perdu ensuite
  assert.deepEqual(part(flow.signed, "lost").refs, ["E2"]); // perdue avant l'échéance future
  assert.deepEqual(part(flow.signed, "laterDue").refs, ["E3", "E10"]); // échéance future, même onboarding à venir
  assert.deepEqual(part(flow.signed, "onboarding").refs, ["E5", "E11"]); // sans échéance ; échéance ce mois
  assert.deepEqual(part(flow.signed, "laterPayment").refs, ["E4"]); // échéance ce mois, payée le mois suivant
  assert.deepEqual(part(flow.signed, "noFinance").refs, ["E7", "E8"]); // non déclarée ; aucune échéance
  assert.ok(!flow.signed.parts.some((p) => p.refs.includes("E6"))); // signée en août : pas dans « signées »
  assert.equal(flow.signed.count, 9);
});

test("sales flow labels: one later due month, or several", () => {
  const { flow } = flowOf(flowSource);
  assert.equal(part(flow.signed, "paid").label, "Payées en septembre");
  assert.equal(part(flow.signed, "laterDue").label, "1re échéance après septembre"); // octobre et novembre
  assert.equal(part(flow.signed, "onboarding").label, "Onboarding à venir");
  assert.equal(part(flow.signed, "laterPayment").label, "Paiement plus tard");
  const single = { ...flowSource, entries: flowSource.entries.filter((e) => e.amountCell !== "E10") };
  const statement = { ...flowSource.statements[0], entryRefs: flowSource.statements[0].entryRefs.filter((r) => r !== "E10") };
  assert.equal(part(flowOf(single, statement).flow.signed, "laterDue").label, "1re échéance en octobre");
  assert.deepEqual(flowOf(flowSource).flow.paid.parts.map((p) => p.label), ["Signées en septembre", "Signées avant", "Ajustements"]);
});

test("sales flow invariants: parts add up; paid = model.commission exactly; paid top = signed here bottom", () => {
  const { flow, model } = flowOf(flowSource);
  for (const group of [flow.signed, flow.paid])
    assert.equal(group.parts.reduce((sum, p) => sum.add(p.amount), ZERO).sub(group.amount).n, 0n);
  assert.equal(flow.paid.amount.sub(model.commission).n, 0n);
  assert.equal(flow.paid.amount.toFixed(2), "185.00"); // E1 + E6 + E9 (ajustement sans vente)
  assert.deepEqual(part(flow.paid, "signedHere").refs, ["E1"]);
  assert.deepEqual(part(flow.paid, "signedBefore").refs, ["E6"]);
  assert.deepEqual(part(flow.paid, "adjustment").refs, ["E9"]);
  assert.equal(part(flow.signed, "paid").amount.sub(part(flow.paid, "signedHere").amount).n, 0n);
});

test("sales flow: an unreadable amount counts in n, not in the sum, and marks its part", () => {
  const { flow } = flowOf(flowSource);
  const noFinance = part(flow.signed, "noFinance");
  assert.equal(noFinance.count, 2);
  assert.equal(noFinance.amount.toFixed(2), "80.00"); // E7 seulement, E8 est illisible
  assert.equal(noFinance.unreadable, true);
  assert.equal(part(flow.signed, "laterDue").unreadable, false);
});

test("sales flow: former rule (no countedRefs) goes through statusFor; an empty month is all zero", () => {
  const former = { ...flowSource.statements[0], countedRefs: undefined };
  const { flow } = flowOf(flowSource, former);
  assert.deepEqual(part(flow.signed, "paid").refs, ["E1", "E4"]); // entry.counted, ancienne règle
  const empty = { ...flowSource, statements: [{ id: "e", person: "Alice", period: "2026-07", totalCell: "H1", entryRefs: [], defaults: {} }] };
  const { flow: none, model } = flowOf(empty);
  assert.deepEqual([none.signed.count, none.paid.count], [0, 0]);
  assert.equal(none.signed.amount.toFixed(2), "0.00");
  assert.equal(none.paid.amount.sub(model.commission).n, 0n);
  assert.ok(none.signed.parts.every((p) => p.count === 0 && p.amount.n === 0n));
});
