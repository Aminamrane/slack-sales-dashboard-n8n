import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleSections } from './sidebarPermissions.js';

const sections=[{key:'acquisition',items:[{id:'sales_recordings'},{id:'leaderboard'}]}];
for (const role of ['head_of_sales','head_of_sales_manager','ceo']) {
  test(`${role} can navigate to recordings for all teams`,()=>{
    assert.ok(getVisibleSections(sections,role)[0].items.some(item=>item.id==='sales_recordings'));
  });
}
test('ordinary sales do not acquire management recordings access',()=>{
  assert.equal(getVisibleSections(sections,'sales')[0].items.some(item=>item.id==='sales_recordings'),false);
  assert.ok(getVisibleSections(sections,'sales')[0].items.some(item=>item.id==='leaderboard'));
});
