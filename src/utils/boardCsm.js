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

// ── Attribution groupée (dev 16/11/2026) ─────────────────────────────────────────────────────────────────────
// Depuis l'étiquette « Sans CSM » : appui long sur un client = mode sélection, puis un CSM pour tous les clients
// choisis. Rien de nouveau côté serveur : chaque client part par le même PATCH /optilex/board-tracking que la fiche.

// Le mode sélection n'existe que sur « Sans CSM », pour qui a le droit d'attribuer.
export function pickModeAvailable(selectedCsm, canAssign) {
  return !!canAssign && Array.isArray(selectedCsm) && selectedCsm.includes(NO_CSM);
}

// Un client se sélectionne s'il a un numéro (contrat établi) et pas de CSM connu (même règle que matchesCsm).
export function isPickable(row, index) {
  return !!(row && row.numero_client && !(row.csm_user_id && index[row.csm_user_id]));
}

// Appui long : se déclenche après `delay` ms sans bouger de plus de `slop` pixels. Un défilement au doigt ou un
// glissé à la souris l'annule ; `end()` dit si l'appui long a eu lieu (pour ignorer le clic qui suit).
export function createLongPress({ delay = 450, slop = 8, onFire, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, origin = null, fired = false;
  const stop = () => { if (timer !== null) { clearTimer(timer); timer = null; } origin = null; };
  return {
    start(x, y) { stop(); fired = false; origin = { x, y }; timer = setTimer(() => { timer = null; origin = null; fired = true; onFire(); }, delay); },
    move(x, y) { if (origin && Math.hypot(x - origin.x, y - origin.y) > slop) stop(); },
    cancel: stop,
    end() { stop(); const was = fired; fired = false; return was; },
    get pending() { return timer !== null; },
  };
}

// Envoie les attributions par petits paquets en parallèle (un PATCH par client, comme la fiche) ; un échec n'arrête
// pas les autres. Renvoie { ok: [numéros], failed: [{ numero, error }] } dans l'ordre d'entrée.
export async function assignInBatches(patchOne, numbers, csmId, concurrency = 4) {
  const list = [...new Set(numbers)];
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const at = next++;
      try { await patchOne(list[at], csmId); results[at] = { numero: list[at], ok: true }; }
      catch (error) { results[at] = { numero: list[at], ok: false, error }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return { ok: results.filter((r) => r.ok).map((r) => r.numero), failed: results.filter((r) => !r.ok).map((r) => ({ numero: r.numero, error: r.error })) };
}

// Phrase de l'action, au singulier ou au pluriel.
export function assignLabel(count) {
  return `Attribuer à ${count} client${count > 1 ? "s" : ""}`;
}
