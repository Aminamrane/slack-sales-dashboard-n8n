import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eur, pct, dayFR, dayShort, initials, plural, originGroups, originDetail, paymentNote, paymentMeta, filterSales,
  statusCounts, outcomeMeta, barHeights, peopleOf, weatherTone, ONBOARDING_VIEWS, contactMeta, contactLine, callMoment, callLength,
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

test('un rendez-vous reporté est un report, jamais un no show', () => {
  assert.deepEqual(outcomeMeta({ outcome: 'postponed', when: 'before' }), { label: 'Reporté', tone: 'grey' });
  assert.deepEqual(outcomeMeta({ outcome: 'postponed', when: 'same_day' }), { label: 'Reporté', tone: 'amber' });
  assert.equal(outcomeMeta({ outcome: 'postponed', when: 'flagged' }).tone, 'amber');
  assert.equal(outcomeMeta({ outcome: 'postponed', when: 'reminded' }).tone, 'amber');
  // Une autre date d'avant les rappels, sans trace : ce n'est pas un report.
  assert.deepEqual(outcomeMeta({ outcome: 'unknown' }), { label: 'Autre date, sans trace', tone: 'grey' });
});

test('no show et reports se lisent à part, chacun avec son taux et ses clients', () => {
  const people = [
    { name: 'Léo Martin', clients: 4, dated: 4, followed: 4, due: 3, no_show: 0, reported: 2, rate: 0, report_rate: 0.5 },
    { name: 'Inès Roy', clients: 3, dated: 2, followed: 2, due: 2, no_show: 1, reported: 0, rate: 0.5, report_rate: 0 },
    { name: 'Sans client', clients: 0, dated: 0, due: 0, no_show: 0, reported: 0, rate: null, report_rate: null },
  ];
  assert.deepEqual(peopleOf(people, 'no_show').map((p) => [p.name, p.rate]), [['Inès Roy', 0.5], ['Léo Martin', 0]]);
  assert.deepEqual(peopleOf(people, 'reports').map((p) => [p.name, p.rate]), [['Léo Martin', 0.5], ['Inès Roy', 0]]);
  const rows = [{ status: 'no_show', reports: 0 }, { status: 'held', reports: 1 }, { status: 'to_confirm', reports: 2 }, { status: 'upcoming', reports: 0 }];
  assert.deepEqual(rows.filter(ONBOARDING_VIEWS.no_show.listed).map((r) => r.status), ['no_show', 'to_confirm']);
  assert.deepEqual(rows.filter(ONBOARDING_VIEWS.reports.listed).map((r) => r.status), ['held', 'to_confirm']);
});

test('les tentatives du Client Success disent qui ne répond pas', () => {
  const base = { has_phone: true, since: '2026-11-10', attempts: 0, answered: 0, voicemail: 0, not_answered: 0, inbound: 0, called_back: 0, before: 0, unreachable: false };
  const dead = { ...base, attempts: 4, voicemail: 3, not_answered: 1, last_attempt: '2026-11-12', unreachable: true };
  assert.deepEqual(contactMeta(dead), { label: 'Ne répond pas', tone: 'red' });
  assert.equal(contactLine(dead), '4 tentatives depuis le 10/11/2026 · 3 répondeurs · 1 sans réponse · dernière le 12/11/2026');
  assert.equal(contactMeta({ ...base, attempts: 2, answered: 1 }).label, 'A décroché');
  const brief = { ...base, attempts: 2, brief: 2, last_attempt: '2026-11-10' };
  assert.deepEqual(contactMeta(brief), { label: 'Décroché bref', tone: 'amber' });
  assert.equal(contactLine(brief), '2 tentatives depuis le 10/11/2026 · 2 décrochés brefs · dernière le 10/11/2026');
  assert.equal(contactMeta({ ...base, attempts: 1, not_answered: 1, inbound: 1, called_back: 1 }).label, 'A rappelé');
  assert.deepEqual(contactMeta(base), { label: 'Jamais appelé', tone: 'amber' });
  assert.equal(contactLine({ ...base, before: 2 }), 'Aucun appel du Client Success depuis le 10/11/2026 (2 appels avant).');
  assert.equal(contactMeta({ ...base, has_phone: false }).label, 'Pas de numéro');
  assert.equal(contactMeta(undefined), null);
  assert.equal(callMoment('2026-11-12T17:00:00+01:00'), '12/11 à 17:00');
  assert.equal(callLength(83), '1:23');
  assert.equal(callLength(0), null);
});

test('la météo d\'un client rétracté prend la teinte de sa note', () => {
  assert.deepEqual([5, 4, 3, 2, 1].map(weatherTone), ['green', 'amber', 'amber', 'red', 'red']);
});

test('les barres d\'un historique sont à l\'échelle de la plus haute', () => {
  assert.deepEqual(barHeights([100, 50, null, 0, 1]), [100, 50, 0, 0, 4]);
  assert.deepEqual(barHeights([]), []);
});
