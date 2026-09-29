import test from 'node:test';
import assert from 'node:assert/strict';
import { isTypingTarget } from './typingTarget.js';

test('les raccourcis globaux se taisent dans un champ, une zone de texte et l’éditeur de commentaire enrichi', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'P', isContentEditable: true }), true);
});

test('ailleurs, ils restent actifs', () => {
  for (const el of [{ tagName: 'DIV', isContentEditable: false }, { tagName: 'BUTTON' }, { tagName: 'BODY' }, null, undefined]) {
    assert.equal(isTypingTarget(el), false);
  }
});
