// Ce que la pop-up des RDV à qualifier enregistre, selon les choix du commercial (payload de qualificationPatch), ou
// null tant que la saisie est incomplète. Absent : relancer ou non (dev 15/10/2026). Reporté : nouvelle date, ou « à
// reporter » (date à fixer).
export const TO_RESCHEDULE = { r1: 'to_reschedule', r2: 'a_reporter', r3: 'a_reporter' };
export const isReported = (choice) => choice === 'rescheduled' || choice === 'reporte';

export function deckPayload(stage, { choice, next, result, date, relance, when }) {
  if (!choice) return null;
  if (choice === 'no_show') return relance ? { result: 'no_show', attended: false, date: '', relance: relance === 'relance' } : null;
  if (isReported(choice)) {
    if (when === 'later') return { result: TO_RESCHEDULE[stage], attended: false, date: '' };
    return when === 'date' && date ? { result: choice, attended: false, date } : null;
  }
  if (stage === 'r1') {
    if (choice === 'done') {
      if (!next) return null;
      if (next === 'r2_set' && !date) return null;
      return { result: 'done', attended: true, date: next === 'r2_set' ? date : '', followUp: next };
    }
    return { result: choice, attended: false, date: '' };
  }
  if (choice === 'present') return result ? { result, attended: true, date: '' } : null;
  return { result: choice, attended: false, date: '' };
}

export const needsDeckDate = (stage, form) => (isReported(form.choice) && form.when === 'date')
  || (stage === 'r1' && form.choice === 'done' && form.next === 'r2_set');
