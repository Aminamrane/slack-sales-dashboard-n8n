// État des créances d'un client dans la fiche du board (dev 29/10/2026 : « savoir s'il est à jour sur ses paiements,
// en retard… ; s'il clique, un beau pop-up avec du détail »). Lecture seule de /optilex/client-receivables, qui
// reprend les chiffres de la page Finance. Réservé à la direction, à la finance et au Client Success.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { ListRow, Panel, Stat, Tag } from "./DashParts.jsx";
import "./BoardReceivables.css";

export const RECEIVABLES_ROLES = ["admin", "ceo", "finance_director", "finance_team", "customer_success_manager"];

const Ico = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
// Une teinte et un pictogramme par état (palette pastel du dev ; pictogrammes au trait, famille des propriétés de la
// fiche) : un reçu coché, un calendrier et son horloge (en retard), un calendrier et son départ, un reçu en pause,
// un reçu barré (perte), un cercle en pointillé (inconnu de la finance).
const RECEIPT = "M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5V21l-2.4-1.6-2.3 1.6-2.3-1.6-2.3 1.6-2.3-1.6L5 21V4.5A1.5 1.5 0 0 1 6.5 3Z";
const STATES = {
  up_to_date: { label: "À jour", tone: "sage", icon: <><path d={RECEIPT} fill="currentColor" fillOpacity=".14" /><path className="rv-tick" d="m9 11.5 2.2 2.2L15.5 9.5" /></> },
  late: { label: "En retard", tone: "coral", icon: <><rect x="3" y="4.5" width="14" height="13.5" rx="2.4" fill="currentColor" fillOpacity=".14" /><path d="M7 2.5V6M13 2.5V6M3 9h14" /><circle cx="17" cy="17" r="5" style={{ fill: "var(--rv-tile)" }} /><path className="rv-hand" d="M17 14.6V17l1.6 1.1" /></> },
  not_started: { label: "Pas encore facturé", tone: "sky", icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="currentColor" fillOpacity=".12" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path className="rv-flag" d="M10 18.5v-6h4.5l-1 1.5 1 1.5H10" /></> },
  stopped: { label: "Facturation arrêtée", tone: "mist", icon: <><path d={RECEIPT} fill="currentColor" fillOpacity=".12" /><path d="M10.5 9v5M13.5 9v5" /></> },
  loss: { label: "Perte déclarée", tone: "wine", icon: <><path d={RECEIPT} fill="currentColor" fillOpacity=".14" /><path d="m9.5 9 5 5M14.5 9l-5 5" /></> },
  unknown: { label: "Non suivi en finance", tone: "mist", icon: <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /> },
};
// États d'un mois, ceux de l'échéancier de la page Finance (report, pause et régularisation compris).
const MONTH_STATES = [["paid", "Payé"], ["regularized", "Régularisé"], ["partial", "Partiel"], ["unpaid", "Impayé"], ["deferred", "Reporté"], ["paused", "En pause"], ["upcoming", "À venir"]];
const money = (v) => (v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: Number(v) % 1 ? 2 : 0 }).format(v));
const day = (iso) => { try { return iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; } catch { return ""; } };
const monthLabel = (ym, long = false) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 15).toLocaleDateString("fr-FR", long ? { month: "long", year: "numeric" } : { month: "short" }).replace(".", "");
};

function useReceivables(numero) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    apiClient.get(`/api/v1/optilex/client-receivables?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) setError(e?.message || "Créances indisponibles."); });
    return () => { alive = false; };
  }, [numero]);
  return { data, error };
}

// Valeur de la ligne « Créances » : la pastille d'état, le montant en retard s'il y en a, et un repère discret.
export function ReceivablesValue({ numero }) {
  const { data, error } = useReceivables(numero);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState({ x: 0, y: 0 });
  const btn = useRef(null);
  if (error) return <span className="rv-none">Indisponible pour le moment</span>;
  if (!data) return <span className="rv-skel" aria-label="Chargement des créances" />;
  const st = STATES[data.status] || STATES.unknown;
  const hint = data.status === "late" ? `${data.overdue_months || 0} mois`
    : data.status === "up_to_date" && data.last_payment ? `payé le ${day(data.last_payment.date)}`
    : data.status === "not_started" && data.next_due ? `1re échéance en ${monthLabel(data.next_due.month, true)}` : "";
  const openModal = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setFrom({ x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 });
    setOpen(true);
  };
  return (
    <>
      <button ref={btn} type="button" className={`rv-chip is-${st.tone}${data.status === "late" ? " is-alert" : ""}`} onClick={openModal}
        title="Voir le détail des créances" disabled={data.status === "unknown"}>
        <Ico size={15}>{st.icon}</Ico>
        <span>{st.label}{data.status === "late" && data.overdue_amount ? ` · ${money(data.overdue_amount)}` : ""}</span>
      </button>
      {hint && <span className="rv-hint">{hint}</span>}
      {createPortal(<AnimatePresence>{open && <ReceivablesModal key="rv" data={data} from={from} onClose={() => { setOpen(false); btn.current?.focus(); }} />}</AnimatePresence>, document.body)}
    </>
  );
}

// Fenêtre de détail (dev 29/10/2026, « exact same one but better ») : même mise en page que « Faire l'onboarding »,
// trois chiffres-clés illustrés, la frise des mois (payé, partiel, impayé, à venir) dans sa carte, puis les paiements
// en lignes encadrées. Elle naît de la pastille (ressort) et y retourne.
function ReceivablesModal({ data, from, onClose }) {
  const st = STATES[data.status] || STATES.unknown;
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    box.current?.querySelector("button")?.focus();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  const periods = data.periods || [];
  const late = (data.overdue_amount || 0) > 0;
  return (
    <motion.div className="rv-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div ref={box} role="dialog" aria-modal="true" aria-label="Créances du client" className="rv-modal"
        initial={{ opacity: 0, x: from.x * 0.6, y: from.y * 0.6, scale: 0.7 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } }}
        exit={{ opacity: 0, x: from.x * 0.3, y: from.y * 0.3, scale: 0.9, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}>
        <header className="rv-head">
          <span className={`rv-tile is-${st.tone}`}><Ico size={22}>{st.icon}</Ico></span>
          <div>
            <h3>Créances</h3>
            <p>{st.label}{data.status === "late" ? ` depuis ${data.overdue_months || 0} mois` : ""}</p>
          </div>
          <button type="button" className="rv-close" aria-label="Fermer" onClick={onClose}><Ico size={16}><path d="M18 6 6 18M6 6l12 12" /></Ico></button>
        </header>
        <div className="rv-body ofd">
          <div className="ofd-stats">
            <Stat i={0} label="En retard" value={money(data.overdue_amount || 0)} tone={late ? "#bf4436" : undefined} alert={late}
              sub={late ? `${data.overdue_months || 0} mois` : "rien de dû"} art="receipt" />
            <Stat i={1} label="Payé à date" value={money(data.paid_to_date)} sub={data.last_payment ? `dernier le ${day(data.last_payment.date).slice(0, 5)}` : "aucun paiement"} art="paid" />
            <Stat i={2} label="Attendu à date" value={money(data.expected_to_date)} sub="depuis le début" art="calendar" />
          </div>
          {periods.length > 0 && (
            <Panel title="Mois par mois" aside={<div className="rv-legend">{MONTH_STATES.filter(([k]) => ["paid", "partial", "unpaid", "upcoming"].includes(k) || periods.some((p) => p.state === k))
              .map(([k, l]) => <span key={k} className={`is-${k}`}>{l}</span>)}</div>}>
              <div className="rv-months" role="list" aria-label="Paiements mois par mois">
                {periods.map((p, i) => (
                  <div key={p.month} role="listitem" className={`rv-m is-${p.state}`} style={{ "--rv-i": i }}
                    title={`${monthLabel(p.month, true)} : ${p.state === "upcoming" ? `à venir, ${money(p.expected)}` : p.state === "none" ? "rien d'attendu"
                      : p.state === "paused" ? "en pause" : p.state === "deferred" ? `reporté, ${money(p.expected)}` : `${money(p.paid)} payés sur ${money(p.expected)}${p.state === "regularized" ? ", régularisé" : ""}`}`}>
                    <span className="rv-m-sq" />
                    <small>{monthLabel(p.month)}</small>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {(data.last_payment || data.next_due || data.promise) && (
            <Panel title="Paiements">
              <div className="ofd-list">
                {data.last_payment && <ListRow icon="coin" label="Dernier paiement">{money(data.last_payment.amount)} le {day(data.last_payment.date)}</ListRow>}
                {data.next_due && <ListRow icon="date" label="Prochaine échéance">{money(data.next_due.amount)} en {monthLabel(data.next_due.month, true)}</ListRow>}
                {data.promise && <ListRow icon="promise" label="Promesse de paiement">{money(data.promise.amount)} le {day(data.promise.date)}{data.promise.note ? <Tag tone="#6b665f">{data.promise.note}</Tag> : null}</ListRow>}
              </div>
            </Panel>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
