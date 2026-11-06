// Déclaration anticipée d'une vente, sans documents (dev 2026-11-05).
// Quand le client n'a toujours rien transmis et que l'onboarding approche (J-4 ou moins, jour J compris, heure de Paris),
// le commercial peut déclarer la vente sans document, en indiquant pourquoi. Le serveur revérifie la règle à chaque
// déclaration : ce fichier ne décide que de l'AFFICHAGE du bouton.
import {parisToday} from './parisDates.js';

export const EARLY_DECLARATION_DAYS = 4;

// « Autre motif » ne vaut qu'avec une note libre du commercial (200 caractères au plus), enregistrée avec la déclaration.
export const EARLY_OTHER_REASON = 'other';
export const EARLY_NOTE_MAX = 200;

// Les valeurs sont celles que l'API accepte (`documents_waiver`) ; le libellé est celui de la fiche d'intégration.
// Seuls ces motifs sont proposés. « Le client a transmis les documents trop tard » (`client_documents_late`) n'est plus offert
// (retiré le 2026-11-06) : l'API l'accepte toujours et les déclarations déjà enregistrées s'affichent comme avant (libellé du serveur).
export const EARLY_DOCUMENT_REASONS = [
  ['client_no_documents', 'Le client n’a pas communiqué les documents.'],
  [EARLY_OTHER_REASON, 'Autre motif'],
];

export function isEarlyReason(value) {
  return EARLY_DOCUMENT_REASONS.some(([reason]) => reason === value);
}

// Note envoyée au serveur (qui refait le même nettoyage) : caractères de mise en forme retirés, contrôles et retours à la
// ligne ramenés à un espace, espaces simples.
export function cleanEarlyNote(value) {
  return String(value ?? '').replace(/\p{Cf}/gu, '').replace(/\p{Cc}/gu, ' ').split(/\s+/u).filter(Boolean).join(' ');
}

// Le motif peut partir : l'un des motifs connus, et pour « Autre motif » une note non vide de 200 caractères au plus.
export function canSubmitEarlyReason(reason, note) {
  if (!isEarlyReason(reason)) return false;
  if (reason !== EARLY_OTHER_REASON) return true;
  const cleaned = cleanEarlyNote(note);
  return cleaned.length > 0 && cleaned.length <= EARLY_NOTE_MAX;
}

// Jours calendaires (Paris) entre aujourd'hui et le jour de l'onboarding : 0 le jour J, négatif une fois passé.
// `slot` : date d'onboarding en heure murale de Paris ('2026-11-13T10:00:00+01:00' de la réservation, ou celle du lead) ;
// seuls les dix premiers caractères comptent, jamais de conversion de fuseau.
export function daysUntilOnboarding(slot, now = new Date()) {
  const day = String(slot || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const target = Date.parse(`${day}T12:00:00Z`);
  const today = Date.parse(`${parisToday(now)}T12:00:00Z`);
  return Number.isFinite(target) ? Math.round((target - today) / 86400000) : null;
}

export function canDeclareWithoutDocuments(slot, now = new Date()) {
  const days = daysUntilOnboarding(slot, now);
  return days !== null && days <= EARLY_DECLARATION_DAYS;
}

export function onboardingCountdown(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return 'L’onboarding est passé';
  if (days === 0) return 'Onboarding aujourd’hui';
  if (days === 1) return 'Onboarding demain';
  return `Onboarding dans ${days} jours`;
}
