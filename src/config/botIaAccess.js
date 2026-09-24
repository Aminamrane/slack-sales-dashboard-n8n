// src/config/botIaAccess.js

/**
 * @file botIaAccess.js
 * @brief Source de vérité unique pour l'accès à Sub Tickets (/ceo/Sub-Tickets).
 *
 * @note Fichier volontairement PUR : aucun import, aucune API navigateur. C'est
 * ce qui permet de le lire à la fois côté front (sidebarPermissions.js, qui
 * masque l'onglet) et côté fonction serveur (api/bot-ia/chat.mjs, qui refuse
 * l'appel), sans que les deux listes puissent diverger.
 *
 * @warning Le gate du front n'est qu'un confort d'affichage : le front est
 * du code public, personne n'est empêché d'appeler l'API à la main. La
 * garde qui fait foi est celle du serveur — c'est elle qui protège la
 * dépense.
 *
 * @warning AUCUNE ADRESSE EMAIL DANS CE FICHIER. Le dépôt est public : la liste
 * des personnes autorisées vient de l'environnement (voir readRawList), jamais
 * du code. Liste absente ou vide = PERSONNE n'est autorisé.
 */

/**
 * @brief Transforme « a@x.com, B@x.com » en tableau normalisé.
 * @param raw Liste brute, séparée par des virgules, points-virgules ou espaces.
 * @returns Les adresses en minuscules, sans doublon de casse ni entrée vide.
 */
function parseEmailList(raw) {
  return [...new Set(
    String(raw || "")
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )];
}

/**
 * @brief Lit la liste brute selon l'endroit où le module s'exécute.
 * @returns La chaîne brute de variable d'environnement, ou "".
 * @note Serveur (Node, fonction Vercel) : `BOT_IA_ALLOWED_EMAILS`.
 * Front (Vite) : `VITE_BOT_IA_ALLOWED_EMAILS`, injectée AU BUILD — elle finit
 * donc dans le bundle public, comme le faisait la liste statique : ce gate
 * n'est qu'un confort d'affichage. Les deux gardes doivent recevoir la MÊME
 * valeur, sinon l'onglet et l'appel autorisé divergent.
 * @note `import.meta.env` n'existe pas sous Node : l'accès optionnel évite
 * l'erreur, et `process` n'existe pas dans le navigateur : d'où le `typeof`.
 */
function readRawList() {
  if (typeof process !== "undefined" && process.env && process.env.BOT_IA_ALLOWED_EMAILS) {
    return process.env.BOT_IA_ALLOWED_EMAILS;
  }
  return import.meta.env?.VITE_BOT_IA_ALLOWED_EMAILS || "";
}

/** @brief Adresses autorisées à ouvrir Sub Tickets et à dépenser du budget (vide = personne). */
export const BOT_IA_ALLOWED_EMAILS = Object.freeze(parseEmailList(readRawList()));

const ALLOWED = new Set(BOT_IA_ALLOWED_EMAILS);

/**
 * @brief Indique si `email` a le droit d'utiliser Sub Tickets.
 * @param email Adresse à vérifier ; comparaison insensible à la casse.
 * @returns `true` si l'adresse figure dans BOT_IA_ALLOWED_EMAILS.
 */
export function isBotIaAllowed(email) {
  return ALLOWED.has(String(email || "").trim().toLowerCase());
}

/**
 * @brief Modèle et effort de raisonnement utilisés par Sub Tickets.
 * @note L'effort se passe dans `output_config`, jamais au premier niveau de
 * la requête envoyée à l'API Anthropic.
 */
export const BOT_IA_MODEL = "claude-opus-5";
export const BOT_IA_EFFORT = "medium";

/**
 * @brief Plafond de tokens de sortie d'un échange Sub Tickets.
 * @warning La réflexion d'Opus 5 consomme le budget de sortie AVANT d'écrire
 * le texte visible : un `max_tokens` trop bas produit une réponse tronquée
 * (`stop_reason: "max_tokens"`) alors que rien ne s'est encore affiché.
 * 16 000 laisse de la marge ; le streaming évite tout risque de timeout HTTP.
 */
export const BOT_IA_MAX_TOKENS = 16000;

/**
 * @brief Budget commun aux personnes autorisées, en euros.
 * @note Surchargeable par la variable d'environnement `BOT_IA_BUDGET_EUR`.
 */
export const BOT_IA_BUDGET_EUR = 20;
