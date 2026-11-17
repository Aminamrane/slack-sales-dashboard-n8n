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
  assert.equal(notificationTarget({type:'board_mention',data:{path:'/ceo/optilex-board?client=n%C2%B01&focus=comments'}}),'/ceo/optilex-board?client=n%C2%B01&focus=comments');
  assert.equal(notificationTarget({type:'board_mention'}),'/optilex-board');
  assert.equal(notificationTarget({type:'finance_note_mention',data:{path:'/tracking-finance?client=12&onglet=echanges'}}),'/tracking-finance?client=12&onglet=echanges');
  assert.equal(notificationTarget({type:'finance_note_mention'}),'/tracking-finance');
  assert.equal(notificationTarget({type:'other'}),null);
});
test('poll and websocket duplicates never produce repeated notification previews',()=>{
  const seen=new Set();
  assert.equal(freshNotifications([{id:'old',read:false}],seen).length,1);
  assert.equal(freshNotifications([{id:'old',read:false}],seen).length,0);
  assert.equal(freshNotifications([{id:'new',read:false},{id:'read',read:true}],seen).length,1);
  assert.equal(freshNotifications([{id:'new',read:false},{id:'read',read:true}],seen).length,0);
});
test('a no-show rescheduled by a setter opens the sales tracking sheet',()=>{
  assert.equal(notificationTarget({type:'setter_rescheduled_no_show',data:{lead_id:7}}),'/tracking-sheet');
  assert.equal(notificationTarget({type:'setter_placed_r1'}),'/tracking-sheet');
});

test('un RDV repositionné par un setter depuis son agenda ouvre la sheet du commercial (27/10/2026)', () => {
  assert.equal(notificationTarget({ type: 'setter_rescheduled_rdv', data: { lead_id: 7, rdv_kind: 'r2' } }), '/tracking-sheet');
});

test('les alertes au setter derrière un RDV ouvrent sa sheet setter (15/10/2026)', () => {
  for (const type of ['setter_r1_no_show', 'setter_r2_no_show', 'setter_rdv_rescheduled', 'setter_rdv_cancelled']) {
    assert.equal(notificationTarget({ type, data: { lead_id: 7 } }), '/tracking-setter');
  }
});

test('chaque alerte client ouvre la fiche sur le board du rôle, la météo sur son échange (16/11/2026)', () => {
  const rating = { type: 'owner_rating_regression', data: { numero_client: 'n°409', meteo_id: 77 } };
  assert.equal(notificationTarget(rating, 'ceo'), '/ceo/optilex-board?client=n%C2%B0409&focus=comments&rating=77');
  assert.equal(notificationTarget(rating, 'optilex'), '/optilex-board?client=n%C2%B0409&focus=comments&rating=77');
  assert.equal(notificationTarget({ type: 'optilex_contract_alert', data: { numero_client: '930' } }, 'customer_success_manager'), '/ceo/optilex-board?client=930');
  assert.equal(notificationTarget({ type: 'optilex_client_sans_guid', data: { numero_client: '12' } }, 'finance_team'), '/optilex-board?client=12');
  assert.equal(notificationTarget({ type: 'onboarding_google_change', data: { numero_client: '5', lead_id: 3 } }, 'admin'), '/ceo/optilex-board?client=5');
  assert.equal(notificationTarget({ type: 'optilex_contract_alert', data: {} }, 'admin'), null);
  assert.equal(notificationTarget({ type: 'optilex_resiliation_alert', data: { numero_client: '41' } }, 'customer_success_manager'), '/ceo/optilex-board?client=41');
  assert.equal(notificationTarget({ type: 'optilex_client_repeche', data: { numero_client: '41' } }, 'optilex'), '/optilex-board?client=41');
});

test('une mention ouvre le commentaire exact dans la fiche (16/11/2026)', () => {
  assert.equal(notificationTarget({ type: 'board_mention', data: { path: '/ceo/optilex-board?client=n%C2%B095&focus=comments', comment_id: 812 } }),
    '/ceo/optilex-board?client=n%C2%B095&focus=comments&comment=812');
  assert.equal(notificationTarget({ type: 'board_mention', data: { comment_id: 9 } }), '/optilex-board?comment=9');
});
