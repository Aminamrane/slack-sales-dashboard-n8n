import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareHandoffAccess, handoffAccountAccesses, handoffAccessError} from './handoffAccess.js';

const draft = () => ({companies:[{id:'c',selected:true},{id:'x',selected:false}], directors:[
  {id:'a',name:'Camille Martin',companies:['c'],email:'camille@example.com',provisional_access:false},
  {id:'b',name:'Alex Dupont',companies:['c'],email:'alex@example.com',provisional_access:false},
  {id:'x',name:'Autre Personne',companies:['x'],email:'autre@example.com',provisional_access:true},
]});

test('seul dirigeant éligible sélectionné, aucune mutation du périmètre signé', () => {
  const d=draft();d.directors=d.directors.filter(p=>p.id!=='b');const original=structuredClone(d);
  const prepared=prepareHandoffAccess(d,true);
  assert.deepEqual(handoffAccountAccesses(prepared),[{director_id:'a',email:'camille@example.com'}]);
  assert.equal(handoffAccessError(prepared),'');assert.deepEqual(d,original);
});
test('plusieurs dirigeants imposent un choix explicite dans le périmètre', () => {
  const d=prepareHandoffAccess(draft(),true);
  assert.match(handoffAccessError(d),/Sélectionnez/);
  d.directors[1].provisional_access=true;
  assert.deepEqual(handoffAccountAccesses(d),[{director_id:'b',email:'alex@example.com'}]);
  assert.equal(handoffAccessError(d),'');
});
test('emails absents, invalides et partagés bloqués avant sauvegarde', () => {
  const d=draft();d.directors[0].provisional_access=true;
  for(const email of ['','incorrect']) {d.directors[0].email=email;assert.match(handoffAccessError(d),/email valide/);}
  d.directors[0].email='ALEX@example.com';d.directors[1].provisional_access=true;
  assert.match(handoffAccessError(d),/propre adresse/);
});
test('un dossier dont les accès sont établis ne change pas de sélection', () => {
  const d=draft();assert.equal(prepareHandoffAccess(d,false),d);
});
