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
