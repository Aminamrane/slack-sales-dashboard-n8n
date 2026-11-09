export function eligibleHandoffDirectors(draft) {
  const companies = new Set((draft.companies || []).filter(c => c.selected).map(c => c.id));
  return (draft.directors || []).filter(d => d.companies?.some(id => companies.has(id)));
}

export function prepareHandoffAccess(draft, required) {
  const eligible = eligibleHandoffDirectors(draft);
  if (!required || eligible.length !== 1) return draft;
  return {...draft, directors: draft.directors.map(d => ({...d, provisional_access: d.id === eligible[0].id}))};
}

export function handoffAccountAccesses(draft) {
  return eligibleHandoffDirectors(draft).filter(d => d.provisional_access)
    .map(d => ({director_id: d.id, email: (d.email || '').trim()}));
}

export function handoffAccessError(draft) {
  const accesses = handoffAccountAccesses(draft);
  if (!accesses.length) return 'Sélectionnez au moins un dirigeant avec ouverture de compte.';
  if (accesses.some(a => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))) return 'Renseignez un email valide pour chaque accès.';
  if (new Set(accesses.map(a => a.email.toLowerCase())).size !== accesses.length) return 'Chaque dirigeant doit avoir sa propre adresse email.';
  return '';
}

// Accès provisoire déjà créé sur le portail : la case est verrouillée (pas de doublon de compte)
// et le serveur exige la même liste d'e-mails. Quand la fiche est reconstruite (NDA corrigé,
// « Reprendre le périmètre NDA », Pappers), l'accès suit le dirigeant au même e-mail, sinon
// l'unique dirigeant éligible si un seul accès est engagé. Même règle que le back
// (carry_engaged_access) ; sans elle, la case grisée et décochée bloquait le dossier.
export function carryEngagedAccess(draft, emails) {
  const engaged = new Map((emails || []).map(e => String(e || '').trim()).filter(Boolean).map(e => [e.toLowerCase(), e]));
  if (!engaged.size) return draft;
  const eligible = eligibleHandoffDirectors(draft);
  if (eligible.some(d => d.provisional_access)) return draft;
  const chosen = new Map(eligible.filter(d => engaged.has(String(d.email || '').trim().toLowerCase()))
    .map(d => [d.id, engaged.get(String(d.email).trim().toLowerCase())]));
  if (!chosen.size && engaged.size === 1 && eligible.length === 1) chosen.set(eligible[0].id, [...engaged.values()][0]);
  if (!chosen.size) return draft;
  return {...draft, directors: draft.directors.map(d => chosen.has(d.id) ? {...d, provisional_access: true, email: chosen.get(d.id)} : d)};
}
