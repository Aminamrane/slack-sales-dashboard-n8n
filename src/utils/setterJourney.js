import { validParisAppointment } from './parisDates.js';
export const setterOutcomes = ['r1', 'r2', 'voicemail', 'callback', 'disqualify'];
export function bookingSalesChoices(lead, sales = []) {
  const choices = sales.map(s => ({email:s.email || s, name:s.full_name || s.name || s.email || s}));
  const owner = lead?.assigned_to;
  if (owner && owner.toLowerCase() !== (lead.created_by_setter || '').toLowerCase()
      && !choices.some(s => s.email.toLowerCase() === owner.toLowerCase())) {
    choices.push({email:owner, name:lead.assigned_to_name || owner});
  }
  return choices;
}
export function availableSelection(data, selection) {
  const sales = data?.sales?.find(s => s.email === selection?.email && s.available);
  return Boolean(sales?.days?.find(d => d.date === selection?.date)?.slots.includes(selection?.time));
}
export function setterAction({ lead, outcome, slot, note = '', email = '', callback = '', targetCalendar = 'sales' }) {
  if (!setterOutcomes.includes(outcome)) throw new Error('Choisissez le résultat de l’appel.');
  const root = `/api/v1/tracking/setter/leads/${lead.id}`;
  if (outcome === 'disqualify') {
    if (note.trim().length < 3) throw new Error('Précisez la raison de la disqualification.');
    return { method: 'patch', path: `${root}/disqualify`, body: { reason: note.trim() } };
  }
  if (outcome === 'callback' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(callback)) throw new Error('Choisissez la date et l’heure du rappel.');
  if (['callback', 'voicemail'].includes(outcome)) return {
    method: 'post', path: `${root}/${outcome === 'callback' ? 'mark-callback' : 'mark-called'}`,
    body: { note: note.trim() || undefined, ...(outcome === 'callback' ? { callback_at: callback } : {}) },
  };
  if (!slot?.email || !slot.date || !slot.time) throw new Error('Choisissez un commercial, une date et une heure.');
  if (!validParisAppointment(`${slot.date}T${slot.time}`)) throw new Error('Choisissez une date et une heure valides en heure de Paris.');
  const mail = email.trim();
  if (outcome === 'r2' && !mail) throw new Error('L’email du prospect est obligatoire pour le R2.');
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('Vérifiez l’adresse email du prospect.');
  return {
    method: 'post', path: `${root}/place-${outcome}`,
    body: { [`${outcome}_date`]: `${slot.date}T${slot.time}`, target_sales_email: slot.email,
      notes: note.trim() || undefined, ...(outcome === 'r1' ? { target_calendar: targetCalendar } : {}) },
    email: mail && mail.toLowerCase() !== (lead.email || '').trim().toLowerCase() ? mail : undefined,
  };
}
