// Portefeuille client (dev 13/11/2026) : chaque fiche du board peut porter un CSM attitré, posé à la main sur la
// fiche. Sa photo apparaît sur la ligne, et « Affiner » filtre par CSM : le board entier (onglets, compteurs) se
// réduit alors à ce portefeuille. La liste des CSM vient du serveur (`csms` de GET /optilex/board), jamais du code.

export const NO_CSM = "none";

// Index id -> CSM ({ id, name, avatar_url, active }).
export function csmIndex(csms) {
  const out = {};
  for (const c of csms || []) if (c && c.id) out[c.id] = c;
  return out;
}

// Une ligne est dans la sélection si son CSM y est, ou si elle n'en a pas et que « Sans CSM » est coché.
// Un CSM inconnu de la liste (compte supprimé) compte comme « sans CSM ».
export function matchesCsm(row, selected, index) {
  if (!selected || selected.length === 0) return true;
  const id = row && row.csm_user_id && index[row.csm_user_id] ? row.csm_user_id : NO_CSM;
  return selected.includes(id);
}

// Entrées du menu « CSM » : chaque CSM qui a un portefeuille ou peut en recevoir un, puis « Sans CSM ».
// Un CSM parti sans plus aucun client disparaît du menu.
export function csmMenuEntries(csms, rows) {
  const index = csmIndex(csms);
  const counts = {};
  let none = 0;
  for (const r of rows || []) {
    if (r && r.csm_user_id && index[r.csm_user_id]) counts[r.csm_user_id] = (counts[r.csm_user_id] || 0) + 1;
    else none += 1;
  }
  const entries = (csms || [])
    .filter((c) => c.active || counts[c.id])
    .map((c) => ({ key: c.id, label: c.name, count: counts[c.id] || 0, csm: c }));
  return [...entries, { key: NO_CSM, label: "Sans CSM", count: none, csm: null }];
}

// Libellé d'une étiquette de filtre actif.
export function csmTagLabel(key, index) {
  if (key === NO_CSM) return "Sans CSM";
  return (index[key] && index[key].name) || "CSM";
}

// CSM qu'on peut choisir sur une fiche : les actifs seulement.
export function assignableCsms(csms) {
  return (csms || []).filter((c) => c.active);
}

// Initiales d'un nom, repli quand la photo manque ou ne se charge pas.
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
