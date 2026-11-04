import test from 'node:test';
import assert from 'node:assert/strict';
import { locationLabel } from './format.js';

test('une fiche affiche le code postal de son siège quand elle l\'a', () => {
  assert.equal(locationLabel({ city: 'LILLE', postal_code: '59000', location_label: 'LILLE (59)' }), 'LILLE (59000)');
  assert.equal(locationLabel({ city: 'LILLE', postal_code: null, location_label: 'LILLE (59)' }), 'LILLE (59)');
  assert.equal(locationLabel({ city: null, postal_code: null, location_label: null }), null);
});
