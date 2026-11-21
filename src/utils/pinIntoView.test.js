import test from 'node:test';
import assert from 'node:assert/strict';
import { centerOffset } from './pinIntoView.js';

test("l'écart au centre est nul quand le message est centré, négatif au-dessus, positif en dessous", () => {
  assert.equal(centerOffset({ top: 450, height: 100 }, 0, 1000), 0);
  assert.equal(centerOffset({ top: 100, height: 100 }, 0, 1000), -350);
  assert.equal(centerOffset({ top: 5800, height: 60 }, 22, 878), 5800 + 30 - (22 + 439));
});
