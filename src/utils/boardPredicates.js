// Prédicats « RDV à venir » du board Owner/Opti'Lex, partagés avec le dashboard CEO.
// Une seule définition de la règle métier : le board et le dashboard affichent
// forcément les mêmes chiffres. Sortis d'OptilexBoard.jsx (qui les réexporte) pour
// que le dashboard n'embarque plus la page du board entière dans son chargement.
import { displayEtat, EXITED_ETATS } from "./boardClientState.js";
import { matchesUpcomingIntegration, matchesUpcomingOnboarding, matchesOverdueOnboarding, onboardingSituation, parisWallTime } from "./boardIntegration.js";

// Dates stockées en heure-mur Paris labellisée UTC -> on compare les PARTIES date (YYYY-MM-DD),
// indépendamment du fuseau du navigateur, pour coller à l'affichage. Restreint aux lignes avec
// un numéro client (RDV réellement pilotables ; un contrat pas encore résolu n'est pas actionnable).
const todayParisISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

export const isOnboardingUpcoming = (r) => matchesUpcomingOnboarding(r, todayParisISO());
export const isOnboardingOverdue = (r) => matchesOverdueOnboarding(r, parisWallTime());
// Compteur « Onboarding à venir » du menu Onboarding du board, repris par le dashboard CEO : la case
// exclusive « venir » d'un client (une seule case par client, règle Vincent 30/09), clients partis
// exclus. Les deux prédicats bruts ci-dessus gardent les clients partis pour les croisements du board.
// `parisNow` : heure-mur de Paris de référence (parisWallTime), maintenant par défaut.
export const isClientExited = (r) => EXITED_ETATS.includes(displayEtat(r));
export const isActiveOnboardingUpcoming = (r, parisNow = parisWallTime()) =>
  onboardingSituation(r, parisNow.slice(0, 10), { exited: isClientExited(r) }) === "venir";
export const isActiveOnboardingOverdue = (r, parisNow = parisWallTime()) =>
  isActiveOnboardingUpcoming(r, parisNow) && matchesOverdueOnboarding(r, parisNow);
// Split des contrats effectif au 01/07/2026 : depuis cette date, un RDV intégration NON marqué
// "effectué" reste "à venir" MÊME si sa date est passée (il n'a pas été réalisé par Lisa).
// Avant le 01/07 = pré-split, pas de suivi "effectué" fiable -> exclu (on n'inonde pas la case).
export const isIntegrationUpcoming = (r) => matchesUpcomingIntegration(r, displayEtat(r));
// "En retard" : dans "à venir" (donc non effectué, depuis le 01/07) MAIS date déjà passée = non réalisé.
export const isIntegrationOverdue = (r) => isIntegrationUpcoming(r) && String(r.rdv_lancement_date).slice(0, 10) < todayParisISO();
