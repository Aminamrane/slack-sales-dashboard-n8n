// Vue d'équipe et ventes d'une personne : logique pure, sans React (testée par team.test.js).
import { ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import { signedParis } from "./presentation.js";

export const statementSettings = (statement, draft) => ({
  ...statement.defaults,
  ...draft?.settings?.[statement.id],
});
export const isHead = (source, person) => /^head/i.test(source.profiles?.[person]?.role || "");
export const periodsOf = (source) => [...new Set(source.statements.map((s) => s.period))].sort();
export const entryIndex = (source) => new Map((source.entries || []).map((e) => [e.amountCell, e]));

// Statut d'une vente, seule source pour la carte, la liste, les puces et le tableau :
// « counted » (compte dans le total), « lost » (non comptée, client perdu), « pending » (le reste).
export function saleStatus(entry) {
  if (entry?.counted !== false) return "counted";
  return entry.finance?.status === "lost" ? "lost" : "pending";
}
export const SALE_STATUSES = ["counted", "pending", "lost"];

// Commissions des ventes en attente (non comptées, hors client perdu) :
// ce que la personne touchera quand les clients paieront leur première échéance.
export function pendingOf(statement, entries, calculator) {
  let amount = ZERO, count = 0;
  for (const ref of statement.entryRefs || []) {
    const entry = entries.get(ref);
    if (!entry || saleStatus(entry) !== "pending") continue;
    count++;
    try {
      amount = amount.add(calculator.value(ref));
    } catch {
      /* Montant illisible : la vente reste comptée dans n, pas dans la somme. */
    }
  }
  return { amount, count };
}

function summarize(source, statement, draft, entries) {
  const refs = statement.entryRefs || [];
  const counted = refs.filter((ref) => entries.get(ref)?.counted !== false).length;
  try {
    const model = statementModel(source, statement, draft.changes, statementSettings(statement, draft));
    return { total: model.total, pending: pendingOf(statement, entries, model.calculator), counted, signed: refs.length, error: null };
  } catch (e) {
    return { total: null, pending: { amount: ZERO, count: 0 }, counted, signed: refs.length, error: e.message };
  }
}

// Décroissant ; un total incalculable (null) passe après les autres.
function byTotalDesc(a, b) {
  if (a == null || b == null) return (a == null) - (b == null);
  const diff = b.sub(a).n;
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}
const byTeamOrder = (a, b) =>
  (b.head - a.head) || byTotalDesc(a.total, b.total) || a.name.localeCompare(b.name, "fr");

// Une ligne par personne ayant un relevé ce mois-là : heads d'abord, puis total décroissant.
export function teamRows(source, draft, period) {
  const entries = entryIndex(source);
  return source.statements
    .filter((s) => s.period === period)
    .map((statement) => ({
      statement,
      person: statement.person,
      name: source.profiles?.[statement.person]?.name || statement.person,
      head: isHead(source, statement.person),
      ...summarize(source, statement, draft, entries),
    }))
    .sort(byTeamOrder);
}

export function teamTotals(rows) {
  return rows.reduce(
    (acc, r) => ({
      total: r.total ? acc.total.add(r.total) : acc.total,
      pending: acc.pending.add(r.pending.amount),
      blocked: acc.blocked + (r.error ? 1 : 0),
    }),
    { total: ZERO, pending: ZERO, blocked: 0 },
  );
}

// Comptées, puis en attente, puis perdues ; dans chaque groupe, par date de signature.
export function sortSales(rows) {
  const key = (r) => signedParis(r.signedAt)?.key || "9999";
  return [...rows].sort(
    (a, b) =>
      SALE_STATUSES.indexOf(a.status) - SALE_STATUSES.indexOf(b.status) ||
      key(a).localeCompare(key(b)) ||
      String(a.client || "").localeCompare(String(b.client || ""), "fr"),
  );
}

const matches = (row, { status = "ALL", channel = "ALL", query = "" }, ignore) =>
  (ignore === "status" || status === "ALL" || row.status === status) &&
  (ignore === "channel" || channel === "ALL" || row.channel === channel) &&
  (!query || String(row.search || "").toLowerCase().includes(query.toLowerCase()));

export const filterSales = (rows, filters) => rows.filter((r) => matches(r, filters));

// Compteurs des puces : chaque compteur = nombre de lignes affichées si on clique la puce
// (les autres filtres restent appliqués). La somme des statuts = « Toutes ».
export function saleCounts(rows, filters) {
  const status = { ALL: 0, counted: 0, pending: 0, lost: 0 }, channel = { ALL: 0 };
  for (const r of rows) {
    if (matches(r, filters, "status")) {
      status.ALL++;
      status[r.status]++;
    }
    if (matches(r, filters, "channel")) {
      channel.ALL++;
      channel[r.channel] = (channel[r.channel] || 0) + 1;
    }
  }
  return { status, channel };
}

// Ventes en attente (hors perdues) regroupées par statut Finance, pour la bulle d'explication.
export function pendingBreakdown(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (r.status !== "pending") continue;
    const g = groups.get(r.finance.key) || { key: r.finance.key, label: r.finance.label, count: 0 };
    g.count++;
    groups.set(r.finance.key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}
