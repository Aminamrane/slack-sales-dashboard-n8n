import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryPace, newSalesCash } from './dashboardRecovery.js';
const midMonth = new Date('2026-09-15T12:00:00Z');
test('recovery colours compare with the selected month calendar pace', () => {
  assert.equal(recoveryPace(50, 100, '2026-09', midMonth).tone, 'good');
  assert.equal(recoveryPace(37.5, 100, '2026-09', midMonth).tone, 'watch');
  assert.equal(recoveryPace(37.49, 100, '2026-09', midMonth).tone, 'behind');
  assert.equal(recoveryPace(120, 100, '2026-09', midMonth).percentage, 120);
});
test('same recovery can be on pace early and behind later in the month', () => {
  assert.equal(recoveryPace(27, 100, '2026-09', new Date('2026-09-05T12:00:00Z')).tone, 'good');
  assert.equal(recoveryPace(27, 100, '2026-09', new Date('2026-09-20T12:00:00Z')).tone, 'behind');
});
test('closed months compare with 100%, future months remain neutral', () => {
  assert.equal(recoveryPace(90, 100, '2026-08', midMonth).benchmark, 100);
  assert.equal(recoveryPace(50, 100, '2026-08', midMonth).tone, 'behind');
  assert.equal(recoveryPace(50, 100, '2026-10', midMonth).tone, 'neutral');
});
test('no expected amount or missing data does not turn a card green or red', () => {
  for (const [received,expected] of [[0,0],[10,-1],[null,100],[1,null],['invalid',100]]) {
    assert.equal(recoveryPace(received,expected,'2026-09',midMonth).tone,'neutral');
  }
  assert.equal(recoveryPace(0,100,'2026-09',midMonth).tone,'behind');
});
test('calendar benchmark uses Paris day and leap-year month lengths', () => {
  assert.equal(recoveryPace(50,100,'2026-09',new Date('2026-09-14T22:30:00Z')).benchmark,50);
  assert.equal(recoveryPace(100,100,'2024-02',new Date('2024-02-29T12:00:00Z')).benchmark,100);
  assert.equal(recoveryPace(1,100,'invalid',midMonth).tone,'neutral');
});
test('new cash combines one instalment per monthly sale with the full annual sale', () => {
  assert.equal(newSalesCash({monthly:6310.7,annual:22824}),29134.7);
  assert.equal(newSalesCash({monthly:169,annual:1500}),1669);
  assert.equal(newSalesCash({monthly:0,annual:0}),0);
  assert.equal(newSalesCash({monthly:0.1,annual:0.2}),0.3);
  assert.equal(newSalesCash({monthly:169}),null);
  assert.equal(newSalesCash(null),null);
});
