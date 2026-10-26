// Vue d'équipe et ventes d'une personne : logique pure, sans React (testée par team.test.js).
import { ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import { monthName, signedMonthOf, signedParis } from "./presentation.js";

export const statementSettings = (statement, draft) => ({
  ...statement.defaults,
  ...draft?.settings?.[statement.id],
});
export const isHead = (source, person) => /^head/i.test(source.profiles?.[person]?.role || "");
export const periodsOf = (source) => [...new Set(source.statements.map((s) => s.period))].sort();
export const entryIndex = (source) => new Map((source.entries || []).map((e) => [e.amountCell, e]));
export const teamEntryIndex = (source) =>
  new Map((source.entries || []).filter((e) => e.teamCell).map((e) => [e.teamCell, e]));

// Statut d'une vente dans le relevé d'un mois P, seule source pour la carte, la liste, les puces
// et le tableau. Règle du 26/10 : une vente compte dans le mois où le client a payé sa 1re échéance
// Owner ; une même vente peut donc figurer au relevé de sa signature et à celui de son paiement.
// - « counted » : dans les countedRefs du relevé (total du mois, y compris signée avant P) ;
// - « deferred » : signée en P, comptée un autre mois (payée plus tard) ;
// - « lost » : non comptée, client perdu ; « pending » : le reste (dont les ventes non déclarées).
// Relevé sans countedRefs (données d'avant le 26/10) : ancienne règle, entry.counted.
export function statusFor(statement) {
  const counted = Array.isArray(statement?.countedRefs) ? new Set(statement.countedRefs) : null;
  return (entry) => {
    if (counted ? counted.has(entry?.amountCell) : entry?.counted !== false) return "counted";
    if (counted && entry?.counted && entry.countedMonth && entry.countedMonth !== statement.period) return "deferred";
    return entry?.finance?.status === "lost" ? "lost" : "pending";
  };
}
export const SALE_STATUSES = ["counted", "deferred", "pending", "lost"];

// Commissions des ventes en attente (non comptées, hors client perdu) :
// ce que la personne touchera quand les clients paieront leur première échéance.
export function pendingOf(statement, entries, calculator) {
  const status = statusFor(statement);
  let amount = ZERO, count = 0;
  for (const ref of statement.entryRefs || []) {
    const entry = entries.get(ref);
    if (!entry || status(entry) !== "pending") continue;
    count++;
    try {
      amount = amount.add(calculator.value(ref));
    } catch {
      /* Montant illisible : la vente reste comptée dans n, pas dans la somme. */
    }
  }
  return { amount, count };
}

// Part d'équipe d'un head pour le mois (relevé avec teamRefs) : les parts du total (model.teamRefs,
// ventes de l'équipe dont la 1re échéance est payée ce mois) et celles des ventes de l'équipe du relevé
// encore en attente, hors total (même statut que pendingOf, perdues et reportées exclues).
export function teamShareOf(statement, teamEntries, model) {
  const valueOf = (ref) => {
    try {
      return model.calculator.value(ref);
    } catch {
      return null;
    }
  };
  const counted = (model.teamRefs || []).map((ref) => ({ ref, entry: teamEntries.get(ref), value: valueOf(ref) }));
  const status = statusFor({ period: statement.period, countedRefs: statement.countedTeamRefs || [] });
  let amount = ZERO, count = 0;
  for (const ref of statement.teamRefs || []) {
    const entry = teamEntries.get(ref);
    if (!entry || status({ ...entry, amountCell: ref }) !== "pending") continue;
    count++;
    const value = valueOf(ref);
    if (value) amount = amount.add(value);
  }
  return { counted, amount: model.teamShare, pending: { amount, count } };
}

// n/N de la liste : ventes comptées dans le mois / ventes du relevé (mêmes statuts que les puces).
function summarize(source, statement, draft, entries) {
  const refs = statement.entryRefs || [];
  const status = statusFor(statement);
  const counted = refs.filter((ref) => status(entries.get(ref) || { amountCell: ref }) === "counted").length;
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

// Comptées, reportées, en attente, puis perdues ; dans chaque groupe, par date de signature.
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
  const status = { ALL: 0, counted: 0, deferred: 0, pending: 0, lost: 0 }, channel = { ALL: 0 };
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
    const g = groups.get(r.finance.key) || { key: r.finance.key, label: r.finance.label, hint: r.finance.hint, count: 0 };
    g.count++;
    groups.set(r.finance.key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

// Flux de ventes de la carte : ce que la personne aurait touché sur ses ventes signées du mois
// (et pourquoi une partie n'est pas dans la paie de ce mois), puis ce qu'elle touche ce mois.
// Montants au barème du mois (model.calculator), comme le tableau et pendingOf.
// - signed : ventes de entryRefs signées ce mois, une catégorie chacune, testée dans l'ordre
//   paid → lost → laterDue → onboarding → laterPayment → noFinance ;
// - paid : model.amountRefs, exactement ce qui fait model.commission
//   (signedHere, signedBefore, adjustment pour une référence sans vente).
// Une valeur illisible compte dans n, pas dans la somme, et marque sa partie (unreadable).
const SIGNED_PARTS = ["paid", "lost", "laterDue", "onboarding", "laterPayment", "noFinance"];
const PAID_PARTS = ["signedHere", "signedBefore", "adjustment"];

function flowGroup(keys, items, labelOf) {
  const parts = keys.map((key) => {
    const mine = items.filter((item) => item.key === key);
    const readable = mine.filter((item) => item.value);
    return {
      key,
      label: labelOf(key, mine),
      amount: readable.reduce((sum, item) => sum.add(item.value), ZERO),
      count: mine.length,
      refs: mine.map((item) => item.ref),
      unreadable: readable.length < mine.length,
    };
  });
  return {
    amount: parts.reduce((sum, part) => sum.add(part.amount), ZERO),
    count: parts.reduce((n, part) => n + part.count, 0),
    parts,
  };
}

export function salesFlow(statement, entries, model) {
  const period = statement.period;
  const status = statusFor(statement);
  const valueOf = (ref) => {
    try {
      return model.calculator.value(ref);
    } catch {
      return null;
    }
  };
  const signedItems = [];
  for (const ref of statement.entryRefs || []) {
    const entry = entries.get(ref);
    if (!entry || signedMonthOf(entry) !== period) continue;
    const st = status(entry), finance = entry.finance, due = finance?.firstDuePeriod;
    const key = st === "counted" ? "paid"
      : finance?.status === "lost" ? "lost"
        : due && due > period ? "laterDue"
          : finance?.status === "onboarding_pending" ? "onboarding"
            : due || st === "deferred" ? "laterPayment"
              : "noFinance";
    signedItems.push({ key, ref, value: valueOf(ref), due });
  }
  const paidItems = (model.amountRefs || []).map((ref) => {
    const entry = entries.get(ref);
    const key = !entry ? "adjustment" : signedMonthOf(entry) === period ? "signedHere" : "signedBefore";
    return { key, ref, value: valueOf(ref) };
  });
  const month = monthName(period, period);
  const signed = flowGroup(SIGNED_PARTS, signedItems, (key, mine) => {
    if (key === "paid") return `Payées en ${month}`;
    if (key === "lost") return "Perdues";
    if (key === "laterDue") {
      const dues = new Set(mine.map((item) => item.due));
      return dues.size === 1 ? `1re échéance en ${monthName([...dues][0], period)}` : `1re échéance après ${month}`;
    }
    if (key === "onboarding") return "Onboarding à venir";
    if (key === "laterPayment") return "Paiement plus tard";
    return "Sans suivi Finance";
  });
  const paid = flowGroup(PAID_PARTS, paidItems, (key) =>
    key === "signedHere" ? `Signées en ${month}` : key === "signedBefore" ? "Signées avant" : "Ajustements");
  return { signed, paid };
}
