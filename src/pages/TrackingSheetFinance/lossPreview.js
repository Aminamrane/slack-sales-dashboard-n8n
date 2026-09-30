// lossPreview.js : ce que la perte effacerait, ventilé sur les TROIS périmètres
// que la finance choisit séparément (demande dev 2026-08-28) : les créances
// antérieures, le mois en cours, le reste du contrat. Calculé sur la timeline
// déjà chargée par le panneau : le montant se voit AVANT de valider.
//
// On n'abandonne QUE ce qui reste dû : attendu moins encaissé, plancher à zéro.
// Un mois déjà soldé ne compte pas, il n'y a rien à y abandonner.
//
// Le reste du contrat s'arrête à l'échéance du contrat (`contract_end` de la
// fiche : anniversaire de la signature, glissant). Au-delà, rien n'était dû, ce
// n'est pas une perte (dev 2026-09-30, n°255 : résiliation le 10/10, jour de
// l'anniversaire, donc 1 mois restant et non 5).
//
// EXACTEMENT la même règle que le serveur : ce que l'écran annonce est ce qui
// sera écrit, au centime.

export const abandonable = (r) => {
  const eo = Number(r.expected_owner || 0);
  const ep = Number(r.expected_optilex_ttc || 0);
  const paidO = Number(r.received_owner || 0) + Number(r.received_overdue_owner || 0);
  const paidP = Number(r.received_optilex_ttc || 0)
    + Number(r.received_overdue_optilex_ttc || 0);
  return Math.max(eo - Math.max(paidO, 0), 0) + Math.max(ep - Math.max(paidP, 0), 0);
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function lossPreview(periods, { now = new Date(), contractEnd = null } = {}) {
  const curKey = monthKey(now);
  const endKey = contractEnd ? String(contractEnd).slice(0, 7) : null;
  const empty = () => ({ amount: 0, months: 0 });
  const out = { past: empty(), current: empty(), future: empty() };
  for (const r of periods || []) {
    const amount = abandonable(r);
    if (amount <= 0) continue;
    const key = String(r.period || '').slice(0, 7);
    const bucket = key < curKey ? 'past' : key === curKey ? 'current' : 'future';
    if (bucket === 'future' && endKey && key > endKey) continue;   // après l'échéance : rien n'était dû
    out[bucket].months += 1;
    out[bucket].amount += amount;
  }
  return out;
}
