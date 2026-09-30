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

// Situation d'onboarding d'un client, EXCLUSIVE (Vincent 30/09 : « quand tu cumules à venir, réalisé et
// à faire, tu dépasses le nombre de clients signés ») : chaque client compte dans UNE seule case, « à faire »
// = ni réalisé ni planifié. Un client sorti n'entre dans aucune case, sauf si son état est demandé.
export function onboardingSituation(row, today, { exited = false, includeExited = false } = {}) {
    if (!row.numero_client || (exited && !includeExited)) return null;
    if (row.rdv_onboarding_done) return 'done';
    return matchesUpcomingOnboarding(row, today) ? 'venir' : 'todo';
}

// Date d'onboarding d'une ligne pour le filtre de dates du board et ses mois : un onboarding réalisé
// compte à sa date de réalisation (« onboardings réalisés en septembre », Vincent 29/09), les autres
// à leur date prévue.
export function onboardingDateOf(row) {
    const date = (row.rdv_onboarding_done && row.rdv_onboarding_done_date) || row.rdv_onboarding_date_manual || row.rdv_onboarding_date;
    return date ? String(date).slice(0, 10) : null;
}

export function matchesOverdueOnboarding(row, parisNow) {
    if (!matchesUpcomingOnboarding(row, parisNow.slice(0, 10))) return false;
    const date = String(row.rdv_onboarding_date_manual || row.rdv_onboarding_date);
    // Date-only appointments have no known hour: never invent a midnight deadline.
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) && date.slice(0, 16) < parisNow.slice(0, 16);
}
