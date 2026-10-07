import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeDraft, isStaleIntake, mergeIntakeDraft } from './draftRecovery.js';

const base = { companies: [{id:'a',name:'Société',siren:'908027642',selected:true}],
  directors: [{id:'h',name:'HBMS',companies:['a']}], notes:'' };
const clone = value => structuredClone(value);
test('an untouched open form adopts the corrected signatory without another write', () => {
  const remote = {...clone(base),directors:[{id:'p',name:'Franck Louvel',companies:['a']}]};
  const result = mergeIntakeDraft(base,clone(base),remote);
  assert.deepEqual(result,{draft:remote,conflicts:[]});
});
test('local notes survive a remote correction of the scope', () => {
  const local = {...clone(base),notes:'À conserver'};
  const remote = {...clone(base),directors:[{id:'p',name:'Franck Louvel',companies:['a']}]};
  const result = mergeIntakeDraft(base,local,remote);
  assert.equal(result.draft.notes,local.notes);
  assert.deepEqual(result.draft.directors,remote.directors);
  assert.equal(result.conflicts.length,0);
});
test('simultaneous changes of companies and directors require an explicit scope choice', () => {
  const local = clone(base); local.companies.push({id:'b',name:'BMS',selected:true}); local.directors[0].companies.push('b');
  const remote = {...clone(base),directors:[{id:'p',name:'Franck Louvel',companies:['a']}]};
  const result = mergeIntakeDraft(base,local,remote);
  assert.equal(result.conflicts.length,1);
  assert.deepEqual(result.conflicts[0].local,{companies:local.companies,directors:local.directors});
  assert.deepEqual(result.conflicts[0].remote,{companies:remote.companies,directors:remote.directors});
  assert.deepEqual(base.directors[0].companies,['a']);
});
test('local-only additions, deletions and unchecked companies are preserved', () => {
  const local = clone(base); local.companies[0].selected=false; local.directors=[];
  assert.deepEqual(mergeIntakeDraft(base,local,base).draft,local);
});
test('identical concurrent changes and reordered object keys do not create conflicts', () => {
  const local={...clone(base),notes:'Même texte'};
  const remote={notes:'Même texte',directors:clone(base.directors),companies:clone(base.companies)};
  assert.equal(mergeIntakeDraft(base,local,remote).conflicts.length,0);
});
test('only intake revision/source conflicts trigger recovery', () => {
  assert.equal(isStaleIntake({status:409,message:'La fiche a été modifiée dans une autre fenêtre. Rouvrez-la avant de continuer.'}),true);
  assert.equal(isStaleIntake({status:409,data:{detail:'Les informations NDA ont changé. Rouvrez la fiche pour vérifier le périmètre.'}}),true);
  assert.equal(isStaleIntake({status:409,message:'Ce dossier conserve le parcours actuel.'}),false);
  assert.equal(isStaleIntake({status:403,message:'La fiche a été modifiée'}),false);
});
test('normalization preserves selected scope and source contact details', () => {
  const result=intakeDraft({draft:base,source_draft:{companies:[],directors:[{id:'h',email:'dirigeant@example.test'}]}});
  assert.equal(result.directors[0].email,'dirigeant@example.test');
  assert.equal(result.companies[0].selected,true);
  assert.equal(result.flow_version,2);
});
