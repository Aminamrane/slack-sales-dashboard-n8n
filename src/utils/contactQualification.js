import {parisToday, parseFrenchDate, frenchDate, validParisAppointment} from './parisDates.js';

// Longueur maximale de la description d'un rappel (même plafond dans la fenêtre et dans la requête).
export const CALLBACK_NOTE_MAX = 500;

// Règle des 3 jours d'un rappel daté : un rappel peut être réaffecté à une autre date autant de fois que nécessaire, mais seules
// les 4 premières réaffectations décalent la règle des 3 jours à la nouvelle date. Ensuite la date change toujours, la règle non.
// Le serveur tient le compteur (`callback_shifts`) ; 4 = miroir de MAX_SHIFTS dans le backend (recall_callback.py).
export const CALLBACK_SHIFTS_MAX = 4;

// Vrai quand la prochaine nouvelle date ne décalera plus la règle des 3 jours. Un ancien rappel (sans description) n'a pas de série.
export function recallRuleFrozen(lead) {
  return lead?.callback_description != null && Number(lead?.callback_shifts) >= CALLBACK_SHIFTS_MAX;
}

// Mention affichée avec la date du rappel quand la règle est figée (chaîne vide sinon). Courte : elle tient sur la ligne du libellé
// « Description » de la fenêtre, sans ajouter de hauteur (la fenêtre doit rester lisible sans défiler).
export function recallRuleNote(lead) {
  if (!recallRuleFrozen(lead)) return '';
  return `Rappel déjà réaffecté ${Number(lead.callback_shifts)} fois : la règle des 3 jours s’appliquera.`;
}

// Explication complète de la mention (infobulle de la fenêtre, texte sous la mention dans la carte des pastilles).
export const CALLBACK_RULE_HELP = 'Vous pouvez encore changer la date du rappel, mais la règle des 3 jours ne sera plus décalée par la nouvelle date.';

// Lecture d'un rappel enregistré (callback_at) : « lundi 19 octobre à 16h15 ». Le serveur stocke l'heure de Paris étiquetée UTC :
// on lit les chiffres tels quels, SANS conversion de fuseau (comme r1_date / r2_date). Valeur illisible = chaîne vide.
const recallDay = new Intl.DateTimeFormat('fr-FR', {timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'});
export function recallWhen(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return '';
  const [year, month, date, hour, minute] = m.slice(1).map(Number);
  const day = new Date(Date.UTC(year, month - 1, date, 12));
  // Un mois 13 ou un 31 février « débordent » vers une autre date : on les refuse plutôt que d'afficher un jour faux.
  if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month - 1 || day.getUTCDate() !== date || hour > 23 || minute > 59) return '';
  return `${recallDay.format(day)} à ${m[4]}h${m[5]}`;
}

// Heure-mur de Paris « maintenant » au format des rendez-vous (YYYY-MM-DDTHH:MM), pour comparer des chaînes sans fuseau.
function parisNowLocal(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Vrai si une heure de rappel valide est déjà passée (la fenêtre l'affiche avant même d'enregistrer).
export function recallInPast(date, now = new Date()) {
  return !!date && validParisAppointment(date) && date <= parisNowLocal(now);
}

// « À rappeler » daté : la date et l'heure choisies (heure de Paris, jamais converties) et la description voyagent ensemble.
// La description part TOUJOURS avec la date (chaîne vide = aucune) : un nouveau rappel n'hérite pas du texte du précédent.
function recallFields(date, note, now) {
  if (!validParisAppointment(date)) throw new Error('Choisissez une date et une heure valides pour le rappel.');
  if (date <= parisNowLocal(now)) throw new Error('Choisissez une date et une heure de rappel à venir.');
  return {callback_at: date, callback_description: String(note ?? '').trim().slice(0, CALLBACK_NOTE_MAX)};
}

// Keep the existing contact pipeline and reminder hooks; only the UI changes.
export function contactQualificationPatch(lead, category, {result, next, date, note}, today = parisToday(), now = new Date()) {
  if (!['new', 'callback', 'voicemail'].includes(category)) throw new Error('Rouvrez le dossier pour qualifier ce contact.');
  const base = {first_contact_date: lead.first_contact_date?.slice(0, 10) || today};
  const repeat = ['callback', 'voicemail'].includes(category);
  // Seul « A décroché → À rappeler » AVEC une date lit `date` et `note` ; sans date, comportement inchangé.
  const recall = result === 'reached' && next === 'callback' && date ? recallFields(date, note, now) : {};
  if ((result === 'voicemail' || (result === 'reached' && next === 'callback')) && repeat) {
    return {...base, call_attempts: (lead.call_attempts || 0) + 1, status: category, ...recall};
  }
  if (result === 'to_recontact') {
    if (!date || parseFrenchDate(frenchDate(date)) !== date) throw new Error('Choisissez une date de relance valide.');
    return {...base, status: 'to_recontact', recontact_date: date};
  }
  const statuses = {voicemail: 'voicemail', not_relevant: 'not_relevant', not_processable: 'not_relevant', unreachable: 'unreachable'};
  if (Object.hasOwn(statuses, result)) return {...base, contact_result: result, status: statuses[result]};
  if (result !== 'reached') throw new Error('Choisissez le résultat du contact.');
  if (next === 'callback') return {...base, contact_result: 'reached', appointment_result: 'no_appointment', status: 'callback', ...recall};
  if (next === 'not_interested') return {...base, contact_result: 'reached', appointment_result: 'not_interested', status: 'not_relevant'};
  if (!['r1', 'r2'].includes(next)) throw new Error('Choisissez la prochaine étape.');
  if (!lead.email?.trim()) throw new Error('Ajoutez l’email du prospect dans sa fiche avant de fixer un rendez-vous.');
  if (!validParisAppointment(date)) throw new Error('Choisissez une date et une heure valides pour le rendez-vous.');
  return {...base, contact_result: 'reached', appointment_result: 'appointment_set', [`${next}_date`]: date, status: next};
}
