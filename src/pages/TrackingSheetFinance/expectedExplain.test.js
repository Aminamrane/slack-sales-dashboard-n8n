// expectedExplain.test.js : la pastille et la phrase de chaque mois du poste
// Attendus (demande dev 2026-11-10, n°565 : « un mois à zéro, on ne sait pas
// pourquoi »).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { expectedOpsByMonth, explainExpectedMonth, pauseFacts } from './expectedExplain.js';

// Ligne calculée par le poste, réduite à ce que l'explication lit.
const row = (key, over = {}) => ({
  key, attendu: 0, recu: 0, status: 'none', manual: false,
  passe: true, courant: false, futur: false, ...over,
});
const period = (key, over = {}) => ({
  period: `${key}-01`, expected_owner: '0.00', received_owner: null, ...over,
});
// Contexte d'un client facturé depuis avril, opérations chargées en entier.
const ctx = (over = {}) => ({
  entity: 'owner', monthOps: null, opsComplete: true, firstActiveKey: '2026-04',
  billingStart: '2026-04-01', billingLastMonth: null, loss: null, ...over,
});

test("n°565, mai à 0 € sans aucune trace : on le dit, on n'invente pas de pause", () => {
  const ex = explainExpectedMonth(row('2026-05'), period('2026-05'), ctx());
  assert.equal(ex.label, 'Aucun attendu');
  assert.equal(ex.text, 'Rien n’est enregistré sur ce mois : ni pause, ni report, ni modification de l’attendu.');
  assert.equal(ex.quiet, false);
});

test("sans la liste complète des opérations, aucune affirmation", () => {
  const ex = explainExpectedMonth(row('2026-05'), period('2026-05'), ctx({ opsComplete: false }));
  assert.equal(ex.label, 'Aucun attendu');
  assert.equal(ex.text, null);
});

test("n°565, mars : avant le premier mois avec un attendu", () => {
  const ex = explainExpectedMonth(row('2026-03'), period('2026-03'), ctx());
  assert.equal(ex.label, 'Avant démarrage');
  assert.equal(ex.text, 'Premier mois avec un attendu : avril 2026.');
  assert.equal(ex.quiet, true);
});

test("aucun mois actif : on s'en remet au début de facturation", () => {
  const ex = explainExpectedMonth(row('2026-03'), period('2026-03'), ctx({ firstActiveKey: null, billingStart: '2026-06-15' }));
  assert.equal(ex.label, 'Avant démarrage');
  assert.equal(ex.text, 'La facturation démarre en juin 2026.');
});

test("après le dernier mois facturé fixé par la direction", () => {
  const ex = explainExpectedMonth(row('2026-12', { passe: false, futur: true }), period('2026-12'), ctx({ billingLastMonth: '2026-10' }));
  assert.equal(ex.label, 'Hors facturation');
  assert.match(ex.text, /octobre 2026/);
  assert.equal(ex.quiet, true);
});

test("onboarding pas encore passé", () => {
  const ex = explainExpectedMonth(row('2026-05'), period('2026-05', { onboarding_pending: true }), ctx());
  assert.equal(ex.label, 'Avant onboarding');
  assert.equal(ex.quiet, true);
});

const paused = (over = {}) => period('2026-05', {
  expected_paused: true, expected_pause_active: true,
  expected_paused_by: 'Direction Test', expected_paused_at: '2026-10-02T09:14:00+00:00',
  expected_paused_until: '2026-12-01', expected_paused_reason: 'Fermeture saisonnière',
  ...over,
});

test("pause en cours, à rattraper : qui, quand, jusqu'à quand, pourquoi", () => {
  const ex = explainExpectedMonth(row('2026-05', { attendu: 169.4, status: 'paused' }), paused(), ctx());
  assert.equal(ex.label, 'En pause');
  assert.equal(ex.text, 'Mis en pause le 02/10/2026 par Direction Test · à rattraper après la pause · reprise le 01/12/2026 · motif : Fermeture saisonnière');
});

test("pause en cours, rien dû : l'attendu à 0 € est expliqué, la reprise reste à décider", () => {
  const p = paused({ expected_paused_until: null, expected_paused_reason: 'Rien dû pendant la pause — Fermeture saisonnière' });
  const ex = explainExpectedMonth(row('2026-05', { status: 'paused' }), p, ctx());
  assert.equal(ex.label, 'En pause');
  assert.equal(ex.text, 'Mis en pause le 02/10/2026 par Direction Test · rien dû pendant la pause : l’attendu est passé à 0 € et compté en perte · reprise à décider · motif : Fermeture saisonnière');
  assert.deepEqual(
    { waived: pauseFacts(p).waived, motif: pauseFacts(p).motif },
    { waived: true, motif: 'Fermeture saisonnière' },
  );
  // Sans motif saisi, le préfixe du serveur ne devient pas un motif.
  assert.equal(pauseFacts(paused({ expected_paused_reason: 'Rien dû pendant la pause' })).motif, null);
});

test("pause arrivée à sa date sur un mois resté à 0 € : la pastille le dit encore", () => {
  const p = paused({ expected_pause_active: false, expected_paused_reason: 'Rien dû pendant la pause' });
  const ex = explainExpectedMonth(row('2026-05'), p, ctx());
  assert.equal(ex.label, 'Pause terminée');
  assert.equal(ex.text, 'Mis en pause le 02/10/2026 par Direction Test · rien dû pendant la pause : l’attendu est passé à 0 € et compté en perte · pause terminée le 01/12/2026 : l’attendu reste à 0 €');
});

test("pause levée à la main : la reprise ne rend pas l'attendu, on dit qui l'a levée", () => {
  const p = paused({ expected_paused: false, expected_pause_active: false, expected_paused_until: null, expected_paused_reason: 'Rien dû pendant la pause' });
  const ops = [
    { id: 'b', kind: 'resume', entity: null, label: 'a levé la pause sur 1 mois', periods: ['2026-05-01'], author_name: 'Finance Test', created_at: '2026-10-20T08:00:00+00:00', reverted_at: null },
    { id: 'a', kind: 'pause', entity: null, label: 'a mis en pause', periods: ['2026-05-01'], author_name: 'Direction Test', created_at: '2026-10-02T09:14:00+00:00', reverted_at: null },
  ];
  const monthOps = expectedOpsByMonth(ops, 'owner')['2026-05'];
  assert.equal(monthOps.resume.id, 'b');
  assert.equal(monthOps.last, undefined, 'une pause ne compte pas comme un geste sur le montant');
  const ex = explainExpectedMonth(row('2026-05'), p, ctx({ monthOps }));
  assert.equal(ex.label, 'Pause levée');
  assert.match(ex.text, /pause levée le 20\/10\/2026 par Finance Test : l’attendu reste à 0 €$/);
});

test("pause levée sur un mois toujours dû : le statut du mois reste, la phrase explique", () => {
  const p = paused({ expected_paused: false, expected_pause_active: false, expected_paused_until: null });
  const ex = explainExpectedMonth(row('2026-05', { attendu: 169.4, status: 'late' }), p, ctx());
  assert.equal(ex.label, null);
  assert.match(ex.text, /pause levée : le mois est de nouveau dû · motif : Fermeture saisonnière$/);
});

test("un mois encaissé ne ressort pas sa vieille pause", () => {
  const p = paused({ expected_paused: false, expected_pause_active: false });
  const ex = explainExpectedMonth(row('2026-05', { attendu: 169.4, recu: 169.4, status: 'paid' }), p, ctx());
  assert.deepEqual(ex, { label: null, tone: null, text: null, quiet: false });
});

test("attendu supprimé en perte : le geste, son auteur, son motif", () => {
  const ops = [
    { id: 'x', kind: 'received', entity: 'owner', label: 'a saisi un reçu', periods: ['2026-05-01'], author_name: 'Finance Test', created_at: '2026-10-21T08:00:00+00:00', reverted_at: null },
    { id: 'y', kind: 'defer', entity: 'optilex', label: 'a supprimé 80,00 € (perte)', periods: ['2026-05-01'], author_name: 'Direction Test', created_at: '2026-10-11T08:00:00+00:00', reverted_at: null },
    { id: 'z', kind: 'defer', entity: 'owner', label: 'a supprimé 169,40 € d’attendu Owner de mai 2026 (perte)', reason: 'Geste commercial', periods: ['2026-05-01'], author_name: 'Direction Test', created_at: '2026-10-10T08:00:00+00:00', reverted_at: null },
  ];
  const monthOps = expectedOpsByMonth(ops, 'owner')['2026-05'];
  assert.equal(monthOps.last.id, 'z', "ni un reçu, ni le geste de l'autre entité");
  const ex = explainExpectedMonth(row('2026-05'), period('2026-05'), ctx({ monthOps }));
  assert.equal(ex.label, 'Supprimé (perte)');
  assert.equal(ex.text, 'Dernier geste le 10/10/2026 : Direction Test a supprimé 169,40 € d’attendu Owner de mai 2026 (perte) · motif : Geste commercial');
});

test("un geste annulé n'explique plus rien", () => {
  const ops = [{ id: 'z', kind: 'defer', entity: 'owner', label: 'a supprimé', periods: ['2026-05-01'], created_at: '2026-10-10T08:00:00+00:00', reverted_at: '2026-10-12T08:00:00+00:00' }];
  assert.deepEqual(expectedOpsByMonth(ops, 'owner'), {});
});

test("montant fixé à 0 € à la main", () => {
  const ops = [{ id: 'm', kind: 'expected', entity: 'owner', label: 'a fixé l’attendu Owner de mai 2026 à 0,00 €', periods: ['2026-05-01'], author_name: 'Direction Test', created_at: '2026-10-10T08:00:00+00:00', reverted_at: null }];
  const withOp = explainExpectedMonth(row('2026-05', { manual: true }), period('2026-05'), ctx({ monthOps: expectedOpsByMonth(ops, 'owner')['2026-05'] }));
  assert.equal(withOp.label, 'Mis à 0 €');
  assert.match(withOp.text, /^Dernier geste le 10\/10\/2026 : Direction Test a fixé/);
  // Même avant le premier mois actif : un geste sur le mois passe devant.
  const early = explainExpectedMonth(row('2026-03', { manual: true }), period('2026-03', { expected_manual_by: 'Direction Test', expected_manual_at: '2026-09-01T10:00:00+00:00' }), ctx());
  assert.equal(early.label, 'Mis à 0 €');
  assert.match(early.text, /^Montant fixé à la main par Direction Test le 01\/09\/2026/);
});

test("client déclaré en perte : les mois qu'elle couvre le disent", () => {
  const loss = { kind: 'declared', reason: 'Liquidation', declared_at: '2026-09-15T10:00:00+00:00', clear_past: false, clear_current: true, clear_future: true };
  const future = explainExpectedMonth(row('2026-12', { passe: false, futur: true }), period('2026-12'), ctx({ loss }));
  assert.equal(future.label, 'Client en perte');
  assert.equal(future.text, 'Client déclaré en perte le 15/09/2026 · motif : Liquidation');
  // Les mois passés ne sont pas couverts par cette perte.
  assert.equal(explainExpectedMonth(row('2026-05'), period('2026-05'), ctx({ loss })).label, 'Aucun attendu');
});

test("n°565, octobre en retard alors que le serveur l'a déjà imputé d'avance", () => {
  const oct = period('2026-10', {
    expected_owner: '169.40',
    imputation_owner: { paid_for_month: '168.80', advance_applied: '168.80', advance_from: [{ period: '2026-09', amount: '0.20' }, { period: null, amount: '168.60' }] },
  });
  const ex = explainExpectedMonth(row('2026-10', { attendu: 169.4, status: 'late' }), oct, ctx());
  assert.equal(ex.label, null);
  assert.equal(ex.text, '168,80 € déjà payés d’avance (0,20 € payés en septembre 2026, 168,60 € de crédit) : le reste dû de cette ligne ne les déduit pas.');
  // Un mois dû sans avance n'a rien à expliquer.
  assert.equal(explainExpectedMonth(row('2026-06', { attendu: 169.4, status: 'late' }), period('2026-06', { expected_owner: '169.40' }), ctx()).text, null);
});
