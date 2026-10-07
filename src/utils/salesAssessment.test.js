import test from 'node:test';
import assert from 'node:assert/strict';
import {SALES_QUESTIONS,salesAssessmentResult,salesScore} from './salesAssessment.js';
const answers=colors=>Object.fromEntries(SALES_QUESTIONS.map(({key},i)=>[key,colors[i]]));
test('incomplete answers never display a default score',()=>{assert.equal(salesAssessmentResult({}),null);assert.equal(salesAssessmentResult(answers(['green','green','green','green'])),null);});
test('Vincent thresholds and half points',()=>{
 for(const [colors,score,level] of [[['green','green','green','green','red'],4,'favorable'],[['green','green','green','orange','red'],3.5,'vigilance'],[['green','green','green','red','red'],3,'vigilance'],[['orange','orange','orange','orange','orange'],2.5,'risk'],[['red','red','red','red','red'],0,'risk']])assert.deepEqual(salesAssessmentResult(answers(colors)),{score,level});
 assert.equal(salesScore(3.5),'3,5');
});
