// Ordre unique pour Owner, Opti’Lex et Global ; ne modifie pas la réponse API.
export function orderedReceipts(items, scope = 'global') {
  const seen = new Set();
  return (items || []).filter((r) => {
    if ((scope !== 'global' && r.entity !== scope) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)
    || String(b.id).localeCompare(String(a.id)));
}
