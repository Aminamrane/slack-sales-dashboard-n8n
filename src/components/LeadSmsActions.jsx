// Boutons SMS de la fiche lead : « SMS Lapin » et « SMS Répondeur » (dev 08/10/2026).
// Le Lapin ne part plus jamais tout seul : seulement ici. Chaque bouton affiche son état
// réel, calculé par l'API (GET /tracking/leads/{id}/sms-history → sms_actions) : prêt,
// envoyé et à quelle heure, en file, en échec (réessayable) ou indisponible et pourquoi.
// Utilisé tel quel par la fiche sales (TrackingSheet) et la fiche setter (TrackingSheetSetter).
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../services/apiClient";

const LAPIN = "#f59e0b";
const SENT = "#10b981";
const FAIL = "#ef4444";
const QUEUE = "#5b6abf";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const POLL_MS = 6000;
const POLL_MAX = 25;

// La section s'affiche là où un SMS a du sens : répondeur, à rappeler, RDV qualifié Lapin,
// ou SMS déjà envoyé. Même règle pour les deux fiches.
function showsSmsActions(lead, catKey) {
  if (!lead?.phone) return false;
  return catKey === "voicemail" || catKey === "callback" || lead.sms_count > 0
    || lead.r1_result === "no_show" || lead.r2_result === "no_show";
}

// ── Icônes (dessinées pour ces boutons) ─────────────────────────────────────

function RabbitIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.3 10.5C7.6 8.6 6.6 5.6 7 3.4c.3-1.4 1.9-1.5 2.6-.3 1.2 1.9 1.6 4.8 1.3 7" />
      <path d="M14.7 10.5c1.7-1.9 2.7-4.9 2.3-7.1-.3-1.4-1.9-1.5-2.6-.3-1.2 1.9-1.6 4.8-1.3 7" />
      <ellipse cx="12" cy="15.6" rx="6.3" ry="5.6" />
      <circle cx="9.6" cy="15" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="15" r="0.95" fill="currentColor" stroke="none" />
      <path d="M11.15 17.35h1.7l-.85.85z" fill="currentColor" strokeWidth="1" />
    </svg>
  );
}

function VoicemailIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6.4" cy="12" r="3.9" />
      <circle cx="17.6" cy="12" r="3.9" />
      <path d="M6.4 15.9h11.2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12h11" />
      <path d="M21 12 4.5 4.5 7 12l-2.5 7.5z" />
    </svg>
  );
}

function CheckBadge({ animate }) {
  return (
    <span style={{
      width: 22, height: 22, borderRadius: "50%", background: SENT, display: "inline-flex",
      alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${SENT}55`,
      animation: animate ? `lsaPop 0.55s ${EASE} both` : "none",
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" style={animate ? { strokeDasharray: 24, strokeDashoffset: 24, animation: `lsaDraw 0.45s ${EASE} 0.18s forwards` } : undefined} />
      </svg>
    </span>
  );
}

function Spinner({ color }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: "50%", border: `2px solid ${color}33`, borderTopColor: color,
      display: "inline-block", animation: "lsaSpin 0.8s linear infinite",
    }} />
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={QUEUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FAIL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4.5V11h-6.5" />
    </svg>
  );
}

// ── Libellés (heure de Paris) ────────────────────────────────────────────────

const parisDay = (d) => d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
const parisTime = (d) => d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).replace(":", "h");

function whenLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  if (parisDay(d) === parisDay(now)) return `aujourd'hui à ${parisTime(d)}`;
  if (parisDay(d) === parisDay(tomorrow)) return `demain à ${parisTime(d)}`;
  const day = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });
  return `le ${day} à ${parisTime(d)}`;
}

function nextSlotLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((new Date(parisDay(d)) - new Date(parisDay(now))) / (24 * 3600 * 1000));
  if (days <= 1) return whenLabel(iso);
  return `${d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long" })} à ${parisTime(d)}`;
}

const UNAVAILABLE = {
  no_rdv: () => "Aucun RDV manqué",
  rdv_upcoming: (a) => `Possible après le ${a.rdv_label}`,
  no_phone: () => "Pas de numéro",
  not_french_mobile: () => "Numéro fixe ou étranger : pas de SMS",
  already_client: () => "Déjà client : pas de relance",
  sms_disabled: () => "Envoi SMS indisponible pour le moment",
  no_sales: () => "Lead sans sales",
};

const SEND_ERRORS = {
  daily_limit_reached: "Limite du jour atteinte",
  monthly_limit_reached: "Limite du mois atteinte",
  already_sent: "Déjà envoyé à ce prospect",
  error: "Erreur, réessaie",
};

function describe(type, action, flash) {
  if (flash) return { text: flash, tone: FAIL };
  if (!action) return { text: "…", tone: null };
  switch (action.state) {
    case "sent":
      return { text: `Envoyé ${whenLabel(action.sent_at)}`, tone: SENT };
    case "queued":
      return action.queue_open
        ? { text: "En cours d'envoi", tone: QUEUE }
        : { text: `Programmé : part ${nextSlotLabel(action.send_at)}`, tone: QUEUE };
    case "failed":
      return { text: "L'envoi a échoué : cliquer pour réessayer", tone: FAIL };
    case "unavailable":
      return { text: (UNAVAILABLE[action.reason] || (() => "Indisponible"))(action), tone: null };
    default:
      return type === "sms_noshow"
        ? { text: `Absent au ${action.rdv_label}`, tone: null }
        : { text: "Après un appel sans réponse", tone: null };
  }
}

// ── Bouton ───────────────────────────────────────────────────────────────────

function SmsButton({ type, title, icon, color, action, busy, justSent, flash, onSend, C, darkMode }) {
  const state = action?.state;
  const clickable = !busy && (state === "ready" || state === "failed");
  const dimmed = state === "unavailable";
  const sent = state === "sent";
  const { text, tone } = busy ? { text: "Envoi…", tone: color } : describe(type, action, flash);
  const border = sent ? `${SENT}40` : state === "failed" || flash ? `${FAIL}40` : `${color}33`;
  const restBg = sent ? `${SENT}${darkMode ? "14" : "0d"}` : "transparent";
  return (
    <button
      type="button"
      onClick={() => clickable && onSend(type)}
      disabled={!clickable}
      aria-label={`${title} : ${text}`}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "8px 10px 8px 8px", borderRadius: 12, border: `1px solid ${border}`,
        background: restBg, cursor: clickable ? "pointer" : "default", fontFamily: "inherit",
        opacity: dimmed ? 0.62 : 1, transition: `background 0.25s ${EASE}, border-color 0.25s ${EASE}, opacity 0.25s`,
      }}
      onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.background = `${color}${darkMode ? "1f" : "10"}`; e.currentTarget.style.borderColor = `${color}66`; } }}
      onMouseLeave={(e) => { if (clickable) { e.currentTarget.style.background = restBg; e.currentTarget.style.borderColor = border; } }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "inline-flex", alignItems: "center",
        justifyContent: "center", color, background: `${color}${darkMode ? "24" : "16"}`,
      }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: C.text, letterSpacing: "-0.01em" }}>{title}</span>
        <span key={text} style={{
          fontSize: 11, fontWeight: tone ? 600 : 500, color: tone || (dimmed ? C.secondary : C.muted), lineHeight: 1.35,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          animation: `lsaFade 0.35s ${EASE} both`,
        }}>
          {text}
        </span>
      </span>
      <span style={{ width: 26, height: 26, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", color }}>
        {busy || (state === "queued" && action.queue_open) ? <Spinner color={busy ? color : QUEUE} />
          : sent ? <CheckBadge animate={justSent} />
          : state === "queued" ? <ClockIcon />
          : state === "failed" ? <RetryIcon />
          : state === "ready" ? <SendIcon /> : null}
      </span>
    </button>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

const HISTORY_LABELS = { sms_repondeur: "SMS Répondeur", sms_noshow: "SMS Lapin", sms_reminder: "SMS Rappel" };
const HISTORY_STATUS = { queued: "en file", failed: "échec" };

export default function LeadSmsActions({ lead, catKey, C, darkMode, onUpdate }) {
  const visible = showsSmsActions(lead, catKey);
  // L'état des boutons dépend du RDV et du numéro : on le relit quand la fiche les change.
  const leadKey = [lead.r1_date, lead.r1_result, lead.r2_date, lead.r2_result, lead.phone].join("|");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [justSent, setJustSent] = useState(null);
  const [flash, setFlash] = useState({});
  const pollRef = useRef({ timer: null, count: 0 });
  const leadId = lead.id;

  const apply = useCallback((resp) => {
    if (resp?.sms_actions) setData({ actions: resp.sms_actions, history: resp.sms_history || [] });
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await apiClient.get(`/api/v1/tracking/leads/${leadId}/sms-history`));
    } catch (e) {
      console.error("SMS state load failed:", e);
    }
  }, [leadId, apply]);

  useEffect(() => {
    if (!visible) return undefined;
    load();
    const poll = pollRef.current;
    return () => clearTimeout(poll.timer);
  }, [load, visible, leadKey]);
  useEffect(() => setData(null), [leadId]);

  // Répondeur dans la file pendant les heures d'envoi : on suit jusqu'à « Envoyé » (≤ 2 min 30).
  const repondeur = data?.actions?.sms_repondeur;
  useEffect(() => {
    const poll = pollRef.current;
    clearTimeout(poll.timer);
    if (repondeur?.state !== "queued" || !repondeur.queue_open) { poll.count = 0; return; }
    if (poll.count >= POLL_MAX) return;
    poll.timer = setTimeout(() => { poll.count += 1; load(); }, POLL_MS);
    return () => clearTimeout(poll.timer);
  }, [repondeur, load]);

  const send = async (type) => {
    if (busy) return;
    setBusy(type);
    setFlash((f) => ({ ...f, [type]: null }));
    try {
      const resp = await apiClient.post(`/api/v1/tracking/leads/${leadId}/send-sms`, { sms_type: type });
      apply(resp);
      // Compteur « SMS reçu » de la ligne du lead dans la sheet.
      if (resp?.sms_actions) onUpdate?.({ sms_count: resp.sms_count, sms_history: resp.sms_history || [] });
      if (resp.sent || resp.queued) {
        setJustSent(type);
        setTimeout(() => setJustSent((cur) => (cur === type ? null : cur)), 2400);
      } else if (resp.reason && !UNAVAILABLE[resp.reason]) {
        const msg = SEND_ERRORS[resp.reason] || (String(resp.reason).startsWith("brevo_") ? "Brevo a refusé l'envoi, réessaie" : "Envoi impossible");
        setFlash((f) => ({ ...f, [type]: msg }));
        setTimeout(() => setFlash((f) => ({ ...f, [type]: null })), 6000);
      }
    } catch (e) {
      console.error("SMS send failed:", e);
      setFlash((f) => ({ ...f, [type]: e?.data?.detail || "Erreur, réessaie" }));
      setTimeout(() => setFlash((f) => ({ ...f, [type]: null })), 6000);
    }
    setBusy(null);
  };

  if (!visible) return null;
  const history = data?.history || [];
  const sentCount = history.filter((h) => h.status === "sent").length;
  return (
    <div style={{ marginBottom: 16 }}>
      <style>{`
        @keyframes lsaPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes lsaDraw { to { stroke-dashoffset: 0; } }
        @keyframes lsaSpin { to { transform: rotate(360deg); } }
        @keyframes lsaFade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        SMS {sentCount > 0 && <span style={{ fontWeight: 700, color: SENT }}>· {sentCount} envoyé{sentCount > 1 ? "s" : ""}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SmsButton type="sms_noshow" title="SMS Lapin" icon={<RabbitIcon />} color={LAPIN}
          action={data?.actions?.sms_noshow} busy={busy === "sms_noshow"} justSent={justSent === "sms_noshow"}
          flash={flash.sms_noshow} onSend={send} C={C} darkMode={darkMode} />
        <SmsButton type="sms_repondeur" title="SMS Répondeur" icon={<VoicemailIcon />} color={C.accent}
          action={repondeur} busy={busy === "sms_repondeur"} justSent={justSent === "sms_repondeur"}
          flash={flash.sms_repondeur} onSend={send} C={C} darkMode={darkMode} />
      </div>
      {history.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Historique</div>
          {history.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 11, color: C.secondary }}>
              <span style={{ width: 14, height: 14, display: "inline-flex", color: h.type === "sms_noshow" ? LAPIN : C.accent }}>
                {h.type === "sms_noshow" ? <RabbitIcon size={14} /> : <VoicemailIcon size={14} />}
              </span>
              <span style={{ fontWeight: 500 }}>{HISTORY_LABELS[h.type] || h.type}{h.rdv ? ` ${h.rdv.toUpperCase()}` : ""}</span>
              {HISTORY_STATUS[h.status] && <span style={{ fontSize: 10, fontWeight: 600, color: h.status === "failed" ? FAIL : QUEUE }}>· {HISTORY_STATUS[h.status]}</span>}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: C.muted }}>
                {new Date(h.sent_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" })} {parisTime(new Date(h.sent_at))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
