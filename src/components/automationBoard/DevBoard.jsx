// Suivi des développeurs (13/11/2026 : « un onglet où on voit ce que les devs sont en train de travailler, sur quoi ils
// attendent une validation ») : trois colonnes lues dans Opti'Lex — en cours, en attente du juriste, modification demandée —
// et les gestes qui les font bouger, sans ouvrir la mission. Tout s'inscrit au parcours de la mission dans Opti'Lex.
import React, { useMemo, useState } from "react";
import { Check, FlaskConical, Hammer, Plus, Wrench } from "lucide-react";
import { Tag } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import { devBoard, errorText, startable } from "../../utils/automationBoard";

const ICON = { working: Hammer, lawyer: FlaskConical, dev: Wrench };
const NOTE_MAX = 2000;

function Item({ item, onOpen, onAct }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState({ busy: "", error: "" });
  const act = async (gesture) => {
    if (state.busy) return;
    const text = note.trim().slice(0, NOTE_MAX);
    if (gesture.needsNote && !text) { setState({ busy: "", error: gesture.missing || "Écrivez un mot." }); return; }
    setState({ busy: gesture.key, error: "" });
    try {
      await onAct(item.id, gesture.action, text || null);
      setNote("");
      setState({ busy: "", error: "" });
    } catch (failure) {
      setState({ busy: "", error: errorText(failure, "Le geste n’a pas été enregistré.") });
    }
  };
  return (
    <li className="ab-now-item">
      <button type="button" className="ab-now-name" onClick={() => onOpen(item.id)} title="Ouvrir le suivi de la mission">{item.name}</button>
      <div className="ab-now-meta">{[item.pole, item.meta].filter(Boolean).join(" · ")}</div>
      {item.text && <blockquote className="ab-now-quote">{item.text}</blockquote>}
      {item.actions.length > 0 && (
        <>
          <input className="ab-now-note" type="text" value={note} maxLength={NOTE_MAX} aria-label={`Un mot pour ${item.name}`}
            placeholder={item.actions.some((gesture) => gesture.needsNote) ? "Où vous en êtes…" : "Un mot (facultatif)…"}
            onChange={(e) => { setNote(e.target.value); if (state.error) setState({ busy: "", error: "" }); }}
            onKeyDown={(e) => { const main = item.actions.find((gesture) => gesture.needsNote); if (e.key === "Enter" && main) { e.preventDefault(); act(main); } }} />
          <div className="ab-now-btns">
            {item.actions.map((gesture) => (
              <button key={gesture.key} type="button" className={gesture.primary ? "ab-btn-main ab-now-btn" : "fst-btn ab-now-btn"} disabled={Boolean(state.busy)} onClick={() => act(gesture)}>
                {gesture.primary && <Check size={14} />}{state.busy === gesture.key ? "Enregistrement…" : gesture.label}
              </button>
            ))}
          </div>
          {state.error && <div className="ab-turn-error" role="alert">{state.error}</div>}
        </>
      )}
    </li>
  );
}

export default function DevBoard({ rows, onOpen, onAct }) {
  const groups = useMemo(() => devBoard(rows), [rows]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState({ busy: null, error: "" });
  const found = useMemo(() => startable(rows, query), [rows, query]);
  const add = async (row) => {
    if (adding.busy) return;
    setAdding({ busy: row.id, error: "" });
    try {
      await onAct(row.id, "start", null);
      setQuery("");
      setAdding({ busy: null, error: "" });
    } catch (failure) {
      setAdding({ busy: null, error: errorText(failure, "La mission n’a pas été ajoutée.") });
    }
  };
  return (
    <div className="ab-now">
      <div className="ab-now-add">
        <label className="fst-search ab-now-search">
          <Plus size={14} />
          <input type="search" value={query} placeholder="Ajouter une mission en cours : tapez son nom" aria-label="Ajouter une mission en cours" onChange={(e) => { setQuery(e.target.value); if (adding.error) setAdding({ busy: null, error: "" }); }} />
        </label>
        {query.trim() && (
          <ul className="ab-now-found" aria-label="Missions trouvées">
            {found.length === 0 ? <li className="ab-now-none">Aucune mission à ce nom, ou elle est déjà en cours.</li> : found.map((row) => (
              <li key={row.id}>
                <button type="button" disabled={Boolean(adding.busy)} onClick={() => add(row)}>
                  <span>{row.name}</span><small>{adding.busy === row.id ? "Ajout…" : "On y travaille"}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {adding.error && <div className="ab-turn-error" role="alert">{adding.error}</div>}
      </div>
      <div className="ab-now-cols">
        {groups.map((group) => (
          <section key={group.key} className={`ab-now-col is-${group.key}`} aria-label={group.title}>
            <header className="ab-now-head">
              <span className="ab-now-ico" aria-hidden="true">{React.createElement(ICON[group.key], { size: 15, strokeWidth: 1.9 })}</span>
              <span className="ab-now-title">{group.title}</span>
              <Tag tone={group.tone}>{group.items.length}</Tag>
            </header>
            {group.items.length === 0 ? <p className="ab-now-empty">{group.empty}</p> : (
              <ul className="ab-now-list">{group.items.map((item) => <Item key={item.id} item={item} onOpen={onOpen} onAct={onAct} />)}</ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
