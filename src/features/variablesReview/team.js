// Vue d'équipe et ventes d'une personne : logique pure, sans React (testée par team.test.js).
import { ZERO } from "./calculation.js";
import { statementModel } from "./model.js";
import { groupText, saleState, signedParis } from "./presentation.js";

// Réglages d'un relevé : ceux de la clôture s'il est clôturé dans la page (figés), sinon ceux du brouillon.
export const statementSettings = (statement, draft) => ({
  ...statement.defaults,
  ...(statement.payroll?.settings ?? draft?.settings?.[statement.id]),
});
export const isHead = (source, person) => /^head/i.test(source.profiles?.[person]?.role || "");
export const periodsOf = (source) => [...new Set(source.statements.map((s) => s.period))].sort();
export const entryIndex = (source) => new Map((source.entries || []).map((e) => [e.amountCell, e]));
export const teamEntryIndex = (source) =>
  new Map((source.entries || []).filter((e) => e.teamCell).map((e) => [e.teamCell, e]));

// Mois de paie d'une ligne (« pay » : commission du vendeur, « teamPay » : part d'équipe du head), donné par le
// registre des paies : versée, à verser, à confirmer, versée hors de la page ; null si elle n'est pas due (1re
// échéance non payée). Source d'avant le registre : mois du paiement de la 1re échéance.
export function payMonth(entry, pay = "pay") {
  const line = entry?.[pay];
  if (line) return line.state === "non_due" ? null : line.month;
  return entry?.counted ? entry.countedMonth || null : null;
}

// Statut d'une ligne dans le relevé d'un mois P, seule source pour la carte, la liste, les puces et le tableau.
// Règle du 26/10 : une vente compte dans le mois où le client a payé sa 1re échéance Owner ; une même vente peut
// donc figurer au relevé de sa signature et à celui de son paiement. Registre des paies (27/10) : une ligne versée
// ne compte qu'au mois où elle l'a été, et une vente de la transition attend une confirmation.
// - « counted » : dans les countedRefs du relevé (total du mois, y compris signée avant P) ;
// - « held » : à confirmer (heldRefs) : peut-être déjà versée par l'ancienne paie, hors total ;
// - « deferred » : signée en P, versée ou versable un autre mois ;
// - « lost » : non comptée, client perdu ; « pending » : le reste (dont les ventes non déclarées).
// statement : { period, countedRefs, heldRefs } (pour une part d'équipe : countedTeamRefs, heldTeamRefs) ;
// pay : champ de la ligne dans l'entrée. Relevé sans countedRefs (données d'avant le 26/10) : entry.counted.
export function statusFor(statement, pay = "pay") {
  const counted = Array.isArray(statement?.countedRefs) ? new Set(statement.countedRefs) : null;
  const held = new Set(statement?.heldRefs || []);
  return (entry) => {
    if (counted ? counted.has(entry?.amountCell) : entry?.counted !== false) return "counted";
    if (held.has(entry?.amountCell)) return "held";
    const month = payMonth(entry, pay);
    if (counted && month && month !== statement.period) return "deferred";
    return entry?.finance?.status === "lost" ? "lost" : "pending";
  };
}
// Statut des parts d'équipe d'un relevé de head.
export const teamStatusFor = (statement) =>
  statusFor({ period: statement.period, countedRefs: statement.countedTeamRefs || [], heldRefs: statement.heldTeamRefs || [] },
    "teamPay");

// Part d'équipe d'un head pour le mois (relevé avec teamRefs) : les parts du total (model.teamRefs,
// ventes de l'équipe dont la 1re échéance est payée ce mois) et celles des ventes de l'équipe du relevé
// encore en attente, hors total (statut « pending » : perdues et reportées exclues).
export function teamShareOf(statement, teamEntries, model) {
  const valueOf = (ref) => {
    try {
      return model.calculator.value(ref);
    } catch {
      return null;
    }
  };
  const counted = (model.teamRefs || []).map((ref) => ({ ref, entry: teamEntries.get(ref), value: valueOf(ref) }));
  const status = teamStatusFor(statement);
  let amount = ZERO;
  const rows = [];
  for (const ref of statement.teamRefs || []) {
    const entry = teamEntries.get(ref);
    if (!entry || status({ ...entry, amountCell: ref }) !== "pending") continue;
    const value = valueOf(ref);
    rows.push({ ref, entry, value });
    if (value) amount = amount.add(value);
  }
  return { counted, amount: model.teamShare, pending: { amount, count: rows.length, rows } };
}

// n/N de la liste : ventes comptées dans le mois / ventes du relevé (mêmes statuts que les puces) ;
// manque à gagner du mois (missedOf), sommé dans l'en-tête de l'équipe.
function summarize(source, statement, draft, entries, teamEntries) {
  const refs = statement.entryRefs || [];
  const status = statusFor(statement);
  const counted = refs.filter((ref) => status(entries.get(ref) || { amountCell: ref }) === "counted").length;
  try {
    const model = statementModel(source, statement, draft.changes, statementSettings(statement, draft));
    return { total: model.total, missed: missedOf(statement, entries, model, teamEntries).total, counted, signed: refs.length, error: null };
  } catch (e) {
    return { total: null, missed: ZERO, counted, signed: refs.length, error: e.message };
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
  const entries = entryIndex(source), teamEntries = teamEntryIndex(source);
  return source.statements
    .filter((s) => s.period === period)
    .map((statement) => ({
      statement,
      person: statement.person,
      name: source.profiles?.[statement.person]?.name || statement.person,
      head: isHead(source, statement.person),
      ...summarize(source, statement, draft, entries, teamEntries),
    }))
    .sort(byTeamOrder);
}

export function teamTotals(rows) {
  return rows.reduce(
    (acc, r) => ({
      total: r.total ? acc.total.add(r.total) : acc.total,
      missed: acc.missed.add(r.missed),
      blocked: acc.blocked + (r.error ? 1 : 0),
    }),
    { total: ZERO, missed: ZERO, blocked: 0 },
  );
}

// Groupes du tableau, dans l'ordre : comptées ce mois et signées dans le mois, comptées ce mois et signées
// avant (row.signedBefore), à confirmer, versées ou versables un autre mois, pas encore payées, perdues.
export const SALE_GROUPS = ["counted", "counted-before", "held", "deferred", "pending", "lost"];
export const saleGroup = (row) => (row.status === "counted" && row.signedBefore ? "counted-before" : row.status);

// Par groupe, puis par date de signature.
export function sortSales(rows) {
  const key = (r) => signedParis(r.signedAt)?.key || "9999";
  return [...rows].sort(
    (a, b) =>
      SALE_GROUPS.indexOf(saleGroup(a)) - SALE_GROUPS.indexOf(saleGroup(b)) ||
      key(a).localeCompare(key(b)) ||
      String(a.client || "").localeCompare(String(b.client || ""), "fr"),
  );
}

// Groupe principal d'une ligne : les ventes signées avant et payées ce mois sont « Dans la paie », sous un intertitre.
const topGroup = (key) => (key === "counted-before" ? "counted" : key);

// Sections d'une liste triée (ventes, part d'équipe) : une par destination de l'argent, avec son en-tête (titre,
// nombre, total) et ses éléments, lignes et intertitre « signées avant » à sa place. stats : groupTotals de
// toutes les lignes (pas seulement la page affichée).
export function groupSections(rows, stats, period, laterMonths = []) {
  const sum = (keys) => keys.reduce((acc, k) => ({
    count: acc.count + (stats[k]?.count || 0), amount: acc.amount.add(stats[k]?.amount || ZERO),
  }), { count: 0, amount: ZERO });
  const sections = [];
  let previous = null;
  for (const row of rows) {
    const key = saleGroup(row);
    if (previous === null || topGroup(previous) !== topGroup(key)) {
      const totals = topGroup(key) === "counted" ? sum(["counted", "counted-before"]) : sum([key]);
      sections.push({ key: topGroup(key), text: groupText(topGroup(key), period, totals.count, laterMonths), total: totals.amount, items: [] });
    }
    const items = sections.at(-1).items;
    if (key === "counted-before" && previous !== "counted-before") {
      const totals = sum(["counted-before"]);
      items.push({ type: "sub", key, text: groupText(key, period, totals.count), total: totals.amount });
    }
    items.push({ type: "row", row });
    previous = key;
  }
  return sections;
}

// Nombre de ventes et sous-total de chaque groupe (toutes les pages), pour l'en-tête du groupe.
// row.amount : montant lisible de la ligne (null s'il ne l'est pas, compté dans le nombre seulement).
export function groupTotals(rows) {
  const out = {};
  for (const row of rows) {
    const group = (out[saleGroup(row)] ||= { count: 0, amount: ZERO });
    group.count++;
    if (row.amount) group.amount = group.amount.add(row.amount);
  }
  return out;
}

const matches = (row, { status = "ALL", channel = "ALL", query = "" }, ignore) =>
  (ignore === "status" || status === "ALL" || row.status === status) &&
  (ignore === "channel" || channel === "ALL" || row.channel === channel) &&
  (!query || String(row.search || "").toLowerCase().includes(query.toLowerCase()));

export const filterSales = (rows, filters) => rows.filter((r) => matches(r, filters));

// Compteurs des puces : chaque compteur = nombre de lignes affichées si on clique la puce
// (les autres filtres restent appliqués). La somme des statuts = « Toutes ».
export function saleCounts(rows, filters) {
  const status = { ALL: 0, counted: 0, held: 0, deferred: 0, pending: 0, lost: 0 }, channel = { ALL: 0 };
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

// Ventes du relevé hors rémunération du mois, par statut (mêmes statuts que le tableau, statusFor) :
// « pending » client pas encore payé (détail par statut Finance) et « lost » client perdu font le manque à gagner
// (total) ; « deferred » client payé après le mois n'en fait pas partie : la commission est versée avec la paie du
// mois du paiement (later). Rémunération et manque à gagner ne s'additionnent pas : la rémunération contient des
// ventes signées les mois précédents. Pour un head, même découpage pour les parts de son équipe (teamRefs).
// Montants au barème du mois (model.calculator), comme le tableau ; une valeur illisible compte dans n, pas dans la somme.
export const MISSED_STATUSES = ["deferred", "pending", "lost"];

function missedGroups(refs, status, entryOf, valueOf, currentMonth, pay) {
  const groups = Object.fromEntries(MISSED_STATUSES.map((key) => [key, { amount: ZERO, count: 0, refs: [], months: [], reasons: [] }]));
  for (const ref of refs) {
    const entry = entryOf(ref);
    if (!entry) continue;
    const group = groups[status({ ...entry, amountCell: ref })];
    if (!group) continue; // comptée : dans la rémunération du mois
    const value = valueOf(ref);
    group.count++;
    group.refs.push(ref);
    if (value) group.amount = group.amount.add(value);
    const month = payMonth(entry, pay);
    if (month && !group.months.includes(month)) group.months.push(month);
    const state = saleState(entry, currentMonth);
    const reason = group.reasons.find((r) => r.key === state.key);
    if (reason) reason.count++;
    else group.reasons.push({ key: state.key, label: state.label, count: 1 });
  }
  for (const group of Object.values(groups)) {
    group.months.sort();
    group.reasons.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
  }
  return groups;
}

// currentMonth (AAAA-MM, facultatif) : distingue une 1re échéance à venir d'une échéance non payée.
export function missedOf(statement, entries, model, teamEntries, currentMonth) {
  const valueOf = (ref) => {
    try {
      return model.calculator.value(ref);
    } catch {
      return null;
    }
  };
  const own = missedGroups(statement.entryRefs || [], statusFor(statement), (ref) => entries.get(ref), valueOf, currentMonth,
    "pay");
  const team = Array.isArray(statement.teamRefs) && teamEntries
    ? missedGroups(statement.teamRefs, teamStatusFor(statement), (ref) => teamEntries.get(ref), valueOf, currentMonth, "teamPay")
    : null;
  const sum = (keys) => [own, team].filter(Boolean).reduce((s, groups) => keys.reduce((t, key) => t.add(groups[key].amount), s), ZERO);
  return { own, team, total: sum(["pending", "lost"]), later: sum(["deferred"]) };
}
