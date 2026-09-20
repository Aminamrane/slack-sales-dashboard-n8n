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
