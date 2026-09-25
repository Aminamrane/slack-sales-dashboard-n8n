// src/config/botIaMentions.js

/**
 * @file botIaMentions.js
 * @brief Source de vérité unique des mentions de page de Sub Tickets (`@Ambulancev1`…).
 *
 * @note Même parti pris que botIaAccess.js : ce fichier est PUR — aucun
 * import, aucune API navigateur, aucun `import.meta.env`. C'est ce qui
 * permet de le lire à la fois côté front (CeoBotIaView, qui propose et
 * grise les mentions) et côté fonction serveur (api/bot-ia/chat.mjs, qui
 * refuse la requête), sans que les deux listes puissent diverger.
 *
 * @note À quoi ça sert : un ticket Sub Tickets doit TOUJOURS dire sur
 * quelle page webinaire il porte. L'utilisateur écrit `@Ambulancev1` ;
 * l'agent qui traite le ticket, lui, reçoit l'URL en clair. La mention est
 * donc à la fois un raccourci de saisie et le contrat d'entrée de la file
 * d'attente.
 *
 * @warning Règle dure, volontairement sans échappatoire : pas de mention
 * valide en tête de prompt = le ticket n'est même pas transmis. Voir
 * `parseMention`.
 */

/**
 * @brief Les pages adressables par une mention.
 * @note `label` est ce que voit l'utilisateur, `url` ce que reçoit l'agent.
 * `aliases` couvre les façons plausibles de taper la même chose — la casse
 * n'en fait pas partie, elle est gérée par normalisation.
 */
export const BOT_IA_MENTIONS = Object.freeze([
  {
    key: "ambulancev1",
    label: "Ambulancev1",
    url: "https://webinaire.ownertechnology.com/",
    hint: "Landing V1 . dirigeants de sociétés d'ambulances",
    // « ambualnce » : l'inversion de lettres est fréquente à la frappe, on
    // l'accepte plutôt que de refuser une demande pour une coquille.
    aliases: ["ambulance1", "ambualncev1", "ambualnce1", "ambulance-v1", "lpv1", "v1"],
  },
  {
    key: "ambulancev2",
    label: "Ambulancev2",
    url: "https://webinaire.ownertechnology.com/v2",
    hint: "Landing V2 . variante A/B de la V1",
    aliases: ["ambulance2", "ambualncev2", "ambualnce2", "ambulance-v2", "lpv2", "v2"],
  },
  {
    key: "tpe/pme",
    label: "TPE/PME",
    url: "https://webinaire.ownertechnology.com/tpe-pme",
    hint: "Page cold outreach . dirigeants TPE/PME",
    // « broad » retiré des alias : c'est désormais la clé de sa propre
    // mention (voir ci-dessous), plus un alias de TPE/PME — un seul des deux
    // peut gagner sur `@broad`, et c'est maintenant la page dédiée.
    aliases: ["tpepme", "tpe-pme", "tpe", "pme"],
  },
  {
    key: "broad",
    label: "Broad",
    url: "https://broad.ownertechnology.com",
    hint: "Audit charges TPE/PME (hors webinaire)",
    aliases: [],
  },
]);

/** @brief Caractères admis dans une mention. `/` en fait partie, pour `@TPE/PME`. */
const TOKEN_CHARS = "A-Za-z0-9/_-";

/** @brief Mention en TÊTE de prompt, espaces de gauche tolérés. */
const LEADING_MENTION_RE = new RegExp(`^\\s*@([${TOKEN_CHARS}]*)`);

/**
 * @brief Ramène un jeton à sa forme comparable.
 * @param token Jeton brut tapé après le `@`.
 * @returns Le jeton normalisé (recadré, en minuscules).
 * @note C'est ici, et seulement ici, que se joue la tolérance à la casse
 * demandée : `@BROAD`, `@Broad` et `@broad` donnent la même chaîne, donc la
 * même page.
 */
export function normalizeMentionToken(token) {
  return String(token || "").trim().toLowerCase();
}

/**
 * @brief Trouve la page correspondant à un jeton.
 * @param token Jeton brut (mention sans le `@`) ou déjà normalisé.
 * @returns La page (entrée de BOT_IA_MENTIONS) ou `null` si aucune ne correspond.
 */
export function findMention(token) {
  const t = normalizeMentionToken(token);
  if (!t) return null;
  return (
    BOT_IA_MENTIONS.find((m) => m.key === t || m.aliases.includes(t)) || null
  );
}

/**
 * @brief Liste les pages à proposer pour un début de saisie.
 * @param prefix Ce que l'utilisateur a tapé après le `@`.
 * @returns Les pages dont la clé ou un alias commence par `prefix` (toutes si `prefix` est vide).
 * @note On teste le préfixe sur le libellé ET sur les alias, sinon `@br` ne
 * trouverait pas `broad`. Le tri garde l'ordre déclaré, qui est l'ordre de
 * lecture naturel des cohortes.
 */
export function suggestMentions(prefix) {
  const p = normalizeMentionToken(prefix);
  if (!p) return [...BOT_IA_MENTIONS];
  return BOT_IA_MENTIONS.filter(
    (m) => m.key.startsWith(p) || m.aliases.some((a) => a.startsWith(p)),
  );
}

/**
 * @brief Lit la mention en tête de `text`.
 * @param text Contenu brut saisi par l'utilisateur.
 * @returns Un objet décrivant l'état exact — l'appelant doit distinguer
 * trois refus différents pour pouvoir l'expliquer :
 *   - `{ status: "ok", mention, token, rest }` — mention connue
 *   - `{ status: "missing" }` — pas de `@` du tout
 *   - `{ status: "unknown", token }` — `@` suivi d'un nom inconnu
 *   - `{ status: "empty" }` — `@` seul, rien derrière
 */
export function parseMention(text) {
  const s = String(text || "");
  const m = s.match(LEADING_MENTION_RE);
  if (!m) return { status: "missing" };

  const token = m[1];
  if (!token) return { status: "empty" };

  const mention = findMention(token);
  if (!mention) return { status: "unknown", token };

  return { status: "ok", mention, token, rest: s.slice(m[0].length).trim() };
}

/**
 * @brief Construit ce que l'agent de traitement recevra réellement.
 * @param text Contenu brut saisi par l'utilisateur (avec sa mention `@…`).
 * @returns Le texte avec la mention remplacée par l'URL de la page, ou
 * `null` si `text` n'ouvre pas sur une mention valide — l'appelant ne doit
 * alors RIEN envoyer.
 * @note L'utilisateur garde `@Ambulancev1` dans son fil ; l'agent lit
 * l'adresse en clair.
 */
export function expandMention(text) {
  const parsed = parseMention(text);
  if (parsed.status !== "ok") return null;
  return parsed.rest ? `${parsed.mention.url} ${parsed.rest}` : parsed.mention.url;
}

/**
 * @brief Détermine la page visée par un prompt, mention ou URL développée.
 * @param text Contenu du prompt, sous forme de mention (`@Ambulancev1 …`, ce
 * que tape l'utilisateur) ou déjà développé en URL (`https://…/ …`, ce qui
 * est stocké et transmis à l'agent).
 * @returns La page correspondante, ou `null`.
 * @note Les deux formes doivent être reconnues : la garde serveur voit
 * passer la seconde, la garde du front la première.
 * @warning L'URL de la V1 est un préfixe de toutes les autres : on compare
 * donc de la plus longue à la plus courte, sinon `/v2` serait attribué à la V1.
 */
export function pageFromPrompt(text) {
  const parsed = parseMention(text);
  if (parsed.status === "ok") return parsed.mention;

  const s = String(text || "").trim();
  const byLength = [...BOT_IA_MENTIONS].sort((a, b) => b.url.length - a.url.length);
  return byLength.find((m) => s === m.url || s.startsWith(`${m.url} `) || s.startsWith(`${m.url}\n`)) || null;
}

/**
 * @brief Liste les mentions valides, pour un message d'erreur lisible.
 * @returns Les libellés (`@Ambulancev1, @Ambulancev2, …`) joints par une virgule.
 */
export function mentionListLabel() {
  return BOT_IA_MENTIONS.map((m) => `@${m.label}`).join(", ");
}

/**
 * @brief Construit le refus à afficher pour un prompt sans mention exploitable.
 * @param parsed Résultat de `parseMention` (statut `unknown` ou `empty`, ou tout autre refus).
 * @returns Le message de refus, formulé pour que l'utilisateur sache quoi taper.
 */
export function mentionRefusal(parsed) {
  const liste = mentionListLabel();
  if (parsed.status === "unknown") {
    return `« @${parsed.token} » ne correspond à aucune page. Demande refusée : rien n'a été transmis. Mentions valides : ${liste}.`;
  }
  if (parsed.status === "empty") {
    return `Le « @ » n'est suivi d'aucune page. Demande refusée : rien n'a été transmis. Mentions valides : ${liste}.`;
  }
  return `Une demande doit commencer par la page concernée. Demande refusée : rien n'a été transmis. Mentions valides : ${liste}.`;
}
