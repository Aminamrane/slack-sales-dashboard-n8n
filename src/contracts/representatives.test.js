import test from 'node:test';
import assert from 'node:assert/strict';
import { ndaRepresentatives, emptyRepresentative } from './representatives.js';
import { companyClause } from './format.js';

test('preserve a human signatory, all first names and the capacity through a holding', () => {
  const reps = ndaRepresentatives({representatives: [{full_name: 'LOUVEL Franck Christian Jean-yves', first_name: 'Franck Christian Jean-yves', last_name: 'LOUVEL', role: 'Gérant (pour HBMS)'}]});
  assert.deepEqual(reps[0], {fullName:'LOUVEL Franck Christian Jean-yves', firstName:'Franck Christian Jean-yves', lastName:'LOUVEL', role:'Gérant (pour HBMS)'});
  const clause = companyClause({company:{legalName:'BIO MED',legalForm:'SAS',siren:'908027642',rcsCity:'Brest',headOffice:{},representatives:reps}});
  assert.match(clause, /Gérant \(pour HBMS\) LOUVEL Franck Christian Jean-yves/);
});
test('an unresolved registry clears stale representatives and allows explicit manual completion', () => {
  assert.deepEqual(ndaRepresentatives({representatives:[], representative_notice:'Personne physique requise'}), []);
  assert.equal(emptyRepresentative().fullName, '');
});
test('multiple natural persons remain separate selectable candidates', () => {
  const reps=ndaRepresentatives({representatives:[{full_name:'MARTIN Camille',role:'Représentante de Holding'},{full_name:'DUPONT Alex',role:'Gérant'}]});
  assert.equal(reps.length,2);
  assert.equal(reps[0].role,'Représentante de Holding');
});
