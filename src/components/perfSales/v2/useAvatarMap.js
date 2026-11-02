import { useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';
import { getCanonicalKey } from '../../../utils/salesNames';

// Avatars et rôles des personnes (GET /users/assignable), par nom canonique : { [clé]: { av: url | null, role } }.
// Extrait tel quel de MonitoringPerf.jsx (2026-10-30) pour que Perf Setter affiche les mêmes visages que la Performance Sales.
// `enabled` : pas de lecture tant que l'accès n'est pas confirmé.
export default function useAvatarMap(enabled = true) {
  const [avatarMap, setAvatarMap] = useState({});
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiClient.get('/api/v1/users/assignable').then((d) => {
      if (cancelled) return;
      const m = {};
      (d?.users || []).forEach((u) => {
        const url = u.avatar_url ? (/^https?:\/\//i.test(u.avatar_url) ? u.avatar_url : apiClient.baseUrl + u.avatar_url) : null;
        m[getCanonicalKey(u.full_name)] = { av: url, role: u.role };
      });
      setAvatarMap(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return avatarMap;
}
