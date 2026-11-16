// Lire la page sans être du métier (dev 16/11/2026 : « clarifier les choses quand un non-tech arrive, pour qu'il puisse
// comprendre la page, sans non plus qu'il voie qu'on lui simplifie trop »). Le tableau ne change pas ; deux aides discrètes :
//   - `Guide` : un panneau « Comment lire la page », ouvert d'office à la première visite puis à la demande. Le parcours
//     d'une automatisation étape par étape (qui agit à chaque étape), le sens des colonnes, celui des onglets.
//   - `Hint` : l'explication d'un en-tête ou d'un chiffre, au survol ou au clavier.
// Les définitions sont celles du logiciel Opti'Lex (AutomationBoardService, LineActivity) ; les classements gardent leur
// propre texte d'aide, servi par le logiciel.
import { useEffect, useState } from "react";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];
const SEEN = "ab-guide-seen";

// Ce qui se passe à chaque étape, et qui a la main ensuite.
const STEP_TEXT = {
  0: { who: "Point de départ", text: "La mission se fait à la main, en dehors du logiciel." },
  1: { who: "Main aux développeurs", text: "Le besoin est écrit et envoyé : les développeurs construisent une première version." },
  2: { who: "Main au juriste", text: "Une première version est livrée : un juriste du cabinet doit la tester." },
  3: { who: "Main au cabinet", text: "Le juriste l’a validée : le cabinet peut s’en servir au quotidien." },
  4: { who: "Abouti", text: "Tout ce qui pouvait être automatisé l’est." },
};

export const COLUMN_HINTS = {
  done: "Combien de fois le cabinet a réalisé ce type de mission depuis le début, puis sur les 90 derniers jours.",
  usage: "La part de ces missions vraiment passées par le logiciel depuis qu’il sait les faire. Le reste a été fait à la main.",
  messaging: "Les missions demandées par le client depuis la messagerie du logiciel, et ce qu’elles représentent.",
  classification: "Où en est l’automatisation de ce type de mission. Survolez une étiquette pour son sens exact.",
  progress: "Les étapes de l’automatisation, du cahier des charges à la version aboutie, et qui doit agir maintenant.",
};

const TABS = [
  ["Suivi des développeurs", "ce sur quoi les développeurs travaillent, et ce qui attend un juriste."],
  ["À tester par le juriste", "une version est livrée, un juriste du cabinet doit la tester."],
  ["Modification demandée", "le juriste a testé et demandé un changement : c’est aux développeurs de reprendre."],
  ["À confirmer", "le logiciel a proposé un classement que personne n’a encore relu."],
];

export function Hint({ text, children, align = "start" }) {
  return (
    <span className="ab-hint" tabIndex={0} data-align={align}>
      {children}
      <span className="ab-hint-tip" role="tooltip">{text}</span>
    </span>
  );
}

export function useGuide() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(SEEN) !== "1"; } catch { return false; } });
  useEffect(() => { if (open) { try { localStorage.setItem(SEEN, "1"); } catch { /* stockage indisponible */ } } }, [open]);
  return [open, setOpen];
}

// Le parcours : la pastille avance d'étape en étape à l'ouverture, puis reste sur la dernière.
function Journey({ steps }) {
  const reduce = useReducedMotion();
  const list = (Array.isArray(steps) ? steps : []).filter((step) => STEP_TEXT[step.value]);
  const [at, setAt] = useState(reduce ? list.length - 1 : 0);
  useEffect(() => {
    if (reduce || at >= list.length - 1) return undefined;
    const timer = setTimeout(() => setAt((value) => value + 1), at === 0 ? 650 : 520);
    return () => clearTimeout(timer);
  }, [at, list.length, reduce]);
  return (
    <ol className="ab-guide-steps" style={{ "--n": list.length }}>
      <span className="ab-guide-rail" aria-hidden="true">
        <Motion.i animate={{ width: `${(at / Math.max(1, list.length - 1)) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
      </span>
      {list.map((step, index) => (
        <li key={step.value} className={index <= at ? "is-on" : ""}>
          <span className="ab-guide-dot" aria-hidden="true">{index === at && !reduce && <Motion.i layoutId="ab-guide-now" transition={{ type: "spring", stiffness: 420, damping: 30 }} />}</span>
          <span className="ab-guide-who">{STEP_TEXT[step.value].who}</span>
          <strong>{step.label}</strong>
          <span>{STEP_TEXT[step.value].text}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Guide({ open, onClose, steps, classifications }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <Motion.section key="guide" className="ab-guide" aria-label="Comment lire la page"
          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
          <div className="ab-guide-in">
            <header className="ab-guide-head">
              <div>
                <h3>Comment lire la page</h3>
                <p>Chaque ligne est un type de mission du cabinet Opti’Lex, du plus fréquent au moins fréquent. La page dit si le logiciel sait déjà le faire, et où en est son automatisation.</p>
              </div>
              <button type="button" className="ab-guide-close" onClick={onClose} aria-label="Fermer l’aide"><X size={16} /></button>
            </header>
            <div className="ab-guide-label">Le parcours d’une automatisation</div>
            <Journey steps={steps} />
            <p className="ab-guide-after">Une fois la version approuvée, la direction du cabinet valide le process : il est alors terminé.</p>
            <div className="ab-guide-cols">
              <div>
                <div className="ab-guide-label">Les classements</div>
                <dl>
                  {(classifications || []).map((item) => <div key={item.value}><dt>{item.shortLabel}</dt><dd>{item.help}</dd></div>)}
                </dl>
              </div>
              <div>
                <div className="ab-guide-label">Les colonnes</div>
                <dl>
                  <div><dt>Réalisées</dt><dd>{COLUMN_HINTS.done}</dd></div>
                  <div><dt>Utilisation du logiciel</dt><dd>{COLUMN_HINTS.usage}</dd></div>
                  <div><dt>Messagerie</dt><dd>{COLUMN_HINTS.messaging}</dd></div>
                </dl>
              </div>
              <div>
                <div className="ab-guide-label">Les onglets de la liste</div>
                <dl>{TABS.map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text[0].toUpperCase() + text.slice(1)}</dd></div>)}</dl>
              </div>
            </div>
          </div>
        </Motion.section>
      )}
    </AnimatePresence>
  );
}
