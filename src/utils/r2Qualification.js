const attendedResults=new Set(['done','comptable','associe','reflexion','relire_contrat','pas_decision_jour','tresorerie','pas_interesse']);
const missedResults=new Set(['no_show','reporte','annule']);
export function qualificationPatch(lead,stage,{result,attended,date,followUp},now=new Date().toISOString()){
 if(stage==='r1'){
  const allowed=attended?new Set(['done']):new Set(['no_show','rescheduled','cancelled']);
  if(!allowed.has(result))throw new Error('Choisissez un résultat pour ce rendez-vous.');
  const patch={r1_result:result,r1_completed_at:attended?(lead.r1_completed_at||now):null};
  if(followUp && !['r2_set','later','contract'].includes(followUp))throw new Error('Choisissez la prochaine étape.');
  if(followUp && !attended)throw new Error('Le R1 doit être effectué avant de choisir la suite.');
  if(result==='rescheduled'||followUp==='r2_set'){
   if(!lead.email)throw new Error('Ajoutez l’email du client avant de reprogrammer le rendez-vous.');
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date)))throw new Error('Choisissez une date et une heure valides.');
   if(followUp==='r2_set'){patch.r2_date=date;patch.r1_follow_up='r2_set';patch.status='r2';}
   else patch.r1_date=date;
  }
  return patch;
 }
 if(!['r2','r3'].includes(stage)||!(attended?attendedResults:missedResults).has(result))throw new Error('Choisissez un résultat pour ce rendez-vous.');
 const patch={[`${stage}_result`]:result,[`${stage}_completed_at`]:attended?(lead[`${stage}_completed_at`]||now):null};
 if(result==='reporte'){
  if(!lead.email)throw new Error('Ajoutez l’email du client dans son dossier avant de reprogrammer le rendez-vous.');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date)))throw new Error('Choisissez une date et une heure valides.');
  patch[`${stage}_date`]=date;
 }
 return patch;
}
