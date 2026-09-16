import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesUpcomingIntegration, matchesOverdueOnboarding } from './boardIntegration.js';
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

test('overdue onboarding respects actual appointment, manual override and completion', () => {
    const r = { numero_client: '42', rdv_onboarding_date: '2026-09-15T10:00:00' };
    assert.equal(matchesOverdueOnboarding(r, 'Signé', '2026-09-16'), true);
    for (const patch of [{ rdv_onboarding_done: true }, { numero_client: null }, { rdv_onboarding_date: null }, { rdv_onboarding_date_manual: '2026-09-16' }, { rdv_onboarding_date_manual: '2026-09-20' }]) {
        assert.equal(matchesOverdueOnboarding({ ...r, ...patch }, 'Signé', '2026-09-16'), false);
    }
    for (const state of ['Résiliation', 'Self-Résiliation', 'Rétractation', 'Liquidation', 'Sans suite']) {
        assert.equal(matchesOverdueOnboarding(r, state, '2026-09-16'), false);
    }
});
