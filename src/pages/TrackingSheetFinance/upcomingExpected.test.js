// upcomingExpected.test.js : l'attendu du mois de début de facturation,
// montré en indication la veille (incident 01/10/2026, n°773).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { scopedUpcomingExpected, upcomingExpectedHint } from './upcomingExpected.js';
import { computeKpis } from './constants.js';

// n°773, ligne de septembre servie le 30/09 : rien d'attendu en septembre,
// 369,60 € Owner et 172,80 € Opti'Lex en octobre (décimales en chaîne, comme l'API).
const n773 = {
  period: '2026-09-01',
  expected_owner: '0.00', expected_optilex_ttc: '0.00',
  received_owner: null, received_optilex_ttc: null,
  onboarding_pending: true,
  upcoming_period: '2026-10',
  upcoming_expected_owner: '369.60',
  upcoming_expected_optilex_ttc: '172.80',
  client: { rdv_onboarding: '2026-10-01' },
};

test("le montant suit la vision : Owner, Opti'Lex, somme en Globale", () => {
  assert.equal(scopedUpcomingExpected(n773, 'owner'), 369.6);
  assert.equal(scopedUpcomingExpected(n773, 'optilex'), 172.8);
  assert.equal(scopedUpcomingExpected(n773, 'global'), 542.4);
});

test("n°773 en vision Owner : « 369,60 € en octobre »", () => {
  const hint = upcomingExpectedHint(n773, 'owner', '01/10/2026');
  assert.equal(hint.label, '369,60 € en octobre');
  assert.equal(hint.period, '2026-10');
  assert.match(hint.title, /369,60 € attendus en octobre 2026, mois de l’onboarding du 01\/10\/2026\./);
  assert.match(hint.title, /pas compté dans le mois affiché/);
  assert.ok(!hint.title.includes('—') && !hint.label.includes('—'), 'pas de tiret cadratin');
});

test("vision Opti'Lex et Globale", () => {
  assert.equal(upcomingExpectedHint(n773, 'optilex').label, '172,80 € en octobre');
  assert.equal(upcomingExpectedHint(n773, 'global').label, '542,40 € en octobre');
});

test("sans date d'onboarding connue, l'infobulle ne l'invente pas", () => {
  const { title } = upcomingExpectedHint(n773, 'owner', null);
  assert.ok(title.startsWith('369,60 € attendus en octobre 2026, premier mois facturé. '));
});

test("n°756 : onboarding le 18/09, facturé dès octobre, l'infobulle ne dit pas « mois de l'onboarding »", () => {
  const n756 = { ...n773, onboarding_pending: false, client: { rdv_onboarding: '2026-09-18' } };
  const { title } = upcomingExpectedHint(n756, 'owner', '18/09/2026');
  assert.ok(title.startsWith('369,60 € attendus en octobre 2026, premier mois facturé. '));
  assert.ok(!title.includes('onboarding'));
  // Début de facturation repoussé par la finance : rendez-vous le 25/10, facturé dès novembre.
  const pushed = { ...n773, period: '2026-10-01', upcoming_period: '2026-11' };
  assert.ok(!upcomingExpectedHint(pushed, 'owner', '25/10/2026').title.includes('onboarding'));
  // Même mois, autre année : pas confondu.
  assert.ok(!upcomingExpectedHint(n773, 'owner', '01/10/2025').title.includes('onboarding'));
});

test("pas de mois à venir (API d'avant, ou cas non concerné) : aucune indication", () => {
  assert.equal(upcomingExpectedHint({ ...n773, upcoming_period: null }, 'owner'), null);
  const legacy = { ...n773 };
  delete legacy.upcoming_period;
  assert.equal(upcomingExpectedHint(legacy, 'global'), null);
  assert.equal(upcomingExpectedHint({ ...n773, upcoming_period: '2026-13' }, 'owner'), null);
});

test("rien dans la vision active : aucune indication (client sans Opti'Lex)", () => {
  const ownerOnly = { ...n773, upcoming_expected_optilex_ttc: null };
  assert.equal(upcomingExpectedHint(ownerOnly, 'optilex'), null);
  assert.equal(upcomingExpectedHint(ownerOnly, 'owner').label, '369,60 € en octobre');
});

test("décembre vers janvier : l'année est précisée", () => {
  const dec = { ...n773, period: '2026-12-01', upcoming_period: '2027-01' };
  assert.equal(upcomingExpectedHint(dec, 'owner').label, '369,60 € en janvier 2027');
});

test("l'indication ne compte dans aucun total du mois affiché", () => {
  const without = { ...n773, upcoming_period: null, upcoming_expected_owner: null, upcoming_expected_optilex_ttc: null };
  for (const scope of ['owner', 'optilex', 'global']) {
    assert.deepEqual(computeKpis([n773], scope), computeKpis([without], scope));
    assert.equal(computeKpis([n773], scope).expectedGlobal, 0);
  }
});
