// src/components/sequenceMail/model.test.js
//
// Règles métier du mini client : `node --test src/components/sequenceMail/model.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audienceTone, delayBetween, describeTiming, emailKey, fallbackStep, neighborsOf, parseKey, reuseStable,
  shortRelative, stepStatus, titleOf,
} from './model.js';

const NOW = Date.parse('2026-10-02T12:00:00+02:00');
const cal = (at) => ({ timing: { mode: 'calendar', at } });
const flat = (s) => s.replace(/[\u00a0\u202f]/g, ' ');

// ── clés, titres, public ─────────────────────────────────────────────────────

test('emailKey / parseKey font l\'aller-retour', () => {
  const key = emailKey('webinar-2026-10-08', 'email_confirmation');
  assert.deepEqual(parseKey(key), { cohortId: 'webinar-2026-10-08', kind: 'email_confirmation' });
  assert.deepEqual(parseKey('sans-separateur'), { cohortId: '', kind: 'sans-separateur' });
  assert.deepEqual(parseKey('a::b::c'), { cohortId: 'a', kind: 'b::c' });
  assert.deepEqual(parseKey(null), { cohortId: '', kind: 'null' });
});

test('audienceTone : gris quand le public est inconnu', () => {
  assert.equal(audienceTone(null), 'grey');
  assert.equal(audienceTone(undefined), 'grey');
  assert.equal(audienceTone(''), 'grey');
  assert.equal(audienceTone('Ambulances'), 'green');
  assert.equal(audienceTone('TPE/PME'), 'blue');
});

test('titleOf : objet, « (sans objet) » avec un corps, sinon le type', () => {
  assert.equal(titleOf({ subject: 'Bonjour', kind: 'k' }), 'Bonjour');
  assert.equal(titleOf({ subject: '', hasContent: true, kind: 'k' }), '(sans objet)');
  assert.equal(titleOf({ subject: '', hasContent: false, kind: 'email_x' }), 'email_x');
  assert.equal(titleOf({ subject: '', html: '<p>x</p>', kind: 'k' }), '(sans objet)'); // une étape
  assert.equal(titleOf({ subject: '', text: '', kind: 'email_y' }), 'email_y');
  assert.equal(titleOf(null), '');
});

// ── statuts ──────────────────────────────────────────────────────────────────

test('stepStatus : compteurs jamais demandés = notloaded (et non « Chargement… »)', () => {
  const step = { kind: 'k', timing: {} };
  assert.equal(stepStatus(step, undefined, NOW).key, 'notloaded');
  assert.equal(stepStatus(step, null, NOW).key, 'notloaded');
  assert.equal(stepStatus(step, { status: 'idle' }, NOW).key, 'notloaded');
  assert.match(stepStatus(step, undefined, NOW).label, /ouvrez la cohorte/);
});

test('stepStatus : loading seulement pour un premier relevé en vol', () => {
  const step = { kind: 'k', timing: {} };
  assert.equal(stepStatus(step, { status: 'loading', fetchedAt: null, byKind: {} }, NOW).key, 'loading');
  assert.equal(stepStatus(step, { status: 'loading', byKind: {} }, NOW).key, 'loading');
});

test('stepStatus : pendant un nouveau relevé, les statuts du dernier succès sont gardés', () => {
  const step = { kind: 'k', timing: {} };
  const byKind = { k: { sent: 10, pending: 0, failed: 0 } };
  assert.equal(stepStatus(step, { status: 'loading', fetchedAt: NOW - 90000, byKind }, NOW).key, 'sent');
  assert.equal(stepStatus(step, { status: 'ready', fetchedAt: NOW, byKind }, NOW).key, 'sent');
});

test('stepStatus : échec ou cohorte absente du CRM = statut indisponible', () => {
  const step = { kind: 'k', timing: {} };
  assert.equal(stepStatus(step, { status: 'error', fetchedAt: NOW - 1000, byKind: { k: { sent: 5 } } }, NOW).key, 'unknown');
  assert.equal(stepStatus(step, { status: 'unavailable', byKind: {} }, NOW).key, 'unknown');
});

test('stepStatus : envoyé / en cours / planifié / à venir / aucun envoi', () => {
  const ready = (k) => ({ status: 'ready', fetchedAt: NOW, byKind: { k } });
  const step = { kind: 'k', timing: {} };
  assert.equal(stepStatus(step, ready({ sent: 3, pending: 0, failed: 0 }), NOW).key, 'sent');
  assert.equal(stepStatus(step, ready({ sent: 3, pending: 2, failed: 0 }), NOW).key, 'sending');
  assert.equal(stepStatus(step, ready({ sent: 0, pending: 4, failed: 0 }), NOW).key, 'scheduled');
  assert.equal(stepStatus(step, ready({ sent: 0, pending: 0, failed: 2 }), NOW).key, 'idle');
  const future = { kind: 'k', timing: { mode: 'calendar', at: '2026-10-08T11:00:00+02:00' } };
  assert.equal(stepStatus(future, { status: 'ready', fetchedAt: NOW, byKind: {} }, NOW).key, 'upcoming');
  const past = { kind: 'k', timing: { mode: 'calendar', at: '2026-09-08T11:00:00+02:00' } };
  assert.equal(stepStatus(past, { status: 'ready', fetchedAt: NOW, byKind: {} }, NOW).key, 'idle');
});

test('stepStatus : un même statut est toujours le même objet figé (e-mails dérivés stables)', () => {
  const stats = { status: 'ready', fetchedAt: NOW, byKind: { a: { sent: 1 }, b: { sent: 2 } } };
  const sa = stepStatus({ kind: 'a', timing: {} }, stats, NOW);
  const sb = stepStatus({ kind: 'b', timing: {} }, stats, NOW);
  assert.equal(sa, sb);
  assert.ok(Object.isFrozen(sa));
  assert.deepEqual(Object.keys(sa).sort(), ['key', 'label', 'tone']);
});

// ── délais entre étapes ──────────────────────────────────────────────────────

test('delayBetween : calendrier', () => {
  assert.equal(delayBetween(cal('2026-05-21T16:30:00+02:00'), cal('2026-05-22T11:00:00+02:00')), '18 h 30 min');
  assert.equal(delayBetween(cal('2026-05-21T16:30:00+02:00'), cal('2026-05-25T00:00:00+02:00')), '3 j 7 h');
});

test('delayBetween : jamais « NaN », dates invalides = null', () => {
  assert.equal(delayBetween(cal('n\'importe quoi'), cal('2026-05-22T11:00:00+02:00')), null);
  assert.equal(delayBetween(cal('2026-05-22T11:00:00+02:00'), cal(undefined)), null);
  assert.equal(delayBetween({ timing: { mode: 'signup-days', days: 'x' } }, { timing: { mode: 'signup-days', days: 2 } }), null);
  assert.equal(delayBetween({ timing: { mode: 'signup-delay', minutes: undefined } }, { timing: { mode: 'signup-delay', minutes: 3 } }), null);
});

test('delayBetween : un ordre inversé n\'est pas présenté comme un délai positif', () => {
  assert.equal(delayBetween(cal('2026-05-22T11:00:00+02:00'), cal('2026-05-21T16:30:00+02:00')), null);
});

test('delayBetween : signup-days à la même heure = nombre de jours', () => {
  const j = (days, time) => ({ timing: { mode: 'signup-days', days, time } });
  assert.equal(delayBetween(j(1, '11:00'), j(2, '11:00')), '1 j');
  assert.equal(delayBetween(j(1, '11:00'), j(4, '11:00')), '3 j');
  assert.equal(delayBetween(j(1), j(2)), '1 j');
});

test('delayBetween : signup-days tient compte de l\'heure (J+1 11h → J+2 9h = 22 h, pas « 1 j »)', () => {
  const j = (days, time) => ({ timing: { mode: 'signup-days', days, time } });
  assert.equal(delayBetween(j(1, '11:00'), j(2, '09:00')), '22 h');
  assert.equal(delayBetween(j(1, '11:00'), j(2, '13:30')), '1 j 2 h'); // 26 h 30 min : les minutes ne s'affichent pas au-delà d'un jour
});

test('delayBetween : signup-delay en durée lisible, pas en minutes brutes', () => {
  const d = (minutes) => ({ timing: { mode: 'signup-delay', minutes } });
  assert.equal(delayBetween(d(2), d(3)), '1 min');
  assert.equal(delayBetween(d(2), d(1442)), '1 j');
  assert.equal(delayBetween(d(0), d(90)), '1 h 30 min');
});

test('delayBetween : paced reprend l\'intervalle du libellé ; modes différents = null', () => {
  const p = (label) => ({ timing: { mode: 'paced', label } });
  const label = 'Espacé de 8 à 48 h après l\'inscription (jusqu\'au 22/06 16h00)';
  assert.equal(delayBetween(p(label), p(label)), '8 à 48 h');
  assert.equal(delayBetween(p('Espacé après l\'inscription'), p('Espacé après l\'inscription')), null);
  assert.equal(delayBetween(p(label), cal('2026-06-22T20:00:00+02:00')), null);
  assert.equal(delayBetween(null, p(label)), null);
});

// ── description du moment d'envoi ────────────────────────────────────────────

test('describeTiming : calendar', () => {
  const t = describeTiming({ sequence: 'pre', timing: { mode: 'calendar', at: '2026-10-05T11:00:00+02:00', label: 'rappel' } }, '2026-10-08T20:00:00+02:00', NOW);
  assert.equal(t.when, 'lundi 5 octobre 2026 à 11:00');
  assert.equal(t.weekday, 'lundi');
  assert.equal(t.note, 'rappel');
  assert.equal(t.relation, 'J-3 · 3 jours avant le live');
  assert.match(flat(t.short), /^lun\.? 5 oct\.?, 11:00$/);
});

test('describeTiming : signup-days (« avant le live » seulement pour une séquence pré-webinaire)', () => {
  const step = { sequence: 'pre', timing: { mode: 'signup-days', days: 1, time: '11:00', label: 'J+1 après l\'inscription · 11h00' } };
  const t = describeTiming(step, null, NOW);
  assert.equal(t.when, 'J+1 après l\'inscription · 11h00');
  assert.equal(t.relation, '1 jour après l\'inscription, avant le live');
  assert.equal(t.note, 'Date propre à chaque inscrit');
  assert.equal(t.short, 'J+1 · 11h00');
  const post = describeTiming({ ...step, sequence: 'post', timing: { ...step.timing, days: 3 } }, null, NOW);
  assert.equal(post.relation, '3 jours après l\'inscription');
});

test('describeTiming : signup-delay', () => {
  const t = describeTiming({ timing: { mode: 'signup-delay', minutes: 2, label: '2 min après l\'inscription' } }, null, NOW);
  assert.equal(t.when, '2 min après l\'inscription');
  assert.equal(t.relation, '2 min après l\'inscription');
  assert.equal(t.short, '+2 min');
});

test('describeTiming : paced n\'est plus « Dès l\'inscription »', () => {
  const label = 'Espacé de 8 à 48 h après l\'inscription (jusqu\'au 22/06 16h00)';
  const t = describeTiming({ timing: { mode: 'paced', label } }, null, NOW);
  assert.equal(t.when, label);
  assert.equal(t.relation, label);
  assert.equal(t.short, 'Espacé 8 à 48 h');
  assert.ok(!JSON.stringify(t).includes('Dès l\'inscription'));
});

test('describeTiming : mode inconnu = rien, aucun texte inventé', () => {
  for (const step of [{ timing: { mode: 'unknown' } }, { timing: {} }, {}, { timing: { mode: 'zzz' } }]) {
    assert.deepEqual(describeTiming(step, null, NOW), { when: '', note: '', relation: '', weekday: '', short: '' });
  }
});

test('shortRelative', () => {
  assert.equal(shortRelative({ mode: 'signup-days', days: 2, time: '11:00' }), 'J+2 · 11h00');
  assert.equal(shortRelative({ mode: 'signup-days', days: 2 }), 'J+2');
  assert.equal(shortRelative({ mode: 'signup-delay', minutes: 3 }), '+3 min');
  assert.equal(shortRelative({ mode: 'signup-delay', minutes: 'x' }), '');
  assert.equal(shortRelative({ mode: 'paced', label: 'Espacé de 8 à 48 h après l\'inscription' }), 'Espacé 8 à 48 h');
  assert.equal(shortRelative({ mode: 'paced', label: 'Espacé' }), 'Espacé');
  assert.equal(shortRelative({ mode: 'unknown' }), '');
  assert.equal(shortRelative(undefined), '');
});

// ── voisins, étapes synthétisées, stabilité ──────────────────────────────────

test('neighborsOf suit la séquence et le segment', () => {
  const steps = [
    { kind: 'a', sequence: 'pre', segment: null },
    { kind: 'b', sequence: 'post', segment: 'missed' },
    { kind: 'c', sequence: 'pre', segment: null },
    { kind: 'd', sequence: 'post', segment: 'missed' },
  ];
  assert.deepEqual(neighborsOf(steps, steps[0]), { prev: null, next: steps[2] });
  assert.deepEqual(neighborsOf(steps, steps[3]), { prev: steps[1], next: null });
});

test('fallbackStep : marquée `fallback: true`, sans contenu ni date inventés', () => {
  const s = fallbackStep('email_post_relance', 2, 5);
  assert.equal(s.fallback, true);
  assert.equal(s.kind, 'email_post_relance');
  assert.equal(s.order, 3);
  assert.equal(s.sequenceIndex, 3);
  assert.equal(s.sequenceCount, 5);
  assert.equal(s.phase, 'post');
  assert.equal(fallbackStep('email_marc_story').phase, 'nurture');
  assert.deepEqual(s.timing, { mode: 'unknown' });
  assert.equal(s.subject, '');
  assert.equal(s.text, '');
  assert.deepEqual(s.links, []);
});

test('reuseStable : les e-mails inchangés gardent leur identité', () => {
  const status = { key: 'sent' };
  const a = { key: 'c::a', subject: 'A', status };
  const b = { key: 'c::b', subject: 'B', status };
  const prev = [a, b];
  // rien n'a changé : le MÊME tableau revient
  assert.equal(reuseStable(prev, [{ ...a }, { ...b }]), prev);
  // un seul e-mail change : l'autre est réutilisé
  const next = reuseStable(prev, [{ ...a }, { ...b, subject: 'B2' }]);
  assert.notEqual(next, prev);
  assert.equal(next[0], a);
  assert.equal(next[1].subject, 'B2');
  // premier calcul / liste vide
  const fresh = [{ key: 'c::a' }];
  assert.equal(reuseStable(undefined, fresh), fresh);
  assert.equal(reuseStable([], fresh), fresh);
  // longueur différente
  assert.equal(reuseStable(prev, [{ ...a }]).length, 1);
});
