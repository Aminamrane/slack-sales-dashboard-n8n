import { Rational, money } from './calculation.js';

// Read the written formula, never reverse-engineer a category from a commission.
export function calculationParts(calculator, ref) {
  const raw=String(calculator.raw(ref)||'');
  if(!raw.startsWith('='))return {kind:'amount',label:'Montant individuel',formula:raw};
  const expr=raw.slice(1).replace(/\s/g,'');
  const match=expr.match(/^(.*)\*\(?([0-9]+(?:\.[0-9]+)?)\)?$/);
  let baseExpression,coefficient;
  if(match){baseExpression=match[1];coefficient=match[2];}
  else if(/\/12$/.test(expr)){baseExpression=expr;coefficient='1';}
  else return {kind:'custom',label:'Calcul personnalisé',formula:raw};
  try {
    const base=calculator.evaluate('='+baseExpression);
    const total=base.mul(Rational.from(coefficient));
    if(total.sub(calculator.value(ref)).n!==0n)return {kind:'custom',label:'Calcul personnalisé',formula:raw};
    return {kind:'coefficient',base:base.toFixed(8).replace(/\.?0+$/,''),coefficient,formula:raw,
      label:`${money(base)} × ${coefficient.replace('.',',')}`,baseExpression};
  }catch{return {kind:'custom',label:'Calcul personnalisé',formula:raw};}
}
export function resolveDeal(source, row, stored={}, calculator) {
  const entry=source.entries?.find(e=>e.amountCell===row.amountCell)||row;
  const parsed=calculator?calculationParts(calculator,row.amountCell):{};
  return { ...stored, channel:stored.channel || entry.originChannel || '',
    base:stored.base ?? parsed.base ?? '', baseExpression:stored.base==null?parsed.baseExpression:null, plan:entry.plan || 'M', origin:entry.origin||'',
    originChannel:entry.originChannel||'', overridden:!!stored.channel && stored.channel!==entry.originChannel };
}
