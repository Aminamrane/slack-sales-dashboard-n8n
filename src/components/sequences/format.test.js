// format.test.js : logique pure de la page « Séquences email ». Données inventées.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DASH, num, pctOf, pctText, rateText, fmtDate, ago, fmtWhen, initial, segmentsOf, funnelOf, factsOf, perEmailOf,
  statusOf, tableRows, effectiveView, isLate, ROWS_PAGE, PALETTE, COLORS, isAllowedHue, FUNNEL_STEPS, SEGMENTS, STATE_META, ringsOf, ringDash, donutSegments,
} from './format.js';

test('un chiffre inconnu est « — », jamais « 0 » ; un vrai zéro reste 0', () => {
  assert.equal(num(null), DASH);
  assert.equal(num(undefined), DASH);
  assert.equal(num(''), DASH);
  assert.equal(num('abc'), DASH);
  assert.equal(num(0), '0');
  assert.equal(num(1234), `1${String.fromCharCode(0x202f)}234`);
  assert.equal(rateText(null), DASH);
  assert.equal(rateText(0), '0 %');
  assert.equal(rateText(12.5), '12,5 %');
});

test('une part sans base est « — » (jamais 0 %)', () => {
  assert.equal(pctOf(3, 12), 25);
  assert.equal(pctOf(1, 3), 33);
  assert.equal(pctOf(0, 10), 0);
  assert.equal(pctOf(5, 0), null);
  assert.equal(pctOf(5, null), null);
  assert.equal(pctText(5, 0), DASH);
  assert.equal(pctText(1, 4), '25 %');
});

test('dates : JJ/MM/AAAA en UTC, « — » si absente ; « il y a… » ; heure de Paris ou heure murale', () => {
  assert.equal(fmtDate('2026-11-05T23:30:00Z'), '05/11/2026');
  assert.equal(fmtDate(null), DASH);
  assert.equal(fmtDate('n’importe quoi'), DASH);
  const now = Date.UTC(2026, 10, 19, 12, 0, 0);
  assert.equal(ago(null, now), 'jamais');
  assert.equal(ago(new Date(now - 30000).toISOString(), now), 'il y a 30 s');
  assert.equal(ago(new Date(now - 5 * 60000).toISOString(), now), 'il y a 5 min');
  assert.equal(ago(new Date(now - 3 * 3600000).toISOString(), now), 'il y a 3 h');
  assert.equal(ago(new Date(now - 2 * 86400000).toISOString(), now), 'il y a 2 j');
  assert.equal(fmtWhen('2026-11-19T10:30:00Z'), '19/11 11h30');           // instant réel → Paris (UTC+1)
  assert.equal(fmtWhen('2026-07-01T10:00:00Z'), '01/07 12h00');           // été UTC+2
  assert.equal(fmtWhen('2026-11-19T14:05:00'), '19/11 14h05');            // heure murale : telle quelle
  assert.equal(fmtWhen(null), DASH);
  assert.equal(initial('  alice'), 'A');
  assert.equal(initial(''), '');
});

const ST = { eligible: 40, contacted: 200, sent: 640, clicked: 50, rebooked: 10, presented: 5, signed: 0 };

test('entonnoir : barres relatives aux contactés, conversion depuis l’étape précédente, zéro sans barre', () => {
  const f = funnelOf(ST);
  assert.deepEqual(f.map((s) => s.key), ['cont', 'click', 'rdv', 'prez', 'sign']);
  assert.deepEqual(f.map((s) => s.value), [200, 50, 10, 5, 0]);
  assert.deepEqual(f.map((s) => s.conv), [null, 25, 20, 50, 0]);
  assert.deepEqual(f.map((s) => s.width), [100, 25, 5, 3, 0]);            // 2,5 % → plancher 3 ; 0 → 0
  assert.equal(f[3].hint, 'R1 tenu après la reprise');
});

test('entonnoir : base nulle ou valeur absente → conversion « — » (null), valeur inconnue non transformée en 0', () => {
  const f = funnelOf({ contacted: 0, clicked: 0, rebooked: null, presented: 0, signed: 0 });
  assert.equal(f[1].conv, null);
  assert.equal(f[2].value, null);
  assert.equal(f[2].width, 0);
  assert.deepEqual(funnelOf(null), []);
});

test('les six chiffres du haut gardent leur ordre et leur sens', () => {
  const k = factsOf(ST);
  assert.deepEqual(k.map((x) => x.label), ['Éligibles', 'Emails envoyés', 'Ont cliqué', 'RDV repris', 'Présentés', 'Signés']);
  assert.deepEqual(k.map((x) => x.value), [40, 640, 50, 10, 5, 0]);
  assert.deepEqual(factsOf(null), []);
});

test('répartition par motif : parts et total ; un motif absent vaut 0, le total nul donne une part « — »', () => {
  const s = segmentsOf({ segments: { refus_r1: 6, no_show: 2 } });
  assert.equal(s.total, 8);
  assert.deepEqual(s.rows.map((r) => [r.key, r.n, r.share]), [['refus_r1', 6, 75], ['injoignable', 0, 0], ['no_show', 2, 25]]);
  const empty = segmentsOf({ segments: {} });
  assert.equal(empty.total, 0);
  assert.ok(empty.rows.every((r) => r.share === null));
});

test('funnel par email : dix colonnes, hauteur relative au plus gros envoi, part cliquée bornée', () => {
  const rows = perEmailOf({ per_email: [{ email_num: 1, sent: 100, clicked: 20, booked: 3 }, { email_num: 3, sent: 50, clicked: 80, booked: 1 }] });
  assert.equal(rows.length, 10);
  assert.deepEqual([rows[0].sent, rows[1].sent, rows[2].sent], [100, 0, 50]);
  assert.equal(rows[0].height, 1);
  assert.equal(rows[2].height, 0.5);
  assert.equal(rows[0].clickShare, 0.2);
  assert.equal(rows[2].clickShare, 1);                                     // jamais plus que la colonne
  assert.equal(rows[1].clickShare, 0);
  assert.equal(perEmailOf(null).length, 10);
});

test('statut d’un prospect : du plus avancé au moins avancé', () => {
  assert.equal(statusOf({ signed: true, presented: true }).key, 'signed');
  assert.equal(statusOf({ presented: true, rebooked: true }).key, 'presented');
  assert.equal(statusOf({ rebooked: true, clicked: true }).key, 'rebooked');
  assert.equal(statusOf({ clicked: true }).key, 'clicked');
  assert.equal(statusOf({}).key, 'sent');
  assert.equal(statusOf(null).key, 'sent');
});

const seqOf = (n) => ({
  enabled: true,
  stats: { eligible: 450 },
  contacted: Array.from({ length: n }, (_, i) => ({ lead_id: i, full_name: `Prospect ${i}`, email: `p${i}@example.test`, sales: i % 2 ? 'Alice' : 'Bruno' })),
  eligible_sample: Array.from({ length: 200 }, (_, i) => ({ lead_id: 1000 + i, full_name: `Éligible ${i}`, email: `e${i}@example.test`, sales: 'Alice' })),
});

test('tableau : recherche sur nom, email et sales ; coupure à la page ; « hidden » dit ce qui reste', () => {
  const seq = seqOf(250);
  const all = tableRows(seq, 'in_seq', '');
  assert.equal(all.list.length, ROWS_PAGE);
  assert.equal(all.matched, 250);
  assert.equal(all.hidden, 150);
  assert.equal(all.truncated, false);
  assert.equal(tableRows(seq, 'in_seq', '', 1000).hidden, 0);
  assert.equal(tableRows(seq, 'in_seq', ' PROSPECT 12 ').matched, 11);     // 12, 120 à 129
  assert.equal(tableRows(seq, 'in_seq', 'alice').matched, 125);
  assert.equal(tableRows(seq, 'in_seq', 'p7@example').list[0].lead_id, 7);
  assert.equal(tableRows(seq, 'in_seq', 'introuvable').list.length, 0);
});

test('tableau des éligibles : aperçu borné à 200 sur 450 → « truncated », total du serveur', () => {
  const t = tableRows(seqOf(3), 'eligible', '');
  assert.equal(t.eligible, true);
  assert.equal(t.total, 450);
  assert.equal(t.truncated, true);
  assert.equal(t.matched, 200);
  assert.equal(tableRows({ ...seqOf(3), stats: { eligible: 200 } }, 'eligible', '').truncated, false);
  assert.equal(tableRows(null, 'in_seq', '').list.length, 0);
});

test('vue par défaut : dans la séquence si active, sinon éligibles ; le choix prime', () => {
  assert.equal(effectiveView({ enabled: true }, null), 'in_seq');
  assert.equal(effectiveView({ enabled: false }, null), 'eligible');
  assert.equal(effectiveView({ enabled: false }, 'in_seq'), 'in_seq');
  assert.equal(effectiveView(null, null), 'eligible');
});

test('envoi en retard : plus de 5 minutes après l’heure prévue', () => {
  const now = Date.UTC(2026, 10, 19, 12, 0, 0);
  assert.equal(isLate(new Date(now - 6 * 60000).toISOString(), now), true);
  assert.equal(isLate(new Date(now - 4 * 60000).toISOString(), now), false);
  assert.equal(isLate(new Date(now + 60000).toISOString(), now), false);
  assert.equal(isLate('n’importe quoi', now), false);
});

test('code couleur fixe : exactement 5 couleurs, variantes claire / foncée de la même couleur seulement', () => {
  assert.deepEqual(COLORS, ['blue', 'green', 'orange', 'violet', 'grey']);
  assert.equal(Object.keys(PALETTE).length, 5);
  for (const ok of ['blue', 'green-soft', 'orange-deep', 'violet', 'grey-soft']) assert.equal(isAllowedHue(ok), true, ok);
  for (const ko of ['rose', 'sun', 'lilac', 'mint', 'sky', 'peach', 'blue-light', 'green-soft-deep', '', undefined, 'bluesoft']) assert.equal(isAllowedHue(ko), false, String(ko));
});

test('toutes les couleurs distribuées par format.js sont dans le code couleur (aucune sixième couleur ne peut s’y glisser)', () => {
  const used = [];
  used.push(...FUNNEL_STEPS.map((x) => x.tone));
  used.push(...Object.values(SEGMENTS).map((x) => x.tone));
  used.push(...STATE_META.map((x) => x[3]));
  used.push(...factsOf({}).map((x) => x.hue));
  used.push(...ringsOf({}).map((x) => x.hue));
  for (const key of ['signed', 'presented', 'rebooked', 'clicked', 'sent']) used.push(statusOf({ [key]: true }).hue);
  assert.ok(used.length >= 30);
  for (const hue of used) assert.equal(isAllowedHue(hue), true, `couleur hors code : ${hue}`);
  // le sens : le vert est réservé à la conversion, l'orange à l'attention
  assert.ok(FUNNEL_STEPS.filter((x) => /^green/.test(x.tone)).map((x) => x.key).join() === 'rdv,prez,sign');
  assert.ok(STATE_META.filter((x) => /^orange/.test(x[3])).map((x) => x[0]).join() === 'recupere,sans_sales');
});

test('anneaux : parts des contactés ; base nulle = « — » (null), anneau vide ; au-delà de 100 = plein', () => {
  const r = ringsOf({ contacted: 200, clicked: 50, rebooked: 10, signed: 0 });
  assert.deepEqual(r.map((x) => [x.key, x.pct]), [['clicked', 25], ['rebooked', 5], ['signed', 0]]);
  assert.deepEqual(ringsOf({ contacted: 0, clicked: 3, rebooked: 0, signed: 0 }).map((x) => x.pct), [null, null, null]);
  assert.deepEqual(ringsOf(null), []);
  assert.equal(ringDash(25, 100), 25);
  assert.equal(ringDash(null, 100), 0);
  assert.equal(ringDash(140, 100), 100);
  assert.equal(ringDash(-5, 100), 0);
});

test('donut : longueurs proportionnelles, un petit espace entre segments, aucun segment pour une part nulle', () => {
  const seg = donutSegments([{ key: 'a', n: 6, tone: 'rose' }, { key: 'b', n: 0, tone: 'lilac' }, { key: 'c', n: 2, tone: 'peach' }], 100, 2);
  assert.deepEqual(seg.map((s) => s.key), ['a', 'c']);
  assert.deepEqual(seg.map((s) => Math.round(s.dash)), [73, 23]);          // 75 − 2 et 25 − 2
  assert.deepEqual(seg.map((s) => Math.round(s.offset)), [0, 75]);
  assert.deepEqual(seg.map((s) => s.hue), ['rose', 'peach']);
  assert.equal(donutSegments([{ key: 'a', n: 4, tone: 'rose' }], 100, 2)[0].dash, 100);   // un seul segment : pas d'espace
  assert.deepEqual(donutSegments([{ key: 'a', n: 0 }], 100), []);
});
