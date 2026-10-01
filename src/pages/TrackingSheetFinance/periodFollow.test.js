// periodFollow.test.js : le mois affiché suit le mois en cours, sauf choix
// explicite d'un autre mois (incident 01/10/2026, onglet resté sur septembre).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initialPeriodState, choosePeriodState, followCurrentMonth, withPeriodParam, parisCurrentPeriod,
} from './periodFollow.js';

test("le mois en cours change à minuit à Paris, quel que soit le fuseau du poste", () => {
  // 30/09 23 h 30 à Paris (21 h 30 UTC, 17 h 30 à Montréal) : encore septembre.
  assert.equal(parisCurrentPeriod(new Date(Date.UTC(2026, 8, 30, 21, 30))), '2026-09');
  // 01/10 0 h 30 à Paris (22 h 30 UTC le 30/09, 18 h 30 à Montréal) : octobre.
  assert.equal(parisCurrentPeriod(new Date(Date.UTC(2026, 8, 30, 22, 30))), '2026-10');
  // Réveillon : 01/01/2027 0 h 30 à Paris = 31/12 23 h 30 UTC.
  assert.equal(parisCurrentPeriod(new Date(Date.UTC(2026, 11, 31, 23, 30))), '2027-01');
});

test("ouverte sans ?period=, la page suit le mois en cours", () => {
  assert.deepEqual(initialPeriodState(null, '2026-09'), { period: '2026-09', following: true });
  assert.deepEqual(initialPeriodState('n-importe-quoi', '2026-09'), { period: '2026-09', following: true });
});

test("?period= sur un autre mois fige l'affichage, sur le mois en cours il le suit", () => {
  assert.deepEqual(initialPeriodState('2026-08', '2026-09'), { period: '2026-08', following: false });
  assert.deepEqual(initialPeriodState('2026-09', '2026-09'), { period: '2026-09', following: true });
});

test("incident 01/10 : onglet ouvert le 30/09 sur septembre, il passe à octobre", () => {
  const eve = initialPeriodState(null, '2026-09');
  assert.deepEqual(followCurrentMonth(eve, '2026-10'), { period: '2026-10', following: true });
});

test("même mois : aucun changement, le même objet est rendu (pas de rendu React)", () => {
  const state = { period: '2026-09', following: true };
  assert.equal(followCurrentMonth(state, '2026-09'), state);
});

test("un mois choisi à la main n'est jamais écrasé", () => {
  const pinned = choosePeriodState('2026-08', '2026-09');
  assert.deepEqual(pinned, { period: '2026-08', following: false });
  assert.equal(followCurrentMonth(pinned, '2026-10'), pinned);
  // Mois suivant choisi à l'avance : il devient le mois en cours, mais reste figé.
  const ahead = choosePeriodState('2026-10', '2026-09');
  assert.equal(followCurrentMonth(ahead, '2026-10'), ahead);
});

test("revenir sur le mois en cours réactive le suivi", () => {
  const back = choosePeriodState('2026-09', '2026-09');
  assert.deepEqual(back, { period: '2026-09', following: true });
  assert.deepEqual(followCurrentMonth(back, '2026-10'), { period: '2026-10', following: true });
});

test("changement d'année : décembre suit sur janvier", () => {
  assert.deepEqual(
    followCurrentMonth({ period: '2026-12', following: true }, '2027-01'),
    { period: '2027-01', following: true },
  );
});

test("un mois courant illisible ne casse rien", () => {
  const state = { period: '2026-09', following: true };
  assert.equal(followCurrentMonth(state, ''), state);
  assert.equal(followCurrentMonth(state, undefined), state);
});

test("l'URL n'est réécrite que si elle porte un ?period= différent", () => {
  assert.equal(withPeriodParam('', '2026-10'), null);
  assert.equal(withPeriodParam('?embed=true', '2026-10'), null);
  assert.equal(withPeriodParam('?period=2026-10', '2026-10'), null);
  assert.equal(withPeriodParam('?embed=true&period=2026-09', '2026-10'), '?embed=true&period=2026-10');
});
