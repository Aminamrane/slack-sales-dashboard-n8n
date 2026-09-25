// Bloc « Prévenir Lisa » du board : le Client Success ne relance jamais la convention Opti'Lex,
// il prévient le cabinet (adresse corrigée, non signé, autre). Partagé entre l'onglet Détails
// et le parcours « Faire l'onboarding ».
import { useEffect, useState } from "react";
import apiClient from "../services/apiClient";
import { parisInstantLabel } from "../utils/parisDates";

const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const GREEN = "#15794a";
const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
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
  // Ce qui est réellement parti, par canal : Vincent doit voir que Lisa a bien été prévenue,
  // tout de suite après l'envoi comme en rouvrant la fiche (dev, 25/09).
  // Juste après l'envoi, la réponse s'affiche en attendant que « last » (avec l'auteur) soit rechargé.
  const delivered = done && result && last?.id !== result.id ? result : last;
  const channels = delivered?.channels || {};
  const CHANNELS = [["email", "E-mail"], ["app", "CRM"], ["saas", "Opti'Lex"]];
  const allOk = CHANNELS.every(([key]) => channels[key]?.ok);
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
      {/* La confirmation reste affichée jusqu'à « Confirmer » ou « Annuler » : sortir la souris du
          bouton l'annulait sans le dire, et l'alerte de Vincent pour n°763 n'est jamais partie (25/09). */}
      <button onClick={confirming ? send : () => setConfirming(true)} disabled={sending || done}
        style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          background: done ? GREEN : confirming ? "#b42318" : "transparent",
          color: done || confirming ? "#fff" : NAVY, cursor: sending || done ? "default" : "pointer", transition: "all 0.2s" }}>
        {!done && !sending && <MailIcon />}
        {done ? "Lisa prévenue ✓" : sending ? "Envoi…" : state === "error" ? "Échec, réessayer" : confirming ? "Confirmer l'envoi à Lisa" : "Prévenir Lisa"}
      </button>
      {confirming && !sending && (
        <button type="button" onClick={() => setConfirming(false)}
          style={{ display: "block", margin: "6px auto 0", padding: "4px 8px", border: "none", background: "transparent",
            color: MUTED, fontSize: 12, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
          Annuler
        </button>
      )}
      {state === "error" && errorMsg && <div style={{ fontSize: 12, color: "#b42318", marginTop: 8, lineHeight: 1.5 }}>{errorMsg}</div>}
      {delivered && (
        <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, fontSize: 12, lineHeight: 1.55,
          background: allOk ? "#eef7f1" : "#fdf6ec", border: `1px solid ${allOk ? "#cfe6d8" : "#f1dcb8"}`, color: TEXT }}>
          <div style={{ fontWeight: 600, color: allOk ? GREEN : "#a4581d" }}>
            {allOk ? "Lisa prévenue ✓" : "Lisa prévenue en partie"} le {parisInstantLabel(delivered.created_at)}
            {delivered.author_name ? ` par ${delivered.author_name}` : ""}
          </div>
          <div style={{ color: MUTED }}>
            {delivered.kind_label}
            {CHANNELS.map(([key, label]) => (
              <span key={key}> · {label} <span style={{ color: channels[key]?.ok ? GREEN : "#b42318" }}>{channels[key]?.ok ? "✓" : "✗"}</span></span>
            ))}
          </div>
          {delivered.recipient_email && (
            <div style={{ color: MUTED }}>Adresse transmise : <strong style={{ color: TEXT }}>{delivered.recipient_email}</strong></div>
          )}
        </div>
      )}
    </div>
  );
}

