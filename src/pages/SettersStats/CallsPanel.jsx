// Panneau latéral « Appels du prospect » de la page CEO « Setters » : tout ce que le setter a fait vers CE prospect, jour par jour, rattaché à son RDV.
// Même présentation que la fiche d'un lead dans « Gestion des leads » (LeadHistoryPanel : classes .ps2-* de Perf Sales v2, frise à pastilles,
// icônes qui se dessinent), en trois parties titrées : « En bref », « Repères », « Appels ». Chaque appel est une carte à blocs distincts :
// titre et durée, lecteur (visible dès l'ouverture : CallListen.jsx), résumé et étiquettes d'Allo, détails.
// Lecture seule. Données : la réponse de GET /ceo-dashboard/setters/{id}/prospect-calls (déjà chargée par la fiche du setter) ; logique pure et textes :
// ./setterCalls.js (testée).
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { EASE } from "../../components/perfSales/motion";
import "../../components/perfSales/v2/v2.css";
import "./CallsPanel.css";
import { AudioPlayer, NoRecording } from "./CallListen.jsx";
import useCallAudio, { stopListening } from "./useCallAudio.js";
import { CHANNEL_LABELS, ORIGIN_LABELS, OUTCOME_LABELS, fmtInt, fmtRdv } from "./settersStats.js";
import {
  callDetails, callTimeline, callTitle, entryFacts, fmtCallAt, fmtHourPadded, lastTags, tagCounts, tagLabel, tagTone,
} from "./setterCalls.js";

// Mêmes tracés que la frise de l'historique d'un lead (perfSales/v2/LeadHistory.jsx).
const ICON = {
  call: ["M5.5 3.5h3l1.6 4.2-2.1 1.5a11 11 0 0 0 6.8 6.8l1.5-2.1 4.2 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1z"],
  rdv_set: ["M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z", "M4 10h16", "M8 3.5v4M16 3.5v4", "M12 13v5M9.5 15.5h5"],
  rdv: ["M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z", "M4 10h16", "M8 3.5v4M16 3.5v4"],
};
// La couleur de la pastille d'un appel dit ce qui s'est passé (les jetons .ps2 suivent le mode sombre).
const TONE = { human: "var(--good-strong)", voicemail: "var(--warn)", no_answer: "var(--muted)", inbound: "var(--blue)" };
const FILTERS = [["all", "Tout"], ["human", "Répondus"], ["voicemail", "Répondeurs"], ["no_answer", "Sans réponse"], ["inbound", "Entrants"]];

function Glyph({ kind, color, delay }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[kind].map((d) => (
        <Motion.path key={d} d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: EASE, delay }} />
      ))}
    </svg>
  );
}

// Pastille d'étiquette d'Allo : la même que celle du tiroir (point + texte teinté), la teinte calculée sur le fond du panneau pour rester lisible sur les cartes grises.
const chip = (tone, text) => (
  <span className="sc-chip" style={{ color: tone, background: `color-mix(in srgb, ${tone} 11%, var(--card))` }}><i style={{ background: tone }} />{text}</span>
);

const appear = (delay) => ({ initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.35, ease: EASE, delay } });

function CallEvent({ row, setterId, dayLabel, delay, chips }) {
  const { item } = row;
  const audio = useCallAudio(setterId, item.id);
  const details = callDetails(row);
  const tone = TONE[item.state] || TONE.no_answer;
  const hour = fmtHourPadded(item.at);
  const tags = (item.tags || []).map((tag) => ({ tag, label: tagLabel(tag) }));
  return (
    <Motion.li className={`ps2-hist-ev sc-ev has-card${item.state === "human" ? " is-good" : ""}`} {...appear(delay)}>
      <span className="ps2-hist-time ps2-num">{hour}</span>
      <span className="ps2-hist-dot" style={{ color: tone }}><Glyph kind="call" color={tone} delay={delay + 0.05} /></span>
      <div className="sc-card">
        <div className="sc-card-head">
          <b>{callTitle(item)}</b>
          {details.duration && <span className="sc-dur ps2-num" title={details.durationLabel}>{details.duration}</span>}
        </div>
        {details.context && <span className="sc-sub">{details.context}</span>}
        {item.recorded ? <AudioPlayer audio={audio} label={`du ${dayLabel} à ${hour}`} expected={row.times.talk} /> : <NoRecording />}
        {item.summary && <div className="sc-summary"><span className="sc-eyebrow">Résumé d’Allo</span>{item.summary}</div>}
        {tags.length > 0 && <span className="sc-tags">{chips(tags)}</span>}
        {details.measures && <span className="sc-sub">{details.measures}</span>}
      </div>
    </Motion.li>
  );
}

function Landmark({ row, rdv, delay }) {
  const pose = row.type === "pose";
  const color = pose ? "var(--good-strong)" : "var(--navy)";
  return (
    <Motion.li className={`ps2-hist-ev sc-ev${pose ? " is-good" : ""}`} {...appear(delay)}>
      <span className="ps2-hist-time ps2-num">{fmtHourPadded(row.at)}</span>
      <span className="ps2-hist-dot" style={{ color }}><Glyph kind={pose ? "rdv_set" : "rdv"} color={color} delay={delay + 0.05} /></span>
      <span className="ps2-hist-body">
        <b>{pose ? "RDV posé" : "RDV prévu"}</b>
        <span className="ps2-hist-detail">{pose ? "Posé par ce setter" : [rdv.kind === "r1" ? "R1" : "R2", CHANNEL_LABELS[rdv.channel]].filter(Boolean).join(" · ")}</span>
      </span>
    </Motion.li>
  );
}

function Body({ target, setter, dark }) {
  const { entry, rdv } = target;
  const [filter, setFilter] = useState("all");
  const facts = useMemo(() => entryFacts(entry, { rdvAt: rdv.rdv_at }), [entry, rdv.rdv_at]);
  const counts = useMemo(() => tagCounts(entry), [entry]);
  const last = useMemo(() => lastTags(entry), [entry]);
  const groups = useMemo(() => callTimeline(entry, { rdvAt: rdv.rdv_at }), [entry, rdv.rdv_at]);
  const shown = useMemo(() => (filter === "all" ? groups
    : groups.map((g) => ({ ...g, events: g.events.filter((e) => e.type === "call" && e.item.state === filter) })).filter((g) => g.events.length)), [groups, filter]);
  const chips = (tags) => tags.map((t) => <Fragment key={t.tag}>{chip(tagTone(t.tag, dark), t.n ? `${t.label} · ${t.n}` : t.label)}</Fragment>);
  const number = (n) => fmtInt(n || 0);
  const present = FILTERS.filter(([key]) => key === "all" || (entry.items || []).some((i) => i.state === key));
  const name = rdv.company || rdv.full_name || "Prospect sans nom";
  const sub = [rdv.company && rdv.full_name ? rdv.full_name : null, ORIGIN_LABELS[rdv.origin] || rdv.origin, CHANNEL_LABELS[rdv.channel]].filter(Boolean).join(" · ");
  return (
    <>
      <div className="ps2-hist-head">
        <h2>{name}</h2>
        {sub && <div className="ps2-hist-sub">{sub}</div>}
        <div className="ps2-hist-chips">
          <span>Setter <b>{setter.name}</b></span>
          <span>{rdv.kind === "r1" ? "R1" : "R2"} <b>{fmtRdv(rdv.rdv_at)}</b></span>
          {OUTCOME_LABELS[rdv.outcome] && <span>Résultat <b>{OUTCOME_LABELS[rdv.outcome]}</b></span>}
        </div>
      </div>
      <section className="sc-section">
        <h3 className="sc-title">En bref</h3>
        <div className="ps2-hist-facts">
          {[["Appels sortants", entry.outbound], ["Répondus", entry.human], ["Répondeurs", entry.voicemail], ["Sans réponse", entry.no_answer]]
            .map(([label, value]) => <span key={label}><b className="ps2-num">{number(value)}</b>{label}</span>)}
        </div>
      </section>
      {(facts.length > 0 || counts.length > 0 || last) && (
        <section className="sc-section">
          <h3 className="sc-title">Repères</h3>
          <dl className="sc-facts">
            {facts.map((f) => (
              <div key={f.key}><dt>{f.label}</dt><dd>{f.value}{f.note && <span className="sc-note">{f.note}</span>}</dd></div>
            ))}
            {counts.length > 0 && <div><dt>Issues relevées par Allo</dt><dd className="sc-chips">{chips(counts)}</dd></div>}
            {last && <div><dt>Dernière issue</dt><dd><span className="sc-chips">{chips(last.tags)}</span><span className="sc-note">{fmtCallAt(last.at)}</span></dd></div>}
          </dl>
        </section>
      )}
      <section className="sc-section">
        <div className="sc-section-head">
          <h3 className="sc-title">Appels · {number((entry.items || []).length)}</h3>
          {present.length > 2 && (
            <div className="ps2-hist-filters" role="tablist" aria-label="Appels affichés">
              {present.map(([key, label]) => (
                <button type="button" key={key} role="tab" aria-selected={filter === key} className={filter === key ? "is-on" : ""} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
          )}
        </div>
        <ol className="ps2-hist-days">
          {shown.map((group, di) => (
            <li key={group.key}>
              <div className="ps2-hist-day">{group.label}{group.summary && <span className="sc-day-sum"> · {group.summary}</span>}</div>
              <ol className="ps2-hist-list">
                {group.events.map((row, i) => {
                  const delay = Math.min(di * 0.05 + i * 0.03, 0.8);
                  return row.type === "call"
                    ? <CallEvent key={row.key} row={row} setterId={setter.id} dayLabel={group.label} delay={delay} chips={chips} />
                    : <Landmark key={row.key} row={row} rdv={rdv} delay={delay} />;
                })}
              </ol>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// `target` = { entry, rdv } (la fiche d'appels du prospect et la ligne du RDV) ou null. `zBase` place le panneau au-dessus du tiroir du setter.
export default function CallsPanel({ target, setter, dark, onClose, zBase = 2000 }) {
  const asideRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const open = Boolean(target);
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    asideRef.current?.focus({ preventScroll: true });
    // Échap ferme ce panneau seulement (le tiroir du setter reste ouvert) ; le focus revient sur la ligne qui l'a ouvert.
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      stopListening();
      before?.focus?.({ preventScroll: true });
    };
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {target && (
        <div className={`ps2${dark ? " is-dark" : ""}`} style={{ display: "contents" }}>
          <Motion.div className="ps2-overlay" style={{ zIndex: zBase }} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <Motion.div ref={asideRef} tabIndex={-1} className="ps2-panel ps2-hist-panel sc-panel" style={{ zIndex: zBase + 1 }} role="dialog" aria-modal="true"
            aria-label={`Appels vers ${target.rdv.company || target.rdv.full_name || "ce prospect"}`}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="ps2-panel-head">
              <span className="ps2-mono">Appels du prospect</span>
              <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="ps2-panel-body">
              <Body key={`${target.rdv.lead_id}-${target.rdv.kind}`} target={target} setter={setter} dark={dark} />
            </div>
          </Motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
