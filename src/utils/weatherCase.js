// tile / ink : tuile pastel et encre de la fenêtre « Faire le point sur le client » (palette du dev, 29/10/2026 :
// sauge, citron, pêche, corail, mauve).
export const WEATHER = {
  5: { label: 'Satisfait', description: 'Client satisfait, aucun signal d’alerte.', color: '#16824a', bg: '#eaf7ef', tile: '#d6ead4', ink: '#3f7f4b' },
  4: { label: 'À surveiller', description: 'Pas de mécontentement exprimé, mais présence de signaux faibles : manque de visibilité, délais, incompréhension du service ou faible perception de la valeur.', color: '#956500', bg: '#fff7df', tile: '#fef3b0', ink: '#8f6f00' },
  3: { label: 'Mécontent', description: 'Insatisfaction exprimée ou expérience dégradée.', color: '#bd5912', bg: '#fff0e4', tile: '#ffd6a5', ink: '#b45d14' },
  2: { label: 'Critique', description: 'Forte insatisfaction, perte de confiance ou risque de résiliation.', color: '#c33434', bg: '#fff0f0', tile: '#ffc1b6', ink: '#bf4436' },
  1: { label: 'Résiliation', description: 'Lettre reçue : rétention, puis sortie si la résiliation est confirmée.', color: '#85334e', bg: '#f9edf3', tile: '#e6d6e7', ink: '#86497e' },
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

export function weatherRatingLabel(score, context) {
  const presentation = weatherPresentation(score, context);
  if (!presentation) return "À noter";
  return presentation.legacy
    ? `${presentation.label} · ancienne échelle ${score}/5`
    : `${score}/5 · ${presentation.label}`;
}
