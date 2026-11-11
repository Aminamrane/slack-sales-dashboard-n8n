import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eur, pct, dayFR, dayShort, initials, plural, originGroups, originDetail, paymentNote, paymentMeta, filterSales,
  statusCounts, outcomeMeta, barHeights,
} from './model.js';

const line = (id, origin, status, more = {}) => ({ sale_id: id, origin, client: `Client ${id}`, sales_person: 'Léo Martin', payment: { status }, ...more });

test('les montants, taux et dates se lisent en français', () => {
  assert.equal(eur(1234.5), '1 235 €');
  assert.equal(eur(337.2, 2), '337,20 €');
  assert.equal(eur(null), '–');
  assert.equal(pct(0.1071), '10,7 %');
  assert.equal(pct(null), '–');
  assert.equal(dayFR('2026-11-05'), '05/11/2026');
  assert.equal(dayShort('2026-11-05T10:00:00+01:00'), '5 nov.');
  assert.equal(initials('léo martin dupont'), 'LM');
  assert.equal(plural(1, 'vente'), '1 vente');
  assert.equal(plural(12, 'vente'), '12 ventes');
});

test('les origines se rangent en trois familles, sans les canaux vides', () => {
  const groups = originGroups([
    { key: 'affectation', label: 'ADS affectés', sales: 40, received_eur: 9000 }, { key: 'pool', label: 'ADS repris du pool', sales: 10, received_eur: 1000 },
    { key: 'second_chance', label: 'Seconde chance', sales: 30, received_eur: 3000 }, { key: 'setter_rdv', label: 'Traités par un setter', sales: 20 },
    { key: 'linkedin', label: 'LinkedIn', sales: 0 },
  ]);
  assert.deepEqual(groups.map((g) => [g.key, g.sales, g.share]), [['ads', 50, 0.5], ['setters', 50, 0.5]]);
  assert.deepEqual(groups[1].items.map((o) => o.key), ['second_chance', 'setter_rdv']);
  assert.equal(groups[0].received_eur, 10000);
  assert.equal(groups[0].items[0].color, '#8fbdf3');
  assert.deepEqual(originGroups([]), []);
});

test('le détail d\'une vente est l\'origine de la publicité ou le setter à l\'initiative', () => {
  assert.equal(originDetail({ origin: 'pool', lead_origin: 'Resto Interne', setter: 'Nora B.' }), 'Resto Interne');
  assert.equal(originDetail({ origin: 'second_chance', lead_origin: 'Resto Interne', setter: 'Nora B.' }), 'Nora B.');
  assert.equal(originDetail({ origin: 'referral', lead_origin: 'x', setter: 'y' }), null);
});

test('le paiement d\'une vente dit s\'il est entré, attendu ou à venir', () => {
  assert.equal(paymentNote({ status: 'paid', first_paid_on: '2026-11-05', first_paid_month: '2026-11' }), 'le 5 nov.');
  assert.equal(paymentNote({ status: 'paid', first_paid_month: '2026-11' }), 'en nov.');
  assert.equal(paymentNote({ status: 'unpaid', due_on: '2026-11-02' }), 'attendu le 2 nov.');
  assert.equal(paymentNote({ status: 'upcoming', due_on: '2026-11-20' }), 'prévu le 20 nov.');
  assert.equal(paymentNote({ status: 'retracted' }), '');
  assert.equal(paymentMeta('unpaid').label, 'Pas encore payé');
  assert.equal(paymentMeta('???').tone, 'ghost');
});

test('la liste des ventes se filtre par paiement, origine, sales et recherche', () => {
  const lines = [line('1', 'affectation', 'paid', { lead_origin: 'Resto Interne' }), line('2', 'pool', 'unpaid'),
    line('3', 'second_chance', 'paid', { setter: 'Nora Bénard', sales_person: 'Inès Roy' }), line('4', 'referral', 'retracted', { numero_client: '912' })];
  assert.deepEqual(statusCounts(lines), { all: 4, paid: 2, unpaid: 1, retracted: 1 });
  assert.deepEqual(filterSales(lines, { status: 'paid' }).map((l) => l.sale_id), ['1', '3']);
  assert.deepEqual(filterSales(lines, { group: 'ads' }).map((l) => l.sale_id), ['1', '2']);
  assert.deepEqual(filterSales(lines, { origin: 'pool' }).map((l) => l.sale_id), ['2']);
  assert.deepEqual(filterSales(lines, { person: 'Inès Roy' }).map((l) => l.sale_id), ['3']);
  assert.deepEqual(filterSales(lines, { query: 'benard' }).map((l) => l.sale_id), ['3']);
  assert.deepEqual(filterSales(lines, { query: ' 912 ' }).map((l) => l.sale_id), ['4']);
  assert.equal(filterSales(lines).length, 4);
});

test('un rendez-vous passé sans trace est « à confirmer », pas un no show', () => {
  assert.deepEqual(outcomeMeta({ outcome: 'no_show', level: 'to_confirm' }), { label: 'À confirmer', tone: 'amber' });
  assert.equal(outcomeMeta({ outcome: 'no_show', level: 'certain' }).tone, 'red');
  assert.equal(outcomeMeta({ outcome: 'held' }).label, 'Onboarding tenu');
});

test('les barres d\'un historique sont à l\'échelle de la plus haute', () => {
  assert.deepEqual(barHeights([100, 50, null, 0, 1]), [100, 50, 0, 0, 4]);
  assert.deepEqual(barHeights([]), []);
});
