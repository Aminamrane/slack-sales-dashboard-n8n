// src/components/equipe/useEquipeData.js
//
// Lecture des données de la page Équipe, sans rien de superflu (lecture seule, routes existantes) :
//   · sales       : /users/assignable + /teams                    (liste des commerciaux et de leurs équipes)
//   · perf        : /leaderboard/stats (mois en cours)            (ventes du mois par commercial ; facultatif)
//   · setters     : /users/setters-overview                       (liste des setters et des sales qu'ils suivent)
//   · setterPerf  : /leaderboard/setters (mois en cours)          (RDV posés / qualifiés / ventes par setter ; facultatif)
// Chaque vue ne charge QUE ses données ; une seule lecture à la fois par clé ; les données lues sont gardées 30 s en mémoire (revenir
// sur la page s'affiche aussitôt, sans écran de chargement) puis relues en arrière-plan ; un échec ne masque jamais des données déjà
// affichées. Les lectures « facultatives » n'empêchent jamais d'afficher la liste : leurs chiffres restent « — ».

import { useEffect, useState, useSyncExternalStore } from 'react';
import apiClient from '../../services/apiClient';
import { sellerIndex, setterPerfIndex } from './equipeData';

const FRESH_MS = 30000;
const cache = new Map();     // clé → { who, data, at } (who = compte connecté : rien ne passe d'un compte à l'autre)
const pending = new Map();   // clé → lecture en cours
const listeners = new Set();
const subscribe = (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

const me = () => {
  const u = apiClient.getUser();
  return String(u?.id ?? u?.email ?? '');
};
const list = (resp, key) => (Array.isArray(resp) ? resp : (resp?.[key] || resp?.data || []));

const loaders = {
  async sales() {
    const [usersResp, teamsResp] = await Promise.all([
      apiClient.getAssignableUsers(),
      apiClient.getTeams().catch(() => null),   // sans les équipes, chacun apparaît « Sans équipe » (comme avant)
    ]);
    return { users: list(usersResp, 'users'), teams: list(teamsResp, 'teams') };
  },
  async perf() { return { index: sellerIndex(await apiClient.getLeaderboardStats('current_month')) }; },
  async setters() { return list(await apiClient.getSettersOverview(), 'setters'); },
  async setterPerf() { return { index: setterPerfIndex(await apiClient.get('/api/v1/leaderboard/setters?period=current_month')) }; },
};

// Clés lues par chaque vue (le survol de la bascule lit déjà celles de l'autre vue).
export const VIEW_KEYS = { sales: ['sales', 'perf'], setters: ['setters', 'setterPerf', 'sales'] };

function load(key) {
  if (pending.has(key)) return pending.get(key);
  const who = me();
  const run = loaders[key]()
    .then((data) => {
      cache.set(key, { who, data, at: Date.now() });
      listeners.forEach((cb) => cb());
      return data;
    })
    .finally(() => { pending.delete(key); });
  pending.set(key, run);
  return run;
}

const isFresh = (key) => {
  const c = cache.get(key);
  return !!c && c.who === me() && Date.now() - c.at < FRESH_MS;
};

// Démarre la lecture d'une vue avant qu'on l'ouvre ; sans effet pour les données récentes.
export function prefetchEquipe(view) {
  VIEW_KEYS[view].forEach((key) => { if (!isFresh(key)) load(key).catch(() => {}); });
}

// { data: null tant que rien n'est lu, loading, error, reload }. `active` = cette lecture est utile à la vue affichée.
export default function useEquipeData(key, active) {
  const [who] = useState(me);
  const entry = useSyncExternalStore(subscribe, () => cache.get(key), () => undefined);
  const mine = entry && entry.who === who ? entry : null;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const at = mine ? mine.at : 0;

  useEffect(() => {
    if (!active) return undefined;
    if (attempt === 0 && at && Date.now() - at < FRESH_MS) return undefined;   // données récentes : rien à relire
    let alive = true;
    setFailed(false);
    load(key).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // `at` est volontairement absent : la fin d'une lecture ne doit pas en relancer une autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, attempt]);

  const data = mine ? mine.data : null;
  return {
    data,
    loading: active && !data && !failed,
    error: failed && !data,
    reload: () => setAttempt((n) => n + 1),
  };
}
