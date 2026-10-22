import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEND_TIMEOUT_MS, TEST_MAIL_ENDPOINT, TEST_MAIL_SENDER, TEST_SUBJECT_PREFIX, accountEmail, buildTestPayload, describeTestError,
  differingSender, hasTestContent, interpretTestResult, sendTestMail,
} from './testMail.js';

const STEP = {
  kind: 'email_sep21_why',
  subject: 'Vous ne serez probablement pas là',
  html: '<!doctype html><html><body><p>Bonjour {{prénom}}</p></body></html>',
  text: 'Bonjour {{prénom}}\n',
  replyTo: 'contact@ownertechnology.com',
  from: 'Owner Technology <info@ownertechnology.com>',
};

// ── Adresse du compte ─────────────────────────────────────────────────────────

test("accountEmail lit l'adresse du compte et refuse tout le reste", () => {
  assert.equal(accountEmail({ email: 'utilisateur@ownertechnology.com' }), 'utilisateur@ownertechnology.com');
  assert.equal(accountEmail({ email: '  utilisateur@ownertechnology.com ' }), 'utilisateur@ownertechnology.com');
  for (const user of [null, undefined, {}, { email: '' }, { email: 'pas-une-adresse' }, { email: 'a@b' }, { email: 42 }, { email: 'a b@c.fr' }]) {
    assert.equal(accountEmail(user), '', JSON.stringify(user));
  }
});

// ── Charge utile ──────────────────────────────────────────────────────────────

test('la charge utile reprend le brouillon et ne contient JAMAIS de destinataire', () => {
  const payload = buildTestPayload(STEP);
  assert.deepEqual(payload, {
    subject: STEP.subject, html: STEP.html, text: STEP.text, reply_to: 'contact@ownertechnology.com', kind: 'email_sep21_why',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['html', 'kind', 'reply_to', 'subject', 'text']);
  for (const forbidden of ['to', 'email', 'recipient', 'from', 'cc', 'bcc']) assert.ok(!(forbidden in payload), forbidden);
});

test("l'expéditeur de l'étape n'est jamais transmis : il est fixé côté serveur", () => {
  const payload = buildTestPayload({ ...STEP, from: 'Pirate <pirate@exemple.fr>' });
  assert.ok(!JSON.stringify(payload).includes('pirate'));
});

test('un e-mail en texte brut part sans HTML ; les champs vides valent null', () => {
  assert.deepEqual(buildTestPayload({ subject: 'Invitation', text: 'Bonjour {{prénom}}' }),
    { subject: 'Invitation', html: null, text: 'Bonjour {{prénom}}', reply_to: null, kind: null });
  const blank = buildTestPayload({ subject: undefined, html: '  \n', text: '', replyTo: '   ', kind: '' });
  assert.deepEqual(blank, { subject: '', html: null, text: null, reply_to: null, kind: null });
  assert.deepEqual(buildTestPayload(null), { subject: '', html: null, text: null, reply_to: null, kind: null });
});

test('les types inattendus ne plantent pas et ne sont pas envoyés', () => {
  const payload = buildTestPayload({ subject: 12, html: {}, text: ['x'], replyTo: 7, kind: false });
  assert.deepEqual(payload, { subject: '', html: null, text: null, reply_to: null, kind: null });
});

test("hasTestContent : un brouillon vide n'est pas envoyable", () => {
  assert.equal(hasTestContent(STEP), true);
  assert.equal(hasTestContent({ text: 'x' }), true);
  assert.equal(hasTestContent({ html: ' ', text: '\n' }), false);
  assert.equal(hasTestContent(undefined), false);
});

// ── Résultat ──────────────────────────────────────────────────────────────────

test('un envoi confirmé donne le destinataire et l\'objet tels que partis', () => {
  const result = { channel: 'email', to: 'utilisateur@ownertechnology.com', results: [{ step: 1, subject: '[Test] Vous ne serez probablement pas là', sent: true }], message_id: 'abc' };
  assert.deepEqual(interpretTestResult(result), { ok: true, to: 'utilisateur@ownertechnology.com', subject: '[Test] Vous ne serez probablement pas là', error: '' });
});

test('un échec du fournisseur est rapporté avec son message, ou un message par défaut', () => {
  const failed = interpretTestResult({ to: 'a@b.fr', results: [{ step: 1, subject: '[Test] x', sent: false, error: "Le service d'envoi d'e-mails a refusé ou n'a pas pu traiter l'envoi." }] });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /refusé/);
  assert.match(interpretTestResult({ to: 'a@b.fr', results: [{ sent: false }] }).error, /n'a pas confirmé/);
});

test('une réponse inattendue ne vaut jamais un succès', () => {
  for (const bad of [null, undefined, {}, { results: [] }, { results: [{}] }, { results: [{ sent: 'true' }] }, { results: 'ok' }, 'ok', 42]) {
    assert.equal(interpretTestResult(bad).ok, false, JSON.stringify(bad));
  }
});

// ── Erreurs ───────────────────────────────────────────────────────────────────

test('chaque statut HTTP a son message', () => {
  assert.match(describeTestError({ status: 401 }), /session a expiré/);
  assert.match(describeTestError({ status: 403 }), /rôle n'autorise pas/);
  assert.match(describeTestError({ status: 404 }), /pas encore disponible/);
  assert.match(describeTestError({ status: 405 }), /pas encore disponible/);
  assert.match(describeTestError({ status: 413 }), /trop volumineux/);
  assert.match(describeTestError({ status: 500 }), /serveur n'a pas pu/);
  assert.match(describeTestError({ status: 503 }), /serveur n'a pas pu/);
});

test("422 et 429 reprennent le message du serveur quand c'est une chaîne", () => {
  assert.equal(describeTestError({ status: 422, data: { detail: 'Le brouillon est vide : il n\'y a rien à envoyer.' } }), "Le brouillon est vide : il n'y a rien à envoyer.");
  assert.equal(describeTestError({ status: 429, data: { detail: "Trop de tests d'affilée : réessayez dans 42 s." } }), "Trop de tests d'affilée : réessayez dans 42 s.");
});

test("une erreur de validation FastAPI (liste) ou un détail absent n'est jamais affiché tel quel", () => {
  const list = describeTestError({ status: 422, data: { detail: [{ loc: ['body', 'html'], msg: 'Input should be a valid string', type: 'string_type' }] } });
  assert.doesNotMatch(list, /Input should|loc|\[object/);
  assert.match(list, /ne peut pas être envoyé/);
  assert.match(describeTestError({ status: 429 }), /patientez/);
});

test('une panne réseau (aucun statut) a un message de connexion', () => {
  assert.match(describeTestError(new TypeError('Failed to fetch')), /connexion/);
  assert.match(describeTestError(undefined), /connexion/);
});

// ── Envoi ─────────────────────────────────────────────────────────────────────

test("sendTestMail appelle la bonne route avec la charge utile du brouillon, rien d'autre", async () => {
  const calls = [];
  const post = async (endpoint, body) => {
    calls.push({ endpoint, body });
    return { channel: 'email', to: 'utilisateur@ownertechnology.com', results: [{ step: 1, subject: '[Test] ' + body.subject, sent: true }] };
  };
  const result = await sendTestMail(post, STEP);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, TEST_MAIL_ENDPOINT);
  assert.equal(TEST_MAIL_ENDPOINT, '/api/v1/tracking/email-draft/test');
  assert.deepEqual(calls[0].body, buildTestPayload(STEP));
  assert.deepEqual(result, { ok: true, to: 'utilisateur@ownertechnology.com', subject: '[Test] Vous ne serez probablement pas là', error: '' });
});

test('sendTestMail propage les erreurs HTTP telles quelles (traduites par describeTestError)', async () => {
  const error = Object.assign(new Error('Accès refusé. Rôle requis: admin, ceo'), { status: 403, data: { detail: 'Accès refusé. Rôle requis: admin, ceo' } });
  await assert.rejects(sendTestMail(async () => { throw error; }, STEP), (e) => e === error);
  assert.match(describeTestError(error), /rôle n'autorise pas/);
  assert.ok(!describeTestError(error).includes('admin, ceo'));
});

test("sans réponse du serveur, l'attente s'arrête avec une erreur « délai » qui prévient que le test a pu partir", async () => {
  const never = () => new Promise(() => {});
  const started = Date.now();
  const error = await sendTestMail(never, STEP, 20).then(() => null, (e) => e);
  assert.ok(error, 'doit échouer');
  assert.equal(error.timeout, true);
  assert.ok(Date.now() - started < 1000);
  const message = describeTestError(error);
  assert.match(message, /pas répondu à temps/);
  assert.match(message, /peut-être été envoyé/);
});

test("le délai ne coupe pas un envoi qui répond à temps, et son minuteur est nettoyé", async () => {
  const quick = async () => ({ to: 'a@b.fr', results: [{ step: 1, subject: '[Test] x', sent: true }] });
  const result = await sendTestMail(quick, STEP, 5000);
  assert.equal(result.ok, true);
  // Si le minuteur de 5 s n'était pas effacé, ce fichier de test resterait ouvert 5 s : `node --test` le signalerait.
});

test("le délai par défaut laisse largement le temps au fournisseur d'e-mail", () => {
  assert.ok(SEND_TIMEOUT_MS >= 15_000 && SEND_TIMEOUT_MS <= 60_000);
});

// ── Expéditeur et objet affichés ──────────────────────────────────────────────

test("l'expéditeur affiché est celui que le serveur fixe, et l'objet porte le préfixe du serveur", () => {
  assert.equal(TEST_MAIL_SENDER, 'Owner Technology <info@ownertechnology.com>');
  assert.equal(TEST_SUBJECT_PREFIX, '[Test] ');
});

test("differingSender signale l'expéditeur d'une étape seulement s'il n'est pas celui du test", () => {
  assert.equal(differingSender({ from: 'Owner Technology <info@ownertechnology.com>' }), '');
  assert.equal(differingSender({ from: '  owner technology <INFO@ownertechnology.com> ' }), '');
  assert.equal(differingSender({ from: 'Autre Expéditeur <autre@ownertechnology.com>' }), 'Autre Expéditeur <autre@ownertechnology.com>');
  for (const step of [null, undefined, {}, { from: '' }, { from: '   ' }, { from: 7 }]) assert.equal(differingSender(step), '', JSON.stringify(step));
});
