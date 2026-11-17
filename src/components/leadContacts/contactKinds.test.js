import test from 'node:test';
import assert from 'node:assert/strict';
import { canPromote, choicesOf, countOf, kindsOf, panelOf, rowsOf } from './contactKinds.js';

const data = { contacts: [
  { id: 1, kind: 'whatsapp', value: '0600000001' },
  { id: 2, kind: 'email', value: 'compta@example.test' },
  { id: 3, kind: 'phone', value: '0600000002' },
  { id: 4, kind: 'phone', value: '0100000003' },
] };

test('a whatsapp number sits under the phone field, after the phones', () => {
  assert.equal(panelOf('whatsapp'), 'phone');
  assert.equal(panelOf('phone'), 'phone');
  assert.equal(panelOf('email'), 'email');
  assert.deepEqual(kindsOf('phone'), ['phone', 'whatsapp']);
  assert.deepEqual(rowsOf(data, 'phone').map((c) => c.id), [3, 4, 1]);
  assert.deepEqual(rowsOf(data, 'email').map((c) => c.id), [2]);
  assert.equal(countOf(data, 'phone'), 3);
  assert.equal(countOf(null, 'phone'), 0);
});

test('whatsapp is offered only when the server knows it', () => {
  const before = { phone: { a_contacter: 'À contacter' }, email: { secondaire: 'Secondaire' } };
  assert.deepEqual(choicesOf(before), ['phone', 'email']);
  assert.deepEqual(choicesOf({ ...before, whatsapp: { whatsapp: 'WhatsApp' } }), ['phone', 'whatsapp', 'email']);
  assert.deepEqual(choicesOf(undefined), []);
});

test('a whatsapp number never becomes the priority contact', () => {
  assert.equal(canPromote({ kind: 'whatsapp' }), false);
  assert.equal(canPromote({ kind: 'phone' }), true);
  assert.equal(canPromote({ kind: 'email' }), true);
});
