// src/components/sequenceMail/testMail.js
//
// « Tester son mail » (Éditeur de mail) : fonctions PURES de l'envoi d'un e-mail de test à l'adresse du compte
// connecté (testées sous Node : `testMail.test.js`). Aucun accès réseau ici : l'appel est injecté (`post`).
//
// Le brouillon tel qu'il est affiché dans l'éditeur part vers la route de test de la landing webinaire (là où le
// moteur d'envoi et la clé Resend vivent déjà ; le même contrat existe côté backend du CRM,
// `/api/v1/tracking/email-draft/test`, pour le jour où il y sera déployé). Le serveur vérifie la session auprès du
// CRM (même jeton que le reste de l'application) puis l'envoie UNIQUEMENT à l'adresse de ce compte : le front
// n'envoie jamais de destinataire (même si on le lui demandait, la charge utile n'en a pas le champ). Le serveur fixe
// l'expéditeur, préfixe l'objet « [Test] », remplace {{prénom}} par le prénom du compte, désactive les liens
// personnels (…/EVENT_ID) et n'écrit rien en base : aucun inscrit, aucune séquence n'est touché.

export const TEST_MAIL_ENDPOINT = 'https://webinaire.ownertechnology.com/api/crm/email-draft-test';
/** Expéditeur des e-mails de test : fixé côté serveur (le même que les envois réels du webinaire). */
export const TEST_MAIL_SENDER = 'Owner Technology <info@ownertechnology.com>';
/** Préfixe que le serveur ajoute à l'objet d'un e-mail de test. */
export const TEST_SUBJECT_PREFIX = '[Test] ';
/** Au-delà, l'attente est abandonnée côté écran (le fournisseur répond en moins de 2 s en temps normal). */
export const SEND_TIMEOUT_MS = 25_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (value) => (typeof value === 'string' ? value : '');
const filled = (value) => (text(value).trim() ? text(value) : null);

/** @brief Adresse e-mail du compte connecté (`apiClient.getUser()`), ou `''` si elle est absente ou invalide. */
export function accountEmail(user) {
  const email = text(user?.email).trim();
  return EMAIL_RE.test(email) ? email : '';
}

/**
 * @brief Charge utile envoyée au backend pour une étape (brouillon déjà superposé, cf. hooks.js).
 * @note Jamais de destinataire. `html` / `text` valent `null` s'ils sont vides (un e-mail en texte brut n'a pas de HTML).
 */
export function buildTestPayload(step) {
  return {
    subject: text(step?.subject),
    html: filled(step?.html),
    text: filled(step?.text),
    reply_to: filled(step?.replyTo)?.trim() ?? null,
    kind: filled(step?.kind)?.trim() ?? null,
  };
}

/** @brief Expéditeur de l'étape quand il n'est PAS celui du test (le serveur impose `TEST_MAIL_SENDER`), sinon `''`. */
export function differingSender(step) {
  const from = text(step?.from).trim();
  return from && from.toLowerCase() !== TEST_MAIL_SENDER.toLowerCase() ? from : '';
}

/** @brief Vrai si l'étape a quelque chose à envoyer (le backend refuse un brouillon vide). */
export function hasTestContent(step) {
  const payload = buildTestPayload(step);
  return Boolean(payload.html || payload.text);
}

/**
 * @brief Lit la réponse du backend (`{ channel, to, results: [{ step, subject, sent, error? }] }`).
 * @returns `{ ok, to, subject, error }` — `error` n'existe que si `ok` est faux.
 */
export function interpretTestResult(result) {
  const item = Array.isArray(result?.results) ? result.results[0] : null;
  const to = text(result?.to);
  const subject = text(item?.subject);
  if (item?.sent === true) return { ok: true, to, subject, error: '' };
  return { ok: false, to, subject, error: text(item?.error).trim() || "Le service d'envoi n'a pas confirmé l'envoi du test." };
}

/**
 * @brief Message lisible pour une erreur de `apiClient` (`err.status`, `err.data.detail`).
 * @note Le détail du serveur n'est repris que s'il est une CHAÎNE (une erreur de validation FastAPI est une liste).
 */
export function describeTestError(err) {
  const status = err?.status;
  const detail = text(err?.data?.detail).trim();
  if (err?.timeout) return "Le serveur n'a pas répondu à temps. Le test a peut-être été envoyé : vérifiez votre boîte de réception avant de réessayer.";
  if (status === 401) return 'Votre session a expiré : reconnectez-vous, puis réessayez.';
  if (status === 403) return "Votre rôle n'autorise pas l'envoi d'un e-mail de test.";
  if (status === 404 || status === 405) return "L'envoi de test n'est pas encore disponible sur le serveur : réessayez après la prochaine mise à jour.";
  if (status === 413) return 'Le brouillon est trop volumineux pour un test.';
  if (status === 422) return detail || 'Ce brouillon ne peut pas être envoyé en test.';
  if (status === 429) return detail || "Trop de tests d'affilée : patientez un instant avant de réessayer.";
  if (typeof status === 'number' && status >= 500) return "Le serveur n'a pas pu envoyer le test : réessayez dans un instant.";
  return "Le test n'a pas pu être envoyé : vérifiez votre connexion, puis réessayez (si cela persiste, l'envoi de test n'est peut-être pas encore disponible sur le serveur).";
}

/**
 * @brief POST JSON vers une adresse ABSOLUE (hors backend du CRM) avec le jeton de la session de `client` (`apiClient`).
 * @note N'utilise que l'API publique de `client` : `getToken()` ; sur un 401, `getMe()` renouvelle le jeton s'il a
 * expiré (ou ferme la session, comme partout dans l'application) puis la requête est rejouée UNE fois. Une réponse
 * non-2xx lève une erreur avec `status` et `data` (comme `apiClient.post`) : `describeTestError` la traduit.
 */
export async function postWithSession(client, url, body) {
  const send = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken() ?? ''}` },
      body: JSON.stringify(body),
    });
  let response = await send();
  if (response.status === 401) {
    await client.getMe();
    response = await send();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data?.detail === 'string' && data.detail ? data.detail : 'Erreur API');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/**
 * @brief Envoie le test de `step` et renvoie le résultat lu (`interpretTestResult`). Une erreur HTTP ou réseau est propagée
 * telle quelle : l'appelant la traduit avec `describeTestError`. Sans réponse après `timeoutMs`, l'erreur levée porte
 * `timeout: true` (le test a pu partir malgré tout : le message le dit).
 * @param post `(endpoint, body) => Promise<json>` — `apiClient.post` (lié) en production, un faux dans les tests.
 */
export async function sendTestMail(post, step, timeoutMs = SEND_TIMEOUT_MS) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Délai dépassé'), { timeout: true })), timeoutMs);
  });
  try {
    return interpretTestResult(await Promise.race([post(TEST_MAIL_ENDPOINT, buildTestPayload(step)), expired]));
  } finally {
    clearTimeout(timer);
  }
}
