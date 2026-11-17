import test from 'node:test';
import assert from 'node:assert/strict';
import { dayMonth, historyItems, matchesMeteo, noShowLine, repecheLine, REPECHE_FILTER, slotLabel } from './boardRepeche.js';

test('le repêchage se lit « le JJ/MM par X · jusqu au JJ/MM », jour du repêchage à Paris', () => {
  assert.equal(repecheLine({ at: '2026-11-02T23:30:00+00:00', by: 'Camille Test', until: '2027-01-03' }),
    "Client repêché le 03/11 par Camille Test · jusqu'au 03/01");
  assert.equal(repecheLine(null), '');
  assert.equal(dayMonth('2027-01-03'), '03/01');
  assert.equal(dayMonth(''), '');
});

test('le no show qualifié garde la date du rendez-vous et son auteur', () => {
  assert.equal(noShowLine({ rdv_date: '2026-11-03', qualified_by_name: 'Camille Test' }),
    "No show à l'onboarding du 03/11, qualifié par Camille Test");
  // Retrouvés par la statistique de la Finance : sans auteur, « probable » quand le rendez-vous a bougé le jour même.
  assert.equal(noShowLine({ rdv_date: '2026-11-02', qualified_by_name: '', level: 'certain' }), "No show à l'onboarding du 02/11");
  assert.equal(noShowLine({ rdv_date: '2026-11-17', qualified_by_name: '', level: 'probable' }), "No show probable à l'onboarding du 17/11");
  assert.equal(slotLabel('2026-11-20T10:30:00'), '20/11 à 10h30');
  assert.equal(slotLabel(null), '');
});

test('la pastille Repêchés s ajoute aux bandes météo cochées (union)', () => {
  const kept = { meteo_score: 2, meteo_context: { version: 2 }, repeche: { at: '2026-11-10T10:00:00Z' } };
  const fine = { meteo_score: 5, meteo_context: { version: 2 }, repeche: null };
  assert.equal(matchesMeteo(kept, []), true);
  assert.equal(matchesMeteo(kept, [REPECHE_FILTER]), true);
  assert.equal(matchesMeteo(fine, [REPECHE_FILTER]), false);
  assert.equal(matchesMeteo(fine, [REPECHE_FILTER, '5']), true);
  assert.equal(matchesMeteo(kept, ['5']), false);
});

test('l historique mêle états, fiches de conservation et no shows, le plus ancien en haut', () => {
  const items = historyItems({
    history: [{ id: 1, etat: 'En cours de résiliation', created_at: '2026-11-10T09:00:00+00:00' },
      { id: 2, etat: 'Signé', created_at: '2026-11-12T09:00:00+00:00' }],
    conservations: [{ id: 1, issue: 'repeche', created_at: '2026-11-12T08:59:00+00:00' }],
    no_shows: [{ id: 1, rdv_date: '2026-10-03', created_at: '2026-10-04T09:00:00+00:00' }],
  });
  assert.deepEqual(items.map((i) => i.key), ['no_show-1', 'etat-1', 'conservation-1', 'etat-2']);
  assert.deepEqual(historyItems({ history: [] }), []);
});
