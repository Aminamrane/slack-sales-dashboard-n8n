// api/_botIaUsageStore.mjs

/**
 * @file _botIaUsageStore.mjs
 * @brief Registre des dépenses de Sub Tickets — rend le solde RÉEL.
 *
 * @note Chaque échange y écrit son coût, et le solde est toujours recalculé
 * depuis la somme des lignes — jamais décrémenté de mémoire, donc jamais
 * dérivant.
 *
 * @note Un fichier de `api/` dont le nom commence par `_` n'est pas routé
 * par Vercel : c'est un module partagé, pas une fonction.
 *
 * DEUX BACKENDS, choisis à l'exécution :
 *   (a) Supabase / PostgREST avec la clé service_role, si
 *       `SUPABASE_SERVICE_ROLE_KEY` est définie. C'est la cible : partagé
 *       entre tout le monde, durable.
 *   (b) sinon, repli fichier JSON local. Le solde survit au F5 et au
 *       redémarrage du serveur de dev, ce qui suffit pour travailler en local.
 *
 * @warning LIMITE DU REPLI, dite franchement : sur Vercel le système de
 * fichiers est éphémère et n'est pas partagé entre instances — le solde s'y
 * remettrait à 20 € tout seul. Le repli est un outil de développement, pas
 * de production.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * @brief Détermine le backend de stockage actif.
 * @returns `"supabase"` si la clé service_role est présente, sinon `"file"`.
 */
export function usageBackend() {
  return SUPABASE_URL && SERVICE_KEY ? "supabase" : "file";
}

/* ── Backend (a) : Supabase / PostgREST + service_role ─────────────────── */

const REST = () => `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
const sbHeaders = (extra = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function sbInsert(row) {
  const res = await fetch(`${REST()}/bot_ia_usage`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`bot_ia_usage insert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return row;
}

/**
 * @brief Total dépensé en dollars, via l'API Supabase (RPC).
 * @param userId Identifiant utilisateur, ou `null`/absent pour le total global.
 * @returns Le total en dollars.
 * @note Les agrégats PostgREST (`?select=cost_eur.sum()`) sont DÉSACTIVÉS
 * sur ce projet Supabase — vérifié le 2026-09-07, réponse 400 / PGRST123
 * « Use of aggregate functions is not allowed ». D'où l'appel RPC à la
 * fonction SQL.
 */
async function sbTotalEur(userId) {
  const res = await fetch(`${REST()}/rpc/bot_ia_usage_totals`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ p_user_id: userId || null }),
  });
  if (!res.ok) throw new Error(`bot_ia_usage_totals ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const row = ((await res.json()) || [])[0] || {};
  return Number(row.total_eur) || 0;
}

/* ── Backend (b) : repli fichier JSON — développement ──────────────────── */

/**
 * @brief Chemin du registre de repli (backend fichier).
 * @note Dans `.data/` (gitignoré) : le fichier contient des adresses e-mail.
 */
const FILE = process.env.BOT_IA_USAGE_FILE
  || path.join(process.cwd(), ".data", "bot-ia-usage.json");

/**
 * @brief Exécute `fn` sous verrou exclusif (repli fichier).
 * @param fn Fonction asynchrone à exécuter une fois le verrou obtenu.
 * @returns Ce que renvoie `fn`.
 * @note Verrou par `mkdir` (atomique) : deux onglets qui envoient en même
 * temps ne doivent pas s'écraser mutuellement et perdre une dépense.
 */
async function withLock(fn) {
  const lock = `${FILE}.lock`;
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  for (let i = 0; i < 100; i++) {
    try {
      await fsp.mkdir(lock);
      try { return await fn(); } finally { await fsp.rm(lock, { recursive: true, force: true }); }
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
    }
  }
  throw new Error("bot_ia_usage : verrou fichier non obtenu");
}

async function fileRead() {
  try {
    const parsed = JSON.parse(await fsp.readFile(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    // Fichier corrompu : on repart d'un registre vide plutôt que de bloquer
    // la page, mais on le dit dans les logs du serveur.
    console.error("[bot-ia] registre illisible, remis à vide :", e?.message);
    return [];
  }
}

async function fileInsert(row) {
  return withLock(async () => {
    const rows = await fileRead();
    rows.push(row);
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
    await fsp.rename(tmp, FILE);   // remplacement atomique
    return row;
  });
}

async function fileTotalEur(userId) {
  const rows = await fileRead();
  return rows
    .filter((r) => !userId || r.user_id === userId)
    .reduce((s, r) => s + (Number(r.cost_eur) || 0), 0);
}

/* ── API publique ─────────────────────────────────────────────────────── */

/**
 * @brief Enregistre un échange facturé.
 * @param row Ligne à insérer (coût, tokens, identité de l'auteur…).
 * @returns La ligne effectivement enregistrée (avec `id`/`created_at` complétés si absents).
 */
export async function recordUsage(row) {
  const full = {
    ...row,
    id: row.id || crypto.randomUUID(),
    created_at: row.created_at || new Date().toISOString(),
    source: row.source || "bot_ia",
  };
  return usageBackend() === "supabase" ? sbInsert(full) : fileInsert(full);
}

/**
 * @brief Total dépensé en euros.
 * @param userId Identifiant utilisateur pour un total individuel, ou `null` pour le pot commun.
 * @returns Le total en euros.
 */
export async function totalSpentEur(userId = null) {
  return usageBackend() === "supabase" ? sbTotalEur(userId) : fileTotalEur(userId);
}

/**
 * @brief État du budget commun de Sub Tickets.
 * @param budgetEur Budget par défaut, utilisé si `BOT_IA_BUDGET_EUR` n'est pas défini côté serveur.
 * @returns `{ budget_eur, spent_eur, balance_eur, backend }`.
 * @note Le budget est COMMUN aux 8 personnes autorisées (décision produit) :
 * on somme sans filtrer sur l'utilisateur.
 */
export async function budgetState(budgetEur) {
  const spent = await totalSpentEur(null);
  const budget = Number(process.env.BOT_IA_BUDGET_EUR || budgetEur) || 0;
  return {
    budget_eur: budget,
    spent_eur: spent,
    balance_eur: Math.max(0, budget - spent),
    backend: usageBackend(),
  };
}
