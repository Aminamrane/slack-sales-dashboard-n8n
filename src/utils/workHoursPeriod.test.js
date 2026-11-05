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

import {
  buildPeriod, aggregate, mondaysCovering, fmtH, HOURS_PER_DAY,
  isIsoDay, normalizeHistory, scheduleOf, draftFromRow, validateDraft,
} from './workHoursPeriod.js';

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

test('une demi-journée réduit l’attendu de 4 h et conserve le travail réalisé', () => {
  const w = week('2026-09-21', [person('half@example.test', [4,8,8,8,8,0,0], { vacation_days: ['2026-09-21'], vacation_periods: { '2026-09-21': 'am' } })]);
  const row = buildPeriod({ mode: 'week', weeks: [w] }).rows[0];
  assert.equal(row.vacCount, 0.5);
  assert.equal(row.expectedFull, 36);
  assert.equal(row.total, 36);
  assert.equal(row.avgDay, 8);
  assert.equal(row.cells[0].vacAll, false);
  assert.equal(row.cells[0].absenceDays, 0.5);
});

test('le mois additionne les demi-journées sans neutraliser leur autre moitié', () => {
  const w = week('2026-09-21', [person('half@example.test', [4,8,8,8,8,0,0], { vacation_periods: { '2026-09-21': 'pm', '2026-09-27': 'am' } })]);
  const row = buildPeriod({ mode: 'month', weeks: [w], y: 2026, m: 8 }).rows[0];
  assert.equal(row.vacCount, 0.5);
  assert.equal(row.expectedFull, 36);
  assert.equal(row.cells[0].vacAll, false);
});


test('les semaines restent des lundis au changement d’heure', () => {
  assert.deepEqual(mondaysCovering(2026, 9), ['2026-09-28','2026-10-05','2026-10-12','2026-10-19','2026-10-26']);
  assert.deepEqual(mondaysCovering(2026, 2), ['2026-02-23','2026-03-02','2026-03-09','2026-03-16','2026-03-23','2026-03-30']);
});

/* ═══════════ Planning daté (2026-11-05) : arrivée en cours de mois et rythme à chaque date ═══════════
 *
 * Brief : « un employé qui arrive le 15 novembre n'a pas travaillé depuis le 1er » ; « du 1er au 10 il fait
 * 2 jours par semaine, à partir du 11 il en fait 4 : le nouveau rythme ne vaut pas pour tout le mois ».
 * Les valeurs attendues ci-dessous ont été calculées À PART (calendrier Python, jour par jour) puis recopiées
 * ici avec la liste des jours retenus : chaque test dit quels jours comptent. Novembre 2026 : le 1er est un
 * dimanche ; lun-jeu = [1,2,3,4], lun-mar = [1,2].
 */

const H = (...days) => days; // lisibilité : H(1, 2) = lundi, mardi
const key = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Les semaines d'API d'un mois (m = 1-12), la même personne dans chacune ; `onDays` : { 'AAAA-MM-JJ': heures }.
function monthRow(y, m, extra = {}, { onDays = {}, countedUntil = null, email = 'a@x' } = {}) {
  const mondays = mondaysCovering(y, m - 1);
  const weeks = mondays.map((mo, i) => {
    const w = week(mo, [], i === mondays.length - 1 ? countedUntil : null);
    w.people = [person(email, w.days.map((d) => onDays[d] ?? 0), extra)];
    return w;
  });
  return buildPeriod({ mode: 'month', weeks, y, m: m - 1 }).rows[0];
}
const weekRow = (monday, extra = {}, daily = [0, 0, 0, 0, 0, 0, 0], countedUntil = null) =>
  buildPeriod({ mode: 'week', weeks: [week(monday, [person('a@x', daily, extra)], countedUntil)] }).rows[0];
const worked = (y, m, days, h = 8) => Object.fromEntries(days.map((d) => [key(y, m, d), h]));

test('cas 1 — arrivée le 15 novembre à 4 j/sem : seuls les jours du rythme à partir du 15 comptent', () => {
  // lun-jeu à partir du dimanche 15 : 16-19, 23-26, 30 = 9 jours = 72 h (sans date d'arrivée : 17 jours = 136 h).
  const days = [16, 17, 18, 19, 23, 24, 25, 26, 30];
  const plan = { working_days: H(1, 2, 3, 4), start_date: '2026-11-15', working_days_history: [] };
  const r = monthRow(2026, 11, plan, { onDays: worked(2026, 11, days) });
  assert.equal(r.availableDays, 9);
  assert.equal(r.expectedFull, 72);
  assert.equal(r.expectedNow, 72, 'mois clos : tout est écoulé');
  assert.equal(r.total, 72, 'le réalisé est celui de l’agenda, intact');
  assert.equal(r.avgDay, 8);
  assert.equal(r.avgWeek, 32, '8 h × 4 jours par semaine');
  assert.equal(r.arrival, '2026-11-15');
  assert.equal(r.start, '2026-11-15');
  assert.equal(r.notArrived, false);
  // Sans date d'arrivée, même rythme : l'ancien calcul (tout le mois).
  const avant = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), working_days_history: [] });
  assert.equal(avant.availableDays, 17);
  assert.equal(avant.expectedFull, 136);
});

test('cas 1 — le détail du mois : les semaines d’avant l’arrivée sont signalées, pas comptées', () => {
  const r = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), start_date: '2026-11-15', working_days_history: [] });
  // Cellules = semaines touchant novembre : 26/10 (le 1er seul), 2/11, 9/11 (contient le 15), 16/11, 23/11, 30/11.
  assert.deepEqual(r.cells.map((c) => c.beforeStart), [true, true, false, false, false, false]);
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.employed, s.scheduled]), [
    ['2026-11-01', '2026-11-14', false, 0],
    ['2026-11-15', '2026-11-30', true, 9],
  ]);
  assert.equal(r.rhythmLabel, '4 j/sem');
  assert.equal(r.rhythmChanged, false);
  // Le mois suivant, l'arrivée est derrière : rien à signaler, tout compte.
  const dec = monthRow(2026, 12, { working_days: H(1, 2, 3, 4), start_date: '2026-11-15', working_days_history: [] });
  assert.equal(dec.arrival, null);
  assert.equal(dec.cells.some((c) => c.beforeStart), false);
});

test('cas 2 — de 2 à 4 jours le 11 novembre : chaque période utilise son rythme, pas le dernier pour tout le mois', () => {
  // 1→10 lun-mar : 2, 3, 9, 10 (4 j) ; dès le 11 lun-jeu : 11, 12, 16-19, 23-26, 30 (11 j) → 15 j = 120 h.
  const days = [2, 3, 9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25, 26, 30];
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const r = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), working_days_history: history }, { onDays: worked(2026, 11, days) });
  assert.equal(r.availableDays, 15);
  assert.equal(r.expectedFull, 120);
  assert.notEqual(r.expectedFull, 136, '4 jours appliqués à tout le mois = l’erreur à ne pas faire');
  assert.notEqual(r.expectedFull, 72, '2 jours appliqués à tout le mois = l’erreur inverse');
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.days, s.scheduled]), [
    ['2026-11-01', '2026-11-10', [1, 2], 4],
    ['2026-11-11', '2026-11-30', [1, 2, 3, 4], 11],
  ]);
  assert.equal(r.segments.reduce((a, s) => a + s.available * r.perDay, 0), r.expectedFull, 'la somme des périodes est l’attendu');
  assert.equal(r.rhythmLabel, '2 → 4 j/sem');
  assert.equal(r.rhythmChanged, true);
  assert.deepEqual(r.workingDays, [1, 2, 3, 4], 'rythme affiché = celui en vigueur en fin de période');
  assert.equal(r.avgDay, 8, '120 h réalisées sur 15 jours attendus');
  // Équivalent semaine pondéré par les jours écoulés : 10 j à 2/sem + 20 j à 4/sem = 100/30 jours par semaine.
  assert.ok(Math.abs(r.weekDays - 100 / 30) < 1e-9);
  assert.ok(Math.abs(r.avgWeek - 8 * (100 / 30)) < 1e-9);
});

test('cas 2 — vue semaine : la semaine du changement mélange les deux rythmes jour par jour', () => {
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const plan = { working_days: H(1, 2, 3, 4), working_days_history: history };
  // 9-15 nov. : lun 9 + mar 10 (ancien rythme), mer 11 + jeu 12 (nouveau) ; vendredi 13 n'est dans aucun → 4 j.
  assert.equal(weekRow('2026-11-09', plan).expectedFull, 32);
  // 2-8 nov. : ancien rythme seul (lun 2, mar 3) → 16 h ; mer 4 et jeu 5 ne comptent pas encore.
  assert.equal(weekRow('2026-11-02', plan).expectedFull, 16);
  // 16-22 nov. : nouveau rythme seul → 32 h.
  assert.equal(weekRow('2026-11-16', plan).expectedFull, 32);
});

test('cas 3 — de 4 à 2 jours le 11 novembre : le sens inverse fonctionne aussi', () => {
  // 1→10 lun-jeu : 2, 3, 4, 5, 9, 10 (6 j) ; dès le 11 lun-mar : 16, 17, 23, 24, 30 (5 j) → 11 j = 88 h.
  const history = [{ effective_from: null, days: H(1, 2, 3, 4) }, { effective_from: '2026-11-11', days: H(1, 2) }];
  const r = monthRow(2026, 11, { working_days: H(1, 2), working_days_history: history });
  assert.equal(r.availableDays, 11);
  assert.equal(r.expectedFull, 88);
  assert.equal(r.rhythmLabel, '4 → 2 j/sem');
  assert.deepEqual(r.workingDays, [1, 2]);
});

test('cas 3 bis — 3 → 5 jours et 5 → 3 jours (mer-ven / lun-ven) à une date de milieu de mois', () => {
  // Calculs séparés (calendrier Python). 3 j = lun, mer, ven ; 5 j = lun-ven ; changement le 12/11 (jeudi).
  const up = [{ effective_from: null, days: H(1, 3, 5) }, { effective_from: '2026-11-12', days: H(1, 2, 3, 4, 5) }];
  const down = [{ effective_from: null, days: H(1, 2, 3, 4, 5) }, { effective_from: '2026-11-12', days: H(1, 3, 5) }];
  // 3→5 : 1-11 lun/mer/ven = 2, 4, 6, 9, 11 (5 j) ; 12-30 lun-ven = 12, 13, 16-20, 23-27, 30 (13 j) → 18 j.
  assert.equal(monthRow(2026, 11, { working_days_history: up }).availableDays, 18);
  // 5→3 : 1-11 lun-ven = 2-6, 9-11 (8 j) ; 12-30 lun/mer/ven = 13, 16, 18, 20, 23, 25, 27, 30 (8 j) → 16 j.
  assert.equal(monthRow(2026, 11, { working_days_history: down }).availableDays, 16);
});

test('cas 4 — plusieurs changements dans le même mois : chaque période est calculée à part', () => {
  // [1,2] ; 04/11 → lun-ven ; 12/11 → mer-jeu ; 20/11 → lun-sam. Jours : 2, 3 | 4, 5, 6, 9, 10, 11 | 12, 18, 19 |
  // 20, 21, 23-26 (lun-jeu), 27, 28, 30 → 2 + 6 + 3 + 9 = 20 j = 160 h.
  const history = [
    { effective_from: null, days: H(1, 2) },
    { effective_from: '2026-11-04', days: H(1, 2, 3, 4, 5) },
    { effective_from: '2026-11-12', days: H(3, 4) },
    { effective_from: '2026-11-20', days: H(1, 2, 3, 4, 5, 6) },
  ];
  const r = monthRow(2026, 11, { working_days: H(1, 2, 3, 4, 5, 6), working_days_history: history });
  assert.equal(r.expectedFull, 160);
  assert.deepEqual(r.segments.map((s) => s.scheduled), [2, 6, 3, 9]);
  assert.equal(r.segments.length, 4);
  assert.equal(r.rhythmLabel, '2 → 5 → 2 → 6 j/sem');
});

test('cas 5 — arrivée puis changement de rythme : rien avant l’arrivée, chaque période a son rythme', () => {
  // Arrivée mardi 10/11, lun-jeu puis lun-mar dès le 13/11 : 10, 11, 12 | 16, 17, 23, 24, 30 → 8 j = 64 h.
  const history = [{ effective_from: null, days: H(1, 2, 3, 4) }, { effective_from: '2026-11-13', days: H(1, 2) }];
  const r = monthRow(2026, 11, { working_days: H(1, 2), start_date: '2026-11-10', working_days_history: history });
  assert.equal(r.expectedFull, 64);
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.employed, s.scheduled]), [
    ['2026-11-01', '2026-11-09', false, 0],
    ['2026-11-10', '2026-11-12', true, 3],
    ['2026-11-13', '2026-11-30', true, 5],
  ]);
  // Sans l'arrivée, les 2, 3, 4, 5 et 9 novembre auraient compté : 13 j = 104 h.
  assert.equal(monthRow(2026, 11, { working_days: H(1, 2), working_days_history: history }).expectedFull, 104);
});

test('cas 5 bis — un changement daté AVANT l’arrivée : c’est le rythme en vigueur le jour de l’arrivée qui joue', () => {
  // lun-jeu puis lun-mar dès le 05/11 ; arrivée le 10/11 → lun-mar : 10, 16, 17, 23, 24, 30 → 6 j = 48 h.
  const history = [{ effective_from: null, days: H(1, 2, 3, 4) }, { effective_from: '2026-11-05', days: H(1, 2) }];
  const r = monthRow(2026, 11, { start_date: '2026-11-10', working_days_history: history });
  assert.equal(r.expectedFull, 48);
  assert.deepEqual(r.workingDays, [1, 2]);
});

test('cas 5 ter — vue semaine : arrivée et changement dans la même semaine', () => {
  // Semaine du 9 au 15/11, arrivée mardi 10, lun-jeu puis lun-mar dès le vendredi 13 : mar 10, mer 11, jeu 12 → 24 h.
  const history = [{ effective_from: null, days: H(1, 2, 3, 4) }, { effective_from: '2026-11-13', days: H(1, 2) }];
  const r = weekRow('2026-11-09', { start_date: '2026-11-10', working_days_history: history });
  assert.equal(r.expectedFull, 24);
  assert.deepEqual(r.cells.map((c) => c.beforeStart), [true, false, false, false, false, false, false], 'seul le lundi précède l’arrivée');
  // La semaine d'après : lun 16 + mar 17 → 16 h.
  assert.equal(weekRow('2026-11-16', { start_date: '2026-11-10', working_days_history: history }).expectedFull, 16);
});

test('cas 6 — mois de 28, 29, 30 et 31 jours (lun-ven, février bissextile compris)', () => {
  const plan = { working_days_history: [{ effective_from: null, days: H(1, 2, 3, 4, 5) }] };
  assert.equal(monthRow(2027, 2, plan).expectedFull, 160, 'février 2027 : 28 jours, 20 jours ouvrés');
  assert.equal(monthRow(2028, 2, plan).expectedFull, 168, 'février 2028 bissextile : 29 jours, 21 jours ouvrés');
  assert.equal(monthRow(2026, 4, plan).expectedFull, 176, 'avril 2026 : 30 jours, 22 jours ouvrés');
  assert.equal(monthRow(2027, 1, plan).expectedFull, 168, 'janvier 2027 : 31 jours, 21 jours ouvrés');
  // Le 29 février compte bien (mardi) : arrivée ce jour-là = 1 journée.
  assert.equal(monthRow(2028, 2, { ...plan, start_date: '2028-02-29' }).expectedFull, 8);
});

test('cas 6 — un changement le 1er du mois vaut pour tout le mois, et laisse le mois précédent intact', () => {
  // lun-ven puis lun-mar dès le lundi 01/02/2027 : février = 1, 2, 8, 9, 15, 16, 22, 23 (8 j) ; janvier inchangé (21 j).
  const history = [{ effective_from: null, days: H(1, 2, 3, 4, 5) }, { effective_from: '2027-02-01', days: H(1, 2) }];
  assert.equal(monthRow(2027, 2, { working_days_history: history }).expectedFull, 64);
  assert.equal(monthRow(2027, 1, { working_days_history: history }).expectedFull, 168);
  assert.equal(monthRow(2027, 2, { working_days_history: history }).rhythmChanged, false, 'un seul rythme dans février');
});

test('cas 6 — un changement le dernier jour du mois ne touche que ce jour ; le lendemain, rien', () => {
  // lun-ven puis mardi seul dès le 29/02/2028 (mardi, dernier jour) : février garde 21 j (le 29 est un mardi) ;
  // mars 2028 = les mardis 7, 14, 21, 28 (4 j).
  const last = [{ effective_from: null, days: H(1, 2, 3, 4, 5) }, { effective_from: '2028-02-29', days: H(2) }];
  const fev = monthRow(2028, 2, { working_days_history: last });
  assert.equal(fev.expectedFull, 168);
  assert.deepEqual(fev.segments.map((s) => [s.from, s.to]), [['2028-02-01', '2028-02-28'], ['2028-02-29', '2028-02-29']]);
  assert.equal(monthRow(2028, 3, { working_days_history: last }).expectedFull, 32);
  // Dès le 01/03/2028 : février est inchangé à 21 j.
  const next = [{ effective_from: null, days: H(1, 2, 3, 4, 5) }, { effective_from: '2028-03-01', days: H(2) }];
  const fev2 = monthRow(2028, 2, { working_days_history: next });
  assert.equal(fev2.expectedFull, 168);
  assert.equal(fev2.segments.length, 1);
});

test('cas 6 — l’arrivée le 1er, le dernier jour, ou après le mois', () => {
  const plan = { working_days_history: [{ effective_from: null, days: H(1, 2, 3, 4, 5) }] };
  assert.equal(monthRow(2027, 2, { ...plan, start_date: '2027-02-01' }).expectedFull, 160, 'arrivée le 1er : tout le mois');
  const futur = monthRow(2027, 2, { ...plan, start_date: '2027-03-01' });
  assert.equal(futur.expectedFull, 0);
  assert.equal(futur.availableDays, 0);
  assert.equal(futur.avgDay, null, 'pas de jour attendu : pas de moyenne');
  assert.equal(futur.notArrived, true);
  assert.equal(futur.arrival, '2027-03-01');
  assert.equal(futur.cells.every((c) => c.beforeStart), true);
});

test('cas 6 — les mois se suivent sans trou ni doublon (une année entière, rythme changeant à des dates variées)', () => {
  const history = [
    { effective_from: null, days: H(1, 2, 3, 4, 5) },
    { effective_from: '2026-03-31', days: H(1, 2, 3) },
    { effective_from: '2026-06-01', days: H(2, 4) },
    { effective_from: '2026-09-30', days: H(1, 2, 3, 4, 5, 6, 7) },
  ];
  let parMois = 0;
  for (let m = 1; m <= 12; m++) parMois += monthRow(2026, m, { start_date: '2026-02-17', working_days_history: history }).availableDays;
  // Décompte direct de l'année, jour par jour, sans passer par buildPeriod.
  let direct = 0;
  for (let t = Date.UTC(2026, 1, 17); t < Date.UTC(2027, 0, 1); t += 86400000) {
    const d = new Date(t); const iso = d.toISOString().slice(0, 10); const wd = d.getUTCDay() || 7;
    const days = iso >= '2026-09-30' ? [1, 2, 3, 4, 5, 6, 7] : iso >= '2026-06-01' ? [2, 4] : iso >= '2026-03-31' ? [1, 2, 3] : [1, 2, 3, 4, 5];
    if (days.includes(wd)) direct += 1;
  }
  assert.equal(parMois, direct);
});

test('cas 7 — absences : seules comptent celles qui tombent un jour travaillé CE jour-là, au rythme de ce jour-là', () => {
  // Cas 2 (lun-mar puis lun-jeu dès le 11) avec une absence mer 4/11 (rythme lun-mar : pas un jour travaillé → aucun effet)
  // et mer 18/11 (rythme lun-jeu : jour travaillé → -1) : 15 - 1 = 14 j = 112 h.
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const r = monthRow(2026, 11, {
    working_days_history: history,
    vacation_days: ['2026-11-04', '2026-11-18'],
    vacation_periods: { '2026-11-04': 'full', '2026-11-18': 'full' },
  });
  assert.equal(r.availableDays, 14);
  assert.equal(r.expectedFull, 112);
  assert.equal(r.vacCount, 1, 'l’absence du 4/11 ne se compte pas : ce jour-là n’était pas travaillé');
});

test('cas 7 — dans le détail du jour, l’absence ne se voit que sur un jour réellement travaillé ce jour-là', () => {
  // Rythme lun-mar jusqu'au 10/11 puis lun-jeu. Semaine du 2/11 : mercredi 4 n'est pas travaillé → pas d'absence affichée ;
  // semaine du 16/11 : mercredi 18 l'est → journée d'absence neutralisée ; semaine du 9/11, arrivée le mardi 10 : le lundi 9 d'avant.
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const mer4 = weekRow('2026-11-02', { working_days_history: history, vacation_days: ['2026-11-04'], vacation_periods: { '2026-11-04': 'full' } });
  assert.deepEqual([mer4.cells[2].vac, mer4.cells[2].absenceDays, mer4.cells[2].vacAll], [false, 0, false]);
  assert.equal(mer4.expectedFull, 16, 'lun 2 + mar 3 : l’absence du mercredi ne retire rien');
  const mer18 = weekRow('2026-11-16', { working_days_history: history, vacation_days: ['2026-11-18'], vacation_periods: { '2026-11-18': 'full' } });
  assert.deepEqual([mer18.cells[2].vac, mer18.cells[2].absenceDays, mer18.cells[2].vacAll], [true, 1, true]);
  assert.equal(mer18.expectedFull, 24, 'lun-jeu moins le mercredi absent');
  const lun9 = weekRow('2026-11-09', { start_date: '2026-11-10', working_days_history: history, vacation_days: ['2026-11-09'], vacation_periods: { '2026-11-09': 'full' } });
  assert.deepEqual([lun9.cells[0].vac, lun9.cells[0].beforeStart], [false, true], 'une absence avant l’arrivée n’est pas une absence');
});

test('cas 7 — une demi-journée réduit l’attendu de 4 h ; une absence avant l’arrivée ne compte pas', () => {
  // Cas 1 + demi-journée lun 16/11 + absence lun 09/11 (avant l'arrivée du 15) : 9 - 0,5 = 8,5 j = 68 h.
  const r = monthRow(2026, 11, {
    working_days: H(1, 2, 3, 4), start_date: '2026-11-15', working_days_history: [],
    vacation_periods: { '2026-11-16': 'am', '2026-11-09': 'full' },
  });
  assert.equal(r.expectedFull, 68);
  assert.equal(r.vacCount, 0.5);
});

test('cas 7 — le réalisé reste celui de l’agenda : arrivée et rythme ne le modifient jamais', () => {
  const onDays = worked(2026, 11, [2, 3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25, 26, 30], 6);
  const sans = monthRow(2026, 11, { working_days: H(1, 2, 3, 4) }, { onDays });
  const avec = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), start_date: '2026-11-15', working_days_history: [] }, { onDays });
  assert.equal(sans.total, 17 * 6);
  assert.equal(avec.total, sans.total, 'les heures faites avant la date d’arrivée sont gardées telles quelles, jamais effacées');
  assert.equal(sans.expectedFull, 136);
  assert.equal(avec.expectedFull, 72, 'seul l’attendu change');
  // L'écart se lit réalisé - attendu : deux grandeurs distinctes.
  assert.equal(avec.total - avec.expectedNow, 17 * 6 - 72);
});

test('mois en cours : l’attendu à ce stade ne compte que les jours écoulés depuis l’arrivée, au bon rythme', () => {
  // Cas 2 jusqu'au mercredi 18/11 inclus : 2, 3, 9, 10, 11, 12, 16, 17, 18 = 9 j écoulés sur 15 prévus.
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const r = monthRow(2026, 11, { working_days_history: history }, { countedUntil: '2026-11-18' });
  assert.equal(r.expectedFull, 120);
  assert.equal(r.expectedNow, 72);
  assert.equal(r.elapsedDays, 9);
  // Équivalent semaine : seulement sur les jours écoulés (1-18 : 10 j à 2/sem, 8 j à 4/sem).
  assert.ok(Math.abs(r.weekDays - (10 * 2 + 8 * 4) / 18) < 1e-9);
  // Arrivée à venir dans le mois (le 25) : rien d'écoulé, mais l'attendu du mois est déjà connu (25, 26, 30 = 3 j).
  const futur = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), start_date: '2026-11-25', working_days_history: [] }, { countedUntil: '2026-11-18' });
  assert.equal(futur.expectedFull, 24);
  assert.equal(futur.expectedNow, 0);
  assert.equal(futur.avgDay, null);
  assert.equal(futur.notArrived, false, 'il arrive ce mois-ci : il a des jours attendus');
});

test('base hebdomadaire posée (20 h) : les heures par jour suivent le rythme de CHAQUE période', () => {
  // 20 h par semaine = 10 h/jour à 2 jours, 5 h/jour à 4 jours. Novembre : 1→10 lun-mar = 4 j × 10 h = 40 h ;
  // dès le 11 lun-jeu = 11 j × 5 h = 55 h → 95 h. (Heures/jour figées à 5 h partout : 75 h, faux ; à 10 h partout : 150 h, faux.)
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const plan = { working_days: H(1, 2, 3, 4), hours_per_day: 5, expected_base: 20, weekly_expected_hours: 20, working_days_history: history };
  const r = monthRow(2026, 11, plan);
  assert.equal(r.expectedFull, 95);
  assert.deepEqual(r.segments.map((x) => [x.perDay, x.scheduled]), [[10, 4], [5, 11]]);
  // Mêmes chiffres que le serveur (test_work_hours_schedule.py, octobre décalé de 4 semaines) : 20 h, 30 h, 20 h.
  assert.equal(weekRow('2026-11-02', plan).expectedFull, 20);
  assert.equal(weekRow('2026-11-09', plan).expectedFull, 30, '2 jours à 10 h puis 2 jours à 5 h');
  assert.equal(weekRow('2026-11-16', plan).expectedFull, 20);
  // Sans base posée (champ nul), heures/jour constantes : le produit d'avant.
  const sans = monthRow(2026, 11, { ...plan, weekly_expected_hours: null });
  assert.equal(sans.expectedFull, 15 * 5);
  // Arrivée + base : seuls les jours après l'arrivée, chacun à ses heures.
  assert.equal(monthRow(2026, 11, { ...plan, start_date: '2026-11-12' }).expectedFull, 5 * 10, 'dès le jeudi 12 : 12, 16-19, 23-26, 30 = 10 jours à 5 h');
});

test('base hebdomadaire posée, mois en cours : l’attendu à ce stade suit aussi les heures de chaque période', () => {
  // Jusqu'au mercredi 18/11 : 2, 3, 9, 10 à 10 h (lun-mar) = 40 h ; 11, 12, 16, 17, 18 à 5 h (lun-jeu) = 25 h → 65 h
  // (heures/jour figées à 5 h partout : 9 j × 5 h = 45 h, faux).
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(1, 2, 3, 4) }];
  const plan = { working_days: H(1, 2, 3, 4), hours_per_day: 5, expected_base: 20, weekly_expected_hours: 20, working_days_history: history };
  const r = monthRow(2026, 11, plan, { countedUntil: '2026-11-18' });
  assert.equal(r.expectedNow, 65);
  assert.equal(r.expectedFull, 95);
  assert.equal(r.elapsedDays, 9);
});

test('rythme qui change de jours sans changer de nombre : détecté, mais le libellé ne répète pas « 2 → 2 »', () => {
  // lun-mar puis jeu-ven dès le 11/11 : 2, 3, 9, 10 | 12, 13, 19, 20, 26, 27 = 10 j.
  const history = [{ effective_from: null, days: H(1, 2) }, { effective_from: '2026-11-11', days: H(4, 5) }];
  const r = monthRow(2026, 11, { working_days: H(4, 5), working_days_history: history });
  assert.equal(r.availableDays, 10);
  assert.equal(r.rhythmChanged, true, 'les jours ne sont plus les mêmes');
  assert.equal(r.rhythmLabel, '2 j/sem');
});

test('anciens profils : sans date d’arrivée ni historique, le calcul est exactement celui d’avant', () => {
  const ancien = monthRow(2026, 11, { working_days: H(1, 2, 3, 4) });             // champs absents (API pas encore à jour)
  const vide = monthRow(2026, 11, { working_days: H(1, 2, 3, 4), start_date: null, working_days_history: [] }); // API à jour, rien de saisi
  for (const r of [ancien, vide]) {
    assert.equal(r.expectedFull, 136);
    assert.equal(r.availableDays, 17);
    assert.equal(r.arrival, null);
    assert.equal(r.rhythmChanged, false);
  }
  assert.equal(ancien.scheduleSupported, false, 'API sans les nouveaux champs : l’éditeur d’avant reste proposé');
  assert.equal(vide.scheduleSupported, true);
  // Une arrivée sans historique : le rythme actuel vaut dès l'arrivée.
  assert.equal(monthRow(2026, 11, { working_days: H(1, 2, 3, 4), start_date: '2026-11-15' }).expectedFull, 72);
});

test('données bancales : entrées invalides ignorées, doublon à la même date = le dernier gagne, ordre libre', () => {
  assert.deepEqual(normalizeHistory([
    { effective_from: '2026-11-20', days: ['1', 2, 2, 9, 'x'] },      // jours nettoyés → [1, 2]
    { effective_from: '2026-11-11', days: [] },                       // sans jour : écartée
    { effective_from: '2026-02-30', days: [1] },                      // date impossible : écartée
    { effective_from: null, days: [5, 3] },
    { effective_from: '2026-11-20', days: [4] },                      // même date : celle-ci gagne
    null,
  ]), [{ from: null, days: [3, 5] }, { from: '2026-11-20', days: [4] }]);
  assert.equal(isIsoDay('2026-02-29'), false);
  assert.equal(isIsoDay('2028-02-29'), true);
  assert.equal(isIsoDay('2026-1-5'), false);
  assert.equal(isIsoDay(undefined), false);
  // Une date d'arrivée invalide est ignorée : on ne casse pas le calcul.
  assert.equal(scheduleOf({ working_days: [1], start_date: 'bientôt' }).start, null);
  // Historique sans rythme initial : le premier rythme connu vaut aussi avant sa date (comme avant, sans trou).
  const s = scheduleOf({ working_days_history: [{ effective_from: '2026-11-11', days: [1, 2, 3, 4] }] });
  assert.deepEqual(s.rhythmOn('2026-11-01'), [1, 2, 3, 4]);
  assert.deepEqual(s.rhythmOn('2026-12-01'), [1, 2, 3, 4]);
  // Plusieurs changements datés et toujours pas de rythme initial : avant la 1re date, c'est le 1er rythme (pas le dernier).
  const t = scheduleOf({ working_days_history: [{ effective_from: '2026-11-11', days: [1, 2] }, { effective_from: '2026-11-20', days: [1, 2, 3, 4, 5] }] });
  assert.deepEqual(t.rhythmOn('2026-11-01'), [1, 2]);
  assert.deepEqual(t.rhythmOn('2026-11-19'), [1, 2]);
  assert.deepEqual(t.rhythmOn('2026-11-20'), [1, 2, 3, 4, 5]);
});

test('agrégat : l’attendu du groupe additionne des personnes arrivées à des dates différentes', () => {
  const w = week('2026-11-09', [
    person('a@x', [0, 0, 0, 0, 0, 0, 0], { start_date: '2026-11-10', working_days_history: [] }),   // mar-ven : 4 j
    person('b@x', [0, 0, 0, 0, 0, 0, 0], { start_date: '2026-11-13', working_days_history: [] }),   // ven : 1 j
    person('c@x', [0, 0, 0, 0, 0, 0, 0], { start_date: '2026-11-16', working_days_history: [] }),   // pas encore là
  ]);
  const rows = buildPeriod({ mode: 'week', weeks: [w] }).rows;
  assert.deepEqual(rows.map((r) => r.expectedFull), [32, 8, 0]);
  assert.equal(aggregate(rows).expected, 40);
  assert.equal(rows[2].notArrived, true);
});

/* ─────────── Édition du planning : brouillon ↔ charge utile de l'API ─────────── */

test('éditeur : un profil sans historique part de son rythme actuel comme rythme initial', () => {
  const row = buildPeriod({ mode: 'week', weeks: [week('2026-11-09', [person('a@x', [0, 0, 0, 0, 0, 0, 0], { working_days: [1, 2, 3], start_date: null, working_days_history: [] })])] }).rows[0];
  const d = draftFromRow(row);
  assert.deepEqual(d, { start: '', rows: [{ key: 'r0', from: '', days: [1, 2, 3] }] });
  assert.deepEqual(validateDraft(d).payload, { start_date: null, history: [{ effective_from: null, days: [1, 2, 3] }] });
});

test('éditeur : ajouter un changement avec sa date, l’ordre de saisie n’a pas d’importance', () => {
  const d = {
    start: '2026-11-15',
    rows: [
      { key: 'r0', from: '', days: [4, 2, 1, 3] },
      { key: 'r2', from: '2026-12-01', days: [1, 2, 3, 4, 5] },
      { key: 'r1', from: '2026-11-20', days: [1, 2] },
    ],
  };
  const v = validateDraft(d);
  assert.equal(v.ok, true);
  assert.deepEqual(v.payload, {
    start_date: '2026-11-15',
    history: [
      { effective_from: null, days: [1, 2, 3, 4] },
      { effective_from: '2026-11-20', days: [1, 2] },
      { effective_from: '2026-12-01', days: [1, 2, 3, 4, 5] },
    ],
  });
});

test('éditeur : refuse sans jour, sans date, deux changements le même jour, date d’arrivée impossible', () => {
  const base = { start: '', rows: [{ key: 'r0', from: '', days: [1] }] };
  assert.equal(validateDraft({ ...base, rows: [{ key: 'r0', from: '', days: [] }] }).ok, false);
  assert.equal(validateDraft({ ...base, rows: [...base.rows, { key: 'r1', from: '', days: [1, 2] }] }).ok, false, 'un changement sans date');
  assert.equal(validateDraft({ ...base, rows: [...base.rows, { key: 'r1', from: '2026-02-30', days: [1, 2] }] }).ok, false, 'date inexistante');
  const doublon = validateDraft({ ...base, rows: [...base.rows, { key: 'r1', from: '2026-11-11', days: [1] }, { key: 'r2', from: '2026-11-11', days: [2] }] });
  assert.equal(doublon.ok, false);
  assert.ok(doublon.errors.some((e) => /même date/.test(e)));
  assert.equal(validateDraft({ ...base, start: '15/11/2026' }).ok, false);
});

test('éditeur : un historique sans rythme initial est complété pour que le formulaire dise ce que le calcul fait', () => {
  const row = { start: null, legacyDays: [1, 2], history: [{ from: '2026-11-11', days: [1, 2, 3, 4] }] };
  assert.deepEqual(draftFromRow(row).rows.map((r) => [r.from, r.days]), [['', [1, 2, 3, 4]], ['2026-11-11', [1, 2, 3, 4]]]);
});

/* ─────── Modèle de référence : jour par jour, calendrier UTC, sur des cas tirés au hasard (graine fixe) ─────── */

test('modèle de référence : attendu, écoulé et absences identiques à un décompte jour par jour (600 cas)', () => {
  let seed = 20261105;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const dayStr = (t) => new Date(t).toISOString().slice(0, 10);
  const randomDays = () => { const s = new Set(); const n = int(1, 7); while (s.size < n) s.add(int(1, 7)); return [...s]; };

  for (let i = 0; i < 600; i++) {
    const y = int(2026, 2028); const m = int(1, 12);
    const monthStart = Date.UTC(y, m - 1, 1); const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const around = (lo, hi) => dayStr(monthStart + int(lo, nDays + hi) * 86400000);
    const start = rnd() < 0.4 ? null : around(-12, 6);
    const changes = new Map();
    for (let k = int(0, 4); k > 0; k--) changes.set(around(-20, 10), randomDays());
    const history = [{ effective_from: null, days: randomDays() }, ...[...changes].map(([d, days]) => ({ effective_from: d, days }))];
    const countedUntil = rnd() < 0.5 ? null : around(0, 3);
    // Absences tirées sur toutes les journées des semaines touchées (mois voisins compris).
    const first = Date.UTC(y, m - 1, 1) - 7 * 86400000; const periods = {};
    for (let t = first; t < Date.UTC(y, m - 1, nDays) + 14 * 86400000; t += 86400000) if (rnd() < 0.12) periods[dayStr(t)] = ['full', 'full', 'am', 'pm'][int(0, 3)];

    const r = monthRow(y, m, { start_date: start, working_days_history: history, vacation_periods: periods, vacation_days: Object.keys(periods) }, { countedUntil });

    // Référence.
    const sorted = [...history].sort((a, b) => (a.effective_from === null ? -1 : b.effective_from === null ? 1 : a.effective_from < b.effective_from ? -1 : 1));
    let full = 0; let now = 0; let vac = 0;
    for (let d = 1; d <= nDays; d++) {
      const day = dayStr(Date.UTC(y, m - 1, d));
      if (start && day < start) continue;
      let days = sorted[0].days;
      for (const h of sorted) if (h.effective_from === null || h.effective_from <= day) days = h.days;
      if (!days.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7)) continue;
      const w = periods[day] === 'full' ? 1 : periods[day] ? 0.5 : 0;
      full += 1 - w; vac += w;
      if (!countedUntil || day <= countedUntil) now += 1 - w;
    }
    const ctx = `cas ${i} (${y}-${m}, arrivée ${start}, ${JSON.stringify(history)})`;
    assert.equal(r.availableDays, full, `jours attendus — ${ctx}`);
    assert.equal(r.expectedFull, full * 8, `attendu — ${ctx}`);
    assert.equal(r.elapsedDays, now, `jours écoulés — ${ctx}`);
    assert.equal(r.expectedNow, now * 8, `attendu à ce stade — ${ctx}`);
    assert.equal(r.vacCount, vac, `absences retenues — ${ctx}`);
    assert.equal(r.segments.reduce((a, s) => a + s.available, 0), full, `somme des périodes — ${ctx}`);
  }
});

/* ─────────── Propriétés : ce qui doit rester vrai quel que soit le planning (graine fixe, calendrier UTC) ─────────── */

const utcDay = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const dayStr = (t) => t.toISOString().slice(0, 10);
const shift = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dayStr(utcDay(y, m, d + n)); };
const sortedHistory = (h) => [...h].sort((a, b) => (a.effective_from === null ? -1 : b.effective_from === null ? 1 : a.effective_from < b.effective_from ? -1 : 1));
// Rythme en vigueur un jour donné, relu à part (dernière entrée dont la date ≤ ce jour).
const refRhythm = (history, day) => { let d = sortedHistory(history)[0].days; for (const h of sortedHistory(history)) if (h.effective_from === null || h.effective_from <= day) d = h.days; return d; };
const refScheduled = (history, start, day) => (!start || day >= start) && refRhythm(history, day).includes(new Date(`${day}T12:00:00Z`).getUTCDay() || 7);
const indicators = (r) => [r.availableDays, r.elapsedDays, r.expectedFull, r.expectedNow, r.vacCount, r.total, r.avgDay, r.avgWeek];
const planOf = (sc, history = sc.history, start = sc.start, vac = sc.vac) => ({
  working_days: history[history.length - 1].days, start_date: start, working_days_history: history,
  vacation_periods: vac, vacation_days: Object.keys(vac),
});

function makeRng(seed) {
  let s = seed;
  const next = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const days = () => { const set = new Set(); const n = int(1, 7); while (set.size < n) set.add(int(1, 7)); return [...set].sort((a, b) => a - b); };
  return { next, int, days };
}
function scenario(rng) {
  const y = rng.int(2026, 2029); const m = rng.int(1, 12);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = key(y, m, 1); const last = key(y, m, n);
  const around = (a, b) => shift(first, rng.int(-a, n - 1 + b));
  const start = rng.next() < 0.5 ? around(15, 8) : null;
  const changes = new Map();
  for (let k = rng.int(0, 4); k > 0; k--) changes.set(around(25, 20), rng.days());
  const history = [{ effective_from: null, days: rng.days() }, ...[...changes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([effective_from, days]) => ({ effective_from, days }))];
  const vac = {};
  for (let i = -8; i < n + 8; i++) if (rng.next() < 0.12) vac[shift(first, i)] = ['full', 'full', 'am', 'pm'][rng.int(0, 3)];
  const onDays = {};
  for (let i = 0; i < n; i++) if (rng.next() < 0.7) onDays[shift(first, i)] = rng.int(1, 11);
  return { y, m, n, first, last, start, history, vac, onDays };
}

test('propriété — un changement daté APRÈS la période ne la modifie jamais (rien n’est rétroactif)', () => {
  const rng = makeRng(1105);
  for (let i = 0; i < 200; i++) {
    const sc = scenario(rng);
    const after = shift(sc.last, rng.int(21, 60));                      // au-delà de tout changement déjà tiré (≤ fin du mois + 20)
    const more = [...sc.history, { effective_from: after, days: rng.days() }];
    const before = indicators(monthRow(sc.y, sc.m, planOf(sc), { onDays: sc.onDays }));
    assert.deepEqual(indicators(monthRow(sc.y, sc.m, planOf(sc, more), { onDays: sc.onDays })), before, `cas ${i}`);
  }
});

test('propriété — repousser l’arrivée (ou en poser une) ne peut que réduire l’attendu, jamais le réalisé', () => {
  const rng = makeRng(1106);
  for (let i = 0; i < 200; i++) {
    const sc = scenario(rng);
    const run = (start) => monthRow(sc.y, sc.m, planOf(sc, sc.history, start), { onDays: sc.onDays });
    const none = run(null);
    const early = run(sc.start ?? shift(sc.first, -5));
    const late = run(shift(sc.start ?? shift(sc.first, -5), rng.int(0, 45)));
    assert.ok(late.expectedFull <= early.expectedFull + 1e-9 && early.expectedFull <= none.expectedFull + 1e-9, `attendu cas ${i}`);
    assert.ok(late.availableDays <= early.availableDays + 1e-9 && early.availableDays <= none.availableDays + 1e-9, `jours cas ${i}`);
    assert.equal(late.total, none.total, 'le réalisé ne dépend pas de l’arrivée');
    assert.equal(early.total, none.total);
  }
});

test('propriété — découper un rythme en deux entrées identiques ne change rien', () => {
  const rng = makeRng(1107);
  for (let i = 0; i < 200; i++) {
    const sc = scenario(rng);
    const x = shift(sc.first, rng.int(-20, sc.n + 20));
    if (sc.history.some((h) => h.effective_from === x)) continue;
    const split = sortedHistory([...sc.history, { effective_from: x, days: refRhythm(sc.history, x) }]);
    const a = indicators(monthRow(sc.y, sc.m, planOf(sc), { onDays: sc.onDays }));
    assert.deepEqual(indicators(monthRow(sc.y, sc.m, planOf(sc, split), { onDays: sc.onDays })), a, `cas ${i}`);
  }
});

test('propriété — une absence un jour non travaillé ce jour-là ne change ni l’attendu ni le réalisé', () => {
  const rng = makeRng(1108);
  let tested = 0;
  for (let i = 0; i < 300; i++) {
    const sc = { ...scenario(rng), vac: {} };
    const free = Array.from({ length: sc.n }, (_, k) => shift(sc.first, k)).filter((d) => !refScheduled(sc.history, sc.start, d));
    if (!free.length) continue;
    const day = free[rng.int(0, free.length - 1)];
    const a = indicators(monthRow(sc.y, sc.m, planOf(sc), { onDays: sc.onDays }));
    const b = indicators(monthRow(sc.y, sc.m, planOf(sc, sc.history, sc.start, { [day]: ['full', 'am', 'pm'][rng.int(0, 2)] }), { onDays: sc.onDays }));
    assert.deepEqual(b, a, `cas ${i}, jour ${day}`);
    tested++;
  }
  assert.ok(tested > 100, 'assez de cas exercés');
});

test('propriété — le réalisé est celui de l’agenda quel que soit le planning (même heures, mêmes jours passés)', () => {
  const rng = makeRng(1109);
  for (let i = 0; i < 150; i++) {
    const sc = scenario(rng);
    const cu = rng.next() < 0.5 ? null : shift(sc.first, rng.int(0, sc.n));
    const bare = monthRow(sc.y, sc.m, { working_days: [1, 2, 3, 4, 5] }, { onDays: sc.onDays, countedUntil: cu });
    const full = monthRow(sc.y, sc.m, planOf(sc), { onDays: sc.onDays, countedUntil: cu });
    assert.equal(full.total, bare.total, `cas ${i}`);
  }
});

test('propriété — 51 semaines consécutives = le décompte direct jour par jour (aucun trou, aucun doublon)', () => {
  const rng = makeRng(1110);
  for (let i = 0; i < 15; i++) {
    const sc = scenario(rng);
    const mondays = Array.from({ length: 51 }, (_, k) => shift('2026-01-05', 7 * k));            // du lundi 5/01/2026 au dimanche 3/01/2027
    const plan = planOf(sc);
    const viaWeeks = mondays.reduce((a, mo) => a + weekRow(mo, plan).availableDays, 0);
    let direct = 0;
    for (let k = 0; k < 51 * 7; k++) {
      const day = shift('2026-01-05', k);
      if (refScheduled(sc.history, sc.start, day)) direct += 1 - (sc.vac[day] === 'full' ? 1 : sc.vac[day] ? 0.5 : 0);
    }
    assert.equal(viaWeeks, direct, `cas ${i}`);
  }
});

test('exhaustif — 14 mois (2026 + février 2027 et 2028) × chaque jour d’arrivée × 4 rythmes = décompte direct', () => {
  const rhythms = [[1, 2, 3, 4, 5], [1, 2, 3, 4], [1, 2], [6, 7]];
  let cases = 0;
  for (const [y, m] of [...Array.from({ length: 12 }, (_, k) => [2026, k + 1]), [2027, 2], [2028, 2]]) {
    {
      const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 0; d <= n + 1; d++) {                                  // la veille du mois, chaque jour, le lendemain
        const start = shift(key(y, m, 1), d - 1);
        for (const r of rhythms) {
          let direct = 0;
          for (let k = 1; k <= n; k++) { const day = key(y, m, k); if (day >= start && r.includes(new Date(`${day}T12:00:00Z`).getUTCDay() || 7)) direct++; }
          assert.equal(monthRow(y, m, { working_days: r, start_date: start, working_days_history: [] }).availableDays, direct, `${y}-${m} arrivée ${start} rythme ${r}`);
          cases++;
        }
      }
    }
  }
  assert.ok(cases > 1700);
});
