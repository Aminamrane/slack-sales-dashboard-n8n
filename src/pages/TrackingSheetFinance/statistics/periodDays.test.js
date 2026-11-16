import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY_PRESETS, addDays, dayQuery, dayRangeLabel, dayRangeShort, daysInMonth, daysProblem, isDay, monthGrid, monthHalves, monthsOf, orderDays, presetDays, rangeQuery, weekStart } from './period.js';

const TODAY = '2026-11-13';

test('un jour se décale à travers les mois, les années, les bissextiles et les changements d\'heure', () => {
  assert.equal(addDays('2026-11-13', -6), '2026-11-07');
  assert.equal(addDays('2026-03-01', -29), '2026-01-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');   // le 25/10/2026 est le jour du changement d'heure
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');   // le 29/03/2026 aussi
});

test('un jour valable est une vraie date du calendrier', () => {
  assert.equal(isDay('2026-11-13'), true);
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2026-13-01'), false);
  assert.equal(isDay('2026-9-1'), false);
  assert.equal(isDay(''), false);
  assert.equal(isDay(null), false);
  assert.equal(isDay('2024-02-29'), true);
  assert.equal(isDay('2026-02-29'), false);
});

test('les présélections, aujourd\'hui compris', () => {
  assert.deepEqual(presetDays('7d', TODAY), { from: '2026-11-07', to: TODAY });
  assert.deepEqual(presetDays('15d', TODAY), { from: '2026-10-30', to: TODAY });
  assert.deepEqual(presetDays('30d', TODAY), { from: '2026-10-15', to: TODAY });
  assert.deepEqual(presetDays('this-week', TODAY), { from: '2026-11-09', to: TODAY });            // le 13/11/2026 est un vendredi : lundi 9 → aujourd'hui
  assert.deepEqual(presetDays('last-week', TODAY), { from: '2026-11-02', to: '2026-11-08' });     // lundi 2 → dimanche 8
  assert.deepEqual(presetDays('90d', TODAY), { from: '2026-08-16', to: TODAY });
  assert.deepEqual(presetDays('this-month', TODAY), { from: '2026-11-01', to: TODAY });
  assert.deepEqual(presetDays('last-month', TODAY), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(presetDays('this-year', TODAY), { from: '2026-01-01', to: TODAY });
  assert.equal(presetDays('autre', TODAY), null);
  assert.deepEqual(DAY_PRESETS.map((p) => p.key), ['7d', '15d', '30d', '90d', 'this-week', 'last-week', 'this-month', 'last-month', 'this-year']);
  assert.deepEqual(DAY_PRESETS.map((p) => p.short), ['7 jours', '15 jours', '30 jours', '90 jours', 'Cette semaine', 'Sem. dernière', 'Ce mois-ci', 'Mois dernier', 'Cette année']);
});

test('« N derniers jours » compte exactement N jours', () => {
  for (const [key, n] of [['7d', 7], ['15d', 15], ['30d', 30], ['90d', 90]]) {
    const { from, to } = presetDays(key, TODAY);
    let count = 1;
    for (let d = from; d < to; d = addDays(d, 1)) count += 1;
    assert.equal(count, n, key);
  }
});

test('les présélections aux changements de mois et d\'année', () => {
  assert.deepEqual(presetDays('last-month', '2026-01-05'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(presetDays('last-month', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(presetDays('last-month', '2024-03-10'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(presetDays('this-month', '2026-11-01'), { from: '2026-11-01', to: '2026-11-01' });
  assert.deepEqual(presetDays('this-year', '2026-01-01'), { from: '2026-01-01', to: '2026-01-01' });
  assert.deepEqual(presetDays('7d', '2026-01-03'), { from: '2025-12-28', to: '2026-01-03' });
});

test('une période choisie à la main : valable, ou la raison du refus (rien n\'est corrigé en silence)', () => {
  assert.equal(daysProblem({ from: '2026-10-01', to: '2026-10-31' }, TODAY), null);
  assert.equal(daysProblem({ from: '2026-11-13', to: '2026-11-13' }, TODAY), null);          // un seul jour
  assert.equal(daysProblem({ from: '2026-10-31', to: '2026-10-01' }, TODAY), 'order');
  assert.equal(daysProblem({ from: '2026-11-01', to: '2026-11-14' }, TODAY), 'future');
  assert.equal(daysProblem({ from: '2026-02-30', to: '2026-03-01' }, TODAY), 'format');
  assert.equal(daysProblem({ from: '', to: '2026-03-01' }, TODAY), 'format');
  assert.equal(daysProblem({ from: '2024-12-01', to: '2026-11-13' }, TODAY), null);            // 24 mois exactement
  assert.equal(daysProblem({ from: '2024-11-30', to: '2026-11-13' }, TODAY), 'span');          // 25 mois
});

test('les mois qui contiennent la période, et la requête envoyée au serveur', () => {
  assert.deepEqual(monthsOf({ from: '2026-10-15', to: '2026-11-13' }), { from: '2026-10', to: '2026-11' });
  assert.deepEqual(monthsOf({ from: '2026-11-07', to: '2026-11-13' }), { from: '2026-11', to: '2026-11' });
  assert.equal(dayQuery({ from: '2026-10-15', to: '2026-11-13' }), 'from=2026-10&to=2026-11&date_from=2026-10-15&date_to=2026-11-13');
  // sans jours, la requête d'avant est inchangée
  assert.equal(rangeQuery({ from: '2026-09', to: '2026-11' }), 'from=2026-09&to=2026-11');
});

test('la période se lit en clair', () => {
  assert.equal(dayRangeLabel({ from: '2026-11-13', to: '2026-11-13' }), '13 nov. 2026');
  assert.equal(dayRangeLabel({ from: '2026-11-07', to: '2026-11-13' }), '7 – 13 nov. 2026');
  assert.equal(dayRangeLabel({ from: '2026-10-15', to: '2026-11-13' }), '15 oct. – 13 nov. 2026');
  assert.equal(dayRangeLabel({ from: '2025-12-28', to: '2026-01-03' }), '28 déc. 2025 – 3 janv. 2026');
  assert.equal(dayRangeShort({ from: '2026-11-07', to: '2026-11-13' }), '7 – 13 nov.');
  assert.equal(dayRangeShort({ from: '2026-01-01', to: '2026-11-13' }), '1 janv. – 13 nov.');
  assert.equal(dayRangeShort({ from: '2025-12-28', to: '2026-01-03' }), '28 déc. 2025 – 3 janv.');
});

test('la semaine commence le lundi, aussi en début de mois et d\'année', () => {
  assert.equal(weekStart('2026-11-13'), '2026-11-09');   // vendredi
  assert.equal(weekStart('2026-11-09'), '2026-11-09');   // lundi
  assert.equal(weekStart('2026-11-08'), '2026-11-02');   // dimanche : la semaine d'avant
  assert.equal(weekStart('2026-01-01'), '2025-12-29');   // jeudi 1er janvier
  assert.deepEqual(presetDays('last-week', '2026-11-09'), { from: '2026-11-02', to: '2026-11-08' });     // aujourd'hui lundi : la semaine dernière est complète
  assert.deepEqual(presetDays('this-week', '2026-11-09'), { from: '2026-11-09', to: '2026-11-09' });     // … et cette semaine ne compte qu'aujourd'hui
  assert.deepEqual(presetDays('last-week', '2026-01-02'), { from: '2025-12-22', to: '2025-12-28' });
});

test('le calendrier d\'un mois : lundi d\'abord, 7 cases par ligne, aucun jour perdu ni doublé', () => {
  const grid = monthGrid('2026-11');   // le 1er novembre 2026 est un dimanche
  assert.ok(grid.every((week) => week.length === 7));
  assert.deepEqual(grid[0], [null, null, null, null, null, null, '2026-11-01']);
  assert.deepEqual(grid.at(-1), ['2026-11-30', null, null, null, null, null, null]);
  for (const month of ['2026-02', '2024-02', '2026-10', '2026-12', '2025-06']) {
    const days = monthGrid(month).flat().filter(Boolean);
    assert.equal(days.length, daysInMonth(month), month);
    assert.equal(new Set(days).size, days.length, month);
    assert.deepEqual(days, [...days].sort(), month);
    assert.equal(days[0], `${month}-01`);
    assert.equal(days.at(-1), addDays(`${month}-28`, daysInMonth(month) - 28), month);
  }
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2024-02'), 29);
  assert.equal(monthGrid('2026-06')[0][0], '2026-06-01');   // un lundi : pas de case vide devant
});

test('les moitiés d\'un mois et le mois entier, jamais au-delà d\'aujourd\'hui', () => {
  assert.deepEqual(monthHalves('2026-10', TODAY), { first: { from: '2026-10-01', to: '2026-10-15' }, second: { from: '2026-10-16', to: '2026-10-31' }, whole: { from: '2026-10-01', to: '2026-10-31' } });
  assert.deepEqual(monthHalves('2026-11', TODAY), { first: { from: '2026-11-01', to: '2026-11-13' }, second: null, whole: { from: '2026-11-01', to: '2026-11-13' } });
  assert.deepEqual(monthHalves('2026-11', '2026-11-20'), { first: { from: '2026-11-01', to: '2026-11-15' }, second: { from: '2026-11-16', to: '2026-11-20' }, whole: { from: '2026-11-01', to: '2026-11-20' } });
  assert.deepEqual(monthHalves('2026-12', TODAY), { first: null, second: null, whole: null });
  assert.deepEqual(monthHalves('2026-02', TODAY).second, { from: '2026-02-16', to: '2026-02-28' });
  assert.deepEqual(monthHalves('2024-02', TODAY).second, { from: '2024-02-16', to: '2024-02-29' });
  assert.deepEqual(monthHalves('2026-11', '2026-11-01'), { first: { from: '2026-11-01', to: '2026-11-01' }, second: null, whole: { from: '2026-11-01', to: '2026-11-01' } });
});

test('deux jours cliqués se remettent dans l\'ordre', () => {
  assert.deepEqual(orderDays('2026-10-01', '2026-10-15'), { from: '2026-10-01', to: '2026-10-15' });
  assert.deepEqual(orderDays('2026-10-15', '2026-10-01'), { from: '2026-10-01', to: '2026-10-15' });
  assert.deepEqual(orderDays('2026-10-15', '2026-10-15'), { from: '2026-10-15', to: '2026-10-15' });
});
