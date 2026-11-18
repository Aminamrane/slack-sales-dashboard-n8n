import test from 'node:test';
import assert from 'node:assert/strict';

import { departureOf, noShowInfo, noShowOf, shortDay } from './boardFollow.js';

const TODAY = '2026-11-18';
const row = (extra = {}) => ({ numero_client: 'n°880', rdv_onboarding_date: '2026-11-16T10:00:00', csm_rated: true, ...extra });

test('un départ en cours ou acté se voit, les autres états non', () => {
  for (const etat of ['En cours de rétractation', 'Rétractation', 'En cours de résiliation', 'Résiliation', 'Self-Résiliation']) {
    assert.equal(departureOf(etat), etat);
  }
  for (const etat of ['Signé', 'Pause', 'Liquidation', 'Attente Opti\'Lex', null]) assert.equal(departureOf(etat), null);
});

test('no show : la règle du board, puis le no show qualifié par le Client Success', () => {
  // Calculé par le board : passé, ni réalisé ni noté.
  assert.deepEqual(noShowOf(row({ csm_rated: false }), TODAY, 'Signé'), { kind: 'noshow', day: '2026-11-16', by: '' });
  // Qualifié par le CSM sur le rendez-vous prévu, même s'il a noté une météo.
  assert.deepEqual(noShowOf(row({ no_show: { day: '2026-11-16', by: 'Vincent T.' } }), TODAY, 'Signé'),
    { kind: 'noshow', day: '2026-11-16', by: 'Vincent T.' });
  // Qualifié avant le rendez-vous (le client a prévenu) : no show quand même.
  assert.equal(noShowOf(row({ rdv_onboarding_date: '2026-11-20', no_show: { day: '2026-11-20', by: 'Emma C.' } }), TODAY, 'Signé').kind, 'noshow');
  // Ni no show calculé ni qualifié : rien.
  assert.equal(noShowOf(row(), TODAY, 'Signé'), null);
});

test('recalé : une date à venir suit le no show, puis plus rien une fois réalisé', () => {
  const recale = row({ rdv_onboarding_date_manual: '2026-11-27', no_show: { day: '2026-11-16', by: 'Vincent T.' } });
  assert.deepEqual(noShowOf(recale, TODAY, 'Signé'), { kind: 'recale', day: '2026-11-27', noShowDay: '2026-11-16', by: 'Vincent T.' });
  assert.equal(noShowOf({ ...recale, rdv_onboarding_done: true }, TODAY, 'Signé'), null);
  // La nouvelle date passe sans onboarding : de nouveau no show selon le board.
  assert.equal(noShowOf({ ...recale, csm_rated: false }, '2026-11-28', 'Signé').kind, 'noshow');
});

test('un client qui part n\'a plus de no show à suivre : son départ se voit à la place', () => {
  assert.equal(noShowOf(row({ csm_rated: false }), TODAY, 'En cours de rétractation'), null);
  assert.equal(noShowOf(row({ no_show: { day: '2026-11-16', by: 'Vincent T.' } }), TODAY, 'Rétractation'), null);
  assert.equal(noShowOf({ rdv_onboarding_date: '2026-11-16' }, TODAY, 'Signé'), null);
});

test('libellés', () => {
  assert.equal(shortDay('2026-11-27T10:00:00'), '27/11');
  assert.deepEqual(
    (({ label, value, title }) => ({ label, value, title }))(noShowInfo({ kind: 'recale', day: '2026-11-27', noShowDay: '2026-11-16' })),
    { label: 'Recalé', value: 'au 27/11', title: 'No show du 16/11, nouvel onboarding prévu le 27/11.' },
  );
  assert.equal(noShowInfo({ kind: 'noshow', day: '2026-11-16', by: 'Vincent T.' }).title, 'No show de l’onboarding du 16/11, noté par Vincent T.');
  assert.equal(noShowInfo(null), null);
});
