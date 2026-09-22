import {parisToday, parseFrenchDate, frenchDate, validParisAppointment} from './parisDates.js';

// Keep the existing contact pipeline and reminder hooks; only the UI changes.
export function contactQualificationPatch(lead, category, {result, next, date}, today = parisToday()) {
  if (!['new', 'callback', 'voicemail'].includes(category)) throw new Error('Rouvrez le dossier pour qualifier ce contact.');
  const base = {first_contact_date: lead.first_contact_date?.slice(0, 10) || today};
  const repeat = ['callback', 'voicemail'].includes(category);
  if ((result === 'voicemail' || (result === 'reached' && next === 'callback')) && repeat) {
    return {...base, call_attempts: (lead.call_attempts || 0) + 1, status: category};
  }
  if (result === 'to_recontact') {
    if (!date || parseFrenchDate(frenchDate(date)) !== date) throw new Error('Choisissez une date de relance valide.');
    return {...base, status: 'to_recontact', recontact_date: date};
  }
  const statuses = {voicemail: 'voicemail', not_relevant: 'not_relevant', not_processable: 'not_relevant', unreachable: 'unreachable'};
  if (Object.hasOwn(statuses, result)) return {...base, contact_result: result, status: statuses[result]};
  if (result !== 'reached') throw new Error('Choisissez le résultat du contact.');
  if (next === 'callback') return {...base, contact_result: 'reached', appointment_result: 'no_appointment', status: 'callback'};
  if (next === 'not_interested') return {...base, contact_result: 'reached', appointment_result: 'not_interested', status: 'not_relevant'};
  if (!['r1', 'r2'].includes(next)) throw new Error('Choisissez la prochaine étape.');
  if (!lead.email?.trim()) throw new Error('Ajoutez l’email du prospect dans sa fiche avant de fixer un rendez-vous.');
  if (!validParisAppointment(date)) throw new Error('Choisissez une date et une heure valides pour le rendez-vous.');
  return {...base, contact_result: 'reached', appointment_result: 'appointment_set', [`${next}_date`]: date, status: next};
}
