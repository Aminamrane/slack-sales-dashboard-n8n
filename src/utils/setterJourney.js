export const setterOutcomes = ['r1', 'r2', 'voicemail', 'callback', 'disqualify'];
export const canChooseSales = (lead, email) => Boolean(lead?.created_by_setter && lead.created_by_setter.toLowerCase() === (email || '').toLowerCase());
export function availableSelection(data, selection) {
  const sales = data?.sales?.find(s => s.email === selection?.email && s.available);
  return Boolean(sales?.days?.find(d => d.date === selection?.date)?.slots.includes(selection?.time));
}
export function setterAction({ lead, outcome, slot, note = '', email = '', callback = '', targetCalendar = 'sales', currentEmail }) {
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
  if (!slot?.email || !slot.date || !slot.time) throw new Error('Choisissez un créneau disponible.');
  const choose = canChooseSales(lead, currentEmail);
  if (!choose && slot.email.toLowerCase() !== (lead.assigned_to || '').toLowerCase()) throw new Error('Le rendez-vous doit rester chez le commercial propriétaire.');
  const mail = email.trim();
  if (outcome === 'r2' && !mail) throw new Error('L’email du prospect est obligatoire pour le R2.');
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('Vérifiez l’adresse email du prospect.');
  return {
    method: 'post', path: `${root}/place-${outcome}`,
    body: { [`${outcome}_date`]: `${slot.date}T${slot.time}`, target_sales_email: choose ? slot.email : undefined,
      notes: note.trim() || undefined, ...(outcome === 'r1' ? { target_calendar: targetCalendar } : {}) },
    email: mail && mail.toLowerCase() !== (lead.email || '').trim().toLowerCase() ? mail : undefined,
  };
}
