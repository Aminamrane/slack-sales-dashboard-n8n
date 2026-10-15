import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW, flowLayout } from './flowLayout.js';

// Octobre 2026 en direct (15/10) : 497 fiches de Funnel Leads.
const leaf = (key, value) => ({ key, value });
const october = {
  total: 497,
  given: [leaf('ads_affectation', 255), leaf('ads_pool', 93), leaf('pool_waiting', 72), leaf('others', 13), leaf('demo', 1)],
  notGiven: [leaf('not_given_small', 42), leaf('not_given_duplicate', 18), leaf('not_given_webinar', 2), leaf('not_given_unclassifiable', 1)],
};
const withTotals = (d) => ({ ...d, givenTotal: d.given.reduce((a, n) => a + n.value, 0), notGivenTotal: d.notGiven.reduce((a, n) => a + n.value, 0) });
const cases = {
  octobre: withTotals(october),
  'un seul groupe': withTotals({ total: 40, given: [leaf('ads_affectation', 39), leaf('demo', 1)], notGiven: [] }),
  'que des petites bandes': withTotals({ total: 12, given: [leaf('a', 1), leaf('b', 1), leaf('c', 1), leaf('d', 1), leaf('e', 1), leaf('f', 1)], notGiven: [leaf('g', 1), leaf('h', 1), leaf('i', 1), leaf('j', 1), leaf('k', 1), leaf('l', 1)] }),
  'gros mois': withTotals({ total: 2400, given: [leaf('ads_affectation', 1900), leaf('ads_pool', 300)], notGiven: [leaf('not_given_small', 199), leaf('x', 1)] }),
};
const near = (a, b) => Math.abs(a - b) < 1e-6;

for (const [name, data] of Object.entries(cases)) {
  for (const width of [700, 1000, 1300, 1900]) {
    test(`${name}, ${width} px : étiquettes séparées, rubans dans leurs blocs, colonnes ordonnées`, () => {
      const L = flowLayout(data, width);
      L.leaves.slice(1).forEach((l, i) => assert.ok(l.cy - L.leaves[i].cy >= FLOW.LABEL_H, `${L.leaves[i].key} / ${l.key}`));
      L.leaves.forEach((l) => assert.ok(l.y >= FLOW.HEAD && l.y + l.h <= L.height + 1e-6));
      L.mids.slice(1).forEach((m, i) => assert.ok(m.y >= L.mids[i].y + L.mids[i].h, 'blocs du milieu disjoints'));
      [L.src, ...L.mids].forEach((b) => assert.ok(b.y >= FLOW.HEAD - 1e-6 && b.y + b.h <= L.height + 1e-6));
      assert.ok(L.x.mid > L.widths.src && L.x.mid + L.widths.mid < L.x.leaf && L.x.lane >= 230, JSON.stringify(L.x));
      const within = (a, size, top, h) => a >= top - 1e-6 && a + size <= top + h + 1e-6;
      for (const r of L.ribbons) {
        if (r.leaf) {
          const m = L.mids.find((x) => x.key === r.group);
          const l = L.leaves.find((x) => x.key === r.leaf);
          assert.ok(within(r.from, r.size, m.y, m.h) && within(r.to, r.size, l.y, l.h), r.key);
        } else {
          const m = L.mids.find((x) => x.key === r.group);
          assert.ok(within(r.from, r.size, L.src.y, L.src.h) && within(r.to, r.size, m.y, m.h), r.key);
        }
      }
      // L'épaisseur garde l'échelle : un groupe = la somme de ses destinations, la source = le total.
      L.mids.forEach((m) => assert.ok(near(m.ph, L.ribbons.filter((r) => r.leaf && r.group === m.key).reduce((a, r) => a + r.size, 0))));
      assert.ok(near(L.src.ph, data.total * L.k));
    });
  }
}

test('flowNodes : chaque fiche du mois dans une seule destination (octobre en direct, 15/10)', async () => {
  const { flowNodes, nodeText } = await import('./flowData.js');
  const flow = { ads_affectation: 248, small_segment: 51, small_given: 8, pool_waiting: 78, not_given_duplicate: 18, ads_pool: 94, not_given_small: 42,
    other_linkedin: 4, not_given_webinar: 2, demo: 1, other_webinar: 7, other_referral: 2, not_given_unclassifiable: 1, outside_affectation: 1 };
  const d = flowNodes({ created: 497, flow });
  assert.equal(d.givenTotal + d.notGivenTotal, 497);
  assert.deepEqual([d.givenTotal, d.notGivenTotal], [434, 63]);
  const others = d.given.find((n) => n.key === 'others');
  assert.equal(others.value, 13);
  assert.equal(nodeText(others), 'Autres canaux (LinkedIn 4 · webinaire 7 · parrainage 2)');
  assert.ok(d.given.find((n) => n.key === 'ads_affectation').lines.some((l) => l.includes('« ADS affectés » : 249')));
  const L = flowLayout(d, 1300);
  assert.equal(L.leaves.length, 9);
});
