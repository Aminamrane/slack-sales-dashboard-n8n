// Tests de savedVersions.js (logique pure) : node --test src/components/sequenceMail/savedVersions.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, applySaved, isTestCohortId, classifyError, cloneTestCohort, contentToSave, describePublishError, newIdempotencyKey, normalizeRepublishResponse, normalizeSavedPayload, normalizeVersion,
  publishesToLanding, retargetForTest, savedSteps, shortHash, validateForSave,
} from './savedVersions.js';

const step = (over = {}) => ({ kind: 'email_confirmation', subject: 'Objet d\'origine', html: '<p>Origine <a href="https://e.test/r/EVENT_ID">lien</a></p>', text: 'Origine\n', snippet: 'Origine', links: [], ...over });
const saved = (over = {}) => ({ cohort_id: 'webinar-2026-10-08', kind: 'email_confirmation', version: 3, subject: 'Objet enregistré', html: '<p>Bonjour <strong>toi</strong>, <a href="https://e.test/x">le lien</a></p>', text: null, created_by: 'auteur-test', created_at: '2026-11-02T10:00:00+00:00', ...over });

test('applySaved : sans version enregistrée, la MÊME étape est rendue', () => {
  const s = step();
  assert.equal(applySaved(s, undefined), s);
  assert.equal(applySaved(s, null), s);
});

test('applySaved : objet, HTML, texte, aperçu et liens viennent de la version enregistrée ; l\'étape d\'origine n\'est jamais modifiée', () => {
  const s = step();
  const frozen = JSON.stringify(s);
  const out = applySaved(s, saved());
  assert.equal(out.subject, 'Objet enregistré');
  assert.equal(out.html, saved().html);
  assert.match(out.text, /Bonjour toi/);
  assert.match(out.snippet, /Bonjour toi/);
  assert.deepEqual(out.links.map((l) => l.href), ['https://e.test/x']);
  assert.equal(out.savedVersion, 3);
  assert.equal(out.savedBy, 'auteur-test');
  assert.equal(JSON.stringify(s), frozen);
  assert.equal(out.kind, s.kind);
});

test('applySaved : un e-mail texte seul', () => {
  const out = applySaved(step({ html: undefined, text: 'Ancien\n' }), saved({ html: null, text: 'Nouveau texte\n' }));
  assert.equal(out.text, 'Nouveau texte\n');
  assert.equal(out.html, undefined);
  assert.equal(out.savedVersion, 3);
});

test('savedSteps : la même référence quand rien ne s\'applique ; seules les étapes concernées changent', () => {
  const steps = [step({ kind: 'a' }), step({ kind: 'b' })];
  assert.equal(savedSteps(steps, undefined), steps);
  assert.equal(savedSteps(steps, {}), steps);
  assert.equal(savedSteps(steps, { autre: saved() }), steps);
  const out = savedSteps(steps, { b: saved({ kind: 'b' }) });
  assert.notEqual(out, steps);
  assert.equal(out[0], steps[0]);
  assert.equal(out[1].savedVersion, 3);
});

test('savedSteps : un kind « __proto__ » ou « constructor » ne s\'applique pas à autre chose', () => {
  const steps = [step({ kind: 'constructor' }), step({ kind: 'a' })];
  assert.equal(savedSteps(steps, Object.create(null)), steps);
  assert.equal(savedSteps(steps, {}), steps);          // `{}.constructor` existe : il ne doit PAS passer pour une version
});

test('validateForSave : écarts attendus', () => {
  assert.deepEqual(validateForSave({ subject: 'Ok', html: '<p>x</p>', text: null }), []);
  assert.deepEqual(validateForSave({ subject: 'Ok', html: null, text: 'texte' }), []);
  assert.match(validateForSave({ subject: '', html: '<p>x</p>' })[0], /objet est vide/);
  assert.match(validateForSave({ subject: '  ', html: '<p>x</p>' })[0], /objet est vide/);
  assert.match(validateForSave({ subject: 'a'.repeat(LIMITS.subject + 1), html: '<p>x</p>' })[0], /trop long/);
  assert.match(validateForSave({ subject: 'a\nb', html: '<p>x</p>' }).join(' '), /saut de ligne/);
  assert.match(validateForSave({ subject: 'Ok' }).join(' '), /pas de corps/);
  assert.match(validateForSave({ subject: 'Ok', html: '  ', text: ' ' }).join(' '), /pas de corps/);
  assert.match(validateForSave({ subject: 'Ok', html: 'x'.repeat(LIMITS.html + 1) }).join(' '), /corps est trop long/);
  assert.match(validateForSave({ subject: 'Ok', text: 'x'.repeat(LIMITS.text + 1) }).join(' '), /texte est trop longue/);
  assert.ok(validateForSave(null).length >= 2);
});

test('contentToSave : un seul corps, le HTML d\'un e-mail HTML ; le texte d\'un e-mail sans HTML', () => {
  assert.deepEqual(contentToSave(step()), { subject: 'Objet d\'origine', html: step().html, text: null });
  assert.deepEqual(contentToSave(step({ html: undefined, text: 'Bonjour\n' })), { subject: 'Objet d\'origine', html: null, text: 'Bonjour\n' });
  assert.deepEqual(contentToSave(step({ html: '   ', text: '' })), { subject: 'Objet d\'origine', html: null, text: null });
});

test('shortHash : 8 caractères hexadécimaux, stable, sensible au contenu', () => {
  assert.match(shortHash('abc'), /^[0-9a-f]{8}$/);
  assert.equal(shortHash('abc'), shortHash('abc'));
  assert.notEqual(shortHash('abc'), shortHash('abd'));
  assert.match(shortHash(null), /^[0-9a-f]{8}$/);
});

test('newIdempotencyKey : forme acceptée par le serveur, jamais la même deux fois', () => {
  const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
  assert.equal(keys.size, 50);
  for (const k of keys) assert.match(k, /^[A-Za-z0-9_.:-]{8,80}$/);
  assert.match(newIdempotencyKey(() => 'é é/é'), /^[A-Za-z0-9_.:-]{8,80}$/);
});

test('normalizeVersion : une réponse mal formée n\'est jamais prise pour une version', () => {
  assert.equal(normalizeVersion(null), null);
  assert.equal(normalizeVersion({ version: 0, subject: 'x' }), null);
  assert.equal(normalizeVersion({ version: '2', subject: 'x' }), null);
  assert.equal(normalizeVersion({ version: 2 }), null);
  assert.equal(normalizeVersion([]), null);
  const v = normalizeVersion({ version: 2, subject: 'S', html: '<p>x</p>', text: 12, created_by: 'auteur-test', replayed: true });
  assert.equal(v.version, 2);
  assert.equal(v.text, null);
  assert.equal(v.replayed, true);
});

test('normalizeSavedPayload : dictionnaires sans prototype, entrées invalides ignorées, cohortes de test filtrées', () => {
  const out = normalizeSavedPayload({
    emails: { 'webinar-2026-10-08': { a: saved({ kind: 'a' }), __proto__: saved(), mauvais: { version: 'x' } }, '__proto__': { a: saved() }, vide: {}, faux: 3 },
    test_cohorts: [{ id: 'test-webinar-2026-10-08', source_cohort_id: 'webinar-2026-10-08', label: 'TEST' }, { id: 'prod-x', source_cohort_id: 'y' }, { id: 'test-ok-abc' }, null, 'x'],
    can_write_production: 'oui',
  });
  assert.equal(Object.getPrototypeOf(out.emails), null);
  assert.deepEqual(Object.keys(out.emails), ['webinar-2026-10-08']);
  assert.deepEqual(Object.keys(out.emails['webinar-2026-10-08']), ['a']);
  assert.equal(Object.getPrototypeOf(out.emails['webinar-2026-10-08']), null);
  assert.deepEqual(out.testCohorts, [{ id: 'test-webinar-2026-10-08', source_cohort_id: 'webinar-2026-10-08', label: 'TEST' }]);
  assert.equal(out.canWriteProduction, false);
  assert.deepEqual(normalizeSavedPayload(undefined), { emails: Object.create(null), testCohorts: [], canWriteProduction: false, historicalCohorts: [] });
  assert.equal(normalizeSavedPayload({ can_write_production: true }).canWriteProduction, true);
});

const err = (status, detail) => Object.assign(new Error('x'), { status, data: detail === undefined ? undefined : { detail } });

test('classifyError : chaque cas a un message français lisible, jamais « [object Object] »', () => {
  assert.equal(classifyError(new TypeError('Failed to fetch')).kind, 'network');
  assert.equal(classifyError(new TypeError('Failed to fetch')).retryable, true);
  const conflict = classifyError(err(409, { message: 'Modifié entre-temps', current_version: 4 }));
  assert.deepEqual([conflict.kind, conflict.currentVersion, conflict.retryable, conflict.message], ['conflict', 4, false, 'Modifié entre-temps']);
  const invalid = classifyError(err(422, { message: 'Contenu refusé', problems: ['balise <script> interdite', 12, 'autre'] }));
  assert.deepEqual([invalid.kind, invalid.problems], ['invalid', ['balise <script> interdite', 'autre']]);
  const pydantic = classifyError(err(422, [{ loc: ['body', 'expected_version'], msg: 'Input should be a valid integer' }, { loc: ['body'], msg: 'x' }, 'nope']));
  assert.deepEqual(pydantic.problems, ['expected_version : Input should be a valid integer', 'x']);
  assert.equal(classifyError(err(429, { message: 'Trop vite', retry_after: 12 })).retryAfter, 12);
  assert.equal(classifyError(err(401)).kind, 'auth');
  assert.equal(classifyError(err(403, { message: 'Rôle insuffisant' })).message, 'Rôle insuffisant');
  assert.equal(classifyError(err(404)).kind, 'unavailable');
  assert.equal(classifyError(err(413)).kind, 'invalid');
  const server = classifyError(err(503, 'Service Unavailable'));
  assert.deepEqual([server.kind, server.retryable], ['server', true]);
  for (const e of [err(500, {}), err(409, {}), err(403, '[object Object]'), err(502)]) assert.doesNotMatch(classifyError(e).message, /object Object|undefined/);
});

test('cloneTestCohort / retargetForTest : identité propre, contenu partagé, source intacte', () => {
  const source = { id: 'webinar-2026-10-08', label: 'Webinaire du 8 octobre', short: '8 oct.', audience: 'Ambulances', inCatalog: true, inApi: true, apiTitle: 'T', dateStart: '2026-10-01', dateEnd: '2026-10-08', liveAt: '2026-10-08T18:00:00Z' };
  const t = { id: 'test-webinar-2026-10-08', source_cohort_id: source.id, label: 'TEST — 8 octobre' };
  const frozen = JSON.stringify(source);
  const c = cloneTestCohort(source, t);
  assert.deepEqual([c.id, c.label, c.short, c.isTest, c.sourceCohortId, c.inApi, c.apiTitle, c.dateStart, c.dateEnd], [t.id, t.label, 'TEST 8 oct.', true, source.id, false, null, null, null]);
  assert.equal(c.audience, 'Ambulances');
  assert.equal(c.baseShort, '8 oct.');
  assert.equal(JSON.stringify(source), frozen);
  const loaded = { cohort: { id: source.id, label: 'x' }, steps: [{ kind: 'a' }], rules: [] };
  const r = retargetForTest(loaded, t);
  assert.deepEqual([r.cohort.id, r.cohort.isTest, r.cohort.sourceCohortId], [t.id, true, source.id]);
  assert.equal(r.steps, loaded.steps);
  assert.equal(loaded.cohort.id, source.id);
  assert.equal(retargetForTest(null, t), null);
});

test('isTestCohortId : seuls les identifiants « test-… » bien formés', () => {
  for (const ok of ['test-webinar-2026-10-08', 'test-abc', 'test-a1-b2-c3']) assert.equal(isTestCohortId(ok), true, ok);
  for (const ko of ['webinar-2026-10-08', 'test-', 'test-a', 'TEST-abc', 'test-_x_', 'test-abc def', '', null, undefined, 12, 'xtest-abc', 'test-' + 'a'.repeat(62)]) assert.equal(isTestCohortId(ko), false, String(ko));
});

// ───────────── publication vers la landing (étape « envoi réel ») ─────────────
test('normalizeVersion : published vrai / faux / inconnu, motif de l\'échec', () => {
  const base = { cohort_id: 'webinar-2026-10-08', kind: 'email_j7', version: 2, subject: 'S', html: '<p>x</p>' };
  assert.equal(normalizeVersion({ ...base, published: true }).published, true);
  assert.equal(normalizeVersion({ ...base, published: false, publish_error: 'timeout 5.0s' }).published, false);
  assert.equal(normalizeVersion({ ...base, published: false, publish_error: 'timeout 5.0s' }).publish_error, 'timeout 5.0s');
  for (const odd of [undefined, null, 'true', 1, 0, {}]) assert.equal(normalizeVersion({ ...base, published: odd }).published, null, String(odd));
  assert.equal(normalizeVersion(base).publish_error, null);
});

test('applySaved : l\'étape porte l\'état de publication de la version enregistrée', () => {
  const s = step();
  assert.equal(applySaved(s, saved({ published: true })).savedPublished, true);
  const off = applySaved(s, saved({ published: false, publish_error: 'upstream 502' }));
  assert.equal(off.savedPublished, false);
  assert.equal(off.publishError, 'upstream 502');
  assert.equal(applySaved(s, saved()).savedPublished, null);
});

test('normalizeSavedPayload : l\'état de publication de chaque e-mail traverse la lecture de la liste', () => {
  const v = (published) => ({ cohort_id: 'webinar-2026-10-08', kind: 'email_j7', version: 4, subject: 'S', html: '<p>x</p>', published });
  assert.equal(normalizeSavedPayload({ emails: { 'webinar-2026-10-08': { email_j7: v(true) } } }).emails['webinar-2026-10-08'].email_j7.published, true);
  assert.equal(normalizeSavedPayload({ emails: { 'webinar-2026-10-08': { email_j7: v(false) } } }).emails['webinar-2026-10-08'].email_j7.published, false);
  assert.equal(normalizeSavedPayload({ emails: { 'webinar-2026-10-08': { email_j7: v(null) } } }).emails['webinar-2026-10-08'].email_j7.published, null);
});

test('normalizeRepublishResponse : jamais « publié » sur un doute', () => {
  assert.deepEqual(normalizeRepublishResponse({ cohort_id: 'c', kind: 'k', version: 3, published: true }), { published: true, version: 3 });
  for (const bad of [null, undefined, {}, { published: false, version: 3 }, { published: 'true', version: 3 }, { published: true }, { published: true, version: 0 }, { published: true, version: '3' }, 'ok', []]) {
    assert.equal(normalizeRepublishResponse(bad), null, JSON.stringify(bad));
  }
});

test('describePublishError : un message clair par cas, jamais un faux « enregistré »', () => {
  const err = (status, detail) => ({ status, data: detail === undefined ? undefined : { detail } });
  assert.match(describePublishError({}), /Connexion impossible/);
  assert.match(describePublishError(err(401)), /session a expiré/);
  assert.match(describePublishError(err(403)), /rôle/);
  assert.match(describePublishError(err(404)), /Aucune version/);
  assert.match(describePublishError(err(409)), /pas publiée/);
  assert.equal(describePublishError(err(502, { message: 'La landing n\'a pas accepté la version', publish_error: 'upstream 422: lien de désinscription absent' })), 'La landing n\'a pas accepté la version : upstream 422: lien de désinscription absent');
  assert.match(describePublishError(err(502)), /n'a pas accepté la version\./);
  assert.match(describePublishError(err(500)), /erreur 500/);
  // Aucun message d'erreur ne peut passer pour un succès (« Version 3 enregistrée / publiée… »).
  for (const status of [0, 401, 403, 404, 409, 500, 502]) assert.doesNotMatch(describePublishError(status ? err(status) : {}), /^Version \d+|succès|a bien été/i);
});

test('normalizeSavedPayload : les cohortes historiques viennent du serveur, filtrées', () => {
  assert.deepEqual(normalizeSavedPayload({ historical_cohorts: ['webinar-2026-05-26', 'test-x', 42, null, 'webinar-2026-06-22', '__proto__'] }).historicalCohorts, ['webinar-2026-05-26', 'webinar-2026-06-22']);
  for (const odd of [undefined, null, 'webinar-2026-05-26', {}, 3]) assert.deepEqual(normalizeSavedPayload({ historical_cohorts: odd }).historicalCohorts, []);
});

test('publishesToLanding : ni une cohorte de test, ni une cohorte historique, ni une cohorte inconnue', () => {
  const hist = ['webinar-2026-05-26', 'webinar-2026-06-22', 'webinar-2026-07-20'];
  assert.equal(publishesToLanding({ id: 'webinar-2026-10-08' }, hist), true);
  assert.equal(publishesToLanding({ id: 'webinar-2026-09-21' }, []), true);
  assert.equal(publishesToLanding({ id: 'webinar-2026-05-26' }, hist), false);
  assert.equal(publishesToLanding({ id: 'test-webinar-2026-10-08', isTest: true }, hist), false);
  assert.equal(publishesToLanding({ id: 'webinar-2026-10-08', isTest: true }, []), false);
  for (const bad of [undefined, null, {}, { id: 5 }]) assert.equal(publishesToLanding(bad, hist), false);
  assert.equal(publishesToLanding({ id: 'webinar-2026-10-08' }), true);
});
