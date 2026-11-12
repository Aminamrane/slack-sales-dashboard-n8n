// Page d'une mission ou d'un process (dev 12/11/2026 : « quand on tape sur une mission, on arrive sur une autre page » ;
// « un état clair d'où se trouve la mission », qu'on change clairement, et une frise : créée à ce moment-là, validée à ce
// moment-là, « et moi, je peux rajouter quelque chose »).
// Bâtie avec le kit de la page Finance (`Page`, `Card`, `Tag`) et le fil d'échanges (`fx-`). Dans l'ordre : l'état de la
// mission en tête (l'étape en cours, depuis quand, et le geste pour passer à la suivante) ; le parcours en frise (un jalon
// par étape, daté et signé, avec ce qui s'est passé dessous : documents, décisions, points d'avancement, tous
// commentables) ; les commentaires de la mission. À droite : le cahier des charges, le classement, puis les chiffres.
// Une étape, un classement ou un commentaire partagé posé ici est enregistré dans Opti'Lex au nom de la personne
// connectée ; la validation par la direction du cabinet reste dans Opti'Lex.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../../services/apiClient";
import { countLabel, dayLabel, journey, missionComments, periodHint, periodLabel, sizeLabel } from "../../utils/automationBoard";
import { ArrowLeft, ArrowRight, BarChart3, CloudUpload, FileText, Gauge, Layers, ListTree, Lock, MessageCircle, Milestone, Route, Tags, Users } from "lucide-react";
import { Card, Empty, Page, Reveal, Tag } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import "../../pages/TrackingSheetFinance/components/ExchangeThread.css";
import { ExternalIcon, Face, StepTrack, Usage } from "./parts";
import { Composer, Feedback, Files } from "./Followup.jsx";
import Journey from "./Journey.jsx";
import { FILE_ACCEPT, followupApi, pickFiles } from "./followupApi.js";
import { TONE_OF, number } from "./theme";

const API = "/api/v1/optilex/automation-board";
const NO_FOLLOW = { available: false, entries: [], reactions: {} };
const NOTE_MAX = 2000;

export default function ProcessPage({ id, period, frame, onClose, onOpen, onChanged, P }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Suivi côté Owner : points d'avancement, documents, commentaires, réactions. Absent tant que le serveur ne le sert pas.
  const [follow, setFollow] = useState(NO_FOLLOW);
  const [audience, setAudience] = useState("owner");
  const [drop, setDrop] = useState({ busy: false, error: "", over: false });
  // Changement d'étape en cours de confirmation : { step, comment, from: "state" | "journey", busy, error }.
  const [moving, setMoving] = useState(null);
  // Classement : la valeur choisie tant qu'elle n'est pas enregistrée.
  const [rank, setRank] = useState(null);
  const [saved, setSaved] = useState("");
  const closeRef = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await apiClient.get(`${API}/${id}${period ? `?periode=${period}` : ""}`);
      if (mine !== seq.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e?.status === 404 ? "Ce process n'est plus dans le board." : (e?.message || "Fiche indisponible."));
    }
  }, [id, period]);

  const loadFollow = useCallback(async () => {
    try { const next = await followupApi.list(id); setFollow(next?.available ? next : NO_FOLLOW); }
    catch { setFollow(NO_FOLLOW); }
  }, [id]);

  // Changement de process : la fiche repart de zéro.
  useEffect(() => { setData(null); setError(""); setMoving(null); setRank(null); setSaved(""); setFollow(NO_FOLLOW); }, [id]);
  useEffect(() => { load(); loadFollow(); }, [load, loadFollow]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) { load(); loadFollow(); } }, 60000);
    return () => clearInterval(timer);
  }, [load, loadFollow]);
  useEffect(() => {
    // Échap revient à la liste, sauf pendant qu'on écrit : un texte en cours ne se perd pas.
    const onKey = (e) => { if (e.key === "Escape" && !/^(TEXTAREA|INPUT|SELECT)$/.test(e.target?.tagName || "")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const row = data?.row;
  const classifications = frame?.classifications || data?.classifications || [];
  const steps = useMemo(() => frame?.steps || data?.steps || [], [frame, data]);
  // Le parcours (jalons, et sous chacun ce qui s'est passé) et les commentaires de la mission se lisent à part.
  const milestones = useMemo(() => (data?.row ? journey(data.row, steps, data.history, follow.entries) : []), [data, steps, follow]);
  const comments = useMemo(() => missionComments(data?.history, follow.entries), [data, follow]);
  const owned = follow.available;
  const shared = !owned || audience === "shared";
  const locked = Boolean(row?.validated);
  const last = Math.max(1, steps.length - 1);
  const stepNow = steps.find((item) => item.value === row?.step);
  const stepNext = steps.find((item) => item.value === (row?.step ?? 0) + 1);
  const reached = milestones.find((item) => item.state === "now")?.event;
  const since = reached ? `depuis le ${dayLabel(reached.day)}${reached.who ? `, par ${reached.who}` : ""}` : row?.reviewed ? `revu le ${row.reviewed.at} par ${row.reviewed.by}` : "";

  // Un commentaire partagé va dans Opti'Lex (texte seul, lu par le cabinet) ; un commentaire interne reste chez Owner.
  const sendComment = async (body, files) => {
    if (shared) {
      if (!body) throw new Error("Écrivez le commentaire à partager.");
      await apiClient.post(`${API}/${id}/comments`, { text: body.slice(0, NOTE_MAX) });
      await load();
      onChanged();
    } else {
      await followupApi.add(id, { kind: "comment", body, files });
      await loadFollow();
    }
  };
  const sendUpdate = async (body, files) => { await followupApi.add(id, { kind: "update", body, files }); await loadFollow(); };
  const sendDocuments = async (incoming) => {
    const [list, refused] = pickFiles([], incoming);
    if (!list.length) { setDrop({ busy: false, error: refused, over: false }); return; }
    setDrop({ busy: true, error: "", over: false });
    try { await followupApi.add(id, { kind: "document", files: list.map((item) => item.file) }); await loadFollow(); setDrop({ busy: false, error: refused, over: false }); }
    catch (failure) { setDrop({ busy: false, error: failure?.message || "Le document n’a pas pu être déposé.", over: false }); }
  };

  // Étape et classement partent par la même route d'Opti'Lex : on n'y change qu'une chose à la fois, l'autre reste telle quelle.
  const pick = (from) => (step, comment = "") => { setSaved(""); setMoving({ step, comment, from, busy: false, error: "" }); };
  const move = async () => {
    if (!moving || moving.busy || !row) return;
    setMoving({ ...moving, busy: true, error: "" });
    try {
      await apiClient.post(`${API}/${id}/classification`, { classification: row.classification, step: moving.step, comment: moving.comment.trim() || null });
      setMoving(null);
      setSaved("step");
      await load();
      onChanged();
    } catch (err) {
      setMoving((state) => state && { ...state, busy: false, error: err?.message || "L’étape n’a pas été enregistrée." });
      if (err?.status === 409) load();
    }
  };
  const saveRank = async (e) => {
    e.preventDefault();
    if (!rank || rank.busy || !row || rank.value === row.classification) return;
    setRank({ ...rank, busy: true, error: "" });
    try {
      await apiClient.post(`${API}/${id}/classification`, { classification: rank.value, step: row.step, comment: rank.comment.trim() || null });
      setRank(null);
      setSaved("rank");
      await load();
      onChanged();
    } catch (err) {
      setRank((state) => state && { ...state, busy: false, error: err?.message || "Le classement n’a pas été enregistré." });
      if (err?.status === 409) load();
    }
  };

  const classification = classifications.find((item) => item.value === row?.classification);
  // Cahier des charges : les documents déposés depuis Owner (téléchargeables ici), puis ceux d'Opti'Lex.
  const docs = [
    ...follow.entries.filter((entry) => entry.kind === "document").flatMap((entry) => entry.files.map((file) => ({ key: file.id, name: file.file_name, meta: [sizeLabel(file.byte_size), entry.author_name, new Date(entry.created_at).toLocaleDateString("fr-FR")], file }))),
    ...(data?.attachments || []).map((file, i) => ({ key: `x${i}`, name: file.name, meta: [sizeLabel(file.size), file.by, file.at, "dans Opti’Lex"], file: null })),
  ];
  const fileInput = useRef(null);
  const confirm = (state, onChange) => (
    <form className="ab-move" onSubmit={(e) => { e.preventDefault(); move(); }}>
      <div className="ab-move-title">Passer la mission à « {steps.find((item) => item.value === state.step)?.label} » ?</div>
      <input type="text" className="ab-input" value={state.comment} maxLength={NOTE_MAX} onChange={(e) => onChange(state.step, e.target.value)} autoFocus
        placeholder="Pourquoi maintenant ? Ce mot s’inscrit dans le parcours (facultatif)." aria-label="Raison du changement d’étape" />
      <div className="ab-actions">
        {state.error && <span role="alert" style={{ color: "#c5221f" }}>{state.error}</span>}
        <button type="button" className="fst-btn" disabled={state.busy} onClick={() => setMoving(null)}>Annuler</button>
        <button type="submit" className="ab-btn-main" disabled={state.busy}>{state.busy ? "Enregistrement…" : "Confirmer"}</button>
      </div>
    </form>
  );

  return (
    <Page title={row?.name || (error ? "Fiche indisponible" : "Chargement…")}
      sub={data?.parent ? `Mission du process « ${data.parent.name} »` : row?.isParent ? `Process qui regroupe ${countLabel(row.members, "mission", "missions")}` : row ? "Mission de la nomenclature d’Opti’Lex" : undefined}
      actions={<button ref={closeRef} type="button" className="fst-btn" onClick={onClose}><ArrowLeft size={14} />Toutes les missions</button>}>
      {row && (
        <div className="ab-tags">
          <Tag tone={TONE_OF[row.classification]} title={classification?.help}>{classification?.label || "Non classée"}</Tag>
          {row.pole?.label && <Tag>{row.pole.label}</Tag>}
          {row.validated && <Tag tone="green">Validé par la direction</Tag>}
          {!row.validated && row.toConfirm && <Tag tone="peach">Classement à confirmer</Tag>}
          {data.parent && <button type="button" className="ab-textlink" style={{ fontSize: 12.5, marginLeft: 4 }} onClick={() => onOpen(data.parent.id)}>Voir le process</button>}
        </div>
      )}

      {error && <div className="fst-error" role="alert">{error}</div>}
      {!row && !error && <Empty boxed>Chargement de la fiche…</Empty>}

      {row && (
        <>
          <Reveal>
            <Card title="Où en est la mission" Icon={Milestone}>
              <div className="ab-state">
                <div style={{ minWidth: 0 }}>
                  <div className="ab-state-name">{stepNow?.label || "Étape inconnue"}</div>
                  <div className="ab-state-since">{[`Étape ${row.step} sur ${last}`, since].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="ab-state-act">
                  {locked ? <Tag tone="green">Validé le {row.validated.at}</Tag>
                    : stepNext && moving?.from !== "state" ? <button type="button" className="ab-btn-main" onClick={() => pick("state")(stepNext.value)}>Passer à « {stepNext.label} »<ArrowRight size={15} /></button>
                    : !stepNext ? <Tag tone="blue">Dernière étape atteinte</Tag> : null}
                </div>
                <StepTrack value={row.step} steps={steps} P={P} />
                {moving?.from === "state" && confirm(moving, pick("state"))}
                {saved === "step" && !moving && <p className="ab-state-saved" role="status">Étape enregistrée dans Opti’Lex et inscrite au parcours.</p>}
                {locked && <p className="ab-note" style={{ gridColumn: "1 / -1", marginTop: 0 }}>Validé par la direction du cabinet ({row.validated.by}) : l’étape et le classement ne changent plus. La direction peut lever la validation dans Opti’Lex.</p>}
                {!locked && !stepNext && <p className="ab-note" style={{ gridColumn: "1 / -1", marginTop: 0 }}>Il reste la validation, qui se fait dans Opti’Lex par la direction du cabinet.</p>}
              </div>
            </Card>
          </Reveal>

          <Reveal className="fst-grid">
            <div className="ab-col">
              <Card title="Parcours de l’automatisation" Icon={Route}
                hint="Chaque étape, quand elle a été franchie et par qui, avec ce qui s’est passé entre-temps. Tout se commente.">
                <Journey processId={id} milestones={milestones} follow={follow} owned={owned} locked={locked}
                  moving={moving?.from === "journey" ? moving : null} onPick={pick("journey")} onMove={move} onCancel={() => setMoving(null)}
                  onUpdate={sendUpdate} onChanged={loadFollow} />
              </Card>

              <Card title="Commentaires de la mission" Icon={MessageCircle}
                hint={comments.length ? `${countLabel(comments.length, "commentaire", "commentaires")}, du plus récent au plus ancien.` : "Ce qui avance, ce qui bloque, ce qui a été décidé."}>
                <Composer key={shared ? "shared" : "owner"} allowFiles={!shared} onSend={sendComment}
                  placeholder={shared ? "Écrire au cabinet : ce commentaire s’affiche aussi dans Opti’Lex…" : "Écrire un commentaire sur cette mission…"} label="Nouveau commentaire"
                  tools={owned && (
                    <div className="ab-aud" role="group" aria-label="À qui écrire">
                      <button type="button" aria-pressed={!shared} onClick={() => setAudience("owner")} title="Reste chez Owner : pièces jointes et réactions possibles">Interne</button>
                      <button type="button" aria-pressed={shared} onClick={() => setAudience("shared")} title="Enregistré dans Opti’Lex à votre nom : la direction du cabinet le lit aussi (texte seul)">Partagé</button>
                    </div>
                  )}
                  note={shared ? <><Users size={12} strokeWidth={2.1} />Enregistré dans Opti’Lex à votre nom : la direction du cabinet le lit aussi. Texte seul.</>
                    : <><Lock size={12} strokeWidth={2.1} />Interne à Owner : le cabinet ne le voit pas. Pièces jointes et émojis possibles.</>} />
                <div className="fx">
                  <div className="fx-list">
                    {comments.map((item) => (
                      <article key={item.key} className="fx-card">
                        <header className="fx-head">
                          <Face name={item.who} />
                          <span className="fx-author">{item.who || "Opti’Lex"}</span>
                          <i className="fx-dot" /><span className="fx-time">{new Date(`${item.day}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, {item.time}</span>
                          <span className="fx-head-end">{item.shared ? <Tag tone="blue">Partagé avec le cabinet</Tag> : <Tag>Interne</Tag>}</span>
                        </header>
                        {item.text && <div className="fx-text">{item.text}</div>}
                        <Files processId={id} files={item.files} />
                        <Feedback processId={id} itemKey={item.key} follow={follow} onChanged={loadFollow} entryId={item.id} mine={item.mine} replyLabel="Répondre" />
                      </article>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="ab-col">
              <Card title="Cahier des charges" Icon={FileText}
                hint="Ce que le logiciel doit faire pour cette mission : le document de départ et tout ce qui le complète.">
                <div className="ab-docs is-stack">
                  <div style={{ minWidth: 0 }}>
                    {docs.length === 0 && <Empty boxed>Aucun document pour l’instant. Le cahier des charges (images, Excel, PDF) ouvre le suivi de l’automatisation.</Empty>}
                    {docs.map((doc, i) => (
                      <div key={doc.key} className={`ab-doc${i === 0 ? " is-first" : ""}`}>
                        <span className="ab-doc-ico"><FileText size={i === 0 ? 20 : 17} strokeWidth={1.7} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ab-doc-name">{doc.name}</div>
                          <div className="ab-doc-meta">{doc.meta.filter(Boolean).join(" · ")}</div>
                        </div>
                        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {i === 0 && <Tag tone="blue">Dernier ajout</Tag>}
                          {doc.file && <button type="button" className="fst-btn" onClick={() => followupApi.download(id, doc.file).catch((failure) => setDrop((state) => ({ ...state, error: failure?.message || "Le fichier n’a pas pu être chargé." })))}>Télécharger</button>}
                        </span>
                      </div>
                    ))}
                    {drop.error && <p role="alert" style={{ margin: "10px 2px 0", fontSize: 12.5, color: "#c5221f" }}>{drop.error}</p>}
                  </div>
                  {owned ? (
                    <button type="button" className={`ab-drop${drop.over ? " is-drag" : ""}`} aria-busy={drop.busy} onClick={() => fileInput.current?.click()}
                      onDragEnter={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDrop((state) => ({ ...state, over: true })); } }}
                      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop((state) => ({ ...state, over: false })); }}
                      onDrop={(e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); sendDocuments(e.dataTransfer.files); }}>
                      <CloudUpload size={26} strokeWidth={1.6} />
                      <span>{drop.busy ? "Dépôt en cours…" : <>Glissez un document ici<br />ou <u>parcourez</u></>}</span>
                      <small>PDF, image, Excel, Word · 20 Mo au plus</small>
                      <input ref={fileInput} type="file" hidden multiple accept={FILE_ACCEPT} onChange={(e) => { sendDocuments(e.target.files); e.target.value = ""; }} />
                    </button>
                  ) : (
                    <a className="ab-drop" href={row.url} target="_blank" rel="noopener noreferrer">
                      <CloudUpload size={26} strokeWidth={1.6} />
                      <span>Ajouter un document<br />dans <u>Opti’Lex</u></span>
                      <small>Il apparaît ici dès qu’il est déposé.</small>
                    </a>
                  )}
                </div>
              </Card>

              <Card title="Classement" Icon={Tags} hint={classification?.help || "Ce que la mission est aujourd’hui pour le cabinet."}>
                {locked ? (
                  <p className="ab-note" style={{ marginTop: 0 }}>{classification?.label}. Validé par la direction : le classement ne change plus.</p>
                ) : (
                  <form onSubmit={saveRank}>
                    <select className="fst-select" style={{ width: "100%" }} aria-label="Classement de la mission" value={rank?.value ?? row.classification}
                      onChange={(e) => { setSaved(""); setRank(e.target.value === row.classification ? null : { value: e.target.value, comment: rank?.comment || "", busy: false, error: "" }); }}>
                      {classifications.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    {rank && (
                      <>
                        <input type="text" className="ab-input" value={rank.comment} maxLength={NOTE_MAX} onChange={(e) => setRank({ ...rank, comment: e.target.value })}
                          placeholder="Pourquoi ce classement ? (facultatif)" aria-label="Raison du changement de classement" style={{ marginTop: 10 }} />
                        <div className="ab-actions">
                          {rank.error && <span role="alert" style={{ color: "#c5221f" }}>{rank.error}</span>}
                          <button type="button" className="fst-btn" disabled={rank.busy} onClick={() => setRank(null)}>Annuler</button>
                          <button type="submit" className="ab-btn-main" disabled={rank.busy}>{rank.busy ? "Enregistrement…" : "Enregistrer"}</button>
                        </div>
                      </>
                    )}
                    {saved === "rank" && !rank && <p className="ab-state-saved" role="status" style={{ marginTop: 10 }}>Classement enregistré dans Opti’Lex.</p>}
                  </form>
                )}
              </Card>

              <Card title="Utilisation du logiciel" Icon={Gauge} hint={`${periodLabel(data.period)}.`}>
                <Usage usage={row.usage} P={P} large />
                <p className="fst-card-hint" style={{ marginTop: 10 }}>
                  {row.usage ? row.usage.detail : `Aucun module du logiciel ne couvre cette mission : rien à mesurer sur les ${periodHint(data.period)}.`}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line-soft)" }}>
                  <div>
                    <div className="fst-cell-muted" style={{ fontSize: 12.5 }}>Missions réalisées</div>
                    <div className="fst-num" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 4 }}>{number(row.total)}</div>
                    <div className="fst-cell-muted" style={{ fontSize: 12 }}>dont {number(row.recent)} sur 90 jours</div>
                  </div>
                  <div>
                    <div className="fst-cell-muted" style={{ fontSize: 12.5 }}>Messagerie client</div>
                    <div className="fst-num" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 4 }}>{number(row.messaging?.total)}</div>
                    <div className="fst-cell-muted" style={{ fontSize: 12 }}>{row.messaging?.total ? `${row.messaging.share} % des demandes` : "aucune demande"}</div>
                  </div>
                </div>
              </Card>

              {data.family?.length > 0 && (
                <Card title="Missions du process" Icon={ListTree} hint="Un clic ouvre le suivi de la mission.">
                  {data.family.map((item) => (
                    <button key={item.id} type="button" className="fst-row" onClick={() => onOpen(item.id)} style={{ gridTemplateColumns: "minmax(0, 1fr) 150px" }}>
                      <span className="fst-row-name">{item.name}<small>{countLabel(item.missions, "mission", "missions")}</small></span>
                      <Usage usage={item.usage} P={P} />
                    </button>
                  ))}
                </Card>
              )}

              {data.months?.length > 0 && data.monthsMax > 0 && (
                <Card title="Mois par mois" Icon={BarChart3} hint="En clair les missions réalisées, en sombre celles passées par le logiciel.">
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.months.length}, 1fr)`, gap: 5, alignItems: "end", height: 96 }}>
                    {data.months.map((month) => (
                      <div key={month.label} title={`${month.label} : ${countLabel(month.missions, "mission", "missions")}, dont ${month.used} par le logiciel`}
                        style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ position: "relative", height: `${Math.max(month.missions > 0 ? 4 : 0, (month.missions / data.monthsMax) * 100)}%`, background: "var(--bar)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${month.missions > 0 ? (month.used / month.missions) * 100 : 0}%`, background: "var(--charcoal)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.months.length}, 1fr)`, gap: 5, marginTop: 7 }}>
                    {data.months.map((month) => <span key={month.label} className="fst-cell-muted" style={{ fontSize: 10.5, textAlign: "center", overflow: "hidden" }}>{month.label.split(" ")[0]}</span>)}
                  </div>
                </Card>
              )}

              {data.poles?.length > 0 && (
                <Card title="Par pôle" Icon={Users} hint={data.leader ? `${data.leader.used ? "Le plus utilisateur" : "Le plus demandeur"} : ${data.leader.pole}.` : undefined}>
                  {data.poles.map((item, i) => (
                    <div key={item.pole} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, marginBottom: 6 }}>
                        <span style={{ fontWeight: 500 }}>{item.pole}</span>
                        <span className="fst-cell-muted fst-num" style={{ fontSize: 12.5 }}>{countLabel(item.missions, "mission", "missions")}</span>
                      </div>
                      <Usage usage={item.usage} P={P} />
                    </div>
                  ))}
                </Card>
              )}

              {(data.software?.length > 0 || data.notes?.length > 0 || data.dates?.length > 0) && (
                <Card title="Dans le logiciel" Icon={Layers}>
                  {data.software.map((item, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <Tag tone={item.usable ? "green" : undefined}>{item.kindLabel}</Tag>
                      <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 7 }}>{item.label}</div>
                      <div className="fst-cell-muted" style={{ fontSize: 12.5, whiteSpace: "normal" }}>{[item.dates, item.usage].filter(Boolean).join(" · ")}</div>
                    </div>
                  ))}
                  {data.notes.map((text, i) => <p key={i} className="fst-card-hint" style={{ margin: "6px 0 0" }}>{text}</p>)}
                  {data.dates?.length > 0 && (
                    <dl style={{ margin: "14px 0 0" }}>
                      {data.dates.map((item) => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "9px 0", borderTop: "1px solid var(--line-soft)", minWidth: 0 }}>
                          <dt style={{ fontSize: 13, color: "var(--ink-2)", minWidth: 0 }}>{item.label}{item.text && <span className="fst-cell-muted" title={item.text} style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{item.text}</span>}</dt>
                          <dd className="fst-num" style={{ margin: 0, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{item.date}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Card>
              )}

              <a href={row.url} target="_blank" rel="noopener noreferrer" className="ab-textlink" style={{ fontSize: 12.5, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5 }}>
                Ouvrir cette mission dans Opti&apos;Lex <ExternalIcon />
              </a>
            </div>
          </Reveal>
        </>
      )}
    </Page>
  );
}
