// src/components/sequenceMail/highlight.test.js
//
// Surlignage de recherche : `node --test src/components/sequenceMail/highlight.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightParts } from './highlight.js';
import { normalize } from './format.js';

const hits = (parts) => parts.filter((p) => p.hit).map((p) => p.text);
const joined = (parts) => parts.map((p) => p.text).join('');

test('le terme en début de texte est surligné (la parité ne se décale plus)', () => {
  const parts = highlightParts('Votre inscription est confirmée', ['votre']);
  assert.deepEqual(parts, [
    { text: 'Votre', hit: true },
    { text: ' inscription est confirmée', hit: false },
  ]);
});

test('terme au milieu, à la fin, et plusieurs occurrences', () => {
  assert.deepEqual(hits(highlightParts('Bienvenue au webinaire', ['web'])), ['web']);
  assert.deepEqual(hits(highlightParts('Votre inscription est confirmée', ['confirmee'])), ['confirmée']);
  assert.deepEqual(hits(highlightParts('foo bar foo', ['foo'])), ['foo', 'foo']);
  assert.deepEqual(hits(highlightParts('abc', ['a'])), ['a']);
});

test('correspondances adjacentes : chaque mot reste surligné', () => {
  assert.deepEqual(hits(highlightParts('ab', ['a', 'b'])), ['a', 'b']);
});

test('le texte est toujours reconstitué à l\'identique', () => {
  const samples = ['', 'x', 'aaa', 'Merci d’avoir participé au webinaire.', 'Cœur & âme (2026) — éclair !'];
  for (const text of samples) {
    for (const tokens of [[], ['a'], ['merci', 'webinaire'], ['avoir'], ['coeur'], ['e']]) {
      assert.equal(joined(highlightParts(text, tokens)), text);
    }
  }
});

test('insensible aux accents et à la casse', () => {
  assert.deepEqual(hits(highlightParts('Éclair et ÉCLAIR', ['eclair'])), ['Éclair', 'ÉCLAIR']);
});

test('apostrophe droite = apostrophe typographique', () => {
  assert.deepEqual(hits(highlightParts('Merci d’avoir participé', [normalize("d'avoir")])), ['d’avoir']);
  assert.deepEqual(hits(highlightParts("Merci d'avoir participé", [normalize('d’avoir')])), ["d'avoir"]);
});

test('œ et æ se surlignent depuis « oe » et « ae »', () => {
  assert.deepEqual(hits(highlightParts('Le cœur et le Cœur', ['coeur'])), ['cœur', 'Cœur']);
  assert.deepEqual(hits(highlightParts('coeur', ['coeur'])), ['coeur']);
  assert.deepEqual(hits(highlightParts('Ex æquo', ['ae'])), ['æ']);
});

test('les caractères spéciaux sont échappés', () => {
  assert.deepEqual(hits(highlightParts('a.b axb', ['a.b'])), ['a.b']);
  assert.deepEqual(hits(highlightParts('(2026)+', ['(2026)+'])), ['(2026)+']);
  assert.deepEqual(hits(highlightParts('prix [HT]', ['[ht]'])), ['[HT]']);
});

test('le mot le plus long l\'emporte sur son préfixe', () => {
  assert.deepEqual(hits(highlightParts('webinaire du soir', ['web', 'webinaire'])), ['webinaire']);
});

test('sans mot ou sans texte : un seul fragment non surligné', () => {
  assert.deepEqual(highlightParts('texte', []), [{ text: 'texte', hit: false }]);
  assert.deepEqual(highlightParts('texte', undefined), [{ text: 'texte', hit: false }]);
  assert.deepEqual(highlightParts('', ['a']), [{ text: '', hit: false }]);
});

test('une saisie très longue reste bornée', () => {
  const tokens = Array.from({ length: 200 }, (_, i) => `m${String.fromCharCode(97 + (i % 26))}${i}x`);
  const text = 'ma0x mb1x mz199x';
  const parts = highlightParts(text, tokens);
  assert.equal(joined(parts), text);
  // seuls les 12 premiers mots sont pris en compte : « ma0x » et « mb1x » le sont, pas « mz199x »
  assert.deepEqual(hits(parts), ['ma0x', 'mb1x']);
});
