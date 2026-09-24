// api/bot-ia/statut.mjs

/**
 * @file statut.mjs
 * @brief Suivi du statut d'un ticket de la file d'attente Sub Tickets (/ceo/Sub-Tickets).
 *
 * La page l'interroge pour savoir où en est son ticket : tant que ce n'est
 * pas « traite », elle affiche « traitement en cours… ».
 *
 *   GET /api/bot-ia/statut            -> dernier ticket de l'appelant
 *   GET /api/bot-ia/statut?id=<uuid>  -> statut de ce ticket précis
 *
 * @warning LECTURE SEULE, stricte : chaque requête tourne dans une
 * transaction Postgres READ ONLY (le serveur refuse alors toute écriture)
 * et ne rend que les tickets de l'appelant (filtre sur son e-mail, lu depuis
 * son jeton). La connexion vit dans `BOT_IA_DB_URL` (.env, jamais exposée au
 * navigateur).
 */

import pg from "pg";

export const config = { maxDuration: 15 };

const AUTH_API = process.env.VITE_API_URL || "https://api.ownertechnology.com";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

/**
 * @brief Identité de l'appelant, vérifiée auprès de l'API qui a émis le jeton.
 * @param authHeader En-tête `Authorization` brut de la requête.
 * @returns `{ email }`, ou `{ error }` si le jeton est absent, invalide, ou impossible à vérifier.
 */
async function identify(authHeader) {
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) return { error: "missing_token" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${AUTH_API}/api/v1/auth/me`, {
      headers: { Authorization: authHeader },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) return { error: "invalid_token" };
    if (!res.ok) return { error: "auth_unavailable" };
    const raw = await res.json();
    const u = raw?.data ?? raw?.user ?? raw ?? {};
    const email = String(u.email ?? u.user_email ?? "").trim().toLowerCase();
    if (!email) return { error: "auth_unavailable" };
    return { email };
  } catch {
    return { error: "auth_unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @brief Exécute une requête paramétrée dans une transaction READ ONLY.
 * @param sql Requête SQL paramétrée (`$1`, `$2`…).
 * @param params Valeurs liées aux paramètres de `sql`.
 * @returns Les lignes renvoyées par la requête.
 */
async function readOnly(sql, params) {
  const client = new pg.Client({ connectionString: process.env.BOT_IA_DB_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const r = await client.query(sql, params);
    await client.query("COMMIT");
    return r.rows;
  } finally {
    await client.end();
  }
}

export default async function handler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Méthode non autorisée." });
  }

  const ident = await identify(req.headers?.authorization);
  if (ident.error === "missing_token" || ident.error === "invalid_token") {
    return sendJson(res, 401, { error: "Session expirée. Reconnecte-toi." });
  }
  if (ident.error) {
    return sendJson(res, 503, { error: "Impossible de vérifier ta session." });
  }
  if (!process.env.BOT_IA_DB_URL) {
    return sendJson(res, 500, { error: "BOT_IA_DB_URL absente côté serveur." });
  }

  // L'id éventuel est lu dans l'URL complète (req.originalUrl en dev, req.url en prod).
  const qs = ((req.originalUrl || req.url || "").split("?")[1]) || "";
  const id = new URLSearchParams(qs).get("id");

  try {
    if (id) {
      // Statut d'un prompt précis — uniquement s'il appartient à l'appelant.
      const rows = await readOnly(
        `select id, statut, statut_maj_at
         from public.bot_ia_prompts
         where id = $1::uuid and lower(user_email) = $2
         limit 1`,
        [id, ident.email],
      );
      if (!rows.length) return sendJson(res, 404, { error: "Demande introuvable." });
      return sendJson(res, 200, rows[0]);
    }
    // Sinon : le dernier prompt de l'appelant (celui qu'il vient d'envoyer).
    const rows = await readOnly(
      `select id, content, statut, statut_maj_at, created_at
       from public.bot_ia_prompts
       where lower(user_email) = $1
       order by created_at desc
       limit 1`,
      [ident.email],
    );
    return sendJson(res, 200, rows[0] || null);
  } catch (e) {
    return sendJson(res, 500, { error: `Lecture du statut impossible : ${e?.message || e}` });
  }
}
