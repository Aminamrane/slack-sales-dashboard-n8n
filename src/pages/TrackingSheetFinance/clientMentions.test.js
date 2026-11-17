// Lancement : `npm test` (fichier cité dans le script `test` de package.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isClientMention, numeroKey, unreadClientMentions } from './clientMentions.js';

const board = (id, numero, read = false) => ({ id, type: 'board_mention', read, data: { numero_client: numero, comment_id: 12 } });
const note = (id, data, read = false) => ({ id, type: 'finance_note_mention', read, data });

test('le numéro client se compare sous la même forme, avec ou sans « n° »', () => {
  assert.equal(numeroKey('n°691'), '691');
  assert.equal(numeroKey(' N° 691 '), '691');
  assert.equal(numeroKey(691), '691');
  assert.equal(numeroKey(null), '');
});

test('une mention du board se rattache par le numéro client', () => {
  assert.equal(isClientMention(board(1, '691'), { clientId: 40, numero: 'n°691' }), true);
  assert.equal(isClientMention(board(1, '692'), { clientId: 40, numero: '691' }), false);
  // Sans numéro d'un côté ou de l'autre, on n'affirme rien.
  assert.equal(isClientMention(board(1, null), { clientId: 40, numero: '' }), false);
  assert.equal(isClientMention(board(1, '691'), { clientId: 40, numero: null }), false);
});

test('une note interne se rattache par l’identifiant du client, avant le numéro', () => {
  assert.equal(isClientMention(note(2, { client_id: 40, numero_client: '691' }), { clientId: 40, numero: '691' }), true);
  // Deux fiches au même numéro : seule celle de la note compte.
  assert.equal(isClientMention(note(2, { client_id: 41, numero_client: '691' }), { clientId: 40, numero: '691' }), false);
  // Identifiant lu dans le lien de la fiche quand le champ manque.
  assert.equal(isClientMention(note(2, { path: '/tracking-finance?client=40&onglet=echanges' }), { clientId: 40, numero: null }), true);
  assert.equal(isClientMention(note(2, { path: '/tracking-finance?client=400&onglet=echanges' }), { clientId: 40, numero: null }), false);
  // Ni identifiant ni lien : le numéro prend le relais.
  assert.equal(isClientMention(note(2, { numero_client: '691' }), { clientId: 40, numero: '691' }), true);
});

test('les autres notifications ne comptent jamais', () => {
  assert.equal(isClientMention({ id: 3, type: 'owner_rating_regression', data: { numero_client: '691' } }, { numero: '691' }), false);
  assert.equal(isClientMention(null, { numero: '691' }), false);
});

test('seules les mentions non lues de ce client restent, sans celles lues à l’instant', () => {
  const list = [board(1, '691'), board(2, '691', true), note(3, { client_id: 40 }), board(4, '700'), note(5, { client_id: 40 })];
  assert.deepEqual(unreadClientMentions(list, { clientId: 40, numero: '691' }), [1, 3, 5]);
  assert.deepEqual(unreadClientMentions(list, { clientId: 40, numero: '691' }, new Set([3])), [1, 5]);
  assert.deepEqual(unreadClientMentions(undefined, { clientId: 40, numero: '691' }), []);
});
