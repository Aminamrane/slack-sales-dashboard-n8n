// src/components/sequenceMail/emailVersionsApi.js
//
// Appels réseau des versions enregistrées d'e-mails de séquence (backend du CRM : app/api/v1/sequence_emails.py).
//   GET /api/v1/marketing/sequence-emails                     dernière version de chaque e-mail enregistré + cohortes de TEST de ce compte
//   PUT /api/v1/marketing/sequence-emails/{cohorte}/{kind}    enregistre UNE nouvelle version (en-tête Idempotency-Key obligatoire) ; pour une cohorte de
//                                                             production le serveur la PUBLIE aussi sur la landing (réponse : `published`, `publish_error`)
//   POST /api/v1/marketing/sequence-emails/{cohorte}/{kind}/publish   republie la dernière version si la publication avait échoué
// Même client que tout le CRM (`apiClient` : jeton, renouvellement de session). Aucune écriture ailleurs ; le navigateur ne parle jamais à la landing.

import apiClient from '../../services/apiClient';
import { normalizeRepublishResponse, normalizeSavedPayload, normalizeVersion } from './savedVersions.js';

export const SEQUENCE_EMAILS_PATH = '/api/v1/marketing/sequence-emails';

/** @brief Versions enregistrées (production + cohortes de test de ce compte), déjà nettoyées. */
export async function fetchSavedVersions(client = apiClient) {
  return normalizeSavedPayload(await client.get(SEQUENCE_EMAILS_PATH));
}

/**
 * @brief Enregistre une nouvelle version d'un e-mail.
 * @param args `{ cohortId, kind, expectedVersion, subject, html, text, baseHash, note, idempotencyKey }`
 * @returns La version créée (`replayed: true` si la même demande avait déjà abouti : un double clic ne crée jamais deux versions).
 * @throws Error avec `status` et `data` (voir `classifyError` dans savedVersions.js).
 */
export async function putEmailVersion({ cohortId, kind, expectedVersion, subject, html, text, baseHash, note, idempotencyKey }, client = apiClient) {
  const body = { expected_version: expectedVersion, subject };
  if (html !== null && html !== undefined) body.html = html;
  if (text !== null && text !== undefined) body.text = text;
  if (baseHash) body.base_hash = baseHash;
  if (note) body.note = note;
  const json = await client.request(`${SEQUENCE_EMAILS_PATH}/${encodeURIComponent(cohortId)}/${encodeURIComponent(kind)}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
  const version = normalizeVersion(json);
  if (!version) {
    const error = new Error('Réponse du serveur illisible');
    error.status = 502;
    throw error;
  }
  return version;
}

/**
 * @brief Republie la DERNIÈRE version enregistrée d'un e-mail de production sur la landing (après un échec de publication).
 * @returns `{ published: true, version }`.
 * @throws Error avec `status` et `data` (voir `describePublishError`). Ne modifie jamais la version enregistrée.
 */
export async function republishEmail({ cohortId, kind }, client = apiClient) {
  const json = await client.request(`${SEQUENCE_EMAILS_PATH}/${encodeURIComponent(cohortId)}/${encodeURIComponent(kind)}/publish`, { method: 'POST' });
  const done = normalizeRepublishResponse(json);
  if (!done) {
    const error = new Error('Réponse du serveur illisible');
    error.status = 502;
    throw error;
  }
  return done;
}
