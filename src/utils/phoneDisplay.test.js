import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPhoneDisplay } from './phoneDisplay.js';

test('numéros français groupés comme le téléphone du lead', () => {
  assert.equal(formatPhoneDisplay('0600004411'), '06 00 00 44 11');
  assert.equal(formatPhoneDisplay('+33600004411'), '+33 6 00 00 44 11');
  assert.equal(formatPhoneDisplay(' 01 00 00 22 33 '), '01 00 00 22 33');
});

test('un numéro qu’on ne sait pas lire reste tel quel', () => {
  assert.equal(formatPhoneDisplay('+44 20 7946 0000'), '+44 20 7946 0000');
  assert.equal(formatPhoneDisplay('12345'), '12345');
  assert.equal(formatPhoneDisplay(null), '');
});
