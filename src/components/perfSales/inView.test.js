import test from 'node:test';
import assert from 'node:assert/strict';

import { inView } from './inView.js';

test('un bloc plus haut que l’écran se révèle dès qu’il y entre (liste de 92 lignes, 13/11/2026)', () => {
  const entry = (ratio, height, visible = true) => ({ isIntersecting: visible, intersectionRatio: ratio, boundingClientRect: { height } });
  // Liste de 6 039 px dans une fenêtre de 525 px : jamais 15 % à l'écran, elle doit pourtant apparaître.
  assert.equal(inView(entry(0.087, 6039), 0.15, 525), true);
  // Un bloc ordinaire attend toujours d'avoir 15 % de sa hauteur à l'écran.
  assert.equal(inView(entry(0.05, 300), 0.15, 525), false);
  assert.equal(inView(entry(0.2, 300), 0.15, 525), true);
  // Hors de l'écran, rien.
  assert.equal(inView(entry(0, 6039, false), 0.15, 525), false);
});
