import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW, flowLayout, ribbonAt } from './flowLayout.js';
import { flowGraph, nodeDetail, nodeText } from './flowData.js';

// Octobre 2026 en direct (15/10, intake.links) : 497 fiches de Funnel Leads.
const L = (channel, funnel, fate, n) => ({ channel, funnel, fate, n });
const october = { created: 497, flow: { outside_affectation: 1 }, links: [
  L('ads', 'fr', 'ads_affectation', 233), L('ads', 'fr', 'ads_pool', 92), L('ads', 'fr', 'pool_waiting', 76), L('ads', 'small', 'not_given_small', 42),
  L('ads', 'fr', 'not_given_duplicate', 17), L('ads', 'non_fr', 'ads_affectation', 10), L('webinar', 'fr', 'other_webinar', 7), L('ads', 'small', 'ads_affectation', 5),
  L('linkedin', 'fr', 'other_linkedin', 4), L('webinar', 'fr', 'not_given_webinar', 2), L('ads', 'small', 'ads_pool', 2), L('referral', 'fr', 'other_referral', 2),
  L('ads', 'small', 'pool_waiting', 1), L('test', 'non_fr', 'demo', 1), L('ads', 'small', 'not_given_duplicate', 1), L('ads', 'non_fr', 'not_given_unclassifiable', 1),
  L('ads', 'non_fr', 'pool_waiting', 1)] };
const tiny = { created: 6, links: [L('ads', 'fr', 'ads_affectation', 1), L('ads', 'small', 'not_given_small', 1), L('ads', 'non_fr', 'pool_waiting', 1),
  L('webinar', 'fr', 'other_webinar', 1), L('linkedin', 'fr', 'other_linkedin', 1), L('referral', 'fr', 'other_referral', 1)] };
const adsOnly = { created: 40, links: [L('ads', 'fr', 'ads_affectation', 39), L('ads', 'fr', 'demo', 1)] };
const big = { created: 2400, links: [L('ads', 'fr', 'ads_affectation', 1500), L('ads', 'fr', 'ads_pool', 400), L('ads', 'small', 'not_given_small', 300),
  L('webinar', 'fr', 'other_webinar', 150), L('webinar', 'fr', 'not_given_webinar', 40), L('ccs', 'fr', 'other_ccs', 10)] };

test('octobre : mêmes chiffres que Funnel Leads, une fiche = une case', () => {
  const g = flowGraph(october);
  const by = (id) => g.nodes.find((n) => n.id === id);
  assert.equal(by('root').value, 497);
  assert.deepEqual(['ch:ads', 'ch:webinar', 'ch:linkedin', 'ch:referral', 'ch:test'].map((id) => by(id).value), [481, 9, 4, 2, 1]);
  assert.deepEqual(['fun:fr', 'fun:non_fr', 'fun:small'].map((id) => by(id).value), [418, 12, 51]);
  assert.deepEqual(g.funnel, { received: 497, small: 51, without: 446, clean: 433, cleanAds: 418 });   // Funnel Leads : Clean (tél FR) 433
  assert.equal(by('ads:ads_affectation').value, 248);
  assert.equal(nodeText(by('webinar:not_given_webinar')), 'Webinaire · prises par les setters');
  const leaves = g.nodes.filter((n) => n.col === 3);
  assert.equal(leaves.reduce((a, n) => a + n.value, 0), 497);
  assert.ok(leaves.every((n) => n.group === 'ads' ? n.id.startsWith('ads:') : !n.id.startsWith('ads:')), 'aucun autre canal dans une case ADS');
  const d = nodeDetail(g, 'ads:ads_affectation');
  assert.deepEqual(d.rows.slice(1, 4).map((r) => r[1]), ['233', '10', '5']);
  assert.ok(d.node.lines.some((l) => l.includes('« ADS affectés » du tableau : 249, dont 1 reçue')));
  assert.equal(nodeDetail(g, 'root').rows[0][0], '→ ADS');
});

for (const [name, data] of Object.entries({ octobre: october, 'petites bandes': tiny, 'ADS seuls': adsOnly, 'gros mois': big })) {
  for (const width of [760, 1000, 1300, 1900]) {
    test(`${name}, ${width} px : étiquettes séparées, blocs disjoints, rubans dans leurs blocs, sauts sous les blocs`, () => {
      const g = flowGraph(data);
      const Lay = flowLayout(g, width);
      const leaves = Lay.leaves;
      leaves.slice(1).forEach((l, i) => assert.ok(l.cy - leaves[i].cy >= FLOW.LABEL_H, `${leaves[i].id} / ${l.id}`));
      Lay.cols.forEach((col) => {
        col.forEach((n) => assert.ok(n.y >= FLOW.HEAD - 1e-6 && n.y + n.h <= Lay.height + 1e-6, n.id));
        col.slice(1).forEach((n, i) => assert.ok(n.y >= col[i].y + col[i].h - 1e-6, `${col[i].id} / ${n.id}`));
      });
      assert.ok(Lay.x.cols.every((v, i) => !i || v > Lay.x.cols[i - 1] + Lay.blockW[i - 1]), JSON.stringify(Lay.x));
      assert.ok(Lay.x.lane >= 250, JSON.stringify(Lay.x));
      const by = new Map(Lay.nodes.map((n) => [n.id, n]));
      const inside = (a, size, n) => a >= n.y - 1e-6 && a + size <= n.y + n.h + 1e-6;
      for (const r of Lay.ribbons) assert.ok(inside(r.from, r.size, by.get(r.source)) && inside(r.to, r.size, by.get(r.target)), r.key);
      for (const n of Lay.nodes.filter((x) => x.col > 0 && x.col < 3)) {
        const into = Lay.ribbons.filter((r) => r.target === n.id).reduce((a, r) => a + r.value, 0);
        const out = Lay.ribbons.filter((r) => r.source === n.id).reduce((a, r) => a + r.value, 0);
        assert.equal(into, n.value); assert.equal(out, n.value);
      }
      const skips = Lay.ribbons.filter((r) => by.get(r.target).col - by.get(r.source).col > 1);
      for (const r of skips) {
        for (const b of Lay.cols[2]) {
          for (const xq of [Lay.x.cols[2], Lay.x.cols[2] + Lay.blockW[2]]) {
            const [top, bottom] = ribbonAt(r, xq);
            assert.ok(bottom <= b.y + 1e-6 || top >= b.y + b.h - 1e-6, `${r.key} traverse ${b.id}`);
          }
        }
      }
    });
  }
}
