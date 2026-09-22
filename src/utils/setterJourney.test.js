import test from 'node:test';
import assert from 'node:assert/strict';
import { setterAction, availableSelection, canChooseSales } from './setterJourney.js';
const owned = { id: 7, assigned_to: 'a@example.com', email: 'client@example.com' };
const mine = { ...owned, created_by_setter: 'setter@example.com' };
const slot = { email: 'a@example.com', date: '2026-09-24', time: '10:30' };
test('owned leads retain their owner; newly created leads can select a sales', () => {
 assert.equal(canChooseSales(owned, 'setter@example.com'), false);
 assert.equal(canChooseSales(mine, 'SETTER@example.com'), true);
 assert.throws(() => setterAction({lead:owned,outcome:'r1',slot:{...slot,email:'other@example.com'}}), /propriétaire/);
 const action = setterAction({lead:mine,currentEmail:'setter@example.com',outcome:'r1',slot:{...slot,email:'other@example.com'}});
 assert.equal(action.body.target_sales_email,'other@example.com');
 assert.equal(action.body.r1_date,'2026-09-24T10:30');
});
test('voicemail, callback and disqualification keep their dedicated endpoints', () => {
 assert.equal(setterAction({lead:owned,outcome:'voicemail',note:'test'}).path,'/api/v1/tracking/setter/leads/7/mark-called');
 assert.throws(() => setterAction({lead:owned,outcome:'callback'}), /rappel/);
 assert.equal(setterAction({lead:owned,outcome:'callback',callback:'2026-09-24T09:05'}).body.callback_at,'2026-09-24T09:05');
 assert.throws(() => setterAction({lead:owned,outcome:'disqualify',note:' '}), /raison/);
 assert.deepEqual(setterAction({lead:owned,outcome:'disqualify',note:' Pas adapté '}),{method:'patch',path:'/api/v1/tracking/setter/leads/7/disqualify',body:{reason:'Pas adapté'}});
});
test('R2 requires valid email and R1 keeps optional email and calendar destination', () => {
 assert.throws(() => setterAction({lead:owned,outcome:'r2',slot}), /obligatoire/);
 assert.throws(() => setterAction({lead:owned,outcome:'r2',slot,email:'wrong'}), /email/);
 assert.equal(setterAction({lead:owned,outcome:'r2',slot,email:'new@example.com'}).email,'new@example.com');
 assert.equal(setterAction({lead:owned,outcome:'r1',slot,targetCalendar:'setter'}).body.target_calendar,'setter');
});
test('a missing, unavailable or stale slot cannot be confirmed', () => {
 const data={sales:[{email:slot.email,available:true,days:[{date:slot.date,slots:[slot.time]}]}]};
 assert.equal(availableSelection(data,slot),true);
 assert.equal(availableSelection(data,{...slot,time:'15:00'}),false);
 data.sales[0].available=false;
 assert.equal(availableSelection(data,slot),false);
 assert.equal(availableSelection(null,slot),false);
});

test('manual appointments preserve exact Paris time without requiring an available slot', () => {
 const manual={...slot,date:'2026-10-04',time:'20:35'};
 assert.equal(availableSelection({sales:[]},manual),false);
 assert.equal(setterAction({lead:owned,outcome:'r1',slot:manual}).body.r1_date,'2026-10-04T20:35');
 assert.equal(setterAction({lead:owned,outcome:'r2',slot:manual,email:owned.email}).body.r2_date,'2026-10-04T20:35');
 assert.throws(()=>setterAction({lead:owned,outcome:'r1',slot:{...manual,date:'2026-02-30'}}),/heure de Paris/);
 assert.throws(()=>setterAction({lead:owned,outcome:'r1',slot:{...manual,date:'2027-03-28',time:'02:30'}}),/heure de Paris/);
});
