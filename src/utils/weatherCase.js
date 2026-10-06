export const WEATHER = {
  5: { label: 'Satisfait', description: 'Client satisfait, aucun signal d’alerte.', color: '#16824a', bg: '#eaf7ef' },
  4: { label: 'À surveiller', description: 'Signaux faibles : manque de visibilité, délais ou incompréhension du service.', color: '#956500', bg: '#fff7df' },
  3: { label: 'Mécontent', description: 'Insatisfaction exprimée ou expérience dégradée.', color: '#bd5912', bg: '#fff0e4' },
  2: { label: 'Critique', description: 'Forte insatisfaction, perte de confiance ou risque de résiliation.', color: '#c33434', bg: '#fff0f0' },
  1: { label: 'Résiliation', description: 'Lettre reçue : rétention, puis sortie si la résiliation est confirmée.', color: '#85334e', bg: '#f9edf3' },
};
export const QUALIFICATION_FIELDS = [
  ['reason', 'Motif', 'Quel est le problème ?'],
  ['expectation', 'Attente client', 'Que souhaite le client ?'],
  ['actions', 'Action à envisager', 'Quelle action proposez-vous ?'],
];
export function weatherPresentation(score, context) {
  if (!score) return null;
  if (context?.version === 2) return WEATHER[score];
  return score <= 2 ? { ...WEATHER[2], legacy: true } : score === 3 ? { ...WEATHER[3], legacy: true } : { ...WEATHER[5], legacy: true };
}
export function qualificationComplete(score, form) {
  return !!score && (score > 3 || QUALIFICATION_FIELDS.every(([key]) => !!form?.[key]?.trim()));
}

export function weatherFilter(score, context) {
  if (score == null) return 'none';
  return context?.version === 2 ? String(score) : score <= 2 ? '2' : score === 3 ? '3' : '5';
}
