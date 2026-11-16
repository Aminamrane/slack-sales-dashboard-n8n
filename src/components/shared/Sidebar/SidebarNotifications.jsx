// Notifications dans le menu de gauche (dev 09/11/2026) : en haut du menu, une ligne « Notifications » qui passe
// au rouge, avec son compteur, tant qu'il reste quelque chose à lire. Un clic ouvre la liste DANS le menu (il
// s'élargit le temps de la lecture) : Toutes / Non lues, chaque notification avec son action, « Tout marquer comme
// lu » en bas. Échap ou la flèche de retour referment.
// Gestion (dev 16/11/2026, « je ne peux pas les lire en intégralité », « un système de coche pour la suppression de
// masse ») : le texte se lit en entier (« Lire la suite »), la liste s'allonge (« Voir plus »), et « Sélectionner »
// fait apparaître des cases pour marquer lu ou retirer plusieurs notifications d'un coup. Retirer ne touche que sa
// propre liste : les autres destinataires gardent la leur.
import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, AtSign, Bell, Check, CheckCheck, FileText, Mail, ShieldAlert, Trash2, TrendingDown, User } from "lucide-react";
import apiClient from "../../../services/apiClient";
import { CLIENT_NOTIFICATION_TYPES, notificationDate, notificationTarget } from "../../../utils/notificationPresentation.js";

const ago = (value) => {
  const { iso } = notificationDate(value);
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const glyphOf = (n) => (n.type === "owner_rating_regression" ? TrendingDown : n.type === "sheet_invitation" ? Mail
  : (n.type === "board_mention" || n.type === "finance_note_mention") ? AtSign : n.type === "optilex_contract_alert" ? ShieldAlert : Bell);
// Le bouton dit où mène la notification ; le board est celui du rôle de la personne connectée.
const actionOf = (n) => {
  const target = notificationTarget(n, apiClient.getUser()?.role);
  if (!target) return null;
  if (CLIENT_NOTIFICATION_TYPES.includes(n.type) || n.type === "board_mention" || n.type === "finance_note_mention") return { target, label: "Voir le client", Icon: User };
  return { target, label: "Ouvrir", Icon: FileText };
};
// Au-delà de deux lignes (environ), le texte est coupé : « Lire la suite » l'affiche en entier.
const isLong = (text) => text.length > 110 || text.includes("\n");

export function NotificationsRow({ collapsed, unread, open, onToggle }) {
  const label = unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications";
  return (
    <div className={`sb-notif-row${collapsed ? " is-collapsed" : ""}`}>
      <button type="button" className={`sb-notif-btn${unread ? " has-unread" : ""}${open ? " is-open" : ""}`} onClick={onToggle}
        aria-expanded={open} aria-label={label} title={collapsed ? label : undefined}>
        <span className={`sb-notif-bell${unread ? " is-ringing" : ""}`}><Bell size={16} strokeWidth={2} aria-hidden="true" /></span>
        {!collapsed && <span className="sb-notif-label">Notifications</span>}
        {unread > 0 && <span className="sb-notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
    </div>
  );
}

export function NotificationsPanel({ items, unreadCount, total, view, onView, onMore, loading, onOpen, onMarkRead, onReadAll, onDismiss, onClose }) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const shown = view === "unread" ? items.filter((n) => !n.read) : items;
  const left = Math.max(0, total - items.length);
  // Changer d'onglet ou quitter la sélection repart de zéro.
  useEffect(() => { setPicked(new Set()); setConfirm(false); }, [view, selecting]);
  useEffect(() => { setConfirm(false); }, [picked]);
  const toggle = (id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allPicked = shown.length > 0 && shown.every((n) => picked.has(n.id));
  const ids = [...picked];
  const readPicked = async () => { await onMarkRead(ids); setSelecting(false); };
  const removePicked = async () => {
    if (!confirm) { setConfirm(true); return; }
    await onDismiss(ids);
    setSelecting(false);
  };
  const expand = (n) => {
    setExpanded((e) => ({ ...e, [n.id]: !e[n.id] }));
    if (!n.read) onMarkRead([n.id]);   // lue en entier : comptée comme lue
  };
  return (
    <section className={`sb-notif-panel${selecting ? " is-selecting" : ""}`} aria-label="Notifications">
      <header className="sb-notif-head">
        <button type="button" className="sb-notif-back" onClick={onClose} aria-label="Revenir au menu"><ArrowLeft size={16} aria-hidden="true" /></button>
        <h2>Notifications</h2>
        <button type="button" className={`sb-notif-select${selecting ? " is-on" : ""}`} onClick={() => setSelecting((s) => !s)} disabled={!selecting && !shown.length}
          aria-pressed={selecting}>{selecting ? "Terminé" : "Sélectionner"}</button>
        <div className="sb-notif-tabs" role="tablist" aria-label="Filtrer les notifications">
          {[["all", "Toutes"], ["unread", "Non lues"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "is-on" : ""} onClick={() => onView(k)}>
              {l}{k === "unread" && unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
          ))}
        </div>
      </header>
      <div className="sb-notif-list ceo-side-scroll">
        <AnimatePresence initial={false}>
          {shown.map((n, i) => {
            const Glyph = glyphOf(n);
            const action = actionOf(n);
            const message = n.message && n.message !== n.title ? n.message : "";
            const open = !!expanded[n.id];
            const on = picked.has(n.id);
            return (
              <motion.article key={n.id} layout={!reduce} className={`sb-notif-item${n.read ? "" : " is-unread"}${on ? " is-picked" : ""}`}
                initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.025 } }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.14 } }}
                onClick={selecting ? () => toggle(n.id) : undefined}>
                {selecting ? (
                  <span className={`sb-notif-check${on ? " is-on" : ""}`} role="checkbox" aria-checked={on} aria-label={`Sélectionner : ${n.title || n.message}`}
                    tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(n.id); } }}>
                    {on && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                  </span>
                ) : (
                  <span className="sb-notif-ic"><Glyph size={16} strokeWidth={1.9} aria-hidden="true" /></span>
                )}
                <div className="sb-notif-body">
                  <div className="sb-notif-top">
                    <strong title={n.title || n.message}>{n.title || n.message}</strong>
                    <time dateTime={notificationDate(n.created_at).iso} title={notificationDate(n.created_at).label}>{ago(n.created_at)}</time>
                  </div>
                  {message && <p className={open ? "is-open" : ""}>{message}</p>}
                  {!selecting && (message && isLong(message) || action) && (
                    <div className="sb-notif-acts">
                      {action && (
                        <button type="button" className="sb-notif-action" onClick={() => onOpen(n, action.target)}>
                          <action.Icon size={13} aria-hidden="true" />{action.label}
                        </button>
                      )}
                      {message && isLong(message) && (
                        <button type="button" className="sb-notif-more" aria-expanded={open} onClick={() => expand(n)}>{open ? "Réduire" : "Lire la suite"}</button>
                      )}
                    </div>
                  )}
                </div>
                {!selecting && !n.read && <button type="button" className="sb-notif-dot" onClick={() => onOpen(n, null)} aria-label="Marquer comme lue" title="Marquer comme lue" />}
                {!selecting && (
                  <button type="button" className="sb-notif-del" onClick={() => onDismiss([n.id])} aria-label="Retirer de ma liste" title="Retirer de ma liste">
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </motion.article>
            );
          })}
        </AnimatePresence>
        {!shown.length && !loading && (
          <div className="sb-notif-empty"><Bell size={22} aria-hidden="true" /><p>{view === "unread" ? "Tout est lu." : "Aucune notification."}</p></div>
        )}
        {left > 0 && shown.length > 0 && (
          <button type="button" className="sb-notif-load" onClick={onMore} disabled={loading}>
            {loading ? "Chargement…" : `Voir plus · ${left} autre${left > 1 ? "s" : ""}`}
          </button>
        )}
      </div>
      <footer className="sb-notif-foot">
        {selecting ? (
          <div className="sb-notif-bulk">
            <button type="button" className="sb-notif-all" onClick={() => setPicked(allPicked ? new Set() : new Set(shown.map((n) => n.id)))}>
              <span className={`sb-notif-check${allPicked ? " is-on" : ""}`} aria-hidden="true">{allPicked && <Check size={13} strokeWidth={3} />}</span>
              {picked.size ? `${picked.size} sélectionnée${picked.size > 1 ? "s" : ""}` : "Tout sélectionner"}
            </button>
            <span className="sb-notif-bulk-acts">
              <button type="button" onClick={readPicked} disabled={!picked.size} title="Marquer comme lues"><CheckCheck size={15} aria-hidden="true" />Lu</button>
              <button type="button" className={`sb-notif-remove${confirm ? " is-confirm" : ""}`} onClick={removePicked} disabled={!picked.size}>
                <Trash2 size={14} aria-hidden="true" />{confirm ? `Retirer ${picked.size} ?` : "Retirer"}
              </button>
            </span>
          </div>
        ) : (
          <button type="button" onClick={onReadAll} disabled={!unreadCount}><CheckCheck size={15} aria-hidden="true" />Tout marquer comme lu</button>
        )}
      </footer>
    </section>
  );
}
