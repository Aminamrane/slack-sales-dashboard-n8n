// Le parcours d'une mission, en frise verticale (dev 12/11/2026 : « un état clair, c'est à ce moment-là que ça a été créé,
// validé, et je peux rajouter quelque chose »). Un jalon par ligne, dans l'ordre du temps : atteint (point plein, sa date
// et son auteur), en cours (point entouré), à venir (point creux). Sous chaque jalon, ce qui s'est passé pendant qu'il
// était l'étape en cours : documents, décisions, points d'avancement. Tout se commente ; l'étape en cours reçoit les
// nouveaux points d'avancement ; une étape se choisit d'un geste, confirmé juste dessous.
import React from "react";
import { ArrowRight, FileText, Undo2 } from "lucide-react";
import { Tag } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import { dayLabel, eventSentence, sizeLabel } from "../../utils/automationBoard";
import { Composer, Feedback, Files } from "./Followup.jsx";
import { partnerFile } from "./followupApi.js";

const STATES = { done: ["green", "Fait"], now: ["blue", "Étape actuelle"], next: [undefined, "À venir"] };

function when(milestone) {
  if (milestone.event) return [`le ${dayLabel(milestone.event.day)}${milestone.event.time ? ` à ${milestone.event.time.replace(":", " h ")}` : ""}`, milestone.event.who].filter(Boolean).join(" · ");
  if (milestone.kind === "validated" && milestone.date) return [`le ${milestone.date}`, milestone.by].filter(Boolean).join(" · ");
  if (milestone.state === "next") return milestone.kind === "validated" ? "Se décide dans Opti’Lex, par la direction du cabinet." : "";
  return milestone.kind === "created" && milestone.state === "now" ? "Rien n’a encore bougé sur cette mission." : "Date non enregistrée dans Opti’Lex.";
}

export default function Journey({ processId, milestones, follow, owned, locked, moving, onPick, onMove, onCancel, onUpdate, onChanged }) {
  return (
    <ol className="ab-journey">
      {milestones.map((milestone, index) => {
        const [tone, label] = STATES[milestone.state];
        const movable = milestone.kind !== "validated";
        const choosing = Boolean(moving) && movable && moving.step === milestone.step;
        return (
          <li key={`${milestone.kind}-${milestone.step ?? "v"}`} className={`ab-ms is-${milestone.state}`} aria-current={milestone.state === "now" ? "step" : undefined} style={{ "--i": index }}>
            <span className="ab-ms-dot" aria-hidden="true" />
            <div className="ab-ms-body">
              <div className="ab-ms-head">
                <span className="ab-ms-label">{milestone.label}</span>
                <Tag tone={tone}>{label}</Tag>
                {movable && !locked && !choosing && milestone.state !== "now" && (
                  <button type="button" className={`ab-quiet ab-ms-act${milestone.state === "next" ? "" : " is-back"}`} onClick={() => onPick(milestone.step)}>
                    {milestone.state === "next" ? <><ArrowRight size={13} />Passer à cette étape</> : <><Undo2 size={13} />{milestone.kind === "created" ? "Remettre à « Non commencé »" : "Revenir à cette étape"}</>}
                  </button>
                )}
              </div>
              {when(milestone) && <div className="ab-ms-meta">{when(milestone)}</div>}
              {milestone.event?.text && <div className="ab-event-text">{milestone.event.text}</div>}

              {choosing && (
                <form className="ab-move" onSubmit={(e) => { e.preventDefault(); onMove(); }}>
                  <div className="ab-move-title">{milestone.state === "next" ? "Passer la mission à cette étape ?" : milestone.kind === "created" ? "Remettre la mission à « Non commencé » ?" : "Ramener la mission à cette étape ?"}</div>
                  <input type="text" className="ab-input" value={moving.comment} maxLength={2000} onChange={(e) => onPick(milestone.step, e.target.value)} autoFocus
                    placeholder="Pourquoi maintenant ? Ce mot s’inscrit dans le parcours (facultatif)." aria-label="Raison du changement d’étape" />
                  <div className="ab-actions">
                    {moving.error && <span role="alert" style={{ color: "#c5221f" }}>{moving.error}</span>}
                    <button type="button" className="fst-btn" disabled={moving.busy} onClick={onCancel}>Annuler</button>
                    <button type="submit" className="ab-btn-main" disabled={moving.busy}>{moving.busy ? "Enregistrement…" : "Confirmer"}</button>
                  </div>
                </form>
              )}

              {milestone.state !== "next" && <Feedback processId={processId} itemKey={milestone.key} follow={follow} onChanged={onChanged} replyLabel="Commenter cette étape" />}

              {milestone.items.length > 0 && (
                <ol className="ab-events">
                  {milestone.items.map((item, i) => (
                    <li key={item.key} className="ab-event" style={{ "--i": i }}>
                      <span className="ab-event-dot" aria-hidden="true" />
                      <div style={{ minWidth: 0 }}>
                        <div className="ab-event-what">{eventSentence(item)}</div>
                        <div className="ab-event-who">{[`le ${dayLabel(item.day)}`, item.time && `à ${item.time.replace(":", " h ")}`, item.detail].filter(Boolean).join(" · ")}</div>
                        {item.text && <div className="ab-event-text">{item.text}</div>}
                        {/* Un fichier déposé dans Opti'Lex se télécharge ici ; retiré, il ne reste que son nom. */}
                        {item.file && (partnerFile(item.file) && !item.file.removed
                          ? <Files processId={processId} files={[partnerFile(item.file)]} />
                          : <span className={`ab-chip${item.file.removed ? " is-gone" : ""}`}><FileText size={13} />{item.file.name}<span style={{ color: "var(--muted)" }}>{sizeLabel(item.file.size)}</span></span>)}
                        <Files processId={processId} files={item.files} />
                        <Feedback processId={processId} itemKey={item.key} follow={follow} onChanged={onChanged} entryId={item.id} mine={item.mine} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {owned && milestone.state === "now" && (
                <div style={{ marginTop: 10 }}>
                  <Composer placeholder="Ajouter un point d’avancement : ce qui a été fait, ce qui vient ensuite…" label="Nouveau point d’avancement" sendLabel="Ajouter au parcours" onSend={onUpdate} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
