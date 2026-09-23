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
  assert.equal(scopedOverdueToDate(r, 'owner'), 0);
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
test('cohérence : dette et crédit sont distincts et conservent le solde par entité', () => {
  for (const cur of [-3080, -100, 0, 250]) {
    for (const cum of [-500, 0, 2310]) {
      const r = row({ overdue_owner_current_month: cur, overdue_owner_cumulative: cum });
      const debt = scopedOverdueToDate(r, 'owner');
      const credit = scopedCredit(r, 'owner');
      assert.equal(debt - credit, cur + cum);
      assert.ok(debt >= 0 && credit >= 0);
      assert.ok(debt === 0 || credit === 0);
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
  const r = { overdue_owner_since: '2025-10-01', overdue_optilex_since: '2026-08-01', overdue_owner_cumulative: 100, overdue_optilex_cumulative: 50 };
  assert.ok(creanceAgeMonths(r, 'owner') > creanceAgeMonths(r, 'optilex'),
    'la dette Owner est plus ancienne');
  assert.equal(creanceAgeMonths({ overdue_optilex_since: '2026-08-01' }, 'owner'), null);
});

test('ancienneté : en Globale, c’est la dette la PLUS ANCIENNE qui commande', () => {
  const r = { overdue_owner_since: '2025-10-01', overdue_optilex_since: '2026-08-01', overdue_owner_cumulative: 100, overdue_optilex_cumulative: 50 };
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


test('renaming a company preserves the historical representative and searches the new name', async () => {
  const { splitClientIdentity, matchesClientSearch, normalizeSearch } = await import('./constants.js');
  const client = {societe: "Old Company- Alice NOM", company_name: 'New Company - Lille'};
  assert.deepEqual(splitClientIdentity(client), {societeName: 'New Company - Lille', representant: 'Alice NOM'});
  assert.equal(matchesClientSearch({client}, normalizeSearch('New Company')), true);
});

test('both recorded family names and all NDA people remain searchable', async () => {
  const { matchesClientSearch, normalizeSearch, ndaPersonLabel, distinctCrmName } = await import('./constants.js');
  const person = {fullName: 'Delphine LECOMTE', maritalName: 'BRACQUEMOND'};
  assert.match(ndaPersonLabel(person), /LECOMTE.*BRACQUEMOND/);
  const client = {representative_name: 'LECOMTE Delphine / Jean MARTIN', identity_aliases: ['BRACQUEMOND Delphine']};
  for (const name of ['lecomte', 'bracquemond', 'martin']) assert.equal(matchesClientSearch({client}, normalizeSearch(name)), true);
  assert.equal(distinctCrmName({crm_name: 'LECOMTE Delphine', representatives: [{fullName:'Delphine LECOMTE'}]}), null);
});


test('les avances d’un client ne réduisent pas le retard d’un autre client', () => {
  const rows = [ligne({ overdue_owner_current_month: 100 }), ligne({ overdue_owner_cumulative: -80 })];
  const k = computeKpis(rows, 'owner');
  assert.equal(k.overdueTotalWithCum, 100);
  assert.equal(k.credit, 80);
});

test('une avance antérieure couvre le mois avant le filtre retard du mois', () => {
  const r = row({ overdue_owner_current_month: 165, overdue_owner_cumulative: -330 });
  assert.equal(scopedOverdueCurrent(r, 'owner'), 0);
  assert.equal(scopedOverdueCum(r, 'owner'), 0);
  assert.equal(scopedCredit(r, 'owner'), 165);
});

test('le global ne compense pas une dette Owner avec un crédit Optilex', () => {
  const r = row({ overdue_owner_current_month: 300, overdue_optilex_current_month: -100 });
  assert.equal(scopedOverdueToDate(r, 'global'), 300);
  assert.equal(scopedCredit(r, 'global'), 100);
});

test('le bandeau reprend les soldes API, le recouvrement utilise la dette d’ouverture', () => {
  const r = ligne({ expected_owner: 100, received_owner: 50, received_overdue_owner: 20,
    balance_owner: { opening_debt: '80', prior_remaining: '60', current_remaining: '50',
      current_overdue: '0', not_due: '50', credit: '0', recovered_prior: '20' } });
  const k = computeKpis([r], 'owner');
  assert.equal(k.expectedGlobal, 100);
  assert.equal(k.receivedTotal, 50);
  assert.equal(k.overdueTotal, 0);
  assert.equal(k.overdueCumTotal, 60);
  assert.equal(k.overdueTotalWithCum, 60);
  assert.equal(k.notDue, 50);
  assert.equal(k.openingDebt, 80);
  assert.equal(k.recoveredPrior, 20);
  assert.equal(parseFloat(k.receivedPct.replace(',', '.')), 50);
  assert.equal(parseFloat(k.overdueRecoveredPct.replace(',', '.')), 25);
});

test('la vue Onboarding classe la date Owner en passée ou à venir, jamais sans date', async () => {
  const { onboardingPhaseOf, canFilterMeteo } = await import('./constants.js');
  const today = new Date(2026, 8, 18, 15, 30);
  assert.equal(onboardingPhaseOf({ client: { rdv_onboarding: '2026-09-18' } }, today), 'past', 'le jour même est passé');
  assert.equal(onboardingPhaseOf({ client: { rdv_onboarding: '17/09/2026' } }, today), 'past');
  assert.equal(onboardingPhaseOf({ client: { rdv_onboarding: '2026-09-19' } }, today), 'upcoming');
  assert.equal(onboardingPhaseOf({ client: {} }, today), null);
  assert.equal(canFilterMeteo({ id: '94b5dcc1-a1bb-41ac-94fe-14cf047cffef', role: 'finance_director' }), true);
  assert.equal(canFilterMeteo({ id: 'someone-else', role: 'finance_director' }), false);
  assert.equal(canFilterMeteo(null), false);
});

test('la recherche trouve les contacts secondaires, les téléphones et les sociétés rattachées', async () => {
  const { matchesClientSearch, normalizeSearch } = await import('./constants.js');
  const client = {
    numero_client: 'n°12', societe: 'Boulangerie Martin - Paul MARTIN', email: 'paul@martin.fr', phone: '0612345678',
    identity_aliases: ['MARTIN Paul', 'Holding Martin'], contact_emails: ['compta@cabinet-dupont.fr'], contact_phones: ['+33 7 98 76 54 32'],
  };
  for (const q of ['cabinet-dupont', 'holding martin', '06 12 34', '+33 7 98', '0798765432']) {
    assert.equal(matchesClientSearch({client}, normalizeSearch(q)), true, q);
  }
  assert.equal(matchesClientSearch({client}, normalizeSearch('0655')), false);
  assert.equal(matchesClientSearch({client}, normalizeSearch('12')), true, 'numéro client, pas les chiffres seuls du téléphone');
  assert.equal(matchesClientSearch({client: {societe: 'Autre'}}, normalizeSearch('cabinet')), false);
});

test('un client qui a payé une fois dans sa vie, quelle que soit l’entité ou la vision, a payé', async () => {
  const { hasEverPaid } = await import('./constants.js');
  assert.equal(hasEverPaid({ client: {}, received_total_owner: 0, received_total_optilex_ttc: '108.00' }), true, 'Opti’lex seul compte');
  assert.equal(hasEverPaid({ client: { ever_paid: true }, received_total_owner: 0, received_total_optilex_ttc: 0 }), true, 'cash du classeur avant l’historique');
  assert.equal(hasEverPaid({ client: { ever_paid: false }, received_total_owner: 0, received_total_optilex_ttc: 0 }), false);
  assert.equal(hasEverPaid({ received_total_owner: null }), false);
});

test('un contrat en attente Opti’lex devient une ligne finance flaguée, sans montant ni numéro', async () => {
  const { pendingFinanceRow, isPendingOptilexRow, matchesClientSearch, normalizeSearch } = await import('./constants.js');
  const r = pendingFinanceRow({ row_key: 'c:42', crm_societe: 'SAS Exemple', contact_name: 'Jean EXEMPLE', email: 'j@exemple.fr',
    contact_phone: '0611223344', owner_signed_at: '2026-09-10T10:00:00', optilex_status: 'ongoing' }, '2026-09-01');
  assert.equal(isPendingOptilexRow(r), true);
  assert.equal(r.client.numero_client, null);
  assert.equal(r.client.societe, 'SAS Exemple');
  assert.equal(r.client.representative_name, 'Jean EXEMPLE');
  assert.equal(r.expected_owner, undefined);
  assert.equal(matchesClientSearch(r, normalizeSearch('exemple')), true);
  assert.equal(computeKpis([r].filter((x) => !x.pending), 'owner', 1).total, 0);
});

test('la vision Globale est ouverte à toute la page, équipe finance comprise (dev 2026-09-23)', async () => {
  const { canUseGlobalScope, displayedPayDate, SCOPE_FIELDS } = await import('./constants.js');
  for (const role of ['finance_director', 'admin', 'finance_team', 'ceo']) {
    assert.equal(canUseGlobalScope({ id: 'x', role }), true, role);
  }
  assert.equal(canUseGlobalScope(null), true, 'sans utilisateur, la garde de rôle de la page a déjà redirigé');
  // « Date paie. » : la date saisie fait foi ; sinon l'échéance du moteur,
  // jamais la projection du classeur (qui dérive dans le mois précédent).
  const f = SCOPE_FIELDS.owner;
  assert.deepEqual(displayedPayDate({ payment_date_owner: '2026-09-15', payment_date_owner_projected: false, due_date_owner: '2026-09-20' }, f),
    { value: '2026-09-15', projected: false });
  assert.deepEqual(displayedPayDate({ payment_date_owner: '2026-08-31', payment_date_owner_projected: true, due_date_owner: '2026-09-27' }, f),
    { value: '2026-09-27', projected: true });
  assert.deepEqual(displayedPayDate({ payment_date_owner: null, due_date_owner: null }, f), { value: null, projected: true });
});

import { matchesPriorDebt, scopedOpeningDebt } from './constants.js';
import { orderedReceipts } from './receipts.js';

test('créance réglée : attendu, population et ancienneté conservés dans les trois visions', () => {
  for (const scope of ['owner', 'optilex', 'global']) {
    const before = { opening_owner_since: '2026-07-01', opening_optilex_since: '2026-07-01',
      balance_owner: { opening_debt: 100, prior_remaining: 100, recovered_prior: 0 },
      balance_optilex: { opening_debt: 50, prior_remaining: 50, recovered_prior: 0 } };
    const after = { ...before,
      balance_owner: { opening_debt: 100, prior_remaining: 0, recovered_prior: 100 },
      balance_optilex: { opening_debt: 50, prior_remaining: 0, recovered_prior: 50 } };
    assert.equal(scopedOpeningDebt(before, scope), scopedOpeningDebt(after, scope));
    assert.equal(matchesPriorDebt(after, scope, 'all', '2026-09'), true);
    assert.equal(matchesPriorDebt(after, scope, 'old', '2026-09'), true);
    assert.equal(matchesPriorDebt(after, scope, 'recent', '2026-09'), false);
    const initial = computeKpis([before], scope), settled = computeKpis([after], scope);
    assert.equal(initial.openingDebt, settled.openingDebt);
    assert.equal(settled.recoveredPrior, settled.openingDebt);
    assert.equal(settled.overdueCumTotal, 0);
  }
});

test('encaissements : dernière saisie en premier, fuseaux comparés et doublons exclus', () => {
  const items = [
    { id: 'old', entity: 'optilex', at: '2026-09-19T20:17:00+02:00', psp: 'IFX' },
    { id: 'new', entity: 'owner', at: '2026-09-21T08:29:00+02:00', psp: 'Learnypay' },
    { id: 'latest', entity: 'optilex', at: '2026-09-21T11:54:00Z', psp: 'IFX' },
  ];
  assert.deepEqual(orderedReceipts([...items, items[1]]).map(r => r.id), ['latest', 'new', 'old']);
  assert.deepEqual(orderedReceipts(items, 'owner').map(r => r.id), ['new']);
  assert.deepEqual(orderedReceipts(items, 'optilex').map(r => r.id), ['latest', 'old']);
  assert.equal(orderedReceipts(items)[0].psp, 'IFX');
  assert.equal(items[0].id, 'old');
});
