// Séquences de relance configurées par la finance : le modèle de l'écran (sequenceRules.js).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  audienceReady, blankRule, conditionFor, dayLabel, editable, euros, fieldGroups, insertAt, journey, payloadOf, renderTemplate, sampleValues,
  scheduleLabel, schedulePayload, signatureDraft, signatureMissing, smsShape, stepTiming, unknownVariables, variablesIn, withKind,
} from './sequenceRules.js';

const META = {
  fields: [
    { key: 'months', group: 'L’impayé', label: 'Impayé depuis', type: 'number', unit: 'mois', options: [] },
    { key: 'ever_paid', group: 'Les paiements', label: 'A déjà payé', type: 'bool', options: [] },
    { key: 'payment_mode', group: 'Les paiements', label: 'Modalité de paiement', type: 'enum', options: [{ value: 'MONTHLY', label: 'Mensuel' }, { value: 'YEARLY', label: 'Annuel' }] },
  ],
  operators: { number: [{ key: 'gte', label: 'au moins' }, { key: 'between', label: 'entre' }], bool: [{ key: 'is', label: 'est' }], enum: [{ key: 'in', label: 'est' }] },
  skips: [{ key: 'loss', label: 'Perte actée', locked: true }, { key: 'promise', label: 'Promesse de règlement en cours', locked: false }],
  variables: [{ key: 'societe', label: 'Nom de la société', sample: 'Société Exemple' }, { key: 'montant', label: 'Reste dû', sample: '369,60 €' }],
};

test('une nouvelle séquence part avec une condition, un SMS et tous les garde-fous cochés', () => {
  const rule = blankRule(META);
  assert.deepEqual(rule.definition, { match: 'all', conditions: [{ field: 'months', op: 'gte', value: '', value2: '' }] });
  assert.deepEqual(rule.skip, ['loss', 'promise']);
  assert.deepEqual(rule.steps, [{ channel: 'sms', delay_days: 0, subject: '', body: '' }]);
  assert.equal(rule.send_hour, 10);
  assert.equal(rule.repeat_after_days, null);
  assert.equal(rule.schedule.kind, 'daily');
});

test('le rythme : une seule fois, chaque jour, chaque semaine, chaque mois', () => {
  const weekdays = [{ key: 0, label: 'lundi' }, { key: 3, label: 'jeudi' }];
  assert.equal(scheduleLabel({ kind: 'daily' }, weekdays), 'Chaque jour ouvré');
  assert.equal(scheduleLabel({ kind: 'weekly', days: [0, 3] }, weekdays), 'Chaque lundi, jeudi');
  assert.equal(scheduleLabel({ kind: 'monthly', day: 5 }, weekdays), 'Le 5 de chaque mois');
  assert.equal(scheduleLabel({ kind: 'once', date: '2026-11-20' }, weekdays), 'Une seule fois, le 20 novembre');
  assert.equal(scheduleLabel({ kind: 'once', date: '' }, weekdays), 'Une seule fois, dès l’activation');
  assert.equal(dayLabel('2026-01-05'), '5 janvier');
  // Le serveur ne reçoit que ce qui sert au rythme choisi.
  const full = { kind: 'weekly', date: '2026-11-20', days: [3, 0], day: 5 };
  assert.deepEqual(schedulePayload(full), { kind: 'weekly', days: [0, 3] });
  assert.deepEqual(schedulePayload({ ...full, kind: 'monthly' }), { kind: 'monthly', day: 5 });
  assert.deepEqual(schedulePayload({ ...full, kind: 'once' }), { kind: 'once', date: '2026-11-20' });
  assert.deepEqual(schedulePayload({ ...full, kind: 'daily' }), { kind: 'daily' });
  // Chaque lundi ou chaque mois : un client toujours en retard la reçoit de nouveau ; une seule fois : jamais.
  const draft = blankRule(META);
  assert.deepEqual(withKind(draft, 'weekly'), { schedule: { ...draft.schedule, kind: 'weekly' }, repeat_after_days: 7 });
  assert.equal(withKind(draft, 'monthly').repeat_after_days, 28);
  assert.equal(withKind({ ...draft, repeat_after_days: 30 }, 'once').repeat_after_days, null);
  assert.deepEqual(payloadOf({ ...draft, name: 'Relance', ...withKind(draft, 'weekly') }).schedule, { kind: 'weekly', days: [0] });
});

test('les conditions sont rangées par thème, dans l’ordre du serveur', () => {
  assert.deepEqual(fieldGroups(META).map((g) => [g.name, g.fields.map((f) => f.key)]),
    [['L’impayé', ['months']], ['Les paiements', ['ever_paid', 'payment_mode']]]);
});

test('changer de champ remet la comparaison et la valeur du nouveau type', () => {
  assert.deepEqual(conditionFor(META, 'ever_paid'), { field: 'ever_paid', op: 'is', value: true, value2: '' });
  assert.deepEqual(conditionFor(META, 'payment_mode'), { field: 'payment_mode', op: 'in', value: ['MONTHLY'], value2: '' });
});

test('l’aperçu attend que chaque condition soit remplie', () => {
  const rule = blankRule(META);
  assert.equal(audienceReady(META, rule), false);
  rule.definition.conditions[0].value = '2';
  assert.equal(audienceReady(META, rule), true);
  rule.definition.conditions[0] = { field: 'months', op: 'between', value: '1', value2: '' };
  assert.equal(audienceReady(META, rule), false);
  rule.definition.conditions[0].value2 = '3,5';
  assert.equal(audienceReady(META, rule), true);
  rule.definition.conditions.push({ field: 'payment_mode', op: 'in', value: [] });
  assert.equal(audienceReady(META, rule), false);
  assert.equal(audienceReady(META, { definition: { conditions: [] } }), false);
});

test('ce qui part au serveur : le premier message sans délai, l’objet seulement pour un e-mail', () => {
  const draft = { ...blankRule(META), name: 'Impayés de deux mois', repeat_after_days: '30',
    steps: [{ channel: 'sms', delay_days: 5, subject: 'ignoré', body: 'Bonjour' }, { channel: 'email', delay_days: '3', subject: 'Impayé', body: 'Bonjour,' }] };
  const sent = payloadOf(draft, 'abc');
  assert.equal(sent.rule_id, 'abc');
  assert.deepEqual(sent.steps, [{ channel: 'sms', delay_days: 0, subject: null, body: 'Bonjour' }, { channel: 'email', delay_days: 3, subject: 'Impayé', body: 'Bonjour,' }]);
  assert.equal(sent.repeat_after_days, 30);
  assert.equal('rule_id' in payloadOf(draft), false);
});

test('une séquence relue du serveur redevient modifiable telle quelle', () => {
  const back = editable({ name: 'Relance', scope: 'owner', definition: { match: 'any', conditions: [{ field: 'months', op: 'gte', value: '2' }] },
    skip: ['loss'], steps: [{ channel: 'email', delay_days: 0, subject: null, body: 'Bonjour,' }], send_hour: 14, repeat_after_days: 60,
    schedule: { kind: 'once', date: null } }, META);
  assert.equal(back.definition.match, 'any');
  assert.equal(back.definition.conditions[0].value2, '');
  assert.equal(back.steps[0].subject, '');
  assert.deepEqual([back.scope, back.send_hour, back.repeat_after_days, back.skip], ['owner', 14, 60, ['loss']]);
  assert.deepEqual(back.schedule, { kind: 'once', date: '', days: [0], day: 5 });
});

test('les variables sont remplacées, et une variable inconnue est signalée', () => {
  const values = sampleValues(META, null);
  assert.equal(renderTemplate('{{ societe }} doit {{montant}}. {{inconnu}}', values), 'Société Exemple doit 369,60 €. ');
  assert.deepEqual(variablesIn('{{montant}} {{ Societe }}', '{{montant}}'), ['montant', 'societe']);
  assert.deepEqual(unknownVariables(META, 'Bonjour {{prenom}}', '{{montant}}'), ['prenom']);
  assert.deepEqual(sampleValues(META, { sample: { values: { societe: 'Vraie société' } } }), { societe: 'Vraie société' });
});

test('la longueur d’un SMS est comptée comme chez l’opérateur', () => {
  assert.deepEqual(smsShape('a'.repeat(160)), { length: 160, parts: 1, unicode: false, odd: [] });
  assert.equal(smsShape('a'.repeat(161)).parts, 2);
  assert.equal(smsShape('Montant : 100 €').length, 16);
  const odd = smsShape('Merci de régulariser, ça presse.');
  assert.deepEqual([odd.unicode, odd.odd, odd.parts], [true, ['ç'], 1]);
  assert.equal(smsShape('ê'.repeat(71)).parts, 2);
});

test('une variable s’insère à l’endroit du curseur', () => {
  assert.deepEqual(insertAt('Vous devez .', 11, 11, '{{montant}}'), { text: 'Vous devez {{montant}}.', caret: 22 });
  assert.deepEqual(insertAt('abc', undefined, undefined, 'X'), { text: 'abcX', caret: 4 });
  assert.deepEqual(insertAt('abcdef', 1, 4, 'X'), { text: 'aXef', caret: 2 });
});

test('le parcours se lit en jours depuis l’entrée', () => {
  const steps = [{ channel: 'sms', delay_days: 0 }, { channel: 'email', delay_days: 3 }, { channel: 'sms', delay_days: 7 }];
  assert.deepEqual(journey(steps).map((s) => [s.label, s.day]), [['SMS', 0], ['E-mail', 3], ['SMS', 10]]);
  assert.equal(stepTiming(steps[0], 0), 'Part dès que le client entre dans la séquence');
  assert.equal(stepTiming(steps[1], 1), 'Part 3 jours après le message précédent');
  assert.equal(stepTiming({ delay_days: 1 }, 1), 'Part 1 jour après le message précédent');
});

test('les montants s’écrivent à la française', () => {
  assert.equal(euros(260).replace(/\s/g, ' '), '260 €');
  assert.equal(euros(1234.5).replace(/\s/g, ' '), '1 234,50 €');
});

test('la signature : le formulaire part du compte et dit ce qui manque', () => {
  assert.deepEqual(signatureDraft(null), { full_name: '', title: '', phone: '', email: '' });
  const form = signatureDraft({ full_name: 'Camille Test', title: '', phone: null, email: 'camille@owner.test', photo_url: 'x' });
  assert.deepEqual(form, { full_name: 'Camille Test', title: '', phone: '', email: 'camille@owner.test' });
  assert.equal(signatureMissing(form), 'Indiquez votre titre.');
  assert.equal(signatureMissing({ ...form, title: 'Chargée de facturation' }), null);
  assert.equal(signatureMissing({ ...form, title: 'Chargée de facturation', email: 'camille' }), 'Indiquez une adresse e-mail valide.');
  assert.equal(signatureMissing({ ...form, full_name: ' ' }), 'Indiquez votre prénom et votre nom.');
  const draft = blankRule(META);
  assert.equal(draft.signature_user_id, null);
  assert.equal(payloadOf({ ...draft, signature_user_id: 'abc' }).signature_user_id, 'abc');
});
