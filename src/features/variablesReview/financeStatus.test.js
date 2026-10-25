import {test} from 'node:test';import assert from 'node:assert/strict';
import {financeStatus,parisDateKey,onboardingDay}from'./financeStatus.js';
import {createCalculator}from'./calculation.js';import{calculationParts,resolveDeal}from'./dealCalculation.js';
import{statementModel}from'./model.js';
test('Owner money gates payment; dates or Optilex money alone never do',()=>{
 assert.equal(financeStatus({receivedOwner:'0',receivedOptilex:100,onboardingOwner:'01/10/2026'},'2026-10-06').key,'late');
 assert.equal(financeStatus({receivedOwner:'0',onboardingOwner:'2026-10-08'},'2026-10-06').key,'upcoming');
 assert.equal(financeStatus({receivedOwner:'25',onboardingOwner:'2026-10-08'},'2026-10-06').counted,true);
 assert.equal(financeStatus(null).counted,false);assert.equal(financeStatus({receivedOwner:'0',onboardingOwner:null}).key,'unknown');
});
test('Paris calendar date and invalid dates are handled explicitly',()=>{assert.equal(parisDateKey(new Date('2026-10-05T23:00:00Z')),'2026-10-06');assert.equal(onboardingDay('31/02/2026'),null);});
test('Readable coefficient agrees exactly with the underlying formula',()=>{
 const c=createCalculator({C1:{input:'2112'},E1:{input:'=(C1/12)*(1.7)'}});assert.equal(calculationParts(c,'E1').label,'176,00 € × 1,7');
});
test('Paid and pending commissions display, only paid enters total; override preserves origin',()=>{
 const data={cells:{C1:{input:'1200'},C2:{input:'1200'},E1:{input:'=C1/12*1'},E2:{input:'=C2/12*1'},G3:{input:'Fixe'},H3:{input:'500'},M3:{input:'=H3+E1'}},entries:[{amountCell:'E1',originChannel:'WEB',plan:'M'},{amountCell:'E2',originChannel:'WEB',plan:'M'}]};
 const st={totalCell:'M3',entryRefs:['E1','E2']};const settings={acquisition:{WEB:{enabled:true,coefficient:'1'},ADS:{enabled:true,coefficient:'1.2'}},deals:{E1:{channel:'ADS'}}};
 const m=statementModel(data,st,{},settings);assert.equal(m.total.toFixed(2),'620.00');assert.equal(m.calculator.value('E2').toFixed(2),'100.00');assert.equal(data.entries[0].originChannel,'WEB');assert.equal(resolveDeal(data,data.entries[0],settings.deals.E1).overridden,true);
});
