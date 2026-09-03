// finance.test.js — les règles de calcul de la page finance, verrouillées.
//
// Pourquoi ce fichier existe (demande dev 2026-08-29) : « faut que ça n'arrive
// plus, je vais pas tout le temps te dire là où il y a un problème ».
//
// Chaque test ci-dessous correspond à un bug RÉEL, constaté en production par
// l'équipe finance. Ils sont écrits à partir des chiffres exacts du dossier
// concerné : si quelqu'un casse la règle, le test le dit avant l'utilisateur.
//
// Lancement : `npm test` (runner intégré à Node, aucune dépendance ajoutée).
// Le build en dépend : `npm run build` lance le garde-fou puis ces tests avant
// de compiler, donc une règle cassée bloque le déploiement Vercel.
//
// ⚠️ Un NOUVEAU fichier de test doit être ajouté au script `test` de
// package.json : on cite les fichiers un par un plutôt que d'utiliser un motif
// générique, qui exigerait Node 21+ alors que la version de Node sur Vercel
// n'est pas épinglée.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scopedCredit, entityCredit, scopedOverdueToDate,
  scopedOverdueCurrent, scopedOverdueCum, computeKpis, creanceAgeMonths,
  isExitCandidate,
} from './constants.js';

const row = (o = {}) => ({
  overdue_owner_current_month: 0,
  overdue_owner_cumulative: 0,
  overdue_optilex_current_month: 0,
  overdue_optilex_cumulative: 0,
  ...o,
});

// ── Trop-perçu ────────────────────────────────────────────────────────────
// Incident n°454 HOLDING MASTER AMBU, 2026-08-29 : le client verse 4 235 €
// pour 1 155 € dus (1 925 d'échéance + 2 310 d'arriérés). Il est créditeur de
// 770 €, mais le filtre affichait « Trop-perçu 0 » parce que le calcul ne
// regardait que le cumul des mois ANTÉRIEURS.
test('trop-perçu : le mois en cours compte, pas seulement les créances anciennes', () => {
  const r = row({ overdue_owner_current_month: -3080, overdue_owner_cumulative: 2310 });
  assert.equal(scopedCredit(r, 'owner'), 770);
  assert.equal(scopedOverdueToDate(r, 'owner'), -770);
});

test('trop-perçu : un client en retard n’est jamais créditeur', () => {
  const r = row({ overdue_owner_current_month: 500, overdue_owner_cumulative: 200 });
  assert.equal(scopedCredit(r, 'owner'), 0);
});

test('trop-perçu : un crédit ancien seul reste visible', () => {
  // Incident n°404 NOVOLEX : trop-payé de juin, 192,50 € à rembourser.
  const r = row({ overdue_owner_cumulative: -192.5 });
  assert.equal(scopedCredit(r, 'owner'), 192.5);
});

test('trop-perçu : une dette d’un côté ne masque pas un crédit de l’autre', () => {
  const r = row({ overdue_owner_current_month: 300, overdue_optilex_current_month: -100 });
  assert.equal(scopedCredit(r, 'global'), 100, 'le crédit Opti’lex doit rester visible');
  assert.equal(scopedCredit(r, 'owner'), 0);
  assert.equal(scopedCredit(r, 'optilex'), 100);
});

test('trop-perçu par entité : le remboursement vise la bonne entité', () => {
  const r = row({ overdue_owner_cumulative: -770, overdue_optilex_cumulative: -120 });
  assert.equal(entityCredit(r, 'owner'), 770);
  assert.equal(entityCredit(r, 'optilex'), 120);
});

// ── Vision active ─────────────────────────────────────────────────────────
// Les filtres additionnaient les deux entités quelle que soit la vision : un
// retard Opti'lex faisait matcher un filtre consulté en vision Owner.
test('vision : chaque helper ne compte que l’entité affichée', () => {
  const r = row({
    overdue_owner_current_month: 100, overdue_optilex_current_month: 40,
    overdue_owner_cumulative: 10, overdue_optilex_cumulative: 5,
  });
  assert.equal(scopedOverdueCurrent(r, 'owner'), 100);
  assert.equal(scopedOverdueCurrent(r, 'optilex'), 40);
  assert.equal(scopedOverdueCurrent(r, 'global'), 140);
  assert.equal(scopedOverdueCum(r, 'owner'), 10);
  assert.equal(scopedOverdueToDate(r, 'global'), 155);
});

// ── Cohérence des notions entre elles ─────────────────────────────────────
// Le point qui a réellement fait mal : deux surfaces peuvent afficher deux
// chiffres pour la même réalité. On verrouille le lien entre les deux.
test('cohérence : retard à date négatif ⇔ trop-perçu du même montant', () => {
  for (const cur of [-3080, -100, 0, 250]) {
    for (const cum of [-500, 0, 2310]) {
      const r = row({ overdue_owner_current_month: cur, overdue_owner_cumulative: cum });
      const solde = scopedOverdueToDate(r, 'owner');
      const credit = scopedCredit(r, 'owner');
      if (solde < 0) {
        assert.equal(credit, -solde, `solde ${solde} devrait donner un crédit de ${-solde}`);
      } else {
        assert.equal(credit, 0, `solde ${solde} ne doit produire aucun crédit`);
      }
    }
  }
});

test('cohérence : un client à jour n’a ni retard ni crédit', () => {
  const r = row();
  assert.equal(scopedOverdueToDate(r, 'global'), 0);
  assert.equal(scopedCredit(r, 'global'), 0);
});

// ── Tolérance aux données réelles ─────────────────────────────────────────
test('robustesse : champs absents ou nuls, jamais de NaN', () => {
  for (const r of [{}, { overdue_owner_cumulative: null }, { overdue_owner_current_month: '' }]) {
    assert.ok(Number.isFinite(scopedCredit(r, 'global')), 'crédit doit rester un nombre');
    assert.ok(Number.isFinite(scopedOverdueToDate(r, 'global')), 'solde doit rester un nombre');
  }
});

test('robustesse : montants en chaîne (JSON backend)', () => {
  const r = row({ overdue_owner_current_month: '-3080.00', overdue_owner_cumulative: '2310.00' });
  assert.equal(scopedCredit(r, 'owner'), 770);
});

// ── Totaux du bandeau ─────────────────────────────────────────────────────
// Demande dev 2026-09-01 : les totaux doivent suivre le filtre actif, quel
// qu'il soit — y compris un filtre créé par l'équipe.
const ligne = (o = {}) => ({
  expected_owner: 0, expected_optilex_ttc: 0,
  received_owner: 0, received_optilex_ttc: 0,
  received_overdue_owner: 0, received_overdue_optilex_ttc: 0,
  overdue_owner_current_month: 0, overdue_owner_cumulative: 0,
  overdue_optilex_current_month: 0, overdue_optilex_cumulative: 0,
  ...o,
});

test('totaux : ne somment que les lignes affichées', () => {
  const toutes = [
    ligne({ expected_owner: 100, received_owner: 100 }),
    ligne({ expected_owner: 200, overdue_owner_current_month: 200 }),
    ligne({ expected_owner: 300, overdue_owner_current_month: 300 }),
  ];
  const filtrees = toutes.slice(1);              // « Retard du mois »

  const global = computeKpis(toutes, 'owner', toutes.length);
  assert.equal(global.expectedGlobal, 600);
  assert.equal(global.filtered, false, 'sans filtre, le bandeau ne signale rien');

  const k = computeKpis(filtrees, 'owner', toutes.length);
  assert.equal(k.total, 2);
  assert.equal(k.totalAll, 3);
  assert.equal(k.filtered, true, 'le bandeau doit signaler son périmètre');
  assert.equal(k.expectedGlobal, 500, 'la ligne à jour ne doit plus compter');
  assert.equal(k.overdueTotalWithCum, 500);
  assert.equal(k.receivedTotal, 0);
});

test('totaux : le retard additionne mois en cours ET créances antérieures', () => {
  const k = computeKpis(
    [ligne({ overdue_owner_current_month: 120, overdue_owner_cumulative: 380 })],
    'owner', 1,
  );
  assert.equal(k.overdueTotal, 120);
  assert.equal(k.overdueCumTotal, 380);
  assert.equal(k.overdueTotalWithCum, 500);
});

test('totaux : la vision active filtre les entités', () => {
  const rows = [ligne({ expected_owner: 100, expected_optilex_ttc: 40 })];
  assert.equal(computeKpis(rows, 'owner', 1).expectedGlobal, 100);
  assert.equal(computeKpis(rows, 'optilex', 1).expectedGlobal, 40);
  assert.equal(computeKpis(rows, 'global', 1).expectedGlobal, 140);
});

test('totaux : aucune ligne affichée ne casse rien', () => {
  const k = computeKpis([], 'owner', 730);
  assert.equal(k.total, 0);
  assert.equal(k.expectedGlobal, 0);
  assert.equal(k.filtered, true);
  assert.equal(k.receivedPct, null, 'pas de pourcentage sans dénominateur');
});

// ── Ancienneté des créances ───────────────────────────────────────────────
// Demande dev 2026-09-01 : distinguer les créances de plus / moins de 2 mois.
// L'ancienneté vient du premier mois d'une dette JAMAIS soldée depuis.
test('ancienneté : null quand le client n’a aucune dette datée', () => {
  assert.equal(creanceAgeMonths({}, 'owner'), null);
  assert.equal(creanceAgeMonths({ overdue_owner_since: null }, 'global'), null);
});

test('ancienneté : ne lit que l’entité de la vision active', () => {
  const r = { overdue_owner_since: '2025-10-01', overdue_optilex_since: '2026-08-01' };
  assert.ok(creanceAgeMonths(r, 'owner') > creanceAgeMonths(r, 'optilex'),
    'la dette Owner est plus ancienne');
  assert.equal(creanceAgeMonths({ overdue_optilex_since: '2026-08-01' }, 'owner'), null);
});

test('ancienneté : en Globale, c’est la dette la PLUS ANCIENNE qui commande', () => {
  const r = { overdue_owner_since: '2025-10-01', overdue_optilex_since: '2026-08-01' };
  assert.equal(creanceAgeMonths(r, 'global'), creanceAgeMonths(r, 'owner'));
});

// ── Clients à sortir (créances antérieures) ───────────────────────────────
// Règle dev 2026-09-03 : un client en liquidation ou en résiliation ne quitte
// pas le filtre « Créances antérieures » tant que ses créances ne sont ni
// récupérées ni passées en perte. On ne l'invisibilise pas, on l'alerte.
test('à sortir : fin de relation + créances antérieures dues + pas de perte', () => {
  const r = row({ overdue_owner_cumulative: 800, client: { is_loss: false } });
  assert.equal(isExitCandidate(r, 'Liquidation', 'owner'), true);
  assert.equal(isExitCandidate(r, 'En cours de résiliation', 'global'), true, 'la procédure ouverte compte déjà');
  assert.equal(isExitCandidate(r, 'Signé', 'owner'), false, 'un client actif n’est pas à sortir');
});

test('à sortir : la perte actée ou l’absence de créance le fait sortir', () => {
  const perdu = row({ overdue_owner_cumulative: 800, client: { is_loss: true } });
  assert.equal(isExitCandidate(perdu, 'Liquidation', 'owner'), false, 'perte actée = traité');
  const solde = row({ overdue_owner_cumulative: 0, client: { is_loss: false } });
  assert.equal(isExitCandidate(solde, 'Liquidation', 'owner'), false, 'rien à récupérer');
});

test('à sortir : la vision active compte, comme pour les autres filtres', () => {
  const r = row({ overdue_optilex_cumulative: 120, client: { is_loss: false } });
  assert.equal(isExitCandidate(r, 'Résiliation', 'owner'), false);
  assert.equal(isExitCandidate(r, 'Résiliation', 'optilex'), true);
});
