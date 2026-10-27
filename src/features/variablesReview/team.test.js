import { test } from "node:test";
import assert from "node:assert/strict";
import { createCalculator, Rational, ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import {
  filterSales,
  groupSections,
  groupTotals,
  saleGroup,
  pendingBreakdown,
  periodsOf,
  entryIndex,
  saleCounts,
  missedOf,
  MISSED_STATUSES,
  sortSales,
  statusFor,
  teamEntryIndex,
  teamRows,
  teamShareOf,
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
  assert.equal(totals.missed.toFixed(2), "120.00"); // Alice : E2 pas encore payée 50 + E4 cliente perdue 70
});

test("missed amount: commissions of sales not counted (not paid yet, lost), never in the total", () => {
  const entries = new Map(source.entries.map((e) => [e.amountCell, e]));
  const missed = missedOf(source.statements[0], entries, { calculator: createCalculator(source.cells) });
  assert.deepEqual([missed.own.pending.count, missed.own.pending.amount.toFixed(2)], [1, "50.00"]);
  assert.deepEqual([missed.own.lost.count, missed.own.lost.amount.toFixed(2)], [1, "70.00"]);
  assert.equal(missed.total.toFixed(2), "120.00");
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

test("counted sales signed in an earlier month form their own group, after those signed this month; group totals", () => {
  const rows = [
    { ...sale("Avant", "counted", "2026-07-22 10:00:00+00:00"), signedBefore: true, amount: Rational.from("280") },
    { ...sale("Ici", "counted", "2026-09-11 10:00:00+00:00"), amount: Rational.from("768") },
    { ...sale("Reportée", "deferred", "2026-09-23 10:00:00+00:00"), amount: Rational.from("180") },
    { ...sale("Illisible", "counted", "2026-09-12 10:00:00+00:00"), amount: null },
  ];
  assert.deepEqual(sortSales(rows).map((r) => [r.client, saleGroup(r)]),
    [["Ici", "counted"], ["Illisible", "counted"], ["Avant", "counted-before"], ["Reportée", "deferred"]]);
  const totals = groupTotals(rows);
  assert.deepEqual(Object.fromEntries(Object.entries(totals).map(([k, g]) => [k, [g.count, g.amount.toFixed(2)]])),
    { counted: [2, "768.00"], "counted-before": [1, "280.00"], deferred: [1, "180.00"] });
});

test("group sections: one « in the pay » section with an intertitle for sales signed earlier, then the others", () => {
  const rows = sortSales([
    { ...sale("Ici", "counted", "2026-09-11 10:00:00+00:00"), amount: Rational.from("768") },
    { ...sale("Avant", "counted", "2026-07-22 10:00:00+00:00"), signedBefore: true, amount: Rational.from("280") },
    { ...sale("Plus tard", "deferred", "2026-09-23 10:00:00+00:00"), amount: Rational.from("180"), countedMonth: "2026-10" },
    { ...sale("Perdue", "lost", "2026-09-03 10:00:00+00:00"), amount: Rational.from("576") },
  ]);
  const sections = groupSections(rows, groupTotals(rows), "2026-09", ["2026-10"]);
  assert.deepEqual(sections.map((s) => [s.key, s.text.title, s.total.toFixed(2)]), [
    ["counted", "Dans la paie de septembre", "1048.00"], // 768 + 280 : toute la paie du mois
    ["deferred", "Dans la paie d’octobre", "180.00"],
    ["lost", "Clients perdus", "576.00"],
  ]);
  assert.deepEqual(sections[0].items.map((i) => (i.type === "row" ? i.row.client : `${i.text.title} (${i.total.toFixed(2)})`)),
    ["Ici", "Signées avant septembre, payées en septembre (280.00)", "Avant"]);
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
  // Manque à gagner : septembre, E3 pas encore payée 40 (E1, payée en octobre, n'en fait pas partie) ; octobre, E4 perdue 70.
  assert.equal(sep.missed.toFixed(2), "40.00");
  assert.equal(oct.missed.toFixed(2), "70.00");
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

// Manque à gagner de la carte (missedOf), données fictives : relevé de septembre d'une personne.
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
const missedModel = (source, statement = source.statements[0]) => statementModel(source, statement, {}, { ...statement.defaults });

test("missed this month: every sale of the statement not counted, by reason; counted ones stay out", () => {
  const model = missedModel(flowSource);
  const missed = missedOf(flowSource.statements[0], entryIndex(flowSource), model);
  assert.deepEqual(missed.own.deferred.refs, ["E4"]); // client payé en octobre : versée dans la paie d'octobre
  assert.deepEqual(missed.own.deferred.months, ["2026-10"]);
  assert.deepEqual(missed.own.pending.refs, ["E3", "E5", "E7", "E8", "E10", "E11"]); // pas encore payé (dont non déclarée)
  assert.deepEqual(missed.own.lost.refs, ["E2"]);
  assert.ok(!MISSED_STATUSES.some((k) => missed.own[k].refs.includes("E1") || missed.own[k].refs.includes("E6")));
  assert.deepEqual(MISSED_STATUSES.map((k) => missed.own[k].amount.toFixed(2)), ["50.00", "295.00", "200.00"]); // E8 illisible : compté, pas sommé
  assert.equal(missed.own.pending.count, 6);
  assert.equal(missed.total.toFixed(2), "495.00"); // pas encore payées 295 + perdue 200
  assert.equal(missed.later.toFixed(2), "50.00"); // versée en octobre : hors manque à gagner
  assert.equal(missed.team, null);
  assert.deepEqual(missed.own.pending.reasons.map((r) => [r.label, r.count]),
    [["Onboarding à venir", 3], ["Aucune échéance en Finance", 1], ["Première échéance non payée", 1], ["Vente non déclarée", 1]]);
});

test("missed this month: former rule (no countedRefs) and an empty month", () => {
  const former = { ...flowSource.statements[0], countedRefs: undefined };
  const missed = missedOf(former, entryIndex(flowSource), missedModel(flowSource, former));
  assert.deepEqual(missed.own.deferred.refs, []); // ancienne règle : E4 est comptée (entry.counted)
  const empty = { ...flowSource, statements: [{ id: "e", person: "Alice", period: "2026-07", totalCell: "H1", entryRefs: [], defaults: {} }] };
  const none = missedOf(empty.statements[0], entryIndex(empty), missedModel(empty));
  assert.equal(none.total.toFixed(2), "0.00");
  assert.ok(MISSED_STATUSES.every((k) => none.own[k].count === 0));
});

// Part d'équipe : Bob (head) mène l'équipe d'Alice. Ventes d'Alice signées en septembre : E1/T1 (Ads,
// payée en septembre), E2/T2 (cold call, payée en octobre), E3/T3 (webinaire, non payée), E4/T4 (Ads,
// client perdu). Bases annuelles C : 2160, 3000, 2160, 4032.
const TEAM_RULES = {
  ADS: { enabled: true, coefficient: "1.5", coefficientAnnual: "1.7", team: "0.3" },
  CC: { enabled: true, coefficient: "2", coefficientAnnual: "2.2", team: "0.5" },
  CCS: { enabled: true, coefficient: "1.5", coefficientAnnual: "1.5", team: "0" },
  WEB: { enabled: true, coefficient: "1", coefficientAnnual: "1", team: "0.1" },
};
const withTeam = {
  profiles: { Alice: { name: "Alice A", role: "sales" }, Bob: { name: "Bob B", role: "head_of_sales" } },
  cells: {
    C1: { input: "2160" }, C2: { input: "3000" }, C3: { input: "2160" }, C4: { input: "4032" },
    E1: { input: "=C1/12*1.2" }, E2: { input: "=C2/12*1.5" }, E3: { input: "=C3/12*1" }, E4: { input: "=C4/12*1.2" },
    T1: { input: "=C1/12*0.3" }, T2: { input: "=C2/12*0.5" }, T3: { input: "=C3/12*0.1" }, T4: { input: "=C4/12*0.3" },
    G5: { input: "Fixe" }, H5: { input: "1500" }, M5: { input: "=H5+T1" },
    G6: { input: "Fixe" }, H6: { input: "1500" }, M6: { input: "=H6+T2" },
  },
  entries: [
    { amountCell: "E1", teamCell: "T1", person: "Alice", client: "Un", originChannel: "ADS", counted: true, signedMonth: "2026-09", countedMonth: "2026-09", finance: { status: "paid" } },
    { amountCell: "E2", teamCell: "T2", person: "Alice", client: "Deux", originChannel: "CC", counted: true, signedMonth: "2026-09", countedMonth: "2026-10", finance: { status: "paid" } },
    { amountCell: "E3", teamCell: "T3", person: "Alice", client: "Trois", originChannel: "WEB", counted: false, signedMonth: "2026-09", countedMonth: null, finance: { status: "first_due_unpaid" } },
    { amountCell: "E4", teamCell: "T4", person: "Alice", client: "Quatre", originChannel: "ADS", counted: false, signedMonth: "2026-09", countedMonth: null, finance: { status: "lost" } },
  ],
  statements: [
    { id: "b-09", person: "Bob", period: "2026-09", totalCell: "M5", entryRefs: [], countedRefs: [],
      teamRefs: ["T1", "T2", "T3", "T4"], countedTeamRefs: ["T1"], defaults: { acquisition: TEAM_RULES } },
    { id: "b-10", person: "Bob", period: "2026-10", totalCell: "M6", entryRefs: [], countedRefs: [],
      teamRefs: ["T2"], countedTeamRefs: ["T2"], defaults: { acquisition: TEAM_RULES } },
  ],
};
const teamModel = (statement, settings = statement.defaults, changes = {}) =>
  statementModel(withTeam, statement, changes, settings);

test("team share: in the head's total only in the month the first due is paid, never before", () => {
  const [sep, oct] = withTeam.statements;
  const september = teamModel(sep), october = teamModel(oct);
  assert.deepEqual([september.teamRefs, october.teamRefs], [["T1"], ["T2"]]);
  assert.equal(september.teamShare.toFixed(2), "54.00"); // 2160 / 12 × 0,3
  assert.equal(october.teamShare.toFixed(2), "125.00"); // 3000 / 12 × 0,5, signée en septembre
  assert.equal(september.total.toFixed(2), "1554.00");
  assert.equal(october.total.toFixed(2), "1625.00");
  assert.equal(september.commission.toFixed(2), "0.00");
  assert.equal(september.remainder.toFixed(2), "0.00"); // la part n'est pas un « autre ajustement »
  assert.deepEqual(teamRows(withTeam, emptyDraft, "2026-10").map((r) => r.total.toFixed(2)), ["1625.00"]);
});

test("team share detail: counted shares, then unpaid team sales outside the total (lost and deferred excluded)", () => {
  const [sep, oct] = withTeam.statements;
  const index = teamEntryIndex(withTeam);
  const september = teamShareOf(sep, index, teamModel(sep));
  assert.deepEqual(september.counted.map((c) => [c.ref, c.entry.client, c.value.toFixed(2)]), [["T1", "Un", "54.00"]]);
  assert.equal(september.amount.toFixed(2), "54.00");
  // T2 est payée en octobre (reportée), T4 perdue : seule T3 attend son paiement.
  assert.deepEqual([september.pending.count, september.pending.amount.toFixed(2)], [1, "18.00"]);
  const october = teamShareOf(oct, index, teamModel(oct));
  assert.deepEqual([october.counted.length, october.pending.count], [1, 0]);
});

test("team coefficients of the month apply to the team cells; disabled, missing or manual ones keep the cell", () => {
  const [sep] = withTeam.statements;
  const rules = (patch) => ({ acquisition: { ...TEAM_RULES, ADS: { ...TEAM_RULES.ADS, ...patch } } });
  const changed = teamModel(sep, rules({ team: "0.25" }));
  assert.equal(changed.teamShare.toFixed(2), "45.00");
  assert.equal(changed.appliedAcquisition.T1, "ADS");
  assert.equal(teamModel(sep, rules({ enabled: false, team: "0.25" })).teamShare.toFixed(2), "54.00");
  assert.equal(teamModel(sep, rules({ team: undefined })).teamShare.toFixed(2), "54.00"); // réglage d'avant la part
  const manual = { ...rules({ team: "0.25" }), deals: { T1: { exception: true } } };
  assert.equal(teamModel(sep, manual, { T1: "60" }).teamShare.toFixed(2), "60.00");
  assert.throws(() => teamModel(sep, rules({ team: "-0.1" })), /positifs ou nuls/);
});

test("team share keeps the base of the sale: total × 80 % from 6 employees, Owner price below", () => {
  // Vente CC 6-10 (4 032 € / an) : (5 760 × 80 %) / 12 = 384 € ; coefficient d'équipe du mois 0,4 → 153,60 €.
  const data = {
    cells: {
      C9: { input: "4032" }, E9: { input: "=C9/0.7*0.8/12*1.5" }, T9: { input: "=C9/0.7*0.8/12*0.5" },
      H8: { input: "1500" }, M8: { input: "=H8+T9" },
    },
    entries: [{ amountCell: "E9", teamCell: "T9", person: "Alice", client: "Neuf", originChannel: "CC", counted: true, signedMonth: "2026-09", countedMonth: "2026-09", finance: { status: "paid" } }],
  };
  const st = { id: "b", person: "Bob", period: "2026-09", totalCell: "M8", entryRefs: [], countedRefs: [], teamRefs: ["T9"], countedTeamRefs: ["T9"] };
  assert.equal(statementModel(data, st, {}, { acquisition: TEAM_RULES }).teamShare.toFixed(2), "192.00");
  const changed = statementModel(data, st, {}, { acquisition: { ...TEAM_RULES, CC: { ...TEAM_RULES.CC, team: "0.4" } } });
  assert.equal(changed.teamShare.toFixed(2), "153.60");
  assert.equal(changed.calculator.raw("T9"), "=(C9/0.7*0.8/12)*(0.4)");
});

test("missed team shares: paid next month, not paid yet, lost; the counted share stays out", () => {
  const [sep] = withTeam.statements;
  const missed = missedOf(sep, entryIndex(withTeam), teamModel(sep), teamEntryIndex(withTeam));
  assert.deepEqual([missed.team.deferred.refs, missed.team.pending.refs, missed.team.lost.refs], [["T2"], ["T3"], ["T4"]]);
  assert.deepEqual(MISSED_STATUSES.map((k) => missed.team[k].amount.toFixed(2)), ["125.00", "18.00", "100.80"]);
  assert.equal(missed.total.toFixed(2), "118.80"); // pas encore payée 18 + perdue 100,80 (aucune vente perso du head)
  assert.equal(missed.later.toFixed(2), "125.00"); // payée en octobre : versée avec la paie d'octobre
  assert.deepEqual(missed.team.deferred.months, ["2026-10"]);
});

test("a statement without team refs has no team share", () => {
  const model = statementModel(source, source.statements[1], {}, {});
  assert.deepEqual(model.teamRefs, []);
  assert.equal(model.teamShare.toFixed(2), "0.00");
  assert.equal(model.total.toFixed(2), "1010.00");
});
