import { test } from "node:test";
import assert from "node:assert/strict";
import { Rational } from "./calculation.js";
import {
  amountInput,
  auditDetail,
  auditValue,
  baseCaption,
  crossMonthLabel,
  dayMonthLabel,
  decimalLabel,
  financeBadge,
  groupText,
  monthLabel,
  monthName,
  rangeLabel,
  rowStatus,
  saleState,
  saleTimeline,
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
  assert.equal(financeBadge({ status: "first_due_unpaid" }).tone, "attention"); // marine, pas de saumon
  assert.equal(financeBadge({ status: "lost", statusLabel: "Client perdu" }).tone, "neutral");
  for (const missing of [null, undefined, {}, { receivedOwner: "0" }, { status: "mystery" }])
    assert.deepEqual(financeBadge(missing), { key: "unmatched", label: "À rapprocher", tone: "neutral" });
});

test("the base of a sale reads like the Excel: (total × 80 %) / 12 or Owner price / 12", () => {
  const cells = { C1: { input: "4032.00" }, C2: { input: "2160" }, C3: { input: "2798.4" } };
  assert.equal(baseCaption(cells, "C1/0.7*0.8/12"), "(5\u202f760\u00a0€ × 80 %) / 12");
  assert.equal(baseCaption(cells, "(C1/0.7*0.8/12)"), "(5\u202f760\u00a0€ × 80 %) / 12"); // formule réécrite par la page
  assert.equal(baseCaption(cells, "C2/12"), "2\u202f160\u00a0€ / 12");
  assert.equal(baseCaption(cells, "C3/12"), "2\u202f798,40\u00a0€ / 12");
  for (const other of ["", null, "C9/12", "336", "C1/12*2"]) assert.equal(baseCaption(cells, other), null);
  assert.equal(rangeLabel("6-10"), "6-10 salariés");
  assert.equal(rangeLabel(null), "Tranche non renseignée");
});

test("sale state: one word for the « Payée » column; a first due after the current month is upcoming, not unpaid", () => {
  const unpaid = (due) => ({ finance: { status: "first_due_unpaid", statusLabel: "Première échéance non payée", firstDuePeriod: due } });
  assert.deepEqual(saleState(unpaid("2026-10"), "2026-10"),
    { key: "first_due_unpaid", label: "Première échéance non payée", tone: "attention", short: "Non payée" });
  assert.deepEqual(saleState(unpaid("2026-12"), "2026-10"),
    { key: "due:2026-12", label: "1re échéance en décembre", short: "Échéance décembre", tone: "neutral" }); // reportée par la facturation
  assert.equal(saleState(unpaid("2027-01"), "2026-10").label, "1re échéance en janvier 2027");
  assert.equal(saleState({ finance: { status: "onboarding_pending" } }, "2026-10").short, "Onboarding");
  assert.equal(saleState({ finance: null, unlinkedReason: "not_declared" }, "2026-10").short, "Non déclarée");
});

test("row status: where the money goes, as a pill (tone, label)", () => {
  const pending = (state) => rowStatus({ status: "pending", saleState: state });
  assert.deepEqual(rowStatus({ status: "counted", paidDay: "19/09" }), { tone: "paid", label: "Payée le 19/09", title: undefined });
  assert.equal(rowStatus({ status: "deferred", paidDay: "17/10" }).tone, "later");
  assert.equal(rowStatus({ status: "lost" }).label, "Client perdu");
  assert.deepEqual([pending({ key: "first_due_unpaid" }).tone, pending({ key: "first_due_unpaid" }).label], ["waiting", "Non payée"]);
  assert.deepEqual([pending({ key: "due:2026-12", label: "1re échéance en décembre" }).tone, pending({ key: "due:2026-12", label: "1re échéance en décembre" }).label],
    ["upcoming", "Échéance en décembre"]);
  assert.equal(pending({ key: "onboarding_pending" }).label, "Onboarding à venir");
  assert.deepEqual([pending({ key: "not_declared", short: "Non déclarée" }).tone, pending({ key: "not_declared", short: "Non déclarée" }).label], ["unknown", "Non déclarée"]);
});

test("board: a client finished on the board gives the reason of the loss; a paused client is « En pause »", () => {
  const lost = { finance: { status: "lost", boardState: "Rétractation", boardLost: true } };
  assert.deepEqual(saleState(lost, "2026-10"), { key: "lost:Rétractation", label: "Rétractation au board", short: "Rétractation", tone: "neutral" });
  assert.equal(rowStatus({ status: "lost", saleState: saleState(lost, "2026-10") }).label, "Rétractation");
  assert.equal(rowStatus({ status: "lost", saleState: saleState({ finance: { status: "lost" } }, "2026-10") }).label, "Client perdu");
  const paused = { finance: { status: "first_due_unpaid", boardState: "Pause", boardLost: false } };
  assert.deepEqual([rowStatus({ status: "pending", saleState: saleState(paused, "2026-10") }).tone, rowStatus({ status: "pending", saleState: saleState(paused, "2026-10") }).label],
    ["unknown", "En pause"]);
});

test("group texts: where the money goes, with the number of sales", () => {
  assert.deepEqual(groupText("counted", "2026-09", 12), { tone: "paid", title: "Dans la paie de septembre", subtitle: "12 ventes" });
  assert.equal(groupText("counted-before", "2026-09", 7).title, "Signées avant septembre, payées en septembre");
  assert.deepEqual(groupText("deferred", "2026-09", 2, ["2026-10"]), { tone: "later", title: "Dans la paie d’octobre", subtitle: "Client payé en octobre · 2 ventes" });
  assert.equal(groupText("deferred", "2026-09", 3, ["2026-10", "2026-11"]).title, "Dans une paie suivante");
  assert.equal(groupText("pending", "2026-09", 1).subtitle, "Hors paie, en attente du client · 1 vente");
  assert.equal(groupText("lost", "2026-09", 2).title, "Clients perdus");
});

test("sale without Finance record: « Vente non déclarée » only when the back says not_declared", () => {
  const notDeclared = financeBadge(null, "not_declared");
  assert.equal(notDeclared.key, "not_declared");
  assert.equal(notDeclared.label, "Vente non déclarée");
  assert.equal(notDeclared.tone, "neutral");
  assert.match(notDeclared.hint, /pas de fiche client/);
  for (const reason of ["no_client", undefined, null, "autre"])
    assert.equal(financeBadge(null, reason).label, "À rapprocher");
  assert.equal(financeBadge({ status: "paid" }, "not_declared").key, "paid");
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

test("sale timeline, factual: signature day, first due month, payment day or unknown", () => {
  const paidLater = { signedAt: "2026-09-30 15:00:00+00:00", finance: { firstDuePeriod: "2026-10" }, paidOn: "2026-10-22" };
  assert.equal(saleTimeline(paidLater), "Signée le 30/09 · 1re échéance octobre · payée le 22/10");
  assert.equal(saleTimeline({ ...paidLater, paidOn: null, paidOnUnknown: true }), "Signée le 30/09 · 1re échéance octobre · date de paiement inconnue");
  assert.equal(saleTimeline({ signedAt: "2025-12-30 10:00:00+00:00", finance: { firstDuePeriod: "2026-01" }, paidOn: "2026-01-05" }),
    "Signée le 30/12 · 1re échéance janvier 2026 · payée le 05/01/2026");
  assert.equal(saleTimeline({ signedAt: "2026-09-11 22:30:00+00:00" }), "Signée le 12/09");
});

test("cross-month pill: « Signée en septembre » in the payment month, « Comptée en octobre » in the signing month", () => {
  const sale = { signedAt: "2026-09-30 15:00:00+00:00", countedMonth: "2026-10" };
  assert.equal(crossMonthLabel("counted", sale, "2026-10"), "Signée en septembre");
  assert.equal(crossMonthLabel("deferred", sale, "2026-09"), "Comptée en octobre");
  assert.equal(crossMonthLabel("counted", { signedMonth: "2026-10" }, "2026-10"), null);
  assert.equal(crossMonthLabel("pending", sale, "2026-09"), null);
  assert.equal(crossMonthLabel("counted", { signedMonth: "2025-12" }, "2026-01"), "Signée en décembre 2025");
  assert.equal(monthName("2026-10", "2026-09"), "octobre");
});
