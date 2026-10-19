import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCallClientIndex, clientsForNumber, numbersIn } from './callClients.js';

const row = (client) => ({ client });

test('un appel au +33 retrouve le client dont la fiche note le 0 national', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '412', societe: 'LA FONTAINE SANCERROISE - Julien Niez', phone: '06 12 34 56 78' }),
  ]);
  const [client] = clientsForNumber(index, '+33612345678');
  assert.deepEqual(client, { key: 'c1', name: 'LA FONTAINE SANCERROISE', numero: '412' });
  assert.equal(clientsForNumber(index, '0612345678').length, 1);
  assert.equal(clientsForNumber(index, '0033612345678').length, 1);
});

test('les contacts secondaires de la fiche comptent aussi', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '7', societe: '2CL DENTAIRE', phone: '0600000001', contact_phones: ['+33 7 98 76 54 32'] }),
  ]);
  assert.equal(clientsForNumber(index, '+33798765432')[0].numero, '7');
});

test('le nom corrigé de la société passe avant le nom historique', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '9', societe: 'Old Company - Alice NOM', company_name: 'New Company', phone: '0611223344' }),
  ]);
  assert.equal(clientsForNumber(index, '0611223344')[0].name, 'New Company');
});

test('un numéro partagé par deux fiches rend les deux clients, sans doublon', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '1', societe: 'SARL A - Paul', phone: '0611223344' }),
    row({ id: 'c2', numero_client: '2', societe: 'SARL B - Paul', contact_phones: ['0611223344', '+33611223344'] }),
    row({ id: 'c1', numero_client: '1', societe: 'SARL A - Paul', phone: '0611223344' }),
  ]);
  assert.deepEqual(clientsForNumber(index, '+33611223344').map((c) => c.numero), ['1', '2']);
});

test('un numéro inconnu, vide ou trop court n’est attribué à personne', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '1', societe: 'SARL A', phone: '0611223344' }),
    row({ id: 'c2', numero_client: '2', societe: 'SARL B', phone: '12345' }),
  ]);
  assert.deepEqual(clientsForNumber(index, '+33699999999'), []);
  assert.deepEqual(clientsForNumber(index, ''), []);
  assert.deepEqual(clientsForNumber(index, null), []);
  assert.deepEqual(clientsForNumber(index, 'Anonymous'), []);
  assert.deepEqual(clientsForNumber(index, '12345'), []);
});

test('les lignes sans client exploitable sont ignorées', () => {
  const index = buildCallClientIndex([
    null,
    {},
    row({ id: null, numero_client: null, societe: null, phone: '0611223344' }),
    row({ id: 'c3', numero_client: null, societe: 'Sans numéro', phone: '0655443322' }),
  ]);
  assert.deepEqual(clientsForNumber(index, '0611223344'), []);
  assert.deepEqual(clientsForNumber(index, '0655443322'), [{ key: 'c3', name: 'Sans numéro', numero: null }]);
  assert.deepEqual(clientsForNumber(buildCallClientIndex(null), '0611223344'), []);
});

test('un champ téléphone qui porte plusieurs numéros les rend tous retrouvables', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '10', societe: 'SARL DEUX LIGNES', phone: '+33 6 12 34 56 78 - 07 98 76 54 32' }),
    row({ id: 'c2', numero_client: '11', societe: 'SARL BARRE', phone: '01 23 45 67 89 / 06 55 44 33 22', contact_phones: ['0611000001, 0611000002'] }),
    row({ id: 'c3', numero_client: '12', societe: 'SARL COLLÉS', phone: '0699000001 0699000002' }),
  ]);
  assert.equal(clientsForNumber(index, '+33612345678')[0].numero, '10');
  assert.equal(clientsForNumber(index, '+33798765432')[0].numero, '10');
  assert.equal(clientsForNumber(index, '+33123456789')[0].numero, '11');
  assert.equal(clientsForNumber(index, '+33655443322')[0].numero, '11');
  assert.equal(clientsForNumber(index, '+33611000002')[0].numero, '11');
  assert.equal(clientsForNumber(index, '+33699000001')[0].numero, '12');
  assert.equal(clientsForNumber(index, '+33699000002')[0].numero, '12');
});

test('les écritures usuelles d’un même numéro se rejoignent', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '1', societe: 'A', phone: '+33 (0)6 12 34 56 78' }),
    row({ id: 'c2', numero_client: '2', societe: 'B', phone: '06-98-76-54-32' }),
    row({ id: 'c3', numero_client: '3', societe: 'C', phone: '7 98 76 54 33' }),
    row({ id: 'c4', numero_client: '4', societe: 'D', phone: '0033 6 11 22 33 44' }),
    row({ id: 'c5', numero_client: '5', societe: 'E', phone: '06.55.44.33.22' }),
  ]);
  assert.equal(clientsForNumber(index, '+33612345678')[0].numero, '1');
  assert.equal(clientsForNumber(index, '+33698765432')[0].numero, '2');
  assert.equal(clientsForNumber(index, '+33798765433')[0].numero, '3', '0 initial oublié');
  assert.equal(clientsForNumber(index, '+33611223344')[0].numero, '4');
  assert.equal(clientsForNumber(index, '+33655443322')[0].numero, '5');
});

test('un numéro voisin n’est jamais attribué par approximation', () => {
  const index = buildCallClientIndex([
    row({ id: 'c1', numero_client: '1', societe: 'A', phone: '0612345678 - 0798765432' }),
  ]);
  assert.deepEqual(clientsForNumber(index, '+33612345679'), []);
  assert.deepEqual(clientsForNumber(index, '+33698765432'), []);
  assert.deepEqual(clientsForNumber(index, '+4412345678'), []);
});

test('le téléphone corrigé sur le board et ses contacts partagés rejoignent la fiche du même numéro de client', () => {
  const index = buildCallClientIndex(
    [row({ id: 'c1', numero_client: '412', societe: 'LA FONTAINE SANCERROISE - Julien Niez', phone: '0612345678' })],
    [{ numero_client: '412', crm_societe: 'Autre nom du board', contact_phone: '0612345678', phone_ovr: '+33 7 11 22 33 44',
      shared_contacts: { phones: [{ value: '06 55 44 33 22', label: 'compta' }, { value: null }] } }],
  );
  for (const call of ['+33612345678', '+33711223344', '+33655443322']) {
    assert.deepEqual(clientsForNumber(index, call), [{ key: 'c1', name: 'LA FONTAINE SANCERROISE', numero: '412' }], call);
  }
});

test('un client du board sans fiche ce mois-ci, ou en attente de contrat, est retrouvé sous son nom du board', () => {
  const index = buildCallClientIndex(
    [row({ id: 'c1', numero_client: '1', societe: 'SARL A', phone: '0611223344' })],
    [
      { row_key: 'k55', numero_client: '55', crm_societe: 'ACME - Bob Martin', contact_phone: '0611000000' },
      { row_key: 'c:42', crm_societe: 'SAS Exemple', contact_name: 'Jean Exemple', contact_phone: '0622000000' },
      { row_key: 'c:42', crm_societe: 'SAS Exemple', contact_name: 'Jean Exemple', contact_phone: '0622000000' },
      { row_key: 'vide', contact_phone: '0633000000' },
      null,
    ],
  );
  assert.deepEqual(clientsForNumber(index, '+33611000000'), [{ key: 'board:k55', name: 'ACME', numero: '55' }]);
  assert.deepEqual(clientsForNumber(index, '0622000000'), [{ key: 'board:c:42', name: 'SAS Exemple', numero: null }]);
  assert.deepEqual(clientsForNumber(index, '0633000000'), [], 'ni nom ni numéro : rien à afficher');
  assert.equal(clientsForNumber(index, '0611223344')[0].numero, '1');
});

test('numbersIn sépare les numéros d’un champ libre, sans casser un numéro écrit avec des tirets', () => {
  assert.deepEqual(numbersIn('+33 6 12 34 56 78 - 07 98 76 54 32'), ['33612345678', '0798765432']);
  assert.deepEqual(numbersIn('06-12-34-56-78'), ['0612345678']);
  assert.deepEqual(numbersIn('0612345678 et 0798765432'), ['0612345678', '0798765432']);
  assert.deepEqual(numbersIn('0612345678 0798765432'), ['0612345678', '0798765432']);
  assert.deepEqual(numbersIn('12345 / abc / '), []);
  assert.deepEqual(numbersIn(null), []);
});
