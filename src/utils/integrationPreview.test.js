import test from 'node:test';
import assert from 'node:assert/strict';
import {canSeeIntegrationPreview,completeness,freshDraft} from '../components/integrationPreview/model.js';

test('seul Youcef voit l’entrée privée, pas tous les administrateurs',()=>{
  assert.equal(canSeeIntegrationPreview({email:'y.amrane@ownertechnology.com',role:'admin'}),true);
  assert.equal(canSeeIntegrationPreview({email:'another@ownertechnology.com',role:'admin'}),false);
  assert.equal(canSeeIntegrationPreview({email:'y.amrane@ownertechnology.com',role:'sales'}),false);
});
test('un dirigeant multi-sociétés ne gonfle pas le compteur',()=>{
  const d=freshDraft();assert.equal(completeness(d).directors.length,2);
  d.companies[1].selected=false;
  assert.equal(completeness(d).companies.length,2);assert.equal(completeness(d).directors.length,1);
});
test('la météo est obligatoire et aucune société sans dirigeant ne passe',()=>{
  const d=freshDraft();assert.equal(completeness(d).checks.every(c=>c.done),false);
  d.weather=4;assert.equal(completeness(d).checks.every(c=>c.done),true);
  d.directors=[];assert.equal(completeness(d).checks.every(c=>c.done),false);
});
