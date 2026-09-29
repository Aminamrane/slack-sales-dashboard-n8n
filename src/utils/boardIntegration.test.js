import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesUpcomingIntegration, matchesOverdueOnboarding, matchesUpcomingOnboarding, onboardingDateOf, parisWallTime } from './boardIntegration.js';
const row = { numero_client: '42', rdv_lancement_date: '2026-09-30T10:00:00', rdv_lancement_done: false };
test('both withdrawal states are excluded from upcoming and overdue integration', () => {
    for (const state of ['En cours de rétractation', 'Rétractation']) {
        for (const date of ['2026-07-01', '2026-09-30', '2099-01-01']) {
            assert.equal(matchesUpcomingIntegration({ ...row, rdv_lancement_date: date }, state), false);
        }
    }
});
test('other states retain the existing integration rules', () => {
    for (const state of ['Signé', "Attente Opti'Lex", 'En cours de résiliation', 'Résiliation', 'Pause', null]) {
        assert.equal(matchesUpcomingIntegration(row, state), true);
        assert.equal(matchesUpcomingIntegration({ ...row, rdv_lancement_date: '2026-07-01' }, state), true);
    }
});
test('completed, pre-split or missing integration data remains excluded', () => {
    for (const patch of [{ rdv_lancement_done: true }, { numero_client: null }, { rdv_lancement_date: null }, { rdv_lancement_date: '2026-06-30' }]) {
        assert.equal(matchesUpcomingIntegration({ ...row, ...patch }, 'Signé'), false);
    }
});

test('onboarding overdue is a subset of upcoming appointments, not historical backlog', () => {
    const r = { numero_client:'42', rdv_onboarding_date:'2026-09-16T09:30:00+00:00' };
    const now = '2026-09-16T09:53:00';
    assert.equal(matchesUpcomingOnboarding(r,now.slice(0,10)),true);
    assert.equal(matchesOverdueOnboarding(r,now),true);
    for (const patch of [{rdv_onboarding_date:'2026-09-15T09:30:00'}, {rdv_onboarding_date:'2024-01-01T09:00:00'}, {rdv_onboarding_date:'2026-09-16T10:30:00+00:00'}, {rdv_onboarding_date:'2026-09-17T08:00:00'}, {rdv_onboarding_done:true}, {numero_client:null}, {rdv_onboarding_date:null}, {rdv_onboarding_date_manual:'2026-09-16'}, {rdv_onboarding_date_manual:'2026-09-16T12:00:00'}]) {
        assert.equal(matchesOverdueOnboarding({...r,...patch},now),false);
    }
});
test('Paris wall clock preserves CRM appointment hour convention', () => {
    assert.equal(parisWallTime(new Date('2026-09-16T07:53:00Z')),'2026-09-16T09:53:00');
});

test('a done onboarding counts on the day it was done, others on their planned day', () => {
    // Sarah Ruiz n°341 : signée en 2025, onboarding réalisé le 25/09/2026.
    const planned = { rdv_onboarding_date: '2026-09-24T14:30:00+00:00' };
    assert.equal(onboardingDateOf(planned), '2026-09-24');
    assert.equal(onboardingDateOf({ ...planned, rdv_onboarding_date_manual: '2026-09-26' }), '2026-09-26');
    assert.equal(onboardingDateOf({ ...planned, rdv_onboarding_done: true, rdv_onboarding_done_date: '2026-10-01' }), '2026-10-01');
    assert.equal(onboardingDateOf({ rdv_onboarding_done: true, rdv_onboarding_done_date: '2026-09-25' }), '2026-09-25');
    // Un onboarding annulé garde sa date prévue, pas une ancienne date de réalisation.
    assert.equal(onboardingDateOf({ ...planned, rdv_onboarding_done: false, rdv_onboarding_done_date: '2026-10-01' }), '2026-09-24');
    assert.equal(onboardingDateOf({ rdv_onboarding_done: true }), null);
});
