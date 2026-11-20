import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_TEAM, callsOf, fmtDate, fmtN, fmtPeriod, groupTeams, initialsOf, matchesSearch, prospectName, scoreBand, sharedCount, sortScorecards, splitFiles, TONES, totalsOf,
} from './recordingsData.js';

const sales = [
  { email: 'a@x.fr', name: 'Élodie Martin', team: 'Alpha', nb_videos: 2 },
  { email: 'b@x.fr', name: 'Bruno Petit' },
  { email: 'c@x.fr', name: 'Chloé Durand', team: 'Beta' },
  { email: 'd@x.fr', full_name: 'Dan Roux', team: 'Alpha' },
];

test('fmtN : un nombre en français, sinon « — » (jamais NaN ni 0 inventé)', () => {
  assert.equal(fmtN(null), '—');
  assert.equal(fmtN(undefined), '—');
  assert.equal(fmtN('—'), '—');
  assert.equal(fmtN(NaN), '—');
  assert.equal(fmtN(0), '0');
  assert.match(fmtN(1234), /^1\s234$/);
});

test('initialsOf : deux initiales en majuscules', () => {
  assert.equal(initialsOf('élodie martin dupont'), 'ÉM');
  assert.equal(initialsOf(''), '');
  assert.equal(initialsOf(null), '');
});

test('matchesSearch : nom ou e-mail, sans accents ni casse', () => {
  assert.ok(matchesSearch(sales[0], 'elodie'));
  assert.ok(matchesSearch(sales[0], 'ÉLODIE'));
  assert.ok(matchesSearch(sales[0], 'a@x'));
  assert.ok(matchesSearch(sales[3], 'dan'));
  assert.ok(!matchesSearch(sales[0], 'bruno'));
  assert.ok(matchesSearch(sales[0], '  '));
});

test('groupTeams : équipes dans l\'ordre d\'arrivée, « Sans équipe » en dernier, filtres', () => {
  const all = groupTeams(sales);
  assert.deepEqual(all.teams, ['Alpha', 'Beta', NO_TEAM]);
  assert.deepEqual(all.groups.map((g) => g.label), ['Alpha', 'Beta', NO_TEAM]);
  assert.deepEqual(all.groups[0].members.map((s) => s.email), ['a@x.fr', 'd@x.fr']);
  const byTeam = groupTeams(sales, { team: 'Beta' });
  assert.deepEqual(byTeam.groups.map((g) => g.label), ['Beta']);
  assert.deepEqual(byTeam.teams, ['Alpha', 'Beta', NO_TEAM], 'la liste des équipes ne dépend pas du filtre');
  const byQuery = groupTeams(sales, { query: 'bruno' });
  assert.deepEqual(byQuery.groups.map((g) => g.label), [NO_TEAM]);
  assert.deepEqual(groupTeams(sales, { query: 'zzz' }).groups, []);
  assert.deepEqual(groupTeams(null).groups, []);
});

test('groupTeams : chaque personne apparaît une seule fois', () => {
  const emails = groupTeams(sales).groups.flatMap((g) => g.members.map((s) => s.email));
  assert.equal(emails.length, new Set(emails).size);
  assert.equal(emails.length, sales.length);
});

test('couleurs d\'équipe : par rang, voisines toujours différentes, « Sans équipe » neutre', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ email: `${i}@x.fr`, name: `P${i}`, team: `T${i}` })).concat([{ email: 'z@x.fr', name: 'Z' }]);
  const { groups } = groupTeams(many);
  for (let i = 1; i < groups.length - 1; i++) assert.notEqual(groups[i].tone, groups[i - 1].tone);
  assert.ok(groups.slice(0, 7).every((g) => TONES.includes(g.tone)));
  assert.equal(groups[7].tone, null);
  assert.equal(groupTeams(many, { team: 'T3' }).groups[0].tone, groups[3].tone, 'le filtre ne change pas la couleur');
});

test('sharedCount : nb_shared sinon décompte des fichiers partagés', () => {
  assert.equal(sharedCount({ nb_shared: 3 }), 3);
  assert.equal(sharedCount({ nb_shared: 0, recordings: [{ shared: true }] }), 0);
  assert.equal(sharedCount({ recordings: [{ shared: true }, { shared: false }, { shared: true }] }), 2);
  assert.equal(sharedCount({}), 0);
});

test('callsOf : en cours = pending ; compte non relié = valeur nulle', () => {
  assert.deepEqual(callsOf(sales[0], { loading: true }), { value: null, pending: true });
  assert.deepEqual(callsOf(sales[0], undefined), { value: null, pending: true });
  const calls = { loading: false, byEmail: { 'a@x.fr': { calls: 12 }, 'c@x.fr': { calls: null } } };
  assert.deepEqual(callsOf(sales[0], calls), { value: 12, pending: false });
  assert.deepEqual(callsOf(sales[2], calls), { value: null, pending: false });
  assert.deepEqual(callsOf(sales[1], calls), { value: null, pending: false });
});

test('totalsOf : totaux de l\'en-tête', () => {
  const data = { sales: [{ nb_scored: 2 }, { nb_scored: 3 }, {}], totals: { videos: 7, transcriptions: 9 } };
  assert.deepEqual(totalsOf(data, { loading: false, total: 40 }), { sales: 3, calls: 40, scored: 5, videos: 7, docs: 9 });
  assert.deepEqual(totalsOf(null, { loading: true }), { sales: null, calls: null, scored: null, videos: null, docs: null });
  assert.equal(totalsOf({ sales: [] }, { loading: false, total: null }).calls, null);
});

test('splitFiles : vidéos / notes / partagés, partagés exclus des deux premières', () => {
  const r = [
    { id: 1, kind: 'video' }, { id: 2, kind: 'note' }, { id: 3, kind: 'transcript' },
    { id: 4, kind: 'video', shared: true }, { id: 5, kind: 'note', shared: true },
  ];
  const f = splitFiles(r);
  assert.deepEqual(f.videos.map((x) => x.id), [1]);
  assert.deepEqual(f.notes.map((x) => x.id), [2, 3]);
  assert.deepEqual(f.shared.map((x) => x.id), [4, 5]);
  assert.deepEqual(splitFiles(undefined), { videos: [], notes: [], shared: [] });
});

test('sortScorecards : la plus récente d\'abord, sans modifier l\'entrée', () => {
  const list = [{ id: 1, rdv_date: '2026-11-01' }, { id: 2, rdv_date: '2026-11-10' }, { id: 3 }];
  assert.deepEqual(sortScorecards(list).map((s) => s.id), [2, 1, 3]);
  assert.deepEqual(list.map((s) => s.id), [1, 2, 3]);
  assert.deepEqual(sortScorecards(null), []);
});

test('scoreBand : seuils 80 / 70 / 60', () => {
  assert.equal(scoreBand(95), 'top');
  assert.equal(scoreBand(80), 'top');
  assert.equal(scoreBand(79), 'good');
  assert.equal(scoreBand(70), 'good');
  assert.equal(scoreBand(69), 'mid');
  assert.equal(scoreBand(60), 'mid');
  assert.equal(scoreBand(59), 'low');
});

test('fmtPeriod, fmtDate, prospectName', () => {
  assert.equal(fmtPeriod('2026-W31'), 'Semaine 31 · 2026');
  assert.equal(fmtPeriod('2026-W03'), 'Semaine 3 · 2026');
  assert.equal(fmtPeriod('autre'), 'autre');
  assert.equal(fmtPeriod(null), '');
  assert.equal(fmtDate(''), '');
  assert.match(fmtDate('2026-11-05T10:00:00Z'), /05/);
  assert.equal(prospectName({ prospect: 'Jean Dupont (Acme)' }), 'Jean Dupont');
  assert.equal(prospectName({}), 'Prospect');
});
