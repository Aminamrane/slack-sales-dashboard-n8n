import test from "node:test";
import assert from "node:assert/strict";
import {
  canSeeIntegrationPreview,
  completeness,
  freshDraft,
} from "../components/integrationPreview/model.js";

test("seul Youcef voit l’entrée privée, pas tous les administrateurs", () => {
  assert.equal(
    canSeeIntegrationPreview({
      email: "y.amrane@ownertechnology.com",
      role: "admin",
    }),
    true,
  );
  assert.equal(
    canSeeIntegrationPreview({
      email: "another@ownertechnology.com",
      role: "admin",
    }),
    false,
  );
  assert.equal(
    canSeeIntegrationPreview({
      email: "y.amrane@ownertechnology.com",
      role: "sales",
    }),
    false,
  );
});
test("un dirigeant multi-sociétés ne gonfle pas le compteur", () => {
  const d = freshDraft();
  assert.equal(completeness(d).directors.length, 2);
  d.companies[1].selected = false;
  assert.equal(completeness(d).companies.length, 2);
  assert.equal(completeness(d).directors.length, 1);
});
test("la météo est obligatoire et aucune société sans dirigeant ne passe", () => {
  const d = freshDraft();
  assert.equal(
    completeness(d).checks.every((c) => c.done),
    false,
  );
  d.weather = 4;
  assert.equal(
    completeness(d).checks.every((c) => c.done),
    true,
  );
  d.directors = [];
  assert.equal(
    completeness(d).checks.every((c) => c.done),
    false,
  );
});

import { uniqueCompanies, applyCompanyLookup, samePerson } from '../components/integrationPreview/companies.js';
test('une société multi-établissements compte une fois, sans perdre les liens dirigeants', () => {
  const draft = { companies: [
    {id:'a',name:'Paris',siren:'123 456 789',selected:false},
    {id:'b',name:'Lyon',siren:'12345678900021',selected:true},
    {id:'c',name:'Autre société',siren:'987654321',selected:true},
    {id:'d',name:'En création',siren:'',selected:true},
  ], directors:[{id:'p',name:'Camille',companies:['a','b','c']}] };
  const merged=uniqueCompanies(draft);
  assert.equal(merged.companies.length,3);
  assert.deepEqual(merged.directors[0].companies,['a','c']);
  assert.equal(merged.companies[0].selected,true);
  assert.equal(draft.companies.length,4);
});
test('Pappers enrichit la société par SIREN sans importer ses établissements', () => {
  const draft={companies:[{id:'new',name:'',siren:'123456789',selected:true},
    {id:'existing',name:'Ancien nom',siren:'123456789',selected:false}],
    directors:[{id:'p',name:'Camille Martin',companies:['new']}]};
  const data={siren:'123456789',legal_name:'Société principale',representatives:[
    {full_name:'Camille Martin',role:'Présidente'}, {full_name:'Alex Bernard',role:'Gérant'}],
    etablissements:[{siret:'12345678900021'},{siret:'12345678900013'}]};
  const merged=applyCompanyLookup(draft,'new','123456789',data,()=>'second');
  assert.equal(merged.companies.length,1);
  assert.equal(merged.companies[0].id,'existing');
  assert.equal(merged.companies[0].name,'Société principale');
  assert.equal(merged.directors.length,2);
  assert.deepEqual(merged.directors[0].companies,['existing']);
  assert.equal(applyCompanyLookup(draft,'new','987654321',data,()=>''),draft);
  assert.throws(()=>applyCompanyLookup(draft,'new','123456789',{...data,siren:'987654321'},()=>''));
});

test('le périmètre avant contrat ne demande pas le passage de relais', () => {
  const d = freshDraft();
  d.flow_version = 2;
  d.companies.forEach(c => { c.in_registration = true; });
  assert.equal(completeness(d).checks.every(c => c.done), true);
  d.companies[0].in_registration = false;
  assert.equal(completeness(d).checks[0].done, false);
  d.companies[0].siren = '123456789';
  assert.equal(completeness(d).checks.every(c => c.done), true);
  d.directors[0].provisional_access = true;
  assert.equal(completeness(d).checks[2].done, false);
  d.directors[0].email = 'camille@example.com';
  assert.equal(completeness(d).checks[2].done, true);
  d.directors[1].provisional_access = true;
  d.directors[1].email = 'CAMILLE@example.com';
  assert.equal(completeness(d).checks[2].done, false);
  d.directors[1].email = 'alex@example.com';
  assert.equal(completeness(d).checks[2].done, true);
});

test('une réponse Pappers tardive ne remplace pas une société passée en immatriculation', () => {
  const d = freshDraft();
  d.companies[0].siren = '123456789';
  d.companies[0].in_registration = true;
  assert.equal(applyCompanyLookup(d, d.companies[0].id, '123456789', {
    siren: '123456789', legal_name: 'Ancien résultat', representatives: [],
  }, () => 'unused'), d);
});


test('une société saisie à la main reste dans le périmètre choisi ; le registre complète sans décider', () => {
  const draft={companies:[{id:'a',name:'Société',siren:'123456789',selected:true}],
    directors:[{id:'p',name:'Camille Martin',companies:['a','other'],provisional_access:true,email:'camille@example.com'},
      {id:'q',name:'Alex Dupont',companies:['a']}]};
  const result=applyCompanyLookup(draft,'a','123456789',{siren:'123456789',legal_name:'Société Alex',
    representatives:[{full_name:'DUPONT Alex',first_name:'Alex',last_name:'Dupont',role:'Gérant'}]},()=> 'unused');
  assert.equal(result.companies[0].selected,true);
  assert.equal(result.companies[0].name,'Société Alex');
  assert.equal(result.directors.length,2);
  assert.deepEqual(result.directors[0].companies,['a','other']);
  assert.deepEqual(result.directors[1].companies,['a']);
  assert.equal(result.directors[0].provisional_access,true);
  assert.equal(draft.companies[0].selected,true);
});

test('l’état civil complet du registre ne crée pas un second dirigeant pour la même personne', () => {
  const draft={companies:[{id:'a',name:'Société',siren:'123456789',selected:true}],
    directors:[{id:'p',name:'MARTIN Camille',companies:['a']}]};
  const result=applyCompanyLookup(draft,'a','123456789',{siren:'123456789',legal_name:'Société Martin',
    representatives:[{full_name:'MARTIN Camille Jean Oscar',first_name:'Camille Jean Oscar',last_name:'Martin',role:'Président'},
      {full_name:'Léa Durand',first_name:'Léa',last_name:'Durand',role:'Directeur général'}]},()=> 'new');
  assert.equal(result.directors.length,2);
  assert.equal(result.directors[0].name,'MARTIN Camille');
  assert.deepEqual(result.directors[0].companies,['a']);
  assert.equal(result.directors[1].name,'Léa Durand');
  assert.equal(samePerson('MARTIN Camille','Camille Martin'),true);
  assert.equal(samePerson('Martin','MARTIN Camille'),false);
});
