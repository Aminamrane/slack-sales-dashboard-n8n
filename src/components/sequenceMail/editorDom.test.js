// src/components/sequenceMail/editorDom.test.js
//
// Attributs étrangers sur <html> et <body> de l'éditeur de mail. Cas réel (Sub-Tickets, « Confirmer les modifications ») : une extension du navigateur
// (bloqueur de publicités…) pose `data-ab-filters-channel` et `data-abp-filters-channel` sur le <html> de l'iframe d'édition ; le HTML envoyé au serveur
// les contenait, et sa liste blanche refusait tout l'enregistrement (« Contenu refusé : attribut « … » interdit dans <html> »).
// Le test tourne sous Node, sans DOM : des éléments factices portent la liste d'attributs et `removeAttribute`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { stripForeignRootAttributes } from './editorDom.js';

const element = (attrs = {}) => {
  const list = Object.entries(attrs).map(([name, value]) => ({ name, value }));
  return {
    // Collection VIVANTE, comme `NamedNodeMap` : retirer un attribut pendant le parcours fait sauter le suivant (d'où la copie dans le code testé).
    get attributes() {
      return { [Symbol.iterator]() { let i = 0; return { next: () => (i < list.length ? { value: list[i++], done: false } : { value: undefined, done: true }) }; } };
    },
    removeAttribute(name) { const i = list.findIndex((a) => a.name === name); if (i >= 0) list.splice(i, 1); },
    names: () => list.map((a) => a.name),
    values: () => list.map((a) => a.value),
  };
};
/** Un arbre cloné : <html …> contenant <body …>. */
function tree(htmlAttrs, bodyAttrs, { withBody = true } = {}) {
  const html = element(htmlAttrs);
  const body = withBody ? element(bodyAttrs) : null;
  html.querySelector = (selector) => (selector === 'body' ? body : null);
  return { html, body };
}

test('le cas réel : les deux attributs du bloqueur de publicités sont retirés de <html>, `lang` reste', () => {
  const { html } = tree({ lang: 'fr', 'data-ab-filters-channel': '1', 'data-abp-filters-channel': '1' }, {});
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), ['lang']);
});

test('ce que portent les vrais e-mails est gardé : `lang` sur <html>, `style` sur <body> (158 e-mails vérifiés sur les 8 cohortes)', () => {
  const { html, body } = tree({ lang: 'fr' }, { style: 'margin:0;padding:0' });
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), ['lang']);
  assert.deepEqual(body.names(), ['style']);
  assert.deepEqual(body.values(), ['margin:0;padding:0']);
});

test('les attributs posés par d\'autres extensions sont retirés aussi, sur <html> comme sur <body>', () => {
  const { html, body } = tree(
    { lang: 'fr', 'data-lt-installed': 'true', 'data-darkreader-mode': 'dynamic', 'data-new-gr-c-s-check-loaded': '14.1', 'xmlns:foo': 'bar' },
    { style: 'margin:0', 'cz-shortcut-listen': 'true', 'data-gramm': 'false', 'data-lastpass-icon-root': '' },
  );
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), ['lang']);
  assert.deepEqual(body.names(), ['style']);
});

test('la liste gardée est celle du serveur (GLOBAL_ATTRS de sequence_email_versions.py) : rien d\'autre ne passe', () => {
  const allowed = ['style', 'class', 'id', 'lang', 'dir', 'title', 'role', 'align', 'valign', 'width', 'height', 'bgcolor'];
  const foreign = ['data-x', 'onclick', 'contenteditable', 'spellcheck', 'xmlns', 'leftmargin', 'cz-shortcut-listen', 'href'];
  const attrs = Object.fromEntries([...allowed, ...foreign].map((name) => [name, 'v']));
  const { html, body } = tree(attrs, attrs);
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), allowed);
  assert.deepEqual(body.names(), allowed);
});

test('un nom d\'attribut en majuscules est reconnu comme les autres', () => {
  const { html } = tree({ LANG: 'fr', 'DATA-AB-FILTERS-CHANNEL': '1' }, {});
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), ['LANG']);
});

test('sans <body> ni attribut : rien ne plante, rien n\'est ajouté', () => {
  const { html } = tree({}, {}, { withBody: false });
  stripForeignRootAttributes(html);
  assert.deepEqual(html.names(), []);
  const bare = tree({ lang: 'fr' }, {}, { withBody: false });
  stripForeignRootAttributes(bare.html);
  assert.deepEqual(bare.html.names(), ['lang']);
});
