// src/data/webinarSequences/index.js
//
// Accès au contenu réel des séquences e-mail des cohortes webinaire (objet, HTML, texte,
// calendrier, règles d'envoi). Voir README.md : ces données sont GÉNÉRÉES depuis le code de
// la landing par `scripts/webinar-sequences/build.mjs` — ne pas les éditer à la main.
//
// Le catalogue (métadonnées légères) est embarqué ; le contenu de chaque cohorte est un fichier JSON
// SERVI comme ressource statique (≈ 100 à 250 Ko par cohorte) et lu avec `fetch` à la demande — et non
// importé comme module : un `import()` qui échoue reste en échec jusqu'au rechargement de la page (le
// navigateur mémorise l'échec), alors qu'une requête `fetch` repart réellement à chaque « Réessayer ».
// En production chaque fichier porte l'empreinte de son contenu dans son nom (cache long) ; en
// développement Vite le sert tel quel.

import catalog from './catalog.json';

/** `{ './cohorts/<id>.json': <URL de la ressource> }` — seules les URL sont embarquées dans le code. */
const URLS = import.meta.glob('./cohorts/*.json', { query: '?url', import: 'default', eager: true });

/** @brief Cohortes qui disposent d'un contenu, métadonnées seules (sans les e-mails). */
export const SEQUENCE_CATALOG = catalog;

const urlOf = (cohortId) => URLS[`./cohorts/${cohortId}.json`];

/** @brief Vrai si le contenu de cette cohorte est disponible localement. */
export function hasCohortSequence(cohortId) {
  return Boolean(urlOf(cohortId));
}

/**
 * @brief Erreur de chargement du contenu d'une cohorte, avec un message FRANÇAIS prêt à afficher.
 * `needsReload` : « Réessayer » ne servirait à rien (le site a été mis à jour depuis l'ouverture de la page :
 * l'ancienne adresse du fichier n'existe plus) — il faut recharger la page.
 */
export class SequenceLoadError extends Error {
  constructor(message, { needsReload = false, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SequenceLoadError';
    this.needsReload = needsReload;
  }
}

const MSG_NETWORK = "Le contenu des e-mails de cette cohorte n'a pas pu être téléchargé (connexion indisponible ?). Réessayez.";
const MSG_SERVER = (status) => `Le serveur n'a pas pu fournir le contenu de cette cohorte (erreur ${status}). Réessayez dans un instant.`;
const MSG_STALE = 'Le site a été mis à jour depuis l\'ouverture de cette page : rechargez la page pour récupérer le contenu des e-mails.';
const MSG_BROKEN = 'Le contenu de cette cohorte est illisible. Rechargez la page ; si le problème persiste, il faut régénérer le contenu embarqué.';

/**
 * @brief Charge le contenu complet d'une cohorte.
 * @param cohortId Slug de la cohorte (`webinar-AAAA-MM-JJ`).
 * @returns `{ cohort, sequences, rules, steps }`, ou `null` si la cohorte n'a pas de contenu.
 * @throws SequenceLoadError (message français ; `needsReload` quand seul un rechargement de la page peut aider).
 */
export async function loadCohortSequence(cohortId) {
  const url = urlOf(cohortId);
  if (!url) return null;

  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new SequenceLoadError(MSG_NETWORK, { cause });
  }
  if (response.status === 404) throw new SequenceLoadError(MSG_STALE, { needsReload: true });
  if (!response.ok) throw new SequenceLoadError(MSG_SERVER(response.status));

  let json;
  try {
    json = JSON.parse(await response.text());
  } catch (cause) {
    // Réponse 200 qui n'est pas du JSON : l'hébergeur renvoie la page d'accueil de l'application à la place de
    // l'ancien fichier (réécriture de toutes les adresses inconnues) — même cas qu'une mise à jour du site.
    throw new SequenceLoadError(MSG_STALE, { needsReload: true, cause });
  }
  if (!json || !Array.isArray(json.steps)) throw new SequenceLoadError(MSG_BROKEN, { needsReload: true });
  return json;
}
