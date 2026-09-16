// A withdrawn client will not attend integration, even before the withdrawal takes effect.
export function matchesUpcomingIntegration(row, displayedState) {
    return !['En cours de rétractation', 'Rétractation'].includes(displayedState)
        && !!row.numero_client
        && !!row.rdv_lancement_date
        && !row.rdv_lancement_done
        && String(row.rdv_lancement_date).slice(0, 10) >= '2026-07-01';
}

// An overdue onboarding has a recorded appointment in the past, not just a missing one.
export function matchesOverdueOnboarding(row, displayedState, today) {
    const date = row.rdv_onboarding_date_manual || row.rdv_onboarding_date;
    return !!row.numero_client && !!date && !row.rdv_onboarding_done
        && !['Résiliation', 'Self-Résiliation', 'Rétractation', 'Liquidation', 'Sans suite'].includes(displayedState)
        && String(date).slice(0, 10) < today;
}
