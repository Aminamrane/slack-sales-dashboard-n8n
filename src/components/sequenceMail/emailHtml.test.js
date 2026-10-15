// src/components/sequenceMail/emailHtml.test.js
//
// Préparation du HTML d'aperçu : `node --test src/components/sequenceMail/emailHtml.test.js`

import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMergeFields, prepareHtml } from './emailHtml.js';

const doc = (body, head = '<meta charset="utf-8">') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

test('liens personnels (guillemets doubles) : neutralisés, adresse gardée en infobulle', () => {
  const out = prepareHtml(doc('<a href="https://webinaire.example.com/r/EVENT_ID" style="color:red">Rejoindre</a>'));
  assert.match(out, /<a style="color:red" href="#" target="_self" data-personal="1" title="Lien personnel, généré pour chaque inscrit à l'envoi : https:\/\/webinaire\.example\.com\/r\/EVENT_ID">Rejoindre<\/a>/);
  assert.ok(!out.includes('href="https://webinaire.example.com/r/EVENT_ID"'));
});

test('liens personnels : guillemets simples, sans guillemets, `>` dans un autre attribut', () => {
  const single = prepareHtml(doc("<a href='https://x.example.com/u/EVENT_ID'>Se désinscrire</a>"));
  assert.match(single, /<a href="#" target="_self" data-personal="1"/);
  assert.ok(!single.includes("href='https://x.example.com"));

  const bare = prepareHtml(doc('<a href=https://x.example.com/r/EVENT_ID class=btn>Go</a>'));
  assert.match(bare, /<a class=btn href="#" target="_self" data-personal="1"/);

  const tricky = prepareHtml(doc('<a title="a > b" href="https://x.example.com/r/EVENT_ID">Go</a>'));
  assert.match(tricky, /<a href="#" target="_self" data-personal="1" title="Lien personnel[^"]*">Go<\/a>/);
  assert.ok(!tricky.includes('title="a > b"'));
});

test('liens personnels : un target ou title existant est remplacé, pas dupliqué', () => {
  const out = prepareHtml(doc('<a target="_blank" title="ancien" href="https://x.example.com/r/EVENT_ID">Go</a>'));
  assert.equal((out.match(/target=/g) || []).length, 2); // `_self` du lien + `_blank` de <base target>
  assert.ok(!out.includes('ancien'));
  assert.ok(!out.includes('_blank" title'));
});

test('les autres liens ne sont pas touchés', () => {
  const link = '<a href="https://chat.whatsapp.com/abc" target="_blank">Groupe</a>';
  assert.ok(prepareHtml(doc(link)).includes(link));
  const abbr = '<abbr title="x" href="https://x.example.com/EVENT_ID">a</abbr>';
  assert.ok(prepareHtml(doc(abbr)).includes(abbr));
});

test('champs personnalisés : surlignés dans le texte seulement', () => {
  const body = '<p title="{{attribut}}">Bonjour {{prénom}},</p><!-- {{commentaire}} --><style>.a::after{content:"{{css}}"}</style>';
  const out = prepareHtml(doc(body, '<title>{{titre}}</title>'));
  assert.ok(out.includes('Bonjour <span class="smx-merge">{{prénom}}</span>,'));
  assert.ok(out.includes('title="{{attribut}}"'));
  assert.ok(out.includes('<!-- {{commentaire}} -->'));
  assert.ok(out.includes('content:"{{css}}"'));
  assert.ok(out.includes('<title>{{titre}}</title>'));
  assert.equal((out.match(/class="smx-merge"/g) || []).length, 1);
});

test('champs personnalisés : un `>` dans un attribut ne casse pas le découpage', () => {
  const out = prepareHtml(doc('<img alt="a > {{x}}" src="y.png"><p>{{prénom}}</p>'));
  assert.ok(out.includes('alt="a > {{x}}"'));
  assert.ok(out.includes('<p><span class="smx-merge">{{prénom}}</span></p>'));
});

test('politique de sécurité et référent masqué injectés EN TÊTE du <head>', () => {
  const out = prepareHtml(doc('<p>x</p>', '<meta charset="utf-8"><title>t</title>'));
  const head = out.slice(out.indexOf('<head>') + 6);
  assert.ok(head.startsWith('<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; form-action \'none\'; frame-src \'none\'">'));
  assert.ok(head.includes('<meta name="referrer" content="no-referrer">'));
  assert.ok(head.indexOf('Content-Security-Policy') < head.indexOf('<meta charset'));
  assert.ok(out.includes('<base target="_blank">'));
});

test('document sans <head> : tout est injecté en tête, un <header> n\'est pas pris pour un <head>', () => {
  const out = prepareHtml('<header><h1>Titre</h1></header><p>Bonjour</p>');
  assert.ok(out.startsWith('<meta http-equiv="Content-Security-Policy"'));
  assert.ok(out.endsWith('<header><h1>Titre</h1></header><p>Bonjour</p>'));
  const withAttrs = prepareHtml('<html><head lang="fr"><title>x</title></head><body></body></html>');
  assert.ok(withAttrs.includes('<head lang="fr"><meta http-equiv="Content-Security-Policy"'));
});

test('hasMergeFields', () => {
  assert.equal(hasMergeFields('Bonjour {{prénom}}'), true);
  assert.equal(hasMergeFields('Bonjour'), false);
  assert.equal(hasMergeFields(undefined), false);
  assert.equal(hasMergeFields(42), false);
  assert.equal(hasMergeFields('{{' + 'x'.repeat(41) + '}}'), false);
});
