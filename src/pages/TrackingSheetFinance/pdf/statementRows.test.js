import test from 'node:test';
import assert from 'node:assert/strict';
import { statementRows } from './statementRows.js';

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
