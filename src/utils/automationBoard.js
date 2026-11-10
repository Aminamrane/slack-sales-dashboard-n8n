// Suivi de l'automatisation des missions d'Opti'Lex (dashboard CEO) : logique pure de la page.
// Les chiffres viennent tels quels du logiciel ; ici, seulement le tri, les filtres et les libellés.

export const PERIODS = [null, 7, 30, 90];

export function periodLabel(period) {
  return period ? `${period} derniers jours` : "Depuis la mise en place";
}

export function periodHint(period) {
  return period ? `missions créées sur les ${period} derniers jours` : "missions créées depuis la mise en place du process";
}

// Texte comparé sans accent ni casse : « remuneration » trouve « Rémunération ».
export function fold(text) {
  return String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Lignes à afficher : un process et ses missions restent ensemble. Un process qui correspond montre toutes ses
// missions ; une mission qui correspond garde son process au-dessus d'elle, pour qu'on sache d'où elle vient.
export function visibleRows(rows, { query = "", classification = "", pole = "", toConfirm = false, closed = new Set() } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const needle = fold(query);
  const filtering = Boolean(needle || classification || pole || toConfirm);
  const match = (row) => (!needle || fold(row.name).includes(needle))
    && (!classification || row.classification === classification)
    && (!pole || row.pole?.group === pole)
    && (!toConfirm || row.toConfirm === true);
  const children = new Map();
  list.forEach((row) => {
    if (row.parentId != null) children.set(row.parentId, [...(children.get(row.parentId) || []), row]);
  });
  const out = [];
  list.forEach((row) => {
    if (row.parentId != null && list.some((other) => other.id === row.parentId)) return;
    const own = children.get(row.id) || [];
    const hit = match(row);
    const kept = hit ? own : own.filter(match);
    if (!hit && kept.length === 0) return;
    // Pendant une recherche, un process replié se rouvre : le résultat ne doit pas rester caché.
    const open = own.length > 0 && (filtering || !closed.has(row.id));
    out.push({ row, depth: 0, children: own.length, open, dimmed: !hit });
    if (open) kept.forEach((child) => out.push({ row: child, depth: 1, children: 0, open: false, dimmed: false }));
  });
  return out;
}

export function stepOf(steps, value) {
  const list = Array.isArray(steps) ? steps : [];
  const step = list.find((item) => item.value === value);
  return { value, label: step?.label || "", percent: step?.percent ?? 0, last: Math.max(0, list.length - 1) };
}

export function classificationOf(classifications, value) {
  return (Array.isArray(classifications) ? classifications : []).find((item) => item.value === value)
    || { value, label: "Non classée", shortLabel: "Non classée", help: "" };
}

export function countLabel(count, one, many) {
  const n = Number(count) || 0;
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

// Taille d'une pièce jointe, lisible.
export function sizeLabel(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

// Fil d'un process, réduit à un type d'évènement ; les jours vidés disparaissent.
export function filterHistory(history, filter) {
  const days = Array.isArray(history) ? history : [];
  if (!filter) return days;
  return days.map((day) => ({ ...day, items: (day.items || []).filter((item) => item.filter === filter) })).filter((day) => day.items.length > 0);
}
