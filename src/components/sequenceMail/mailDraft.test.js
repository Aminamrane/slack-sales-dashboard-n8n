import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDraft, deriveFromHtml, draftState, draftedSteps, hasAnyDraft, htmlToPlainText, linksOfHtml, normalizeLinkUrl, snippetOf,
} from './mailDraft.js';

const HTML = `<!doctype html><html><head><title>x</title></head><body>
<div style="overflow:hidden;max-height:0;max-width:0;opacity:0;">Texte caché</div>
<p>Bonjour {{prénom}},</p>
<p>Voici <strong>l'offre</strong>&nbsp;: <a href="https://owner.test/offre" style="display:inline-block;padding:8px">Je réserve</a></p>
<ul><li>Un</li><li>Deux</li></ul>
<p><a href="https://webinaire.ownertechnology.com/u/EVENT_ID">Se désinscrire</a></p>
</body></html>`;

test('the plain-text version follows the landing rule: no hidden preheader, links as "label : url", list dashes', () => {
  const text = htmlToPlainText(HTML);
  assert.ok(!text.includes('Texte caché'));
  assert.ok(text.includes('Bonjour {{prénom}},'));
  assert.ok(text.includes("l'offre : Je réserve : https://owner.test/offre"));
  assert.ok(text.includes('- Un'));
  assert.ok(text.includes('Se désinscrire : https://webinaire.ownertechnology.com/u/EVENT_ID'));
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'));
});

test('the list snippet drops the greeting and is capped at 220 characters', () => {
  assert.equal(snippetOf('Bonjour Camille,\n\nVoici la suite.\n\nÀ bientôt.'), 'Voici la suite. À bientôt.');
  assert.equal(snippetOf('Bonjour,'), 'Bonjour,');
  assert.equal(snippetOf('x'.repeat(500)).length, 220);
  assert.equal(snippetOf(undefined), '');
});

test('links are listed once, flagged personal / unsubscribe / button', () => {
  const links = linksOfHtml(HTML + '<a href="https://owner.test/offre" style="display:inline-block">Je réserve</a>');
  assert.deepEqual(
    links.map((l) => [l.label, l.personal, l.unsubscribe, l.button]),
    [['Je réserve', false, false, true], ['Se désinscrire', true, true, false]]
  );
  assert.deepEqual(linksOfHtml(''), []);
});

test('a link address is accepted only for safe schemes; a bare domain gets https', () => {
  assert.equal(normalizeLinkUrl('https://owner.test/a?b=1'), 'https://owner.test/a?b=1');
  assert.equal(normalizeLinkUrl('  owner.test/offre '), 'https://owner.test/offre');
  assert.equal(normalizeLinkUrl('www.owner.test'), 'https://www.owner.test');
  assert.equal(normalizeLinkUrl('contact@owner.test'), 'mailto:contact@owner.test');
  assert.equal(normalizeLinkUrl('mailto:contact@owner.test'), 'mailto:contact@owner.test');
  assert.equal(normalizeLinkUrl('tel:+33123456789'), 'tel:+33123456789');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'vbscript:x', '', '   ', 'deux mots', 'pas-un-lien']) {
    assert.equal(normalizeLinkUrl(bad), null, bad);
  }
  assert.equal(normalizeLinkUrl(undefined), null);
});

test('a bare domain keeps its port, query string and fragment (completed in https)', () => {
  assert.equal(normalizeLinkUrl('owner.com:8080/x'), 'https://owner.com:8080/x');
  assert.equal(normalizeLinkUrl('owner.com:8080'), 'https://owner.com:8080');
  assert.equal(normalizeLinkUrl('owner.com?x=1'), 'https://owner.com?x=1');
  assert.equal(normalizeLinkUrl('owner.com#a'), 'https://owner.com#a');
  assert.equal(normalizeLinkUrl('www.owner.com/p?x=1&y=2#top'), 'https://www.owner.com/p?x=1&y=2#top');
  assert.equal(normalizeLinkUrl('https://owner.com:8443/p?x=1#a'), 'https://owner.com:8443/p?x=1#a');
});

test('the host must be plausible: a domain with an extension (or an IPv4), never a bare name', () => {
  for (const bad of ['https://a', 'http://localhost', 'https://localhost:3000/x', 'a.b', 'owner', 'owner.c', 'https://owner.com.', 'https://[::1]/x', 'https://owner.com:99999']) {
    assert.equal(normalizeLinkUrl(bad), null, bad);
  }
  assert.equal(normalizeLinkUrl('https://owner.test'), 'https://owner.test');
  assert.equal(normalizeLinkUrl('HTTPS://OWNER.TEST/Page'), 'HTTPS://OWNER.TEST/Page');
  assert.equal(normalizeLinkUrl('192.168.0.1/admin'), 'https://192.168.0.1/admin');
  assert.equal(normalizeLinkUrl('bücher.de/x'), 'https://bücher.de/x');
});

test('the whitelist still refuses other schemes, credentials, protocol-relative and injected markup', () => {
  for (const bad of [
    'javascript:alert(1)', 'javascript:1', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'vbscript:x', 'ftp://owner.test',
    '//evil.test', '\\evil.test', 'https://user:pw@owner.test/x', 'https://owner.test"onmouseover="x', 'https://owner.test/<img src=x>',
  ]) {
    assert.equal(normalizeLinkUrl(bad), null, bad);
  }
  assert.equal(normalizeLinkUrl('mailto:contact@owner.test?subject=Bonjour'), 'mailto:contact@owner.test?subject=Bonjour');
  assert.equal(normalizeLinkUrl('contact@owner.test'), 'mailto:contact@owner.test');
  assert.equal(normalizeLinkUrl('tel:+33123456789'), 'tel:+33123456789');
});

test('hasAnyDraft is true only while at least one e-mail carries a draft', () => {
  assert.equal(hasAnyDraft(undefined), false);
  assert.equal(hasAnyDraft(null), false);
  assert.equal(hasAnyDraft({}), false);
  assert.equal(hasAnyDraft({ 'webinar-2026-09-07': {} }), false);
  assert.equal(hasAnyDraft({ 'webinar-2026-09-07': { email_x: { subject: 'S', editedAt: 1 } } }), true);
  assert.equal(hasAnyDraft({ a: {}, b: { k: { editedAt: 1 } } }), true);
});

const step = { kind: 'k', subject: 'Objet', html: '<p>Corps</p>', text: 'Corps\n', snippet: 'Corps', links: [], textDerived: false };

test('without a draft the step is returned as is (same reference)', () => {
  assert.equal(applyDraft(step, undefined), step);
  assert.equal(applyDraft(step, null), step);
});

test('a subject-only draft changes the subject and nothing else', () => {
  const next = applyDraft(step, { subject: 'Nouvel objet', editedAt: 1 });
  assert.equal(next.subject, 'Nouvel objet');
  assert.equal(next.html, step.html);
  assert.equal(next.text, step.text);
  assert.equal(next.draftStatus, 'editing');
  assert.equal(step.subject, 'Objet', 'the original step is never modified');
});

test('an html draft brings its derived text, snippet and links, and marks the text as derived', () => {
  const html = '<p>Bonjour,</p><p>Nouveau <a href="https://owner.test/x">lien</a></p>';
  const next = applyDraft(step, { html, ...deriveFromHtml(html), editedAt: 1 });
  assert.equal(next.html, html);
  assert.ok(next.text.includes('Nouveau lien : https://owner.test/x'));
  assert.equal(next.snippet, 'Nouveau lien : https://owner.test/x');
  assert.deepEqual(next.links.map((l) => l.href), ['https://owner.test/x']);
  assert.equal(next.textDerived, true);
});

test('a text-only draft replaces the text and recomputes the snippet', () => {
  const next = applyDraft({ kind: 'k', subject: 's', text: 'Ancien' }, { text: 'Bonjour,\n\nNouveau texte', editedAt: 1 });
  assert.equal(next.text, 'Bonjour,\n\nNouveau texte');
  assert.equal(next.snippet, 'Nouveau texte');
  assert.equal(next.html, undefined);
});

test('draftedSteps keeps the same array when there is nothing to apply, and copies only drafted steps otherwise', () => {
  const steps = [{ kind: 'a', subject: 'A' }, { kind: 'b', subject: 'B' }];
  assert.equal(draftedSteps(steps, undefined), steps);
  assert.equal(draftedSteps(steps, {}), steps);
  const out = draftedSteps(steps, { b: { subject: 'B2', editedAt: 1 } });
  assert.notEqual(out, steps);
  assert.equal(out[0], steps[0]);
  assert.equal(out[1].subject, 'B2');
  assert.equal(steps[1].subject, 'B');
});

test('a draft is "confirmed" only while the (simulated) confirmation is not older than the last edit', () => {
  assert.equal(draftState(undefined), null);
  assert.equal(draftState({ editedAt: 5 }), 'editing');
  assert.equal(draftState({ editedAt: 5, confirmedAt: 5 }), 'confirmed');
  assert.equal(draftState({ editedAt: 6, confirmedAt: 5 }), 'editing');
});
