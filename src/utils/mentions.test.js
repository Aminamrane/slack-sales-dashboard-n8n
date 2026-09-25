import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPeople, groupLabel, insertMention, mentionQuery, mentionedIds, notifiedSummary, splitMentions } from './mentions.js';

const people = [
  { id: 'lisa', name: 'Lisa Gentaire', email: 'l.gentaire@cabinet.test', role: 'optilex' },
  { id: 'paul', name: 'Paul Faucomprez', email: 'contact@owner.test', role: 'ceo' },
  { id: 'gaelle', name: 'Gaëlle Mahon', email: 'g.mahon@owner.test', role: 'finance_team' },
];

test('la saisie « @… » ouvre la complétion, pas une adresse e-mail ni un @ d’une autre ligne', () => {
  assert.deepEqual(mentionQuery('Bonjour @Li', 11), { start: 8, query: 'Li' });
  assert.deepEqual(mentionQuery('@', 1), { start: 0, query: '' });
  assert.equal(mentionQuery('mail contact@owner.test', 23), null);
  assert.equal(mentionQuery('@Lisa\nsuite', 11), null);
  assert.equal(mentionQuery('rien ici', 8), null);
});

test('le filtre classe par pertinence, sans accents ni casse', () => {
  assert.deepEqual(filterPeople(people, 'ga').map(p => p.id), ['gaelle']);
  assert.deepEqual(filterPeople(people, 'fauc').map(p => p.id), ['paul']);
  assert.deepEqual(filterPeople(people, '').map(p => p.id), ['gaelle', 'lisa', 'paul']);
  assert.deepEqual(filterPeople(people, 'zzz'), []);
});

test('insérer une personne remplace la requête par « @Nom Complet » suivi d’un espace', () => {
  const result = insertMention('Bonjour @Li, merci', 8, 11, people[0]);
  assert.equal(result.text, 'Bonjour @Lisa Gentaire , merci');
  assert.equal(result.caret, 8 + '@Lisa Gentaire '.length);
});

test('les personnes mentionnées sont reconnues dans le texte final, accents et casse ignorés', () => {
  assert.deepEqual(mentionedIds('Point avec @lisa gentaire et @Gaelle Mahon, pas @Inconnu', people), ['lisa', 'gaelle']);
  assert.deepEqual(mentionedIds('rien', people), []);
});

test('le rendu surligne uniquement les mentions confirmées par le serveur', () => {
  const parts = splitMentions('Vu avec @Lisa Gentaire et @Paul Faucomprez (@Inconnu)', [{ name: 'Lisa Gentaire' }, { name: 'Paul Faucomprez' }]);
  assert.deepEqual(parts, [
    { text: 'Vu avec ', mention: false }, { text: '@Lisa Gentaire', mention: true }, { text: ' et ', mention: false },
    { text: '@Paul Faucomprez', mention: true }, { text: ' (@Inconnu)', mention: false },
  ]);
  assert.deepEqual(splitMentions('sans mention', []), [{ text: 'sans mention', mention: false }]);
  assert.deepEqual(splitMentions('', [{ name: 'X' }]), [{ text: '', mention: false }]);
});

test('libellés de groupe et phrase de confirmation', () => {
  assert.equal(groupLabel('optilex'), "Opti'Lex");
  assert.equal(groupLabel('finance_director'), 'Finance');
  assert.equal(groupLabel('admin'), 'Owner');
  assert.equal(notifiedSummary({}), '');
  assert.equal(notifiedSummary({ a: { name: 'Lisa Gentaire', app: { ok: true }, email: { ok: true } } }), 'Notification envoyée à Lisa Gentaire (CRM et e-mail).');
  assert.equal(notifiedSummary({ a: { name: 'Lisa Gentaire', app: { ok: true }, email: { ok: false } }, b: { name: 'Paul Faucomprez', app: { ok: true }, email: { ok: false } } }),
    'Notification envoyée à Lisa Gentaire et Paul Faucomprez (CRM).');
  assert.match(notifiedSummary({ a: { name: 'Lisa Gentaire', app: { ok: false }, email: { ok: false } } }), /n'a pas pu partir/);
});
