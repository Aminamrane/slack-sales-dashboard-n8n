import test from 'node:test';
import assert from 'node:assert/strict';
import {notesToHtml,editorToNotes} from './salesNotes.js';
import {qualificationPatch} from './r2Qualification.js';
test('notes never render user HTML, scripts, attributes or links',()=>{
 const rendered=notesToHtml('<img src=x onerror=alert(1)>\n**<script>alert(2)</script>**\n[jump](javascript:alert(3))');
 assert.ok(!rendered.includes('<img'));assert.ok(!rendered.includes('<script'));assert.ok(!rendered.includes('<a'));
 assert.ok(rendered.includes('&lt;script&gt;'));
});
test('notes retain paragraphs, spaces, accents, headings and list formatting',()=>{
 const html=notesToHtml('## Échange\n\n**Important** et *à revoir*\n- Deux  espaces\n- Société\n1. Appeler\n2. Confirmer');
 assert.ok(html.includes('<h3>Échange</h3><div><br></div>'));
 assert.ok(html.includes('<strong>Important</strong> et <em>à revoir</em>'));
 assert.ok(html.includes('<ul><li>Deux  espaces</li><li>Société</li></ul><ol><li>Appeler</li><li>Confirmer</li></ol>'));
});
const txt=textContent=>({nodeType:3,textContent});
const el=(tagName,...childNodes)=>({nodeType:1,tagName,childNodes,children:childNodes.filter(n=>n.nodeType===1)});
test('visual editor saves portable formatted text, never raw HTML',()=>{
 const tree=el('ROOT',el('DIV',el('B',txt('Important'))),el('DIV',el('BR')),el('UL',el('LI',txt('Appeler')),el('LI',el('I',txt('Confirmer')))),el('SCRIPT',txt('bad()')));
 assert.equal(editorToNotes(tree),'**Important**\n\n- Appeler\n- *Confirmer*');
});
test('completed R2 records actual attendance and preserves its original completion date',()=>{
 assert.deepEqual(qualificationPatch({r2_completed_at:'2026-09-19T12:00:00Z'},'r2',{result:'reflexion',attended:true}),{r2_result:'reflexion',r2_completed_at:'2026-09-19T12:00:00Z'});
});
test('R3 rescheduling cannot overwrite the R2 date or mark an absent client attended',()=>{
 assert.deepEqual(qualificationPatch({email:'test@example.com'},'r3',{result:'reporte',attended:false,date:'2026-09-25T10:30'}),{r3_result:'reporte',r3_completed_at:null,r3_date:'2026-09-25T10:30'});
 assert.throws(()=>qualificationPatch({},'r2',{result:'no_show',attended:true}));
 assert.throws(()=>qualificationPatch({},'r2',{result:'reporte',attended:false,date:'2026-09-25T10:30'}));
});
test('R1 contract qualification requires attendance and keeps backend status vocabulary',()=>{
 assert.deepEqual(qualificationPatch({r1_completed_at:'2026-09-19T12:00:00Z'},'r1',{result:'done',attended:true}),{r1_result:'done',r1_completed_at:'2026-09-19T12:00:00Z'});
 assert.deepEqual(qualificationPatch({},'r1',{result:'no_show',attended:false}),{r1_result:'no_show',r1_completed_at:null});
 assert.throws(()=>qualificationPatch({},'r1',{result:'done',attended:false}));
 assert.throws(()=>qualificationPatch({},'r1',{result:'cancelled',attended:true}));
 assert.deepEqual(qualificationPatch({email:'test@example.com'},'r1',{result:'rescheduled',attended:false,date:'2026-09-25T10:30'}),{r1_result:'rescheduled',r1_completed_at:null,r1_date:'2026-09-25T10:30'});
});
test('R1 followed by R2 writes the existing scheduling payload without changing R1 date',()=>{
 const patch=qualificationPatch({email:'client@example.com',r1_completed_at:'2026-09-20T09:00:00Z'},'r1',{result:'done',attended:true,followUp:'r2_set',date:'2026-09-25T10:30'});
 assert.deepEqual(patch,{r1_result:'done',r1_completed_at:'2026-09-20T09:00:00Z',r2_date:'2026-09-25T10:30',r1_follow_up:'r2_set',status:'r2'});
 assert.throws(()=>qualificationPatch({email:'client@example.com'},'r1',{result:'done',attended:true,followUp:'r2_set',date:''}));
 assert.throws(()=>qualificationPatch({email:'client@example.com'},'r1',{result:'no_show',attended:false,followUp:'r2_set',date:'2026-09-25T10:30'}));
 const direct=qualificationPatch({},'r1',{result:'done',attended:true,followUp:'contract'});
 assert.equal(direct.r2_date,undefined);assert.equal(direct.status,undefined);
});

import {parisToday,parseFrenchDate,frenchDate,validParisAppointment} from './parisDates.js';
test('French dates reject impossible dates and keep historical wall-clock',()=>{
 assert.equal(parseFrenchDate('31/02/2026'),'');
 assert.equal(parseFrenchDate('20/09/2026'),'2026-09-20');
 assert.equal(frenchDate('2026-08-20T09:00:00+00:00'),'20/08/2026');
 assert.equal(parisToday(new Date('2026-09-20T22:30:00Z')),'2026-09-21');
});
test('Paris appointments validate independently from the browser timezone',()=>{
 assert.equal(validParisAppointment('2026-03-29T02:30'),false);
 assert.equal(validParisAppointment('2026-03-29T03:30'),true);
 assert.equal(validParisAppointment('2026-10-25T02:30'),true);
 assert.equal(validParisAppointment('2026-02-30T09:00'),false);
 assert.equal(validParisAppointment('2026-09-25T09:17'),true);
});

import {hasGuidedSalesJourney} from './guidedSalesJourney.js';
test('old contracts do not hide qualification or R2 planning for the private pilot',()=>{
 const rollout={available:true,can_manage:true,pilot_enabled:true,enabled:false};
 const lead={id:11873,assigned_to:'y.amrane@ownertechnology.com'};
 assert.equal(hasGuidedSalesJourney(rollout,lead,{required:false,ready:true}),true);
 assert.equal(hasGuidedSalesJourney(rollout,lead,undefined),true);
 assert.equal(hasGuidedSalesJourney(rollout,{...lead,assigned_to:'another@ownertechnology.com'},{required:false}),false);
 assert.equal(hasGuidedSalesJourney({...rollout,available:false},lead,{required:false}),false);
 assert.equal(hasGuidedSalesJourney({...rollout,can_manage:false},lead,{required:false}),false);
});
import {parisInstantLabel} from './parisDates.js';
test('server timestamps are shown at Paris time, appointment wall times are not concerned',()=>{
 assert.equal(parisInstantLabel('2026-09-25T15:39:52.176646+00:00'),'25/09/2026 · 17h39');
 assert.equal(parisInstantLabel('2026-09-25T17:39:52+02:00'),'25/09/2026 · 17h39');
 assert.equal(parisInstantLabel('2026-12-31T23:30:00+00:00'),'01/01/2027 · 00h30');
 assert.equal(parisInstantLabel(null),'');
 assert.equal(parisInstantLabel('junk'),'');
});
