// src/components/sequenceMail/listModel.test.js
//
// Modèle de la liste : `node --test src/components/sequenceMail/listModel.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListModel } from './listModel.js';
import { normalize } from './format.js';

const cohorts = [
  { id: 'c2', label: 'Cohorte 2', short: '2' },
  { id: 'c1', label: 'Cohorte 1', short: '1' },
];

const mail = (cohortId, kind, order, over = {}) => ({
  key: `${cohortId}::${kind}`,
  cohortId,
  kind,
  order,
  sequence: 'pre',
  phase: 'nurture',
  subject: kind,
  searchText: normalize(`${kind} ${over.body ?? ''} ${cohortId}`),
  ...over,
});

const emails = [
  mail('c1', 'email_b', 2, { phase: 'reminder', body: 'Merci d’avoir participé au webinaire' }),
  mail('c1', 'email_a', 1, { phase: 'nurture', body: 'Bonjour' }),
  mail('c1', 'email_post', 3, { sequence: 'post', phase: 'post', body: 'Le replay est disponible' }),
  mail('c2', 'email_c', 1, { phase: 'confirmation', body: 'Inscription confirmée' }),
];

const base = { emails, cohorts, cohortId: 'all', sequence: 'any', search: '', collapsed: {} };

test('vue « toutes les cohortes » : un groupe par cohorte, dans l\'ordre des cohortes, e-mails triés', () => {
  const m = buildListModel(base);
  assert.deepEqual(m.groupIds, ['c:c2', 'c:c1']);
  assert.deepEqual(m.rows.map((r) => (r.type === 'group' ? r.id : r.email.kind)), [
    'c:c2', 'email_c', 'c:c1', 'email_a', 'email_b', 'email_post',
  ]);
});

test('une cohorte : groupes par phase, dans l\'ordre des phases', () => {
  const m = buildListModel({ ...base, cohortId: 'c1', emails: emails.filter((e) => e.cohortId === 'c1') });
  assert.deepEqual(m.groupIds, ['p:c1:nurture', 'p:c1:reminder', 'p:c1:post']);
});

test('filtre par séquence', () => {
  const m = buildListModel({ ...base, sequence: 'post' });
  assert.deepEqual(m.filtered.map((e) => e.kind), ['email_post']);
});

test('recherche : tous les mots, sans accents ni casse', () => {
  assert.deepEqual(buildListModel({ ...base, search: 'INSCRIPTION confirmee' }).filtered.map((e) => e.kind), ['email_c']);
  assert.deepEqual(buildListModel({ ...base, search: 'replay webinaire' }).filtered, []);
  assert.deepEqual(buildListModel({ ...base, search: '   ' }).filtered.length, 4);
});

test('recherche : l\'apostrophe droite trouve l\'apostrophe typographique', () => {
  const m = buildListModel({ ...base, search: "d'avoir" });
  assert.deepEqual(m.filtered.map((e) => e.kind), ['email_b']);
  assert.deepEqual(m.tokens, ["d'avoir"]);
});

test('les groupes repliés cachent leurs lignes, sauf pendant une recherche', () => {
  const collapsed = { 'c:c1': true };
  const m = buildListModel({ ...base, collapsed });
  assert.deepEqual(m.rows.map((r) => (r.type === 'group' ? `${r.id}:${r.collapsed}` : r.email.kind)), [
    'c:c2:false', 'email_c', 'c:c1:true',
  ]);
  const searching = buildListModel({ ...base, collapsed, search: 'bonjour' });
  assert.equal(searching.searching, true);
  assert.deepEqual(searching.rows.map((r) => (r.type === 'group' ? r.collapsed : r.email.kind)), [false, 'email_a']);
});

test('visibleKeys : seulement les e-mails dont la ligne est affichée', () => {
  assert.deepEqual(buildListModel(base).visibleKeys, ['c2::email_c', 'c1::email_a', 'c1::email_b', 'c1::email_post']);
  const folded = buildListModel({ ...base, collapsed: { 'c:c1': true } });
  assert.deepEqual(folded.visibleKeys, ['c2::email_c']);
  assert.equal(folded.filtered.length, 4); // le filtre, lui, garde tout
});

test('le modèle n\'expose plus `groups` (code mort retiré)', () => {
  assert.equal('groups' in buildListModel(base), false);
});

test('aucun e-mail : aucune ligne', () => {
  const m = buildListModel({ ...base, emails: [] });
  assert.deepEqual(m.rows, []);
  assert.deepEqual(m.groupIds, []);
  assert.deepEqual(m.visibleKeys, []);
});
