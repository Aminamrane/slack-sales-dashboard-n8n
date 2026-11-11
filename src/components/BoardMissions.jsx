// Missions du cabinet partenaire dans la fiche du board (dev 30/10/2026 : « juste une ligne dans les infos client,
// il y en a tant en cours, etc. »). Remplace la carte « Missions Opti'Lex » de l'onglet Intégration : la ligne donne
// les nombres par état, le clic ouvre le détail dans une fenêtre au style dashboard. Lecture seule de
// /optilex/client-missions (synchronisé avec le SaaS du cabinet), inchangé côté serveur.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { Panel, Stat, Tag } from "./DashParts.jsx";
import "./BoardMissions.css";

const Ico = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
// Une teinte (palette pastel du dev) et un pictogramme par catégorie de mission, dans l'ordre de la ligne.
const CATS = [
  { key: "in_progress", one: "en cours", many: "en cours", filter: "En cours", tone: "sky", ink: "#1b6fd0", icon: <><path d="M12 3a9 9 0 1 1-9 9" /><path className="ms-spin" d="M12 3a9 9 0 0 0-9 9" opacity=".35" /></> },
  { key: "waiting", one: "en attente", many: "en attente", filter: "En attente", tone: "sand", ink: "#8a5a14", icon: <><path d="M6 3h12M6 21h12" /><path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" /></> },
  { key: "upcoming", one: "à venir", many: "à venir", filter: "À venir", tone: "lilac", ink: "#4a3fc4", icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></> },
  { key: "paused", one: "en pause", many: "en pause", filter: "En pause", tone: "mist", ink: "#6b665f", icon: <path d="M9 5v14M15 5v14" /> },
  { key: "completed", one: "terminée", many: "terminées", filter: "Terminées", tone: "sage", ink: "#3f7f4b", icon: <path className="ms-tick" d="m5 12.5 4.5 4.5L19 7.5" /> },
  { key: "cancelled", one: "annulée", many: "annulées", filter: "Annulées", tone: "wine", ink: "#85334e", icon: <path d="M6 6l12 12M18 6 6 18" /> },
  { key: "other", one: "autre", many: "autres", filter: "Autres", tone: "mist", ink: "#6b665f", icon: <><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></> },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
const MISSION_ICON = <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M9 5V3h6v2M8 11l2 2 5-5M8 17h8" /></>;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const synced = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}`;
};
const PAGE = 6;

function useMissions(numero) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    apiClient.get(`/api/v1/optilex/client-missions?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setData(r); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [numero, retry]);
  const reload = useCallback(() => setRetry((v) => v + 1), []);
  return { data, error, loading, reload };
}

// Valeur de la ligne : une pastille par état présent (« 1 en cours », « 2 terminées »…), le tout cliquable.
export function MissionsValue({ numero }) {
  const { data, error, loading, reload } = useMissions(numero);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState({ x: 0, y: 0 });
  const btn = useRef(null);
  if (!data && loading) return <span className="ms-skel" aria-label="Chargement des missions" />;
  if (error && !data) return <span className="ms-none">Indisponible pour le moment <button type="button" className="ms-retry" onClick={reload}>Réessayer</button></span>;
  if (data?.status === "pending") return <span className="ms-none">Dossier pas encore relié au cabinet</span>;
  const counts = data?.counts || {};
  if (!counts.total) return <span className="ms-none">Aucune mission</span>;
  const present = CATS.filter((c) => counts[c.key] > 0);
  const openModal = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setFrom({ x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 });
    setOpen(true);
  };
  return (
    <>
      <button ref={btn} type="button" className="ms-line" onClick={openModal} title="Voir les missions du cabinet partenaire"
        aria-label={`${counts.total} mission${counts.total > 1 ? "s" : ""} : ${present.map((c) => `${counts[c.key]} ${counts[c.key] > 1 ? c.many : c.one}`).join(", ")}`}>
        {present.map((c, i) => (
          <span key={c.key} className={`ms-pill is-${c.tone}`} style={{ "--ms-i": i }}>
            <Ico size={12}>{c.icon}</Ico>{counts[c.key]} {counts[c.key] > 1 ? c.many : c.one}
          </span>
        ))}
        <span className="ms-chev" aria-hidden="true"><Ico size={13}><path d="m9 6 6 6-6 6" /></Ico></span>
      </button>
      {createPortal(<AnimatePresence>{open && <MissionsModal key="ms" data={data} loading={loading} reload={reload} from={from} onClose={() => { setOpen(false); btn.current?.focus(); }} />}</AnimatePresence>, document.body)}
    </>
  );
}

// Fenêtre de détail : même mise en page que « Créances » et « Faire l'onboarding ». Trois chiffres-clés, puis les
// missions en cartes, filtrables par état ; l'état de synchronisation avec le cabinet sous le titre.
function MissionsModal({ data, loading, reload, from, onClose }) {
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    box.current?.querySelector(".ms-close")?.focus();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  const counts = data.counts || {};
  const missions = data.missions || [];
  const items = missions.filter((m) => filter === "all" || m.category === filter);
  const lastDone = missions.filter((m) => m.completedAt).map((m) => m.completedAt).sort().pop();
  const first = missions.map((m) => m.createdAt).filter(Boolean).sort()[0];
  const chips = [["all", "Toutes", counts.total], ...CATS.filter((c) => counts[c.key] > 0).map((c) => [c.key, c.filter, counts[c.key]])];
  const pick = (k) => { setFilter(k); setLimit(PAGE); };
  return (
    <motion.div className="ms-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div ref={box} role="dialog" aria-modal="true" aria-label="Missions du cabinet partenaire" className="ms-modal"
        initial={{ opacity: 0, x: from.x * 0.6, y: from.y * 0.6, scale: 0.7 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } }}
        exit={{ opacity: 0, x: from.x * 0.3, y: from.y * 0.3, scale: 0.9, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}>
        <header className="ms-head">
          <span className="ms-tile"><Ico size={22}>{MISSION_ICON}</Ico></span>
          <div>
            <h3>Missions cabinet partenaire</h3>
            <p className={data.stale ? "is-stale" : undefined}>
              {data.client_code && `Dossier ${data.client_code} · `}
              {data.stale ? `Dernières données du ${synced(data.checked_at)}, actualisation momentanément indisponible` : `Synchronisé le ${synced(data.checked_at)}`}
            </p>
          </div>
          <button type="button" className={`ms-refresh${loading ? " is-busy" : ""}`} disabled={loading} onClick={reload} aria-label="Actualiser les missions" title="Actualiser les missions">
            <Ico size={15}><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></Ico>
          </button>
          <button type="button" className="ms-close" aria-label="Fermer" onClick={onClose}><Ico size={16}><path d="M18 6 6 18M6 6l12 12" /></Ico></button>
        </header>
        <div className="ms-body ofd">
          <div className="ofd-stats">
            <Stat i={0} label="En cours" value={counts.in_progress || 0} sub={counts.waiting ? `${counts.waiting} en attente` : "aucune en attente"} art="doc" />
            <Stat i={1} label="Terminées" value={counts.completed || 0} sub={lastDone ? `dernière le ${day(lastDone).slice(0, 5)}` : "aucune pour l'instant"} art="check" />
            <Stat i={2} label="Au total" value={counts.total || 0} sub={first ? `depuis le ${day(first).slice(0, 5)}` : ""} art="stack" />
          </div>
          <Panel title="Missions" aside={chips.length > 2 && (
            <div className="ms-filters" role="group" aria-label="Filtrer par état">
              {chips.map(([k, l, n]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => pick(k)}>
                  {filter === k && <motion.span layoutId="msFilter" className="ms-filter-bg" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                  <span>{l}</span><b>{n}</b>
                </button>
              ))}
            </div>
          )}>
            <ul className="ms-list">
              {items.slice(0, limit).map((m, i) => {
                const c = CAT[m.category] || CAT.other;
                const when = m.category === "completed" && m.completedAt ? `Terminée le ${day(m.completedAt)}`
                  : m.deadline ? `Échéance le ${day(m.deadline)}` : m.createdAt ? `Créée le ${day(m.createdAt)}` : "";
                return (
                  <li key={m.id} className="ms-item" style={{ "--ms-i": i }}>
                    <span className={`ms-glyph is-${c.tone}`}><Ico size={15}>{c.icon}</Ico></span>
                    <div className="ms-item-tx">
                      <strong>{m.title || "Mission sans titre"}</strong>
                      <small>{[m.companyName, m.departmentLabel, when].filter(Boolean).join(" · ")}</small>
                    </div>
                    <Tag tone={c.ink}>{m.statusLabel || "Statut non renseigné"}</Tag>
                  </li>
                );
              })}
            </ul>
            {!items.length && <p className="ofd-note">Aucune mission dans cet état.</p>}
            {items.length > limit && <button type="button" className="ofd-link" onClick={() => setLimit((v) => v + 20)}>Voir plus ({items.length - limit})</button>}
          </Panel>
        </div>
      </motion.div>
    </motion.div>
  );
}
