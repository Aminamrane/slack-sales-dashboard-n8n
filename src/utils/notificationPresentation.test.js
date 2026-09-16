import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationDate,notificationTarget,notificationPlacement,freshNotifications} from './notificationPresentation.js';
test('notification dates show full Paris date and time, including day boundaries',()=>{
  assert.match(notificationDate('2026-09-15T23:10:00Z').label,/16\/09\/2026/);
  assert.match(notificationDate('2026-09-15T23:10:00Z').label,/01:10/);
  assert.equal(notificationDate('2026-09-15T23:10:00').iso,'2026-09-15T23:10:00.000Z');
  assert.equal(notificationDate('invalid').iso,undefined);
});
test('panel centres on actual islands regardless of Mes pages width and stays on screen',()=>{
  for(const nav of [{left:400,right:600,bottom:70},{left:220,right:600,bottom:70}]){
    const bell={left:608,right:680,bottom:70}; const p=notificationPlacement(nav,bell,1200,800);
    assert.equal(p.left+p.width/2,(nav.left+bell.right)/2);
  }
  const mobile=notificationPlacement({left:5,right:220,bottom:70},{left:228,right:308,bottom:70},320,700);
  assert.equal(mobile.width,296);assert.equal(mobile.left,12);assert.equal(mobile.top,82);
});
test('rating notification opens the exact client board; existing invitation routing retained',()=>{
  assert.equal(notificationTarget({type:'owner_rating_regression',data:{numero_client:278}}),'/ceo/optilex-board?client=278');
  assert.equal(notificationTarget({type:'sheet_invitation'}),'/tracking-sheet?view=notifications');
  assert.equal(notificationTarget({type:'other'}),null);
});
test('poll and websocket duplicates never produce repeated notification previews',()=>{
  const seen=new Set();
  assert.equal(freshNotifications([{id:'old',read:false}],seen).length,1);
  assert.equal(freshNotifications([{id:'old',read:false}],seen).length,0);
  assert.equal(freshNotifications([{id:'new',read:false},{id:'read',read:true}],seen).length,1);
  assert.equal(freshNotifications([{id:'new',read:false},{id:'read',read:true}],seen).length,0);
});
