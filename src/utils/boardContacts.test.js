import test from 'node:test';
import assert from 'node:assert/strict';
import { contactEntries, phoneKey, rankLabel, sharedEmailOptions } from './boardContacts.js';

test('french numbers compare whatever their format', () => {
  assert.equal(phoneKey('+33 6 75 82 86 69'), '0675828669');
  assert.equal(phoneKey('0033675828669'), '0675828669');
  assert.equal(phoneKey('06.75.82.86.69'), '0675828669');
});

test('the board field may hold several numbers: each one counts, finance numbers follow without duplicates', () => {
  const shared = [{ id: 1, value: '+33675828669' }, { id: 2, value: '0611223344' }, { id: 3, value: '0611223344' }];
  assert.deepEqual(contactEntries('phone', '+33298048429 - 0675828669', shared).map((e) => e.value), ['+33298048429', '0675828669', '0611223344']);
  assert.deepEqual(contactEntries('phone', null, [{ id: 4, value: '0611223344' }]).map((e) => e.value), ['0611223344']);
});

test('ranks: the board value is primary by default, a flagged primary goes first', () => {
  assert.deepEqual([0, 1, 2, 3].map(rankLabel), ['Primaire', 'Secondaire', 'Tertiaire', '4e']);
  const none = contactEntries('phone', '0675828669', [{ id: 1, value: '+33675828669' }, { id: 2, value: '0611223344' }]);
  assert.deepEqual(none.map((e) => [e.value, e.rank, e.id]), [['0675828669', 'Primaire', 1], ['0611223344', 'Secondaire', 2]]);
  const flagged = contactEntries('email', 'a@b.fr', [{ id: 3, value: 'c@d.fr', is_primary: true }, { id: 4, value: 'e@f.fr' }]);
  assert.deepEqual(flagged.map((e) => [e.value, e.rank]), [['c@d.fr', 'Primaire'], ['a@b.fr', 'Secondaire'], ['e@f.fr', 'Tertiaire']]);
  assert.deepEqual(contactEntries('phone', '', []), []);
});

test('finance emails are labelled for the email menu', () => {
  const row = { shared_contacts: { emails: [{ value: 'compta@crepes.fr', label: 'Comptable' }, { value: 'b@crepes.fr' }, { value: '' }] } };
  assert.deepEqual(sharedEmailOptions(row), [
    { email: 'compta@crepes.fr', source: 'Finance · Comptable' },
    { email: 'b@crepes.fr', source: 'Finance' },
  ]);
  assert.deepEqual(sharedEmailOptions({}), []);
});
