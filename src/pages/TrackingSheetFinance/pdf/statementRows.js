import { scopedPeriodAmounts, formatMonthLabel, toNumber } from '../constants.js';

// Un relevé retrace les mouvements de l'entité choisie jusqu'au mois d'émission.
// Aucun remboursement global n'est attribué arbitrairement à une structure.
export function statementRows({ periods = [], entity, month, offer = '', structure = null, splits = [], refunds = [], priorDebts = [] }) {
  const byMonth = new Map();
  if (structure) {
    for (const split of splits) {
      const key = String(split.period || '').slice(0, 7);
      if (String(split.structure_id) !== String(structure.id) || split.entity !== entity || !/^\d{4}-\d{2}$/.test(key) || key > month) continue;
      byMonth.set(key, (byMonth.get(key) || 0) + toNumber(split.amount));
    }
  } else {
    for (const period of periods) {
      const key = String(period.period || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key) || key > month) continue;
      const amounts = scopedPeriodAmounts(period, entity);
      const paid = amounts.received + amounts.receivedOverdue;
      if (amounts.expected === 0 && paid === 0) continue;
      byMonth.set(key, { billed: amounts.expected, paid });
    }
  }
  const rows = [...byMonth.entries()].map(([key, value]) => ({ month: key, billed: structure ? 0 : value.billed, paid: structure ? value : value.paid, refund: false }));
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
  }
  return rows.sort((a, b) => a.month.localeCompare(b.month) || Number(!!b.prior) - Number(!!a.prior) || Number(!!a.refund) - Number(!!b.refund)).map(r => ({
    periodLabel: formatMonthLabel(r.month),
    offre: r.prior ? `Solde antérieur${r.reason ? ` — ${r.reason}` : ''}` : r.refund ? `Remboursement de trop-perçu${r.reason ? ` — ${r.reason}` : ''}` : offer,
    billed: r.billed, paid: r.paid,
  }));
}
