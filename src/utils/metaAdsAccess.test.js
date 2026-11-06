import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleSections } from './sidebarPermissions.js';

// Meta Ads ouvert aux RH (26/10) : l'onglet apparaît dans leur Acquisition. Depuis le 06/11 ils voient aussi « Gestion des
// leads » (lecture seule de la direction).
const sections=[{key:'human',items:[{id:'conges'}]},{key:'acquisition',items:[{id:'perf_sales'},{id:'meta_ads'},{id:'leads_management'}]}];
const ids=(role)=>getVisibleSections(sections,role).flatMap(s=>s.items.map(item=>item.id));
test('hr sees Meta Ads next to Perf Sales',()=>{
  assert.deepEqual(ids('hr'),['conges','perf_sales','meta_ads','leads_management']);
});
for (const role of ['sales','customer_success_manager']) {
  test(`${role} still does not see Meta Ads`,()=>{
    assert.equal(ids(role).includes('meta_ads'),false);
  });
}
