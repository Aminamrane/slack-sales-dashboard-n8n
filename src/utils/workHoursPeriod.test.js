// workHoursPeriod.test.js — les règles de la page « Heures de travail ».
//
// Brief dev 2026-09-04 : « base de 40 h par personne, attendu qui s'adapte
// aux absences, aux mi-temps et aux vacances ; 10 h × 4 jours avec vendredi
// absent = 40 h et 10 h/jour, pas 8 ; Ben fait 2 jours/semaine ; sur un mois
// précédent le classement doit être celui du mois. » Chaque test fixe une de
// ces règles sur des semaines fabriquées à la main.
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPeriod, aggregate, mondaysCovering, fmtH, HOURS_PER_DAY } from './workHoursPeriod.js';

// Une réponse d'API pour la semaine du lundi `monday`.
const week = (monday, people, countedUntil = null) => {
  const d0 = new Date(monday + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(d0); d.setDate(d.getDate() + i);
    return d.toLocaleDateString('fr-CA');
  });
  return { week_start: monday, days, counted_until: countedUntil || days[6], people };
};
const person = (email, daily, extra = {}) => ({
  email, name: email.split('@')[0], pole: 'Devs', accessible: true, avatar_url: null,
  daily, total: daily.reduce((a, b) => a + b, 0), vacation_days: [],
  working_days: [1, 2, 3, 4, 5], hours_per_day: HOURS_PER_DAY,
  ...extra,
});

test('semaine pleine : 5 jours × 8 h = 40 h attendues, moyenne 8 h/jour et 40 h/sem', () => {
  const r = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [person('a@x', [8, 8, 8, 8, 8, 0, 0])])] }).rows[0];
  assert.equal(r.expectedFull, 40);
  assert.equal(r.expectedNow, 40, 'semaine close : attendu plein');
  assert.equal(r.avgDay, 8);
  assert.equal(r.avgWeek, 40);
});

test('semaine en cours : l’attendu à ce stade suit les jours travaillés écoulés', () => {
  // Mercredi : 3 jours écoulés sur 5 → 24 h attendus à ce stade.
  const r = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [person('a@x', [8, 8, 8, 0, 0, 0, 0])], '2026-09-02')] }).rows[0];
  assert.equal(r.expectedFull, 40);
  assert.equal(r.expectedNow, 24);
  assert.equal(r.cells[3].future, true, 'jeudi est à venir');
  assert.equal(r.avgDay, 8, 'la moyenne ne divise que par les jours écoulés');
});

test('Ben : 2 jours travaillés par semaine = 16 h attendues, et l’attendu à ce stade suit SES jours', () => {
  const ben = person('b@x', [8, 8, 0, 0, 0, 0, 0], { working_days: [1, 2] });
  const closed = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [ben])] }).rows[0];
  assert.equal(closed.base, 16);
  assert.equal(closed.expectedFull, 16);
  assert.equal(closed.avgWeek, 16, 'équivalent semaine = 8 h × 2 jours');
  // Mercredi : ses deux jours sont passés → 16 h attendus à ce stade, pas 9,6.
  const wednesday = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [ben], '2026-09-02')] }).rows[0];
  assert.equal(wednesday.expectedNow, 16);
});

test('base horaire posée (35 h) : répartie sur les jours travaillés', () => {
  const p = person('a@x', [7, 7, 7, 7, 7, 0, 0], { hours_per_day: 7, expected_base: 35 });
  const r = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [p])] }).rows[0];
  assert.equal(r.expectedFull, 35);
});

test('absence validée : 10 h × 4 jours, vendredi absent = 40 h flat et 10 h/jour', () => {
  const p = person('a@x', [10, 10, 10, 10, 0, 0, 0], { vacation_days: ['2026-09-04'] });
  const r = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [p])] }).rows[0];
  assert.equal(r.expectedFull, 32, '4 jours disponibles × 8 h');
  assert.equal(r.total, 40);
  assert.equal(r.avgDay, 10, 'divisé par 4, pas par 5');
  assert.equal(r.avgWeek, 50);
  assert.equal(r.vacCount, 1);
  assert.equal(r.cells[4].vacAll, true);
});

test('week-end : compté dans le réalisé, jamais dans l’attendu', () => {
  const p = person('a@x', [8, 8, 8, 8, 8, 4, 0]);
  const r = buildPeriod({ mode: 'week', weeks: [week('2026-08-31', [p])] }).rows[0];
  assert.equal(r.total, 44);
  assert.equal(r.expectedFull, 40);
});

test('mois : les semaines à cheval ne comptent que leurs jours du mois', () => {
  // Septembre 2026 commence un mardi : la semaine du 31/08 apporte 4 jours ouvrés.
  const w1 = week('2026-08-31', [person('a@x', [10, 8, 8, 8, 8, 0, 0])]);   // lundi 31/08 = 10 h HORS mois
  const w2 = week('2026-09-07', [person('a@x', [8, 8, 8, 8, 8, 0, 0])]);
  const p = buildPeriod({ mode: 'month', weeks: [w1, w2], y: 2026, m: 8 });
  assert.equal(p.cells.length, 2, 'une cellule par semaine');
  const r = p.rows[0];
  assert.equal(r.cells[0].hours, 32, 'le lundi 31 août ne compte pas');
  assert.equal(r.total, 72);
  assert.equal(r.expectedFull, 8 * 4 + 40, '4 jours ouvrés puis 5');
});

test('mois : le classement est celui du mois, pas de la dernière semaine', () => {
  const a = (d) => person('a@x', d);
  const b = (d) => person('b@x', d);
  const w1 = week('2026-06-01', [a([10, 10, 10, 10, 10, 0, 0]), b([6, 6, 6, 6, 6, 0, 0])]);
  const w2 = week('2026-06-08', [a([2, 2, 2, 2, 2, 0, 0]), b([9, 9, 9, 9, 9, 0, 0])]);
  const rows = buildPeriod({ mode: 'month', weeks: [w1, w2], y: 2026, m: 5 }).rows;
  const byEmail = Object.fromEntries(rows.map((r) => [r.email, r]));
  assert.equal(byEmail['a@x'].total, 60);
  assert.equal(byEmail['b@x'].total, 75, 'b est premier sur le mois malgré une dernière semaine plus forte chez a');
});

test('mois en cours : les jours à venir ne comptent ni en réalisé ni en attendu', () => {
  const w1 = week('2026-09-07', [person('a@x', [8, 8, 8, 8, 8, 0, 0])], '2026-09-09');
  const r = buildPeriod({ mode: 'month', weeks: [w1], y: 2026, m: 8 }).rows[0];
  assert.equal(r.total, 24, 'mercredi inclus, jeudi et vendredi non');
  assert.equal(r.expectedNow, 24);
  assert.equal(r.expectedFull, 40);
});

test('agrégat : total, attendu et moyennes par personne du groupe coché', () => {
  const w = week('2026-08-31', [
    person('a@x', [8, 8, 8, 8, 8, 0, 0]),
    person('b@x', [8, 8, 0, 0, 0, 0, 0], { working_days: [1, 2] }),
  ]);
  const agg = aggregate(buildPeriod({ mode: 'week', weeks: [w] }).rows);
  assert.equal(agg.total, 56);
  assert.equal(agg.expected, 56, '40 h + 16 h : l’attendu du pôle tient compte du temps partiel');
  assert.equal(agg.avgDay, 8);
  assert.equal(agg.avgWeek, 28, 'moyenne des équivalents semaine (40 et 16)');
});

test('mondaysCovering : toutes les semaines qui touchent le mois', () => {
  assert.deepEqual(mondaysCovering(2026, 8), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
});

test('fmtH : heures et minutes lisibles', () => {
  assert.equal(fmtH(8), '8h');
  assert.equal(fmtH(7.5), '7h30');
  assert.equal(fmtH(-1.25), '−1h15');
  assert.equal(fmtH(7.999), '8h');
});
