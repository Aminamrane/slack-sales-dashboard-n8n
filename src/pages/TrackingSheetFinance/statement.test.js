// statement.test.js : le relevé du client mis en mots (demande dev 2026-11-10,
// n°565 : « quand il a trop payé ou pas assez, pourquoi on en est là »).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { balanceLabel, buildStatement } from './statement.js';

// Un mois tel que le serveur le sert (montants en chaînes, comme en JSON).
const m = (period, over = {}) => ({
  period, expected: '169.40', charged: '169.40', received: '0.00', received_overdue: '0.00',
  adjustment: '0.00', opening: '0.00', closing: '0.00', not_due: '0.00', paused: false,
  settles: [], settled_by: [], unpaid: '0.00', written_off: [], advance_from: [], advance_to: [],
  ...over,
});
const link = (period, amount) => ({ period, amount });

// n°565, Owner, de juin à octobre 2026 : le relevé servi le 10/11/2026.
const N565 = [
  m('2026-06', { closing: '169.40', settled_by: [link('2026-08', '169.40')] }),
  m('2026-07', { received: '169.40', opening: '169.40', closing: '169.40' }),
  m('2026-08', {
    received: '169.40', received_overdue: '338.00', opening: '169.40', closing: '-168.60',
    settles: [link('2026-06', '169.40')], advance_to: [link('2026-10', '168.60')],
  }),
  m('2026-09', { received: '169.60', opening: '-168.60', closing: '-168.80', advance_to: [link('2026-10', '0.20')] }),
  m('2026-10', {
    opening: '-168.80', closing: '0.60', unpaid: '0.60',
    advance_from: [link('2026-08', '168.60'), link('2026-09', '0.20')],
  }),
];
const by = (st) => Object.fromEntries(st.months.map((x) => [x.period, x]));

test('n°565 : chaque mois dit son écart, son solde et où l’argent est allé', () => {
  const s = by(buildStatement(N565));
  assert.deepEqual(s['2026-06'].pill, { label: 'Pas assez −169,40 €', tone: 'short' });
  assert.equal(s['2026-06'].balance.label, 'Doit 169,40 €');
  assert.equal(s['2026-06'].text, 'Rien reçu : il manque 169,40 €, réglés depuis en août.');

  assert.deepEqual(s['2026-07'].pill, { label: 'Juste', tone: 'even' });
  assert.equal(s['2026-07'].balance.label, 'Doit 169,40 €');
  assert.equal(s['2026-07'].text, 'Mois payé. Reste dû d’avant : juin.');

  assert.deepEqual(s['2026-08'].pill, { label: 'Trop payé +338,00 €', tone: 'over' });
  assert.deepEqual(s['2026-08'].balance, { label: 'Avance 168,60 €', tone: 'over', note: null });
  assert.equal(s['2026-08'].text,
    '169,40 € pour le mois + 338,00 € saisis « sur retard » : 169,40 € soldent juin, 168,60 € restent en avance (utilisés en octobre).');

  assert.deepEqual(s['2026-09'].pill, { label: 'Trop payé +0,20 €', tone: 'over' });
  assert.equal(s['2026-09'].balance.label, 'Avance 168,80 €');
  assert.equal(s['2026-09'].text, '169,60 € reçus : 0,20 € restent en avance (utilisés en octobre).');

  assert.deepEqual(s['2026-10'].pill, { label: 'Pas assez −169,40 €', tone: 'short' });
  assert.equal(s['2026-10'].balance.label, 'Doit 0,60 €');
  assert.equal(s['2026-10'].text, 'Rien reçu : l’avance de 168,80 € (août et septembre) est utilisée, il manque 0,60 €, toujours dus.');
});

test('n°565 : la position d’aujourd’hui et l’addition qui y mène', () => {
  const st = buildStatement(N565);
  assert.deepEqual(st.head, {
    tone: 'short', title: 'Le client doit 0,60 €', why: 'Impayé : octobre 2026 (0,60 €)', pending: null,
  });
  assert.deepEqual(st.totals, {
    since: 'juin 2026', charged: 847, paid: 846.4, adjustment: 0, notDue: 0, closing: 0.6, balance: 'Doit 0,60 €',
  });
});

test('le solde de chaque mois suit l’écart du mois', () => {
  for (const x of buildStatement(N565).months) {
    assert.equal(Math.round((x.opening - x.gap) * 100), Math.round(x.closing * 100), x.period);
  }
});

test('mois en cours avant son échéance : pas une dette, « pas encore exigible »', () => {
  const st = buildStatement([...N565, m('2026-11', { opening: '0.60', closing: '170.00', not_due: '169.40', unpaid: '169.40' })]);
  const nov = by(st)['2026-11'];
  assert.deepEqual(nov.pill, { label: 'Pas encore exigible −169,40 €', tone: 'wait' });
  assert.deepEqual(nov.balance, { label: 'Doit 0,60 €', tone: 'short', note: '169,40 € pas encore exigibles' });
  assert.equal(nov.text, 'Rien reçu : 169,40 € pas encore exigibles. Reste dû d’avant : octobre.');
  assert.equal(st.head.title, 'Le client doit 0,60 €');
  assert.equal(st.head.why, 'Impayé : octobre 2026 (0,60 €)');
  assert.equal(st.head.pending, '169,40 € de novembre 2026 pas encore exigibles');
  // L'addition tombe sur « doit 0,60 € », pas sur 170 € : novembre n'est pas exigible.
  assert.deepEqual(st.totals, {
    since: 'juin 2026', charged: 847, paid: 846.4, adjustment: 0, notDue: 169.4, closing: 0.6, balance: 'Doit 0,60 €',
  });
});

test('client en avance : on dit quel mois a payé en trop', () => {
  const st = buildStatement(N565.slice(0, 4).map((x) => (x.period === '2026-08'
    ? { ...x, advance_to: [link(null, '168.60')] }
    : x.period === '2026-09' ? { ...x, advance_to: [link(null, '0.20')] } : x)));
  assert.deepEqual(st.head, {
    tone: 'over', title: 'Le client a 168,80 € d’avance',
    why: 'Payé en trop en août 2026 (168,60 €), septembre 2026 (0,20 €)', pending: null,
  });
  assert.match(by(st)['2026-08'].text, /168,60 € restent en avance \(pas encore utilisés\)\.$/);
});

test('avance qui paie tout le mois : pas de rouge, « avance utilisée »', () => {
  const st = buildStatement([
    m('2026-09', { received: '338.80', closing: '-169.40', advance_to: [link('2026-10', '169.40')] }),
    m('2026-10', { opening: '-169.40', advance_from: [link('2026-09', '169.40')] }),
  ]);
  const oct = by(st)['2026-10'];
  assert.deepEqual(oct.pill, { label: 'Avance utilisée −169,40 €', tone: 'even' });
  assert.equal(oct.text, 'Rien reçu : l’avance de 169,40 € (septembre) paie le mois.');
  assert.deepEqual(st.head, { tone: 'even', title: 'Le client est à jour', why: null, pending: null });
});

test('mois en pause : rien demandé, ce qui est reçu rattrape le retard', () => {
  const st = buildStatement([
    m('2026-08', { expected: '100.00', charged: '100.00', closing: '100.00', settled_by: [link('2026-09', '60.00')], unpaid: '40.00' }),
    m('2026-09', {
      expected: '100.00', charged: '0.00', received: '60.00', opening: '100.00', closing: '40.00',
      paused: true, settles: [link('2026-08', '60.00')],
    }),
  ]);
  const s = by(st);
  assert.equal(s['2026-08'].text, 'Rien reçu : il manque 100,00 €, 60,00 € réglés depuis en septembre, 40,00 € toujours dus.');
  assert.deepEqual(s['2026-09'].pill, { label: 'En pause', tone: 'paused' });
  assert.equal(s['2026-09'].text,
    'En pause, rien n’est demandé. 60,00 € reçus : 60,00 € réduisent le retard d’août. Reste dû d’avant : août.');
  assert.equal(st.head.why, 'Impayé : août 2026 (40,00 €)');
});

test('solde de départ et correction : ni attendu, ni encaissement', () => {
  const st = buildStatement([
    m('2026-09', {
      expected: '100.00', charged: '100.00', received: '100.00', adjustment: '120.00', opening: '120.00', closing: '120.00',
    }),
    m('2026-10', {
      expected: '100.00', charged: '100.00', received: '100.00', adjustment: '-20.00', opening: '100.00', closing: '100.00',
    }),
  ]);
  const s = by(st);
  assert.deepEqual(s['2026-09'].event, { amount: 120, text: 'Solde de départ : doit 120,00 €.' });
  assert.equal(s['2026-09'].text, 'Mois payé. Un retard antérieur reste dû.');
  assert.deepEqual(s['2026-10'].event, {
    amount: -20,
    text: 'Correction hors encaissement (−20,00 €) : le solde passe de « Doit 120,00 € » à « Doit 100,00 € ».',
  });
  assert.equal(st.head.why, 'Impayé : retard antérieur (100,00 €)');
  assert.deepEqual(st.totals, {
    since: 'septembre 2026', charged: 200, paid: 200, adjustment: 100, notDue: 0, closing: 100, balance: 'Doit 100,00 €',
  });
});

test('manque effacé par une correction : dû jusqu’à elle, plus après', () => {
  const st = buildStatement([
    m('2026-08', { expected: '100.00', charged: '100.00', closing: '100.00', written_off: [link('2026-10', '100.00')] }),
    m('2026-09', { expected: '100.00', charged: '100.00', received: '100.00', opening: '100.00', closing: '100.00' }),
    m('2026-10', { expected: '100.00', charged: '100.00', received: '100.00', adjustment: '-100.00' }),
  ]);
  const s = by(st);
  assert.equal(s['2026-08'].text, 'Rien reçu : il manque 100,00 €, effacés par une correction.');
  assert.equal(s['2026-09'].text, 'Mois payé. Reste dû d’avant : août.');
  assert.equal(s['2026-10'].text, 'Mois payé.');
  assert.equal(st.head.title, 'Le client est à jour');
});

test('report : le mois dit ce qui lui a été ajouté ou retiré', () => {
  // Septembre ne demande plus rien : il reste dans le relevé, expliqué.
  const kept = buildStatement([
    m('2026-09', { expected: '100.00', charged: '0.00' }),
    m('2026-10', { expected: '100.00', charged: '200.00', received: '200.00' }),
  ]);
  const s = by(kept);
  assert.equal(s['2026-09'].quiet, true);
  assert.equal(s['2026-09'].pill, null);
  assert.equal(s['2026-09'].text, '100,00 € retirés de ce mois (report, correction ou perte).');
  assert.equal(s['2026-10'].text, 'Mois payé. Dont 100,00 € reportés ou corrigés sur ce mois.');
});

test('le relevé commence au premier mois où il se passe quelque chose', () => {
  const quiet = (p) => m(p, { expected: '0.00', charged: '0.00' });
  const st = buildStatement([quiet('2026-03'), quiet('2026-04'), ...N565]);
  assert.equal(st.months[0].period, '2026-06');
  // Un mois vide au milieu reste, sans pastille ni phrase : la fenêtre y pose
  // la sienne (aucun attendu, pause levée…).
  const mid = buildStatement([N565[0], { ...quiet('2026-07'), opening: '169.40', closing: '169.40' }]);
  assert.deepEqual([mid.months[1].quiet, mid.months[1].pill, mid.months[1].text], [true, null, null]);
});

test('sans relevé servi (serveur plus ancien) ou sans mouvement : rien', () => {
  assert.equal(buildStatement(undefined), null);
  assert.equal(buildStatement([]), null);
  assert.equal(buildStatement([m('2026-06', { expected: '0.00', charged: '0.00' })]), null);
});

test('balanceLabel', () => {
  assert.deepEqual([balanceLabel(12), balanceLabel(-12), balanceLabel(0)], ['Doit 12,00 €', 'Avance 12,00 €', 'À jour']);
});
