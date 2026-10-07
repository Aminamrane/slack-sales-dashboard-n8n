export const SALES_QUESTIONS = [
  { key:'service', title:'Compréhension de la prestation', options:['Claire','Partielle','À recadrer'] },
  { key:'roles', title:'Compréhension des rôles Owner / Opti’Lex', options:['Claire','Partielle','À recadrer'] },
  { key:'mindset', title:'État d’esprit du client', options:['Positif','Mitigé','Réservé'] },
  { key:'reliability', title:'Fiabilité / réactivité', help:'Au vu des échanges passés, quelle est la probabilité que le client réponde aux sollicitations et honore ses prochains rendez-vous ?', options:['Fiable — réactif et ponctuel','À surveiller — retards, réponses tardives ou plusieurs relances','À risque — peu réactif / rendez-vous déjà manqués'] },
  { key:'next_steps', title:'Compréhension des prochaines étapes', help:'Le client a-t-il bien compris la suite du parcours : signature des deux contrats, onboarding avec Owner et rendez-vous de lancement avec le cabinet d’avocats ?', options:['Oui, parfaitement','Partiellement','Non / à réexpliquer'] },
];
export const SALES_COLORS = ['green','orange','red'];
export const SALES_LEVELS = {favorable:'Favorable',vigilance:'Vigilance',risk:'À risque'};
export function salesAssessmentResult(answers) {
  if (!SALES_QUESTIONS.every(({key}) => SALES_COLORS.includes(answers?.[key]))) return null;
  const score = SALES_QUESTIONS.reduce((sum,{key}) => sum + ({green:1,orange:.5,red:0}[answers[key]]),0);
  return {score,level:score>=4?'favorable':score>=3?'vigilance':'risk'};
}
export const salesScore = value => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(value);
