import { FREE_MONTH_LABEL } from '../freeMonth.js';
import { scopedPeriodAmounts, formatMonthLabel, toNumber, splitClientIdentity } from '../constants.js';

const monthKey = value => String(value || '').slice(0, 7);
const included = (key, month) => /^\d{4}-\d{2}$/.test(key) && key <= month;
const receiptKind = split => split.kind || 'received';
const validReceipt = split => ['received', 'overdue'].includes(receiptKind(split));
const cents = value => Math.round(toNumber(value) * 100);
const nature = kind => kind === 'overdue' ? 'Règlement d’arriérés' : 'Règlement du mois';

export async function loadStatementData(get, clientId, structureId = null) {
  const base = `/api/v1/finance-periods/client/${clientId}`;
  const [timeline, profile, splits, structures] = await Promise.all(
    ['timeline', 'profile', 'splits', 'structures'].map(part => get(`${base}/${part}`)),
  );
  if (!Array.isArray(timeline?.periods) || !profile || !Array.isArray(splits?.items) || !Array.isArray(structures?.items)) {
    throw new Error('Les données de l’état de compte sont incomplètes. Réessayez après avoir rouvert la fiche.');
  }
  const structure = structureId == null ? null : structures.items.find(s => String(s.id) === String(structureId));
  if (structureId != null && !structure) throw new Error('Cette société n’est plus disponible. Rouvrez la fiche pour actualiser la liste.');
  return { timeline, profile, splits: splits.items, structures: structures.items, structure, billingCompanies: structures.billing_companies || {} };
}

export function statementOptions(scope, structures = []) {
  const entities = scope === 'global' ? ['owner', 'optilex'] : [scope];
  return entities.flatMap(entity => {
    const label = entity === 'optilex' ? 'Opti’Lex' : 'Owner';
    return [{ key: entity, entity, structure: null, label: `État de compte ${label}`, hint: 'Dossier complet' },
      ...structures.map(structure => ({ key: `${entity}-${structure.id}`, entity, structure,
        label: `${structure.name} seulement`, hint: `${label} · règlements de cette société` }))];
  });
}

// A structure's identity is authoritative. Never borrow another company's
// identifier, address or contract bracket just because they share a dossier.
export function statementRecipient({ client = {}, profile = {}, structure = null }) {
  const identity = splitClientIdentity(client);
  const digits = value => String(value || '').replace(/\D/g, '');
  const structureId = digits(structure?.siret || structure?.siren);
  const principalId = digits(profile.siret || profile.siren);
  const isPrincipal = structureId.length >= 9 && principalId.length >= 9
    && structureId.slice(0, 9) === principalId.slice(0, 9);
  const canUseProfile = !structure || isPrincipal;
  const identifier = structure ? structureId : principalId;
  return {
    company: structure ? structure.name : (profile.company_name || identity.societeName),
    person: structure ? '' : (client.representative_name || identity.representant || ''),
    clientNumber: String(client.numero_client || '').replace(/^n°\s*/i, ''),
    clientLabel: structure ? 'Dossier' : 'Client',
    address: canUseProfile ? [profile.address_line1, [profile.postal_code, profile.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '',
    email: canUseProfile ? (client.email || '') : '',
    siret: identifier,
    identifierLabel: identifier.length === 9 ? 'SIREN' : 'SIRET',
  };
}

// Reconcile each entity, month and receipt kind in cents. The residual is
// explicit, including over-allocation; it is never assigned to a company.
export function statementAllocationRows({ periods = [], entity, month, splits = [], structures = [] }) {
  const groups = new Map();
  const group = (key, kind) => {
    const id = `${key}/${kind}`;
    if (!groups.has(id)) groups.set(id, { month: key, kind, received: 0, allocations: new Map() });
    return groups.get(id);
  };
  for (const period of periods) {
    const key = monthKey(period.period);
    if (!included(key, month)) continue;
    const amounts = scopedPeriodAmounts(period, entity);
    group(key, 'received').received += cents(amounts.received);
    group(key, 'overdue').received += cents(amounts.receivedOverdue);
  }
  for (const split of splits) {
    const key = monthKey(split.period);
    if (split.entity !== entity || !included(key, month) || !validReceipt(split)) continue;
    const allocations = group(key, receiptKind(split)).allocations;
    const id = String(split.structure_id);
    const previous = allocations.get(id) || { amount: 0, name: split.structure_name };
    allocations.set(id, { ...previous, amount: previous.amount + cents(split.amount) });
  }
  const rows = [];
  for (const g of [...groups.values()].sort((a, b) => a.month.localeCompare(b.month) || Number(a.kind === 'overdue') - Number(b.kind === 'overdue'))) {
    let allocated = 0;
    const base = { periodLabel: formatMonthLabel(g.month), kindLabel: nature(g.kind) };
    for (const [id, value] of g.allocations) {
      allocated += value.amount;
      if (!value.amount) continue;
      const structure = structures.find(s => String(s.id) === id);
      rows.push({ ...base, company: structure?.name || value.name || `Structure ${id}`,
        identifier: structure?.siren || '', paid: value.amount / 100 });
    }
    const residual = g.received - allocated;
    if (residual) rows.push({ ...base, company: residual > 0 ? 'Non ventilé' : 'Écart de ventilation à vérifier',
      identifier: '', paid: residual / 100, unallocated: residual > 0, mismatch: residual < 0 });
  }
  return rows;
}

// Un relevé retrace les mouvements de l'entité choisie jusqu'au mois d'émission.
// Aucun remboursement global n'est attribué arbitrairement à une structure.
// `statement` : le relevé du serveur pour l'entité (timeline.statement[entity]). Avec lui, le PDF dit le même solde
// que le tableau (dev 2026-11-18) : chaque mois facture ce qu'il ajoute vraiment au solde (0 en pause, reports et
// corrections rattachés compris), et les corrections hors encaissement (alignement, reste dû, perte) ont leur ligne.
export function statementRows({ periods = [], entity, month, offer = '', structure = null, splits = [], refunds = [], priorDebts = [], statement = null, freeMonths = null }) {
  // Mois offerts pour parrainage (dev 2026-11-19) : la ligne reste, même à 0 €, et dit pourquoi rien n'est facturé.
  const free = new Set(freeMonths || []);
  const byMonth = new Map();
  if (structure) {
    for (const split of splits) {
      const key = String(split.period || '').slice(0, 7);
      if (String(split.structure_id) !== String(structure.id) || split.entity !== entity || !included(key, month) || !validReceipt(split)) continue;
      const kind = receiptKind(split);
      const id = `${key}/${kind}`;
      const previous = byMonth.get(id) || { month: key, kind, paid: 0 };
      byMonth.set(id, { ...previous, paid: previous.paid + cents(split.amount) });
    }
    return [...byMonth.values()].filter(r => r.paid !== 0)
      .sort((a, b) => a.month.localeCompare(b.month) || Number(a.kind === 'overdue') - Number(b.kind === 'overdue'))
      .map(r => ({ periodLabel: formatMonthLabel(r.month), offre: nature(r.kind), billed: 0, paid: r.paid / 100 }));
  } else if (Array.isArray(statement) && statement.length) {
    for (const m of statement) {
      const key = monthKey(m.period);
      if (!included(key, month)) continue;
      const billed = toNumber(m.charged);
      const paid = toNumber(m.received) + toNumber(m.received_overdue);
      if (billed !== 0 || paid !== 0 || (free.has(key) && billed === 0)) byMonth.set(key, { billed, paid });
    }
  } else {
    for (const period of periods) {
      const key = String(period.period || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key) || key > month) continue;
      const amounts = scopedPeriodAmounts(period, entity);
      const paid = amounts.received + amounts.receivedOverdue;
      if (amounts.expected === 0 && paid === 0 && !free.has(key)) continue;
      byMonth.set(key, { billed: amounts.expected, paid });
    }
  }
  const rows = [...byMonth.entries()].map(([key, value]) => ({ month: key, billed: structure ? 0 : value.billed, paid: structure ? value : value.paid, refund: false, free: !structure && free.has(key) && value.billed === 0 }));
  if (!structure) {
    for (const debt of priorDebts) {
      const key = String(debt.period || '').slice(0, 7);
      if (debt.entity !== entity || toNumber(debt.amount) === 0 || !/^\d{4}-\d{2}$/.test(key) || key > month) continue;
      rows.push({month: key, billed: toNumber(debt.amount), paid: 0, prior: true, reason: debt.reason || ''});
    }
    for (const refund of refunds) {
      const key = String(refund.period || '').slice(0, 7);
      if (refund.entity !== entity || toNumber(refund.amount) <= 0 || !/^\d{4}-\d{2}$/.test(key) || key > month) continue;
      rows.push({ month: key, billed: 0, paid: -toNumber(refund.amount), refund: true, reason: refund.reason || '' });
    }
    // Corrections hors encaissement du relevé : ce qui reste de `adjustment` une fois retirés le solde antérieur et
    // les remboursements, déjà sur leurs lignes. Le total du PDF tombe ainsi sur le solde du tableau.
    if (Array.isArray(statement)) {
      const listed = new Map();
      for (const debt of priorDebts) if (debt.entity === entity) listed.set(monthKey(debt.period), (listed.get(monthKey(debt.period)) || 0) + toNumber(debt.amount));
      for (const refund of refunds) if (refund.entity === entity) listed.set(monthKey(refund.period), (listed.get(monthKey(refund.period)) || 0) + toNumber(refund.amount));
      for (const m of statement) {
        const key = monthKey(m.period);
        if (!included(key, month)) continue;
        const correction = Math.round((toNumber(m.adjustment) - (listed.get(key) || 0)) * 100) / 100;
        if (correction !== 0) rows.push({ month: key, billed: correction, paid: 0, correction: true });
      }
    }
  }
  return rows.sort((a, b) => a.month.localeCompare(b.month) || Number(!!b.prior) - Number(!!a.prior) || Number(!!a.refund) - Number(!!b.refund)).map(r => ({
    periodLabel: formatMonthLabel(r.month),
    offre: r.prior ? `Solde antérieur${r.reason ? ` — ${r.reason}` : ''}` : r.refund ? `Remboursement de trop-perçu${r.reason ? ` — ${r.reason}` : ''}`
      : r.correction ? 'Correction de solde' : r.free ? FREE_MONTH_LABEL : offer,
    billed: r.billed, paid: r.paid,
  }));
}
