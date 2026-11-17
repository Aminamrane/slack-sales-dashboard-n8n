// Menu d'état de la mission (dev 17/11/2026) : « quand on clique sur “à tester par le juriste” ou “automatisée, à valider
// par le juriste”, on doit pouvoir changer l'état et mettre l'état où ça en est ». L'étiquette devient un bouton ; il
// déplie les états du parcours, l'actuel coché. Un clic enregistre dans Opti'Lex, au nom de la personne connectée, par
// le geste qui le dit le mieux (`stateChoices`). Le mot écrit en tête part avec ; il est obligatoire pour demander une
// modification. Le cadenas, « validé par la direction », se pose dans Opti'Lex par la direction : il figure en bas,
// sans s'y faire, avec le lien.
import { useCallback, useRef, useState } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, CircleDashed, FileText, FlaskConical, Lock, Sparkles, ThumbsUp, Wrench } from "lucide-react";
import { ExternalIcon } from "./parts";
import Bubble from "./Bubble.jsx";

const ICONS = { start: CircleDashed, spec: FileText, test: FlaskConical, change: Wrench, approve: ThumbsUp, best: Sparkles };
const EASE = [0.22, 1, 0.36, 1];

export default function StateMenu({ tone, children, choices, onChoose, busy, error, locked, validated, url, label = "Changer l’état de la mission" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState("");
  const button = useRef(null);
  const reduce = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);

  const choose = async (choice) => {
    const text = note.trim();
    if (choice.needsNote && !text) { setMissing("Écrivez d’abord ce qu’il faut modifier : c’est ce que les développeurs liront."); return; }
    setMissing("");
    const ok = await onChoose(choice, text);
    if (ok) { setNote(""); setOpen(false); }
  };

  // Validé par la direction : plus rien ne change, l'étiquette reste une étiquette.
  if (locked) {
    return <span className="fst-tag ab-state-tag" data-tone="green"><Lock size={12} strokeWidth={2.2} />{children}</span>;
  }

  return (
    <span className="ab-state">
      <button ref={button} type="button" className="fst-tag ab-state-tag is-button" data-tone={tone} aria-haspopup="dialog" aria-expanded={open}
        title={label} onClick={(e) => { e.stopPropagation(); setOpen((value) => !value); }}>
        {children}
        <ChevronDown size={13} strokeWidth={2.2} className="ab-state-chev" aria-hidden="true" />
      </button>
      <Bubble open={open} anchor={button} onClose={close} label={label} className="ab-state-pop">
            <p className="ab-state-head">Où en est la mission ?</p>
            <textarea className="ab-state-note" rows={2} maxLength={2000} value={note} aria-label="Un mot qui part avec le choix"
              placeholder="Un mot (facultatif, sauf pour demander une modification)…" onChange={(e) => { setNote(e.target.value); setMissing(""); }} />
            <ul>
              {choices.map((choice, index) => {
                const Icon = ICONS[choice.icon] || Check;
                const again = choice.current && choice.action === "request_change";
                return (
                  <Motion.li key={choice.key} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * index, duration: 0.2, ease: EASE }}>
                    <button type="button" role="menuitemradio" aria-checked={choice.current} className={`ab-state-opt${choice.current ? " is-current" : ""}`}
                      disabled={Boolean(busy) || (choice.current && !again)} onClick={() => choose(choice)}>
                      <span className={`ab-state-ico is-${choice.icon}`}><Icon size={15} strokeWidth={2} /></span>
                      <span className="ab-state-txt">
                        <b>{again ? "Compléter la demande de modification" : choice.label}</b>
                        <small>{busy === choice.key ? "Enregistrement…" : choice.current && !again ? "État actuel" : choice.hint}</small>
                      </span>
                      {choice.current && !again && <Check size={15} strokeWidth={2.4} className="ab-state-tick" />}
                    </button>
                  </Motion.li>
                );
              })}
              <li>
                <a className="ab-state-opt is-lock" href={url} target="_blank" rel="noopener noreferrer" role="menuitem">
                  <span className="ab-state-ico is-lock"><Lock size={15} strokeWidth={2} /></span>
                  <span className="ab-state-txt">
                    <b>Validé par la direction</b>
                    <small>{validated ? `Le ${validated.at}, par ${validated.by}.` : "Le cadenas : se pose dans Opti’Lex par la direction du cabinet."}</small>
                  </span>
                  <ExternalIcon />
                </a>
              </li>
            </ul>
            {(missing || error) && <p className="ab-state-error" role="alert">{missing || error}</p>}
      </Bubble>
    </span>
  );
}
