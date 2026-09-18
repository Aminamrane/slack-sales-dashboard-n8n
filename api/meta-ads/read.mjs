// api/meta-ads/read.mjs
//
// GET /api/meta-ads/read?kind=campaign|adset|ad|leaderboard&since=YYYY-MM-DD&until=YYYY-MM-DD
//
// Lecture seule, rapide : sert le dernier payload connu depuis
// meta_ads_cache (voir meta-ads-cache.sql / api/_metaAdsCacheStore.mjs) au
// lieu d'appeler l'API meta-ads d'api-owner a chaque ouverture de page.
//
// Le SEUL cas ou cette route attend un appel a api-owner est le tout
// premier acces a une cle (kind,since,until) jamais vue : la ligne n'a pas
// encore de payload, il faut bien aller le chercher une fois.
//
// Sinon elle renvoie l'existant IMMEDIATEMENT et signale juste `stale` :
// c'est au front de decider s'il declenche POST /api/meta-ads/sync derriere.

import { KINDS, cacheConfigured, getRow, syncNow } from "../_metaAdsCacheStore.mjs";

export const config = { maxDuration: 30 };

const AUTH_API = process.env.VITE_API_URL || "https://api.ownertechnology.com";
const ALLOWED_ROLES = ["admin"]; // aligne sur la garde reelle de /meta-ads (ProtectedRoute, main.jsx)
const TTL_MS = (Number(process.env.META_ADS_SYNC_TTL_MIN) || 30) * 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

/** Meme technique que api/bot-ia/*.mjs : on delegue la verification du jeton a l'API qui l'a emis. */
async function identify(authHeader) {
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) return { error: "missing_token" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${AUTH_API}/api/v1/auth/me`, { headers: { Authorization: authHeader }, signal: ctrl.signal });
    if (res.status === 401 || res.status === 403) return { error: "invalid_token" };
    if (!res.ok) return { error: "auth_unavailable" };
    const raw = await res.json();
    const u = raw?.data ?? raw?.user ?? raw ?? {};
    const role = u.role ?? u.user_role ?? null;
    if (!role) return { error: "auth_unavailable" };
    return { role };
  } catch {
    return { error: "auth_unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export default async function handler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Méthode non autorisée." });
  }
  if (!cacheConfigured()) {
    return sendJson(res, 500, { error: "META_ADS_DB_URL absente côté serveur." });
  }

  const ident = await identify(req.headers?.authorization);
  if (ident.error === "missing_token" || ident.error === "invalid_token") {
    return sendJson(res, 401, { error: "Session expirée. Reconnecte-toi." });
  }
  if (ident.error) {
    return sendJson(res, 503, { error: "Impossible de vérifier ta session (API d'authentification injoignable)." });
  }
  if (!ALLOWED_ROLES.includes(ident.role)) {
    return sendJson(res, 403, { error: "Accès non autorisé." });
  }

  const qs = ((req.originalUrl || req.url || "").split("?")[1]) || "";
  const params = new URLSearchParams(qs);
  const kind = params.get("kind");
  const since = params.get("since");
  const until = params.get("until");
  if (!KINDS.includes(kind) || !DATE_RE.test(since || "") || !DATE_RE.test(until || "")) {
    return sendJson(res, 400, { error: "Paramètres invalides (kind/since/until)." });
  }

  try {
    let row = await getRow(kind, since, until);

    // Premier acces jamais vu pour cette cle : c'est le seul cas ou on attend Meta.
    if (!row || row.payload == null) {
      const result = await syncNow(kind, since, until, req.headers.authorization);
      if (result.status === "already_running") {
        // Un autre appelant a gagne la course de tres peu : on attend qu'il finisse
        // plutot que de renvoyer une page vide (borne dans le temps).
        for (let i = 0; i < 20 && (!row || row.payload == null); i++) {
          await sleep(500);
          row = await getRow(kind, since, until);
        }
      } else {
        row = result.row;
      }
      if (!row || row.payload == null) {
        const isConfig = row?.last_error_status === 503;
        return sendJson(res, isConfig ? 503 : 502, {
          error: row?.last_error || "Chargement initial Meta Ads impossible.",
          config: isConfig,
        });
      }
    }

    return sendJson(res, 200, {
      payload: row.payload,
      synced_at: row.synced_at,
      updated_at: row.updated_at,
      stale: !row.synced_at || (Date.now() - new Date(row.synced_at).getTime()) > TTL_MS,
      sync_error: row.sync_status === "error" ? row.last_error : null,
    });
  } catch (e) {
    return sendJson(res, 500, { error: `Lecture du cache impossible : ${e?.message || e}` });
  }
}
