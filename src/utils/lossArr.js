// ARR Owner perdu sur des sorties du board (dashboard CEO, cartes « ARR des
// résiliations / rétractations »). Les montants viennent de la Finance
// (/ceo-dashboard/owner-arr : part Owner facturée, annualisée). Un client sans
// montant connu ne vaut pas 0 € : il est compté à part, pour être annoncé.
export function lossArr(rows, arrByNumero) {
  let total = 0;
  let known = 0;
  for (const r of rows) {
    const value = arrByNumero?.[r.numero_client];
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value;
      known += 1;
    }
  }
  return { total, known, missing: rows.length - known };
}
