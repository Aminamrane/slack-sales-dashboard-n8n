// src/data/webinarSequences/index.js
//
// Accès au contenu réel des séquences e-mail des cohortes webinaire (objet, HTML, texte,
// calendrier, règles d'envoi). Voir README.md : ces données sont GÉNÉRÉES depuis le code de
// la landing par `scripts/webinar-sequences/build.mjs` — ne pas les éditer à la main.
//
// Le catalogue (métadonnées légères) est embarqué ; le contenu de chaque cohorte est un
// chunk séparé, chargé à la demande (les HTML pèsent ≈ 100 à 250 Ko par cohorte).

import catalog from './catalog.json';

const loaders = import.meta.glob('./cohorts/*.json', { import: 'default' });

/** @brief Cohortes qui disposent d'un contenu, métadonnées seules (sans les e-mails). */
export const SEQUENCE_CATALOG = catalog;

/** @brief Vrai si le contenu de cette cohorte est disponible localement. */
export function hasCohortSequence(cohortId) {
  return Boolean(loaders[`./cohorts/${cohortId}.json`]);
}

/**
 * @brief Charge le contenu complet d'une cohorte.
 * @param cohortId Slug de la cohorte (`webinar-AAAA-MM-JJ`).
 * @returns `{ cohort, sequences, rules, steps }`, ou `null` si la cohorte n'a pas de contenu.
 */
export async function loadCohortSequence(cohortId) {
  const load = loaders[`./cohorts/${cohortId}.json`];
  return load ? load() : null;
}
