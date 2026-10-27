import { test } from "node:test";
import assert from "node:assert/strict";
import { alertText, editAlerts, noticeAlerts, payrollAlerts, rowAlerts } from "./payroll.js";
import { closedLabel } from "./presentation.js";

// Paie d'octobre versée le 1er novembre, novembre le 1er décembre (photo manquante) ; alertes du serveur.
const moved = {
  id: "moved:7:own:2026-10", type: "moved", month: "2026-10", toMonth: "2026-11", payDate: "2026-11-01", key: "7:own",
  kind: "own", leadId: 7, client: "Société 7", person: "Alice", personId: "u1",
  paid: { amount: "672.00", person: "Alice", personId: "u1", month: "2026-10" },
  now: { amount: "672.00", person: "Alice", personId: "u1", month: "2026-11" },
};
const source = {
  profiles: { Alice: { name: "Alice A", userId: "u1" }, Bob: { name: "Bob B", userId: "u2" } },
  payroll: {
    firstMonth: "2026-10", payDates: { "2026-10": "2026-11-01", "2026-11": "2026-12-01", "2026-12": "2027-01-01" },
    snapshots: { "2026-10": { takenAt: "2026-11-01T00:05:00+01:00", late: false } }, missing: ["2026-11"], alerts: [moved],
  },
};
const audit = [
  { id: "a1", at: "2026-11-04T09:30:00Z", statementId: "crm:u1:2026-10", person: "Alice", action: "Cellule modifiée", detail: "E5 · Société 7 · motif" },
  { id: "a2", at: "2026-10-31T22:30:00Z", statementId: "crm:u1:2026-10", person: "Alice", action: "Prime ajoutée", detail: "Challenge" },   // 31/10 23 h 30 à Paris
  { id: "a3", at: "2026-11-04T09:30:00Z", statementId: "crm:u1:2026-11", person: "Alice", action: "Règles modifiées", detail: "" },
];

test("an edit made in the page on a month already paid is an alert; before the payroll day it is not", () => {
  assert.deepEqual(editAlerts(source, audit).map((a) => [a.id, a.month, a.payDate]), [["edited:a1", "2026-10", "2026-11-01"]]);
  assert.deepEqual(editAlerts({ payroll: {} }, audit), []);
});

test("a paid month without a photo, or photographed late, is flagged", () => {
  assert.deepEqual(noticeAlerts(source).map((a) => a.id), ["missing:2026-11"]);
  const late = { payroll: { ...source.payroll, missing: [], snapshots: { "2026-10": { takenAt: "2026-11-03T10:00:00Z", late: true } } } };
  assert.deepEqual(noticeAlerts(late).map((a) => [a.id, a.takenAt]), [["late:2026-10", "2026-11-03T10:00:00Z"]]);
});

test("all alerts, latest payroll first; a row gets those of its payroll month and of the month it moved to", () => {
  const alerts = payrollAlerts(source, audit);
  assert.deepEqual(alerts.map((a) => a.id), ["missing:2026-11", "moved:7:own:2026-10", "edited:a1"]);
  assert.deepEqual(rowAlerts(alerts, 7, "own", "2026-10").map((a) => a.id), ["moved:7:own:2026-10"]);
  assert.deepEqual(rowAlerts(alerts, 7, "own", "2026-11").map((a) => a.id), ["moved:7:own:2026-10"]);
  assert.deepEqual(rowAlerts(alerts, 7, "team", "2026-10"), []);
  assert.deepEqual(rowAlerts(alerts, 7, "own", "2026-12"), []);
});

// Montants affichés : espaces fines et insécables, remplacées ici par des espaces simples pour la lecture.
const plain = (value) => String(value).replace(/[\u202f\u00a0]/g, " ");

test("each alert says what changed after the payroll and what to do", () => {
  const text = (alert) => {
    const out = alertText(source, alert);
    return { ...out, detail: plain(out.detail) };
  };
  assert.deepEqual(text(moved), {
    title: "Paiement redaté après la paie", amount: "672.00", subject: "Société 7, Alice A",
    detail: "versée avec la paie d’octobre le 1er novembre ; la Finance date maintenant le paiement en novembre. Elle compte aussi en novembre : ne pas la reverser.",
  });
  assert.equal(text({ ...moved, type: "removed", now: null }).detail, "versée avec la paie d’octobre le 1er novembre ; sa première échéance n’apparaît plus payée en Finance.");
  assert.equal(text({ ...moved, type: "added", paid: null }).detail, "payée en octobre, saisie après la paie du 1er novembre : pas encore versée, à ajouter.");
  const amount = text({ ...moved, type: "amount", now: { ...moved.now, amount: "460.80", month: "2026-10" },
    causes: [{ factor: "annual", paid: "5880.00", now: "4032.00" }, { factor: "plan", paid: "A", now: "M" }, { factor: "channel", paid: "ADS", now: "CC" }] });
  assert.equal(amount.detail, "versée avec la paie d’octobre le 1er novembre : 672 € ; vaut maintenant 460,80 € (prix 5 880 € → prix 4 032 €, annuel → mensuel, Ads → Cold call).");
  assert.equal(text({ ...moved, type: "beneficiary", now: { ...moved.now, person: "Bob" } }).detail,
    "versée avec la paie d’octobre le 1er novembre à Alice A ; revient maintenant à Bob B.");
  assert.equal(text({ ...moved, kind: "team", type: "double", months: ["2026-10", "2026-11"] }).subject, "Société 7, part d’équipe de Alice A");
  assert.equal(text({ ...moved, type: "double", months: ["2026-10", "2026-11"] }).detail, "dans les paies d’octobre et de novembre.");
  assert.equal(text({ type: "fixed", month: "2026-10", payDate: "2026-11-01", person: "Alice", paid: { amount: "500" }, now: { amount: "600" } }).detail,
    "fixe d’octobre versé : 500 € ; maintenant 600 €.");
  assert.equal(text(editAlerts(source, audit)[0]).detail,
    "Cellule modifiée (Société 7 · motif) sur octobre, le 4 novembre à 10 h 30, après la paie du 1er novembre.");
  assert.equal(text(noticeAlerts(source)[0]).title, "Paie sans photo");
});

test("an instant is read at Paris time", () => {
  assert.equal(closedLabel("2026-10-28T14:05:00+00:00"), "28 octobre à 15 h 05");
  assert.equal(closedLabel("2026-11-02T08:00:00+00:00"), "2 novembre à 9 h");
  assert.equal(closedLabel(""), "");
});
