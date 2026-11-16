// L'explication d'un en-tête ou d'un chiffre, au survol ou au focus (dev 16/11/2026 : « clarifier les choses quand un
// non-tech arrive »). Les définitions sont celles du calcul d'Opti'Lex (AutomationBoardService, LineActivity).
export const COLUMN_HINTS = {
  done: "Combien de fois le cabinet a réalisé ce type de mission depuis le début, puis sur les 90 derniers jours.",
  usage: "La part de ces missions vraiment passées par le logiciel depuis qu’il sait les faire. Le reste a été fait à la main.",
  messaging: "Les missions demandées par le client depuis la messagerie du logiciel, et ce qu’elles représentent.",
  classification: "Où en est l’automatisation de ce type de mission. Survolez une étiquette pour son sens exact.",
  progress: "Les étapes de l’automatisation, du cahier des charges à la version aboutie, et qui doit agir maintenant.",
};

export function Hint({ text, children, align = "start" }) {
  return (
    <span className="ab-hint" tabIndex={0} data-align={align}>
      {children}
      <span className="ab-hint-tip" role="tooltip">{text}</span>
    </span>
  );
}
