// L'explication d'un en-tête ou d'un chiffre, au survol ou au focus (dev 16/11/2026 : « clarifier les choses quand un
// non-tech arrive »). Les définitions sont celles du calcul d'Opti'Lex (AutomationBoardService, LineActivity).
export const COLUMN_HINTS = {
  done: "Combien de fois le cabinet a réalisé ce type de mission depuis le début, puis sur les 90 derniers jours.",
  usage: "La part de ces missions vraiment passées par le logiciel depuis qu’il sait les faire. Le reste a été fait à la main.",
  messaging: "Les missions demandées par le client depuis la messagerie du logiciel, et ce qu’elles représentent.",
  classification: "Où en est l’automatisation de ce type de mission. Survolez une étiquette pour son sens exact.",
  progress: "Les étapes de l’automatisation, du cahier des charges à la version aboutie, et qui doit agir maintenant.",
  software: "Ce que la mission est aujourd’hui pour le cabinet, et la part de ces missions vraiment passées par le logiciel. Survolez pour le détail.",
  state: "Où en est l’automatisation, et qui doit agir. Cliquez l’étiquette pour changer l’état ; les traits sont les étapes franchies.",
  news: "La dernière chose dite sur la mission, par les développeurs ou par le cabinet. Un point rose : le cabinet attend une réponse. « Répondre » lui écrit sans ouvrir la mission.",
  plan: "Qui porte la mission chez les développeurs, et la date visée pour la prochaine version. Un clic pour la prendre, la confier ou poser la date.",
  gesture: "Le geste du moment pour cette mission. Un clic, un mot si besoin, et c’est inscrit au parcours dans Opti’Lex.",
};

export function Hint({ text, children, align = "start" }) {
  return (
    <span className="ab-hint" tabIndex={0} data-align={align}>
      {children}
      <span className="ab-hint-tip" role="tooltip">{text}</span>
    </span>
  );
}
