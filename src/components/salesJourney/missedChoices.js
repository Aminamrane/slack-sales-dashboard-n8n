// RDV manqué ou reporté (dev 15/10/2026) : les mêmes sous-choix dans la pop-up des RDV à qualifier et dans les
// fenêtres de qualification de la sheet. Absent : relancer le client (SMS « Lapin » et e-mail) ou non ; le setter derrière
// le RDV est alerté dans les deux cas. Reporté : la nouvelle date tout de suite, ou « à reporter » (date à fixer).
import { CalendarClock, CalendarX2, MessageCircleOff, MessageSquareText } from 'lucide-react';

export const RELANCE_CHOICES = [
  ['relance', 'Relancer le client', 'SMS « Lapin » et e-mail de relance', MessageSquareText],
  ['silence', 'Sans relance', 'Aucun message au client', MessageCircleOff],
];
export const REPORT_CHOICES = [
  ['date', 'Nouvelle date', 'Choisir la date maintenant', CalendarClock],
  ['later', 'Date à fixer', 'Le rendez-vous est à reporter', CalendarX2],
];
// Résultats « à reporter » (to_reschedule en R1, a_reporter en R2/R3) : utils/deckPayload.js.
export { TO_RESCHEDULE, isReported } from '../../utils/deckPayload';
