import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceRows,isPerformanceSalesPerson,visibleHeadcount} from './performanceSales.js';
const person = (name, extra={}) => ({name, leads_assigned:0, nbr_appel:0, r1p:0, r1r:0, r2p:0, r2r:0, nbr_signature:0, total_cash:0, total_revenue:0, ...extra});
const key = s => s.toLowerCase();
test('uses the selected channel and its sales as the conversion numerator', () => {
  const p = {ads_view:{by_person:[person('Alex', {r2p:10,r2r:5,nbr_signature:2})]}};
  const [r] = performanceRows(p,null,'ads',key);
  assert.equal(r.conv_sales,40); assert.equal(r.r2_done,5);
});
test('sales with only scheduled appointments are retained; empty rows are not', () => {
  const p = {global_view:{by_person:[person('New sales',{r1p:2}),person('Inactive')]}};
  assert.deepEqual(performanceRows(p,null,'global',key).map(r=>r.salesName),['New sales']);
});
test('unavailable calls stay marked unavailable while CRM contacts remain readable', () => {
  const p = {calls_available:false,global_view:{by_person:[person('Alex',{r1p:3})]}};
  const calls = {by_sales:[{sales:'Alex',calls_available:false,total:{appels:42,repondu:5,repondu_lead:6,r1p_self:1,r1p_s:2}}]};
  const [r] = performanceRows(p,calls,'global',key);
  assert.equal(r.calls_available,false); assert.equal(r.unique_answered,6); assert.equal(r.conv_answered_to_r1p,50);
  assert.equal(r.r1p_self+r.r1p_s,r.r1_placed);
});
test('Youcef is excluded explicitly while other admins and new sales stay visible', () => {
  const p = {global_view:{by_person:[person('Youcef Amrane',{nbr_signature:1,total_cash:100.25}),person('Alexandre Bourdin',{r1p:3}),person('David Dubois',{nbr_signature:2})]}};
  assert.deepEqual(performanceRows(p,null,'global',key).map(r=>r.salesName),['David Dubois','Alexandre Bourdin']);
  for (const name of ['Youcef Amran','Youcef Amrane','y.amrane@ownertechnology.com']) assert.equal(isPerformanceSalesPerson(name),false);
});
test('headcount totals exclude Youcef consistently with visible rows',()=>{
 const data=visibleHeadcount({by_person:[{person_name:'Youcef Amrane',leads_assigned:3,unknown:1,headcount_breakdown:{'1-2':2}},{person_name:'Alix Deslandes',leads_assigned:4,unknown:2,headcount_breakdown:{'1-2':2}}]});
 assert.equal(data.by_person.length,1);assert.equal(data.totals.leads_assigned,4);assert.equal(data.totals.unknown,2);assert.equal(data.totals.headcount_breakdown['1-2'],2);
});

test('appointment columns never take a conflicting population from the calls endpoint',()=>{
 const p={global_view:{by_person:[person('Pierre',{r1p:5,r1p_self:3,r1p_s:2,r1r:3,r1r_s:1,r2p:2,r2p_self:1,r2p_s:1})]}};
 const calls={by_sales:[{sales:'Pierre',total:{r1p_self:700,r1p_s:900,r2p_self:99}}]};
 const [r]=performanceRows(p,calls,'global',key);
 assert.equal(r.r1p_self+r.r1p_s,r.r1_placed);assert.equal(r.r1p_s,2);assert.equal(r.r2p_self+r.r2p_s,r.r2_placed);
});
test('footer and cards reconcile including setters and weighted ratios',async()=>{
 const {performanceTotals}=await import('./performanceSales.js');
 const data={cc_view:{by_person:[person('Pierre',{r1p:10,r1r:5,r1p_self:6,r1p_s:4,r1r_s:2,r1_cc_setter_done:2}),person('Audrey',{r1p:2,r1r:2,r1p_self:2,r1p_s:0})]}};
 const rows=performanceRows(data,null,'cc',key),t=performanceTotals(rows);
 assert.equal(t.r1_placed,12);assert.equal(t.r1_done,7);assert.equal(t.r1p_s,4);assert.equal(t.r1_cc_setter_done,2);assert.equal(t.closing_r1,7/12*100);
 assert.equal(performanceTotals([]).closing_r1,null);
});

test('presence is computed on past appointments only, upcoming ones no longer lower it', async () => {
 const {performanceTotals}=await import('./performanceSales.js');
 const data={global_view:{by_person:[person('Pierre',{r1p:10,r1r:4,r1_due:6,r1_done_due:3,r1_open:2,r2p:4,r2r:2,r2_due:2,r2_done_due:2})]}};
 const rows=performanceRows(data,null,'global',key),t=performanceTotals(rows);
 assert.equal(rows[0].conv_r1p_to_r1r,50); assert.equal(t.closing_r1,50); assert.equal(t.closing_r2,100); assert.equal(t.r1_open,2);
});
test('R1 on the phone is kept apart from R1 placed in the CRM', async () => {
 const {performanceTotals}=await import('./performanceSales.js');
 const rows=performanceRows({global_view:{by_person:[person('Léo',{r1p:3,r1_phone:2,r2p:4})]}},null,'global',key);
 assert.equal(rows[0].r1_placed,3); assert.equal(rows[0].r1_phone,2); assert.equal(performanceTotals(rows).r1_phone,2);
});
test('Allo calls: answer rate uses human answers, sales outside Allo are not counted as zero', async () => {
 const {performanceTotals}=await import('./performanceSales.js');
 const p={global_view:{by_person:[person('Alex',{r1p:1,leads_assigned:4}),person('Yanis',{r1p:1,leads_assigned:5}),person('Paul',{nbr_signed:1})]}};
 const calls={calls_source:'allo',by_sales:[{sales:'Alex',calls_source:'allo',calls_available:true,total:{appels:200,appels_repondus:80,repondu:30}},
   {sales:'Yanis',calls_source:'allo',calls_available:false,total:{appels:0,appels_repondus:0,repondu:12}}]};
 const rows=performanceRows(p,calls,'global',key),t=performanceTotals(rows);
 assert.equal(rows.find(r=>r.salesName==='Alex').conv_calls_to_answered,40);
 assert.equal(t.calls,200); assert.equal(t.calls_human,80); assert.equal(t.conv_calls_to_answered,40); assert.deepEqual(t.calls_missing,['Yanis']);
});
