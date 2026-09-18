// src/hooks/useMetaAdsCache.js
//
// Lit /api/meta-ads/read (cache Supabase, voir api/meta-ads/read.mjs) au
// lieu d'appeler l'API meta-ads d'api-owner directement depuis le
// navigateur. Si la réponse indique que le cache est périmé (`stale`),
// déclenche POST /api/meta-ads/sync en tâche de fond et remplace les
// données affichées dès qu'un résultat plus frais revient — sans jamais
// recharger la page ni perdre l'état de l'écran (filtres, onglet, scroll).
//
// `kind` : 'campaign' | 'adset' | 'ad' | 'leaderboard'.
// Renvoie exactement la même forme que l'ancien fetch direct
// ({ data, loading, error, refresh }) pour rester un remplacement quasi
// direct dans MetaAds/index.jsx et Leaderboard.jsx.

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../services/apiClient.js';

async function authedFetch(url, options = {}) {
  const token = apiClient.getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error || `Erreur (HTTP ${res.status})`);
    err.status = res.status;
    err.data = body;
    throw err;
  }
  return body;
}

export default function useMetaAdsCache(kind, since, until) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Jeton de requête : une réponse en retard (onglet/période changés
  // entre-temps) ne doit jamais écraser un état plus récent.
  const reqIdRef = useRef(0);

  const sync = useCallback(async () => {
    const myId = reqIdRef.current;
    try {
      const result = await authedFetch('/api/meta-ads/sync', {
        method: 'POST',
        body: JSON.stringify({ kind, since, until }),
      });
      if (reqIdRef.current !== myId) return; // période/onglet changés entre-temps
      if (result.status === 'ok' && result.changed) setData(result.payload);
    } catch {
      // Échec silencieux : les données déjà affichées (cache) restent valables (§9).
    }
  }, [kind, since, until]);

  const load = useCallback(async () => {
    const myId = ++reqIdRef.current;
    // `kind` peut être null volontairement (ex : onglet Leaderboard géré par
    // un autre composant) : dans ce cas on ne fetch rien.
    if (!kind) { setData(null); setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const q = `?kind=${encodeURIComponent(kind)}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`;
      const result = await authedFetch(`/api/meta-ads/read${q}`);
      if (reqIdRef.current !== myId) return;
      setData(result.payload);
      setLoading(false);
      if (result.stale) sync();
    } catch (e) {
      if (reqIdRef.current !== myId) return;
      setData(null);
      setLoading(false);
      if (e?.data?.config) setError({ kind: 'config', msg: e.message || 'Configuration Meta en attente (tokens .env).' });
      else setError({ kind: 'err', msg: e?.message || 'Erreur de chargement' });
    }
  }, [kind, since, until, sync]);

  useEffect(() => { load(); }, [load]);

  // Rafraîchissement manuel (bouton "Rafraîchir" existant) : force une
  // synchro (protégée par le même verrou single-flight) puis relit.
  const refresh = useCallback(async () => {
    await sync();
    await load();
  }, [sync, load]);

  return { data, loading, error, refresh };
}
