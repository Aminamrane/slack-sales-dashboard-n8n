// Notifications globales du CRM, pour le menu de gauche (dev 09/11/2026 : la navbar disparaît, ses notifications
// passent dans le menu). Même source et mêmes règles que la navbar : liste lue au montage puis toutes les 30 s,
// poussées en direct par le ws-relay (événement window `global_notification`, filtré par rôle), lecture d'une
// notification ou de toutes côté serveur.
// Gestion (dev 16/11/2026, la direction en a des centaines) : la liste s'allonge (« Voir plus »), l'onglet
// « Non lues » demande au serveur TOUTES les non lues, et on peut retirer des notifications de sa liste en masse.
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../../services/apiClient";

const POLL_MS = 30000;
export const PAGE = 30;

export default function useGlobalNotifications() {
  const [items, setItems] = useState([]);
  // Compteurs du serveur : toutes les non lues visibles, et combien la liste demandée en contient en tout.
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState("all");      // "all" | "unread"
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Une réponse partie avant une écriture locale (lu, retiré) est jetée : elle remettrait l'ancien état.
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!apiClient.getToken()) return;
    const mine = seq.current;
    try {
      const data = await apiClient.get(`/api/v1/notifications/global?limit=${limit}${view === "unread" ? "&unread_only=true" : ""}`);
      if (!alive.current || mine !== seq.current || !Array.isArray(data?.notifications)) return;
      setItems(data.notifications);
      setUnread(Number.isFinite(data.unread_count) ? data.unread_count : data.notifications.filter((n) => !n.read).length);
      setTotal(Number.isFinite(data.total_count) ? data.total_count : data.notifications.length);
    } catch { /* réseau : on garde la liste affichée, le prochain passage réessaie */ }
    finally { if (alive.current) setLoading(false); }
  }, [limit, view]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive.current = false; clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    const onPush = (e) => {
      const notif = e.detail;
      if (!notif?.id) return;
      const me = apiClient.getUser();
      // Seconde barrière derrière le back (fuite d'avant le 08/10) : jamais la notification d'une autre personne,
      // jamais celle d'un autre rôle.
      if (notif.target_user_id && String(notif.target_user_id) !== String(me?.id)) return;
      if (notif.target_roles && !notif.target_roles.includes(me?.role)) return;
      if (itemsRef.current.some((p) => p.id === notif.id)) return;
      setItems((prev) => (prev.some((p) => p.id === notif.id) ? prev : [notif, ...prev]));
      setUnread((u) => u + 1);
      setTotal((t) => t + 1);
    };
    window.addEventListener("global_notification", onPush);
    return () => window.removeEventListener("global_notification", onPush);
  }, []);

  // Lues ailleurs dans la page (les Échanges d'une fiche Finance, dev 17/11/2026) : déjà envoyées au serveur, la cloche
  // les marque lues tout de suite au lieu d'attendre le prochain passage.
  useEffect(() => {
    const onRead = (e) => {
      const ids = e.detail?.ids || [];
      if (!ids.length) return;
      seq.current += 1;
      const fresh = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).length;
      setUnread((u) => Math.max(0, u - fresh));
      setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    };
    window.addEventListener("global_notifications_read", onRead);
    return () => window.removeEventListener("global_notifications_read", onRead);
  }, []);

  const changeView = useCallback((next) => { setView(next); setLimit(PAGE); setLoading(true); }, []);
  const showMore = useCallback(() => { setLimit((l) => l + PAGE); setLoading(true); }, []);

  const markRead = useCallback(async (ids) => {
    if (!ids.length) return;
    seq.current += 1;
    const fresh = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).length;
    setUnread((u) => Math.max(0, u - fresh));
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    try { await apiClient.post("/api/v1/notifications/global/read", { ids }); } catch { /* relu au prochain passage */ }
  }, []);

  const markAllRead = useCallback(async () => {
    seq.current += 1;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await apiClient.post("/api/v1/notifications/global/read-all"); } catch { /* relu au prochain passage */ }
  }, []);

  // Retirer de SA liste (les autres destinataires la gardent) ; le serveur la compte aussi comme lue.
  const dismiss = useCallback(async (ids) => {
    if (!ids.length) return false;
    seq.current += 1;
    const gone = itemsRef.current.filter((n) => ids.includes(n.id));
    setUnread((u) => Math.max(0, u - gone.filter((n) => !n.read).length));
    setTotal((t) => Math.max(0, t - gone.length));
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    try {
      await apiClient.post("/api/v1/notifications/global/dismiss", { ids });
      return true;
    } catch {
      seq.current += 1;
      load();   // échec : la liste du serveur fait foi
      return false;
    }
  }, [load]);

  return { items, unreadCount: unread, total, view, setView: changeView, showMore, loading, markRead, markAllRead, dismiss };
}
