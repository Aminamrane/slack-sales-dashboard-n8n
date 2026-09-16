// A withdrawn client will not attend integration, even before the withdrawal takes effect.
export function matchesUpcomingIntegration(row, displayedState) {
    return !['En cours de rétractation', 'Rétractation'].includes(displayedState)
        && !!row.numero_client
        && !!row.rdv_lancement_date
        && !row.rdv_lancement_done
        && String(row.rdv_lancement_date).slice(0, 10) >= '2026-07-01';
}

// CRM appointment strings contain Paris wall-clock time, even when labelled +00:00.
export function parisWallTime(now = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).format(now).replace(' ', 'T');
}

export function matchesUpcomingOnboarding(row, today) {
    const date = row.rdv_onboarding_date_manual || row.rdv_onboarding_date;
    return !!row.numero_client && !!date && !row.rdv_onboarding_done && String(date).slice(0, 10) >= today;
}

export function matchesOverdueOnboarding(row, parisNow) {
    if (!matchesUpcomingOnboarding(row, parisNow.slice(0, 10))) return false;
    const date = String(row.rdv_onboarding_date_manual || row.rdv_onboarding_date);
    // Date-only appointments have no known hour: never invent a midnight deadline.
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) && date.slice(0, 16) < parisNow.slice(0, 16);
}
