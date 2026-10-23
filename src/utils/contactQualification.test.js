import test from 'node:test';
import assert from 'node:assert/strict';
import {contactQualificationPatch, CALLBACK_NOTE_MAX, CALLBACK_RULE_HELP, CALLBACK_SHIFTS_MAX, recallInPast, recallNote, recallRuleFrozen, recallRuleNote, recallWhen} from './contactQualification.js';
const lead = {id: 1, status: 'new', email: 'fixture@example.invalid'};
const patch = (values, category = 'new', source = lead) => contactQualificationPatch(source, category, values, '2026-09-22');
test('contact outcomes preserve the existing statuses and create no appointments', () => {
  for (const [result, status] of [['voicemail','voicemail'],['not_relevant','not_relevant'],['not_processable','not_relevant'],['unreachable','unreachable']]) {
    assert.deepEqual(patch({result, date:'2026-09-24T10:00'}), {first_contact_date:'2026-09-22', contact_result:result, status});
  }
  assert.deepEqual(patch({result:'reached',next:'callback'}), {first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'no_appointment',status:'callback'});
  assert.deepEqual(patch({result:'reached',next:'not_interested'}), {first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'not_interested',status:'not_relevant'});
});
test('only the explicitly selected appointment is created, never a fictitious R1 for a direct R2', () => {
  for (const next of ['r1','r2']) assert.deepEqual(patch({result:'reached',next,date:'2026-09-24T10:35'}), {
    first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'appointment_set',status:next,[`${next}_date`]:'2026-09-24T10:35',
  });
});
test('missing/invalid dates, Paris spring gap and missing email cannot schedule a meeting', () => {
  for (const date of ['', '2026-09-24', '2026-02-30T10:00', '2027-03-28T02:30']) assert.throws(() => patch({result:'reached',next:'r1',date}));
  assert.throws(() => patch({result:'reached',next:'r2',date:'2026-09-24T10:00'},'new',{...lead,email:''}));
  assert.throws(() => patch({result:'reached',next:'r1',date:'2026-09-24T10:00'},'new',{...lead,email:'  '}));
});
test('recontact attempts preserve the original first contact, tab and backend call hook', () => {
  for (const category of ['callback','voicemail']) for (const values of [{result:'voicemail'}, {result:'reached',next:'callback'}]) {
    assert.deepEqual(patch(values, category, {...lead,call_attempts:3,first_contact_date:'2026-08-01T09:00:00'}), {
      first_contact_date:'2026-08-01', call_attempts:4, status:category,
    });
  }
});
test('a reminder carries only its date, and cannot manufacture appointments', () => {
  assert.deepEqual(patch({result:'to_recontact',date:'2026-10-02'}), {first_contact_date:'2026-09-22',status:'to_recontact',recontact_date:'2026-10-02'});
  for (const date of ['', '2026-02-30','2026-10-02T09:00']) assert.throws(() => patch({result:'to_recontact',date}));
});
test('unknown choices or an incompatible stage cannot change the pipeline', () => {
  assert.throws(() => patch({result:''}));
  assert.throws(() => patch({result:'reached',next:'contract'}));
  assert.throws(() => patch({result:'reached',next:'r1',date:'2026-09-24T10:00'},'signed'));
});
// « À rappeler » daté (ajout additif) : la date, l'heure et la description choisies voyagent ensemble dans la même requête.
const NOW = new Date('2026-09-22T08:00:00Z');                                  // mardi 22/09/2026, 10 h à Paris (heure d'été)
const dated = (values, category = 'new', source = lead) => contactQualificationPatch(source, category, values, '2026-09-22', NOW);
test('a dated callback carries its date and its description, and still moves nowhere else', () => {
  assert.deepEqual(dated({result:'reached',next:'callback',date:'2026-09-24T14:30',note:'  Rappeler après sa réunion  '}), {
    first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'no_appointment',status:'callback',
    callback_at:'2026-09-24T14:30',callback_description:'Rappeler après sa réunion',
  });
  // Sans description : chaîne vide, jamais d'absence de clé (un nouveau rappel n'hérite pas de l'ancien texte).
  assert.equal(dated({result:'reached',next:'callback',date:'2026-09-24T14:30'}).callback_description, '');
  assert.equal(dated({result:'reached',next:'callback',date:'2026-09-24T14:30',note:null}).callback_description, '');
});
test('a callback date must be a real Paris time in the future, to the minute', () => {
  for (const date of ['2026-09-22T10:00', '2026-09-22T09:59', '2026-09-21T18:00', '2026-02-30T10:00', '2026-09-24', '2027-03-28T02:30', 'demain'])
    assert.throws(() => dated({result:'reached',next:'callback',date}), /rappel/);
  assert.doesNotThrow(() => dated({result:'reached',next:'callback',date:'2026-09-22T10:01'}));
});
test('the description is trimmed and capped, and only a callback ever reads it', () => {
  assert.equal(dated({result:'reached',next:'callback',date:'2026-09-24T14:30',note:'x'.repeat(900)}).callback_description.length, CALLBACK_NOTE_MAX);
  for (const values of [{result:'voicemail'}, {result:'not_relevant'}, {result:'to_recontact',date:'2026-10-02'}, {result:'reached',next:'not_interested'}, {result:'reached',next:'r1',date:'2026-09-24T10:35'}]) {
    const out = dated({...values, note:'à ne pas envoyer'});
    assert.ok(!('callback_at' in out) && !('callback_description' in out), JSON.stringify(out));
  }
});
test('a dated callback on a lead already being recontacted still only adds an attempt, in the same tab', () => {
  for (const category of ['callback','voicemail']) {
    assert.deepEqual(dated({result:'reached',next:'callback',date:'2026-09-24T14:30',note:'Dossier à préparer'}, category, {...lead,call_attempts:3,first_contact_date:'2026-08-01T09:00:00'}), {
      first_contact_date:'2026-08-01', call_attempts:4, status:category, callback_at:'2026-09-24T14:30', callback_description:'Dossier à préparer',
    });
  }
  // Un répondeur de plus ne porte jamais de rappel, même si une date traîne dans la requête.
  assert.deepEqual(dated({result:'voicemail',date:'2026-09-24T14:30',note:'x'}, 'callback', {...lead,call_attempts:1}), {first_contact_date:'2026-09-22', call_attempts:2, status:'callback'});
});
test('without a date the callback is exactly what it was before this addition', () => {
  assert.deepEqual(dated({result:'reached',next:'callback',date:'',note:'ignoré'}), {first_contact_date:'2026-09-22',contact_result:'reached',appointment_result:'no_appointment',status:'callback'});
});
test('the window can tell a past callback time before saving, and never cries wolf on an incomplete date', () => {
  assert.equal(recallInPast('2026-09-22T09:59', NOW), true);
  assert.equal(recallInPast('2026-09-22T10:00', NOW), true);
  assert.equal(recallInPast('2026-09-22T10:01', NOW), false);
  assert.equal(recallInPast('2026-09-23T00:00', NOW), false);
  for (const incomplete of ['', null, undefined, '2026-09-22', '2026-02-30T10:00']) assert.equal(recallInPast(incomplete, NOW), false);
});
test('a saved callback is read as written, in Paris wall-clock time, with no timezone shift', () => {
  // le serveur renvoie l'heure de Paris étiquetée UTC : 16h15 reste 16h15, quel que soit le fuseau du navigateur
  for (const stored of ['2026-10-19T16:15:00+00:00', '2026-10-19T16:15:00Z', '2026-10-19T16:15', '2026-10-19 16:15:00']) assert.equal(recallWhen(stored), 'lundi 19 octobre à 16h15');
  assert.equal(recallWhen('2026-03-29T09:00:00+00:00'), 'dimanche 29 mars à 09h00');
  assert.equal(recallWhen('2026-12-31T23:59:00+00:00'), 'jeudi 31 décembre à 23h59');
});
test('an unreadable callback reads as nothing rather than a wrong date', () => {
  for (const value of ['', null, undefined, 'bientôt', '2026-10-19', '19/10/2026 16:15', 42]) assert.equal(recallWhen(value), '');
  for (const value of ['2026-13-45T10:00:00+00:00', '2026-02-30T10:00:00+00:00', '2026-10-19T25:00:00+00:00', '2026-10-19T10:61:00+00:00']) assert.equal(recallWhen(value), '');
});
// La description d'un rappel daté s'affiche dans la carte « Note » de la fiche : elle est lue telle que saisie, sans rien inventer pour les anciens rappels.
test('the note of a dated callback is its description, trimmed, and nothing else', () => {
  const saved = {callback_at: '2026-10-19T16:15:00+00:00', callback_description: '  Rappeler après sa réunion\n- tarif du pack  '};
  assert.equal(recallNote(saved), 'Rappeler après sa réunion\n- tarif du pack');
  assert.equal(recallNote({...saved, callback_description: 'Court'}), 'Court');
  for (const empty of ['', '   ', '\n']) assert.equal(recallNote({...saved, callback_description: empty}), '', JSON.stringify(empty));   // date posée sans texte : pas de note
});
test('an old callback, an unreadable date or no lead at all has no note, so nothing new shows on existing data', () => {
  const text = 'Rappeler plus tard';
  assert.equal(recallNote({callback_at: '2026-10-19T16:15:00+00:00'}), '');                              // ancien rappel : aucune description enregistrée
  assert.equal(recallNote({callback_at: '2026-10-19T16:15:00+00:00', callback_description: null}), '');
  for (const callback_at of [null, undefined, '', 'bientôt', '2026-02-30T10:00:00+00:00']) assert.equal(recallNote({callback_at, callback_description: text}), '', String(callback_at));
  for (const missing of [null, undefined, {}]) assert.equal(recallNote(missing), '');
});
// Règle des 3 jours : 4 réaffectations décalent la règle, la mention n'apparaît qu'ensuite et seulement pour un rappel daté.
test('the 3-day rule is announced as frozen only once 4 reassignments are done, for a dated callback', () => {
  assert.equal(CALLBACK_SHIFTS_MAX, 4);                                          // miroir de MAX_SHIFTS côté serveur
  const dated = shifts => ({callback_description: 'Rappeler', callback_shifts: shifts});
  for (const shifts of [0, 1, 2, 3]) assert.equal(recallRuleFrozen(dated(shifts)), false, `shifts=${shifts}`);
  for (const shifts of [4, 5, 9, 99, '4']) assert.equal(recallRuleFrozen(dated(shifts)), true, `shifts=${shifts}`);
  assert.equal(recallRuleFrozen({callback_description: '', callback_shifts: 4}), true);       // description vide mais rappel daté
});
test('an old callback, a lead without series or an unreadable counter never shows the rule note', () => {
  for (const lead of [null, undefined, {}, {callback_description: null, callback_shifts: 7}, {callback_description: 'x'}, {callback_description: 'x', callback_shifts: null},
                      {callback_description: 'x', callback_shifts: 'beaucoup'}, {callback_description: 'x', callback_shifts: undefined}]) {
    assert.equal(recallRuleFrozen(lead), false, JSON.stringify(lead));
    assert.equal(recallRuleNote(lead), '', JSON.stringify(lead));
  }
});
test('the rule note states the real count and the 3-day rule in plain words, on one short line', () => {
  assert.equal(recallRuleNote({callback_description: 'x', callback_shifts: 4}), 'Rappel déjà réaffecté 4 fois : la règle des 3 jours s’appliquera.');
  assert.match(recallRuleNote({callback_description: 'x', callback_shifts: 7}), /réaffecté 7 fois/);
  assert.equal(recallRuleNote({callback_description: 'x', callback_shifts: 3}), '');
  assert.ok(recallRuleNote({callback_description: 'x', callback_shifts: 12}).length <= 70, 'doit tenir sur la ligne du libellé de la fenêtre');
  assert.match(CALLBACK_RULE_HELP, /règle des 3 jours ne sera plus décalée/);
});
test('the request never carries the counter: the server alone decides what a new date shifts', () => {
  const out = dated({result: 'reached', next: 'callback', date: '2026-09-24T14:30', note: 'x'}, 'callback', {...lead, call_attempts: 1, callback_shifts: 9, callback_rule_at: '2026-09-23T10:00'});
  assert.ok(!('callback_shifts' in out) && !('callback_rule_at' in out), JSON.stringify(out));
});
