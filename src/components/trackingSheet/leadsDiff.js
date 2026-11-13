// Rafraîchissement de la sheet (toutes les 30 secondes et au retour sur l'onglet) : le serveur renvoie TOUTES les
// fiches, presque toujours identiques. Chaque fiche inchangée garde l'objet déjà affiché : sa carte (mémorisée) ne
// se redessine pas. Le contenu est toujours celui du serveur.
//
// La liste rendue est TOUJOURS une nouvelle liste, comme avant : plusieurs effets de la sheet se relancent quand
// `leads` change d'identité (compteurs, place du pouce des onglets…) et comptent sur ce battement de 30 secondes.

const sameValue = (a, b) => a === b
  || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

/** Deux fiches portent-elles exactement les mêmes champs et les mêmes valeurs ? */
export function sameLead(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!(key in b) || !sameValue(a[key], b[key])) return false;
  }
  return true;
}

/** La liste du serveur (nouvelle liste), où chaque fiche inchangée reste l'objet d'avant. */
export function keepUnchangedLeads(previous, next) {
  if (!Array.isArray(previous) || previous.length === 0) return next;
  const byId = new Map(previous.map(lead => [lead.id, lead]));
  return next.map((lead) => {
    const before = byId.get(lead.id);
    return before && sameLead(before, lead) ? before : lead;
  });
}
