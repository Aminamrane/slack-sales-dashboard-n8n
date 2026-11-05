// src/components/sequenceMail/savedVersions.js
//
// Versions ENREGISTRÉES des e-mails de séquence (logique pure, sans réseau ni stockage) : superposition d'une version
// enregistrée sur l'étape d'origine, validation avant envoi au serveur, lecture défensive de ses réponses, classement de ses erreurs.
//
// Trois couches se superposent, de la plus ancienne à la plus récente :
//   1. l'e-mail d'ORIGINE (src/data/webinarSequences, instantané du code de la landing) — jamais modifié ;
//   2. la dernière version ENREGISTRÉE dans le CRM (ce module) — relue au chargement de la page, elle survit au rechargement ;
//   3. le BROUILLON en cours d'édition dans l'éditeur (mailDraft.js) — en mémoire, perdu au rechargement tant qu'il n'est pas confirmé.
//
// Pour une cohorte de PRODUCTION, le CRM publie aussi la version sur la landing (`published` dans sa réponse) : elle est envoyée à la place de l'original aux
// PROCHAINS destinataires ; si la publication échoue, la version reste enregistrée et l'écran le dit (`published: false`, bouton « Republier sur la landing »).

import { deriveFromHtml, snippetOf } from './mailDraft.js';

/** Mêmes plafonds que le serveur (app/services/sequence_email_versions.py) : le serveur reste l'autorité. */
export const LIMITS = Object.freeze({ subject: 300, html: 400_000, text: 100_000, note: 300 });

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * @brief L'étape telle qu'elle apparaît une fois la dernière version enregistrée appliquée.
 * @param step Étape d'origine (jamais modifiée).
 * @param saved `{ version, subject, html, text, created_by, created_at }` ou undefined.
 * @returns `step` elle-même sans version enregistrée ; sinon une copie portant `savedVersion`, `savedBy`, `savedAt`.
 */
export function applySaved(step, saved) {
  if (!saved) return step;
  const next = { ...step, savedVersion: saved.version, savedBy: saved.created_by ?? null, savedAt: saved.created_at ?? null, subject: saved.subject,
    savedPublished: saved.published ?? null, publishError: saved.publish_error ?? null };
  if (typeof saved.html === 'string') {
    const derived = deriveFromHtml(saved.html);
    next.html = saved.html;
    next.text = typeof saved.text === 'string' ? saved.text : derived.text;
    next.snippet = snippetOf(next.text);
    next.links = derived.links;
    next.textDerived = typeof saved.text !== 'string';
  } else if (typeof saved.text === 'string') {
    next.text = saved.text;
    next.snippet = snippetOf(saved.text);
  }
  return next;
}

/**
 * @brief Étapes d'une cohorte avec leurs versions enregistrées appliquées.
 * @param cohortSaved `{ [kind]: version }` de la cohorte (ou undefined).
 * @returns `steps` elle-même (même référence) quand rien ne s'applique : les mémos en aval tiennent.
 */
export function savedSteps(steps, cohortSaved) {
  if (!cohortSaved) return steps;
  let changed = false;
  const out = steps.map((step) => {
    const next = hasOwn(cohortSaved, step.kind) ? applySaved(step, cohortSaved[step.kind]) : step;
    if (next !== step) changed = true;
    return next;
  });
  return changed ? out : steps;
}

// ── Validation avant envoi (miroir du serveur : il évite un aller-retour, il ne remplace pas le serveur) ──────────────────

/**
 * @brief Écarts d'un contenu aux règles d'enregistrement ; liste vide = prêt à être envoyé au serveur.
 * @param content `{ subject, html, text }`
 */
export function validateForSave(content) {
  const problems = [];
  const subject = typeof content?.subject === 'string' ? content.subject.replace(/\u00a0/g, ' ').trim() : '';
  if (!subject) problems.push("L'objet est vide.");
  else if (subject.length > LIMITS.subject) problems.push(`L'objet est trop long (${subject.length} sur ${LIMITS.subject} caractères).`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(subject)) problems.push("L'objet ne peut pas contenir de saut de ligne.");
  const html = typeof content?.html === 'string' && content.html.trim() ? content.html : null;
  const text = typeof content?.text === 'string' && content.text.trim() ? content.text : null;
  if (!html && !text) problems.push("L'e-mail n'a pas de corps.");
  if (html && html.length > LIMITS.html) problems.push(`Le corps est trop long (${html.length} sur ${LIMITS.html} caractères).`);
  if (text && text.length > LIMITS.text) problems.push(`La version texte est trop longue (${text.length} sur ${LIMITS.text} caractères).`);
  return problems;
}

/** @brief Ce qu'on envoie au serveur : l'objet, et UN corps (le HTML d'un e-mail HTML ; le texte d'un e-mail sans HTML). */
export function contentToSave(step) {
  const html = typeof step?.html === 'string' && step.html.trim() ? step.html : null;
  return { subject: String(step?.subject ?? ''), html, text: html ? null : typeof step?.text === 'string' && step.text.trim() ? step.text : null };
}

/** @brief Empreinte courte et stable d'un contenu (FNV-1a 32 bits, 8 caractères hexadécimaux) : trace de l'état de départ d'une édition, pas une preuve cryptographique. */
export function shortHash(value) {
  let h = 0x811c9dc5;
  const s = String(value ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** @brief Clé d'idempotence : une par TENTATIVE de contenu (rejouée telle quelle si on réessaie le même contenu). */
export function newIdempotencyKey(random = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`) {
  return `k-${random()}`.replace(/[^A-Za-z0-9_.:-]/g, '-').slice(0, 80).padEnd(8, '0');
}

// ── Lecture défensive des réponses du serveur ─────────────────────────────────────────────────────────────────

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v : null);

/** @brief Une version telle que le serveur la renvoie → objet sûr, ou `null` si elle est inutilisable. */
export function normalizeVersion(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.version) || raw.version < 1 || typeof raw.subject !== 'string') return null;
  return {
    cohort_id: text(raw.cohort_id), kind: text(raw.kind), version: raw.version, subject: raw.subject, html: text(raw.html), text: text(raw.text),
    base_hash: text(raw.base_hash), note: text(raw.note), created_by: text(raw.created_by), created_at: text(raw.created_at), replayed: raw.replayed === true,
    // Publication vers la landing (cohortes de production) : true = en ligne, false = enregistrée mais PAS en ligne (+ motif), null = inconnu ou cohorte de test.
    published: raw.published === true ? true : raw.published === false ? false : null, publish_error: text(raw.publish_error),
  };
}

/**
 * @brief Réponse de `GET /marketing/sequence-emails` → `{ emails, testCohorts, canWriteProduction, historicalCohorts }`.
 * `historicalCohorts` : cohortes dont l'instantané est restitué avec d'anciennes versions du code d'envoi (jamais publiées sur la landing).
 * `emails` est `{ [cohorte]: { [kind]: version } }` ; les dictionnaires n'ont PAS de prototype (un `kind` venu du réseau ne peut pas écrire dans `Object.prototype`).
 */
export function normalizeSavedPayload(json) {
  const emails = Object.create(null);
  if (isObject(json?.emails)) {
    for (const [cohortId, kinds] of Object.entries(json.emails)) {
      if (!isObject(kinds) || cohortId === '__proto__') continue;
      const slice = Object.create(null);
      for (const [kind, raw] of Object.entries(kinds)) {
        const v = kind === '__proto__' ? null : normalizeVersion(raw);
        if (v) slice[kind] = v;
      }
      if (Object.keys(slice).length) emails[cohortId] = slice;
    }
  }
  const testCohorts = Array.isArray(json?.test_cohorts)
    ? json.test_cohorts.filter((t) => isObject(t) && typeof t.id === 'string' && /^test-[a-z0-9][a-z0-9-]{2,60}$/.test(t.id) && typeof t.source_cohort_id === 'string')
      .map((t) => ({ id: t.id, source_cohort_id: t.source_cohort_id, label: typeof t.label === 'string' && t.label ? t.label : t.id }))
    : [];
  const historicalCohorts = Array.isArray(json?.historical_cohorts) ? json.historical_cohorts.filter((id) => typeof id === 'string' && /^webinar-\d{4}-\d{2}-\d{2}$/.test(id)) : [];
  return { emails, testCohorts, canWriteProduction: json?.can_write_production === true, historicalCohorts };
}

// ── Classement des erreurs ────────────────────────────────────────────────────────────────────────────────

/** @brief Erreurs de validation de FastAPI (`[{ loc, msg }]`) → phrases lisibles. */
function validationProblems(list) {
  return list
    .map((r) => {
      if (!isObject(r) || typeof r.msg !== 'string') return null;
      const where = Array.isArray(r.loc) ? r.loc.filter((x) => x !== 'body').join('.') : '';
      return where ? `${where} : ${r.msg}` : r.msg;
    })
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * @brief Erreur d'un appel d'enregistrement → `{ kind, message, problems, currentVersion, retryAfter, retryable }`.
 * kind : `conflict` (l'e-mail a changé entre-temps) · `invalid` (contenu refusé) · `forbidden` · `notfound` · `rate` · `auth` · `unavailable` (route absente) ·
 *        `network` · `server`. Le message est en français, prêt à afficher : jamais « [object Object] », jamais de trace technique.
 */
export function classifyError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 0;
  const raw = error?.data?.detail;
  const detail = isObject(raw) ? raw : null;
  const asked = detail && typeof detail.message === 'string' ? detail.message : typeof raw === 'string' ? raw : '';
  const message = /^\s*(\[object Object\]|undefined|null)?\s*$/.test(asked) ? '' : asked;     // jamais un message technique ou vide à l'écran
  const problems = detail && Array.isArray(detail.problems) ? detail.problems.filter((p) => typeof p === 'string').slice(0, 10)
    : Array.isArray(raw) ? validationProblems(raw) : [];
  const base = { problems, currentVersion: Number.isInteger(detail?.current_version) ? detail.current_version : null, retryAfter: Number.isInteger(detail?.retry_after) ? detail.retry_after : null };
  if (!status) return { ...base, kind: 'network', message: 'Connexion impossible : rien n\'a été enregistré. Réessayez.', retryable: true };
  if (status === 409) return { ...base, kind: 'conflict', message: message || 'Cet e-mail a été modifié entre-temps : rechargez sa dernière version.', retryable: false };
  if (status === 422) return { ...base, kind: 'invalid', message: message || 'Contenu refusé par le serveur.', retryable: false };
  if (status === 413) return { ...base, kind: 'invalid', message: 'Le contenu est trop volumineux.', retryable: false };
  if (status === 429) return { ...base, kind: 'rate', message: message || 'Trop d\'enregistrements d\'affilée : patientez un instant.', retryable: true };
  if (status === 401) return { ...base, kind: 'auth', message: 'Votre session a expiré : reconnectez-vous. Rien n\'a été enregistré.', retryable: false };
  if (status === 403) return { ...base, kind: 'forbidden', message: message || 'Votre rôle ne permet pas d\'enregistrer cet e-mail.', retryable: false };
  if (status === 404) return { ...base, kind: 'unavailable', message: message || 'L\'enregistrement n\'est pas disponible pour cette cohorte (ou pas encore activé sur le serveur).', retryable: false };
  return { ...base, kind: 'server', message: 'Le serveur n\'a pas pu enregistrer (erreur ' + status + '). Rien n\'a été enregistré : réessayez dans un instant.', retryable: true };
}

// ── Cohortes de TEST ───────────────────────────────────────────────────────────────────────────────────────────

/** @brief Vrai pour l'identifiant d'une cohorte de test (`test-…`) : jamais une cohorte de production, jamais connue de la landing ni de ses statistiques. */
export const isTestCohortId = (id) => typeof id === 'string' && /^test-[a-z0-9][a-z0-9-]{2,60}$/.test(id);

/**
 * @brief Entrée de liste d'une cohorte de test : copie de l'entrée de sa cohorte SOURCE, avec sa propre identité.
 * Elle n'a ni date d'inscription ni lien avec le CRM : aucune statistique, aucun inscrit, aucun envoi ne peut s'y rattacher.
 */
export function cloneTestCohort(source, test) {
  return {
    ...source, id: test.id, label: test.label, short: `TEST ${source.short}`, baseShort: source.short, isTest: true, sourceCohortId: source.id,
    inCatalog: true, inApi: false, apiTitle: null, dateStart: null, dateEnd: null,
  };
}

/** @brief Contenu d'une cohorte de test : celui de sa source, ré-étiqueté. Les étapes sont PARTAGÉES (jamais modifiées) ; seule l'identité de la cohorte change. */
export function retargetForTest(loaded, test) {
  if (!loaded) return loaded;
  return { ...loaded, cohort: { ...(loaded.cohort || {}), id: test.id, label: test.label, isTest: true, sourceCohortId: test.source_cohort_id } };
}

/** @brief Réponse de `POST …/publish` → `{ published: true, version }`, ou null si elle n'est pas exactement ce que le serveur promet (jamais « publié » sur un doute). */
export function normalizeRepublishResponse(json) {
  if (!isObject(json) || json.published !== true || !Number.isInteger(json.version) || json.version < 1) return null;
  return { published: true, version: json.version };
}

/**
 * @brief Erreur d'un appel de republication → message court pour l'écran.
 * La republication ne touche jamais à la version enregistrée : une erreur ici veut dire « toujours pas en ligne », pas « rien n'est enregistré ».
 */
export function describePublishError(error) {
  const status = error?.status ?? null;
  const detail = error?.data?.detail;
  const motive = typeof detail?.publish_error === 'string' && detail.publish_error ? detail.publish_error : (typeof detail?.message === 'string' ? detail.message : '');
  if (!status) return 'Connexion impossible : la version n\'est toujours pas publiée sur la landing. Réessayez.';
  if (status === 401) return 'Votre session a expiré : reconnectez-vous. La version n\'est toujours pas publiée.';
  if (status === 403) return motive || 'Votre rôle ne permet pas de publier cet e-mail.';
  if (status === 404) return motive || 'Aucune version enregistrée à publier pour cet e-mail.';
  if (status === 409) return motive || 'Cette cohorte n\'est pas publiée sur la landing.';
  if (status === 502) return `La landing n'a pas accepté la version${motive ? ` : ${motive}` : '.'}`;
  return `Publication impossible (erreur ${status}) : la version n'est toujours pas sur la landing.`;
}

/**
 * @brief Cette cohorte est-elle publiée sur la landing quand on « Confirme » ? Non pour une cohorte de test (elle n'existe que dans le CRM) ni pour une cohorte
 * historique (restituée avec d'anciennes versions du code : la publier ferait renvoyer d'anciens textes). Seul le serveur décide ; l'écran ne fait que le dire.
 */
export function publishesToLanding(cohort, historicalCohorts = []) {
  if (!cohort || cohort.isTest) return false;
  return typeof cohort.id === 'string' && !historicalCohorts.includes(cohort.id);
}
