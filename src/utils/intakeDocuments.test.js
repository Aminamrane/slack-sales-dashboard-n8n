import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntakeFile, documentStatus, hasRequiredSaleDocuments, canDeclareSale, DOCUMENT_WAIVERS } from './intakeDocuments.js';
test('document formats and sizes follow the partner contract before any upload', () => {
  for (const type of ['application/pdf','image/png','image/jpeg']) assert.doesNotThrow(()=>validateIntakeFile({name:'pièce.pdf',size:20*1024*1024,type}));
  for (const file of [{name:'x.docx',size:2,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}, {name:'x.pdf',size:0,type:'application/pdf'}, {name:'x.pdf',size:20*1024*1024+1,type:'application/pdf'}]) assert.throws(()=>validateIntakeFile(file));
});
test('upload acceptance is never presented as completed OCR or a lost failed document', () => {
  assert.equal(documentStatus({status:'waiting'}),'Enregistré · en attente de transmission');
  assert.equal(documentStatus({status:'sent',analysis:'started'}),'Transmis · analyse demandée');
  assert.equal(documentStatus({status:'sent',analysis:'started'}, {status:'completed'}),'Transmis · analysé');
  assert.equal(documentStatus({status:'sent'}, {status:'processing'}),'Transmis · analyse en cours');
  assert.equal(documentStatus({status:'sent'}, {needsReview:true}),'Transmis · classement à vérifier');
  assert.equal(documentStatus({status:'sent',analysis:'not_analyzed'}),'Transmis à la plateforme');
  assert.match(documentStatus({status:'rejected'}),/conservé dans le CRM/);
});

test('declaration requires a saved deposit, without waiting for provisioning or OCR', () => {
  for (const files of [undefined, [], [{status:'rejected'}], [{status:'unknown'}]]) assert.equal(hasRequiredSaleDocuments(files), false);
  for (const status of ['waiting','sending','sent']) assert.equal(hasRequiredSaleDocuments([{status}]), true);
});
test('a company in creation or too recent can be declared without documents, only with an explicit reason', () => {
  assert.deepEqual(DOCUMENT_WAIVERS.map(([value]) => value), ['company_in_creation', 'company_too_recent']);
  for (const waiver of ['company_in_creation', 'company_too_recent']) assert.equal(canDeclareSale([], waiver), true);
  for (const waiver of ['', null, undefined, 'autre']) assert.equal(canDeclareSale([], waiver), false);
  assert.equal(canDeclareSale([{status:'rejected'}], ''), false);
  assert.equal(canDeclareSale([{status:'waiting'}], ''), true);
});

