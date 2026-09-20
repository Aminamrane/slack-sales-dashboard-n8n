import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceRows} from './performanceSales.js';
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
test('does not silently exclude admins or former sales who have real activity', () => {
  const p = {global_view:{by_person:[person('Youcef Amrane',{nbr_signature:1,total_cash:100.25})]}};
  assert.equal(performanceRows(p,null,'global',key)[0].cashCollected,100.25);
});
