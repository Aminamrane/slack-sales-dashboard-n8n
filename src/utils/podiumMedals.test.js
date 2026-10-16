import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMedal, completedMonths, loadPodiumMedals, monthPodium, nameKey, ownedMedals, tallyMedals } from './podiumMedals.js';

const OCT_15_2026 = new Date(2026, 9, 15, 10, 0, 0);

test('completedMonths : de septembre 2025 au mois précédant le mois en cours', () => {
  const months = completedMonths(OCT_15_2026);
  assert.equal(months.length, 13);
  assert.equal(months[0], '2025-09');
  assert.equal(months.at(-1), '2026-09');
  assert.ok(!months.includes('2026-10'), 'le mois en cours n\'est pas terminé');
});

test('completedMonths : aucun mois avant la fin du premier, bascule d\'année et mois suivants', () => {
  assert.deepEqual(completedMonths(new Date(2025, 8, 20)), []);
  assert.deepEqual(completedMonths(new Date(2025, 9, 1)), ['2025-09']);
  assert.deepEqual(completedMonths(new Date(2026, 0, 5)), ['2025-09', '2025-10', '2025-11', '2025-12']);
  assert.equal(completedMonths(new Date(2027, 0, 1)).at(-1), '2026-12');
});

test('monthPodium : classe par nombre de ventes décroissant', () => {
  const p = monthPodium([{ name: 'B', sales: 2 }, { name: 'A', sales: 5 }, { name: 'C', sales: 3 }, { name: 'D', sales: 1 }]);
  assert.deepEqual(p, { first: 'A', second: 'C', third: 'B' });
});

test('monthPodium : égalité départagée par l\'ordre alphabétique, sans accents ni casse (règle des trophées)', () => {
  const p = monthPodium([{ name: 'Zoé', sales: 3 }, { name: 'léa', sales: 3 }, { name: 'Adam', sales: 3 }]);
  assert.deepEqual(p, { first: 'Adam', second: 'léa', third: 'Zoé' });
});

test('monthPodium : seuls ceux qui ont vendu comptent, moins de trois vendeurs laisse des places vides', () => {
  assert.deepEqual(monthPodium([{ name: 'A', sales: 4 }, { name: 'B', sales: 0 }, { name: 'C' }, { name: '', sales: 9 }]),
    { first: 'A', second: null, third: null });
  assert.deepEqual(monthPodium([]), { first: null, second: null, third: null });
  assert.deepEqual(monthPodium(null), { first: null, second: null, third: null });
  assert.deepEqual(monthPodium([{ name: 'A', sales: '4' }, { name: 'B', sales: '2' }]), { first: 'A', second: 'B', third: null });
});

test('nameKey : « Léo » et « Leo  Mafrici » sont la même personne', () => {
  assert.equal(nameKey('Léo Mafrici'), nameKey('  leo   MAFRICI '));
  assert.equal(nameKey(null), '');
});

test('tallyMedals : cumule les 1ers, 2es et 3es de tous les mois', () => {
  const t = tallyMedals([
    [{ name: 'Léo Mafrici', sales: 6 }, { name: 'Yohan Debowski', sales: 4 }, { name: 'Marie Czelecz', sales: 2 }],
    [{ name: 'Yohan Debowski', sales: 7 }, { name: 'Leo Mafrici', sales: 5 }, { name: 'Marie Czelecz', sales: 5 }],
    [],
  ]);
  assert.deepEqual(t.first, { 'leo mafrici': 1, 'yohan debowski': 1 });
  assert.deepEqual(t.second, { 'yohan debowski': 1, 'leo mafrici': 1 });
  assert.deepEqual(t.third, { 'marie czelecz': 2 });
});

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, _m: m };
}

function fakeClient(byMonth, { failOn = [] } = {}) {
  const calls = [];
  let running = 0;
  let peak = 0;
  return {
    calls,
    get peak() { return peak; },
    async getLeaderboardStats(month) {
      calls.push(month);
      running += 1; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 2));
      running -= 1;
      if (failOn.includes(month)) throw new Error('boom');
      return { all_sellers: (byMonth[month] || []).map((s) => ({ ...s, revenue: 1000 })) };
    },
  };
}

const HISTORY = {
  '2025-09': [{ name: 'Léo Mafrici', sales: 5 }, { name: 'Yohan Debowski', sales: 3 }, { name: 'Marie Czelecz', sales: 1 }],
  '2025-10': [{ name: 'Yohan Debowski', sales: 6 }, { name: 'Léo Mafrici', sales: 4 }],
  '2026-09': [{ name: 'Marie Czelecz', sales: 8 }, { name: 'Léo Mafrici', sales: 8 }, { name: 'Yohan Debowski', sales: 2 }],
};

test('loadPodiumMedals : lit chaque mois terminé (3 à la fois), cumule, puis ne relit rien tant que le cache est frais', async () => {
  globalThis.localStorage = fakeStorage();
  try {
    const client = fakeClient(HISTORY);
    const t = await loadPodiumMedals(client, { now: OCT_15_2026 });
    assert.equal(client.calls.length, 13);
    assert.ok(client.peak <= 3, `au plus 3 requêtes en parallèle, vu ${client.peak}`);
    assert.ok(!client.calls.includes('2026-10'));
    assert.deepEqual(t.first, { 'leo mafrici': 2, 'yohan debowski': 1 });
    // 2026-09 : Léo et Marie à égalité (8 ventes) → ordre alphabétique : Léo 1er, Marie 2e, Yohan 3e
    assert.deepEqual(t.second, { 'yohan debowski': 1, 'leo mafrici': 1, 'marie czelecz': 1 });
    assert.deepEqual(t.third, { 'marie czelecz': 1, 'yohan debowski': 1 });

    const again = fakeClient(HISTORY);
    const t2 = await loadPodiumMedals(again, { now: new Date(OCT_15_2026.getTime() + 3600 * 1000) });
    assert.equal(again.calls.length, 0, 'cache frais : aucune requête');
    assert.deepEqual(t2, t);

    const later = fakeClient(HISTORY);
    await loadPodiumMedals(later, { now: new Date(OCT_15_2026.getTime() + 7 * 3600 * 1000) });
    assert.equal(later.calls.length, 13, 'cache périmé : les mois sont relus');
  } finally {
    delete globalThis.localStorage;
  }
});

test('loadPodiumMedals : un mois illisible est ignoré, les autres comptent, il n\'est pas mis en cache', async () => {
  globalThis.localStorage = fakeStorage();
  try {
    const client = fakeClient(HISTORY, { failOn: ['2025-10'] });
    const t = await loadPodiumMedals(client, { now: OCT_15_2026 });
    assert.deepEqual(t.first, { 'leo mafrici': 2 });   // 2025-10 illisible : seuls 2025-09 et 2026-09 comptent
    assert.equal(globalThis.localStorage.getItem('lb_podium_v1:2025-10'), null);
    assert.notEqual(globalThis.localStorage.getItem('lb_podium_v1:2025-09'), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test('loadPodiumMedals : sans stockage navigateur ou avec un cache corrompu, tout est relu sans erreur', async () => {
  delete globalThis.localStorage;
  const a = fakeClient(HISTORY);
  await loadPodiumMedals(a, { now: OCT_15_2026 });
  assert.equal(a.calls.length, 13);

  const store = fakeStorage();
  store.setItem('lb_podium_v1:2025-09', '{pas du json');
  globalThis.localStorage = store;
  try {
    const b = fakeClient(HISTORY);
    await loadPodiumMedals(b, { now: OCT_15_2026 });
    assert.ok(b.calls.includes('2025-09'));
  } finally {
    delete globalThis.localStorage;
  }
});

test('médailles empilées : or par défaut, sinon argent, sinon bronze, sinon rien', () => {
  assert.equal(activeMedal({ gold: 2, silver: 1, bronze: 3 }), 'gold');
  assert.equal(activeMedal({ gold: 0, silver: 1, bronze: 3 }), 'silver');
  assert.equal(activeMedal({ silver: 0, bronze: 3 }), 'bronze');
  assert.equal(activeMedal({}), null);
  assert.equal(activeMedal(undefined), null);
});

test('médailles empilées : la médaille survolée gagne, sauf si la personne ne la possède pas', () => {
  const counts = { gold: 2, silver: 0, bronze: 3 };
  assert.equal(activeMedal(counts, 'bronze'), 'bronze');
  assert.equal(activeMedal(counts, 'silver'), 'gold');
  assert.deepEqual(ownedMedals(counts), ['gold', 'bronze']);
});
