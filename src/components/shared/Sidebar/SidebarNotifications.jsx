// Notifications dans le menu de gauche (dev 09/11/2026) : en haut du menu, une ligne « Notifications » qui passe
// au rouge, avec son compteur, tant qu'il reste quelque chose à lire. Un clic ouvre la liste DANS le menu (il
// s'élargit le temps de la lecture) : Toutes / Non lues, chaque notification avec son action, « Tout marquer comme
// lu » en bas. Échap ou la flèche de retour referment.
import { useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, AtSign, Bell, CheckCheck, FileText, Mail, TrendingDown, User } from "lucide-react";
import { notificationDate, notificationTarget } from "../../../utils/notificationPresentation.js";

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
const glyphOf = (n) => (n.type === "owner_rating_regression" ? TrendingDown : n.type === "sheet_invitation" ? Mail : n.type === "board_mention" ? AtSign : Bell);
// Le bouton dit où mène la notification (même cible que la navbar).
const actionOf = (n) => {
  const target = notificationTarget(n);
  if (!target) return null;
  if (n.type === "owner_rating_regression" || n.type === "board_mention") return { target, label: "Voir le client", Icon: User };
  return { target, label: "Ouvrir", Icon: FileText };
};

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

export function NotificationsPanel({ items, unreadCount, onOpen, onReadAll, onClose }) {
  const [tab, setTab] = useState("all");
  const reduce = useReducedMotion();
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;
  return (
    <section className="sb-notif-panel" aria-label="Notifications">
      <header className="sb-notif-head">
        <button type="button" className="sb-notif-back" onClick={onClose} aria-label="Revenir au menu"><ArrowLeft size={16} aria-hidden="true" /></button>
        <h2>Notifications</h2>
        <div className="sb-notif-tabs" role="tablist" aria-label="Filtrer les notifications">
          {[["all", "Toutes"], ["unread", "Non lues"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>
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
            return (
              <motion.article key={n.id} layout={!reduce} className={`sb-notif-item${n.read ? "" : " is-unread"}`}
                initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.025 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                <span className="sb-notif-ic"><Glyph size={16} strokeWidth={1.9} aria-hidden="true" /></span>
                <div className="sb-notif-body">
                  <div className="sb-notif-top">
                    <strong title={n.title || n.message}>{n.title || n.message}</strong>
                    <time dateTime={notificationDate(n.created_at).iso}>{ago(n.created_at)}</time>
                  </div>
                  {message && <p>{message}</p>}
                  {action && (
                    <button type="button" className="sb-notif-action" onClick={() => onOpen(n, action.target)}>
                      <action.Icon size={13} aria-hidden="true" />{action.label}
                    </button>
                  )}
                </div>
                {!n.read && <button type="button" className="sb-notif-dot" onClick={() => onOpen(n, null)} aria-label="Marquer comme lue" title="Marquer comme lue" />}
              </motion.article>
            );
          })}
        </AnimatePresence>
        {!shown.length && (
          <div className="sb-notif-empty"><Bell size={22} aria-hidden="true" /><p>{tab === "unread" ? "Tout est lu." : "Aucune notification."}</p></div>
        )}
      </div>
      <footer className="sb-notif-foot">
        <button type="button" onClick={onReadAll} disabled={!unreadCount}><CheckCheck size={15} aria-hidden="true" />Tout marquer comme lu</button>
      </footer>
    </section>
  );
}
