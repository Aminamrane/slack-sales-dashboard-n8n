import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTORS, originDisplay, sectorMeta } from './sectors.js';

test('les onze secteurs canoniques sont connus', () => {
  assert.deepEqual(SECTORS.map((s) => s.key), [
    'micro_creche', 'ambulance', 'pharmacie', 'btp', 'restauration', 'transport',
    'service_personne', 'esn', 'immobilier', 'marchand_biens', 'commerce_artisanat',
  ]);
  assert.equal(sectorMeta('btp').label, 'BTP');
  assert.equal(sectorMeta('inconnu'), null);
});

test('cold call setter = CCS, cold call sales = CC, avec le secteur de la liste', () => {
  assert.equal(originDisplay('setter', 'micro_creche'), 'CCS · Micro-crèche');
  assert.equal(originDisplay('setter', null), 'CCS');
  assert.equal(originDisplay('cc', 'ambulance'), 'CC · Ambulance');
  assert.equal(originDisplay(' CC ', undefined), 'CC');
});

test('les autres origines restent telles quelles', () => {
  assert.equal(originDisplay('Resto Interne', 'restauration'), 'Resto Interne');
  assert.equal(originDisplay('', null), '');
  assert.equal(originDisplay(null, null), '');
});
