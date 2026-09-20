import React from 'react';
import { Building2, UsersRound, FileCheck2, Check } from 'lucide-react';
export default function NdaProgress({step}) {
  const current = {siren:0,dirigeants:1,form:2}[step] ?? 0;
  return <ol className="sj-nda-steps" aria-label="Étapes du NDA">{[[Building2,'Société'],[UsersRound,'Dirigeants'],[FileCheck2,'Vérification']].map(([Icon,label],index)=><li key={label} aria-current={current===index?'step':undefined} className={index<=current?'is-active':''}><span>{index<current?<Check size={19}/>:<Icon size={21}/>}</span><strong>{label}</strong></li>)}</ol>;
}
