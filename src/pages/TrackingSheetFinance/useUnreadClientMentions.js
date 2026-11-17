// useUnreadClientMentions.js — mentions non lues de la personne connectée au sujet du client de la fiche
// (dev 17/11/2026 : le compteur de l'onglet « Échanges » est rouge tant qu'il en reste, neutre sinon).
//
// Même source et mêmes règles que la cloche (useGlobalNotifications) : GET /notifications/global, relu toutes les
// 30 s quand la page est visible, et les notifications poussées en direct (événement window `global_notification`).
// Lire, c'est ouvrir les Échanges du client (`reading`) : les mentions passent lues côté serveur, comme un clic sur
// la notification, et la cloche du menu en est prévenue (`global_notifications_read`).

import { useEffect, useRef, useState } from 'react';
import apiClient from '../../services/apiClient.js';
import { isClientMention, unreadClientMentions } from './clientMentions.js';

const POLL_MS = 30000;

export default function useUnreadClientMentions({ clientId, numero, enabled, reading }) {
  const [ids, setIds] = useState([]);
  // Lues dans cette fiche : une lecture du serveur partie avant ne doit pas les rallumer.
  const readLocally = useRef(new Set());

  useEffect(() => {
    setIds([]);
    if (!enabled || (!clientId && !numero)) return undefined;
    const who = { clientId, numero };
    let live = true;
    const load = () => apiClient.get('/api/v1/notifications/global?limit=500&unread_only=true')
      .then((data) => { if (live) setIds(unreadClientMentions(data?.notifications, who, readLocally.current)); })
      .catch(() => { /* réseau : le prochain passage réessaie, le compteur reste tel quel */ });
    load();
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, POLL_MS);
    const onPush = (event) => {
      const notification = event.detail;
      if (notification?.id == null || notification.read || readLocally.current.has(notification.id)) return;
      if (!isClientMention(notification, who)) return;
      setIds((previous) => (previous.includes(notification.id) ? previous : [...previous, notification.id]));
    };
    window.addEventListener('global_notification', onPush);
    return () => { live = false; clearInterval(timer); window.removeEventListener('global_notification', onPush); };
  }, [enabled, clientId, numero]);

  useEffect(() => {
    if (!reading || !ids.length) return;
    ids.forEach((id) => readLocally.current.add(id));
    setIds([]);
    apiClient.post('/api/v1/notifications/global/read', { ids }).catch(() => { /* relu au prochain passage */ });
    window.dispatchEvent(new CustomEvent('global_notifications_read', { detail: { ids } }));
  }, [reading, ids]);

  return ids.length;
}
