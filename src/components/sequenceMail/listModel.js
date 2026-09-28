// src/components/sequenceMail/listModel.js
//
// Construit le modèle de la liste : filtrage (séquence, recherche plein texte), regroupement
// (par cohorte, ou par phase quand une seule cohorte est affichée) et aplatissement en lignes
// pour la liste virtualisée. Fonction pure : aucune dépendance à React.

import { normalize } from './format';
import { PHASES, phaseOrder } from './model';

const byOrder = (a, b) => a.order - b.order;

/**
 * @param emails E-mails de la portée courante (cf. useSequenceMail).
 * @param cohorts Cohortes, dans l'ordre d'affichage.
 * @param cohortId `'all'` ou l'identifiant d'une cohorte.
 * @param sequence `'any'` | `'pre'` | `'post'` | `'oneshot'`.
 * @param search Texte saisi ; chaque mot doit être présent (objet, aperçu, corps, cohorte, phase…).
 * @param collapsed `{ [idGroupe]: true }` des groupes repliés (ignoré pendant une recherche).
 */
export function buildListModel({ emails, cohorts, cohortId, sequence, search, collapsed }) {
  const tokens = normalize(search).split(/\s+/).filter(Boolean);
  const searching = tokens.length > 0;
  const filtered = emails.filter(
    (e) => (sequence === 'any' || e.sequence === sequence) && tokens.every((t) => e.searchText.includes(t))
  );

  const groups = [];
  if (cohortId === 'all') {
    const by = new Map();
    for (const e of filtered) {
      if (!by.has(e.cohortId)) by.set(e.cohortId, []);
      by.get(e.cohortId).push(e);
    }
    for (const c of cohorts) {
      const list = by.get(c.id);
      if (list?.length) groups.push({ id: `c:${c.id}`, kind: 'cohort', cohort: c, label: c.label, emails: list.sort(byOrder) });
    }
  } else {
    const by = new Map();
    for (const e of filtered) {
      if (!by.has(e.phase)) by.set(e.phase, []);
      by.get(e.phase).push(e);
    }
    for (const [phase, list] of [...by.entries()].sort((a, b) => phaseOrder(a[0]) - phaseOrder(b[0]))) {
      groups.push({ id: `p:${cohortId}:${phase}`, kind: 'phase', phase, label: PHASES[phase]?.label ?? phase, emails: list.sort(byOrder) });
    }
  }

  const rows = [];
  for (const group of groups) {
    const isCollapsed = !searching && Boolean(collapsed[group.id]);
    rows.push({ type: 'group', id: group.id, group, collapsed: isCollapsed });
    if (!isCollapsed) for (const email of group.emails) rows.push({ type: 'email', id: email.key, email, groupId: group.id });
  }
  return { tokens, searching, filtered, groups, rows, groupIds: groups.map((g) => g.id) };
}
