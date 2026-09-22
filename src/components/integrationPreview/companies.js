// Company identity is the SIREN. A legacy SIRET points to that same company.
export const companySiren = value => {
  const digits = String(value || '').replace(/\s/g, '');
  return /^\d{9}(\d{5})?$/.test(digits) ? digits.slice(0, 9) : '';
};
export function uniqueCompanies(draft) {
  const companies = [], bySiren = new Map(), aliases = new Map();
  for (const c of draft.companies) {
    const siren = companySiren(c.siren);
    const existing = siren && bySiren.get(siren);
    if (existing) {
      existing.selected ||= c.selected;
      aliases.set(c.id, existing.id);
    } else {
      const company = { ...c, siren: siren || c.siren || '' };
      companies.push(company);
      if (siren) bySiren.set(siren, company);
    }
  }
  return { ...draft, companies, directors: draft.directors.map(d => ({ ...d,
    companies: [...new Set(d.companies.map(id => aliases.get(id) || id))],
  })) };
}
export function applyCompanyLookup(draft, id, requestedSiren, data, makeId) {
  const current = draft.companies.find(c => c.id === id);
  if (!current || current.in_registration || companySiren(current.siren) !== requestedSiren) return draft;
  if (companySiren(data.siren) !== requestedSiren || !data.legal_name?.trim()) {
    throw new Error('La société retournée ne correspond pas au SIREN demandé.');
  }
  const same = draft.companies.find(c => c.id !== id && companySiren(c.siren) === requestedSiren);
  const targetId = same?.id || id;
  const result = uniqueCompanies({ ...draft, companies: draft.companies
    .filter(c => !same || c.id !== id).map(c =>
      c.id === targetId ? { ...c, siren: requestedSiren, name: data.legal_name.trim(), selected: data.signer_linked === false ? false : c.selected || current.selected } : c),
    directors: draft.directors.map(d => ({ ...d, companies: d.companies.map(cid => cid === id ? targetId : cid) })),
  });
  // Scoped lookups rebuild registry links so an edited SIREN cannot retain the previous company’s signatory.
  const target = result.companies.find(c => c.siren === requestedSiren);
  const directors = result.directors.map(d => ({ ...d, companies: typeof data.signer_linked === "boolean" ? d.companies.filter(cid => cid !== target.id) : [...d.companies] }));
  const key = name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
  for (const rep of data.representatives || []) {
    const name = (rep.full_name || '').trim();
    if (!name) continue;
    const names = new Set([key(name)]);
    if (rep.first_name && rep.last_name) {
      names.add(key(`${rep.first_name} ${rep.last_name}`));
      names.add(key(`${rep.last_name} ${rep.first_name}`));
    }
    const existing = directors.find(d => names.has(key(d.name)));
    if (existing) {
      if (!existing.companies.includes(target.id)) existing.companies.push(target.id);
    } else if (directors.length < 40) {
      directors.push({ id: makeId(), name, role: rep.role || '', companies: [target.id] });
    }
  }
  return { ...result, directors };
}
