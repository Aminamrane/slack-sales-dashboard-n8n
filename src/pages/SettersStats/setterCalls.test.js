import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STATE_TONES, STATE_TONES_DARK, TAG_TONES, TAG_TONES_DARK, callDetails, callLabel, callRows, callTimeline, callTimes, callTitle, dayKey, entryFacts,
  fmtCallAt, fmtClock, fmtDayLabel, fmtDayLong, fmtDayMonth, fmtGap, fmtHourPadded, fmtPlayTime, fmtTalkSeconds, fmtTotal, lastTags, lineOf, noteOf,
  ordinal, overviewOf, parisWallToMs, prospectCallsPath, rdvCallsView, recordedOf, tagCounts, tagLabel, tagTone, toneOf,
} from './setterCalls.js';

// Réponse RÉELLE du backend (code de app/services/setter_prospect_calls.py) sur des données fictives : le contrat entre les deux.
const sample = JSON.parse(readFileSync(new URL('./prospectCalls.sample.json', import.meta.url), 'utf8'));
const ready = { state: 'ready', data: sample };
const nbsp = (s) => s.replace(/[\u202f\u00a0]/g, ' ');
const lead1 = () => rdvCallsView(ready, 1).entry;

test('route of the calls API : one route, the setter\'s calls by prospect', () => {
  assert.equal(prospectCallsPath('abc-123'), '/api/v1/ceo-dashboard/setters/abc-123/prospect-calls');
  assert.equal(prospectCallsPath('a/b'), '/api/v1/ceo-dashboard/setters/a%2Fb/prospect-calls');
});

test('dates are Paris wall-clock, like the RDV of the sheet', () => {
  assert.equal(fmtCallAt('2026-10-22T12:05:00Z'), 'jeu. 22 oct. · 14 h 05');
  assert.equal(fmtCallAt('2026-10-22T18:00:00Z'), 'jeu. 22 oct. · 20 h');
  assert.equal(fmtCallAt('2026-10-25T10:30:00Z'), 'dim. 25 oct. · 11 h 30');            // heure d'hiver dès le 25/10 à 3 h
  assert.equal(fmtCallAt('2026-10-22T22:30:00Z'), 'ven. 23 oct. · 0 h 30');             // passé minuit à Paris : le jour de Paris
  assert.equal(fmtCallAt('pas une date'), '');
  assert.equal(fmtCallAt(null), '');
  assert.equal(fmtDayMonth('2026-09-21'), '21 sept.');
  assert.equal(fmtDayMonth('n/a'), '');
});

test('clock, day label and day key follow the Paris day', () => {
  assert.equal(fmtClock('2026-10-16T07:24:00Z'), '9 h 24');
  assert.equal(fmtClock('2026-10-22T18:00:00Z'), '20 h 00');                              // toujours les minutes dans la colonne des heures
  assert.equal(fmtClock('2026-10-22T22:30:00Z'), '0 h 30');
  assert.equal(fmtClock('x'), '');
  assert.equal(fmtDayLabel('2026-10-16T07:24:00Z'), 'ven. 16 oct.');
  assert.equal(fmtDayLabel(undefined), '');
  assert.equal(dayKey('2026-10-22T22:30:00Z'), '2026-10-23');                              // 0 h 30 à Paris : le jour suivant
  assert.equal(dayKey('2026-10-22T21:30:00Z'), '2026-10-22');
  assert.equal(dayKey('2026-10-25T23:30:00Z'), '2026-10-26');                              // après le passage à l'heure d'hiver
  assert.equal(dayKey(''), '');
});

test('durations are never invented', () => {
  assert.equal(fmtTalkSeconds(null), '–');
  assert.equal(fmtTalkSeconds(undefined), '–');
  assert.equal(fmtTalkSeconds(0), '0 s');
  assert.equal(fmtTalkSeconds(45), '45 s');
  assert.equal(fmtTalkSeconds(60), '1 min 00 s');
  assert.equal(fmtTalkSeconds(252), '4 min 12 s');
  assert.equal(fmtTalkSeconds(3725), '1 h 02 min');
  assert.equal(fmtTotal(null), '–');
  assert.equal(fmtTotal(0), '0 min');
  assert.equal(fmtTotal(3100), '52 min');
  assert.equal(fmtTotal(15480), '4 h 18');                                                // comme la tuile « Appels Allo » de la fiche
  assert.equal(fmtGap(null), '');
  assert.equal(fmtGap(-5), '');
  assert.equal(fmtGap(30), "moins d'1 min");
  assert.equal(fmtGap(720), '12 min');
  assert.equal(fmtGap(3600), '1 h');
  assert.equal(fmtGap(9480), '2 h 38');
  assert.equal(fmtGap(86400), '1 j');
  assert.equal(fmtGap(100800), '1 j 4 h');
  assert.equal(ordinal(1), '1er');
  assert.equal(ordinal(3), '3e');
});

test('an RDV wall-clock time of Paris becomes the right instant, summer and winter', () => {
  assert.equal(new Date(parisWallToMs('2026-10-22T14:05:00')).toISOString(), '2026-10-22T12:05:00.000Z');       // heure d'été (UTC+2)
  assert.equal(new Date(parisWallToMs('2026-10-26T14:05:00')).toISOString(), '2026-10-26T13:05:00.000Z');       // heure d'hiver (UTC+1)
  assert.equal(new Date(parisWallToMs('2026-10-25T01:30:00')).toISOString(), '2026-10-24T23:30:00.000Z');       // avant le changement de 3 h
  assert.equal(new Date(parisWallToMs('2026-10-25T04:00:00')).toISOString(), '2026-10-25T03:00:00.000Z');       // après
  assert.equal(new Date(parisWallToMs('2026-10-16T10:00')).toISOString(), '2026-10-16T08:00:00.000Z');          // sans secondes
  assert.equal(parisWallToMs('pas une date'), null);
  assert.equal(parisWallToMs(null), null);
});

test('Allo tags : French labels, unknown tags stay readable, one tone per meaning', () => {
  assert.equal(tagLabel('to_call_back'), 'À rappeler');
  assert.equal(tagLabel('not_interested'), 'Pas intéressé');
  assert.equal(tagLabel('follow_up_later'), 'À relancer plus tard');
  assert.equal(tagLabel('interested'), 'Intéressé');
  assert.equal(tagLabel('meeting_booked'), 'RDV pris');
  assert.equal(tagLabel('demo'), 'Démo');
  assert.equal(tagLabel('needs_quote'), 'Needs quote');
  assert.equal(tagLabel('  '), '');
  assert.equal(tagLabel(null), '');
  assert.equal(tagTone('meeting_booked'), TAG_TONES.good);
  assert.equal(tagTone('interested', true), TAG_TONES_DARK.good);
  assert.equal(tagTone('not_interested'), TAG_TONES.bad);
  assert.equal(tagTone('to_call_back'), TAG_TONES.todo);
  assert.equal(tagTone('demo'), TAG_TONES.info);
  assert.equal(tagTone('inconnue'), TAG_TONES.other);
});

test('one view per RDV : calls, none, before Allo, no phone', () => {
  assert.equal(rdvCallsView(ready, 1).kind, 'calls');
  assert.equal(rdvCallsView(ready, '1').kind, 'calls');                                   // l'identifiant du lead est une clé de texte
  assert.equal(rdvCallsView(ready, 2).entry.calls, 3);
  assert.equal(rdvCallsView(ready, 3).kind, 'none');
  assert.equal(rdvCallsView(ready, 4).kind, 'no_phone');
  const before = rdvCallsView(ready, 5);
  assert.equal(before.kind, 'before_allo');
  assert.equal(before.since, '2026-10-10');
  assert.equal(rdvCallsView(ready, 999).kind, 'hidden');                                  // prospect non interrogé : rien
});

test('states of the whole answer', () => {
  assert.equal(rdvCallsView(undefined, 1).kind, 'hidden');
  assert.equal(rdvCallsView({ state: 'unavailable' }, 1).kind, 'hidden');                 // route absente ou refusée : l'écran reste tel quel
  assert.equal(rdvCallsView({ state: 'loading' }, 1).kind, 'loading');
  assert.equal(rdvCallsView({ state: 'ready', data: null }, 1).kind, 'hidden');
  assert.equal(rdvCallsView({ state: 'ready', data: { status: 'missing', rdv: {} } }, 1).kind, 'missing');
  assert.equal(rdvCallsView({ state: 'ready', data: { status: 'error', rdv: {} } }, 1).kind, 'error');
});

test('an RDV without calls says why, in one sentence', () => {
  assert.equal(noteOf(rdvCallsView(ready, 3)), 'Aucun appel Allo vers ce prospect depuis le 10 oct.');
  assert.equal(noteOf(rdvCallsView(ready, 5)), "RDV posé avant l'arrivée d'Allo chez ce setter (10 oct.) : appels non relevés.");
  assert.equal(noteOf(rdvCallsView(ready, 4)), 'Pas de numéro de téléphone exploitable sur la fiche de ce prospect : appels non rapprochables.');
  assert.equal(noteOf({ kind: 'none' }), 'Aucun appel Allo vers ce prospect.');
  assert.equal(noteOf({ kind: 'calls' }), '');
  assert.equal(noteOf(undefined), '');
});

test('the line of an RDV : ×N, then everything that happened, never a zero', () => {
  assert.equal(lineOf(lead1()), '×4 · 2 répondus · 1 répondeur · 1 sans réponse · 1 entrant');
  assert.equal(lineOf({ outbound: 2, human: 0, voicemail: 3, no_answer: 1, inbound: 0 }), '×2 · 3 répondeurs · 1 sans réponse');
  assert.equal(lineOf({ outbound: 2, human: 0, voicemail: 0, no_answer: 2, inbound: 0 }), '×2 · 2 sans réponse');
  assert.equal(lineOf({ outbound: 0, human: 0, voicemail: 0, no_answer: 0, inbound: 2 }), '2 entrants');
  assert.equal(lineOf({}), '');
  assert.equal(lineOf(undefined), '');
});

test('state colours : dark and light', () => {
  assert.equal(toneOf('human'), STATE_TONES.human);
  assert.equal(toneOf('voicemail', true), STATE_TONES_DARK.voicemail);
  assert.equal(toneOf('inconnu'), STATE_TONES.no_answer);
});

test('what a call line says : result, message left, inbound kinds', () => {
  assert.deepEqual(callLabel({ state: 'human' }), { label: 'Répondu', sub: '' });
  assert.deepEqual(callLabel({ state: 'no_answer' }), { label: 'Sans réponse', sub: '' });
  assert.deepEqual(callLabel({ state: 'voicemail', left: true }), { label: 'Répondeur', sub: 'message laissé' });
  assert.deepEqual(callLabel({ state: 'voicemail', left: false }), { label: 'Répondeur', sub: 'sans message' });
  assert.deepEqual(callLabel({ state: 'voicemail', left: null }), { label: 'Répondeur', sub: '' });
  assert.deepEqual(callLabel({ state: 'human', left: true }), { label: 'Répondu', sub: 'message laissé' });
  assert.deepEqual(callLabel({ state: 'inbound', inbound: 'answered' }), { label: 'Entrant · décroché', sub: '' });
  assert.deepEqual(callLabel({ state: 'inbound', inbound: 'voicemail' }), { label: 'Entrant · message vocal', sub: '' });
  assert.deepEqual(callLabel({ state: 'inbound', inbound: 'missed' }), { label: 'Entrant · non décroché', sub: '' });
  assert.deepEqual(callLabel({ state: 'inbound' }), { label: 'Entrant', sub: '' });
  assert.deepEqual(callLabel({ state: 'nouveau' }), { label: 'Sans réponse', sub: '' });
});

test('the three durations of a call : talk, ringing, total', () => {
  assert.deepEqual(callTimes({ state: 'human', total_s: 312, talk_s: 300 }), { talk: 300, ring: 12, total: 312 });
  assert.deepEqual(callTimes({ state: 'no_answer', total_s: 18, talk_s: null }), { talk: null, ring: 18, total: 18 });         // resté sans réponse : tout est sonnerie
  assert.deepEqual(callTimes({ state: 'inbound', inbound: 'missed', total_s: 12, talk_s: null }), { talk: null, ring: 12, total: 12 });
  assert.deepEqual(callTimes({ state: 'human', total_s: 40, talk_s: null }), { talk: null, ring: null, total: 40 });             // non enregistré : on ne devine pas
  assert.deepEqual(callTimes({ state: 'human', total_s: 30, talk_s: 33 }), { talk: 33, ring: 0, total: 30 });                    // jamais une sonnerie négative
  assert.deepEqual(callTimes({ state: 'human' }), { talk: null, ring: null, total: null });
  assert.deepEqual(callTimes({ state: 'human', total_s: 0, talk_s: 0 }), { talk: 0, ring: 0, total: 0 });
});

test('the calls of a prospect, day by day : oldest first, with rank, delay, and the RDV landmarks in place', () => {
  const rows = callRows(lead1(), { rdvAt: '2026-10-16T10:00:00' });
  assert.deepEqual(rows.map((r) => r.type), ['day', 'call', 'day', 'call', 'call', 'pose', 'day', 'call', 'rdv', 'day', 'call']);
  const days = rows.filter((r) => r.type === 'day');
  assert.deepEqual(days.map((d) => d.label), ['lun. 12 oct.', 'mar. 13 oct.', 'mer. 14 oct.', 'ven. 16 oct.']);
  assert.deepEqual(days.map((d) => d.summary), ['1 appel · 1 sans réponse', '2 appels · 1 répondu · 1 répondeur', '1 appel · 1 répondu', '1 appel · 1 entrant']);
  const calls = rows.filter((r) => r.type === 'call');
  assert.deepEqual(calls.map((c) => c.n), [1, 2, 3, 4, 5]);
  assert.ok(calls.every((c) => c.of === 5));
  assert.deepEqual(calls.map((c) => c.gapS), [null, 70200, 19800, 63900, 180900]);                   // 19 h 30, 5 h 30, 17 h 45, 2 j 2 h 15
  assert.deepEqual(calls.map((c) => c.firstAnswer), [false, false, true, false, false]);            // le premier décroché par une personne
  assert.deepEqual(calls.map((c) => c.label.label), ['Sans réponse', 'Répondeur', 'Répondu', 'Répondu', 'Entrant · décroché']);
  assert.deepEqual(calls[2].times, { talk: 300, ring: 12, total: 312 });
  assert.equal(rows.find((r) => r.type === 'pose').at, sample.rdv['1'].pose_at);
  assert.equal(rows.find((r) => r.type === 'rdv').wall, '2026-10-16T10:00:00');
  // la pose tombe après l'appel de 17 h du 13/10 et avant celui du 14/10 ; le RDV entre le 14/10 et l'entrant du 16/10 à 13 h
  const order = rows.filter((r) => r.type !== 'day').map((r) => (r.type === 'call' ? `c${r.n}` : r.type));
  assert.deepEqual(order, ['c1', 'c2', 'c3', 'pose', 'c4', 'rdv', 'c5']);
});

test('landmarks only when they are known, and calls never lost', () => {
  assert.deepEqual(callRows(lead1()).filter((r) => r.type !== 'day').map((r) => r.type), ['call', 'call', 'call', 'pose', 'call', 'call']);
  assert.deepEqual(callRows({ ...lead1(), pose_at: null }).filter((r) => r.type === 'pose'), []);
  assert.deepEqual(callRows({ ...lead1(), pose_at: 'illisible' }).filter((r) => r.type === 'pose'), []);
  assert.deepEqual(callRows(lead1(), { rdvAt: 'illisible' }).filter((r) => r.type === 'rdv'), []);
  assert.deepEqual(callRows({ items: [] }), []);
  assert.deepEqual(callRows(undefined), []);
  const odd = callRows({ items: [{ id: 'a', at: 'pas une date', state: 'human', direction: 'OUTBOUND' }, { id: 'b', at: '2026-10-12T10:00:00Z', state: 'no_answer', direction: 'OUTBOUND' }] });
  assert.equal(odd.filter((r) => r.type === 'call').length, 2);                                       // une date illisible ne fait pas disparaître l'appel
  // un appel passé après minuit appartient au jour suivant : un seul groupe par jour de Paris
  const midnight = callRows({ items: [{ id: 'a', at: '2026-10-12T21:30:00Z', state: 'human', direction: 'OUTBOUND' }, { id: 'b', at: '2026-10-12T22:30:00Z', state: 'human', direction: 'OUTBOUND' }] });
  assert.deepEqual(midnight.filter((r) => r.type === 'day').map((d) => d.label), ['lun. 12 oct.', 'mar. 13 oct.']);
});

test('the facts of a prospect, in plain reading', () => {
  const facts = Object.fromEntries(entryFacts(lead1(), { rdvAt: '2026-10-16T10:00:00' }).map((f) => [f.key, f]));
  assert.equal(facts.first.value, 'lun. 12 oct. · 16 h');
  assert.equal(facts.first.note, '1 j 2 h avant la pose du RDV');
  assert.equal(facts.last.value, 'ven. 16 oct. · 13 h');
  assert.equal(facts.answer.value, 'mar. 13 oct. · 17 h');
  assert.equal(facts.answer.note, 'au 3e appel');                                                    // le 3ᵉ appel SORTANT
  assert.equal(facts.span.value, '4 jours');
  assert.equal(facts.talk.value, '7 min 53 s');
  assert.equal(facts.talk.note, '8 min 59 s au total, sonnerie comprise');
  assert.equal(facts.left.value, '1');
  assert.equal(facts.left.note, 'sur 1 répondeur');
  assert.equal(facts.pose.value, '3 avant · 2 après');
  assert.equal(facts.rdv.value, "1 le jour même · 1 après l'heure du RDV");
  // sans RDV connu ni pose : pas de fait inventé
  const bare = Object.fromEntries(entryFacts({ ...lead1(), pose_at: null, before_pose: 0, after_pose: 0 }).map((f) => [f.key, f]));
  assert.equal(bare.first.note, '');
  assert.equal(bare.pose, undefined);
  assert.equal(bare.rdv, undefined);
  // jamais décroché ; un seul appel
  const never = Object.fromEntries(entryFacts({ calls: 1, voicemail: 0, items: [{ at: '2026-10-12T14:00:00Z', state: 'no_answer', direction: 'OUTBOUND' }], talk_s: 0, total_s: 18 }).map((f) => [f.key, f]));
  assert.equal(never.answer.value, 'Jamais');
  assert.equal(never.last, undefined);
  assert.equal(never.span.value, '1 jour');
  assert.equal(never.left, undefined);
  assert.deepEqual(entryFacts({ items: [] }), []);
  assert.deepEqual(entryFacts(undefined), []);
  // dès le premier appel
  const quick = Object.fromEntries(entryFacts(rdvCallsView(ready, 2).entry).map((f) => [f.key, f]));
  assert.equal(quick.answer.note, 'dès le 1er appel');
});

test('Allo tags of a prospect : counted, most frequent first, and the latest outcome', () => {
  assert.deepEqual(tagCounts(lead1()).map((t) => `${t.tag}:${t.n}`), ['to_call_back:2', 'interested:2', 'follow_up_later:1', 'meeting_booked:1']);
  assert.equal(tagCounts(lead1())[0].label, 'À rappeler');
  assert.deepEqual(tagCounts({ items: [{ tags: [] }, {}] }), []);
  assert.deepEqual(tagCounts(undefined), []);
  const last = lastTags(lead1());
  assert.equal(last.at, '2026-10-16T11:00:00Z');                                                     // l'entrant du 16/10 porte « à rappeler »
  assert.deepEqual(last.tags, [{ tag: 'to_call_back', label: 'À rappeler' }]);
  assert.equal(lastTags({ items: [{ tags: [] }] }), null);
  assert.equal(lastTags(undefined), null);
});

test('the overview of a setter : every figure, the attempts, the tags', () => {
  const view = overviewOf(sample);
  assert.equal(view.kind, 'ready');
  assert.equal(view.since, '10 oct.');
  const stat = Object.fromEntries(view.stats.map((s) => [s.key, s]));
  assert.deepEqual([stat.outbound.value, stat.outbound.note], ['8', '11 appels au total, entrants compris']);
  assert.deepEqual([stat.prospects.value, stat.prospects.note], ['3', '2,7 appels en moyenne par prospect']);
  assert.deepEqual([stat.reached.value, nbsp(stat.reached.note)], ['3', '100 % des prospects appelés ont décroché au moins une fois']);
  assert.deepEqual([stat.human.value, nbsp(stat.human.note)], ['5', '63 % des appels sortants']);
  assert.deepEqual([stat.voicemail.value, stat.voicemail.note], ['2', '1 message laissé']);
  assert.deepEqual([stat.no_answer.value, nbsp(stat.no_answer.note)], ['1', '13 % des appels sortants']);
  assert.deepEqual([stat.inbound.value, stat.inbound.note], ['3', '1 décroché · 1 manqué · 1 message vocal']);
  assert.equal(stat.plus3, undefined);                                                               // « 3 fois et plus » = les barres 3, 4 et 5+ de l'histogramme : pas deux fois
  const time = Object.fromEntries(view.times.map((s) => [s.key, s]));
  assert.deepEqual([time.talk.value, time.talk.note], ['12 min', '1 min 59 s en moyenne par appel répondu']);
  assert.deepEqual([time.total.value, time.total.note], ['14 min', 'sonnerie comprise']);
  assert.deepEqual([time.days.value, time.days.note], ['5', 'dernier appel : dim. 18 oct. · 11 h']);
  assert.deepEqual(view.attempts.map((a) => [a.label, a.n, a.pct]), [['1 fois', 1, 100], ['2 fois', 0, 0], ['3 fois', 1, 100], ['4 fois', 1, 100], ['5 fois et plus', 0, 0]]);
  assert.equal(view.tags.length, 5);
  assert.equal(view.tags.at(-1).tag, 'follow_up_later');                                             // la moins fréquente en dernier
  assert.ok(view.tags.slice(0, 4).every((t) => t.n === 2));
});

test('the overview says why there is nothing, once, and never invents a zero', () => {
  assert.equal(overviewOf(null), null);
  assert.deepEqual(overviewOf({ status: 'missing' }), { kind: 'missing', text: 'Pas de compte Allo : les appels de ce setter ne sont pas relevés.' });
  assert.deepEqual(overviewOf({ status: 'error' }), { kind: 'error', text: 'Allo indisponible : appels non relevés.' });
  assert.deepEqual(overviewOf({ status: 'linked', allo_since: '2026-09-21', totals: { calls: 0 } }), { kind: 'empty', since: '21 sept.', text: 'Aucun appel Allo relevé depuis le 21 sept.' });
  assert.equal(overviewOf({ status: 'linked', allo_since: null, totals: null }).text, 'Aucun appel Allo relevé.');
  // un setter qui n'a que des appels sortants, sans entrants ni répondeur : pas de phrase vide
  const lone = overviewOf({ status: 'linked', allo_since: '2026-09-21', totals: { calls: 1, outbound: 1, inbound: 0, human: 1, voicemail: 0, no_answer: 0, prospects: 1, reached: 1, prospects_3plus: 0, calls_per_prospect: 1, talk_s: 40, human_talk_s: 40, total_s: 52, days: 1, last_at: null, tags: {}, attempts: {} } });
  const stat = Object.fromEntries(lone.stats.map((s) => [s.key, s]));
  assert.equal(stat.outbound.note, 'aucun appel entrant');
  assert.equal(stat.voicemail.note, '');
  assert.equal(stat.inbound.note, '');
  assert.deepEqual(lone.tags, []);
  assert.ok(lone.attempts.every((a) => a.n === 0 && a.pct === 0));
});

test('timeline day headings and hours follow the Paris day, like the history of a lead', () => {
  assert.match(fmtDayLong('2026-10-16T07:24:00Z'), /^vendredi 16 octobre( 2026)?$/);            // l'année n'apparaît que hors de l'année en cours
  assert.match(fmtDayLong('2026-10-22T22:30:00Z'), /^vendredi 23 octobre( 2026)?$/);             // 0 h 30 à Paris : le jour suivant
  assert.match(fmtDayLong('2019-03-02T10:00:00Z'), /^samedi 2 mars 2019$/);
  assert.equal(fmtDayLong('x'), '');
  assert.equal(fmtHourPadded('2026-10-16T07:24:00Z'), '09 h 24');
  assert.equal(fmtHourPadded('2026-10-22T22:30:00Z'), '00 h 30');
  assert.equal(fmtHourPadded('2026-10-22T18:00:00Z'), '20 h 00');
  assert.equal(fmtHourPadded('x'), '');
});

test('the position in a recording reads like a player', () => {
  assert.equal(fmtPlayTime(0), '0:00');
  assert.equal(fmtPlayTime(7.9), '0:07');
  assert.equal(fmtPlayTime(132), '2:12');
  assert.equal(fmtPlayTime(3723), '1:02:03');
  assert.equal(fmtPlayTime(NaN), '0:00');
  assert.equal(fmtPlayTime(Infinity), '0:00');                                                  // un fichier dont la durée est inconnue ne casse pas le lecteur
  assert.equal(fmtPlayTime(-3), '0:00');
});

test('the title of a call in the timeline : direction, then what happened', () => {
  assert.equal(callTitle({ state: 'human' }), 'Appel sortant — répondu');
  assert.equal(callTitle({ state: 'voicemail' }), 'Appel sortant — répondeur');
  assert.equal(callTitle({ state: 'no_answer' }), 'Appel sortant — sans réponse');
  assert.equal(callTitle({ state: 'inbound', inbound: 'answered' }), 'Appel entrant — décroché');
  assert.equal(callTitle({ state: 'inbound', inbound: 'voicemail' }), 'Appel entrant — message vocal');
  assert.equal(callTitle({ state: 'inbound', inbound: 'missed' }), 'Appel entrant — non décroché');
  assert.equal(callTitle({ state: 'inbound' }), 'Appel entrant');
  assert.equal(callTitle(undefined), 'Appel sortant — sans réponse');
});

test('what a call card says besides its title : the main duration, its place in the series, the rest', () => {
  const calls = callRows(lead1(), { rdvAt: '2026-10-16T10:00:00' }).filter((r) => r.type === 'call');
  assert.deepEqual(callDetails(calls[0]), { duration: '18 s', durationLabel: "Durée de l'appel", measures: '', context: 'Appel 1 sur 5' });   // personne n'a décroché : la durée de l'appel, pas de conversation inventée
  assert.deepEqual(callDetails(calls[1]), {
    duration: '32 s', durationLabel: 'Durée de conversation', measures: 'Sonnerie 12 s · total 44 s · message laissé', context: 'Appel 2 sur 5 · +19 h 30 depuis le précédent',
  });
  assert.deepEqual(callDetails(calls[2]), {
    duration: '5 min 00 s', durationLabel: 'Durée de conversation', measures: 'Sonnerie 12 s · total 5 min 12 s',
    context: 'Appel 3 sur 5 · +5 h 30 depuis le précédent · Premier décroché',
  });
  assert.equal(callDetails(calls[4]).context, 'Appel 5 sur 5 · +2 j 2 h depuis le précédent');
  const single = callRows({ items: [{ id: 'a', at: '2026-10-12T10:00:00Z', state: 'human', direction: 'OUTBOUND', talk_s: 60, total_s: 70 }] }).find((r) => r.type === 'call');
  assert.deepEqual(callDetails(single), { duration: '1 min 00 s', durationLabel: 'Durée de conversation', measures: 'Sonnerie 10 s · total 1 min 10 s', context: 'Seul appel · Premier décroché' });
  const unknown = callRows({ items: [{ id: 'b', at: '2026-10-12T10:00:00Z', state: 'human', direction: 'OUTBOUND' }] }).find((r) => r.type === 'call');
  assert.equal(callDetails(unknown).duration, '');                                              // rien d'inventé quand Allo ne donne aucune durée
  assert.equal(callDetails(unknown).measures, '');
});

test('how many calls of a prospect can be listened to', () => {
  assert.equal(recordedOf(lead1()), 4);
  assert.equal(recordedOf({ items: [{ recorded: false }, { recorded: false }] }), 0);
  assert.equal(recordedOf({ items: [] }), 0);
  assert.equal(recordedOf(undefined), 0);
});

test('the timeline : one group per Paris day, with the RDV landmarks on their own day', () => {
  const groups = callTimeline(lead1(), { rdvAt: '2026-10-16T10:00:00' });
  assert.deepEqual(groups.map((g) => g.key), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16']);
  assert.deepEqual(groups.map((g) => g.summary), ['1 appel · 1 sans réponse', '2 appels · 1 répondu · 1 répondeur', '1 appel · 1 répondu', '1 appel · 1 entrant']);
  const kinds = (g) => g.events.map((e) => (e.type === 'call' ? `c${e.n}` : e.type));
  assert.deepEqual(groups.map(kinds), [['c1'], ['c2', 'c3', 'pose'], ['c4'], ['rdv', 'c5']]);    // la pose le 13 après l'appel de 17 h ; le RDV du 16 à 10 h avant l'entrant de 13 h
  assert.equal(groups.flatMap((g) => g.events).filter((e) => e.type === 'call').length, 5);       // aucun appel perdu
  assert.deepEqual(callTimeline(lead1()).map(kinds), [['c1'], ['c2', 'c3', 'pose'], ['c4'], ['c5']]);                 // sans date de RDV : pas de repère « RDV prévu »
});

test('the timeline never loses a call and says when a date is unreadable', () => {
  assert.deepEqual(callTimeline({ items: [] }), []);
  assert.deepEqual(callTimeline(undefined), []);
  const odd = callTimeline({ items: [{ id: 'a', at: 'pas une date', state: 'human', direction: 'OUTBOUND' }, { id: 'b', at: '2026-10-12T10:00:00Z', state: 'no_answer', direction: 'OUTBOUND' }] });
  assert.equal(odd.flatMap((g) => g.events).length, 2);
  assert.equal(odd[odd.length - 1].label, 'Date inconnue');
  const midnight = callTimeline({ items: [{ id: 'a', at: '2026-10-12T21:30:00Z', state: 'human', direction: 'OUTBOUND' }, { id: 'b', at: '2026-10-12T22:30:00Z', state: 'human', direction: 'OUTBOUND' }] });
  assert.equal(midnight.length, 2);                                                              // un appel passé après minuit appartient au jour suivant
});
