import test from 'node:test';
import assert from 'node:assert/strict';
import {SALES_QUESTIONS,salesAssessmentResult,salesAssessmentComplete,salesScore,rankedMissions,moveMission} from './salesAssessment.js';
const answers=colors=>Object.fromEntries(SALES_QUESTIONS.map(({key},i)=>[key,colors[i]]));
test('incomplete answers never display a default score',()=>{assert.equal(salesAssessmentResult({}),null);assert.equal(salesAssessmentResult(answers(['green','green','green','green'])),null);});
test('Vincent thresholds and half points',()=>{
 for(const [colors,score,level] of [[['green','green','green','green','red'],4,'favorable'],[['green','green','green','orange','red'],3.5,'vigilance'],[['green','green','green','red','red'],3,'vigilance'],[['orange','orange','orange','orange','orange'],2.5,'risk'],[['red','red','red','red','red'],0,'risk']])assert.deepEqual(salesAssessmentResult(answers(colors)),{score,level});
 assert.equal(salesScore(3.5),'3,5');
});
test('all five answers and a non-blank mission priority are required, regardless of score',()=>{
 const complete=answers(['red','red','red','red','red']);
 for(const priority_missions of [undefined,[],[''],['  \n ']])assert.equal(salesAssessmentComplete({...complete,priority_missions}),false);
 assert.equal(salesAssessmentComplete({...complete,priority_missions:['Priorité à l’embauche']}),true);
 assert.equal(salesAssessmentComplete({priority_missions:['Priorité à l’embauche']}),false);
 assert.deepEqual(salesAssessmentResult({...complete,priority_missions:['Une mission'],vigilance_note:'Un point'}),{score:0,level:'risk'});
});

test('mission ranking preserves content, order and input while ignoring empty rows at save',()=>{
 const original=['Holding','Embauche','Rémunération'];
 assert.deepEqual(moveMission(original,1,0),['Embauche','Holding','Rémunération']);
 assert.deepEqual(moveMission(original,0,2),['Embauche','Rémunération','Holding']);
 assert.deepEqual(original,['Holding','Embauche','Rémunération']);
 assert.deepEqual(moveMission(original,0,-1),original);
 assert.deepEqual(rankedMissions(['  Embauche ', '  ', 'Holding']),['Embauche','Holding']);
 const complete=answers(['green','orange','red','green','orange']);
 assert.equal(salesAssessmentComplete({...complete,priority_missions:['  ','Embauche']}),true);
 assert.equal(salesAssessmentComplete({...complete,priority_missions:['a'.repeat(201)]}),false);
 assert.equal(salesAssessmentComplete({...complete,priority_missions:Array(21).fill('Mission')}),false);
});
