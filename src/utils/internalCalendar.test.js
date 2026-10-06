import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, chipColors, countByOutcome, eventColor, filterHandled, fmtDayTitle, fmtRange, fmtWeekLabel, groupBySales,
  hasWeekendEvents, hourWindow, layoutDay, mondayOf, parisNow, splitEvents, stepWorkday, weekDays,
} from './internalCalendar.js';

test('la semaine commence le lundi, y compris depuis un dimanche', () => {
  assert.equal(mondayOf('2026-10-05'), '2026-10-05');
  assert.equal(mondayOf('2026-10-11'), '2026-10-05');
  assert.equal(mondayOf('2026-10-07'), '2026-10-05');
  assert.deepEqual(weekDays('2026-10-05'), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(weekDays('2026-10-05', true).length, 7);
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');                    // passage à l'heure d'été sans effet
});

test('libellés de semaine en français, sans tiret', () => {
  assert.equal(fmtWeekLabel(weekDays('2026-10-05')), 'Du 5 au 9 octobre 2026');
  assert.equal(fmtWeekLabel(weekDays('2026-09-28')), 'Du 28 septembre au 2 octobre 2026');
  assert.equal(fmtWeekLabel(weekDays('2025-12-29')), 'Du 29 décembre 2025 au 2 janvier 2026');
});

test('l\'heure de Paris ne dépend pas du fuseau du navigateur', () => {
  const p = parisNow(new Date('2026-10-05T07:30:00Z'));                      // 9 h 30 à Paris (été)
  assert.equal(p.key, '2026-10-05');
  assert.equal(p.minutes, 9 * 60 + 30);
  assert.equal(parisNow(new Date('2026-12-31T23:30:00Z')).key, '2027-01-01');
});

test('les dates du CRM restent à l\'heure affichée', () => {
  const ev = { kind: 'rdv', start: '2026-10-06T10:00:00', end: '2026-10-06T10:45:00' };
  assert.equal(fmtRange(ev), 'mardi 6 octobre, 10h à 10h45');
  assert.equal(fmtRange({ all_day: true, start: '2026-10-09', end: '2026-10-10' }), 'vendredi 9 octobre, toute la journée');
  assert.equal(fmtRange({ all_day: true, start: '2026-10-08', end: '2026-10-10' }), 'Du jeudi 8 octobre au vendredi 9 octobre');
});

test('répartition : journée entière en bandeau, le reste dans la grille, découpé à minuit', () => {
  const days = weekDays('2026-10-05');
  const { allDay, timed } = splitEvents([
    { id: 'a', all_day: true, start: '2026-10-08', end: '2026-10-10' },
    { id: 'b', start: '2026-10-06T23:00:00', end: '2026-10-07T01:00:00' },
    { id: 'c', start: '2026-10-05T09:00:00', end: '2026-10-05T09:00:00' },   // sans durée : reste visible
  ], days);
  assert.deepEqual(days.map((d) => allDay.get(d).length), [0, 0, 0, 1, 1]);
  assert.deepEqual(timed.get('2026-10-06').map((e) => [e.segStart, e.segEnd]), [[23 * 60, 1440]]);
  assert.deepEqual(timed.get('2026-10-07').map((e) => [e.segStart, e.segEnd]), [[0, 60]]);
  assert.deepEqual(timed.get('2026-10-05').map((e) => [e.segStart, e.segEnd]), [[540, 560]]);
});

test('le week-end n\'apparaît que s\'il porte un rendez-vous', () => {
  assert.equal(hasWeekendEvents([{ kind: 'rdv', start: '2026-10-07T10:00:00', end: '2026-10-07T11:00:00' }], '2026-10-05'), false);
  assert.equal(hasWeekendEvents([{ kind: 'rdv', start: '2026-10-10T10:00:00', end: '2026-10-10T11:00:00' }], '2026-10-05'), true);
  assert.equal(hasWeekendEvents([{ kind: 'absence', all_day: true, start: '2026-10-09', end: '2026-10-13' }], '2026-10-05'), false);
  assert.equal(hasWeekendEvents([{ kind: 'google', start: '2026-10-10T07:00:00', end: '2026-10-10T08:00:00' }], '2026-10-05'), false);
});

const seg = (id, s, e) => ({ id, segStart: s, segEnd: e });
const pos = (out) => Object.fromEntries(out.map((o) => [o.id, [Math.round(o.leftPct), Math.round(o.widthPct)]]));

test('placement : seul, côte à côte, imbriqué (comme Google Agenda)', () => {
  assert.deepEqual(pos(layoutDay([seg('a', 540, 600)])), { a: [0, 100] });
  // deux rendez-vous à la même heure : colonnes qui se recouvrent légèrement
  assert.deepEqual(pos(layoutDay([seg('a', 540, 600), seg('b', 540, 600)])), { a: [0, 85], b: [50, 50] });
  // une longue plage puis un rendez-vous plus tard : cascade décalée de 5 %
  assert.deepEqual(pos(layoutDay([seg('long', 540, 720), seg('late', 630, 660)])), { long: [0, 100], late: [5, 95] });
  // deux rendez-vous qui se suivent ne se gênent pas
  assert.deepEqual(pos(layoutDay([seg('a', 540, 600), seg('b', 600, 660)])), { a: [0, 100], b: [0, 100] });
});

test('le no-show se voit en rouge, quel que soit le type de rendez-vous', () => {
  assert.equal(eventColor({ kind: 'rdv', rdv_type: 'r2', outcome: 'no_show' }), '#dc2626');
  assert.equal(eventColor({ kind: 'rdv', rdv_type: 'r2', outcome: 'held' }), '#f97316');
  assert.match(chipColors('#3b82f6').bg, /^rgb\(/);
  assert.match(chipColors('#3b82f6', true).bg, /^rgb\(/);
});

test('vue direction : filtrer ce que gèrent les setters et ce qui revient à la direction', () => {
  const events = [
    { kind: 'rdv', handled_by: 'setter', outcome: 'no_show' },
    { kind: 'rdv', handled_by: 'direction', outcome: 'upcoming' },
    { kind: 'google' },
  ];
  assert.equal(filterHandled(events, 'all').length, 3);
  assert.equal(filterHandled(events, 'direction').length, 2);
  assert.deepEqual(countByOutcome(events), { total: 2, upcoming: 1, held: 0, no_show: 1, to_qualify: 0 });
});

test('vue direction : un jour à la fois, une colonne par commercial', () => {
  assert.equal(fmtDayTitle('2026-10-05'), 'Lundi 5 octobre 2026');
  assert.equal(stepWorkday('2026-10-09', 1), '2026-10-12');                  // vendredi → lundi
  assert.equal(stepWorkday('2026-10-12', -1), '2026-10-09');
  const groups = groupBySales([
    { kind: 'rdv', assigned: { state: 'assigned', name: 'Vincent' } },
    { kind: 'rdv', assigned: { state: 'unassigned', name: null } },
    { kind: 'rdv', assigned: { state: 'assigned', name: 'Ambre' } },
    { kind: 'rdv', assigned: { state: 'assigned', name: 'Vincent' } },
    { kind: 'google' },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.events.length]), [['Ambre', 1], ['Vincent', 2], ['Non affecté', 1]]);
});

test('la grille montre 7 h-21 h, élargie seulement si un rendez-vous en sort', () => {
  assert.deepEqual(hourWindow([]), { start: 7, end: 21 });
  assert.deepEqual(hourWindow([{ segStart: 9 * 60, segEnd: 10 * 60 }]), { start: 7, end: 21 });
  assert.deepEqual(hourWindow([{ segStart: 6 * 60 + 30, segEnd: 7 * 60 }, { segStart: 21 * 60, segEnd: 22 * 60 + 15 }]), { start: 6, end: 23 });
  assert.deepEqual(hourWindow([{ segStart: 0, segEnd: 1440 }]), { start: 0, end: 24 });
});
