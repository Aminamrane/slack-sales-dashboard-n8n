// src/components/sequenceMail/saveFlow.js
//
// « Confirmer les modifications » : l'enregistrement RÉEL d'un e-mail, sans interface (testable sans navigateur).
// Valide, construit la demande, appelle le serveur, range l'issue. Aucune simulation : si le serveur ne répond pas « créé », rien n'est dit enregistré.
//
// Idempotence : une clé par CONTENU. Si la même demande est refaite (réseau coupé, double clic, rejeu après renouvellement de session) elle repart avec la MÊME clé :
// le serveur répond la version déjà créée au lieu d'en créer une seconde. Un contenu différent reçoit une clé neuve.

import { classifyError, contentToSave, newIdempotencyKey, shortHash, validateForSave } from './savedVersions.js';

/** @brief Empreinte de la DEMANDE (cohorte, e-mail, version de départ et contenu) : deux demandes identiques partagent la même clé d'idempotence. */
export function requestSignature({ cohortId, kind, expectedVersion, content }) {
  return `${cohortId}|${kind}|${expectedVersion}|${shortHash(content.subject)}|${shortHash(content.html)}|${shortHash(content.text)}|${content.subject.length}|${(content.html || '').length}|${(content.text || '').length}`;
}

/**
 * @param args
 *   step            l'e-mail tel qu'affiché (version enregistrée + brouillon appliqués) : c'est ce contenu qui est enregistré
 *   cohortId, kind  clé de l'e-mail
 *   expectedVersion version enregistrée dont part l'édition (0 = aucune)
 *   baseHash        trace du contenu de départ (facultatif)
 *   put             `putEmailVersion` (injectable pour les tests)
 *   keyState        `{ signature, key }` conservé entre deux tentatives (ref de l'interface)
 *   newKey          générateur de clé (injectable)
 * @returns `{ ok: true, version }` ou `{ ok: false, error: { kind, message, problems, currentVersion, retryAfter, retryable }, local?: true }`
 */
export async function saveEmail({ step, cohortId, kind, expectedVersion, baseHash = null, note = null, put, keyState, newKey = newIdempotencyKey }) {
  const content = contentToSave(step);
  const problems = validateForSave(content);
  if (problems.length) {
    return { ok: false, local: true, error: { kind: 'invalid', message: problems.join(' '), problems, currentVersion: null, retryAfter: null, retryable: false } };
  }
  const signature = requestSignature({ cohortId, kind, expectedVersion, content });
  if (!keyState.key || keyState.signature !== signature) {
    keyState.key = newKey();
    keyState.signature = signature;
  }
  try {
    const version = await put({ cohortId, kind, expectedVersion, subject: content.subject, html: content.html, text: content.text, baseHash, note, idempotencyKey: keyState.key });
    keyState.key = null;
    keyState.signature = null;
    return { ok: true, version };
  } catch (error) {
    const classified = classifyError(error);
    // Un refus définitif (contenu invalide, conflit, droits) rend la clé inutile ; un échec réessayable (réseau, 5xx, 429) la garde pour le rejeu.
    if (!classified.retryable) {
      keyState.key = null;
      keyState.signature = null;
    }
    return { ok: false, error: classified };
  }
}
