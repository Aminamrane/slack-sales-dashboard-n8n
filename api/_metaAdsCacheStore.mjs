// api/_metaAdsCacheStore.mjs
//
// Cache de persistance pour /meta-ads (voir meta-ads-cache.sql). Ce module
// n'appelle JAMAIS Meta : il relit/ecrit la table `meta_ads_cache` en
// connexion Postgres DIRECTE (meme pooler Supabase que le backend api-owner
// lui-meme, meme motif que BOT_IA_DB_URL / api/bot-ia/statut.mjs) — JAMAIS
// via l'API REST Supabase ni une cle service_role. Et sait appeler l'unique
// source de donnees reellement accessible depuis ce repo pour Meta+CRM deja
// joints — l'API deja agregee d'api-owner (`/api/v1/marketing/meta-ads*`).
//
// Un fichier de api/ dont le nom commence par « _ » n'est pas route par
// Vercel : c'est un module partage, pas une fonction (meme convention que
// api/_botIaUsageStore.mjs).
//
// Verrou single-flight : implemente en Postgres (UPDATE ... WHERE ...
// RETURNING, atomique), pas en memoire — ca doit marcher entre plusieurs
// instances Vercel qui ne partagent rien. Un verrou pris depuis plus de
// LOCK_STALE_MIN se libere tout seul (filet en cas d'instance morte en
// plein sync), independamment du TTL de fraicheur des donnees.

import pg from "pg";
import crypto from "node:crypto";

const DB_URL = process.env.META_ADS_DB_URL || "";
const AUTH_API = process.env.VITE_API_URL || "https://api.ownertechnology.com";

const LOCK_STALE_MIN = 2;

export const KINDS = ["campaign", "adset", "ad", "leaderboard"];

/** true si la connexion Postgres directe est configuree — sinon le cache est inutilisable. */
export function cacheConfigured() {
  return Boolean(DB_URL);
}

async function withClient(fn) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function hashPayload(json) {
  return crypto.createHash("sha256").update(json).digest("hex");
}

/** Ligne de cache actuelle pour cette cle, ou null si elle n'existe pas encore. */
export async function getRow(kind, since, until) {
  return withClient(async (client) => {
    await client.query("BEGIN READ ONLY");
    const r = await client.query(
      `select * from public.meta_ads_cache where kind = $1 and since_date = $2 and until_date = $3 limit 1`,
      [kind, since, until],
    );
    await client.query("COMMIT");
    return r.rows[0] || null;
  });
}

/**
 * Tente d'obtenir le verrou pour (kind,since,until). Renvoie la ligne
 * (verrou pris) ou null (deja pris par un autre appelant, encore frais).
 */
async function acquireLock(kind, since, until) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    // Cree la ligne si elle n'existe pas encore (no-op sinon).
    await client.query(
      `insert into public.meta_ads_cache (kind, since_date, until_date) values ($1, $2, $3)
       on conflict (kind, since_date, until_date) do nothing`,
      [kind, since, until],
    );
    const r = await client.query(
      `update public.meta_ads_cache
          set sync_status = 'running', started_at = now()
        where kind = $1 and since_date = $2 and until_date = $3
          and (sync_status <> 'running' or started_at < now() - make_interval(mins => $4))
        returning *`,
      [kind, since, until, LOCK_STALE_MIN],
    );
    await client.query("COMMIT");
    return r.rows[0] || null;
  });
}

async function releaseOk(kind, since, until, { payload, changed }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    const r = changed
      ? await client.query(
        `update public.meta_ads_cache
            set payload = $1::jsonb, data_hash = $2, updated_at = now(), synced_at = now(),
                sync_status = 'idle', started_at = null, last_error = null, last_error_status = null, last_error_at = null
          where kind = $3 and since_date = $4 and until_date = $5
          returning *`,
        [payload.json, payload.hash, kind, since, until],
      )
      : await client.query(
        `update public.meta_ads_cache
            set synced_at = now(), sync_status = 'idle', started_at = null,
                last_error = null, last_error_status = null, last_error_at = null
          where kind = $1 and since_date = $2 and until_date = $3
          returning *`,
        [kind, since, until],
      );
    await client.query("COMMIT");
    return r.rows[0] || null;
  });
}

async function releaseError(kind, since, until, message, status) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    const r = await client.query(
      `update public.meta_ads_cache
          set sync_status = 'error', started_at = null,
              last_error = $1, last_error_status = $2, last_error_at = now()
        where kind = $3 and since_date = $4 and until_date = $5
        returning *`,
      [String(message || "erreur inconnue").slice(0, 500), Number.isInteger(status) ? status : null, kind, since, until],
    );
    await client.query("COMMIT");
    return r.rows[0] || null;
  });
}

/** Construit l'URL api-owner correspondant a `kind` (les 2 endpoints existants de la page). */
function apiOwnerUrl(kind, since, until) {
  const q = `since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`;
  return kind === "leaderboard"
    ? `${AUTH_API}/api/v1/marketing/meta-ads/leaderboard?${q}`
    : `${AUTH_API}/api/v1/marketing/meta-ads?level=${encodeURIComponent(kind)}&${q}`;
}

/** Appelle l'endpoint meta-ads d'api-owner avec le jeton de l'appelant. */
async function fetchFromApiOwner(kind, since, until, authHeader) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(apiOwnerUrl(kind, since, until), {
      headers: { Authorization: authHeader },
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`api-owner ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    try { return JSON.parse(text); } catch { throw new Error("api-owner : reponse illisible (JSON invalide)"); }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sequence complete : verrou -> appel api-owner -> hash/comparaison -> ecriture.
 * `alreadyLocked` : true si l'appelant tient DEJA le verrou (evite un
 * double essai depuis le chemin "premier chargement" de read.mjs).
 *
 * Renvoie { status: 'ok'|'already_running'|'error', row, error }.
 */
export async function syncNow(kind, since, until, authHeader, { alreadyLocked = false } = {}) {
  const lockedRow = alreadyLocked ? true : await acquireLock(kind, since, until);
  if (!lockedRow) return { status: "already_running", row: await getRow(kind, since, until) };

  let fresh;
  try {
    fresh = await fetchFromApiOwner(kind, since, until, authHeader);
  } catch (e) {
    const row = await releaseError(kind, since, until, e?.message || e, e?.status);
    return { status: "error", row, error: e?.message || String(e), upstreamStatus: e?.status || null };
  }

  const previous = await getRow(kind, since, until);
  const json = JSON.stringify(fresh);
  const newHash = hashPayload(json);
  const changed = !previous?.data_hash || previous.data_hash !== newHash;
  const row = await releaseOk(kind, since, until, { payload: { json, hash: newHash }, changed });
  return { status: "ok", row, changed };
}
