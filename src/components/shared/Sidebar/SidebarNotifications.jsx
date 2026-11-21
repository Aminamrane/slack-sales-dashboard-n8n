// Notifications dans le menu de gauche (dev 09/11/2026) : en haut du menu, une ligne « Notifications » qui passe
// au rouge, avec son compteur, tant qu'il reste quelque chose à lire. Un clic ouvre la liste DANS le menu (il
// s'élargit le temps de la lecture) : Toutes / Non lues, chaque notification avec son action, « Tout marquer comme
// lu » en bas. Échap ou la flèche de retour referment.
// Gestion (dev 16/11/2026, « je ne peux pas les lire en intégralité », « un système de coche pour la suppression de
// masse ») : le texte se lit en entier (« Lire la suite »), la liste s'allonge (« Voir plus »), et « Sélectionner »
// fait apparaître des cases pour marquer lu ou retirer plusieurs notifications d'un coup. Retirer ne touche que sa
// propre liste : les autres destinataires gardent la leur.
// Non lues (dev 21/11/2026) : la liste s'ouvre sur « Non lues », et une notification lue par « Lire la suite » y reste
// affichée jusqu'à ce qu'on referme la liste ou change d'onglet, pour pouvoir la lire.
// Mouvement (dev 21/11/2026 : « quand on les supprime, quand on les ouvre, que ce soit vraiment rassurant ») : une
// notification retirée se teinte de rouge et glisse vers la droite avant que la place se referme ; une notification lue
// quitte « Non lues » en se repliant ; plusieurs à la fois partent en cascade ; le point vert se rétracte ; le texte
// révélé apparaît en fondu ; les compteurs rebondissent quand ils changent. Animations réduites : simple fondu.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, AtSign, Bell, Check, CheckCheck, FileText, Mail, MessageSquare, ShieldAlert, Trash2, TrendingDown, User } from "lucide-react";
import apiClient from "../../../services/apiClient";
import { CLIENT_NOTIFICATION_TYPES, notificationDate, notificationTarget } from "../../../utils/notificationPresentation.js";
import { panelMemory } from "./panelMemory.js";
import { pinIntoView } from "../../../utils/pinIntoView.js";

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
// Le bouton dit où mène la notification (le board est celui du rôle de la personne connectée) : une mention mène
// au commentaire exact, une météo à son échange (dev 16/11/2026 : « c'est le commentaire qui va intéresser »).
const actionOf = (n) => {
  const target = notificationTarget(n, apiClient.getUser()?.role);
  if (!target) return null;
  if (n.type === "board_mention" || n.type === "finance_note_mention") return { target, label: "Voir le commentaire", Icon: MessageSquare };
  if (n.type === "owner_rating_regression") return { target, label: "Voir la météo", Icon: TrendingDown };
  if (CLIENT_NOTIFICATION_TYPES.includes(n.type)) return { target, label: "Voir le client", Icon: User };
  return { target, label: "Ouvrir", Icon: FileText };
};
// Titre ou texte coupé (mesuré, pas deviné à la longueur) : « Lire la suite » affiche tout.
function useClipped(open, deps) {
  const titleRef = useRef(null);
  const textRef = useRef(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    if (open) return undefined;
    const t = titleRef.current; const p = textRef.current;
    const measure = () => setClipped(!!((t && t.scrollWidth > t.clientWidth + 1) || (p && p.scrollHeight > p.clientHeight + 1)));
    measure();
    // Le menu s'élargit à l'ouverture du panneau : on remesure quand la largeur change.
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    [t, p].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [open, ...deps]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { titleRef, textRef, clipped };
}

// « Lire la suite » / « Réduire » (dev 17/11/2026, « des lettres qui grossissent ») : la carte change de hauteur pour de
// vrai, en glissant de l'ancienne à la nouvelle, au lieu d'être étirée. Le texte garde sa taille et les cartes
// du dessous suivent d'elles-mêmes. Un second clic pendant le mouvement repart de la hauteur du moment.
function useHeightGlide(open, reduce, onExpand) {
  const cardRef = useRef(null);
  const fromRef = useRef(null);
  const expand = () => { fromRef.current = cardRef.current?.getBoundingClientRect().height ?? null; onExpand(); };
  useLayoutEffect(() => {
    const el = cardRef.current; const from = fromRef.current;
    fromRef.current = null;
    if (!el || from == null || reduce || typeof el.animate !== "function") return undefined;
    const to = el.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return undefined;
    el.style.overflow = "hidden";
    const anim = el.animate([{ boxSizing: "border-box", height: `${from}px` }, { boxSizing: "border-box", height: `${to}px` }],
      { duration: 240, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    const done = () => { el.style.overflow = ""; };
    anim.onfinish = done; anim.oncancel = done;
    return () => anim.cancel();
  }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { cardRef, expand };
}

export function NotificationsRow({ collapsed, unread, open, onToggle }) {
  const label = unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications";
  return (
    <div className={`sb-notif-row${collapsed ? " is-collapsed" : ""}`}>
      <button type="button" className={`sb-notif-btn${unread ? " has-unread" : ""}${open ? " is-open" : ""}`} onClick={onToggle}
        aria-expanded={open} aria-label={label} title={collapsed ? label : undefined}>
        <span className={`sb-notif-bell${unread ? " is-ringing" : ""}`}><Bell size={16} strokeWidth={2} aria-hidden="true" /></span>
        {!collapsed && <span className="sb-notif-label">Notifications</span>}
        {unread > 0 && <Count className="sb-notif-count" value={unread > 99 ? "99+" : unread} />}
      </button>
    </div>
  );
}

const EASE = [0.22, 1, 0.36, 1];          // courbe du style Owner
const AWAY = [0.5, 0, 0.75, 0.25];        // ce qui s'en va (mouvement de rangement)
// Un compteur qui change rebondit, pour qu'on voie que le geste a été pris en compte.
// Pas au premier affichage : seulement quand la valeur change sous les yeux.
function Count({ value, className }) {
  const reduce = useReducedMotion();
  const shownOnce = useRef(false);
  useEffect(() => { shownOnce.current = true; }, []);
  return (
    <motion.span key={value} className={className} initial={shownOnce.current && !reduce ? { scale: 1.35 } : false} animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 18 }}>{value}</motion.span>
  );
}

const stamp = (n) => new Date(notificationDate(n.created_at).iso || 0).getTime();
function unreadShown(items, kept) {
  const list = items.filter((n) => !n.read || kept[n.id]);
  const gone = Object.values(kept).filter((k) => !items.some((n) => n.id === k.id));
  return gone.length ? [...list, ...gone].sort((a, b) => stamp(b) - stamp(a)) : list;
}

// Repère de jour : « Aujourd'hui », « Hier », puis « Lundi 16 novembre » (heure de Paris).
const dayKeyOf = (value) => {
  const { iso } = notificationDate(value);
  return iso ? new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(iso)) : "";
};
function dayLabel(key) {
  if (!key) return "";
  const today = dayKeyOf(new Date().toISOString());
  const yesterday = dayKeyOf(new Date(Date.now() - 86400000).toISOString());
  if (key === today) return "Aujourd’hui";
  if (key === yesterday) return "Hier";
  const label = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function NotificationsPanel({ items, unreadCount, total, view, onView, onMore, loading, onOpen, onMarkRead, onReadAll, onDismiss, onClose }) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  // Lues par « Lire la suite » pendant cette ouverture : elles restent dans « Non lues », même quand le prochain passage
  // du serveur (qui ne renvoie que les non lues) ne les contient plus.
  const [kept, setKept] = useState(() => panelMemory.kept);
  useEffect(() => { panelMemory.kept = kept; }, [kept]);
  // La notification ouverte en dernier : surlignée dans la liste, retrouvée et montrée dans chaque onglet.
  const [current, setCurrent] = useState(() => panelMemory.current);
  // Comment chaque notification qui va quitter la liste s'en va : retirée (« remove ») ou lue (« read »), et son rang
  // dans un départ groupé. Lu par les cartes qui sortent au moment de leur départ (AnimatePresence `custom`).
  const [leaving, setLeaving] = useState({});
  const leavingTimer = useRef(null);
  const markLeaving = (list, kind) => {
    setLeaving(Object.fromEntries(list.map((n, order) => [n.id, { kind, order }])));
    clearTimeout(leavingTimer.current);   // les départs finis, plus rien n'est en route
    leavingTimer.current = setTimeout(() => setLeaving({}), 1600);
  };
  useEffect(() => () => clearTimeout(leavingTimer.current), []);
  const shown = view === "unread" ? unreadShown(items, kept) : items;
  const left = Math.max(0, total - items.length);
  // Changer d'onglet ou quitter la sélection repart de zéro.
  useEffect(() => { setPicked(new Set()); setConfirm(false); }, [view, selecting]);
  // Un vrai changement d'onglet (pas le retour de la liste sur une nouvelle page) repart sans notification gardée.
  const viewSeen = useRef(view);
  useEffect(() => { if (viewSeen.current !== view) { viewSeen.current = view; setKept({}); } }, [view]);
  // « Toutes » : la notification ouverte est chargée (« Voir plus » au besoin), puis amenée sous les yeux.
  useEffect(() => {
    if (view !== "all" || !current || loading || items.some((n) => n.id === current) || left <= 0) return;
    onMore();
  }, [view, current, loading, items, left, onMore]);
  // Centrée et gardée là le temps que la liste finisse de se remplir (même outil que les messages de la fiche).
  const shownFor = useRef(null);
  const stopShow = useRef(() => {});
  useEffect(() => () => stopShow.current(), []);
  useEffect(() => {
    if (!current || shownFor.current === `${view}|${current}` || !document.getElementById(`notif-${current}`)) return;
    shownFor.current = `${view}|${current}`;
    stopShow.current();
    stopShow.current = pinIntoView(() => document.getElementById(`notif-${current}`), { hold: 1200 });
  });
  useEffect(() => { setConfirm(false); }, [picked]);
  const toggle = (id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allPicked = shown.length > 0 && shown.every((n) => picked.has(n.id));
  const ids = [...picked];
  // Retirée = partie pour de bon (21/11/2026) : une notification gardée sous les yeux par « Lire la suite » ne doit pas
  // revenir dans « Non lues » après qu'on l'a retirée (bug : la corbeille semblait ne rien faire).
  const forget = (ids1) => setKept((k) => {
    if (!ids1.some((id) => k[id])) return k;
    const next = { ...k };
    ids1.forEach((id) => { delete next[id]; });
    return next;
  });
  const readPicked = async () => { markLeaving(shown.filter((n) => picked.has(n.id)), "read"); await onMarkRead(ids); setSelecting(false); };
  const removePicked = async () => {
    if (!confirm) { setConfirm(true); return; }
    markLeaving(shown.filter((n) => picked.has(n.id)), "remove");
    forget(ids);
    await onDismiss(ids);
    setSelecting(false);
  };
  const removeOne = (ids1) => { markLeaving(shown.filter((n) => ids1.includes(n.id)), "remove"); forget(ids1); return onDismiss(ids1); };
  const readAll = () => { markLeaving(shown.filter((n) => !n.read), "read"); return onReadAll(); };
  // Ouvrir une notification : elle devient la notification en cours, reste à sa place dans « Non lues » (lue) et
  // reste surlignée ; la liste ne se ferme pas.
  const openOne = (n, target) => {
    if (target) {
      panelMemory.current = n.id;
      setCurrent(n.id);
      shownFor.current = `${view}|${n.id}`;   // déjà sous les yeux : pas de défilé
      // Écrite tout de suite dans la mémoire : la page change dans le même geste, avant tout effet de cette liste.
      if (!n.read) { panelMemory.kept = { ...kept, [n.id]: { ...n, read: true } }; setKept(panelMemory.kept); }
    }
    onOpen(n, target);
  };
  const expand = (n) => {
    setExpanded((e) => ({ ...e, [n.id]: !e[n.id] }));
    if (!n.read) {                       // lue en entier : comptée comme lue, mais gardée sous les yeux
      setKept((k) => ({ ...k, [n.id]: { ...n, read: true } }));
      onMarkRead([n.id]);
    }
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
              {l}{k === "unread" && unreadCount > 0 && <Count value={unreadCount} />}
            </button>
          ))}
        </div>
      </header>
      <div className="sb-notif-list ceo-side-scroll">
        <AnimatePresence initial={false} custom={leaving}>
          {shown.flatMap((n, i) => {
            const key = dayKeyOf(n.created_at);
            const head = i === 0 || key !== dayKeyOf(shown[i - 1].created_at)
              ? [<motion.div key={`day:${key}`} className="sb-notif-day" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}>{dayLabel(key)}</motion.div>]
              : [];
            return [...head,
              <NotificationItem key={n.id} n={n} i={i} reduce={reduce} selecting={selecting} on={picked.has(n.id)} open={!!expanded[n.id]}
                current={current === n.id} onToggle={() => toggle(n.id)} onExpand={() => expand(n)} onOpen={openOne} onDismiss={removeOne} />];
          })}
        </AnimatePresence>
        {!shown.length && !loading && (
          <motion.div className="sb-notif-empty" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.12 }}>
            {view === "unread" ? (
              <motion.span className="sb-notif-done" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.2 }}><CheckCheck size={20} aria-hidden="true" /></motion.span>
            ) : <Bell size={22} aria-hidden="true" />}
            <p>{view === "unread" ? "Tout est lu." : "Aucune notification."}</p>
          </motion.div>
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
          <button type="button" onClick={readAll} disabled={!unreadCount}><CheckCheck size={15} aria-hidden="true" />Tout marquer comme lu</button>
        )}
      </footer>
    </section>
  );
}

// Arrivée en cascade ; départ selon `leaving` (passé par AnimatePresence au moment où la carte quitte la liste) :
// retirée = teinte rouge, glissement à droite, puis la place se referme ; lue ou partie autrement = fondu, puis la place
// se referme. Dans un départ groupé, chaque carte attend son tour.
const COLLAPSE = { height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, overflow: "hidden" };
function itemMotion(id, reduce) {
  return {
    hidden: { opacity: 0, y: 10 },
    shown: (i) => ({ opacity: 1, y: 0, transition: { delay: typeof i === "number" ? Math.min(i, 8) * 0.038 : 0, duration: 0.32, ease: EASE } }),
    gone: (leaving) => {
      const how = leaving && typeof leaving === "object" ? leaving[id] : null;
      const delay = how ? Math.min(how.order, 10) * 0.045 : 0;
      if (reduce) return { opacity: 0, transition: { duration: 0.15, delay } };
      if (how?.kind === "remove") {
        return { ...COLLAPSE, opacity: 0, x: 56, backgroundColor: "var(--sb-red-bg)",
          transition: { default: { duration: 0.26, ease: EASE, delay: delay + 0.2 }, backgroundColor: { duration: 0.12, delay },
            x: { duration: 0.28, ease: AWAY, delay: delay + 0.04 }, opacity: { duration: 0.22, delay: delay + 0.1 } } };
      }
      return { ...COLLAPSE, opacity: 0,
        transition: { default: { duration: how ? 0.28 : 0.2, ease: EASE, delay: delay + (how ? 0.1 : 0) }, opacity: { duration: 0.18, delay } } };
    },
  };
}

function NotificationItem({ n, i, reduce, selecting, on, open, current, onToggle, onExpand, onOpen, onDismiss }) {
  const Glyph = glyphOf(n);
  const action = actionOf(n);
  const message = n.message && n.message !== n.title ? n.message : "";
  const { titleRef, textRef, clipped } = useClipped(open, [n.title, n.message]);
  const canExpand = open || clipped;
  const { cardRef, expand } = useHeightGlide(open, reduce, onExpand);
  return (
    <motion.article ref={cardRef} id={`notif-${n.id}`} className={`sb-notif-item${n.read ? "" : " is-unread"}${on ? " is-picked" : ""}${open ? " is-open" : ""}${current ? " is-current" : ""}`}
      variants={itemMotion(n.id, reduce)} custom={i} initial={reduce ? false : "hidden"} animate="shown" exit="gone"
      onClick={selecting ? onToggle : undefined}>
      {selecting ? (
        <span className={`sb-notif-check${on ? " is-on" : ""}`} role="checkbox" aria-checked={on} aria-label={`Sélectionner : ${n.title || n.message}`}
          tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}>
          {on && <Check size={13} strokeWidth={3} aria-hidden="true" />}
        </span>
      ) : (
        <span className="sb-notif-ic"><Glyph size={16} strokeWidth={1.9} aria-hidden="true" /></span>
      )}
      <div className="sb-notif-body">
        <div className="sb-notif-top">
          <strong ref={titleRef} title={open ? undefined : n.title || n.message} onClick={!selecting && canExpand ? expand : undefined}>{n.title || n.message}</strong>
          <time dateTime={notificationDate(n.created_at).iso} title={notificationDate(n.created_at).label}>{ago(n.created_at)}</time>
        </div>
        {message && <p ref={textRef} className={`${open ? "is-open" : ""}${!selecting && canExpand ? " is-expandable" : ""}`} onClick={!selecting && canExpand ? expand : undefined}>{message}</p>}
        {!selecting && (canExpand || action) && (
          <div className="sb-notif-acts">
            {action && (
              <button type="button" className="sb-notif-action" onClick={() => onOpen(n, action.target)}>
                <action.Icon size={13} aria-hidden="true" />{action.label}
              </button>
            )}
            {canExpand && <button type="button" className="sb-notif-more" aria-expanded={open} onClick={expand}>{open ? "Réduire" : "Lire la suite"}</button>}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!selecting && !n.read && (
          <motion.button key="dot" type="button" className="sb-notif-dot" onClick={() => onOpen(n, null)} aria-label="Marquer comme lue" title="Marquer comme lue"
            exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0, transition: { duration: 0.22, ease: AWAY } }} />
        )}
      </AnimatePresence>
      {!selecting && (
        <button type="button" className="sb-notif-del" onClick={() => onDismiss([n.id])} aria-label="Retirer de ma liste" title="Retirer de ma liste">
          <Trash2 size={13} aria-hidden="true" />
        </button>
      )}
    </motion.article>
  );
}
