import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  buildSchemaChains, conditionSummary, conditionsByKind, isFallbackEmail, schemaNeighborKey, schemaStopKey,
} from './schemaModel.js';

const cal = (iso) => ({ mode: 'calendar', at: iso });
const mail = (key, order, sequence, segment, timing, extra = {}) => ({ key, kind: key, order, sequence, segment: segment ?? null, timing, ...extra });

test('chains are one per sequence x segment, ordered pre, post by segment, then one-shot sends', () => {
  const emails = [
    mail('post-att-2', 6, 'post', 'attended', cal('2026-09-23T11:00:00+02:00')),
    mail('one-1', 9, 'oneshot', null, cal('2026-05-14T11:00:00+02:00')),
    mail('pre-2', 2, 'pre', null, cal('2026-09-14T11:00:00+02:00')),
    mail('post-mis-1', 4, 'post', 'missed', cal('2026-09-22T11:00:00+02:00')),
    mail('pre-1', 1, 'pre', null, cal('2026-09-13T11:00:00+02:00')),
    mail('post-att-1', 5, 'post', 'attended', cal('2026-09-22T11:00:00+02:00')),
  ];
  const chains = buildSchemaChains(emails);
  assert.deepEqual(chains.map((c) => c.id), ['pre::', 'post::missed', 'post::attended', 'oneshot::']);
  assert.deepEqual(chains[0].steps.map((s) => s.key), ['pre-1', 'pre-2'], 'steps are sorted by send order');
  assert.deepEqual(chains[2].steps.map((s) => s.key), ['post-att-1', 'post-att-2']);
  assert.equal(chains[0].label, 'Pré-webinaire');
  assert.equal(chains[1].label, 'Post-webinaire · Absents');
});

test('one-shot sends are never chained: not connected, no gap between them', () => {
  const emails = [
    mail('one-1', 1, 'oneshot', null, cal('2026-05-14T11:00:00+02:00')),
    mail('one-2', 2, 'oneshot', null, cal('2026-05-15T11:00:00+02:00')),
    mail('one-3', 3, 'oneshot', null, cal('2026-05-16T11:00:00+02:00')),
  ];
  const [chain] = buildSchemaChains(emails);
  assert.equal(chain.connected, false);
  assert.deepEqual(chain.gaps, []);
  assert.equal(chain.steps.length, 3);
});

test('a gap is null when two steps are not scheduled on a comparable basis, never an invented delay', () => {
  const emails = [
    mail('a', 1, 'pre', null, { mode: 'signup-delay', minutes: 2 }),
    mail('b', 2, 'pre', null, { mode: 'signup-days', days: 1, time: '11:00' }),
    mail('c', 3, 'pre', null, cal('2026-09-14T11:00:00+02:00')),
    mail('d', 4, 'pre', null, cal('2026-09-15T11:00:00+02:00')),
    mail('e', 5, 'pre', null, { mode: 'unknown' }),
  ];
  const [chain] = buildSchemaChains(emails);
  assert.equal(chain.gaps.length, 4);
  assert.equal(chain.gaps[0], null, 'signup-delay -> signup-days');
  assert.equal(chain.gaps[1], null, 'signup-days -> calendar');
  assert.equal(typeof chain.gaps[2], 'string', 'two calendar dates are comparable');
  assert.match(chain.gaps[2], /^1 j(our)?$/, 'exactly one day apart');
  assert.equal(chain.gaps[3], null, 'calendar -> unknown mode');
  assert.ok(chain.gaps.every((g) => g === null || !/NaN/.test(g)), 'never a NaN delay');
});

test('a gap is null when a timing is missing or invalid', () => {
  const [chain] = buildSchemaChains([
    mail('a', 1, 'pre', null, undefined),
    mail('b', 2, 'pre', null, cal('pas une date')),
    mail('c', 3, 'pre', null, cal('2026-09-14T11:00:00+02:00')),
  ]);
  assert.equal(chain.gaps[0], null);
  assert.ok(chain.gaps[1] === null || !/NaN/.test(chain.gaps[1]));
});

test('synthesized steps (fallback: true) are excluded: no chain is invented for a cohort without local content', () => {
  const fallback = (key, i) => mail(key, i, 'pre', null, { mode: 'unknown' }, { fallback: true });
  assert.equal(isFallbackEmail(fallback('x', 1)), true);
  assert.equal(isFallbackEmail(mail('y', 1, 'pre', null, cal('2026-09-14T11:00:00+02:00'))), false);
  assert.equal(isFallbackEmail(undefined), false);
  assert.deepEqual(buildSchemaChains([fallback('x', 1), fallback('y', 2)]), []);
  const mixed = buildSchemaChains([fallback('x', 1), mail('real', 2, 'pre', null, cal('2026-09-14T11:00:00+02:00'))]);
  assert.equal(mixed.length, 1);
  assert.deepEqual(mixed[0].steps.map((s) => s.key), ['real']);
  assert.deepEqual(buildSchemaChains([]), []);
});

test('an unknown sequence or segment is kept, and sorted after the known ones', () => {
  const chains = buildSchemaChains([
    mail('weird', 1, 'nouvelle', null, cal('2026-09-14T11:00:00+02:00')),
    mail('p-x', 2, 'post', 'inconnu', cal('2026-09-14T11:00:00+02:00')),
    mail('p-a', 3, 'post', 'all', cal('2026-09-14T11:00:00+02:00')),
    mail('pre', 4, 'pre', null, cal('2026-09-14T11:00:00+02:00')),
  ]);
  assert.deepEqual(chains.map((c) => c.id), ['pre::', 'post::all', 'post::inconnu', 'nouvelle::']);
});

test('conditionSummary extracts the "sauté" clause as written, and flags skippable steps', () => {
  const nurture = conditionSummary([
    "Programmé à l'inscription. Sauté si la date tombe un jour de rappel, le jour du live, ou est déjà passée (1 e-mail par jour maximum avant le live).",
  ]);
  assert.equal(nurture.skippable, true);
  assert.equal(nurture.short, 'Sauté si la date tombe un jour de rappel, le jour du live, ou est déjà passée');
  assert.ok(nurture.full.startsWith("Programmé à l'inscription."));

  const anchor = conditionSummary(['Ancre calendaire commune à toute la cohorte : sauté pour un inscrit arrivé après cette date.']);
  assert.equal(anchor.skippable, true);
  assert.equal(anchor.short, 'Sauté pour un inscrit arrivé après cette date');

  const once = conditionSummary(["Un seul par inscrit et par cohorte (une réinscription ne recrée pas de séquence)."]);
  assert.deepEqual(once, { full: "Un seul par inscrit et par cohorte (une réinscription ne recrée pas de séquence).", short: '', skippable: false });
});

test('conditionSummary tolerates missing or malformed conditions', () => {
  const none = { full: '', short: '', skippable: false };
  assert.deepEqual(conditionSummary(undefined), none);
  assert.deepEqual(conditionSummary(null), none);
  assert.deepEqual(conditionSummary([]), none);
  assert.deepEqual(conditionSummary(['', '   ', 42, null]), none);
  assert.equal(conditionSummary(['Sauté.']).short, 'Sauté');
});

test('conditionsByKind keeps only the steps that have conditions', () => {
  const map = conditionsByKind([
    { kind: 'a', conditions: ['Sauté si inscrit tard.'] },
    { kind: 'b', conditions: [] },
    { kind: 'c' },
    { kind: 'd', conditions: ['Un seul par inscrit.'] },
  ]);
  assert.deepEqual([...map.keys()], ['a', 'd']);
  assert.equal(map.get('a').skippable, true);
  assert.equal(map.get('d').skippable, false);
  assert.equal(conditionsByKind(undefined).size, 0);
});

const NAV = buildSchemaChains([
  mail('p1', 1, 'pre', null, { mode: 'unknown' }),
  mail('p2', 2, 'pre', null, { mode: 'unknown' }),
  mail('p3', 3, 'pre', null, { mode: 'unknown' }),
  mail('m1', 4, 'post', 'missed', { mode: 'unknown' }),
  mail('m2', 5, 'post', 'missed', { mode: 'unknown' }),
  mail('o1', 6, 'oneshot', null, { mode: 'unknown' }),
]);

test('keyboard navigation moves inside a chain with up/down and to the neighbouring chain with left/right', () => {
  assert.equal(schemaNeighborKey(NAV, 'p1', 'down'), 'p2');
  assert.equal(schemaNeighborKey(NAV, 'p3', 'up'), 'p2');
  assert.equal(schemaNeighborKey(NAV, 'p1', 'up'), null, 'no wrap at the top');
  assert.equal(schemaNeighborKey(NAV, 'p3', 'down'), null, 'no wrap at the bottom');
  assert.equal(schemaNeighborKey(NAV, 'p2', 'right'), 'm2', 'same rank in the next chain');
  assert.equal(schemaNeighborKey(NAV, 'p3', 'right'), 'm2', 'clamped to the last step of a shorter chain');
  assert.equal(schemaNeighborKey(NAV, 'm1', 'left'), 'p1');
  assert.equal(schemaNeighborKey(NAV, 'p1', 'left'), null, 'no chain before the first');
  assert.equal(schemaNeighborKey(NAV, 'o1', 'right'), null, 'no chain after the last');
});

test('Home/End go to the first/last step of the chain; unknown key or move gives null', () => {
  assert.equal(schemaNeighborKey(NAV, 'p2', 'first'), 'p1');
  assert.equal(schemaNeighborKey(NAV, 'p2', 'last'), 'p3');
  assert.equal(schemaNeighborKey(NAV, 'p3', 'last'), 'p3');
  assert.equal(schemaNeighborKey(NAV, 'inconnu', 'down'), null);
  assert.equal(schemaNeighborKey(NAV, 'p1', 'diagonale'), null);
  assert.equal(schemaNeighborKey([], 'p1', 'down'), null);
});

test('the roving tab stop is the last visited step, else the selected one, else the first', () => {
  assert.equal(schemaStopKey(NAV, 'm2', 'p3'), 'm2');
  assert.equal(schemaStopKey(NAV, 'disparu', 'p3'), 'p3');
  assert.equal(schemaStopKey(NAV, null, null), 'p1');
  assert.equal(schemaStopKey(NAV, 'disparu', 'disparu'), 'p1');
  assert.equal(schemaStopKey([], 'p1', 'p1'), null);
});

// Les instantanés réels sont publiés avec le dépôt (masqués : cf. scripts/webinar-sequences/redact.mjs) ; dans un checkout partiel qui ne les
// aurait pas, ce test est ignoré au lieu d'échouer.
const SNAPSHOTS_DIR = new URL('../../data/webinarSequences/cohorts/', import.meta.url);

test('real cohort snapshots: every step lands in exactly one chain and no delay is NaN', {
  skip: existsSync(SNAPSHOTS_DIR) ? false : 'instantanés de cohortes absents',
}, () => {
  const dir = SNAPSHOTS_DIR;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'cohort snapshots are present');
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const emails = data.steps.map((s) => ({ ...s, key: `${data.cohort.id}::${s.kind}` }));
    const chains = buildSchemaChains(emails);
    const keys = chains.flatMap((c) => c.steps.map((s) => s.key));
    assert.equal(keys.length, emails.length, `${file}: no step lost`);
    assert.equal(new Set(keys).size, keys.length, `${file}: no step duplicated`);
    for (const chain of chains) {
      assert.equal(chain.gaps.length, chain.connected ? chain.steps.length - 1 : 0, `${file} ${chain.id}`);
      for (const gap of chain.gaps) assert.ok(gap === null || (typeof gap === 'string' && gap !== '' && !/NaN/.test(gap)), `${file} ${chain.id}: ${gap}`);
    }
    for (const step of data.steps) conditionSummary(step.conditions); // ne lève jamais
  }
});
