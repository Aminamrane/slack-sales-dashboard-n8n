// Le suivi sur la ligne du tableau (dev 17/11/2026 : « on est obligé de rentrer dans la fiche pour continuer le suivi »,
// puis « le meilleur suivi qu'on puisse avoir »). Quatre cellules, sans ouvrir la mission :
//   - `StateCell` : où en est la mission. L'étiquette se clique et déplie les états (`StateMenu`) ; dessous, les étapes
//     en petit et, si quelqu'un est attendu, depuis combien de jours.
//   - `NewsCell` : la dernière parole posée sur la mission (geste, point d'avancement ou commentaire), avec qui, quand
//     et ses mots. Un point rose quand le cabinet a parlé en dernier ; « Répondre » écrit au cabinet depuis la ligne.
//   - `PlanCell` : qui porte la mission chez les développeurs, et pour quand. Un clic pour la prendre, la confier,
//     poser ou retirer la date cible.
//   - `GestureCell` : le geste le plus probable pour cette ligne. Un clic ouvre une bulle : un mot, puis le geste.
// Tout s'enregistre dans Opti'Lex au nom de la personne connectée, comme depuis la fiche.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, CornerDownLeft, Hammer, Lock, MoreHorizontal, Send, UserPlus } from "lucide-react";
import { Tag } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import { errorText, stateChoices, stepOf, waitLabel, whenLabel } from "../../utils/automationBoard";
import { Face, Steps } from "./parts";
import Bubble from "./Bubble.jsx";
import StateMenu from "./StateMenu.jsx";

const NOTE_MAX = 2000;
const LATE_DAYS = 7;
const ICON = { approve: Check, deliver: Send, start: Hammer };

// `quiet` : dans « À suivre », le groupe dit déjà que les développeurs y travaillent ; l'étiquette « En cours » se tait.
export function StateCell({ row, follow, steps, onApply, P, quiet = false }) {
  const [state, setState] = useState({ busy: "", error: "" });
  const { turn, waitDays } = follow;
  const choices = useMemo(() => stateChoices(row, steps, turn), [row, steps, turn]);
  const choose = async (choice, text) => {
    if (state.busy) return false;
    setState({ busy: choice.key, error: "" });
    try {
      await onApply(row, choice, text);
      setState({ busy: "", error: "" });
      return true;
    } catch (failure) {
      setState({ busy: "", error: errorText(failure, "L’état n’a pas été enregistré.") });
      return false;
    }
  };
  // Avant toute version, l'étape dit mieux où en est la mission que « chez les développeurs ».
  const label = turn.who === "build" ? stepOf(steps, row.step).label || turn.tag : turn.tag;
  const wait = waitLabel(waitDays);
  return (
    <div className="ab-cell-state">
      <div className="ab-cell-tags">
        {row.validated ? <span className="fst-tag" data-tone="green" title={`Validé par la direction le ${row.validated.at}, par ${row.validated.by}`}><Lock size={12} strokeWidth={2.2} />Validé par la direction</span> : (
          <StateMenu choices={choices} onChoose={choose} busy={state.busy} error={state.error} validated={row.validated} url={row.url} tone={turn.tone}
            label={`Changer l’état de ${row.name}`}>{label}</StateMenu>
        )}
        {turn.working && !(quiet && follow.group === "working") && <Tag tone="blue" title={turn.working.text || "Les développeurs y travaillent"}>En cours</Tag>}
      </div>
      <div className="ab-cell-steps">
        <Steps value={row.step} steps={steps} P={P} showLabel={false} />
        {wait && <span className="ab-cell-wait" data-late={waitDays >= LATE_DAYS ? "true" : undefined} title={turn.who === "lawyer" ? "Le juriste est attendu" : "Les développeurs sont attendus"}>{wait}</span>}
      </div>
    </div>
  );
}

// Une bulle s'ouvre : le champ prend le curseur sans que la page ne bouge pour aller la chercher.
function useFocusOnOpen(open) {
  const field = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return field;
}

export function NewsCell({ row, follow, onReply }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState({ busy: false, error: "" });
  const button = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const field = useFocusOnOpen(open);
  const { news, unanswered } = follow;
  const send = async () => {
    const body = text.trim().slice(0, NOTE_MAX);
    if (state.busy) return;
    if (!body) { setState({ busy: false, error: "Écrivez votre message au cabinet." }); return; }
    setState({ busy: true, error: "" });
    try {
      await onReply(row, body);
      setText("");
      setState({ busy: false, error: "" });
      setOpen(false);
    } catch (failure) {
      setState({ busy: false, error: errorText(failure, "Le message n’est pas parti.") });
    }
  };
  return (
    <div className="ab-cell-news">
      <p className="ab-cell-who">
        {news ? (
          <>
            {unanswered && <i className="ab-dot" title="Le cabinet a parlé en dernier : personne ne lui a encore répondu" />}
            <Face name={news.who} size={20} /><b>{news.who || "Quelqu’un"}</b>
            {news.side === "cabinet" && <span className="ab-side">Cabinet</span>}
          </>
        ) : <span className="ab-cell-none">Rien de signalé</span>}
        <button ref={button} type="button" className="ab-reply" data-on={unanswered || open ? "true" : undefined} aria-haspopup="dialog" aria-expanded={open}
          title={news ? "Répondre au cabinet, sans ouvrir la mission" : "Écrire au cabinet, sans ouvrir la mission"} aria-label={`Écrire au cabinet à propos de ${row.name}`}
          onClick={(e) => { e.stopPropagation(); setState({ busy: false, error: "" }); setOpen((value) => !value); }}>
          <CornerDownLeft size={13} strokeWidth={2} /><span>{news ? "Répondre" : "Écrire"}</span>
        </button>
      </p>
      {news && <p className="ab-cell-quote" title={news.text || undefined}><time>{whenLabel(news.at)}</time> · <span>{news.what}</span>{news.text ? ` : ${news.text}` : ""}</p>}
      <Bubble open={open} anchor={button} onClose={close} label={`Écrire au cabinet à propos de ${row.name}`} className="ab-act-pop">
        <p className="ab-act-name">{row.name}</p>
        <p className="ab-act-title">{news ? `Répondre à ${news.who || "la dernière nouvelle"}` : "Écrire au cabinet"}</p>
        {news?.text && <blockquote className="ab-act-quote">{news.text}</blockquote>}
        <textarea ref={field} className="ab-state-note" rows={3} maxLength={NOTE_MAX} value={text} aria-label="Votre message au cabinet" placeholder="Votre message : le cabinet le lit dans Opti’Lex…"
          onChange={(e) => { setText(e.target.value); if (state.error) setState({ busy: false, error: "" }); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
        <div className="ab-act-btns">
          <button type="button" className="ab-btn-main" disabled={state.busy} onClick={send}><Send size={14} />{state.busy ? "Envoi…" : "Envoyer au cabinet"}</button>
        </div>
        {state.error && <p className="ab-state-error" role="alert">{state.error}</p>}
        <p className="ab-act-foot">Enregistré dans Opti’Lex à votre nom : la direction du cabinet le lit aussi. ⌘ Entrée pour envoyer.</p>
      </Bubble>
    </div>
  );
}

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
// Trois dates qu'on pose d'un clic : dans trois jours, dans une semaine, à la fin du mois.
function quickDates(now = new Date()) {
  const plus = (days) => { const date = new Date(now); date.setDate(date.getDate() + days); return date; };
  return [["Dans 3 jours", iso(plus(3))], ["Dans une semaine", iso(plus(7))], ["Fin du mois", iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))]];
}

export function PlanCell({ row, follow, people, me, onApply, wide = false }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState({ busy: "", error: "" });
  const button = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const owner = row.owner?.name || "";
  const { due } = follow;
  const run = async (key, gesture, note, keepOpen = false) => {
    if (state.busy) return;
    setState({ busy: key, error: "" });
    try {
      await onApply(row, gesture, note);
      setName("");
      setState({ busy: "", error: "" });
      if (!keepOpen) setOpen(false);
    } catch (failure) {
      setState({ busy: "", error: errorText(failure, "Ce n’est pas enregistré.") });
    }
  };
  const others = people.filter((person) => person !== me && person !== owner);
  return (
    <div className="ab-cell-plan">
      <button ref={button} type="button" className={`ab-plan${owner ? "" : " is-empty"}${wide ? " is-wide" : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-label={owner ? undefined : `Choisir un responsable pour ${row.name}`}
        title={owner ? `Portée par ${owner}${row.owner?.since ? `, depuis le ${String(row.owner.since).slice(0, 10)}` : ""}. Cliquez pour changer.` : "Personne ne porte cette mission. Cliquez pour la prendre ou la confier."}
        onClick={(e) => { e.stopPropagation(); setState({ busy: "", error: "" }); setOpen((value) => !value); }}>
        {owner ? <><Face name={owner} size={20} /><span className="ab-plan-name">{owner}</span></> : <><UserPlus size={14} strokeWidth={1.9} />{wide && <span>Responsable</span>}</>}
      </button>
      {due && <span className="ab-due" data-state={due.late ? "late" : due.soon ? "soon" : undefined} title={due.hint}><CalendarClock size={12} strokeWidth={2} />{due.label}</span>}
      <Bubble open={open} anchor={button} onClose={close} label={`Responsable et date cible de ${row.name}`} className="ab-act-pop">
        <p className="ab-act-name">{row.name}</p>
        <p className="ab-act-title">Qui porte la mission ?</p>
        <div className="ab-plan-chips">
          <button type="button" className="ab-chip" aria-pressed={Boolean(me) && owner === me} disabled={Boolean(state.busy) || owner === me} onClick={() => run("me", { action: "assign" }, "")}>
            {state.busy === "me" ? "Enregistrement…" : owner === me && me ? "C’est vous" : "Je m’en occupe"}
          </button>
          {owner && owner !== me && <button type="button" className="ab-chip" aria-pressed="true" disabled><Face name={owner} size={16} />{owner}</button>}
          {others.map((person) => (
            <button key={person} type="button" className="ab-chip" disabled={Boolean(state.busy)} onClick={() => run(person, { action: "assign" }, person)}><Face name={person} size={16} />{person}</button>
          ))}
        </div>
        <form className="ab-plan-form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run("name", { action: "assign" }, name.trim()); }}>
          <input type="text" className="ab-plan-input" value={name} maxLength={120} placeholder="Un autre nom…" aria-label="Nom du responsable" onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="ab-act-alt" disabled={Boolean(state.busy) || !name.trim()}>Confier</button>
        </form>
        {owner && <button type="button" className="ab-plan-clear" disabled={Boolean(state.busy)} onClick={() => run("free", { action: "unassign" }, "")}>Plus personne ne la porte</button>}

        <p className="ab-act-title ab-plan-sep">Pour quand ?</p>
        <div className="ab-plan-chips">
          {quickDates().map(([label, value]) => (
            <button key={label} type="button" className="ab-chip" aria-pressed={due?.date === value} disabled={Boolean(state.busy)} onClick={() => run(label, { action: "due" }, value, true)}>{label}</button>
          ))}
        </div>
        <div className="ab-plan-form">
          <input type="date" className="ab-plan-input" value={due?.date || ""} aria-label="Date cible" disabled={Boolean(state.busy)}
            onChange={(e) => { if (e.target.value) run("date", { action: "due" }, e.target.value, true); }} />
          {due && <button type="button" className="ab-act-alt" disabled={Boolean(state.busy)} onClick={() => run("nodate", { action: "due" }, "", true)}>Retirer</button>}
        </div>
        {state.error && <p className="ab-state-error" role="alert">{state.error}</p>}
        <p className="ab-act-foot">Le cabinet voit le responsable et la date dans Opti’Lex. Ni l’étape ni le classement ne changent.</p>
      </Bubble>
    </div>
  );
}

export function GestureCell({ row, follow, onApply }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState({ busy: "", error: "" });
  const button = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const field = useFocusOnOpen(open);
  const { turn, main } = follow;
  // Dans la bulle, le geste de la ligne vient en premier, en bouton plein ; les autres suivent.
  const gestures = useMemo(() => (main ? [{ ...main, primary: true }, ...turn.actions.filter((item) => item.key !== main.key).map((item) => ({ ...item, primary: false }))] : turn.actions), [turn, main]);
  const act = async (gesture) => {
    if (state.busy) return;
    const text = note.trim().slice(0, NOTE_MAX);
    if (gesture.needsNote && !text) { setState({ busy: "", error: gesture.missing || "Écrivez d’abord ce qu’il faut modifier : c’est ce que les développeurs liront." }); return; }
    setState({ busy: gesture.key, error: "" });
    try {
      await onApply(row, gesture, text);
      setNote("");
      setState({ busy: "", error: "" });
      setOpen(false);
    } catch (failure) {
      setState({ busy: "", error: errorText(failure, "Le geste n’a pas été enregistré.") });
    }
  };
  const Icon = main ? ICON[main.action] || Check : MoreHorizontal;
  return (
    <div className="ab-cell-act">
      <button ref={button} type="button" className={`ab-act${main ? ` is-${main.action}` : " is-more"}`} aria-haspopup="dialog" aria-expanded={open}
        title={main ? `${main.label} : un clic ouvre le geste` : "Autres gestes du suivi"} aria-label={main ? undefined : `Gestes du suivi de ${row.name}`}
        onClick={(e) => { e.stopPropagation(); setState({ busy: "", error: "" }); setOpen((value) => !value); }}>
        <Icon size={14} strokeWidth={2} />{main && <span>{main.short}</span>}
      </button>
      <Bubble open={open} anchor={button} onClose={close} label={`Suivi de ${row.name}`} className="ab-act-pop">
        <p className="ab-act-name">{row.name}</p>
        <p className="ab-act-title">{turn.title}</p>
        {turn.quote && <blockquote className="ab-act-quote">{turn.quote}</blockquote>}
        <textarea ref={field} className="ab-state-note" rows={2} maxLength={NOTE_MAX} value={note} aria-label="Un mot qui part avec le geste" placeholder={turn.placeholder}
          onChange={(e) => { setNote(e.target.value); if (state.error) setState({ busy: "", error: "" }); }} />
        <div className="ab-act-btns">
          {gestures.map((gesture) => (
            <button key={gesture.key} type="button" className={gesture.primary ? "ab-btn-main" : "ab-act-alt"} disabled={Boolean(state.busy)} onClick={() => act(gesture)}>
              {state.busy === gesture.key ? "Enregistrement…" : gesture.label}
            </button>
          ))}
        </div>
        {state.error && <p className="ab-state-error" role="alert">{state.error}</p>}
        <p className="ab-act-foot">Inscrit au parcours de la mission, dans Opti’Lex, à votre nom.</p>
      </Bubble>
    </div>
  );
}
