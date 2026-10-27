import { Rational, money } from './calculation.js';

// Read the written formula, never reverse-engineer a category from a commission.
// Formule « =base*coefficient » : sa base et son coefficient, ou null (formule libre).
export function splitCoefficient(formula) {
  const match=String(formula||'').replace(/^=/,'').replace(/\s/g,'').match(/^(.*)\*\(?([0-9]+(?:\.[0-9]+)?)\)?$/);
  return match?{baseExpression:match[1],coefficient:match[2]}:null;
}
export function calculationParts(calculator, ref) {
  const raw=String(calculator.raw(ref)||'');
  if(!raw.startsWith('='))return {kind:'amount',label:'Montant individuel',formula:raw};
  const expr=raw.slice(1).replace(/\s/g,'');
  const split=splitCoefficient(expr);
  let baseExpression,coefficient;
  if(split)({baseExpression,coefficient}=split);
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
  const channel=stored.channel || entry.originChannel || '';
  // Canal corrigé à la main : la base suit le nouveau canal (règle du serveur, entry.baseByChannel).
  const channelBase=channel!==entry.originChannel?entry.baseByChannel?.[channel]:null;
  let base=stored.base ?? parsed.base ?? '';
  if(stored.base==null&&channelBase&&calculator){
    try{base=calculator.evaluate('='+channelBase).toFixed(8).replace(/\.?0+$/,'');}catch{/* base de la formule */}
  }
  return { ...stored, channel, base, baseExpression:stored.base==null?(channelBase||parsed.baseExpression):null,
    plan:entry.plan || 'M', origin:entry.origin||'',
    originChannel:entry.originChannel||'', overridden:!!stored.channel && stored.channel!==entry.originChannel };
}
