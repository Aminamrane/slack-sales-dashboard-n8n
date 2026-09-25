import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneKey, phoneDisplay, sharedEmailOptions } from './boardContacts.js';

test('french numbers compare whatever their format', () => {
  assert.equal(phoneKey('+33 6 75 82 86 69'), '0675828669');
  assert.equal(phoneKey('0033675828669'), '0675828669');
  assert.equal(phoneKey('06.75.82.86.69'), '0675828669');
});

test('a phone added by finance appears after the board phones, without duplicates', () => {
  const board = '+33298048429 - 0675828669';
  const shared = [{ value: '+33675828669' }, { value: '0611223344' }, { value: '0611223344' }];
  assert.equal(phoneDisplay(board, shared), '+33298048429 - 0675828669 · 0611223344');
});

test('no board phone: finance phones are shown', () => {
  assert.equal(phoneDisplay('', [{ value: '0611223344' }]), '0611223344');
  assert.equal(phoneDisplay(null, []), '');
});

test('finance emails are labelled for the email menu', () => {
  const row = { shared_contacts: { emails: [{ value: 'compta@crepes.fr', label: 'Comptable' }, { value: 'b@crepes.fr' }, { value: '' }] } };
  assert.deepEqual(sharedEmailOptions(row), [
    { email: 'compta@crepes.fr', source: 'Finance · Comptable' },
    { email: 'b@crepes.fr', source: 'Finance' },
  ]);
  assert.deepEqual(sharedEmailOptions({}), []);
});
