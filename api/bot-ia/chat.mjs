// api/bot-ia/chat.mjs

/**
 * @file chat.mjs
 * @brief Fonction serveur de Sub Tickets (/ceo/Sub-Tickets).
 *
 * @warning C'est le SEUL endroit où la clé Anthropic existe : elle ne
 * traverse jamais le réseau vers le navigateur.
 *
 * @note Servie en local par le plugin `botIaApiDev` de vite.config.js, et en
 * production par Vercel (api/bot-ia/chat.mjs -> /api/bot-ia/chat).
 *
 *   GET  /api/bot-ia/chat  -> état du budget, pour l'affichage au chargement
 *   POST /api/bot-ia/chat  -> conversation, réponse en flux SSE
 *
 * Déroulé, dans l'ordre :
 *   1. vérifie le jeton de l'appelant auprès de l'API métier (/api/v1/auth/me)
 *   2. vérifie que son adresse est dans la liste nominative
 *   3. refuse si le budget commun est épuisé
 *   4. appelle Opus 5 en effort medium, en streaming
 *   5. relaie UNIQUEMENT le texte visible, jamais la réflexion
 *   6. facture depuis le usage final et enregistre la dépense
 *
 * @warning Réponses écrites en `res.statusCode` / `res.setHeader` /
 * `res.end` uniquement. Les helpers `res.status().json()` viennent de
 * `@vercel/node` et n'existent PAS dans les middlewares du serveur de dev :
 * les utiliser marcherait en production et planterait en local.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  BOT_IA_MODEL, BOT_IA_EFFORT, BOT_IA_MAX_TOKENS, BOT_IA_BUDGET_EUR, isBotIaAllowed,
} from "../../src/config/botIaAccess.js";
import { pageFromPrompt, mentionListLabel } from "../../src/config/botIaMentions.js";
import { costUsdFromUsage, fetchUsdToEur, FALLBACK_USD_TO_EUR } from "../../src/utils/botIaBilling.js";
import { recordUsage, budgetState } from "../_botIaUsageStore.mjs";

// Vercel : laisse le temps à une réponse longue d'aller au bout.
export const config = { maxDuration: 300 };

const AUTH_API = process.env.VITE_API_URL || "https://api.ownertechnology.com";

// Garde-fous : cette route dépense de l'argent réel.
const MAX_MESSAGES = 40;      // tours d'historique acceptés
const MAX_CHARS = 60000;      // taille totale de la conversation envoyée
const MAX_PROMPT_CHARS = 10000; // aligné sur la limite de la table des prompts

const SYSTEM_PROMPT = `Tu es le Sub Tickets du pôle Acquisition d'Owner Technology, un assistant interne.
Réponds en français, de façon directe et concrète, sans préambule ni flatterie.
Quand tu ne sais pas, dis-le franchement plutôt que d'inventer.`;

/* ── Utilitaires de réponse (portables dev + production) ───────────────── */

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) { reject(new Error("corps de requête trop volumineux")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

/* ── Identité ──────────────────────────────────────────────────────────── */

/**
 * @brief Vérifie le jeton de l'appelant auprès de l'API qui l'a émis.
 * @param authHeader En-tête `Authorization` brut de la requête.
 * @returns `{ user: { id, email, role } }`, ou `{ error }` si le jeton est absent, invalide, ou impossible à vérifier.
 * @note On ne connaît pas le secret de signature du JWT métier : on ne peut
 * donc pas le vérifier nous-mêmes. On délègue à l'API qui l'a émis — si elle
 * répond 200 sur /auth/me, le jeton est valide et elle nous donne
 * l'identité. Coût mesuré : ~100 ms à froid, négligeable devant un appel
 * Opus 5.
 * @note Les champs ne sont pas typés dans l'OpenAPI : on les lit
 * défensivement, exactement comme le fait déjà `apiClient.getMe()` côté front.
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
    return { user: { id: u.id ?? u.user_id ?? null, email, role: u.role ?? u.user_role ?? null } };
  } catch {
    return { error: "auth_unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Validation de la conversation ─────────────────────────────────────── */

function validateMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: "La conversation est vide." };
  if (input.length > MAX_MESSAGES) return { error: `Conversation trop longue (${input.length} tours, maximum ${MAX_MESSAGES}). Recharge la page pour repartir à zéro.` };

  const messages = [];
  let total = 0;
  for (const m of input) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = String(m?.content ?? "");
    if (!content.trim()) continue;          // un tour raté ne pollue pas l'historique
    total += content.length;
    messages.push({ role, content });
  }
  if (!messages.length) return { error: "La conversation est vide." };
  if (total > MAX_CHARS) return { error: `Conversation trop volumineuse (${total} caractères, maximum ${MAX_CHARS}).` };
  // L'API exige que le premier message soit un tour utilisateur.
  if (messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { error: "Le dernier message doit être une question." };
  }
  if (messages[messages.length - 1].content.length > MAX_PROMPT_CHARS) {
    return { error: `Question trop longue (${messages[messages.length - 1].content.length} caractères, maximum ${MAX_PROMPT_CHARS}).` };
  }

  // Page obligatoire : le front refuse déjà d'envoyer un ticket sans
  // mention, mais le front est du code public — cette garde-ci fait foi et
  // protège seule la dépense. Sont acceptées la mention (`@Book …`) comme sa
  // forme développée (`https://…/book …`).
  const last = messages[messages.length - 1].content;
  if (!pageFromPrompt(last)) {
    return {
      error: `Demande refusée : aucune page désignée. Commence par la page concernée — ${mentionListLabel()}.`,
    };
  }

  return { messages };
}

/* ── Taux de change, mis en cache une heure ────────────────────────────── */

let fxCache = { rate: FALLBACK_USD_TO_EUR, live: false, at: 0 };
async function usdToEur() {
  const now = Date.now();
  if (now - fxCache.at < 3600_000 && fxCache.live) return fxCache;
  const fx = await fetchUsdToEur();
  if (fx.live) fxCache = { ...fx, at: now };
  return fx.live ? fxCache : { ...fxCache, live: false };
}

/* ── Handler ───────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Méthode non autorisée." });
  }

  // 1. Identité
  const ident = await identify(req.headers?.authorization);
  if (ident.error === "missing_token" || ident.error === "invalid_token") {
    return sendJson(res, 401, { error: "Session expirée. Reconnecte-toi." });
  }
  if (ident.error) {
    return sendJson(res, 503, { error: "Impossible de vérifier ta session (API d'authentification injoignable)." });
  }
  const user = ident.user;

  // 2. Liste nominative — la garde qui fait foi, celle du front n'est qu'un confort.
  if (!isBotIaAllowed(user.email)) {
    return sendJson(res, 403, { error: "Ce compte n'a pas accès au Sub Tickets." });
  }

  // 3. Budget commun
  let budget;
  try {
    budget = await budgetState(BOT_IA_BUDGET_EUR);
  } catch (e) {
    return sendJson(res, 500, { error: `Registre des dépenses illisible : ${e?.message || e}` });
  }

  if (method === "GET") {
    const fx = await usdToEur();
    return sendJson(res, 200, {
      ...budget,
      model: BOT_IA_MODEL,
      effort: BOT_IA_EFFORT,
      usd_to_eur: fx.rate,
      rate_is_live: fx.live,
      user: { email: user.email, role: user.role },
    });
  }

  if (budget.balance_eur <= 0) {
    return sendJson(res, 402, {
      error: `Budget épuisé (${budget.budget_eur} € consommés). Le Sub Tickets est en pause tant que l'enveloppe n'est pas rechargée.`,
      ...budget,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "ANTHROPIC_API_KEY absente côté serveur. Ajoute-la au .env (sans préfixe VITE_) et relance npm run dev." });
  }

  // 4. Corps de la requête
  let body;
  try { body = await readJson(req); }
  catch (e) { return sendJson(res, 400, { error: `Requête illisible : ${e?.message || e}` }); }

  const check = validateMessages(body?.messages);
  if (check.error) return sendJson(res, 400, { error: check.error });

  // 5. Flux SSE. Passé ce point le statut 200 est parti : toute erreur doit
  //    sortir en `event: error`, on ne peut plus changer le code HTTP.
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // empêche un proxy de bufferiser le flux
  res.flushHeaders?.();

  const send = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const client = new Anthropic({ apiKey });
  const abort = new AbortController();
  // L'utilisateur ferme l'onglet ou change de page : on coupe l'appel en cours
  // plutôt que de continuer à payer pour une réponse que personne ne lira.
  req.on("close", () => { if (!res.writableEnded) abort.abort(); });

  let usage = null;
  let stopReason = null;

  try {
    const stream = client.messages.stream(
      {
        model: BOT_IA_MODEL,
        max_tokens: BOT_IA_MAX_TOKENS,
        output_config: { effort: BOT_IA_EFFORT },
        system: SYSTEM_PROMPT,
        messages: check.messages,
      },
      { signal: abort.signal },
    );

    for await (const event of stream) {
      if (event.type === "message_start") {
        send("start", { message_id: event.message?.id || null, model: event.message?.model || BOT_IA_MODEL });
        continue;
      }
      // On WHITELISTE le texte. Il existe trois types de delta : text_delta,
      // thinking_delta et signature_delta — ce dernier transporte ~300
      // caractères de base64. Un filtre « tout sauf thinking » les injecterait
      // dans la bulle de chat.
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        send("delta", { text: event.delta.text });
        continue;
      }
      // Le usage FINAL n'est fiable que là. Celui de message_start est partiel
      // (output_tokens y valait 2 pour 20 réels lors des mesures).
      if (event.type === "message_delta") {
        usage = event.usage || usage;
        stopReason = event.delta?.stop_reason || stopReason;
      }
    }

    // Filet de sécurité : si l'itération n'a pas vu de message_delta, le
    // message final accumulé par le SDK porte le même usage.
    if (!usage) {
      const final = await stream.finalMessage();
      usage = final?.usage || null;
      stopReason = stopReason || final?.stop_reason || null;
    }
  } catch (e) {
    if (abort.signal.aborted) { if (!res.writableEnded) res.end(); return; }
    const status = e?.status ? ` (HTTP ${e.status})` : "";
    send("error", { code: "upstream", message: `Le modèle n'a pas répondu${status} : ${e?.message || e}` });
    return res.end();
  }

  // 6. Facturation depuis le usage réel, puis enregistrement de la dépense.
  try {
    const fx = await usdToEur();
    const costUsd = costUsdFromUsage(usage || {});
    const costEur = costUsd * fx.rate;

    await recordUsage({
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      model: BOT_IA_MODEL,
      effort: BOT_IA_EFFORT,
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      thinking_tokens: usage?.output_tokens_details?.thinking_tokens ?? 0,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
      cost_usd: costUsd,
      cost_eur: costEur,
      usd_to_eur: fx.rate,
      stop_reason: stopReason,
    });

    const after = await budgetState(BOT_IA_BUDGET_EUR);
    send("done", {
      usage: {
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        thinking_tokens: usage?.output_tokens_details?.thinking_tokens ?? 0,
        cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
      },
      stop_reason: stopReason,
      truncated: stopReason === "max_tokens",
      cost_usd: costUsd,
      cost_eur: costEur,
      usd_to_eur: fx.rate,
      rate_is_live: fx.live,
      ...after,
    });
  } catch (e) {
    // La réponse est déjà arrivée chez l'utilisateur : on ne la lui retire
    // pas, mais on ne cache pas que la dépense n'a pas été comptée.
    send("error", { code: "billing", message: `Réponse reçue mais dépense non enregistrée : ${e?.message || e}` });
  }

  res.end();
}
