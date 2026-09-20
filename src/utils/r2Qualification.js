const attendedResults=new Set(['done','comptable','associe','reflexion','relire_contrat','pas_decision_jour','tresorerie','pas_interesse']);
const missedResults=new Set(['no_show','reporte','annule']);
export function qualificationPatch(lead,stage,{result,attended,date},now=new Date().toISOString()){
 if(!['r2','r3'].includes(stage)||!(attended?attendedResults:missedResults).has(result))throw new Error('Choisissez un résultat pour ce rendez-vous.');
 const patch={[`${stage}_result`]:result,[`${stage}_completed_at`]:attended?(lead[`${stage}_completed_at`]||now):null};
 if(result==='reporte'){
  if(!lead.email)throw new Error('Ajoutez l’email du client dans son dossier avant de reprogrammer le rendez-vous.');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date)))throw new Error('Choisissez une date et une heure valides.');
  patch[`${stage}_date`]=date;
 }
 return patch;
}
