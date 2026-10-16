// Données de l'agenda des RDV comptés (RdvAgenda.jsx) : les listes des cartes R1 et R2, et le marquage des R2 directs.

// Un R2 direct = un R2 posé sans R1 dans le CRM : il fait compter un R1 au téléphone (liste r1_phone, même lead, même
// date). Les autres R2 sont des R2 après un R1. Rien n'est modifié : c'est le comptage de la page, rendu visible.
export function agendaRows(r1, r2, phone, source = null) {
  const key = (x) => `${x.lead_id}|${String(x.date).slice(0, 16)}`;
  const direct = new Set(phone.map(key));
  return [...r1.map((x) => ({ ...x, kind: 'r1' })), ...r2.map((x) => ({ ...x, kind: direct.has(key(x)) ? 'direct' : 'r2' }))]
    .filter((x) => x.date && (!source || x.source === source))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Par sales : R1 comptés = R1 du CRM + R1 au téléphone (R2 directs) ; R2 = R2 après un R1 + R2 directs.
export function agendaPeople(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const p = m.get(r.sales) || { name: r.sales, r1: 0, r2: 0, direct: 0, done: 0, noshow: 0 };
    p[r.kind] += 1;
    if (r.status === 'Effectué') p.done += 1;
    if (r.status === 'Absent') p.noshow += 1;
    m.set(r.sales, p);
  });
  return [...m.values()].sort((a, b) => b.r1 + b.direct - (a.r1 + a.direct) || a.name.localeCompare(b.name));
}
