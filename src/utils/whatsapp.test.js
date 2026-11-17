import test from 'node:test';
import assert from 'node:assert/strict';
import { whatsappDigits, whatsappUrl } from './whatsapp.js';

test('a french national number takes the 33 country code instead of its 0', () => {
  assert.equal(whatsappDigits('06 00 00 00 01'), '33600000001');
  assert.equal(whatsappDigits('06.00.00.00.01'), '33600000001');
  assert.equal(whatsappDigits('0100000002'), '33100000002');
});

test('an international number keeps its own country code', () => {
  assert.equal(whatsappDigits('+33 6 00 00 00 01'), '33600000001');
  assert.equal(whatsappDigits('+33600000001'), '33600000001');
  assert.equal(whatsappDigits('0033 6 00 00 00 01'), '33600000001');
  assert.equal(whatsappDigits('33 6 00 00 00 01'), '33600000001');
  assert.equal(whatsappDigits('+32 470 00 00 01'), '32470000001');
  assert.equal(whatsappDigits('+1 (415) 000-0001'), '14150000001');
  assert.equal(whatsappDigits('+212 6 00 00 00 01'), '212600000001');
});

test('the national 0 kept in brackets after +33 is dropped', () => {
  assert.equal(whatsappDigits('+33 (0)6 00 00 00 01'), '33600000001');
  assert.equal(whatsappDigits('+33 06 00 00 00 01'), '33600000001');
});

test('a number that cannot be read gives no link rather than a wrong one', () => {
  for (const value of [null, undefined, '', '   ', 'pas un numéro', '06 00', '600000001', '+0600000001', '+1234567890123456']) {
    assert.equal(whatsappDigits(value), null, String(value));
    assert.equal(whatsappUrl(value), null, String(value));
  }
});

test('the link opens a chat with the international digits', () => {
  assert.equal(whatsappUrl('06 00 00 00 01'), 'https://wa.me/33600000001');
  assert.equal(whatsappUrl('+32 470 00 00 01'), 'https://wa.me/32470000001');
});
