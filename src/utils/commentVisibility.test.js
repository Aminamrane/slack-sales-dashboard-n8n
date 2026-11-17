import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canChooseVisibility, isSalesAuthored, latestSalesComment, leadCommentLink, scopeOf, sendBlocker, threadOf,
  VISIBILITY_CHOICES, visibilityBadge,
} from './commentVisibility.js';

const people = [
  { id: 'sam', name: 'Sales Exemple', role: 'sales', client_sales: true },
  { id: 'noe', name: 'Équipe Ventes', role: 'head_of_sales' },
  { id: 'flore', name: 'Finance Exemple', role: 'finance_team' },
];

test('les trois choix du board, dans l’ordre Interne / Board / Sales, chacun dit qui lira', () => {
  assert.deepEqual(VISIBILITY_CHOICES.map((c) => c.label), ['Interne', 'Board', 'Sales']);
  assert.match(scopeOf('internal'), /jamais le cabinet/);
  assert.match(scopeOf('sales'), /sales du client/);
  assert.equal(scopeOf('inconnue'), scopeOf('board'));
});

test('le choix est proposé à Owner, jamais au cabinet ni à un sales', () => {
  for (const role of ['admin', 'ceo', 'customer_success_manager', 'finance_team', 'finance_director', 'hr']) assert.equal(canChooseVisibility(role), true, role);
  for (const role of ['optilex', 'sales', 'head_of_sales', 'head_of_sales_manager', '', undefined]) assert.equal(canChooseVisibility(role), false, String(role));
});

test('badges : « Interne » et « Sales », rien pour un message du board', () => {
  assert.equal(visibilityBadge('internal').label, 'Interne');
  assert.equal(visibilityBadge('sales').label, 'Sales');
  assert.equal(visibilityBadge('board'), null);
  assert.equal(visibilityBadge(undefined), null);
});

test('un message « Sales » attend la mention d’un sales avant de partir', () => {
  assert.match(sendBlocker('sales', 'Prélèvement refusé', people), /Mentionnez le sales/);
  assert.match(sendBlocker('sales', '@Finance Exemple pour info', people), /Mentionnez le sales/);
  assert.equal(sendBlocker('sales', '@sales exemple peux-tu rappeler ?', people), '');
  assert.equal(sendBlocker('sales', 'Pour @Equipe Ventes', people), '');
  assert.equal(sendBlocker('board', '', people), '');
  assert.equal(sendBlocker('internal', 'Entre nous', people), '');
});

test('le dernier commentaire d’un sales, extrait court et nombre de commentaires du sales', () => {
  const comments = [
    { id: 1, author_role: 'sales', author_name: 'Sales Exemple', body: 'Ancien', created_at: '2026-11-10T09:00:00' },
    { id: 2, author_role: 'finance_team', author_name: 'Finance Exemple', body: 'Réponse', created_at: '2026-11-16T09:00:00' },
    { id: 3, author_role: 'sales', author_name: 'Sales Exemple', body: `Le client change de RIB ${'x'.repeat(200)}`, created_at: '2026-11-15T09:00:00Z' },
  ];
  const last = latestSalesComment(comments, 30);
  assert.equal(last.id, 3);
  assert.equal(last.count, 2);
  assert.equal(last.text.length, 30);
  assert.ok(last.text.endsWith('…'));
  assert.equal(latestSalesComment([{ id: 4, author_role: 'sales', body: '', attachments: [{}, {}], created_at: '2026-11-15' }]).text, '2 pièces jointes');
  assert.equal(latestSalesComment([{ id: 5, author_role: 'ceo', body: 'x' }]), null);
  assert.equal(isSalesAuthored({ author_role: 'head_of_sales_manager' }), true);
});

test('le lien d’une notification de sales ouvre le lead, sur le commentaire', () => {
  assert.deepEqual(leadCommentLink('?lead=501&focus=comments&comment=42'), { leadId: 501, focus: true, commentId: 42 });
  assert.deepEqual(leadCommentLink('?lead=501'), { leadId: 501, focus: false, commentId: null });
  assert.equal(leadCommentLink('?view=notifications'), null);
  assert.equal(leadCommentLink('?lead=abc'), null);
  assert.equal(leadCommentLink('?lead=-3'), null);
  assert.equal(leadCommentLink(''), null);
});

test('le fil : messages par dernière activité, réponses dans l’ordre, réponse orpheline montrée seule', () => {
  const thread = threadOf([
    { id: 1, created_at: '2026-11-10T09:00:00Z' },
    { id: 2, created_at: '2026-11-12T09:00:00Z' },
    { id: 3, parent_id: 1, created_at: '2026-11-14T09:00:00Z' },
    { id: 4, parent_id: 1, created_at: '2026-11-13T09:00:00Z' },
    { id: 5, parent_id: 99, created_at: '2026-11-11T09:00:00Z' },
  ]);
  assert.deepEqual(thread.map((c) => c.id), [1, 2, 5]);
  assert.deepEqual(thread[0].replies.map((r) => r.id), [4, 3]);
  assert.deepEqual(threadOf(undefined), []);
});
