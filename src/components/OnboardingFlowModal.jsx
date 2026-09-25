// Parcours « Faire l'onboarding » (board, Client Success). Un pop-up guidé en cinq étapes :
// 1. la situation du client (état, finance, contrats), 2. les rendez-vous de lancement,
// 3. la convention Opti'Lex (prévenir Lisa), 4. la météo d'onboarding qui finalise la fiche,
// 5. la clôture : réalisé, ou à recaler (avec ou sans date). Règle finance affichée telle
// que le moteur l'applique : le jour J, rien n'est dû avant la fin du rendez-vous.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import { AlertCabinetBlock } from "./CabinetAlertBlock";
import { OnboardingRatingForm } from "./BoardIntegrationSheet";
import { METEO_MEANING, MeteoIcon, meteoStyle } from "./meteo.jsx";

const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const GREEN = "#15794a";
const BRAND = "#3e7d5a";
const AMBER = "#b45309";
const RED = "#b42318";
const EASE = [0.16, 1, 0.3, 1];

const STEPS = [
  { key: "situation", title: "Situation du client", hint: "Où en est le client, en finance et dans ses contrats" },
  { key: "rdv", title: "Rendez-vous de lancement", hint: "Fiscal et social, normalement pris par le client" },
  { key: "optilex", title: "Convention Opti'Lex", hint: "Signée, en attente, ou à relancer par Lisa" },
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

function Pill({ color, children }) {
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: color + "18", color }}>{children}</span>;
}
function Row({ label, children, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: TEXT, fontWeight: strong ? 700 : 500, textAlign: "right", overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}
function Card({ title, children }) {
  return (
    <section style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", background: CARD, marginBottom: 12 }}>
      {title && <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: MUTED, fontWeight: 700, marginBottom: 6 }}>{title}</div>}
      {children}
    </section>
  );
}
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
  const optilex = OPTILEX_LABELS[brief.contracts?.optilex_status] || [brief.contracts?.optilex_status ? brief.contracts.optilex_status : "Pas de convention séparée", MUTED];
  return (
    <>
      <Card title="Client">
        <Row label="Société" strong>{brief.client.societe || row.crm_societe || row.numero_client}</Row>
        <Row label="Contact">{brief.client.contact_name || "—"}</Row>
        <Row label="E-mail d'envoi des contrats">{brief.client.email || "—"}{brief.client.email && row.email && brief.client.email.toLowerCase() !== String(row.email).toLowerCase() && <> <Pill color={AMBER}>corrigée</Pill></>}</Row>
        <Row label="Téléphone">{brief.client.phone || "—"}</Row>
        <Row label="État sur le board">{row.etat || brief.client.etat || "—"}</Row>
      </Card>
      <Card title="Finance">
        <div style={{ fontSize: 13.5, fontWeight: 700, color: tone, marginBottom: 6 }}>
          {f?.is_late ? "En retard de paiement" : brief.phase_label}
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
          {brief.phase === "day_j" && brief.onboarding.ends_at && <>Le client devient exigible après la fin du rendez-vous, vers {fmtDT(brief.onboarding.ends_at).split("·")[1]?.trim() || "la fin de l'heure"}. Avant, rien n'est dû.</>}
          {brief.phase === "before" && <>Aucun attendu avant le rendez-vous d'onboarding{f?.billing_start ? ` du ${fmtDate(f.billing_start)}` : ""}.</>}
          {brief.phase === "billing" && !f?.is_late && <>Facturation démarrée{f?.billing_start ? ` le ${fmtDate(f.billing_start)}` : ""}, rien en retard.</>}
          {f?.is_late && <>Un impayé est en cours : à évoquer avec le client, sans bloquer l'onboarding.</>}
          {brief.phase === "no_date" && <>Aucune date d'onboarding connue : la facturation n'a pas de point de départ.</>}
        </div>
        {f?.etat_finance && <Row label="État finance (classeur)">{f.etat_finance}</Row>}
        {cur ? (
          <>
            <Row label={`Attendu ${fmtDate(f.month)?.slice(3) || "du mois"}`}>Owner {euros(cur.expected_owner)} · Opti'Lex {euros(cur.expected_optilex_ttc)}</Row>
            <Row label="Reçu ce mois">Owner {euros(cur.received_owner)} · Opti'Lex {euros(cur.received_optilex_ttc)}</Row>
            {(cur.overdue_owner > 0 || cur.overdue_optilex > 0) && <Row label="Retard du mois" strong><span style={{ color: AMBER }}>Owner {euros(cur.overdue_owner)} · Opti'Lex {euros(cur.overdue_optilex)}</span></Row>}
            {(f.prior_owner > 0 || f.prior_optilex > 0) && <Row label="Créance antérieure" strong><span style={{ color: AMBER }}>Owner {euros(f.prior_owner)} · Opti'Lex {euros(f.prior_optilex)}</span></Row>}
          </>
        ) : <div style={{ fontSize: 12, color: MUTED }}>Pas encore de ligne de facturation pour ce mois.</div>}
      </Card>
      <Card title="Contrats">
        <Row label="Contrat Owner">{brief.contracts?.owner_status === "done" ? <Pill color={GREEN}>Signé{brief.contracts.owner_signed_at ? ` le ${fmtDate(brief.contracts.owner_signed_at)}` : ""}</Pill> : <Pill color={AMBER}>{brief.contracts?.owner_status || "Non signé"}</Pill>}</Row>
        <Row label="Convention Opti'Lex"><Pill color={optilex[1]}>{optilex[0]}</Pill></Row>
        {brief.sheet && <Row label="Fiche d'intégration">{brief.sheet.final ? <Pill color={GREEN}>Finalisée</Pill> : brief.sheet.available ? <Pill color={AMBER}>À finaliser par votre météo</Pill> : <Pill color={MUTED}>Partie commerciale non terminée</Pill>}</Row>}
      </Card>
    </>
  );
}

function RdvStep({ brief }) {
  const a = brief.appointments;
  const item = (label, entry, responsable) => (
    <Card title={label} key={label}>
      {entry?.at ? (
        <Row label="Date" strong>{fmtDT(entry.at)}{entry.done ? <> <Pill color={GREEN}>effectué</Pill></> : null}</Row>
      ) : (
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>Pas encore de date.</div>
      )}
      {entry?.meet_link && <Row label="Visio"><a href={entry.meet_link} target="_blank" rel="noreferrer" style={{ color: BRAND, fontWeight: 700, textDecoration: "none" }}>Rejoindre le Meet</a></Row>}
      {responsable && (
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 6 }}>
          Normalement, ce rendez-vous est pris par le client sur sa plateforme avec {responsable}. Vous pouvez le placer ici avec lui, avec le même lien.
        </div>
      )}
      {responsable && !entry?.at && <CopyLink url={entry?.link} />}
      {responsable && !entry?.link && !entry?.at && <div style={{ fontSize: 12, color: AMBER, marginTop: 6 }}>Aucun lien de prise de rendez-vous pour ce client. Il sera créé au prochain passage automatique, sinon signalez-le.</div>}
    </Card>
  );
  return (
    <>
      <Card title="Onboarding Owner">
        <Row label="Date" strong>{brief.onboarding.at ? fmtDT(brief.onboarding.at) : brief.onboarding.day ? fmtDate(brief.onboarding.day) : "—"}</Row>
        {brief.onboarding.meet_link && <Row label="Visio"><a href={brief.onboarding.meet_link} target="_blank" rel="noreferrer" style={{ color: BRAND, fontWeight: 700, textDecoration: "none" }}>Rejoindre le Meet</a></Row>}
        {brief.onboarding.reschedule_pending && <Row label="Statut"><Pill color={AMBER}>à recaler</Pill></Row>}
      </Card>
      {item("Intégration Opti'Lex", a.lancement, null)}
      {item("Lancement fiscal", a.fiscal, "Adam Bouchareb")}
      {item("Lancement social", a.social, "Haci Moraru")}
    </>
  );
}

function OptilexStep({ brief, num }) {
  const status = brief.contracts?.optilex_status;
  const label = OPTILEX_LABELS[status] || ["Pas de convention séparée (incluse dans le contrat Owner)", MUTED];
  const pending = ["scheduled", "ongoing", "expired", "awaiting_owner_signature"].includes(status);
  return (
    <>
      <Card title="Convention Opti'Lex" tone={label[1]}>
        <Row label="Statut" strong><Pill color={label[1]}>{label[0]}</Pill></Row>
        {brief.contracts?.optilex_sent_at && <Row label="Envoyée le">{fmtDT(brief.contracts.optilex_sent_at)}</Row>}
        {brief.contracts?.optilex_signed_at && <Row label="Signée le">{fmtDT(brief.contracts.optilex_signed_at)}</Row>}
        <Row label="Adresse d'envoi">{brief.contracts?.recipient_email || "—"}</Row>
        {brief.last_cabinet_alert && <Row label="Lisa prévenue">{fmtDT(brief.last_cabinet_alert.created_at)}{brief.last_cabinet_alert.author_name ? ` par ${brief.last_cabinet_alert.author_name}` : ""}</Row>}
      </Card>
      {pending ? (
        <Card title="Prévenir le cabinet">
          <AlertCabinetBlock numero={num} status={status} prefill={null} />
        </Card>
      ) : (
        <div style={{ fontSize: 12.5, color: MUTED }}>Rien à faire côté convention.</div>
      )}
    </>
  );
}

function MeteoStep({ brief, num, onRated, rated }) {
  const sheet = brief.sheet;
  const done = rated || sheet?.onboarding?.completed;
  if (!sheet || !sheet.has_form) {
    return <Card title="Météo d'onboarding"><div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>Ce client n'a pas de fiche d'intégration Owner (ancien parcours). Notez votre ressenti dans la section « Météo client » de la fiche, il entre dans l'historique.</div></Card>;
  }
  if (!sheet.available) {
    return <Card title="Météo d'onboarding"><div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>La partie commerciale de la fiche n'est pas terminée : le commercial doit d'abord finaliser son passage de relais. Votre météo viendra ensuite.</div></Card>;
  }
  if (done) {
    const w = rated?.onboarding || sheet.onboarding;
    const st = w?.weather ? meteoStyle(w.weather) : null;
    return <Card title="Météo d'onboarding"><div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
      {st && <span style={{ width: 34, height: 34, borderRadius: 10, background: st.bg, display: "grid", placeItems: "center", flexShrink: 0 }}><MeteoIcon score={w.weather} size={20} color={st.color} /></span>}
      <span>Fiche finalisée : {w?.weather ? `${w.weather}/5, ${METEO_MEANING[w.weather]?.txt || ""}` : "note enregistrée"}{w?.author_name ? ` par ${w.author_name}` : ""}{w?.completed_at ? ` le ${fmtDate(w.completed_at)}` : ""}.</span>
    </div></Card>;
  }
  return (
    <Card title="Météo d'onboarding">
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
        Le commercial a posé sa météo à la vente. La vôtre s'ajoute à la suite et finalise la fiche d'intégration. Elle entre aussi dans l'historique météo du client.
      </div>
      <OnboardingRatingForm numero={num} compact onSaved={onRated} />
    </Card>
  );
}

function ClotureStep({ brief, busy, onDone, onRescheduleWithDate, onRescheduleLater, note, setNote }) {
  const alreadyDone = brief.onboarding.done;
  return (
    <>
      <Card title="Conclure l'onboarding">
        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, marginBottom: 12 }}>
          {alreadyDone ? "Cet onboarding est déjà marqué réalisé. Vous pouvez le rouvrir pour un recalage si besoin." : "Trois issues possibles. Seul « réalisé » clôt l'onboarding ; les deux autres laissent la fiche en « à recaler » jusqu'à la nouvelle date."}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Button primary disabled={busy || alreadyDone} onClick={onDone}>{alreadyDone ? "Onboarding déjà réalisé" : busy === "done" ? "Enregistrement…" : "Onboarding réalisé"}</Button>
          <Button disabled={busy} onClick={onRescheduleWithDate}>À recaler : je fixe la nouvelle date maintenant</Button>
          <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT, marginBottom: 6 }}>À recaler, sans date pour le moment</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Pourquoi, et quand rappeler (facultatif)"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12.5, fontFamily: "inherit", resize: "vertical", marginBottom: 8 }} />
            <Button small disabled={busy} onClick={onRescheduleLater}>{busy === "later" ? "Enregistrement…" : brief.onboarding.reschedule_pending ? "Mettre à jour la note de recalage" : "Marquer « à recaler »"}</Button>
          </div>
        </div>
      </Card>
    </>
  );
}

export default function OnboardingFlowModal({ row, num, onClose, patch, onRescheduleWithDate, onChanged }) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  const [rated, setRated] = useState(null);
  const [closingMessage, setClosingMessage] = useState("");

  useEffect(() => {
    let alive = true;
    apiClient.get(`/api/v1/optilex/onboarding-brief?numero_client=${encodeURIComponent(num)}`)
      .then((b) => { if (alive) { setBrief(b); setNote(b?.onboarding?.reschedule_note || ""); } })
      .catch(() => { if (alive) setError("Impossible de charger la situation du client. Fermez et réessayez."); });
    return () => { alive = false; };
  }, [num]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const current = STEPS[step];
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const finish = async (changes, message, key) => {
    setBusy(key); setError("");
    try {
      await patch(num, changes);
      setClosingMessage(message);
      onChanged?.();
      setTimeout(() => onClose(), 1400);
    } catch {
      setError("L'enregistrement a échoué. Réessayez.");
      setBusy(null);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Faire l'onboarding" style={{ position: "fixed", inset: 0, zIndex: 10060, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!busy) onClose(); }} style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.46)" }} />
      <Motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28, ease: EASE }}
        style={{ position: "relative", width: "min(720px, 100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#f8faf9", borderRadius: 18, border: `1px solid ${BORDER}`, boxShadow: "0 28px 70px rgba(17,24,39,0.30)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", background: CARD, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: BRAND, fontWeight: 800 }}>Faire l'onboarding</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.crm_societe || row.societe_sheet || num}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Étape {step + 1} sur {STEPS.length} · {current.hint}</div>
            </div>
            <button type="button" aria-label="Fermer" disabled={!!busy} onClick={() => { if (!busy) onClose(); }} style={{ border: "none", background: "none", cursor: "pointer", color: MUTED, fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: "#e9ebf0", marginTop: 12, overflow: "hidden" }}>
            <Motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.45, ease: EASE }} style={{ height: "100%", background: BRAND, borderRadius: 999 }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {STEPS.map((s, i) => (
              <button key={s.key} type="button" onClick={() => brief && setStep(i)} disabled={!brief}
                style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${i === step ? NAVY : BORDER}`, background: i === step ? NAVY : i < step ? "#e3f4ea" : CARD, color: i === step ? "#fff" : i < step ? GREEN : MUTED, fontSize: 11.5, fontWeight: 700, cursor: brief ? "pointer" : "default", fontFamily: "inherit" }}>
                {i < step ? "✓ " : ""}{s.title}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {closingMessage ? (
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
                {current.key === "rdv" && <RdvStep brief={brief} />}
                {current.key === "optilex" && <OptilexStep brief={brief} num={num} />}
                {current.key === "meteo" && <MeteoStep brief={brief} num={num} rated={rated} onRated={(d) => { setRated(d); onChanged?.(); }} />}
                {current.key === "cloture" && (
                  <ClotureStep brief={brief} busy={busy} note={note} setNote={setNote}
                    onDone={() => finish({ rdv_onboarding_done: true }, "Onboarding réalisé. Bravo !", "done")}
                    onRescheduleWithDate={() => { onClose(); onRescheduleWithDate?.(); }}
                    onRescheduleLater={() => finish({ onboarding_reschedule_pending: true, onboarding_reschedule_note: note.trim() || null }, "Onboarding marqué à recaler.", "later")} />
                )}
                {error && <div role="alert" style={{ marginTop: 10, color: RED, fontSize: 12.5 }}>{error}</div>}
              </Motion.div>
            </AnimatePresence>
          )}
        </div>

        {!closingMessage && (
          <div style={{ padding: "12px 20px", background: CARD, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Button small disabled={!brief || step === 0 || !!busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Précédent</Button>
            {step < STEPS.length - 1
              ? <Button small primary disabled={!brief || !!busy} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Suivant →</Button>
              : <Button small disabled={!!busy} onClick={onClose}>Fermer sans conclure</Button>}
          </div>
        )}
      </Motion.div>
    </div>,
    document.body
  );
}
