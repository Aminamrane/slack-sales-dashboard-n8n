import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationOf, countLabel, filterHistory, fold, periodLabel, sizeLabel, stepOf, visibleRows } from './automationBoard.js';

const ROWS = [
  { id: 1, name: 'Process REM', parentId: null, classification: 'pending_validation', pole: { group: 'both' }, toConfirm: false },
  { id: 2, name: 'Note de rémunération annuelle', parentId: 1, classification: 'pending_validation', pole: { group: 'both' }, toConfirm: true },
  { id: 3, name: 'Licence de marque', parentId: 1, classification: 'automated', pole: { group: 'fiscal' }, toConfirm: false },
  { id: 4, name: 'Question juridique', parentId: null, classification: 'automated', pole: { group: 'social' }, toConfirm: true },
];
const ids = (list) => list.map((item) => item.row.id);

test('visibleRows : un process porte ses missions sous lui, et se replie', () => {
  const all = visibleRows(ROWS);
  assert.deepEqual(ids(all), [1, 2, 3, 4]);
  assert.deepEqual(all.map((item) => item.depth), [0, 1, 1, 0]);
  assert.equal(all[0].children, 2);
  assert.deepEqual(ids(visibleRows(ROWS, { closed: new Set([1]) })), [1, 4]);
});

test('visibleRows : une mission trouvée garde son process au-dessus, même replié', () => {
  const found = visibleRows(ROWS, { query: 'REMUNERATION', closed: new Set([1]) });
  assert.deepEqual(ids(found), [1, 2]);
  assert.equal(found[0].dimmed, true);
  assert.deepEqual(ids(visibleRows(ROWS, { query: 'process rem' })), [1, 2, 3]);
  assert.deepEqual(ids(visibleRows(ROWS, { classification: 'automated' })), [1, 3, 4]);
  assert.deepEqual(ids(visibleRows(ROWS, { pole: 'social' })), [4]);
  assert.deepEqual(ids(visibleRows(ROWS, { toConfirm: true })), [1, 2, 4]);
  assert.deepEqual(visibleRows(ROWS, { query: 'introuvable' }), []);
  assert.deepEqual(visibleRows(null), []);
});

test('visibleRows : une mission dont le process est absent reste une ligne à part', () => {
  assert.deepEqual(ids(visibleRows([{ id: 9, name: 'Seule', parentId: 77, classification: 'automated' }])), [9]);
});

test('libellés : période, étape, classement, comptes, tailles', () => {
  assert.equal(periodLabel(null), 'Depuis la mise en place');
  assert.equal(periodLabel(7), '7 derniers jours');
  assert.equal(fold('  Rémunération '), 'remuneration');
  const steps = [{ value: 0, label: 'Non commencé', percent: 0 }, { value: 1, label: 'Cahier des charges envoyé', percent: 25 }, { value: 2, label: 'V1', percent: 50 }];
  assert.deepEqual(stepOf(steps, 1), { value: 1, label: 'Cahier des charges envoyé', percent: 25, last: 2 });
  assert.deepEqual(stepOf(null, 3), { value: 3, label: '', percent: 0, last: 0 });
  assert.equal(classificationOf([{ value: 'automated', label: 'Automatisée' }], 'automated').label, 'Automatisée');
  assert.equal(classificationOf([], 'inconnu').shortLabel, 'Non classée');
  assert.equal(countLabel(1, 'mission', 'missions'), '1 mission');
  assert.equal(countLabel(0, 'mission', 'missions'), '0 mission');
  assert.equal(sizeLabel(900), '900 o');
  assert.equal(sizeLabel(20480), '20 Ko');
  assert.equal(sizeLabel(3 * 1024 * 1024 + 300000), '3,3 Mo');
});

test('filterHistory : un seul type, sans jour vide', () => {
  const history = [
    { day: '2026-11-10', items: [{ filter: 'comments' }, { filter: 'decisions' }] },
    { day: '2026-11-09', items: [{ filter: 'decisions' }] },
  ];
  assert.equal(filterHistory(history, '').length, 2);
  assert.deepEqual(filterHistory(history, 'comments'), [{ day: '2026-11-10', items: [{ filter: 'comments' }] }]);
  assert.deepEqual(filterHistory(undefined, 'comments'), []);
});
