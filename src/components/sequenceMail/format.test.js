// src/components/sequenceMail/format.test.js
//
// Formatage et repli de recherche : `node --test src/components/sequenceMail/format.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dayDiff, fmtBytes, fmtDayMonth, fmtInt, fmtRatio, fmtTime, fmtWeekday, fmtWhenLong, fmtWhenShort,
  fromNow, humanSpan, normalize, relToLive,
} from './format.js';

// Les espaces des sorties Intl varient (insécable fine) : on les ramène à des espaces simples.
const flat = (s) => s.replace(/[\u00a0\u202f]/g, ' ');

test('normalize : minuscules, sans accents', () => {
  assert.equal(normalize('Éclair ÉCLAIRÉ à Noël'), 'eclair eclaire a noel');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
  assert.equal(normalize(42), '42');
});

test('normalize : l\'apostrophe typographique devient l\'apostrophe droite', () => {
  assert.equal(normalize('Merci d’avoir participé'), "merci d'avoir participe");
  assert.equal(normalize('d‘ici \u02bc'), "d'ici '");
  assert.equal(normalize("d'avoir"), normalize('d’avoir'));
});

test('normalize : œ et æ sont développés', () => {
  assert.equal(normalize('Cœur'), 'coeur');
  assert.equal(normalize('SŒUR'), 'soeur');
  assert.equal(normalize('Ex æquo'), 'ex aequo');
});

test('normalize : espaces insécables et fines en espaces', () => {
  assert.equal(normalize('a\u00a0b\u202fc\u2009d'), 'a b c d');
});

test('la plage des accents est écrite en échappements (aucun caractère combinant littéral dans le source)', () => {
  const source = readFileSync(new URL('./format.js', import.meta.url), 'utf8');
  const combining = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`);
  assert.equal(combining.test(source), false);
  assert.ok(source.includes(`${String.fromCharCode(92)}u0300-${String.fromCharCode(92)}u036f`));
});

test('humanSpan : durées lisibles', () => {
  assert.equal(humanSpan(45 * 60000), '45 min');
  assert.equal(humanSpan(135 * 60000), '2 h 15 min');
  assert.equal(humanSpan(120 * 60000), '2 h');
  assert.equal(humanSpan((3 * 1440 + 7 * 60) * 60000), '3 j 7 h');
  assert.equal(humanSpan(2 * 1440 * 60000), '2 j');
  assert.equal(humanSpan(-90 * 60000), '1 h 30 min');
  assert.equal(humanSpan(0), '0 min');
});

test('humanSpan : jamais « NaN min »', () => {
  assert.equal(humanSpan(NaN), '');
  assert.equal(humanSpan(Infinity), '');
  assert.equal(humanSpan(undefined), '');
  assert.equal(humanSpan(null), '');
});

test('une date absente ou invalide donne une chaîne vide (pas le 1er janvier 1970)', () => {
  for (const bad of [null, undefined, '', 'garbage', false, true, {}]) {
    assert.equal(fmtDayMonth(bad), '', `fmtDayMonth(${String(bad)})`);
    assert.equal(fmtTime(bad), '');
    assert.equal(fmtWhenShort(bad), '');
    assert.equal(fmtWhenLong(bad), '');
    assert.equal(fmtWeekday(bad), '');
    assert.equal(fromNow(bad), '');
  }
  assert.equal(dayDiff(null, '2026-10-08T20:00:00+02:00'), null);
  assert.equal(relToLive(undefined, '2026-10-08T20:00:00+02:00'), '');
});

test('dates à l\'heure de Paris', () => {
  assert.equal(fmtWhenLong('2026-09-21T20:00:00+02:00'), 'lundi 21 septembre 2026 à 20:00');
  assert.equal(fmtTime('2026-09-21T18:00:00Z'), '20:00');
  assert.equal(fmtWeekday('2026-09-21T20:00:00+02:00'), 'lundi');
  assert.match(flat(fmtDayMonth('2026-09-21T20:00:00+02:00')), /^21 sept\.?$/);
  const now = Date.parse('2026-10-02T12:00:00+02:00');
  assert.match(flat(fmtWhenShort('2026-10-08T11:00:00+02:00', now)), /^jeu\.? 8 oct\.?, 11:00$/);
  assert.match(flat(fmtWhenShort('2027-01-08T11:00:00+01:00', now)), /2027/);
});

test('jours civils de Paris, indépendants du changement d\'heure', () => {
  assert.equal(dayDiff('2026-10-24T20:00:00+02:00', '2026-10-26T20:00:00+01:00'), 2);
  assert.equal(relToLive('2026-10-05T11:00:00+02:00', '2026-10-08T20:00:00+02:00'), 'J-3');
  assert.equal(relToLive('2026-10-08T08:30:00+02:00', '2026-10-08T20:00:00+02:00'), 'J');
  assert.equal(relToLive('2026-10-09T10:00:00+02:00', '2026-10-08T20:00:00+02:00'), 'J+1');
});

test('fromNow', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  assert.equal(fromNow('2026-10-05T12:00:00Z', now), 'dans 3 jours');
  assert.equal(fromNow('2026-09-25T12:00:00Z', now), 'il y a 7 jours');
  assert.equal(fromNow('2026-10-02T12:30:00Z', now), 'dans 30 min');
  assert.equal(fromNow('2026-10-02T09:00:00Z', now), 'il y a 3 h');
});

test('nombres', () => {
  assert.equal(flat(fmtInt(1234)), '1 234');
  assert.equal(fmtInt(NaN), '—');
  assert.equal(fmtInt(undefined), '—');
  assert.equal(fmtRatio(1, 4), '25 %');
  assert.equal(fmtRatio(1, 0), '—');
  assert.equal(fmtRatio(NaN, 4), '—');
  assert.equal(fmtBytes(512), '512 o');
  assert.equal(fmtBytes(2048), '2.0 Ko');
  assert.equal(fmtBytes(NaN), '');
});
