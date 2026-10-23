import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditContact, contactPatch, contactSaveError, duplicatesById, isClientIn, mergeLeads, nextRdv, parisToday, rdvLabel,
} from './leadsManagement.js';

test('les deux chargements sont réunis sans doublon de ligne, du plus récent au plus ancien', () => {
  const recent = [{ id: 23656 }, { id: 23640 }];
  const upcoming = [{ id: 23640 }, { id: 22595 }];
  assert.deepEqual(mergeLeads(recent, upcoming).map((l) => l.id), [23656, 23640, 22595]);
});

test('une même personne est reconnue par son e-mail ou son téléphone, quel que soit le format', () => {
  const leads = [
    { id: 23642, email: 'remipelan@yahoo.fr', phone: '+33 6 46 22 67 05' },
    { id: 23637, email: 'remitennis117@gmail.com', phone: '+33646226705' },
    { id: 23628, email: 'Ludovic.Sonnet@batiman.pro ', phone: '+33684843947' },
    { id: 23570, email: 'ludovic.sonnet@batiman.pro', phone: '33684843947' },
    { id: 1, email: '', phone: '' },
    { id: 2, email: '', phone: '' },
  ];
  const dups = duplicatesById(leads);
  assert.deepEqual(dups.get(23637).map((l) => l.id), [23642]);
  assert.deepEqual(dups.get(23642).map((l) => l.id), [23637]);
  assert.deepEqual(dups.get(23570).map((l) => l.id), [23628]);
  assert.equal(dups.has(1), false);                                        // sans e-mail ni téléphone : pas un doublon
});

test('le prochain RDV se lit en heure murale et compte celui du jour', () => {
  const lead = { r1_date: '2026-10-20T09:00:00Z', r2_date: '2026-10-24T10:00:00Z', r3_date: '2026-10-22T08:00:00+00:00' };
  assert.deepEqual(nextRdv(lead, '2026-10-22'), { kind: 'R3', at: '2026-10-22T08:00' });
  assert.deepEqual(nextRdv(lead, '2026-10-23'), { kind: 'R2', at: '2026-10-24T10:00' });
  assert.equal(nextRdv(lead, '2026-10-25'), null);
  assert.equal(nextRdv({}, '2026-10-22'), null);
});

test('libellé du RDV au format uniforme', () => {
  assert.equal(rdvLabel({ kind: 'R2', at: '2026-10-24T10:00' }), 'R2 sam. 24/10 à 10 h');
  assert.equal(rdvLabel({ kind: 'R1', at: '2026-11-03T14:30' }), 'R1 mar. 03/11 à 14 h 30');
  assert.equal(rdvLabel(null), '');
});

test('la date du jour est celle de Paris', () => {
  assert.equal(parisToday(new Date('2026-10-21T22:30:00Z')), '2026-10-22');
});

test('seuls les champs changés partent, e-mail en minuscules ; vider un champ ou un e-mail mal formé est refusé', () => {
  const lead = { full_name: 'Blondel Alex', phone: '0652536415', email: 'blondel.alex@outlook.fr' };
  assert.deepEqual(contactPatch(lead, { ...lead }), { patch: {} });
  assert.deepEqual(contactPatch(lead, { ...lead, email: ' Alex.Blondel@Outlook.fr ' }), { patch: { email: 'alex.blondel@outlook.fr' } });
  assert.deepEqual(contactPatch(lead, { ...lead, full_name: 'Alex Blondel', phone: '06 52 53 64 15' }),
    { patch: { full_name: 'Alex Blondel', phone: '06 52 53 64 15' } });
  assert.deepEqual(contactPatch(lead, { ...lead, phone: '  ' }), { problem: 'Téléphone ne peut pas être vidé.' });
  assert.deepEqual(contactPatch(lead, { ...lead, email: 'blondel.alex@outlook' }), { problem: 'E-mail invalide.' });
  assert.deepEqual(contactPatch({ full_name: 'Sans mail' }, { full_name: 'Sans mail', email: 'a@b.fr' }), { patch: { email: 'a@b.fr' } });
});

test('la fiche se corrige par un admin, avant affectation', () => {
  const pool = { id: 1, email: 'blondel.alex@outlook.fr', assigned_to: null };
  assert.equal(canEditContact(pool, { isAdmin: true }), true);
  assert.equal(canEditContact(pool, { isAdmin: false }), false);
  assert.equal(canEditContact({ ...pool, assigned_to: 'sales@ownertechnology.com' }, { isAdmin: true }), false);
  assert.equal(canEditContact(null, { isAdmin: true }), false);
});

test('un lead est déjà client si un client porte exactement son e-mail, la recherche du back étant un « contient »', () => {
  const found = [{ email: 'Deja.Client@exemple.fr ' }, { email: 'autre.deja.client@exemple.fr' }];
  assert.equal(isClientIn(found, ' deja.client@exemple.fr'), true);
  assert.equal(isClientIn([{ email: 'autre.deja.client@exemple.fr' }], 'deja.client@exemple.fr'), false);
  assert.equal(isClientIn(found, ''), false);
  assert.equal(isClientIn(undefined, 'deja.client@exemple.fr'), false);
});

test('un refus de la route se lit en clair', () => {
  assert.equal(contactSaveError({ status: 409, data: { detail: { code: 'duplicate_lead', lead_id: 23570 } } }),
    'Le lead #23570 porte déjà cet e-mail ou ce téléphone.');
  assert.equal(contactSaveError({ status: 403, data: { detail: "You don't have permission" } }), 'Modification réservée aux admins.');
  assert.equal(contactSaveError({ status: 422, data: { detail: [{ loc: ['body', 'email'] }] } }), 'E-mail invalide.');
  assert.equal(contactSaveError({ status: 502, data: { detail: 'L’invitation Google Agenda n’a pas pu être mise à jour.' } }),
    'L’invitation Google Agenda n’a pas pu être mise à jour.');
  assert.equal(contactSaveError(new Error('Failed to fetch')), 'Modification non enregistrée. Réessayez.');
});
