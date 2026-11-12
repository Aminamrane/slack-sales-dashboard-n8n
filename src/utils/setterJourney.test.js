import test from 'node:test';
import assert from 'node:assert/strict';
import { setterAction, availableSelection, bookingSalesChoices, singleBookingAction, canPlanSetterR2, canRescheduleSetterR1, canRescheduleSetterR2, withDuplicateConfirmation } from './setterJourney.js';
const owned = { id: 7, assigned_to: 'a@example.com', email: 'client@example.com' };
const mine = { ...owned, created_by_setter: 'setter@example.com' };
const slot = { email: 'a@example.com', date: '2026-09-24', time: '10:30' };
test('a missed or pending R1 remains reschedulable in transverse setter views', () => {
 for (const bucket of ['r1_placed', 'confirm', 'mine', 'lapins', 'r1_late', 'to_do']) {
  for (const result of [null, 'no_show', 'rescheduled', 'cancelled']) {
   assert.equal(canRescheduleSetterR1({ ...owned, status: bucket, _setter_bucket: bucket, _lead_status: 'r1', r1: '2026-10-13T16:30:00', r1_result: result }, { isSetter: true }), true);
  }
 }
});
test('rescheduling shortcut preserves read-only, completed and later-stage restrictions', () => {
 const lead={...owned,r1:'2026-10-13T16:30:00',_setter_bucket:'r1_placed'};
 assert.equal(canRescheduleSetterR1(lead),false);
 assert.equal(canRescheduleSetterR1(lead,{isSetter:true,readOnly:true}),false);
 for (const patch of [{r1:null},{assigned_to:null},{r1_result:'done'},{r1_result:'showed_up'},{r2:'2026-10-15T10:00'},{r2_date:'2026-10-15T10:00'},{r3:'2026-10-15T10:00'},{status:'signed'},{_lead_status:'signed'},{_setter_bucket:'r2_placed'},{setter_disqualified_at:'2026-10-14'}]) {
  assert.equal(canRescheduleSetterR1({...lead,...patch},{isSetter:true}),false,JSON.stringify(patch));
 }
});
test('a missed R1 offers rescheduling without suggesting an R2', () => {
 const lead = { ...owned, status: 'r1_placed', _lead_status: 'r1', r1: '2026-10-20T10:00', r1_result: 'no_show' };
 assert.equal(canRescheduleSetterR1(lead, { isSetter: true }), true);
 assert.equal(canPlanSetterR2(lead), false);
 for (const result of [null, '', 'rescheduled', 'to_reschedule', 'a_reporter', 'cancelled']) {
  assert.equal(canPlanSetterR2({ ...lead, r1_result: result }), false, String(result));
 }
});
test('an R2 can be planned after a completed R1 only while no later appointment or signature exists', () => {
 const lead = { ...owned, status: 'r1_placed', _lead_status: 'r1', r1_result: 'done' };
 assert.equal(canPlanSetterR2(lead), true);
 assert.equal(canPlanSetterR2({ ...lead, r1_result: 'showed_up' }), true);
 assert.equal(canPlanSetterR2(null), false);
 for (const patch of [
  { r2: '2026-10-21T10:00' }, { r2_date: '2026-10-21T10:00' }, { r2_event_id: 'r2-event' },
  { r3: '2026-10-22T10:00' }, { r3_date: '2026-10-22T10:00' }, { r3_event_id: 'r3-event' },
  { status: 'r2' }, { _lead_status: 'r3' }, { _setter_bucket: 'r2_placed' },
  { status: 'signed' }, { _lead_status: 'signed' }, { signed_at: '2026-10-20T11:00' },
  { setter_disqualified_at: '2026-10-20T11:00' },
 ]) {
  assert.equal(canPlanSetterR2({ ...lead, ...patch }), false, JSON.stringify(patch));
 }
});
test('existing and setter-created leads both send the explicitly selected sales', () => {
 for (const lead of [owned,mine]) {
  const action=setterAction({lead,outcome:'r1',slot:{...slot,email:'other@example.com'}});
  assert.equal(action.body.target_sales_email,'other@example.com');
  assert.equal(action.body.r1_date,'2026-09-24T10:30');
  assert.equal(setterAction({lead,outcome:'r2',slot:{...slot,email:'other@example.com'},email:owned.email}).body.target_sales_email,'other@example.com');
 }
});
test('manual choices preserve assigned sales and a handed owner without listing the setter as sales', () => {
 const sales=[{email:'b@example.com',full_name:'B'}];
 assert.deepEqual(bookingSalesChoices(owned,sales).map(s=>s.email),['b@example.com','a@example.com']);
 assert.equal(bookingSalesChoices(owned,[...sales,{email:owned.assigned_to}]).length,2);
 assert.deepEqual(bookingSalesChoices({...mine,assigned_to:mine.created_by_setter},sales).map(s=>s.email),['b@example.com']);
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
test('a prospect without a lead yet still gets the R1 body and the prospect email (prospection list)', () => {
 const action=setterAction({lead:{},outcome:'r1',slot,email:'gerant@exemple.fr',targetCalendar:'sales'});
 assert.deepEqual(action.body,{r1_date:'2026-09-24T10:30',target_sales_email:'a@example.com',notes:undefined,target_calendar:'sales'});
 assert.equal(action.email,'gerant@exemple.fr');
 assert.equal(setterAction({lead:{},outcome:'r1',slot}).email,undefined);
});

test('R1 de l’agenda unique : aucun commercial dans la requête, email changé seulement s’il diffère', () => {
  const action = singleBookingAction({ lead: { id: 42, email: 'a@b.fr' }, slot: { date: '2026-10-08', time: '10:30' }, note: ' Rappel ', email: 'A@b.fr' });
  assert.deepEqual(action, { single: true, path: '/api/v1/tracking/setter/leads/42/book-r1', body: { r1_date: '2026-10-08T10:30', notes: 'Rappel' }, email: undefined });
  const prospect = singleBookingAction({ lead: {}, slot: { date: '2026-10-08', time: '10:30' }, email: 'x@y.fr', prospect: true });
  assert.deepEqual(prospect, { single: true, body: { r1_date: '2026-10-08T10:30', notes: undefined }, email: 'x@y.fr' });
  assert.throws(() => singleBookingAction({ lead: { id: 1 }, slot: null }), /date et une heure/);
  assert.throws(() => singleBookingAction({ lead: { id: 1 }, slot: { date: '2026-10-08', time: '10:30' }, email: 'pas-un-email' }), /email/);
});

test('R2 d’une Seconde chance par l’agenda unique : réservation book-r2, email obligatoire', () => {
  const action = singleBookingAction({ lead: { id: 42, email: 'a@b.fr' }, slot: { date: '2026-10-20', time: '14:00' }, email: 'a@b.fr', kind: 'r2' });
  assert.equal(action.path, '/api/v1/tracking/setter/leads/42/book-r2');
  assert.deepEqual(action.body, { r2_date: '2026-10-20T14:00', notes: undefined });
  assert.throws(() => singleBookingAction({ lead: { id: 42 }, slot: { date: '2026-10-20', time: '14:00' }, kind: 'r2' }), /obligatoire pour le R2/);
  assert.equal(singleBookingAction({ lead: { id: 42 }, slot: { date: '2026-10-20', time: '14:00' } }).path, '/api/v1/tracking/setter/leads/42/book-r1');
});

test('a click never confirms a dormant duplicate: only « Placer le RDV quand même » sends confirm_duplicate', () => {
  const action = { path: '/api/v1/prospection/items/7740/book-r1', body: { r1_date: '2026-10-19T17:00:00' } };
  const click = { type: 'click', target: {}, preventDefault() {} };
  assert.deepEqual(withDuplicateConfirmation(action, click), action);
  assert.deepEqual(withDuplicateConfirmation(action, undefined), action);
  assert.deepEqual(withDuplicateConfirmation(action, false), action);
  assert.equal(withDuplicateConfirmation(action, true).body.confirm_duplicate, true);
  assert.equal(withDuplicateConfirmation(action, true).body.r1_date, '2026-10-19T17:00:00');
  assert.equal(action.body.confirm_duplicate, undefined);
});

test('un setter reporte un R2 par l’agenda du commercial du lead, jamais un R2 tenu, signé ou suivi d’un R3', () => {
  const lead = { id: 9, assigned_to: 'a@example.com', r1: '2026-11-06T13:00:00', r1_result: 'done', r2: '2026-11-17T15:30:00', status: 'r2_placed', _setter_bucket: 'r2_placed', _lead_status: 'r2' };
  assert.equal(canRescheduleSetterR2(lead, { isSetter: true }), true);
  assert.equal(canRescheduleSetterR2({ ...lead, r2_result: 'no_show' }, { isSetter: true }), true);
  assert.equal(canRescheduleSetterR2(lead), false);
  assert.equal(canRescheduleSetterR2(lead, { isSetter: true, readOnly: true }), false);
  for (const patch of [{ assigned_to: '' }, { r2: null }, { r2_result: 'done' }, { r3: '2026-11-20T10:00:00' }, { signed_at: '2026-11-18T10:00:00Z' }, { setter_disqualified_at: '2026-11-10T10:00:00Z' }, { _lead_status: 'signed' }]) {
    assert.equal(canRescheduleSetterR2({ ...lead, ...patch }, { isSetter: true }), false, JSON.stringify(patch));
  }
});

// Anciens webinaires (dev 12/11/2026) : R1 posé sans commercial, affectation à la main dans Gestion des leads.
test('an old webinar lead waits for a sales only under that exact origin', async () => {
 const { isOldWebinar, awaitsSales } = await import('./setterJourney.js');
 assert.equal(isOldWebinar({ origin: ' Anciens Webinaires ' }), true);
 for (const origin of ['Webinaire 10/22', 'Ancien webinaire', 'setter', '', null]) assert.equal(isOldWebinar({ origin }), false, String(origin));
 assert.equal(awaitsSales({ origin: 'Anciens webinaires', assigned_to: null }), true);
 assert.equal(awaitsSales({ origin: 'Anciens webinaires', assigned_to: 'a@example.com' }), false);
 assert.equal(awaitsSales({ origin: 'setter', assigned_to: null }), false);
});
test('a booking without a sales says where the assignment happens', async () => {
 const { bookedMessage } = await import('./setterJourney.js');
 assert.equal(bookedMessage('r1', { manual_assignment: true, sales_email: null }), 'R1 placé. L’affectation à un commercial se fait dans Gestion des leads.');
 assert.equal(bookedMessage('r1', { sales_full_name: 'Prénom Nom' }), 'R1 placé avec Prénom Nom.');
 assert.equal(bookedMessage('r2', {}), 'R2 placé avec un commercial.');
});
test('the R1 of a waiting old webinar lead can be moved, any other lead still needs its sales', () => {
 const waiting = { id: 9, origin: 'Anciens webinaires', assigned_to: null, r1: '2026-11-20T10:00:00', _setter_bucket: 'r1_placed' };
 assert.equal(canRescheduleSetterR1(waiting, { isSetter: true }), true);
 assert.equal(canRescheduleSetterR1({ ...waiting, origin: 'setter' }, { isSetter: true }), false);
 assert.equal(canRescheduleSetterR1({ ...waiting, r1_result: 'done' }, { isSetter: true }), false);
});
test('disqualifying offers frequent reasons that pass the minimum length', async () => {
 const { disqualifyReasons } = await import('./setterJourney.js');
 assert.ok(disqualifyReasons.length >= 4);
 for (const reason of disqualifyReasons) {
  assert.deepEqual(setterAction({ lead: { id: 9 }, outcome: 'disqualify', note: reason }).body, { reason });
 }
});
