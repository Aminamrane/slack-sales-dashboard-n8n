// Bloc « Prévenir Lisa » du board : le Client Success ne relance jamais la convention Opti'Lex,
// il prévient le cabinet (adresse corrigée, non signé, autre). Dans la fiche, un bouton de la barre « Convention
// Opti'Lex » en tête (dev 29/10/2026) ; dans le parcours « Faire l'onboarding », le bloc complet.
import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { parisInstantLabel } from "../utils/parisDates";
import "./CabinetAlertBlock.css";

// Enveloppe des boutons d'envoi : elle gigote au survol de son bouton (plus en boucle : animation permanente).
export function MailIcon() {
  return (
    <svg className="mail-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ── Pictogrammes de la convention (deux tons, comme la météo) ─────────────────────────────────────────
// Expirée : un sablier vide en haut, plein en bas ; il se secoue une fois à l'ouverture et se retourne au survol.
// En attente : une enveloppe et ses trois points d'attente. Planifiée : un calendrier et son aiguille.
export function ConventionGlyph({ status, size = 22, color = "currentColor" }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (status === "expired") {
    return (
      <svg className="cg cg-expired" {...common}>
        <g className="cg-glass">
          <path d="M6.5 3h11M6.5 21h11" strokeWidth="2" />
          <path d="M8 3v2.6a4.6 4.6 0 0 0 2.3 4l1.7 1.4-1.7 1.4a4.6 4.6 0 0 0-2.3 4V21M16 3v2.6a4.6 4.6 0 0 1-2.3 4L12 11l1.7 1.4a4.6 4.6 0 0 1 2.3 4V21" />
          <path className="cg-sand" d="M9.1 20.2c.3-2 1.4-3.1 2.9-3.1s2.6 1.1 2.9 3.1Z" fill={color} fillOpacity=".35" stroke="none" />
          <path className="cg-grain" d="M12 12.6v2.6" strokeWidth="1.4" strokeDasharray="0.6 1.4" />
        </g>
      </svg>
    );
  }
  if (status === "ongoing") {
    return (
      <svg className="cg cg-ongoing" {...common}>
        <g className="cg-env">
          <rect x="2.5" y="5" width="15" height="11.5" rx="2.2" fill={color} fillOpacity=".14" />
          <path d="m17.5 7-6.4 4.3a1.9 1.9 0 0 1-2.2 0L2.5 7" />
        </g>
        {[15.6, 18.6, 21.6].map((x, i) => <circle key={x} className={`cg-dot cg-dot-${i}`} cx={x} cy="19.2" r="1.1" fill={color} stroke="none" />)}
      </svg>
    );
  }
  return (
    <svg className="cg cg-scheduled" {...common}>
      <rect x="3" y="4.5" width="15" height="14" rx="2.2" fill={color} fillOpacity=".14" />
      <path d="M7 2.5v4M14 2.5v4M3 9h15" />
      <circle cx="17" cy="17" r="4.6" fill="#fff" />
      <path className="cg-hand" d="M17 14.8V17l1.6 1" />
    </svg>
  );
}

// Barre « Convention Opti'Lex » en tête de fiche (dev 29/10/2026 : « something little with a svg action ») : une
// ligne fine aux couleurs de la fiche, le pictogramme dans la teinte de l'état, l'action à droite.
const CONVENTION_STATES = {
  expired: { label: "Convention Opti'Lex expirée", tone: "coral" },
  ongoing: { label: "Convention Opti'Lex non signée", tone: "peach" },
  scheduled: { label: "Convention Opti'Lex planifiée", tone: "sky" },
};
export function ConventionBar({ status, sub, children }) {
  const c = CONVENTION_STATES[status];
  if (!c) return null;
  return (
    <section className={`ocv is-${c.tone}`} aria-label={c.label}>
      <span className="ocv-ic"><ConventionGlyph status={status} size={18} /></span>
      <span className="ocv-tx"><strong>{c.label}</strong>{sub && <small>{sub}</small>}</span>
      {children && <span className="ocv-actions">{children}</span>}
    </section>
  );
}

// Le Client Success PRÉVIENT le cabinet (Lisa) au lieu de relancer : adresse corrigée, contrat
// toujours pas signé, autre. Notification dans l'application + e-mail (+ SaaS Opti'Lex si
// configuré), tracée côté backend ; un même motif n'est pas renvoyé deux fois en dix minutes.
const ALERT_KINDS = [
  { key: "email_changed", label: "Adresse e-mail corrigée", short: "E-mail corrigé", icon: <><circle cx="12" cy="12" r="3.6" /><path d="M15.6 12v1.4a2.3 2.3 0 0 0 4.6 0V12a8.2 8.2 0 1 0-3.2 6.5" /></> },
  { key: "unsigned", label: "Toujours pas signé", short: "Pas signé", icon: <><path d="M3 19.5c2.5 0 3.5-5 5.5-5s1.5 3 3.5 3 2.5-2 4-2" /><path d="m15.5 4.5 3.5 3.5-6 6H9.5v-3.5Z" /></> },
  { key: "other", label: "Autre", short: "Autre", icon: <path d="M21 14.5a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2Z" /> },
];
const Ico = ({ children, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const PLANE = <Ico><path d="M21.5 2.5 10.6 13.4" /><path d="m21.5 2.5-7 19-3.9-8.1-8.1-3.9Z" /></Ico>;
const CHECK = <Ico><path d="m5 12.5 4.5 4.5L19 7.5" /></Ico>;
const CHANNELS = [["email", "E-mail"], ["app", "CRM"], ["saas", "Opti'Lex"]];

// Envoi et dernier envoi, partagés par le bloc complet (parcours « Faire l'onboarding ») et le bouton de la barre.
function useCabinetAlert(numero, prefill) {
  const [kind, setKind] = useState(prefill || "unsigned");
  const [message, setMessage] = useState("");
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
    setState("sending"); setErrorMsg("");
    try {
      const r = await apiClient.post("/api/v1/optilex/alert-cabinet", { numero_client: numero, kind, message: message.trim() || null });
      setResult(r); setState("sent"); setMessage("");
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.data?.detail || err?.message || "";
      setErrorMsg(typeof detail === "string" ? detail : "Envoi impossible, réessayez.");
      setState("error"); setTimeout(() => setState(null), 4000);
      return false;
    }
  };
  // Ce qui est réellement parti, par canal : Vincent doit voir que Lisa a bien été prévenue,
  // tout de suite après l'envoi comme en rouvrant la fiche (dev, 25/09).
  // Juste après l'envoi, la réponse s'affiche en attendant que « last » (avec l'auteur) soit rechargé.
  const delivered = state === "sent" && result && last?.id !== result.id ? result : last;
  const channels = delivered?.channels || {};
  const allOk = CHANNELS.every(([key]) => channels[key]?.ok);
  return { kind, setKind, message, setMessage, state, errorMsg, send, delivered, channels, allOk };
}
const deliveredTitle = (d, channels) => [
  `${d.kind_label || ""} le ${parisInstantLabel(d.created_at)}${d.author_name ? ` par ${d.author_name}` : ""}`,
  CHANNELS.map(([key, label]) => `${label} ${channels[key]?.ok ? "✓" : "✗"}`).join(" · "),
  d.recipient_email ? `Adresse transmise : ${d.recipient_email}` : "",
].filter(Boolean).join("\n");

// Bouton « Prévenir Lisa » de la barre : une petite fenêtre s'ouvre dessous (motif, un mot, envoyer). Ouvrir puis
// « Envoyer à Lisa » = deux gestes explicites ; rien ne part au survol ni à la fermeture (incident n°763, 25/09).
export function AlertCabinetButton({ numero, prefill }) {
  const a = useCabinetAlert(numero, prefill);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (prefill) setOpen(true); }, [prefill]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open]);
  const sending = a.state === "sending";
  const d = a.delivered;
  return (
    <span ref={ref} className="ocv-anchor">
      {d && (
        <span className={`ocv-last${a.allOk ? "" : " is-partial"}`} title={`Cabinet partenaire déjà prévenu :\n${deliveredTitle(d, a.channels)}`}
          aria-label={`Cabinet partenaire prévenu le ${parisInstantLabel(d.created_at)}`}>{CHECK}</span>
      )}
      <button type="button" className="ocv-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>{PLANE}Prévenir le cabinet partenaire</button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Prévenir le cabinet partenaire" className="ocv-pop" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }} transition={{ type: "spring", stiffness: 520, damping: 34 }}>
            <p className="ocv-pop-rule">Le cabinet partenaire relance ou renvoie la convention ; il reçoit l'adresse d'envoi actuelle et votre motif.</p>
            <div className="ocv-kinds" role="group" aria-label="Motif">
              {ALERT_KINDS.map((k) => (
                <button key={k.key} type="button" aria-pressed={a.kind === k.key} className={`ocv-kind${a.kind === k.key ? " is-on" : ""}`} onClick={() => a.setKind(k.key)}>
                  <Ico size={13}>{k.icon}</Ico>{k.short}
                </button>
              ))}
            </div>
            <input className="ocv-input" value={a.message} onChange={(e) => a.setMessage(e.target.value)} maxLength={1000} placeholder="Un mot pour le cabinet (facultatif)"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!sending) a.send().then((ok) => { if (ok) setOpen(false); }); } }} />
            {a.state === "error" && a.errorMsg && <p role="alert" className="ocv-error">{a.errorMsg}</p>}
            <div className="ocv-pop-actions">
              <button type="button" className="ocv-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="button" className="ocv-send" disabled={sending} onClick={async () => { if (await a.send()) setOpen(false); }}>
                {PLANE}{sending ? "Envoi…" : "Envoyer au cabinet"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Bloc complet (parcours « Faire l'onboarding ») : motif en puces, un mot, l'envoi confirmé ; puis ce qui est parti.
export function AlertCabinetBlock({ numero, status, prefill }) {
  const a = useCabinetAlert(numero, prefill);
  const [confirming, setConfirming] = useState(false);
  const sending = a.state === "sending";
  const done = a.state === "sent";
  const d = a.delivered;
  return (
    <div className="cab">
      <p className="cab-rule">
        {status === "expired" ? "Le cabinet partenaire renvoie la convention" : "Le cabinet partenaire relance la convention"} : prévenez-le, il reçoit l'adresse d'envoi actuelle et votre motif.
      </p>
      <div className="cab-kinds" role="group" aria-label="Motif">
        {ALERT_KINDS.map((k) => (
          <button key={k.key} type="button" aria-pressed={a.kind === k.key} className={`cab-kind${a.kind === k.key ? " is-on" : ""}`}
            onClick={() => { a.setKind(k.key); setConfirming(false); }}>
            <Ico size={14}>{k.icon}</Ico>{k.label}
          </button>
        ))}
      </div>
      <textarea className="cab-msg" value={a.message} onChange={(e) => a.setMessage(e.target.value)} rows={2} maxLength={1000}
        placeholder="Un mot pour le cabinet (facultatif)" />
      {/* La confirmation reste affichée jusqu'à « Confirmer » ou « Annuler » : sortir la souris du
          bouton l'annulait sans le dire, et l'alerte de Vincent pour n°763 n'est jamais partie (25/09). */}
      <div className="cab-actions">
        {confirming && !sending && <button type="button" className="cab-ghost" onClick={() => setConfirming(false)}>Annuler</button>}
        <button type="button" className={`cab-go${done ? " is-done" : confirming ? " is-confirm" : ""}`} disabled={sending || done}
          onClick={confirming ? () => { setConfirming(false); a.send(); } : () => setConfirming(true)}>
          {done || confirming ? CHECK : PLANE}
          {done ? "Cabinet partenaire prévenu" : sending ? "Envoi…" : a.state === "error" ? "Échec, réessayer" : confirming ? "Confirmer l'envoi au cabinet" : "Prévenir le cabinet partenaire"}
        </button>
      </div>
      {a.state === "error" && a.errorMsg && <p role="alert" className="cab-error">{a.errorMsg}</p>}
      {d && (
        <div className={`cab-done${a.allOk ? "" : " is-partial"}`}>
          <strong>{CHECK}{a.allOk ? "Cabinet partenaire prévenu" : "Cabinet partenaire prévenu en partie"} le {parisInstantLabel(d.created_at)}{d.author_name ? ` par ${d.author_name}` : ""}</strong>
          <div className="cab-ch">
            {d.kind_label && <span className="cab-ch-kind">{d.kind_label}</span>}
            {CHANNELS.map(([key, label]) => (
              <span key={key} className={`cab-ch-pill ${a.channels[key]?.ok ? "is-ok" : "is-ko"}`}>{a.channels[key]?.ok ? "✓" : "✗"} {label}</span>
            ))}
          </div>
          {d.recipient_email && <small>Adresse transmise : <b>{d.recipient_email}</b></small>}
        </div>
      )}
    </div>
  );
}
