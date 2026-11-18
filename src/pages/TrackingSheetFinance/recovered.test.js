import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveredDay, recoveredInfo, RECOVERED_TONES } from './recovered.js';

test('un client récupéré se lit : jour à Paris, état quitté, facturation à rétablir', () => {
  const info = recoveredInfo({ at: '2026-11-09T13:12:00+00:00', from: 'Rétractation', by: 'Camille Test', billing: 'to_restore' });
  assert.equal(info.day, '09/11');
  assert.equal(info.toRestore, true);
  assert.deepEqual(info.tone, RECOVERED_TONES.toRestore);
  assert.equal(info.title, 'Récupéré le 09/11 par Camille Test : était en rétractation. Facturation à rétablir.');
});

test('facturation rétablie, ou départ jamais acté côté Finance', () => {
  assert.equal(recoveredInfo({ at: '2026-10-05T22:30:00+00:00', from: 'En cours de résiliation', billing: 'restored' }).title,
    'Récupéré le 06/10 : était en cours de résiliation. Facturation rétablie.');
  const none = recoveredInfo({ at: '2026-10-05T10:00:00+00:00', from: 'Résiliation', billing: null });
  assert.equal(none.toRestore, false);
  assert.deepEqual(none.tone, RECOVERED_TONES.done);
  assert.equal(recoveredInfo(null), null);
  assert.equal(recoveredDay('pas une date'), '');
});
