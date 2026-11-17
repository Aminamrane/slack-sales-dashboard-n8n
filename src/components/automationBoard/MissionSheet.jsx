// Fiche d'une mission ou d'un process, à droite de la liste (dev 17/11/2026 : « on est obligé de rentrer dans la fiche pour
// continuer le suivi », « elle n'est même pas dans le style du board ou de la finance »). La mission ne remplace plus la
// liste : elle s'ouvre en fiche de droite, sur le modèle de la fiche de Finance (`fd-`), et la liste reste sous la main ;
// un clic sur une autre ligne change de mission. Le plein écran redonne la page entière.
// En tête : le nom, l'état (l'étiquette se clique), l'étape en grand avec sa frise, puis à qui c'est de jouer et son geste.
// Dessous, quatre rubriques : Suivi (les deux voix, les commentaires), Parcours (la frise datée, commentable), Documents
// (le cahier des charges), Chiffres (classement, utilisation mois par mois, par pôle, dans le logiciel).
// Une étape, un classement ou un commentaire partagé posé ici est enregistré dans Opti'Lex au nom de la personne
// connectée ; la validation par la direction du cabinet reste dans Opti'Lex.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../../services/apiClient";
import { countLabel, dayLabel, errorText, gestureCall, journey, missionComments, periodHint, rowFollow, sizeLabel, stateChoices, turnOf, voices } from "../../utils/automationBoard";
import { AnimatePresence, MotionConfig, motion as Motion } from "framer-motion";
import { BarChart3, Check, CloudUpload, Code2, FileText, FlaskConical, Layers, ListTree, Lock, Maximize2, MessageCircle, Minimize2, Route, Send, Tags, Users, Wrench, X } from "lucide-react";
import { Empty, Tag } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import "../../pages/TrackingSheetFinance/components/ExchangeThread.css";
import "../../pages/TrackingSheetFinance/components/DetailLayout.css";
import { ExternalIcon, Face, Usage } from "./parts";
import { Composer, Feedback, Files } from "./Followup.jsx";
import Journey from "./Journey.jsx";
import { Hero, Voices } from "./MissionHero.jsx";
import StateMenu from "./StateMenu.jsx";
import { PlanCell } from "./RowFollow.jsx";
import { FILE_ACCEPT, followupApi, partnerFile, pickFiles } from "./followupApi.js";
import { TONE_OF } from "./theme";

const API = "/api/v1/optilex/automation-board";
const NO_FOLLOW = { available: false, entries: [], reactions: {} };
const NOTE_MAX = 2000;
const TURN_ICON = { lawyer: FlaskConical, dev: Wrench, done: Check, idle: Code2, build: Code2 };
const SPRING = { type: "spring", stiffness: 520, damping: 40 };

// La coque : un panneau blanc détaché des bords, qui glisse depuis la droite ; la croix flotte à sa gauche.
export default function MissionSheet({ id, onClose, ...rest }) {
  const [full, setFull] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {id && !full && (
          <Motion.button key="sheet-close" type="button" className="fd-close ab-sheet-close" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer la fiche"
            initial={{ opacity: 0, scale: 0.7, x: 12 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.7, x: 12, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 520, damping: 30, delay: 0.1 }}>
            <X size={17} strokeWidth={2} />
          </Motion.button>
        )}
        {id && (
          <Motion.aside key="sheet" className={`ab-sheet${full ? " is-full" : ""}`} aria-label="Fiche de la mission"
            initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 56, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="fd-scroll ab-sheet-scroll" data-wide={full ? "true" : undefined}>
              <div className="fd-wrap fst-root fst-embed">
                <SheetBody key={id} id={id} onClose={onClose} full={full} onFull={() => setFull((value) => !value)} {...rest} />
              </div>
            </div>
          </Motion.aside>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

// Une rubrique de la fiche : titre à picto, une phrase d'indice, puis le contenu.
function Sec({ title, Icon, hint, children }) {
  return (
    <section className="ab-sec">
      <h4 className="fd-block-title">{React.createElement(Icon, { size: 16, strokeWidth: 1.7 })}{title}</h4>
      {hint && <p className="fd-block-hint">{hint}</p>}
      <div className="ab-sec-body">{children}</div>
    </section>
  );
}

function SheetBody({ id, period, frame, onClose, onOpen, onChanged, P, full, onFull, people = [], me = "" }) {
  const [tab, setTab] = useState("follow");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Suivi côté Owner : points d'avancement, documents, commentaires, réactions. Absent tant que le serveur ne le sert pas.
  const [follow, setFollow] = useState(NO_FOLLOW);
  const [audience, setAudience] = useState("shared");
  const [drop, setDrop] = useState({ busy: false, error: "", over: false });
  // À qui de jouer : le mot qui accompagne le geste, l'étape choisie sur la frise, et l'envoi en cours.
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(null);
  const [acting, setActing] = useState({ busy: "", error: "" });
  // Classement : la valeur choisie tant qu'elle n'est pas enregistrée.
  const [rank, setRank] = useState(null);
  const [saved, setSaved] = useState("");
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
  const said = useMemo(() => voices(data?.row, data?.history, follow.entries), [data, follow]);
  const owned = follow.available;
  const shared = !owned || audience === "shared";
  const locked = Boolean(row?.validated);
  const last = Math.max(1, steps.length - 1);
  const stepNow = steps.find((item) => item.value === row?.step);
  const turn = useMemo(() => turnOf(row, steps, locked), [row, steps, locked]);
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

  // Un geste du suivi, ou une étape choisie sur la frise : un clic l'enregistre dans Opti'Lex, qui fait suivre le
  // classement. Le mot écrit au-dessus part avec ; il est obligatoire pour demander une modification.
  const send = async (key, call, done) => {
    if (acting.busy || !row) return;
    setSaved("");
    setActing({ busy: key, error: "" });
    try {
      await call();
      setNote("");
      setPicked(null);
      setActing({ busy: "", error: "" });
      setSaved(done);
      await load();
      onChanged();
    } catch (err) {
      setActing({ busy: "", error: errorText(err, "Le geste n’a pas été enregistré.") });
      if (err?.status === 409) load();
    }
  };
  const act = (gesture) => {
    const text = note.trim().slice(0, NOTE_MAX);
    if (gesture.needsNote && !text) { setActing({ busy: "", error: gesture.missing || "Dites ce qu’il faut modifier : c’est ce que les développeurs liront." }); return; }
    if (gesture.action) send(gesture.key, () => apiClient.post(`${API}/${id}/action`, { action: gesture.action, note: text || null }), gesture.action);
    else send(gesture.key, () => apiClient.post(`${API}/${id}/classification`, { classification: row.classification, step: gesture.step, comment: text || null }), "step");
  };
  // Le menu d'état (17/11/2026) : l'étiquette se clique, on choisit l'état, un clic l'enregistre. Rend vrai si c'est fait.
  const [stateMenu, setStateMenu] = useState({ busy: "", error: "" });
  const chooseState = async (choice, text) => {
    if (stateMenu.busy || !row) return false;
    setSaved("");
    setStateMenu({ busy: choice.key, error: "" });
    try {
      const comment = text ? text.slice(0, NOTE_MAX) : null;
      if (choice.action) await apiClient.post(`${API}/${id}/action`, { action: choice.action, note: comment });
      else await apiClient.post(`${API}/${id}/classification`, { classification: row.classification, step: choice.step, comment });
      setStateMenu({ busy: "", error: "" });
      setSaved(choice.action || "step");
      await load();
      onChanged();
      return true;
    } catch (err) {
      setStateMenu({ busy: "", error: errorText(err, "L’état n’a pas été enregistré.") });
      if (err?.status === 409) load();
      return false;
    }
  };
  // Le responsable et la date cible, posés depuis la fiche comme depuis la ligne.
  const follow0 = useMemo(() => (row ? rowFollow(row, steps) : null), [row, steps]);
  const applyPlan = async (target, gesture, text) => {
    const call = gestureCall(target, gesture, text);
    await apiClient.post(`${API}/${id}/${call.path}`, call.body);
    await load();
    onChanged();
  };
  const savePicked = () => send("pick", () => apiClient.post(`${API}/${id}/classification`, { classification: row.classification, step: picked, comment: note.trim().slice(0, NOTE_MAX) || null }), "step");
  // « À confirmer » : le classement proposé par le logiciel, que personne n'a revu. Le renvoyer tel quel le confirme.
  const confirmRank = () => send("confirm", () => apiClient.post(`${API}/${id}/classification`, { classification: row.classification, step: row.step, comment: null }), "confirm");
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
      setRank((state) => state && { ...state, busy: false, error: errorText(err, "Le classement n’a pas été enregistré.") });
      if (err?.status === 409) load();
    }
  };

  const classification = classifications.find((item) => item.value === row?.classification);
  const choices = useMemo(() => (row ? stateChoices(row, steps, turn) : []), [row, steps, turn]);
  const menu = { choices, onChoose: chooseState, busy: stateMenu.busy, error: stateMenu.error, locked, validated: row?.validated, url: row?.url };
  // Cahier des charges : les documents déposés depuis Owner, puis ceux que le cabinet a déposés dans Opti'Lex. Tous se
  // téléchargent ici.
  const docs = [
    ...follow.entries.filter((entry) => entry.kind === "document").flatMap((entry) => entry.files.map((file) => ({ key: file.id, name: file.file_name, meta: [sizeLabel(file.byte_size), entry.author_name, new Date(entry.created_at).toLocaleDateString("fr-FR")], file }))),
    ...(data?.attachments || []).map((file, i) => ({ key: `x${i}`, name: file.name, meta: [sizeLabel(file.size), file.by, file.at, "déposé dans Opti’Lex"], file: partnerFile(file) })),
  ];
  const fileInput = useRef(null);
  const tabs = [
    { key: "follow", label: "Suivi", count: comments.length },
    { key: "journey", label: "Parcours" },
    { key: "docs", label: "Documents", count: docs.length },
    { key: "figures", label: "Chiffres" },
  ];
  const sub = data?.parent ? `Mission du process « ${data.parent.name} »` : row?.isParent ? `Process qui regroupe ${countLabel(row.members, "mission", "missions")}` : row ? "Mission de la nomenclature d’Opti’Lex" : "";
  return (
    <>
      <div className="fd-top">
        <div className="ab-sheet-head">
          <h2 className="ab-sheet-title">{row?.name || (error ? "Fiche indisponible" : "Chargement…")}</h2>
          {sub && <p className="ab-sheet-sub">{sub}</p>}
        </div>
        <div className="fd-top-actions">
          <button type="button" className="fd-icon-btn fd-icon-btn--ring" onClick={onFull} title={full ? "Réduire la fiche" : "Étendre en plein écran"} aria-label={full ? "Réduire la fiche" : "Étendre en plein écran"}>
            {full ? <Minimize2 size={15} strokeWidth={1.8} /> : <Maximize2 size={15} strokeWidth={1.8} />}
          </button>
          {full && <button type="button" className="fd-icon-btn fd-icon-btn--close" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer la fiche"><X size={15} strokeWidth={1.9} /></button>}
        </div>
      </div>
      {row && (
        <div className="ab-tags ab-sheet-tags">
          <StateMenu {...menu} tone={TONE_OF[row.classification]} label={`${classification?.help || "Classement de la mission"} Cliquez pour changer l’état.`}>{classification?.label || "Non classée"}</StateMenu>
          {row.pole?.label && <Tag>{row.pole.label}</Tag>}
          <PlanCell row={row} follow={follow0} people={people} me={me} onApply={applyPlan} wide />
          {row.validated && <Tag tone="green"><Lock size={12} strokeWidth={2.2} />Validé par la direction</Tag>}
          {!row.validated && row.toConfirm && <Tag tone="peach" title="Classement proposé par le logiciel, que personne n’a encore revu.">Classement à confirmer</Tag>}
          {!row.validated && row.toConfirm && <button type="button" className="ab-textlink" style={{ fontSize: 12.5 }} disabled={Boolean(acting.busy)} onClick={confirmRank}>{acting.busy === "confirm" ? "Confirmation…" : "Confirmer ce classement"}</button>}
          {data.parent && <button type="button" className="ab-textlink" style={{ fontSize: 12.5, marginLeft: 4 }} onClick={() => onOpen(data.parent.id)}>Voir le process</button>}
        </div>
      )}

      {error && <div className="fst-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      {!row && !error && <div className="ab-sheet-wait" aria-busy="true"><i /><i /><i /></div>}

      {row && (
        <>
          {/* L'étape en grand, la frise qui se clique, les chiffres clés. */}
          <Hero row={row} steps={steps} stepNow={stepNow} last={last} since={since}
            tags={(
              <>
                {turn.working && <Tag tone="blue">En cours chez les développeurs</Tag>}
                {/* « Chez les développeurs » ne dit rien de plus quand ils y travaillent déjà. */}
                {locked ? <StateMenu {...menu}>Validé le {row.validated.at}</StateMenu> : !(turn.working && turn.who === "build") && <StateMenu {...menu} tone={turn.tone}>{turn.tag}</StateMenu>}
              </>
            )}
            onPick={locked ? undefined : setPicked} picked={picked}
            pickBar={picked != null && (
              <div className="ab-pick-save" role="group" aria-label="Changer l’étape">
                <span>Passer la mission à « {steps.find((item) => item.value === picked)?.label} » ? Le classement suivra tout seul.</span>
                <button type="button" className="fst-btn" disabled={Boolean(acting.busy)} onClick={() => setPicked(null)}>Annuler</button>
                <button type="button" className="ab-btn-main" disabled={Boolean(acting.busy)} onClick={savePicked}><Check size={15} />{acting.busy === "pick" ? "Enregistrement…" : "Enregistrer l’étape"}</button>
              </div>
            )}
            footnote={locked ? <p className="ab-note">Validé par la direction du cabinet ({row.validated.by}) : l’étape et le classement ne changent plus. La direction peut lever la validation dans Opti’Lex.</p>
              : row.step === last && !row.awaiting ? <p className="ab-note">Il reste la validation, qui se fait dans Opti’Lex par la direction du cabinet.</p> : null} />

          {/* La suite : à qui de jouer, et son geste en un clic. Le mot écrit part avec. */}
          <div className="ab-next">
            <div className={`ab-turn is-${turn.who}`}>
              <div className="ab-turn-head">
                <span className="ab-turn-ico" aria-hidden="true">{React.createElement(TURN_ICON[turn.who], { size: 16, strokeWidth: 1.9 })}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="ab-turn-title">{turn.title}</div>
                  <div className="ab-turn-hint">{turn.hint}</div>
                </div>
              </div>
              {turn.quote && <blockquote className="ab-turn-quote">{turn.quote}</blockquote>}
              {turn.working && (
                <div className="ab-turn-working">
                  <strong>Les développeurs y travaillent</strong> depuis le {String(turn.working.since).slice(0, 10)}, par {turn.working.by}
                  {turn.working.updatedAt !== turn.working.since && <> · dernier point le {String(turn.working.updatedAt).slice(0, 10)}, par {turn.working.updatedBy}</>}.
                </div>
              )}
              {turn.working?.text && <blockquote className="ab-turn-quote">{turn.working.text}</blockquote>}
              <textarea className="ab-turn-note" rows={2} value={note} maxLength={NOTE_MAX} placeholder={turn.placeholder} aria-label="Un mot qui s’inscrit au parcours"
                onChange={(e) => { setNote(e.target.value); if (acting.error) setActing({ busy: "", error: "" }); }} />
              <div className="ab-turn-btns">
                {turn.actions.map((gesture) => (
                  <button key={gesture.key} type="button" className={gesture.primary ? "ab-btn-main" : "fst-btn"} disabled={Boolean(acting.busy)} onClick={() => act(gesture)}>
                    {gesture.primary && (gesture.action === "approve" ? <Check size={15} /> : <Send size={15} />)}
                    {acting.busy === gesture.key ? "Enregistrement…" : gesture.label}
                  </button>
                ))}
                {acting.error && <span className="ab-turn-error" role="alert">{acting.error}</span>}
                {!acting.error && saved && saved !== "rank" && (
                  <span className="ab-state-saved" role="status">
                    {{ deliver: "Version livrée : le juriste est attendu.", approve: "Version validée.", request_change: "Modification demandée : les développeurs sont attendus.",
                      start: "Noté : les développeurs y travaillent.", progress: "Point d’avancement noté.", pause: "Mission mise de côté.",
                      step: "Étape enregistrée ; le classement a suivi.", confirm: "Classement confirmé." }[saved]} Inscrit au parcours, dans Opti’Lex.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Les rubriques, collées en haut de la fiche quand on descend. */}
          <div className="fd-tabs-anchor" aria-hidden="true" />
          <div className="fd-tabs" role="tablist" aria-label="Rubriques de la fiche"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const index = tabs.findIndex((item) => item.key === tab);
              const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              setTab(next.key);
              e.currentTarget.querySelector(`#ab-tab-${next.key}`)?.focus();
            }}>
            {tabs.map((item) => (
              <button key={item.key} type="button" role="tab" id={`ab-tab-${item.key}`} aria-selected={tab === item.key} aria-controls={`ab-panel-${item.key}`} tabIndex={tab === item.key ? 0 : -1}
                className={`fd-tab${tab === item.key ? " is-active" : ""}`} onClick={() => setTab(item.key)}>
                {item.label}
                {item.count > 0 && <span className="fd-tab-n">{item.count}</span>}
                {tab === item.key && <Motion.span layoutId="abSheetTab" className="fd-tab-line" transition={SPRING} />}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="ab-panel-follow" aria-labelledby="ab-tab-follow" hidden={tab !== "follow"} className="fd-tabpanel ab-panel">
            {/* Les deux voix de la mission : où en sont les développeurs, et le dernier avis du juriste. */}
            <Voices voices={said} turn={turn} />
            <Sec title="Commentaires de la mission" Icon={MessageCircle}
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
                        <span className="fx-head-end">
                          {item.target != null && steps.find((step) => step.value === item.target) && <Tag title="Dans Opti’Lex, ce commentaire est rangé sous cette étape du parcours">{steps.find((step) => step.value === item.target).label}</Tag>}
                          {item.shared ? <Tag tone="blue">Partagé avec le cabinet</Tag> : <Tag>Interne</Tag>}
                        </span>
                      </header>
                      {item.text && <div className="fx-text">{item.text}</div>}
                      <Files processId={id} files={item.files} />
                      <Feedback processId={id} itemKey={item.key} follow={follow} onChanged={loadFollow} entryId={item.id} mine={item.mine} replyLabel="Répondre" />
                    </article>
                  ))}
                </div>
              </div>
            </Sec>
          </div>

          <div role="tabpanel" id="ab-panel-journey" aria-labelledby="ab-tab-journey" hidden={tab !== "journey"} className="fd-tabpanel ab-panel">
            <Sec title="Parcours de l’automatisation" Icon={Route}
              hint="Chaque étape, quand elle a été franchie et par qui, avec ce qui s’est passé entre-temps. Tout se commente.">
              <Journey processId={id} milestones={milestones} follow={follow} owned={owned} onUpdate={sendUpdate} onChanged={loadFollow} />
            </Sec>
          </div>

          <div role="tabpanel" id="ab-panel-docs" aria-labelledby="ab-tab-docs" hidden={tab !== "docs"} className="fd-tabpanel ab-panel">
            <Sec title="Cahier des charges" Icon={FileText}
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
            </Sec>
          </div>

          <div role="tabpanel" id="ab-panel-figures" aria-labelledby="ab-tab-figures" hidden={tab !== "figures"} className="fd-tabpanel ab-panel">
            <Sec title="Classement" Icon={Tags} hint={`${classification?.help || "Ce que la mission est aujourd’hui pour le cabinet."} Il suit l’étape tout seul ; le changer ici fait suivre l’étape.`}>
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
            </Sec>

            {data.family?.length > 0 && (
              <Sec title="Missions du process" Icon={ListTree} hint="Un clic ouvre le suivi de la mission.">
                {data.family.map((item) => (
                  <button key={item.id} type="button" className="fst-row" onClick={() => onOpen(item.id)} style={{ gridTemplateColumns: "minmax(0, 1fr) 150px" }}>
                    <span className="fst-row-name">{item.name}<small>{countLabel(item.missions, "mission", "missions")}</small></span>
                    <Usage usage={item.usage} P={P} />
                  </button>
                ))}
              </Sec>
            )}

            {data.months?.length > 0 && data.monthsMax > 0 && (
              <Sec title="Utilisation mois par mois" Icon={BarChart3} hint={`En clair les missions réalisées, en sombre celles passées par le logiciel. ${row.usage ? row.usage.detail : `Aucun module du logiciel ne couvre cette mission : rien à mesurer sur les ${periodHint(data.period)}.`}`}>
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
              </Sec>
            )}

            {data.poles?.length > 0 && (
              <Sec title="Par pôle" Icon={Users} hint={data.leader ? `${data.leader.used ? "Le plus utilisateur" : "Le plus demandeur"} : ${data.leader.pole}.` : undefined}>
                {data.poles.map((item, i) => (
                  <div key={item.pole} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, marginBottom: 6 }}>
                      <span style={{ fontWeight: 500 }}>{item.pole}</span>
                      <span className="fst-cell-muted fst-num" style={{ fontSize: 12.5 }}>{countLabel(item.missions, "mission", "missions")}</span>
                    </div>
                    <Usage usage={item.usage} P={P} />
                  </div>
                ))}
              </Sec>
            )}

            {(data.software?.length > 0 || data.notes?.length > 0 || data.dates?.length > 0) && (
              <Sec title="Dans le logiciel" Icon={Layers}>
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
              </Sec>
            )}

            <a href={row.url} target="_blank" rel="noopener noreferrer" className="ab-textlink" style={{ fontSize: 12.5, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5 }}>
              Ouvrir cette mission dans Opti&apos;Lex <ExternalIcon />
            </a>
          </div>
        </>
      )}
    </>
  );
}
