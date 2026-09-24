// Bloc « Prévenir Lisa » du board : le Client Success ne relance jamais la convention Opti'Lex,
// il prévient le cabinet (adresse corrigée, non signé, autre). Partagé entre l'onglet Détails
// et le parcours « Faire l'onboarding ».
import { useEffect, useState } from "react";
import apiClient from "../services/apiClient";

const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const GREEN = "#15794a";
const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
// Date + heure (les rdv_*_date stockent l'heure-mur Paris labellisée UTC -> parties UTC).
const fmtDT = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const base = m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  if (!base) return "";
  const t = String(iso).match(/T(\d{2}):(\d{2})/);
  return t && (+t[1] || +t[2]) ? `${base} · ${t[1]}h${t[2]}` : base;
};

// Enveloppe email qui gigote de droite à gauche (attire l'œil sur "Relancer").
export function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: "mailWiggle 0.9s ease-in-out infinite" }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// Le Client Success PRÉVIENT le cabinet (Lisa) au lieu de relancer : adresse corrigée, contrat
// toujours pas signé, autre. Notification dans l'application + e-mail (+ SaaS Opti'Lex si
// configuré), tracée côté backend ; un même motif n'est pas renvoyé deux fois en dix minutes.
const ALERT_KINDS = [
  { key: "email_changed", label: "Adresse e-mail corrigée" },
  { key: "unsigned", label: "Toujours pas signé" },
  { key: "other", label: "Autre" },
];
export function AlertCabinetBlock({ numero, status, prefill }) {
  const [kind, setKind] = useState(prefill || (status === "expired" ? "unsigned" : "unsigned"));
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState(null); // null | 'sending' | 'sent' | 'error'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [last, setLast] = useState(null);

  useEffect(() => { if (prefill) { setKind(prefill); setState(null); setResult(null); } }, [prefill]);
  useEffect(() => {
    let alive = true;
    apiClient.get(`/api/v1/optilex/alert-cabinet/last?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setLast(r?.last || null); })
      .catch(() => { if (alive) setLast(null); });
    return () => { alive = false; };
  }, [numero, result]);

  const send = async () => {
    setState("sending"); setConfirming(false); setErrorMsg("");
    try {
      const r = await apiClient.post("/api/v1/optilex/alert-cabinet", { numero_client: numero, kind, message: message.trim() || null });
      setResult(r); setState("sent"); setMessage("");
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.data?.detail || err?.message || "";
      setErrorMsg(typeof detail === "string" ? detail : "Envoi impossible, réessayez.");
      setState("error"); setTimeout(() => setState(null), 4000);
    }
  };

  const sending = state === "sending";
  const done = state === "sent";
  const channelLine = (r) => {
    if (!r?.channels) return null;
    const c = r.channels;
    const bit = (label, ch) => `${label} ${ch?.ok ? "✓" : "✗"}`;
    return `${bit("Application", c.app)} · ${bit("E-mail", c.email)} · ${c.saas?.ok ? "SaaS ✓" : c.saas?.detail || "SaaS ✗"}`;
  };
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
        Vous ne relancez pas la convention vous-même : Lisa la relance ou la renvoie. Prévenez-la ici, elle
        recevra l'adresse d'envoi actuelle avec votre motif.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {ALERT_KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => { setKind(k.key); setConfirming(false); }}
            style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${kind === k.key ? NAVY : BORDER}`, background: kind === k.key ? NAVY : CARD,
              color: kind === k.key ? "#fff" : TEXT, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {k.label}
          </button>
        ))}
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000}
        placeholder="Message pour Lisa (facultatif)"
        style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 8, fontSize: 12.5 }} />
      <button onClick={confirming ? send : () => setConfirming(true)} disabled={sending || done}
        onMouseLeave={() => { if (!sending) setConfirming(false); }}
        style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          background: done ? GREEN : confirming ? "#b42318" : "transparent",
          color: done || confirming ? "#fff" : NAVY, cursor: sending || done ? "default" : "pointer", transition: "all 0.2s" }}>
        {!done && !sending && <MailIcon />}
        {done ? "Lisa prévenue ✓" : sending ? "Envoi…" : state === "error" ? "Échec, réessayer" : confirming ? "Confirmer l'envoi à Lisa" : "Prévenir Lisa"}
      </button>
      {done && result && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
          {channelLine(result)}{result.recipient_email && <> · adresse transmise : <strong style={{ color: TEXT }}>{result.recipient_email}</strong></>}
        </div>
      )}
      {state === "error" && errorMsg && <div style={{ fontSize: 12, color: "#b42318", marginTop: 8, lineHeight: 1.5 }}>{errorMsg}</div>}
      {last && !done && (
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
          Dernière alerte : {last.kind_label} le {fmtDT(last.created_at)}{last.author_name ? ` par ${last.author_name}` : ""}.
        </div>
      )}
    </div>
  );
}

