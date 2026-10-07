import { uniqueCompanies } from './companies.js';

const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});
const equal = (a, b) => canonical(a) === canonical(b);

export function intakeDraft(context) {
  return uniqueCompanies({ ...context.draft, flow_version: 2,
    companies: context.draft.companies.map(c => ({ ...c, in_registration: c.in_registration || context.source_draft?.companies.find(row => row.id === c.id)?.in_registration || false })),
    directors: context.draft.directors.map(d => ({ ...d, email: d.email || context.source_draft?.directors.find(row => row.id === d.id)?.email || '' })),
  });
}

export function isStaleIntake(error) {
  const message = error?.data?.detail || error?.message || '';
  return error?.status === 409 && typeof message === 'string'
    && /fiche a été modifiée|informations NDA ont changé/i.test(message);
}

// Companies and their director links are inseparable. Never combine two different
// scopes or silently overwrite a simultaneous edit. Non-overlapping edits survive.
export function mergeIntakeDraft(base, local, remote) {
  const draft = { ...remote }, conflicts = [];
  const fields = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  fields.delete('companies'); fields.delete('directors');
  const groups = [['companies', 'directors'], ...[...fields].map(key => [key])];
  for (const keys of groups) {
    const pick = source => Object.fromEntries(keys.map(key => [key, source[key]]));
    const before = pick(base), mine = pick(local), theirs = pick(remote);
    if (equal(mine, before) || equal(mine, theirs)) continue;
    if (equal(theirs, before)) Object.assign(draft, mine);
    else conflicts.push({ key: keys[0], local: mine, remote: theirs });
  }
  return { draft, conflicts };
}
