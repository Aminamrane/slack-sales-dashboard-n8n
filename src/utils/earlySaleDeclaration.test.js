import test from 'node:test';
import assert from 'node:assert/strict';
import {EARLY_DECLARATION_DAYS, EARLY_DOCUMENT_REASONS, EARLY_NOTE_MAX, EARLY_OTHER_REASON, isEarlyReason, cleanEarlyNote, canSubmitEarlyReason, daysUntilOnboarding, canDeclareWithoutDocuments, onboardingCountdown} from './earlySaleDeclaration.js';
import {canDeclareSale, DOCUMENT_WAIVERS} from './intakeDocuments.js';
import {canRescheduleAfterSale, onboardingDateOf, onboardingAwaitingConfirmation} from './saleRescheduling.js';

// 2026-11-10 10:00 à Paris (mardi)
const NOW = new Date('2026-11-10T09:00:00Z');
const slot = (days, time = '10:00') => {
  const d = new Date(Date.UTC(2026, 10, 10 + days, 12));
  return `${d.toISOString().slice(0, 10)}T${time}:00+01:00`;
};

test('la déclaration sans documents n’est ouverte qu’à quatre jours calendaires ou moins (jour J compris)', () => {
  const expected = {10: false, 7: false, 6: false, 5: false, 4: true, 3: true, 2: true, 1: true, 0: true};
  for (const [days, allowed] of Object.entries(expected)) {
    assert.equal(canDeclareWithoutDocuments(slot(Number(days)), NOW), allowed, `J-${days}`);
    assert.equal(daysUntilOnboarding(slot(Number(days)), NOW), Number(days));
  }
  assert.equal(EARLY_DECLARATION_DAYS, 4);
});

test('la limite suit le jour de Paris, pas l’heure du rendez-vous ni celle de l’appareil', () => {
  for (const time of ['00:00', '08:30', '17:30', '23:59']) {
    assert.equal(canDeclareWithoutDocuments(slot(4, time), NOW), true, `J-4 à ${time}`);
    assert.equal(canDeclareWithoutDocuments(slot(5, time), NOW), false, `J-5 à ${time}`);
  }
  // 23 h 30 UTC le 10/11 = 00 h 30 à Paris le 11/11 : le compte part du 11
  const lateNight = new Date('2026-11-10T23:30:00Z');
  assert.equal(daysUntilOnboarding(slot(4), lateNight), 3);
  assert.equal(canDeclareWithoutDocuments(slot(5), lateNight), true);
  assert.equal(canDeclareWithoutDocuments(slot(6), lateNight), false);
});

test('un onboarding déjà passé reste ouvert, une date absente ou illisible ne l’est jamais', () => {
  assert.equal(canDeclareWithoutDocuments(slot(-1), NOW), true);
  assert.equal(canDeclareWithoutDocuments(slot(-30), NOW), true);
  for (const bad of ['', null, undefined, 'demain', '13/11/2026', '2026-13-45T10:00:00']) {
    assert.equal(canDeclareWithoutDocuments(bad, NOW), false, String(bad));
  }
});

test('les deux motifs proposés sont ceux de la demande et seuls eux sont des motifs de déclaration anticipée', () => {
  assert.deepEqual(EARLY_DOCUMENT_REASONS, [
    ['client_no_documents', 'Le client n’a pas communiqué les documents.'],
    ['other', 'Autre motif'],
  ]);
  // « transmis trop tard » n'est plus offert : ni dans la liste, ni comme motif qui peut partir (l'API, elle, l'accepte toujours)
  assert.equal(EARLY_DOCUMENT_REASONS.some(([value, label]) => value === 'client_documents_late' || /trop tard/i.test(label)), false);
  assert.equal(isEarlyReason('client_documents_late'), false);
  assert.equal(canSubmitEarlyReason('client_documents_late', undefined), false);
  assert.equal(EARLY_OTHER_REASON, 'other');
  assert.equal(EARLY_NOTE_MAX, 200);
  for (const [value] of EARLY_DOCUMENT_REASONS) assert.equal(isEarlyReason(value), true);
  for (const bad of ['', null, undefined, 'company_in_creation', 'autre', 'Other', 'OTHER', 'other ', 'client_no_documents ']) assert.equal(isEarlyReason(bad), false);
  // le bouton « Continuer » de l'étape (circuit classique) n'est jamais débloqué par un motif de déclaration anticipée
  for (const [value] of EARLY_DOCUMENT_REASONS) assert.equal(canDeclareSale([], value), false);
  // la dispense de société et la règle des documents restent ce qu'elles étaient
  assert.deepEqual(DOCUMENT_WAIVERS.map(([value]) => value), ['company_in_creation', 'company_too_recent']);
  assert.equal(canDeclareSale([{status: 'waiting'}], ''), true);
  assert.equal(canDeclareSale([], 'company_in_creation'), true);
});

test('« Autre motif » ne part qu’avec une note, de 200 caractères au plus', () => {
  const noted = 'Le client attend la signature de son expert-comptable.';
  assert.equal(canSubmitEarlyReason('client_no_documents', ''), true);
  assert.equal(canSubmitEarlyReason('', noted), false);
  assert.equal(canSubmitEarlyReason('company_in_creation', noted), false);
  assert.equal(canSubmitEarlyReason('other', noted), true);
  for (const blank of ['', '   ', '\n\t ', null, undefined, '\u200b', '\u00a0']) assert.equal(canSubmitEarlyReason('other', blank), false, JSON.stringify(blank));
  assert.equal(canSubmitEarlyReason('other', 'a'.repeat(200)), true);
  assert.equal(canSubmitEarlyReason('other', 'a'.repeat(201)), false);
  assert.equal(canSubmitEarlyReason('other', '  ' + 'a'.repeat(200) + '\n'), true);        // la limite porte sur le texte nettoyé
});

test('la note est nettoyée comme le fait le serveur', () => {
  assert.equal(cleanEarlyNote('  Le client\n attend   son comptable \t '), 'Le client attend son comptable');
  assert.equal(cleanEarlyNote('ligne 1\r\n\r\nligne 2'), 'ligne 1 ligne 2');
  assert.equal(cleanEarlyNote('a\u200bb\u202ec'), 'abc');
  assert.equal(cleanEarlyNote('a\u0000b\u0007c'), 'a b c');
  assert.equal(cleanEarlyNote('é à ç œ — ’'), 'é à ç œ — ’');
  assert.equal(cleanEarlyNote(null), '');
  assert.equal(cleanEarlyNote(undefined), '');
});

test('décompte lisible', () => {
  assert.equal(onboardingCountdown(4), 'Onboarding dans 4 jours');
  assert.equal(onboardingCountdown(1), 'Onboarding demain');
  assert.equal(onboardingCountdown(0), 'Onboarding aujourd’hui');
  assert.equal(onboardingCountdown(-2), 'L’onboarding est passé');
  assert.equal(onboardingCountdown(null), '');
});

test('reprogrammer : la date réservée se lit et se modifie avant la déclaration, dans le parcours guidé seulement', () => {
  const reserved = '2026-11-13T10:00:00+01:00';
  const lead = {rdv_onboarding_date: '2026-11-13T10:00:00+00:00'};
  const guided = (status) => ({onboarding_only: true, preparation: {status, slot: reserved}});
  const plain = (status) => ({onboarding_only: false, preparation: {status, slot: reserved}});
  // parcours guidé, réservation confirmée : reprogrammable, même si la liste des leads n'a pas encore la date
  assert.equal(canRescheduleAfterSale(lead, guided('booked')), true);
  assert.equal(canRescheduleAfterSale({}, guided('booked')), true);
  assert.equal(onboardingDateOf({}, guided('booked')), reserved);
  assert.equal(onboardingDateOf(lead, {onboarding_only: true, preparation: {status: 'booked', slot: '2026-11-14T10:00:00+01:00'}}), lead.rdv_onboarding_date);
  // en attente de confirmation : date visible, pas de reprogrammation
  assert.equal(canRescheduleAfterSale(lead, guided('pending_confirmation')), false);
  assert.equal(onboardingAwaitingConfirmation(lead, guided('pending_confirmation')), true);
  assert.equal(onboardingDateOf({}, guided('pending_confirmation')), reserved);
  assert.equal(onboardingAwaitingConfirmation(lead, guided('booked')), false);
  // hors parcours guidé (déploiement suspendu après une réservation, par exemple) : RIEN ne change par rapport à avant
  for (const status of ['booked', 'pending_confirmation']) {
    assert.equal(canRescheduleAfterSale(lead, plain(status)), false, status);
    assert.equal(canRescheduleAfterSale({}, plain(status)), false, status);
    assert.equal(onboardingAwaitingConfirmation(lead, plain(status)), false, status);
    assert.equal(onboardingDateOf({}, plain(status)), '', status);
  }
  assert.equal(canRescheduleAfterSale(lead, plain('finalized')), true);
  // après la déclaration : seule la date du lead compte, comme avant
  assert.equal(onboardingDateOf({}, guided('finalized')), '');
  assert.equal(canRescheduleAfterSale({}, guided('finalized')), false);
  assert.equal(canRescheduleAfterSale(lead, guided('finalized')), true);
  // parcours inconnu ou sans date : jamais
  assert.equal(canRescheduleAfterSale(lead, undefined), false);
  assert.equal(canRescheduleAfterSale(lead, null), false);
  assert.equal(canRescheduleAfterSale({}, {onboarding_only: true, preparation: null}), false);
  // ancien parcours : la date du lead suffit, comme avant
  assert.equal(canRescheduleAfterSale({rdv_lancement_date: '2026-09-30T10:00'}, {onboarding_only: false}), true);
  assert.equal(canRescheduleAfterSale({rdv_lancement_date: '2026-09-30T10:00'}, {onboarding_only: true}), false);
});

// L'ancienne règle, recopiée telle quelle depuis origin/main (src/utils/saleRescheduling.js avant le développement).
const originalCanReschedule = (lead, journey) => {
  if (!journey) return false;
  if (journey.preparation && journey.preparation.status !== 'finalized') return false;
  return !!(lead?.rdv_onboarding_date || (!journey.onboarding_only && lead?.rdv_lancement_date));
};

test('c’est la MÊME règle qu’avant : sur toutes les combinaisons, seule la réservation confirmée du parcours guidé change de réponse', () => {
  const leads = [undefined, {}, {rdv_onboarding_date: '2026-11-13T10:00:00+00:00'}, {rdv_lancement_date: '2026-11-20T10:00'}, {rdv_onboarding_date: '2026-11-13T10:00:00+00:00', rdv_lancement_date: '2026-11-20T10:00'}];
  const statuses = [undefined, 'finalized', 'booked', 'pending_confirmation', 'prepared', 'cancelled', 'failed', ''];
  let compared = 0, changed = [];
  for (const lead of leads) for (const guidedFlow of [undefined, true, false]) for (const status of statuses) for (const slot of [undefined, '2026-11-13T10:00:00+01:00']) {
    for (const journey of [undefined, null, {onboarding_only: guidedFlow, preparation: status === undefined ? null : {status, slot}}]) {
      compared += 1;
      const before = originalCanReschedule(lead, journey), after = canRescheduleAfterSale(lead, journey);
      if (before !== after) changed.push({lead, journey});
    }
  }
  assert.ok(compared > 500);
  // la seule différence voulue : parcours guidé + réservation « booked » (reprogrammable avant la déclaration), jamais autre chose
  assert.ok(changed.length > 0);
  for (const {journey} of changed) assert.deepEqual([journey.onboarding_only, journey.preparation.status], [true, 'booked']);
});
