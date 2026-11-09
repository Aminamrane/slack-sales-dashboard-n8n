// Notifications globales du CRM, pour le menu de gauche (dev 09/11/2026 : la navbar disparaît, ses notifications
// passent dans le menu). Même source et mêmes règles que la navbar : liste lue au montage puis toutes les 30 s,
// poussées en direct par le ws-relay (événement window `global_notification`, filtré par rôle), lecture d'une
// notification ou de toutes côté serveur.
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../../services/apiClient";

const POLL_MS = 30000;

export default function useGlobalNotifications() {
  const [items, setItems] = useState([]);
  // Compteur du serveur : il compte toutes les non lues visibles, pas seulement les 20 dernières affichées.
  const [unread, setUnread] = useState(0);
  const alive = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    alive.current = true;
    const load = async () => {
      if (!apiClient.getToken()) return;
      try {
        const data = await apiClient.get("/api/v1/notifications/global?limit=20");
        if (alive.current && Array.isArray(data?.notifications)) {
          setItems(data.notifications);
          setUnread(Number.isFinite(data.unread_count) ? data.unread_count : data.notifications.filter((n) => !n.read).length);
        }
      } catch { /* réseau : on garde la liste affichée, le prochain passage réessaie */ }
    };
    load();
    const timer = setInterval(load, POLL_MS);
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
    };
    window.addEventListener("global_notification", onPush);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener("global_notification", onPush); };
  }, []);

  const markRead = useCallback(async (ids) => {
    if (!ids.length) return;
    const fresh = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).length;
    setUnread((u) => Math.max(0, u - fresh));
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    try { await apiClient.post("/api/v1/notifications/global/read", { ids }); } catch { /* relu au prochain passage */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await apiClient.post("/api/v1/notifications/global/read-all"); } catch { /* relu au prochain passage */ }
  }, []);

  return { items, unreadCount: unread, markRead, markAllRead };
}
