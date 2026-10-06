import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WEATHER,QUALIFICATION_FIELDS,weatherPresentation,weatherFilter,qualificationComplete,weatherRatingLabel} from './weatherCase.js';
test('CEO scale and legacy meanings',()=>{
 assert.deepEqual([5,4,3,2,1].map(n=>WEATHER[n].label),['Satisfait','À surveiller','Mécontent','Critique','Résiliation']);
 assert.equal(weatherPresentation(4).label,'Satisfait');
 assert.equal(weatherPresentation(4,{version:2}).label,'À surveiller');
 assert.equal(weatherPresentation(1).label,'Critique');
 assert.equal(weatherFilter(4),'5');assert.equal(weatherFilter(4,{version:2}),'4');
 assert.equal(QUALIFICATION_FIELDS[2][1],'Action à envisager');
 for(const n of [1,2,3]){assert.equal(qualificationComplete(n,{reason:'a',expectation:'b',actions:' '}),false);assert.equal(qualificationComplete(n,{reason:'a',expectation:'b',actions:'c'}),true);}
 assert.equal(qualificationComplete(5,null),true);
});

test('historical ratings cannot be confused with the current scale',()=>{
 assert.equal(weatherRatingLabel(4),'Satisfait · ancienne échelle 4/5');
 assert.equal(weatherRatingLabel(4,{version:2}),'4/5 · À surveiller');
 assert.equal(weatherRatingLabel(1),'Critique · ancienne échelle 1/5');
 assert.equal(weatherRatingLabel(1,{version:2}),'1/5 · Résiliation');
 assert.equal(weatherRatingLabel(null),'À noter');
});
