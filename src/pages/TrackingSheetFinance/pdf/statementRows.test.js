import test from 'node:test';
import assert from 'node:assert/strict';
import { statementRows, statementOptions, statementRecipient, statementAllocationRows, loadStatementData } from './statementRows.js';

test('une dette antérieure enregistrée est reprise avant les règlements', () => {
  const rows=statementRows({entity:'owner',month:'2026-09',priorDebts:[{entity:'owner',period:'2026-09-01',amount:250}],
    periods:[{period:'2026-09-01',received_overdue_owner:100}]});
  assert.equal(rows.length,2);assert.match(rows[0].offre,/Solde antérieur/);
  assert.equal(rows.reduce((sum,r)=>sum+r.billed-r.paid,0),150);
});

test('un règlement uniquement sur arriérés figure dans le relevé et solde la dette', () => {
  const rows = statementRows({ entity:'owner', month:'2026-09', periods:[
    {period:'2026-08-01',expected_owner:100},
    {period:'2026-09-01',received_overdue_owner:100},
    {period:'2026-10-01',expected_owner:100},
  ] });
  assert.equal(rows.length,2);
  assert.equal(rows.reduce((sum,r)=>sum+r.billed-r.paid,0),0);
});
test('un état de société garde ses ventilations sans échéance et exclut les remboursements globaux', () => {
  const rows=statementRows({entity:'owner',month:'2026-09',structure:{id:7},splits:[
    {structure_id:'7',entity:'owner',period:'2026-09-01',amount:120},
    {structure_id:8,entity:'owner',period:'2026-09-01',amount:80},
    {structure_id:7,entity:'optilex',period:'2026-09-01',amount:30},
    {structure_id:7,entity:'owner',period:'2026-10-01',amount:10},
  ],refunds:[{entity:'owner',period:'2026-09-01',amount:50}]});
  assert.equal(rows.length,1);assert.equal(rows[0].paid,120);assert.equal(rows[0].billed,0);
});
test('les remboursements futurs ou de l’autre entité ne modifient pas le solde',()=>{
  const rows=statementRows({entity:'owner',month:'2026-09',refunds:[
    {entity:'owner',period:'2026-09-01',amount:50},
    {entity:'owner',period:'2026-10-01',amount:20},
    {entity:'optilex',period:'2026-09-01',amount:10},
  ]});
  assert.equal(rows.length,1);assert.equal(rows[0].paid,-50);
});

test('la vue globale propose chaque société pour chaque émetteur, sans les fusionner', () => {
  const structures = [{id:1,name:'Société A'}, {id:2,name:'Société B'}];
  const options = statementOptions('global', structures);
  assert.deepEqual(options.map(o => [o.entity,o.structure?.id || null]),
    [['owner',null],['owner',1],['owner',2],['optilex',null],['optilex',1],['optilex',2]]);
  assert.equal(new Set(options.map(o=>o.key)).size,6);
  assert.deepEqual(statementOptions('owner',[structures[0]]).map(o=>o.structure?.id || null),[null,1]);
  assert.equal(statementOptions('optilex',[]).length,1);
});

test('le relevé de société utilise son identité sans reprendre celle de la principale', () => {
  const client={societe:'Société principale',email:'dossier@example.test',numero_client:'n°12'};
  const profile={company_name:'Société principale',siren:'111111111',siret:'11111111100001',address_line1:'Adresse principale',postal_code:'75001',city:'Paris'};
  const recipient=statementRecipient({client,profile,structure:{id:2,name:'Société secondaire',siren:'222222222'}});
  assert.equal(recipient.company,'Société secondaire');
  assert.equal(recipient.siret,'222222222');
  assert.equal(recipient.identifierLabel,'SIREN');
  assert.equal(recipient.address,'');assert.equal(recipient.email,'');assert.equal(recipient.person,'');
  assert.equal(recipient.clientNumber,'12');
  const unnamed=statementRecipient({client,profile,structure:{id:2,name:'Sans identifiant'}});
  assert.equal(unnamed.siret,'');assert.equal(unnamed.address,'');
  const primary=statementRecipient({client,profile,structure:{id:1,name:'Société principale',siren:'111111111'}});
  assert.match(primary.address,/Adresse principale/);
  assert.equal(primary.siret,'111111111');
  const global=statementRecipient({client,profile});
  assert.equal(global.siret,'11111111100001');assert.equal(global.identifierLabel,'SIRET');
});

test('le détail global réconcilie les sociétés et l’historique non ventilé sans changer le solde', () => {
  const args={entity:'owner',month:'2026-10',periods:[
    {period:'2026-08-01',expected_owner:504,received_owner:504},
    {period:'2026-09-01',expected_owner:504,received_owner:504},
    {period:'2026-10-01',expected_owner:504},
  ],structures:[{id:1,name:'A',siren:'111111111'},{id:2,name:'B',siren:'222222222'}],splits:[
    {period:'2026-09-01',entity:'owner',structure_id:1,kind:'received',amount:336},
    {period:'2026-09-01',entity:'owner',structure_id:2,kind:'received',amount:168},
    {period:'2026-09-01',entity:'optilex',structure_id:2,kind:'received',amount:42},
    {period:'2026-11-01',entity:'owner',structure_id:2,kind:'received',amount:168},
  ]};
  const rows=statementAllocationRows(args);
  assert.deepEqual(rows.map(r=>[r.company,r.paid]),[['Non ventilé',504],['A',336],['B',168]]);
  assert.equal(rows.reduce((s,r)=>s+r.paid,0),1008);
  assert.equal(rows[2].identifier,'222222222');
  assert.deepEqual(statementRows(args),statementRows({...args,splits:[]}));
  assert.equal(statementRows(args).reduce((s,r)=>s+r.billed-r.paid,0),504);
});

test('les arriérés et les règlements ordinaires restent distincts et les écarts sont explicites', () => {
  const args={entity:'owner',month:'2026-10',periods:[{period:'2026-09-01',received_owner:100,received_overdue_owner:50}],splits:[
    {period:'2026-09-01',entity:'owner',structure_id:7,structure_name:'Ancienne société',kind:'received',amount:120},
    {period:'2026-09-01',entity:'owner',structure_id:7,kind:'overdue',amount:20},
    {period:'2026-09-01',entity:'owner',structure_id:7,kind:'refund',amount:999},
  ]};
  const rows=statementAllocationRows(args);
  assert.deepEqual(rows.map(r=>r.paid),[120,-20,20,30]);
  assert.equal(rows[1].mismatch,true);assert.equal(rows[3].unallocated,true);
  assert.equal(rows[0].company,'Ancienne société');
  assert.match(rows[2].kindLabel,/arriérés/);
  assert.equal(rows.reduce((s,r)=>s+r.paid,0),150);
  const own=statementRows({...args,structure:{id:7}});
  assert.deepEqual(own.map(r=>[r.offre,r.paid]),[['Règlement du mois',120],['Règlement d’arriérés',20]]);
});

test('la réconciliation utilise les centimes et les montants TTC de la bonne entité', () => {
  const rows=statementAllocationRows({entity:'optilex',month:'2026-09',periods:[
    {period:'2026-09-01',received_owner:100,received_optilex_ttc:0.3},
  ],splits:[
    {period:'2026-09-01',entity:'optilex',structure_id:1,amount:0.1},
    {period:'2026-09-01',entity:'optilex',structure_id:2,amount:0.2},
  ]});
  assert.equal(rows.length,2);assert.equal(rows.some(r=>r.mismatch||r.unallocated),false);
});

test('une ventilation sans échéance reste visible avec un écart, jamais un encaissement inventé', () => {
  const rows=statementAllocationRows({entity:'owner',month:'2026-09',splits:[
    {period:'2026-09-01',entity:'owner',structure_id:7,amount:80},
  ]});
  assert.deepEqual(rows.map(r=>r.paid),[80,-80]);assert.equal(rows[1].mismatch,true);
});

test('le téléchargement relit la société et toutes les ventilations, même pour le global', async () => {
  const values={timeline:{periods:[]},profile:{siren:'111111111'},splits:{items:[]},structures:{items:[{id:7,name:'Nom actualisé'}]}};
  const urls=[];
  const get=async url=>{urls.push(url);return values[url.split('/').at(-1)];};
  assert.equal((await loadStatementData(get,12,7)).structure.name,'Nom actualisé');
  assert.equal(urls.length,4);
  assert.equal((await loadStatementData(get,12)).structure,null);
  await assert.rejects(loadStatementData(get,12,999),/plus disponible/);
  await assert.rejects(loadStatementData(async url=>url.endsWith('/splits')?{}:get(url),12),/incomplètes/);
  await assert.rejects(loadStatementData(async()=>{throw new Error('réseau');},12),/réseau/);
});
