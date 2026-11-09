// Parcours « Faire l'onboarding » (board, Client Success). Un pop-up guidé en cinq étapes :
// 1. la situation du client (état, finance, contrats), 2. les rendez-vous de lancement (fiscal et
// social reprogrammables sans quitter le parcours),
// 3. la convention Opti'Lex (prévenir Lisa), 4. la météo d'onboarding qui finalise la fiche,
// 5. la clôture : réalisé (un bouton, puis confettis et ticket « Bravo » ; à la fermeture, le billet de la fiche se
// découpe tout seul, dev 29/10/2026), ou à recaler (avec ou sans date). Règle finance affichée telle que le moteur
// l'applique : le jour J, rien n'est dû avant la fin du rendez-vous.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import { AlertCabinetBlock } from "./CabinetAlertBlock";
import { parisInstantLabel } from "../utils/parisDates";
import { OnboardingRatingForm } from "./BoardIntegrationSheet";
import { METEO_MEANING, MeteoIcon, meteoStyle } from "./meteo.jsx";
import { WEATHER, weatherPresentation } from "../utils/weatherCase";
import BoardOnboardingDateCorrection from "./BoardOnboardingDateCorrection";
import { onboardingDateOf } from "../utils/boardIntegration";
import { displayEtat } from "../utils/boardClientState";
import { Barcode, ConfettiBurst, OnboardedPass } from "./OnboardingPass.jsx";
import { Art, FolderCard, ListRow, Panel, Stat, Tag } from "./DashParts.jsx";
import "./OnboardingFlowModal.css";

const NAVY = "#1e2330";
const TEXT = "#1e2330"; // texte des avertissements météo (main 3fac728)
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const CARD = "#ffffff";
const GREEN = "#15794a";
const BRAND = "#3e7d5a";
const AMBER = "#b45309";
const RED = "#b42318";
const EASE = [0.16, 1, 0.3, 1];

const STEPS = [
  { key: "situation", title: "Situation du client", hint: "Où en est le client, en finance et dans ses contrats" },
  { key: "rdv", title: "Rendez-vous de lancement", hint: "Fiscal et social" },
  { key: "optilex", title: "Convention Opti'Lex", hint: "Signée, en attente, ou à relancer par le cabinet partenaire" },
  { key: "meteo", title: "Météo d'onboarding", hint: "Votre note finalise la fiche d'intégration" },
  { key: "cloture", title: "Clôture", hint: "Réalisé, ou à recaler" },
];

const fmtDate = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const fmtDT = (iso) => {
  const base = fmtDate(iso);
  if (!base) return "";
  const t = String(iso).match(/T(\d{2}):(\d{2})/);
  return t && (+t[1] || +t[2]) ? `${base} · ${t[1]}h${t[2]}` : base;
};
const euros = (n) => `${Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

const OPTILEX_LABELS = {
  scheduled: ["Envoi planifié", AMBER], awaiting_owner_signature: ["En attente de la signature Owner", AMBER],
  ongoing: ["Envoyée, en attente de signature", AMBER], done: ["Signée", GREEN], expired: ["Expirée", RED],
};
const PHASE_TONES = { done: GREEN, no_date: MUTED, before: BRAND, day_j: BRAND, billing: NAVY };
const PHASE_SHORT = { done: "Réalisé", no_date: "Sans date", before: "À venir", day_j: "Jour J", billing: "En cours" };

function Button({ children, onClick, primary, danger, disabled, small }) {
  const bg = disabled ? "#e9ebf0" : danger ? RED : primary ? NAVY : CARD;
  const color = disabled ? MUTED : (primary || danger) ? "#fff" : NAVY;
  return (
    <Motion.button type="button" whileTap={disabled ? undefined : { scale: 0.97 }} disabled={disabled} onClick={onClick}
      style={{ padding: small ? "7px 12px" : "10px 16px", borderRadius: 10, border: primary || danger || disabled ? "none" : `1px solid ${NAVY}`, background: bg, color,
        fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit" }}>
      {children}
    </Motion.button>
  );
}

// Copie un lien en un clic (lien Meet d'un RDV de lancement à donner au client).
function CopyButton({ text, label }) {
  const [state, setState] = useState(null); // null | "ok" | "ko"
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("ok"); } catch { setState("ko"); }
    setTimeout(() => setState(null), 1500);
  };
  return <Button small onClick={copy}>{state === "ok" ? "Lien copié ✓" : state === "ko" ? "Copie impossible" : label}</Button>;
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
      <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, background: "#fafbfc", fontFamily: "inherit" }} />
      <Button small onClick={() => { try { navigator.clipboard.writeText(url); } catch { /* sélection manuelle */ } setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copié ✓" : "Copier"}</Button>
      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: BRAND, textDecoration: "none", whiteSpace: "nowrap" }}>Ouvrir</a>
    </div>
  );
}

function SituationStep({ brief, row }) {
  const f = brief.finance;
  const cur = f?.current;
  const tone = f?.is_late ? AMBER : PHASE_TONES[brief.phase] || NAVY;
  const optilex = OPTILEX_LABELS[brief.contracts?.optilex_status] || [brief.contracts?.optilex_status ? brief.contracts.optilex_status : "Incluse au contrat Owner", MUTED];
  const ownerSigned = brief.contracts?.owner_status === "done";
  const signedCount = (ownerSigned ? 1 : 0) + (brief.contracts?.optilex_status === "done" || !brief.contracts?.optilex_status ? 1 : 0);
  const emailFixed = brief.client.email && row.email && brief.client.email.toLowerCase() !== String(row.email).toLowerCase();
  const late = (cur?.overdue_owner || 0) + (cur?.overdue_optilex || 0) + (f?.prior_owner || 0) + (f?.prior_optilex || 0);
  return (
    <div className="ofd">
      <div className="ofd-stats">
        <Stat i={0} label="État sur le board" value={displayEtat(row) || "—"} sub={brief.client.date_signature ? `signé le ${fmtDate(brief.client.date_signature)}` : null} art="check" />
        <Stat i={1} label="Finance" value={f?.is_late ? "En retard" : PHASE_SHORT[brief.phase] || "—"} tone={f?.is_late ? RED : undefined}
          sub={f?.is_late ? `${euros(late)} dus` : f?.billing_start ? `départ le ${fmtDate(f.billing_start).slice(0, 5)}` : "pas de départ"} art="coins" />
        <Stat i={2} label="Contrats signés" value={`${signedCount} / 2`} sub={optilex[0]} art="doc" />
      </div>
      <Panel title="Client">
        <div className="ofd-list">
          <ListRow icon="societe" label="Société"><b>{brief.client.societe || row.crm_societe || row.numero_client}</b></ListRow>
          <ListRow icon="contact" label="Contact">{brief.client.contact_name || "—"}</ListRow>
          <ListRow icon="email" label="E-mail d'envoi">{brief.client.email || "—"}{emailFixed && <Tag tone={AMBER}>corrigée</Tag>}</ListRow>
          <ListRow icon="phone" label="Téléphone">{brief.client.phone || "—"}</ListRow>
        </div>
      </Panel>
      <Panel title="Finance" aside={<Tag tone={tone}>{f?.is_late ? "Impayé en cours" : brief.phase_label}</Tag>}>
        <p className="ofd-note">
          {brief.phase === "day_j" && brief.onboarding.ends_at && <>Le client devient exigible après la fin du rendez-vous, vers {fmtDT(brief.onboarding.ends_at).split("·")[1]?.trim() || "la fin de l'heure"}. Avant, rien n'est dû.</>}
          {brief.phase === "before" && <>Rien n'est dû avant le rendez-vous d'onboarding{f?.billing_start ? ` du ${fmtDate(f.billing_start)}` : ""}.</>}
          {brief.phase === "billing" && !f?.is_late && <>Facturation démarrée{f?.billing_start ? ` le ${fmtDate(f.billing_start)}` : ""}, rien en retard.</>}
          {f?.is_late && <>Un impayé est en cours : à évoquer avec le client, sans bloquer l'onboarding.</>}
          {brief.phase === "no_date" && <>Aucune date d'onboarding connue : la facturation n'a pas de point de départ.</>}
          {brief.phase === "done" && <>Onboarding réalisé : la facturation suit son cours.</>}
        </p>
        {cur ? (
          <div className="ofd-money">
            <div><span>Attendu {fmtDate(f.month)?.slice(3) || "du mois"}</span><strong>{euros((cur.expected_owner || 0) + (cur.expected_optilex_ttc || 0))}</strong><small>Owner {euros(cur.expected_owner)} · Opti'Lex {euros(cur.expected_optilex_ttc)}</small></div>
            <div><span>Reçu ce mois</span><strong>{euros((cur.received_owner || 0) + (cur.received_optilex_ttc || 0))}</strong><small>Owner {euros(cur.received_owner)} · Opti'Lex {euros(cur.received_optilex_ttc)}</small></div>
            {late > 0 && <div className="is-late"><span>En retard</span><strong>{euros(late)}</strong><small>{(f.prior_owner > 0 || f.prior_optilex > 0) ? "dont créance antérieure" : "ce mois-ci"}</small></div>}
          </div>
        ) : <p className="ofd-note">Pas encore de ligne de facturation pour ce mois.</p>}
        {f?.etat_finance && <div className="ofd-list" style={{ marginTop: 10 }}><ListRow icon="bell" label="État finance (classeur)">{f.etat_finance}</ListRow></div>}
      </Panel>
      <Panel title="Dossier">
        <div className="ofd-folders">
          <FolderCard i={0} title="Contrat Owner" status={ownerSigned ? "Signé" : brief.contracts?.owner_status || "Non signé"} tone={ownerSigned ? GREEN : AMBER}>
            {ownerSigned && brief.contracts.owner_signed_at ? `le ${fmtDate(brief.contracts.owner_signed_at)}` : "en attente"}
          </FolderCard>
          <FolderCard i={1} title="Convention Opti'Lex" status={optilex[0].split(",")[0]} tone={optilex[1]}>
            {brief.contracts?.optilex_signed_at ? `le ${fmtDate(brief.contracts.optilex_signed_at)}` : brief.contracts?.optilex_sent_at ? `envoyée le ${fmtDate(brief.contracts.optilex_sent_at)}` : "—"}
          </FolderCard>
          {brief.sheet && (
            <FolderCard i={2} title="Fiche d'intégration" status={brief.sheet.final ? "Finalisée" : brief.sheet.available ? "À finaliser" : "En attente"}
              tone={brief.sheet.final ? GREEN : brief.sheet.available ? AMBER : MUTED}>
              {brief.sheet.final ? "météo posée" : brief.sheet.available ? "par votre météo" : "partie commerciale à finir"}
            </FolderCard>
          )}
          {brief.documents?.waiver && <FolderCard i={3} title="Pièces du dossier" status={brief.documents.waiver.early ? "Vente sans documents" : "Aucune"} tone={AMBER}>{brief.documents.waiver.label}</FolderCard>}
        </div>
        {/* Vente déclarée sans documents (main 24ac545) : pourquoi le dossier est incomplet. */}
        {brief.documents?.waiver?.early && <p className="ofd-note" style={{ marginTop: 10 }}>Le commercial n’a pas pu récupérer les documents avant l’onboarding (déclaration anticipée{brief.documents.waiver.days_before > 0 ? ` à J-${brief.documents.waiver.days_before}` : brief.documents.waiver.days_before === 0 ? " le jour J" : ""}).</p>}
        {brief.documents?.waiver?.early && brief.documents.waiver.note && <p className="ofd-note" style={{ marginTop: 4, overflowWrap: "anywhere" }}>Précision du commercial : « {brief.documents.waiver.note} »</p>}
      </Panel>
    </div>
  );
}

function RdvStep({ brief, onReschedule, onCancel }) {
  const a = brief.appointments;
  const today = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const card = (key, label, entry, kind, i) => (
    <div className="ofd-rdv" key={key} style={{ "--ofd-i": i }}>
      <div className="ofd-rdv-head">
        <span className="ofd-rdv-ic"><Art name="calendar" /></span>
        <div>
          <span>{label}</span>
          <strong>{entry?.at ? fmtDT(entry.at) : entry?.day ? fmtDate(entry.day) : "Pas encore de date"}</strong>
        </div>
        {entry?.done ? <Tag tone={GREEN}>Effectué</Tag> : entry?.reschedule_pending ? <Tag tone={AMBER}>À recaler</Tag> : entry?.at ? <Tag tone={BRAND}>Prévu</Tag> : null}
      </div>
      {entry?.meet_link && (
        <div className="ofd-list">
          {entry?.meet_link && <ListRow icon="video" label="Visio"><a href={entry.meet_link} target="_blank" rel="noreferrer">Rejoindre le Meet</a></ListRow>}
        </div>
      )}
      {/* Client absent : Vincent déplace le RDV sans quitter le parcours (même recalage que le board),
          ou copie le lien Meet pour le lui donner. */}
      {kind && entry?.at && !entry.done && (onReschedule || onCancel || entry.meet_link) && (
        <div className="ofd-actions">
          {onReschedule && <Button small primary onClick={() => onReschedule(kind)}>Reprogrammer</Button>}
          {entry.meet_link && <CopyButton text={entry.meet_link} label="Copier le lien Meet" />}
          {onCancel && String(entry.at).slice(0, 10) >= today && <button type="button" className="ofd-link is-danger" onClick={() => onCancel(kind)}>Annuler</button>}
        </div>
      )}
      {kind && !entry?.at && entry?.link && <CopyLink url={entry.link} />}
      {kind && !entry?.link && !entry?.at && <p className="ofd-note is-warn">Aucun lien de prise de rendez-vous pour ce client. Il sera créé au prochain passage automatique, sinon signalez-le.</p>}
    </div>
  );
  return (
    <div className="ofd">
      <div className="ofd-rdvs">
        {card("onb", "Onboarding Owner", { ...brief.onboarding, reschedule_pending: brief.onboarding.reschedule_pending }, null, 0)}
        {card("lanc", "Intégration Opti'Lex", a.lancement, null, 1)}
        {card("fisc", "Lancement fiscal", a.fiscal, "fiscal", 2)}
        {card("soc", "Lancement social", a.social, "social", 3)}
      </div>
    </div>
  );
}

function OptilexStep({ brief, num }) {
  const status = brief.contracts?.optilex_status;
  const label = OPTILEX_LABELS[status] || ["Incluse au contrat Owner", MUTED];
  const pending = ["scheduled", "ongoing", "expired", "awaiting_owner_signature"].includes(status);
  return (
    <div className="ofd">
      <div className="ofd-stats is-two">
        <Stat i={0} label="Convention Opti'Lex" value={label[0].split(",")[0]} tone={label[1]} sub={brief.contracts?.optilex_signed_at ? `signée le ${fmtDT(brief.contracts.optilex_signed_at)}` : brief.contracts?.optilex_sent_at ? `envoyée le ${fmtDT(brief.contracts.optilex_sent_at)}` : null} art="doc" />
        <Stat i={1} label="Cabinet partenaire prévenu" value={brief.last_cabinet_alert ? parisInstantLabel(brief.last_cabinet_alert.created_at).split(" · ")[0] : "Pas encore"}
          sub={brief.last_cabinet_alert?.author_name ? `par ${brief.last_cabinet_alert.author_name}` : null} art="envelope" />
      </div>
      <Panel title="Adresse d'envoi"><div className="ofd-list"><ListRow icon="email" label="Le client reçoit la convention à">{brief.contracts?.recipient_email || "—"}</ListRow></div></Panel>
      {pending ? (
        <Panel title="Prévenir le cabinet"><AlertCabinetBlock numero={num} status={status} prefill={null} /></Panel>
      ) : <p className="ofd-note">Rien à faire côté convention.</p>}
    </div>
  );
}

function MeteoStep({ brief, num, onRated, rated, controlRef }) {
  const sheet = brief.sheet;
  const done = rated || sheet?.onboarding?.completed;
  if (!sheet || !sheet.has_form) {
    return <div className="ofd"><Panel title="Météo d'onboarding"><p className="ofd-note">Ce client n'a pas de fiche d'intégration Owner (ancien parcours). Notez votre ressenti dans la section « Météo client » de la fiche, il entre dans l'historique.</p></Panel></div>;
  }
  if (!sheet.available) {
    return <div className="ofd"><Panel title="Météo d'onboarding"><p className="ofd-note">La partie commerciale de la fiche n'est pas terminée : le commercial doit d'abord finaliser son passage de relais. Votre météo viendra ensuite.</p></Panel></div>;
  }
  if (done) {
    const w = rated?.onboarding || sheet.onboarding;
    const currentWeather = w?.weather_context?.version === 2;
    const st = currentWeather ? weatherPresentation(w?.weather, w.weather_context) : meteoStyle(w?.weather);
    const label = currentWeather ? st?.label : w?.weather ? `${w.weather}/5, ${METEO_MEANING[w.weather]?.txt || ""}` : null;
    return (
      <div className="ofd">
        <Panel title="Météo d'onboarding">
          <div className="ofd-meteo-done">
            {st && <span style={{ background: st.bg }}><MeteoIcon score={w.weather} size={22} color={st.color} /></span>}
            <div><strong>Fiche finalisée : {label || "note enregistrée"}</strong><small>{w?.author_name ? `par ${w.author_name}` : ""}{w?.completed_at ? ` le ${fmtDate(w.completed_at)}` : ""}</small></div>
          </div>
        </Panel>
      </div>
    );
  }
  return (
    <div className="ofd">
      <Panel title="Votre météo d'onboarding">
        <p className="ofd-note">Le commercial a posé sa météo à la vente. La vôtre s'ajoute à la suite et finalise la fiche d'intégration ; elle entre aussi dans l'historique météo du client.</p>
        <OnboardingRatingForm numero={num} compact onSaved={onRated} controlRef={controlRef} />
      </Panel>
    </div>
  );
}

// ── Clôture (dev 29/10/2026 : « ils n'ont pas à découper, ils terminent et le billet principal se détache tout seul ») :
// un récapitulatif et un bouton ; le ticket « Bravo » suit, puis, la fenêtre fermée, le billet de la fiche se découpe.
const fmtDayMonth = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return "";
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${+m[3]} ${months[+m[2] - 1]}${m[4] && (+m[4] || +m[5]) ? ` · ${m[4]}h${m[5]}` : ""}`;
};
const meteoLabelOf = (brief, rated) => {
  const w = rated?.onboarding || brief.sheet?.onboarding;
  if (!w?.weather) return null;
  const st = w.weather_context?.version === 2 ? weatherPresentation(w.weather, w.weather_context) : meteoStyle(w.weather);
  return { score: w.weather, label: w.weather_context?.version === 2 ? st?.label : METEO_MEANING[w.weather]?.txt, st };
};
function FinishCard({ brief, row, num, rated, busy, onDone, weatherDue }) {
  const meteo = meteoLabelOf(brief, rated);
  const when = brief.onboarding.at || brief.onboarding.day;
  return (
    <Panel title="Terminer l'onboarding" className="ofd-finish">
      <div className="ofd-list">
        <ListRow icon="date" label="Rendez-vous d'onboarding">{when ? fmtDayMonth(when) : "—"}</ListRow>
        <ListRow icon="bell" label="Météo d'onboarding">{meteo ? <span className="ofd-finish-meteo" style={{ color: meteo.st?.color }}><MeteoIcon score={meteo.score} size={15} color={meteo.st?.color} />{meteo.label}</span> : "Pas encore notée"}</ListRow>
        <ListRow icon="societe" label="Client">{brief.client.societe || row.crm_societe || num} · {num}</ListRow>
      </div>
      <button type="button" className="ofd-finish-go" disabled={!!busy || weatherDue} onClick={onDone}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        {busy === "done" ? "Enregistrement…" : "Marquer l'onboarding réalisé"}
      </button>
    </Panel>
  );
}

const PARTY = <>
  <path d="M10 54 26 14l24 24Z" fill="#f7a23b" />
  <path d="M15.5 40.5 22 24M20.6 48 32 22M28 46.5 38 30" stroke="#e8553f" strokeWidth="4.2" strokeLinecap="round" />
  <path d="M10 54 26 14l24 24Z" fill="none" stroke="#d9762b" strokeWidth="1.6" strokeLinejoin="round" />
  <path d="M33 16c2-6 8-7 10-3M44 26c5-3 10 0 9 4M38 8l2-5M52 16l5-2M48 9l3-4" stroke="#3e7d5a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  <circle cx="56" cy="24" r="2.4" fill="#5b8def" /><circle cx="42" cy="5" r="2" fill="#e85d75" /><rect x="30" y="4" width="4" height="4" rx="1" fill="#f5b301" transform="rotate(20 32 6)" />
</>;
// Ticket « Bravo » (dev 29/10/2026, « way better… on ne voit même pas la météo, pas bien découpé ») : un vrai billet
// dessiné en SVG (encoches à la perforation, bord festonné en bas) mesuré à sa taille, entier dans la fenêtre ; la
// météo d'onboarding en tuile pastel avec son pictogramme, ou « À poser » avec le bouton pour la poser.
function CelebrationTicket({ brief, row, num, rated, onClose, onRate }) {
  const meteo = meteoLabelOf(brief, rated);
  const w = meteo ? WEATHER[meteo.score] : null;
  const now = new Date();
  const day = now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  const box = useRef(null);
  const perf = useRef(null);
  const [shape, setShape] = useState(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setShape({ w: el.offsetWidth, h: el.offsetHeight, c: perf.current?.offsetTop || 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Contour : coins arrondis en haut, encoches de part et d'autre de la perforation, festons en bas.
  const path = shape && ((W, H, c, r = 22, n = 16, f = 9) => {
    let d = `M${r} 0H${W - r}A${r} ${r} 0 0 1 ${W} ${r}V${c - n}A${n} ${n} 0 0 0 ${W} ${c + n}V${H - f}`;
    const count = Math.max(6, Math.round(W / (f * 2.4)));
    const step = W / count;
    for (let i = 0; i < count; i++) d += `A${step / 2} ${f} 0 0 1 ${W - step * (i + 1)} ${H - f}`;
    return `${d}V${c + n}A${n} ${n} 0 0 0 0 ${c - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  })(shape.w, shape.h, shape.c);
  return (
    <div className="of-bravo">
      <Motion.div ref={box} className="of-bravo-ticket" initial={{ opacity: 0, y: 26, scale: 0.94, rotate: -1.5 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}>
        {shape && (
          <svg className="of-bravo-shape" width={shape.w} height={shape.h} viewBox={`0 0 ${shape.w} ${shape.h}`} aria-hidden="true">
            <defs><filter id="of-bravo-sh" x="-12%" y="-8%" width="124%" height="122%"><feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#121b35" floodOpacity="0.13" /></filter></defs>
            <path d={path} fill="#fff" stroke="rgba(18,27,53,0.08)" filter="url(#of-bravo-sh)" />
          </svg>
        )}
        <div className="of-bravo-top">
          <Motion.svg width="62" height="58" viewBox="0 0 64 60" aria-hidden="true" initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.3 }}>{PARTY}</Motion.svg>
          <h3>Bravo !</h3>
          <p>L'onboarding de {brief.client.societe || row.crm_societe || num} est réalisé.</p>
        </div>
        <div ref={perf} className="of-bravo-perf" aria-hidden="true" />
        <div className="of-bravo-body">
          <div className="of-bravo-grid">
            <div><span>Client</span><strong>{brief.client.societe || row.crm_societe || "—"}</strong></div>
            <div className="is-right"><span>Dossier</span><strong>{num}</strong></div>
            <div><span>Réalisé le</span><strong>{day} · {time}</strong></div>
            <div className="is-right"><span>Passe</span><strong className="of-bravo-pass"><OnboardedPass size={15} />Onboardé</strong></div>
          </div>
          <div className="of-bravo-meteo" style={w ? { "--bm-tile": w.tile, "--bm-ink": w.ink } : undefined}>
            <span className="of-bravo-meteo-ic">{meteo ? <MeteoIcon score={meteo.score} size={26} color={w?.ink || meteo.st?.color} /> : <MeteoIcon score={5} size={24} color="#a3abba" />}</span>
            <div>
              <span>Météo d'onboarding</span>
              <strong>{meteo ? `${meteo.score}/5 · ${meteo.label}` : "Pas encore posée"}</strong>
            </div>
            {!meteo && onRate && <button type="button" className="of-bravo-rate" onClick={onRate}>Poser la météo</button>}
          </div>
          <div className="of-bravo-code"><Barcode value={num} height={38} width={200} className="of-barcode" /><span>{num}</span></div>
        </div>
      </Motion.div>
      <Motion.div className="of-bravo-actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.3 }}>
        <Button primary onClick={onClose}>Terminer</Button>
      </Motion.div>
    </div>
  );
}

function ClotureStep({ brief, row, num, rated, busy, onDone, onRescheduleWithDate, onRescheduleLater, note, setNote, weatherDue, onWeather }) {
  const alreadyDone = brief.onboarding.done;
  return (
    <>
      {/* La fiche attend la météo du Client Success (main 3fac728) : tant qu'elle manque, l'onboarding ne se conclut pas. */}
      {weatherDue && <section role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", border: "1px solid #f3dfb4", borderRadius: 12, background: "#fff7e6" }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: TEXT, lineHeight: 1.5 }}><strong style={{ color: AMBER }}>Météo d'onboarding pas encore posée.</strong> Elle finalise la fiche d'intégration : posez-la avant de conclure.</div>
        <Button small primary onClick={onWeather}>Poser la météo</Button>
      </section>}
      {alreadyDone ? (
        <Panel title="Onboarding déjà réalisé">
          <p className="ofd-note">Pour corriger sa date, utilisez « Modifier la date de réalisation » en haut du parcours. Les actions ci-dessous servent à prévoir un nouveau rendez-vous.</p>
        </Panel>
      ) : (
        <FinishCard brief={brief} row={row} num={num} rated={rated} busy={busy} onDone={onDone} weatherDue={weatherDue} />
      )}
      <Panel title="Pas encore réalisé ?" className="ofd-later">
        <p className="ofd-note">Ces deux issues laissent la fiche « à recaler » jusqu'à la nouvelle date.</p>
        <div className="ofd-choices">
          <button type="button" className="ofd-choice" disabled={!!busy} onClick={onRescheduleWithDate}>
            <span className="ofd-choice-art"><Art name="calendar" /></span>
            <strong>Je fixe la nouvelle date</strong><small>Le recalage s'ouvre tout de suite</small>
          </button>
          <div className="ofd-choice is-form">
            <strong>À recaler, sans date</strong>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Pourquoi, et quand rappeler (facultatif)" />
            <Button small disabled={!!busy} onClick={onRescheduleLater}>{busy === "later" ? "Enregistrement…" : brief.onboarding.reschedule_pending ? "Mettre à jour la note" : "Marquer « à recaler »"}</Button>
          </div>
        </div>
      </Panel>
    </>
  );
}

export default function OnboardingFlowModal({ row, num, onClose, patch, onRescheduleWithDate, onReschedule, onCancel, blocked, refreshKey, onChanged }) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  const [rated, setRated] = useState(null);
  const [closingMessage, setClosingMessage] = useState("");
  const [celebrate, setCelebrate] = useState(false);   // souche découpée et enregistrée : confettis et ticket « Bravo »
  const [completedDate, setCompletedDate] = useState(() => onboardingDateOf(row));
  const noteLoaded = useRef(false);
  // Météo en cours de saisie (étape 4) : quitter l'étape l'enregistre, ou montre ce qui manque.
  const weatherRef = useRef(null);
  const [unsavedClose, setUnsavedClose] = useState(false);

  useEffect(() => { setCompletedDate(onboardingDateOf(row)); }, [row.rdv_onboarding_done_date, row.rdv_onboarding_date_manual, row.rdv_onboarding_date, row.rdv_onboarding_done]);

  useEffect(() => {
    let alive = true;
    apiClient.get(`/api/v1/optilex/onboarding-brief?numero_client=${encodeURIComponent(num)}`)
      // Relue après un recalage (refreshKey) : la note de recalage n'est chargée qu'à l'ouverture,
      // une saisie en cours est gardée.
      .then((b) => {
        if (!alive) return;
        setBrief(b);
        if (!noteLoaded.current) { noteLoaded.current = true; setNote(b?.onboarding?.reschedule_note || ""); }
      })
      .catch(() => { if (alive) setError("Impossible de charger la situation du client. Fermez et réessayez."); });
    return () => { alive = false; };
  }, [num, refreshKey]);

  const current = STEPS[step];
  // La fiche attend la météo du Client Success : tant qu'elle manque, l'onboarding ne se conclut pas.
  const sheet = brief?.sheet;
  const weatherDue = !!(sheet?.has_form && sheet.available && !sheet.onboarding?.completed && !rated);
  const draft = () => (current.key === "meteo" ? weatherRef.current : null);
  const saveDraft = async () => {
    const d = draft();
    if (!d?.dirty) return true;
    if (!d.complete) { d.reveal(); return false; }
    setBusy("meteo");
    const ok = await d.save();
    setBusy(null);
    return ok;
  };
  const goTo = async (to) => { if (to !== step && await saveDraft()) { setUnsavedClose(false); setStep(to); } };
  const requestClose = useCallback(() => {
    if (busy) return;
    if (current.key === "meteo" && weatherRef.current?.dirty && !unsavedClose) { setUnsavedClose(true); return; }
    onClose();
  }, [busy, current.key, unsavedClose, onClose]);

  const finish = async (changes, message, key) => {
    setBusy(key); setError("");
    try {
      await patch(num, changes);
      onChanged?.();
      // Réalisé : la fête reste à l'écran jusqu'à « Terminer » ; à recaler : message bref puis fermeture.
      if (key === "done") { setCelebrate(true); setBusy(null); return; }
      setClosingMessage(message);
      setTimeout(() => onClose(), 1400);
    } catch {
      setError("L'enregistrement a échoué. Réessayez.");
      setBusy(null);
    }
  };

  // Échap ferme le parcours, sauf quand la fenêtre de recalage est ouverte par-dessus (blocked).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !blocked) requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, requestClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Faire l'onboarding" style={{ position: "fixed", inset: 0, zIndex: 10060, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={requestClose} style={{ position: "absolute", inset: 0, background: "rgba(18,27,53,0.42)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
      <Motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28, ease: EASE }}
        style={{ position: "relative", width: "min(720px, 100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: CARD, borderRadius: 28, boxShadow: "0 28px 70px rgba(17,24,39,0.30)", overflow: "hidden" }}>
        <div className="of-head">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="of-kicker is-brand">Faire l'onboarding</div>
              <div className="of-title">{row.crm_societe || row.societe_sheet || num}</div>
            </div>
            <button type="button" className="of-close" aria-label="Fermer" disabled={!!busy} onClick={requestClose}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Cinq segments qui se remplissent ; chacun ouvre son étape (son nom en bulle). */}
          <div className="of-progress">
            {STEPS.map((s, i) => {
              const state = celebrate ? "done" : i < step ? "done" : i === step ? "on" : "todo";
              return (
                <button key={s.key} type="button" className={`of-seg is-${state}${celebrate ? " is-won" : ""}`} title={s.title} aria-label={`Étape ${i + 1} : ${s.title}`}
                  aria-current={i === step ? "step" : undefined} disabled={!brief || celebrate} onClick={() => setStep(i)}>
                  <Motion.span className="of-seg-fill" initial={false} animate={{ scaleX: state === "todo" ? 0 : 1 }} transition={{ duration: 0.45, ease: EASE }} />
                </button>
              );
            })}
          </div>
          <div className="of-stepline">
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div key={celebrate ? "fin" : current.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
                <div className="of-stepname">{celebrate ? "Onboarding réalisé" : current.title}</div>
                {!celebrate && <div className="of-sub">{current.hint}</div>}
              </Motion.div>
            </AnimatePresence>
            {!celebrate && <span className="of-stepcount">{step + 1} / {STEPS.length}</span>}
          </div>
        </div>

        <div className="of-body">
          {brief?.onboarding.done && !closingMessage && !celebrate && <section className="of-done">
            <div style={{ color: GREEN, fontSize: 13, fontWeight: 750, marginBottom: 10 }}>
              Onboarding réalisé{completedDate ? ` le ${fmtDate(completedDate)}` : ''}
            </div>
            <BoardOnboardingDateCorrection numero={num} initialDate={completedDate} completed
              onSaved={(date) => { setCompletedDate(date); onChanged?.(); }} />
          </section>}
          {celebrate ? (
            <CelebrationTicket brief={brief} row={row} num={num} rated={rated} onClose={onClose} onRate={() => { setCelebrate(false); setStep(3); }} />
          ) : closingMessage ? (
            <Motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}
              style={{ padding: 28, textAlign: "center", color: GREEN, fontSize: 15, fontWeight: 800 }}>{closingMessage}</Motion.div>
          ) : !brief && !error ? (
            <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Chargement de la situation du client…</div>
          ) : error && !brief ? (
            <div role="alert" style={{ padding: 20, color: RED, fontSize: 13 }}>{error}</div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div key={current.key} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.24, ease: EASE }}>
                {current.key === "situation" && <SituationStep brief={brief} row={row} />}
                {current.key === "rdv" && <RdvStep brief={brief} onReschedule={onReschedule} onCancel={onCancel} />}
                {current.key === "optilex" && <OptilexStep brief={brief} num={num} />}
                {current.key === "meteo" && <MeteoStep brief={brief} num={num} rated={rated} controlRef={weatherRef} onRated={(d) => { setRated(d); setUnsavedClose(false); onChanged?.(); }} />}
                {current.key === "cloture" && (
                  <ClotureStep brief={brief} row={row} num={num} rated={rated} busy={busy} note={note} setNote={setNote}
                    weatherDue={weatherDue} onWeather={() => goTo(STEPS.findIndex((s) => s.key === "meteo"))}
                    onDone={() => finish({ rdv_onboarding_done: true }, "Onboarding réalisé. Bravo !", "done")}
                    onRescheduleWithDate={() => { onClose(); onRescheduleWithDate?.(); }}
                    onRescheduleLater={() => finish({ onboarding_reschedule_pending: true, onboarding_reschedule_note: note.trim() || null }, "Onboarding marqué à recaler.", "later")} />
                )}
                {error && <div role="alert" style={{ marginTop: 10, color: RED, fontSize: 12.5 }}>{error}</div>}
              </Motion.div>
            </AnimatePresence>
          )}
        </div>

        {!closingMessage && !celebrate && unsavedClose && (
          <div role="alert" style={{ padding: "10px 20px", background: "#fff7e6", borderTop: "1px solid #f3dfb4", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: TEXT }}><strong style={{ color: AMBER }}>Météo choisie mais pas enregistrée.</strong> Elle sera perdue si vous fermez.</div>
            <Button small onClick={onClose}>Fermer sans enregistrer</Button>
            <Button small primary disabled={!!busy} onClick={async () => { if (await saveDraft()) onClose(); }}>{busy === "meteo" ? "Enregistrement…" : "Enregistrer et fermer"}</Button>
          </div>
        )}
        {!closingMessage && !celebrate && (
          <div className="of-foot">
            <button type="button" className="of-back" style={{ visibility: step === 0 ? "hidden" : "visible" }} disabled={!brief || step === 0 || !!busy}
              onClick={() => goTo(Math.max(0, step - 1))}>← Précédent</button>
            {step < STEPS.length - 1
              ? <Button small primary disabled={!brief || !!busy} onClick={() => goTo(Math.min(STEPS.length - 1, step + 1))}>{busy === "meteo" ? "Enregistrement…" : `Suivant : ${STEPS[step + 1].title} →`}</Button>
              : <Button small disabled={!!busy} onClick={requestClose}>Fermer sans conclure</Button>}
          </div>
        )}
      </Motion.div>
      {celebrate && <ConfettiBurst />}
    </div>,
    document.body
  );
}
