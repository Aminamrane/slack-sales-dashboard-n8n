// api/meta-ads/sync.mjs
//
// POST /api/meta-ads/sync  { kind, since, until }
//
// Declenche (ou rejoint) la synchronisation d'une cle (kind,since,until)
// avec l'API meta-ads d'api-owner. Protege par un verrou single-flight en
// base (voir api/_metaAdsCacheStore.mjs) : si N utilisateurs appellent en
// meme temps pour la meme cle, un seul appelle reellement api-owner, les
// autres recoivent aussitot { status: 'already_running' }.
//
// N'efface jamais une donnee valide : en cas d'echec cote api-owner, la
// ligne garde son dernier payload connu, seul `last_error` est pose.

import { KINDS, cacheConfigured, syncNow } from "../_metaAdsCacheStore.mjs";

export const config = { maxDuration: 30 };

const AUTH_API = process.env.VITE_API_URL || "https://api.ownertechnology.com";
const ALLOWED_ROLES = ["admin"]; // aligne sur la garde reelle de /meta-ads (ProtectedRoute, main.jsx)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 10_000) { reject(new Error("corps de requête trop volumineux")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
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

  let body;
  try { body = await readJson(req); }
  catch (e) { return sendJson(res, 400, { error: `Requête illisible : ${e?.message || e}` }); }

  const { kind, since, until } = body || {};
  if (!KINDS.includes(kind) || !DATE_RE.test(since || "") || !DATE_RE.test(until || "")) {
    return sendJson(res, 400, { error: "Paramètres invalides (kind/since/until)." });
  }

  try {
    const result = await syncNow(kind, since, until, req.headers.authorization);
    if (result.status === "already_running") {
      return sendJson(res, 200, { status: "already_running" });
    }
    if (result.status === "error") {
      return sendJson(res, 200, { status: "error", error: result.error });
    }
    return sendJson(res, 200, {
      status: "ok",
      changed: result.changed,
      payload: result.row.payload,
      synced_at: result.row.synced_at,
      updated_at: result.row.updated_at,
    });
  } catch (e) {
    return sendJson(res, 500, { error: `Synchronisation impossible : ${e?.message || e}` });
  }
}
