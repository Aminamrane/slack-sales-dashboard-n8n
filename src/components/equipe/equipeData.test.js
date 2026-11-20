import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absentees, countPeople, fmtDay, groupSales, initialsOf, isTestOrAdmin, isTestSetter, legibleOnWhite, listSetters, salesSheetPath, sellerIndex, setterPerfIndex, setterSheetPath, withSales,
} from './equipeData.js';

const user = (id, full_name, extra = {}) => ({ id, full_name, role: 'sales', email: `${id}@example.test`, avatar_url: null, ...extra });
const team = (id, label, color, captain, members) => ({ id, label, color, captain: captain ? { id: captain } : null, members: members.map((m) => ({ id: m })) });

test('initials: two letters, first and last word, « ? » without a name', () => {
  assert.equal(initialsOf('Camille Durand'), 'CD');
  assert.equal(initialsOf('Jean Pierre Martin'), 'JM');
  assert.equal(initialsOf('Madonna'), 'MA');
  assert.equal(initialsOf('  '), '?');
  assert.equal(initialsOf(null), '?');
});

test('admin and test accounts are never listed', () => {
  assert.equal(isTestOrAdmin({ role: 'admin' }), true);
  assert.equal(isTestOrAdmin({ role: 'sales', email: 'x@test.com' }), true);
  assert.equal(isTestOrAdmin({ role: 'sales', full_name: 'Compte Test' }), true);
  assert.equal(isTestOrAdmin({ role: 'sales', full_name: 'Alice Latest' }), false);
  assert.equal(isTestSetter({ email: 's@test.com' }), true);
  assert.equal(isTestSetter({ full_name: 'Setter Test' }), true);
  assert.equal(isTestSetter({ full_name: 'Lina Barbier', email: 'lina@example.test' }), false);
});

test('team colour used as TEXT on white: kept when readable, darkened until 5.4:1 when too light, untouched when not a hex code', () => {
  const ratio = (hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 1.05 / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05);
  };
  assert.equal(legibleOnWhite('#1e3a7b'), '#1e3a7b');
  assert.equal(legibleOnWhite('#1E3A7B'), '#1e3a7b');
  for (const light of ['#facc15', '#fde68a', '#a3e635', '#ffffff']) {
    const out = legibleOnWhite(light);
    assert.match(out, /^#[0-9a-f]{6}$/);
    assert.ok(ratio(out) >= 5.4, `${light} -> ${out} : ${ratio(out)}`);
  }
  assert.equal(legibleOnWhite('teal'), null);
  assert.equal(legibleOnWhite(undefined), null);
});

test('sales: teams in API order, captain first then alphabetical, « Sans équipe » last', () => {
  const users = [user('a', 'Zoé Rey'), user('b', 'Camille Durand'), user('c', 'Adam Vidal'), user('d', 'Élodie Martin'), user('e', 'Océane Blanc'), user('f', 'Hugo Fontaine')];
  const teams = [
    team('t1', 'Atlas', '#1e3a7b', 'b', ['a', 'f']),
    team('t2', 'Dune', '#8a5a00', 'e', ['c']),
    team('t3', 'Vide', '#3e7d5a', null, []),
  ];
  const groups = groupSales(users, teams);
  assert.deepEqual(groups.map((g) => g.label), ['Atlas', 'Dune', 'Sans équipe']);
  assert.deepEqual(groups[0].members.map((m) => m.name), ['Camille Durand', 'Hugo Fontaine', 'Zoé Rey']);
  assert.equal(groups[0].members[0].isCaptain, true);
  assert.equal(groups[0].members[1].isCaptain, false);
  assert.deepEqual(groups[1].members.map((m) => m.name), ['Océane Blanc', 'Adam Vidal']);
  assert.deepEqual(groups[2].members.map((m) => m.name), ['Élodie Martin']);
  assert.equal(groups[2].neutral, true);
  assert.equal(groups[0].neutral, false);
  assert.equal(groups[0].color, '#1e3a7b');
  assert.equal(countPeople(groups), 6);
});

test('sales: admin / test accounts are left out, a person listed twice appears once, no teams = one neutral group', () => {
  const users = [user('a', 'Alice Durand'), user('a', 'Alice Durand'), user('x', 'Admin Démo', { role: 'admin' }), user('y', 'Compte Test'), user('z', 'Bob Petit', { avatar_url: 'https://img.example.test/b.png' })];
  const groups = groupSales(users, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'Sans équipe');
  assert.deepEqual(groups[0].members.map((m) => m.name), ['Alice Durand', 'Bob Petit']);
  assert.equal(groups[0].members[1].avatar, 'https://img.example.test/b.png');
  assert.equal(groups[0].members[0].avatar, null);
});

test('sales: a captain keeps the captain place even when another team lists them as a member', () => {
  const users = [user('a', 'Alice Durand'), user('b', 'Bob Petit')];
  const teams = [team('t1', 'Atlas', '#1e3a7b', null, ['a']), team('t2', 'Dune', '#8a5a00', 'a', ['b'])];
  const groups = groupSales(users, teams);
  const all = groups.flatMap((g) => g.members);
  assert.equal(all.filter((m) => m.name === 'Alice Durand').length, 1);
});

test('sales: empty or malformed answers give an empty list, never a crash', () => {
  assert.deepEqual(groupSales(undefined, undefined), []);
  assert.deepEqual(groupSales(null, null), []);
  assert.deepEqual(groupSales([null, {}], [{ id: 't', label: 'X' }]), []);
});

test('deactivated accounts are never listed, sales or setters', () => {
  const users = [user('a', 'Alice Durand'), user('b', 'Bob Petit', { is_active: false }), user('c', 'Cléa Roy', { active: false }), user('d', 'Dan Moreau', { is_active: true })];
  assert.deepEqual(groupSales(users, []).flatMap((g) => g.members.map((m) => m.name)), ['Alice Durand', 'Dan Moreau']);
  const out = listSetters([{ id: 's1', full_name: 'Alix Renard', email: 'a@example.test' }, { id: 's2', full_name: 'Bia Neuf', email: 'b@example.test', is_active: false }]);
  assert.deepEqual(out.map((s) => s.name), ['Alix Renard']);
});

test('sales: role label only for roles that stand out, absence date kept', () => {
  const users = [user('a', 'Alice Durand', { role: 'head_of_sales' }), user('b', 'Bob Petit', { unavailable_until: '2026-11-24' }), user('c', 'Cléa Roy', { role: 'head_of_sales_manager' })];
  const [g] = groupSales(users, []);
  const by = Object.fromEntries(g.members.map((m) => [m.name, m]));
  assert.equal(by['Alice Durand'].roleLabel, 'Head of sales');
  assert.equal(by['Cléa Roy'].roleLabel, 'Head of sales manager');
  assert.equal(by['Bob Petit'].roleLabel, null);
  assert.equal(by['Bob Petit'].until, '2026-11-24');
  assert.deepEqual(absentees([g]).map((m) => m.name), ['Bob Petit']);
  assert.equal(fmtDay('2026-11-24'), '24/11');
  assert.equal(fmtDay(null), '');
});

test('monthly sales: matched by canonical name, unknown stays null, never 0 by default', () => {
  const groups = groupSales(
    [user('a', 'Yohan Debowski'), user('b', 'Léa Fabre'), user('c', 'Nathan Roussel')],
    [team('t1', 'Atlas', '#1e3a7b', 'a', ['b', 'c'])],
  );
  assert.equal(groups[0].members[0].sales, null);
  const idx = sellerIndex({ totals: { sales: 9, revenue: 1000 }, all_sellers: [{ name: 'yohan', sales: 4, revenue: 700 }, { name: 'Lea Fabre', sales: 0, revenue: 0 }, { name: 'Inconnu Total', sales: 5, revenue: 300 }] });
  assert.deepEqual(idx.totals, { sales: 9, revenue: 1000 });
  const { groups: out, max } = withSales(groups, idx);
  const by = Object.fromEntries(out[0].members.map((m) => [m.name, m.sales]));
  assert.deepEqual(by, { 'Yohan Debowski': 4, 'Léa Fabre': 0, 'Nathan Roussel': null });
  assert.equal(out[0].sales, 4);
  assert.equal(max, 4);
  assert.equal(groups[0].members[0].sales, null, 'arguments untouched');
  const none = withSales(groups, null);
  assert.equal(none.groups[0].sales, null);
  assert.equal(none.max, 0);
  assert.equal(sellerIndex(undefined), null);
  assert.equal(sellerIndex({ all_sellers: 'x' }), null);
});

test('setters: one entry per setter, even when attached to several teams, sorted, test accounts out, no team field', () => {
  const list = [
    { id: 's2', full_name: 'Yanis Caron', email: 'y@example.test', teams: [{ label: 'Atlas' }, { label: 'Dune' }], assignments: [{ target_type: 'user', target_label: 'Alice Durand', team_label: 'Atlas' }, { target_type: 'user', target_label: 'Bob Petit', team_label: 'Dune', manual_only: true }] },
    { id: 's1', full_name: 'Alix Renard', email: 'a@example.test', avatar_url: 'https://img.example.test/a.png', assignments: [{ target_type: 'user', target_label: 'Alice Durand', immediate_new_leads: true }] },
    { id: 's2', full_name: 'Yanis Caron', email: 'y@example.test' },
    { id: 's3', full_name: 'Setter Test', email: 's@example.test' },
    { id: 's4', full_name: 'Élise Moreau', email: 'e@example.test' },
  ];
  const out = listSetters(list);
  assert.deepEqual(out.map((s) => s.name), ['Alix Renard', 'Élise Moreau', 'Yanis Caron']);
  assert.equal(out[0].avatar, 'https://img.example.test/a.png');
  assert.deepEqual(Object.keys(out[0]).sort(), ['avatar', 'email', 'key', 'modes', 'name', 'qualified', 'rdv', 'sales', 'served']);
  assert.deepEqual(out[2].modes, ['man', 'std']);
  assert.deepEqual(out[0].modes, ['imm']);
});

test('setters: sales followed = people targeted, team targets expanded into their members, duplicates collapsed, photos from the sales list', () => {
  const groups = groupSales([user('a', 'Alice Durand', { avatar_url: 'https://img.example.test/al.png' }), user('b', 'Bob Petit'), user('c', 'Cléa Roy')], []);
  const people = groups.flatMap((g) => g.members);
  const teams = [{ id: 't1', label: 'Atlas', color: '#1e3a7b', captain: { id: 'a', name: 'Alice Durand' }, members: [{ id: 'b', name: 'Bob Petit' }, { id: 'c', name: 'Cléa Roy' }] }];
  const list = [{ id: 's1', full_name: 'Alix Renard', email: 'a@example.test', assignments: [
    { target_type: 'team', target_label: 'Atlas', team_label: 'Atlas' },
    { target_type: 'user', target_label: 'bob petit', team_label: 'Atlas', repondeur_only: true },
    { target_type: 'user', target_label: 'Dora Inconnue' },
  ] }];
  const [s] = listSetters(list, { people, teams });
  assert.deepEqual(s.served.map((p) => p.name), ['Alice Durand', 'Bob Petit', 'Cléa Roy', 'Dora Inconnue']);
  assert.equal(s.served[0].avatar, 'https://img.example.test/al.png');
  assert.equal(s.served[3].avatar, null);
  assert.deepEqual(s.modes, ['rep', 'std']);
  const [none] = listSetters([{ id: 's9', full_name: 'Noa Sans', email: 'n@example.test', assignments: [{ target_type: 'team', target_label: 'Disparue', team_label: 'Disparue' }] }], { people, teams });
  assert.deepEqual(none.served, []);
});

test('setters: month figures by id, unknown stays null', () => {
  const perf = setterPerfIndex({ totals: { rdv: 12, qualified: 7, sales: 3 }, setters: [{ id: 's1', rdv: 5, qualified: 3, sales: 1 }, { id: 's2', rdv: 7, qualified: 4, sales: 2 }] });
  assert.deepEqual(perf.totals, { rdv: 12, qualified: 7, sales: 3 });
  const out = listSetters([{ id: 's1', full_name: 'Alix Renard', email: 'a@example.test' }, { id: 's5', full_name: 'Bia Neuf', email: 'b@example.test' }], { perf });
  assert.deepEqual([out[0].rdv, out[0].qualified, out[0].sales], [5, 3, 1]);
  assert.deepEqual([out[1].rdv, out[1].qualified, out[1].sales], [null, null, null]);
  assert.equal(setterPerfIndex(undefined), null);
  assert.equal(listSetters([{ id: 's1', full_name: 'Alix Renard' }])[0].rdv, null);
});

test('setters: falls back to the e-mail when there is no id, and tolerates empty answers', () => {
  assert.deepEqual(listSetters([{ full_name: 'Lina Barbier', email: 'l@example.test' }]).map((s) => s.key), ['l@example.test']);
  assert.deepEqual(listSetters(undefined), []);
  assert.deepEqual(listSetters([null, {}]), []);
});

test('ghost paths keep the routes of the old page and encode the e-mail', () => {
  assert.equal(salesSheetPath('a.b+c@example.test'), '/ceo/sheet/a.b%2Bc%40example.test?ghost=true');
  assert.equal(setterSheetPath('a@example.test'), '/ceo/setter-sheet/a%40example.test?ghost=true');
});
