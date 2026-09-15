// A withdrawn client will not attend integration, even before the withdrawal takes effect.
export function matchesUpcomingIntegration(row, displayedState) {
    return !['En cours de rétractation', 'Rétractation'].includes(displayedState)
        && !!row.numero_client
        && !!row.rdv_lancement_date
        && !row.rdv_lancement_done
        && String(row.rdv_lancement_date).slice(0, 10) >= '2026-07-01';
}
