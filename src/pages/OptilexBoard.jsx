import { confirmBoardFinanceExit } from '../components/BoardFinanceExitDialog.jsx';
import { requiresExitDecision } from '../utils/boardFinanceExit.js';
import { BoardCalls, BoardDocuments, ComposerFiles, ContractFolders, ContractThumb, MESSAGE_FILE_ACCEPT, MESSAGE_FILE_MAX, MessageFiles, uploadMessageFile, useClientFiles } from '../components/BoardClientFiles.jsx';
import { EmojiPalette, Reactions, toggledReactions } from '../components/BoardReactions.jsx';
import { RECEIVABLES_ROLES, ReceivablesValue } from '../components/BoardReceivables.jsx';
import { Panel, Stat, Tag } from '../components/DashParts.jsx';
import { AirportKPI } from '../components/AirportCounter.jsx';
import { ContactMore, RankTag, useContactEntries } from '../components/BoardContactLine.jsx';
import { Barcode, OnboardedPass, OnboardedSeal } from '../components/OnboardingPass.jsx';
import WeatherCaseComposer, { WeatherQualification, WeatherScaleGuide } from '../components/WeatherCaseComposer';
import { WEATHER, weatherPresentation, weatherFilter, weatherRatingLabel } from '../utils/weatherCase';
import AppointmentConfirmation from "../components/booking/AppointmentConfirmation";
import BoardIntegrationSheet from "../components/BoardIntegrationSheet";
import BoardContactsEditor from "../components/BoardContactsEditor";
import { AlertCabinetButton, ConventionBar, ConventionGlyph, MailIcon } from "../components/CabinetAlertBlock";
import OnboardingFlowModal from "../components/OnboardingFlowModal";
import BoardOnboardingDateCorrection from "../components/BoardOnboardingDateCorrection";
import BoardStateDateInput from "../components/BoardStateDateInput";
import { appointmentConfirmation, appointmentFailure } from "../utils/appointmentConfirmation";
import { DetailText } from "../components/OptilexClientDetail";
import { MissionsValue } from "../components/BoardMissions.jsx";
import MentionTextarea, { MentionedText } from "../components/MentionTextarea";
import { mentionedIds, notifiedSummary } from "../utils/mentions.js";
import { isOnboardingToReschedule, onboardingDateOf, onboardingSituation } from "../utils/boardIntegration.js";
import { isOnboardingUpcoming, isOnboardingOverdue, isIntegrationUpcoming, isIntegrationOverdue } from "../utils/boardPredicates.js";
import { createLatestRequestTracker, displayEtat, EXITED_ETATS, isOutOfOnboarding, matchesSignedClient, withConfirmedEtat } from "../utils/boardClientState.js";
import { Fragment, memo, useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { sharedEmailOptions } from "../utils/boardContacts.js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CalendarCheck, CircleDashed, CloudSun, FileSignature, Maximize2, Minimize2, Scale, Store, UserRound } from "lucide-react";
import apiClient from "../services/apiClient";
import { isReadOnlyViewer, READ_ONLY_PROPS, READ_ONLY_TITLE } from "../utils/readOnlyRoles";
// Météo client : primitives partagées avec la météo d'onboarding (fiche d'intégration, parcours).
import { METEO_BANDS, meteoBandOf, meteoStyle, METEO_MEANING, MeteoIcon } from "../components/meteo.jsx";

// ── Charte sobre (navy + neutre, style Attio/Linear) ─────────────────────────
const NAVY = "#1c1b19";
const CHARCOAL = "#2b2927"; // fonds pleins (bouton principal, case cochée) : charbon, l'encre reste au texte
const BORDER = "#ece9e4";
const MUTED = "#8b867e";
const TEXT = "#1c1b19";
const BG = "#f4f2ef";
const CARD = "#ffffff";
const GREEN = "#0b7a4b";

export const ETAT_STYLE = {
  "Signé":            { bg: "#e2f6ea", fg: "#0b7a4b", dot: "#34a36e", bd: "#c3ebd3" },
  "Résiliation":      { bg: "#fde6e6", fg: "#c5221f", dot: "#e0504c", bd: "#f8cccc" },
  "Rétractation":     { bg: "#fde9da", fg: "#c2500e", dot: "#e08a2e", bd: "#f8d4ba" },
  "Self-Résiliation": { bg: "#fde6e6", fg: "#c5221f", dot: "#e0504c", bd: "#f8cccc" },
  "Pause":            { bg: "#f1eee9", fg: "#4a4540", dot: "#a8a39b", bd: "#e3ded6" },
  "Liquidation":      { bg: "#f6e4e1", fg: "#7a271a", dot: "#a3382a", bd: "#ecd0cb" },
  "En cours de liquidation": { bg: "#fbf1c2", fg: "#7a5a05", dot: "#c79a1a", bd: "#f0e09a" },
  "Renouvellement client":   { bg: "#eae9fb", fg: "#4a3fc4", dot: "#6c62d8", bd: "#d6d4f6" },
  "Attente Opti'Lex": { bg: "#fbf1c2", fg: "#7a5a05", dot: "#c79a1a", bd: "#f0e09a" },
  "En cours":         { bg: "#e4f0fd", fg: "#1b6fd0", dot: "#3b82d6", bd: "#c9e0fa" },
  "En cours de résiliation":  { bg: "#fde6e6", fg: "#c5221f", dot: "#e0504c", bd: "#f8cccc" },
  "En cours de rétractation": { bg: "#fde9da", fg: "#c2500e", dot: "#e08a2e", bd: "#f8d4ba" },
  "En attente":       { bg: "#f1eee9", fg: "#4a4540", dot: "#a8a39b", bd: "#e3ded6" },
  "Sans suite":       { bg: "#f1eee9", fg: "#4a4540", dot: "#c9c4bc", bd: "#e3ded6" },
  "Inactifs":         { bg: "#fde9da", fg: "#c2500e", dot: "#e08a2e", bd: "#f8d4ba" },
};
// Onglets PRIMAIRES = les plus actionnables (toujours visibles). Le reste vit dans un
// filtre multi-sélection "Filtre" pour désencombrer la barre.
// Barre allégée (demande dev 2026-09-03) : seuls les onglets du quotidien restent
// en chips directes. Les familles résiliation/rétractation/liquidation (« en
// cours de » ET actées) vivent dans le menu Filtre ; l'onboarding et les
// programmes ont chacun leur menu ; la météo repasse en chips directes.
// Retour de Paul (2026-09-03) : « en cours de résiliation » et « en cours de
// rétractation » restent visibles en première ligne, le reste vit en menus.
// Dev 2026-10-27 : l'onglet « RDV intégration à venir » (et son sous-filtre « En retard ») n'est plus utile,
// il sort de la barre ; « En cours de liquidation » y entre à sa place. L'alerte et le badge « En retard »
// d'une ligne restent (boardPredicates).
const PRIMARY_TABS = ["Tous", "Signé", "Attente Opti'Lex", "En cours de résiliation", "En cours de rétractation", "En cours de liquidation"];
const SECONDARY_CATS = ["Résiliation", "Rétractation", "Self-Résiliation", "Liquidation", "Pause", "Renouvellement client", "Inactifs", "En cours", "En attente", "Sans suite"];
// Onglets à logique de tri PROPRE (pas le tri "entré le plus récemment dans l'état") : tout le
// reste = onglet d'état -> tri par date d'entrée dans l'état, le plus récent en haut.
const NON_ETAT_SORTED_TABS = ["Tous", "Renouvellement client", "Inactifs", "Onboarding à venir"];
const TAB_LABEL = { "Attente Opti'Lex": "En attente Opti'Lex", "Onboarding à venir": "Onboarding Owner à venir" };
// Libellés courts des filtres posés, rappelés sous la barre (dev 28/10/2026).
const ONBOARDING_TAGS = { venir: "À venir", done: "Réalisé", confirm: "À confirmer", todo: "À faire", noshow: "No show", recaler: "À recaler" };
const PROGRAMME_TAGS = { ambassadeur: "Ambassadeur", parrainage: "Parrainage", temoignage: "Témoignage" };
// Pictogrammes des programmes (dev 29/10/2026) : l'ambassadeur parle (porte-voix), le parrainage se serre la main,
// le témoignage est une bulle avec son étoile. Deux tons, teinte de la palette du dev quand le programme est coché.
const PROGRAM_ICONS = {
  ambassadeur: <><path d="M3 10.4v3.2A1.4 1.4 0 0 0 4.4 15H6l5.5 4.2V4.8L6 9H4.4A1.4 1.4 0 0 0 3 10.4Z" fill="currentColor" fillOpacity=".16" /><path className="pg-wave pg-wave-1" d="M15 9.3a3.8 3.8 0 0 1 0 5.4" /><path className="pg-wave pg-wave-2" d="M17.9 6.6a7.6 7.6 0 0 1 0 10.8" /></>,
  parrainage: <g className="pg-shake"><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></g>,
  temoignage: <><path d="M20.5 11.5a8 8 0 0 1-11.6 7.1L4 20l1.3-4.4a8 8 0 1 1 15.2-4.1Z" fill="currentColor" fillOpacity=".14" /><path className="pg-star" d="m12.3 7.8 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.2 1.3.4-2.5-1.8-1.7 2.5-.3Z" fill="currentColor" stroke="none" /></>,
};
const PROGRAM_TONES = { ambassadeur: ["#eae9fb", "#4a3fc4"], parrainage: ["#d9f3f7", "#0f7286"], temoignage: ["#fde9da", "#c2500e"] };
const ProgramIcon = ({ kind, size = 16 }) => (
  <svg className={`pg pg-${kind}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PROGRAM_ICONS[kind]}</svg>
);
const tabLabel = (t) => TAB_LABEL[t] || t;
// États que le cabinet peut poser manuellement (badge cliquable, table + fiche).
const ETAT_OPTIONS = ["Signé", "En cours de résiliation", "En cours de rétractation", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation", "En cours de liquidation"];
// RÈGLE MÉTIER : le rôle optilex (fiscalistes du cabinet) ne peut pas POSER Résiliation/
// Rétractation (états actés par Owner) — seulement les "En cours de ...". Le backend
// applique la même règle (403) ; ici on retire les options de leur picker.
const CABINET_FORBIDDEN_ETATS = ["Résiliation", "Rétractation"];
// finance_team (Aurélie) : accès très restreint -> ne peut poser QUE ces 2 états
// (+ noter la météo + cocher l'onboarding owner). Tout le reste = lecture seule.
const FINANCE_TEAM_ETATS = ["En cours de résiliation", "En cours de rétractation"];
const isFinanceTeam = () => { try { return (apiClient.getUser() || {}).role === "finance_team"; } catch { return false; } };
// Rôles en lecture seule (RH, 06/11/2026) : le board de la direction financière, rien ne s'y écrit, plus
// strict que finance_team (ni état, ni onboarding, ni météo, ni commentaire, ni rendez-vous). Les contrôles
// d'écriture restent visibles et désactivés ; les valeurs éditables s'affichent comme des valeurs.
const isBoardReadOnly = () => { try { return isReadOnlyViewer((apiClient.getUser() || {}).role); } catch { return false; } };
const etatOptionsForUser = () => {
  try {
    const role = (apiClient.getUser() || {}).role;
    if (role === "finance_team") return FINANCE_TEAM_ETATS;
    if (role === "optilex") return ETAT_OPTIONS.filter((o) => !CABINET_FORBIDDEN_ETATS.includes(o));
  } catch { /* défaut : liste complète */ }
  return ETAT_OPTIONS;
};
// ── Météo client : bandes, sens et icônes vivent dans components/meteo.jsx (partagés avec la
// météo d'onboarding). Réexportés d'ici pour les pages qui les importent déjà du board.
export { METEO_BANDS, meteoBandOf, MeteoIcon };
// Commentaire OBLIGATOIRE quand on signale un client Critique (1-2) ou Mécontent (3) : on
// n'enregistre pas une alerte de risque sans contexte écrit (motif de la dégradation).
const meteoNoteRequired = (score) => score != null;
// Qui peut POSER une note : pour l'instant Owner uniquement (le cabinet la voit mais ne la
// modifie pas). Plus tard on ouvrira au rôle optilex -> retirer ce gate (backend déjà OK).
const meteoSettable = () => { try { return (apiClient.getUser() || {}).role !== "optilex"; } catch { return true; } };
// Champ(s) date à saisir par état (raisonnement fiscaliste). Absent = pas de date.
// Pause = période : début (etat_date) + fin CONNUE (pause_end_date) OU indéterminée -> relance
// (pause_relance_date), car en B2B le dirigeant ne sait pas toujours quand il reprend.
export const ETAT_DATE_CONFIG = {
  "Résiliation": { label: "Date de résiliation" },
  "Self-Résiliation": { label: "Date de résiliation" },
  "Rétractation": { label: "Date de rétractation" },
  "Liquidation": { label: "Date de clôture" },
  "En cours de liquidation": { label: "Date d'ouverture de liquidation" },
  "Pause": { pause: true },
};

// RDV à venir (date de RDV >= aujourd'hui à Paris, pas encore effectué) — onglets dédiés.
// Dates stockées en heure-mur Paris labellisée UTC -> on compare les PARTIES date (YYYY-MM-DD),
// indépendamment du fuseau du navigateur, pour coller à l'affichage. Restreint aux lignes avec
// un numéro client (RDV réellement pilotables ; un contrat pas encore résolu n'est pas actionnable).
const _todayParisISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
// Split des contrats effectif au 01/07/2026 : depuis cette date, un RDV intégration NON marqué
// "effectué" reste "à venir" MÊME si sa date est passée (il n'a pas été réalisé par Lisa).
// Avant le 01/07 = pré-split, pas de suivi "effectué" fiable -> exclu (on n'inonde pas la case).
// Définis dans utils/boardPredicates.js (réexportés ici, avec `displayEtat` plus bas) : les
// cartes d'états du dashboard CEO comptent avec CES prédicats-ci, sans embarquer cette page.
// Une seule définition de la règle métier, pas de copie qui dérive — board et dashboard
// affichent forcément les mêmes chiffres.
export { isOnboardingUpcoming, isOnboardingOverdue, isIntegrationUpcoming, isIntegrationOverdue };
// Contrat Opti'Lex SÉPARÉ (split) pas encore signé : optilex_status existe (non null =
// pas le cas "groupé/inclus") et != done. Sert l'alerte "RDV intégration mais Opti'Lex
// non signé". Disparaît d'elle-même dès que le contrat est signé (status -> done).
const optilexNotSigned = (r) => !!r.optilex_status && r.optilex_status !== "done";
const integrationAlert = (r) => isIntegrationUpcoming(r) && optilexNotSigned(r);
// Un état DATÉ (Résiliation/Rétractation/Pause/Liquidation…) n'est EFFECTIF qu'à partir de sa date
// d'effet. Posé avec une date FUTURE (ou sans date = à renseigner) = "PRÉVU", pas encore appliqué :
// le client reste dans son état actuel, puis bascule AUTOMATIQUEMENT à l'échéance (calcul fait
// par le back à chaque chargement du board, aucun cron). La date devient donc de fait obligatoire :
// sans elle, l'état ne prend jamais effet. Les "En cours de résiliation/rétractation" (sans date)
// restent des marqueurs immédiats.
export const isEtatPending = (r) => !!(r.etat_manuel && ETAT_DATE_CONFIG[r.etat_manuel]
  && (!r.etat_date || String(r.etat_date).slice(0, 10) > _todayParisISO()));

// État affiché : calculé par le back (`etat_affiche` de GET /optilex/board), lu tel quel
// par `displayEtat` (utils/boardClientState.js). Réexporté d'ici : les cartes d'états du
// dashboard CEO et la page Finance comptent avec CETTE valeur, donc avec les mêmes
// chiffres que les onglets du board et que la synchro vers le SaaS Opti'Lex.
// `isEtatPending` ci-dessus ne décide pas de l'état : il ne pilote que le badge
// « ⏳ prévu le … » d'un état posé dont la date d'effet n'est pas encore atteinte.
export { displayEtat };
// Une ligne appartient-elle à une catégorie (onglet primaire OU secondaire) ? Unifie les
// prédicats calculés (RDV à venir) et les états (Sheet/override/interne) pour un filtrage unique.
// Client cabinet sans mission suivie depuis 60 j (enrichissement SaaS Opti'Lex, jointure email).
// Indépendant de l'état : un client peut être "Signé" ET inactif — signal de churn silencieux.
// Inactif = sans mission depuis >= 60 j ET au moins une mission passée (le cabinet a
// travaillé puis plus rien = vrai churn). Les zéro-mission (probablement encore en
// onboarding) ne sont affichés NULLE PART comme inactifs (décision produit 2026-07-08).
const isInactif = (r) => r.is_inactive_60d === true && (r.mission_count_total || 0) > 0;
// ── Renouvellement client : anniversaire du contrat Owner (date de signature + 1 an).
// Les contrats durent 1 an, renouvelables (ou rétractation) à l'échéance. L'onglet montre
// les clients ENCORE actifs qui approchent l'anniversaire (fenêtre 90 j), pour anticiper
// qui va renouveler / partir. La notif email J-90 (backend) est indépendante.
const RENEWAL_WINDOW_DAYS = 90;
const TERMINATED_ETATS = EXITED_ETATS; // liste partagée avec le dashboard CEO (utils/boardClientState.js)
// Catégories qui ne sont PAS des états mais des CRITÈRES (un client peut en
// cumuler plusieurs) : elles se combinent en ET avec les états, pour permettre
// des croisements du type « en cours de résiliation ET contrat qui arrive à
// échéance ET onboarding encore à faire » (besoin Vincent, 2026-08-26).
const CRITERIA_CATS = ["Onboarding à venir", "Renouvellement client", "Inactifs", "Impayés"];
// Impayé depuis plus de 2 mois (dev 29/10/2026) : retard calculé par la finance (mêmes chiffres que la page Finance),
// renvoyé par le board seulement aux rôles qui voient les créances ; ailleurs le champ vaut null et le filtre se cache.
const UNPAID_MONTHS = 2;
const isUnpaid = (r) => (r.finance_overdue_months || 0) >= UNPAID_MONTHS;
// Puces de la ligne « Alertes » : pièce marquée d'un point d'exclamation, mallette en sommeil, pause.
const ALERT_FILTERS = [
  { cat: "Impayés", key: "unpaid", label: "Impayés +2 mois", hint: "Clients en retard de paiement depuis plus de 2 mois (chiffres de la page Finance)", tile: "#ffe2dc", ink: "#bf4436",
    icon: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".14" /><path className="al-bang" d="M12 7.5v5.5M12 16.5h.01" /></> },
  { cat: "Inactifs", key: "idle", label: "Sans mission +2 mois", hint: "Le cabinet a déjà travaillé pour ce client, mais plus aucune mission depuis 60 jours", tile: "#ffe9cf", ink: "#b45d14",
    icon: <><rect x="3" y="8" width="13" height="11" rx="2.4" fill="currentColor" fillOpacity=".14" /><path d="M7 8V6.5A1.5 1.5 0 0 1 8.5 5h2A1.5 1.5 0 0 1 12 6.5V8" /><path className="al-z" d="M17 4h4l-4 4.5h4" strokeWidth="1.7" /></> },
  { cat: "Pause", key: "pause", label: "En pause", hint: "Clients dont l'état est « Pause »", tile: "#e4f0fd", ink: "#1b6fd0",
    icon: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".14" /><path d="M10 9v6M14 9v6" /></> },
];
const anniversaryDaysLeft = (r) => {
  const d = sigDateOf(r);
  if (!d) return null;
  const [, m, day] = d.split("-").map(Number);
  const today = new Date(_todayParisISO() + "T00:00:00");
  let anniv = new Date(today.getFullYear(), m - 1, day);
  if (anniv < today) anniv = new Date(today.getFullYear() + 1, m - 1, day);
  return Math.round((anniv - today) / 86400000);
};
// L'onglet ne montre QUE les clients actifs dont l'anniversaire de contrat tombe dans la
// fenêtre de renouvellement (<= 90 j), triés par proximité de l'échéance (voir `filtered`).
// Le badge J-X passe en alerte : rouge <=30 j, orange au-delà dans la fenêtre. La date de
// signature vient de `owner_signed_at` (contrat OU fallback fiche appliqué côté back), ce qui
// couvre les clients hérités sans contrat CRM lié (dates 2024/2025 -> anniversaire imminent).
const isRenewalUpcoming = (r) => {
  if (!r.numero_client) return false;
  if (TERMINATED_ETATS.includes(displayEtat(r))) return false;
  const days = anniversaryDaysLeft(r);
  return days != null && days >= 0 && days <= RENEWAL_WINDOW_DAYS;
};

const matchesCat = (r, cat) => {
  if (cat === "Signé") return matchesSignedClient(r, displayEtat(r));
  if (cat === "Onboarding à venir") return isOnboardingUpcoming(r);
  if (cat === "Inactifs") return isInactif(r);
  if (cat === "Impayés") return isUnpaid(r);
  if (cat === "Renouvellement client") return isRenewalUpcoming(r);
  return displayEtat(r) === cat;
};
// Alerte fiscaliste sur un état posé par le cabinet (etat_manuel) : pause échue (relance ou
// fin passée -> AGIR) ou date d'effet manquante (état daté posé sans date). Restituée là où
// l'œil se pose : sous le badge en table, sous le sélecteur en fiche. Les états hérités du
// Sheet (sans etat_manuel) ne déclenchent rien : pas de bruit sur l'antériorité.
const etatHint = (r) => {
  if (!r.numero_client || !r.etat_manuel) return null;
  const e = r.etat_manuel;
  if (e === "Pause") {
    const today = _todayParisISO();
    if (r.pause_relance_date && String(r.pause_relance_date).slice(0, 10) < today)
      return { text: `à relancer depuis le ${fmt(r.pause_relance_date)}`, urgent: true };
    if (r.pause_end_date && String(r.pause_end_date).slice(0, 10) < today)
      return { text: `fin de pause dépassée (${fmt(r.pause_end_date)})`, urgent: true };
    if (!r.etat_date) return { text: "période à renseigner", urgent: false };
    return null;
  }
  if (ETAT_DATE_CONFIG[e] && !r.etat_date) return { text: "date à renseigner", urgent: false };
  return null;
};
// Valeur affichée = override cabinet si présent, sinon original Owner (antériorité préservée).
const ov = (r, ovrKey, origKey) => (r[ovrKey] != null && r[ovrKey] !== "" ? r[ovrKey] : r[origKey]);
// Clé de ligne stable (les contrats pré-client n'ont pas de numero_client).
const rowKey = (r) => r.row_key || r.numero_client;
// Nom de la société (Sheet/CRM), et nom mis en avant : la PERSONNE (contact CRM) si on
// l'a, sinon la société. Beaucoup de vieux clients n'ont que la société (pas de contrat lié).
const companyName = (r) => r.crm_societe || r.societe_sheet || null;
const primaryName = (r) => ov(r, "contact_name_ovr", "contact_name") || r.crm_societe || r.societe_sheet || "—";
const rowSubtitle = (r) => {
  const parts = [];
  const comp = companyName(r);
  if (comp && comp !== primaryName(r)) parts.push(comp);
  if (r.numero_client) parts.push(r.numero_client);
  else if (r.email) parts.push(r.email);
  return parts.join(" · ");
};
// Tranche salariale déclarée à la vente (employee_range CRM) -> libellé lisible.
const fmtTranche = (t) => {
  if (!t) return null;
  const s = String(t).trim();
  let m = s.match(/^(\d+)\s*[-_ ]+\s*(\d+)$/);
  if (m) return `${m[1]} à ${m[2]} salariés`;
  m = s.match(/^(\d+)\s*\+$/);
  if (m) return `${m[1]}+ salariés`;
  return s;
};
const AVATAR_COLORS = ["#1b6fd0", "#4a3fc4", "#0f7286", "#0b7a4b", "#c2500e", "#7a5a05", "#3f6b12", "#4a4540"];

// ── Export CSV (extraction résiliés / en cours de résiliation, etc.) ─────────
// Découpage prénom/nom "au feeling" : convention de la fiche RH = nom de famille
// EN MAJUSCULES. Donc les tokens tout-en-capitales (>=2 lettres) = nom, le reste =
// prénom. Repli : 1er token = prénom, reste = nom. Best-effort, pas garanti exact.
const _isUpperToken = (t) => t.length >= 2 && t === t.toLocaleUpperCase("fr") && /[A-ZÀ-Ÿ]/.test(t);
const splitName = (full) => {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { first: "", last: tokens[0] };
  const upper = tokens.filter(_isUpperToken);
  if (upper.length && upper.length < tokens.length) {
    return { first: tokens.filter((t) => !_isUpperToken(t)).join(" "), last: upper.join(" ") };
  }
  return { first: tokens[0], last: tokens.slice(1).join(" ") };
};
// Colonnes de base (format de la feuille RH). "Scoring" = note météo (1-5) ; Statut/Suivi
// planifié restent vides (renseignés par l'équipe). + colonnes météo (bande/note/auteur/date)
// pour permettre l'automatisation en aval.
const CSV_HEADERS = ["Client", "Scoring", "Statut", "Suivi planifié", "Numéro", "First name", "Last name", "email", "Météo (bande)", "Note météo", "Noté par", "Noté le"];
const _csvCell = (v) => {
  const s = (v ?? "").toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rowToCsvCells = (r) => {
  const societe = companyName(r);
  const person = ov(r, "contact_name_ovr", "contact_name");
  // "société - Personne", sauf si la société contient déjà le nom (évite le doublon
  // "LOC DESIGN - Luis Fernandez - Luis Fernandez" quand la fiche société embarque le dirigeant).
  const client = person && societe && !societe.toLowerCase().includes(person.toLowerCase())
    ? `${societe} - ${person}`
    : (societe || person || "");
  // Nom et prénom de la fiche (dev 10/11/2026) : un seul prénom, le premier, jamais tous ceux du NDA ; le
  // découpage du nom du contact ne sert qu'à défaut.
  const guess = splitName(person);
  const first = r.client_first_name || (guess.first || "").split(/\s+/)[0] || "";
  const last = r.client_last_name || guess.last || "";
  const phone = ov(r, "phone_ovr", "contact_phone") || "";
  const email = ov(r, "email_ovr", "email") || "";
  const band = weatherPresentation(r.meteo_score, r.meteo_context)?.label || "";
  const meteoAt = r.meteo_at ? String(r.meteo_at).slice(0, 16).replace("T", " ") : "";
  return [client, r.meteo_score ?? "", "", "", phone, first, last, email, band, r.meteo_note || "", r.meteo_by || "", meteoAt];
};
const exportRowsToCsv = (rows, label) => {
  const lines = [CSV_HEADERS, ...rows.map(rowToCsvCells)].map((cells) => cells.map(_csvCell).join(","));
  // BOM UTF-8 (accents corrects dans Excel/Sheets) + CRLF.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (label || "export").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  a.href = url;
  a.download = `optilex_${slug || "export"}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Colonnes du tableau (dev 28/10/2026) ────────────────────────────────────
// Chaque colonne a la largeur de son contenu mesuré sur tout le board, plus la même marge ; aucune ne prend
// « le reste ». Sur un écran plus large, le surplus est partagé À PARTS ÉGALES (et non au prorata, qui
// creusait surtout la colonne État, dimensionnée pour « En cours de rétractation ») : les espaces entre
// colonnes grandissent tous de la même quantité.
const TABLE_COLS = [
  256, // client : nom et société, coupés au-delà
  172, // secteur : icône + libellé (« Grande Distribution »)
  148, // météo : tuile + libellé sur une ligne
  228, // état : « En cours de rétractation » + flèche du menu
  138, // contrat owner
  172, // contrat opti'lex + badge d'intégration
  168, // onboarding : date + heure, badges dessous
];
const TABLE_CHEVRON_W = 36;
const TABLE_MIN_W = TABLE_COLS.reduce((a, b) => a + b, 0) + TABLE_CHEVRON_W;

// Changement de vue (dev 28/10/2026) : la liste glisse comme une page de carrousel. L'ancienne part vers le côté
// opposé au contrôle cliqué, la nouvelle arrive de son côté, sur un ressort. Elle n'arrive qu'avec ses premières
// lignes : le reste se dessine par paquets, une fois la glissade posée, à mesure qu'on approche du bas.
const ROWS_FIRST = 30;
const ROWS_CHUNK = 60;
const ROWS_SETTLE_MS = 520;
const VIEW_SLIDE = {
  enter: (dir) => ({ x: 72 * dir, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { x: { type: "spring", stiffness: 360, damping: 36, mass: 0.9 }, opacity: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } } },
  exit: (dir) => ({ x: -72 * dir, opacity: 0, transition: { duration: 0.17, ease: [0.4, 0, 1, 1] } }),
};
const VIEW_FADE = { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } };

const ROW_TD = { padding: "12px 14px", fontSize: 13, color: TEXT, borderTop: "1px solid #f1eee9", verticalAlign: "middle", whiteSpace: "nowrap" };

// ── Secteur d'activité (dev 28/10/2026) ─────────────────────────────────────
// Type d'entreprise du NDA (client_data.business_type), déduit du code NAF trouvé sur Pappers.
// Seule l'orthographe de la valeur enregistrée « Micro créche » est corrigée à l'affichage.
const secteurLabel = (v) => (v === "Micro créche" ? "Micro-crèche" : v);
// Une icône dessinée par secteur de la liste du NDA, en deux tons : trait marine, volumes en bleu
// Owner pâle ; seuls la croix de l'ambulance et celle de la pharmacie gardent leur couleur.
// Secteur inconnu : l'immeuble de « Générales ».
const SECTEUR_INK = "#4a4540";
const SECTEUR_FILL = "#ebe8e3";
const SECTEUR_ICONS = {
  "Ambulance": (f) => <>
    <rect x="2.5" y="7" width="11" height="10" rx="1.6" fill={f} />
    <path d="M13.5 10h4.1l3.4 3.7V17h-7.5z" fill={f} />
    <path d="M15.2 11.6h1.8l1.9 2.1h-3.7z" fill="#fff" />
    <rect x="6.6" y="5" width="2.8" height="2" rx=".7" fill="#fbe3e3" stroke="#d14343" />
    <path d="M8 10.2v3.6M6.2 12h3.6" stroke="#d14343" strokeWidth="1.8" />
    <circle cx="6.6" cy="17.4" r="1.9" fill="#fff" /><circle cx="17.4" cy="17.4" r="1.9" fill="#fff" />
  </>,
  "Micro créche": (f) => <>
    <path d="M4 11.2a7 7 0 0 1 7-7v7z" fill={f} />
    <path d="M7.1 6.3 11 11.2" />
    <path d="M3.5 11.2H19c0 3.3-2.9 6-6.5 6H10c-3.6 0-6.5-2.7-6.5-6z" fill={f} />
    <path d="M19 11.2l1.1-4.4h1.7" />
    <circle cx="7.6" cy="19.6" r="1.6" fill="#fff" /><circle cx="15.4" cy="19.6" r="1.6" fill="#fff" />
  </>,
  "Dentiste": (f) => <>
    <path d="M7.4 3.6c-2.4 0-4 2-4 4.6 0 2.3 1 3.6 1.7 5.6.6 1.8.8 3.6 1.3 5.3.3 1.1.8 1.7 1.5 1.7 1 0 1.3-1 1.6-2.4l.6-2.8c.3-1.2.9-1.8 1.9-1.8s1.6.6 1.9 1.8l.6 2.8c.3 1.4.6 2.4 1.6 2.4.7 0 1.2-.6 1.5-1.7.5-1.7.7-3.5 1.3-5.3.7-2 1.7-3.3 1.7-5.6 0-2.6-1.6-4.6-4-4.6-1.9 0-2.7 1-4.6 1s-2.7-1-4.6-1z" fill={f} />
    <path d="M6.6 7.1c.3-.9.9-1.4 1.8-1.6" stroke="#fff" strokeWidth="1.5" />
  </>,
  "Pharmacie": () => <>
    <path d="M9.4 3.5h5.2v5.9h5.9v5.2h-5.9v5.9H9.4v-5.9H3.5V9.4h5.9z" fill="#e2f1e8" stroke="#2f7a52" />
    <path d="M12 9.6v4.8M9.6 12h4.8" stroke="#2f7a52" strokeWidth="1.4" opacity=".55" />
  </>,
  "Salle de sport": (f) => <g transform="rotate(-35 12 12)">
    <path d="M7.5 12h9" strokeWidth="2" />
    <rect x="4.2" y="7" width="3.3" height="10" rx="1.2" fill={f} />
    <rect x="16.5" y="7" width="3.3" height="10" rx="1.2" fill={f} />
    <rect x="1.8" y="9.3" width="2.4" height="5.4" rx=".9" fill={f} />
    <rect x="19.8" y="9.3" width="2.4" height="5.4" rx=".9" fill={f} />
  </g>,
  "Esthétique": (f) => <>
    <path d="M9.4 11.4V6.6l5.2-3v7.8" fill={f} />
    <rect x="8.4" y="11.4" width="7.2" height="2.8" rx=".7" fill="#fff" />
    <rect x="7.4" y="14.2" width="9.2" height="7" rx="1.4" fill={f} />
    <path d="M11 7.4v2.4" stroke="#fff" strokeWidth="1.4" />
    <path d="M19.6 4.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill={SECTEUR_INK} strokeWidth=".8" />
  </>,
  "Tech": (f) => <>
    <rect x="4" y="4.5" width="16" height="11.5" rx="1.6" fill={f} />
    <path d="M2.5 18.2h19c0 1-.8 1.8-1.8 1.8H4.3c-1 0-1.8-.8-1.8-1.8z" fill={f} />
    <path d="M9.8 8.4 7.6 10.3l2.2 1.9M14.2 8.4l2.2 1.9-2.2 1.9" />
  </>,
  "Hôtellerie": (f) => <>
    <path d="M4.5 16.6a7.5 7.5 0 0 1 15 0z" fill={f} />
    <rect x="2.8" y="16.6" width="18.4" height="2.8" rx="1.3" fill={f} />
    <path d="M12 9.1V7.6" /><path d="M10.4 6.2h3.2" strokeWidth="1.8" />
    <path d="M7.9 14.4a4.6 4.6 0 0 1 2.3-2.9" stroke="#fff" strokeWidth="1.5" />
  </>,
  "Grande Distribution": (f) => <>
    <path d="M6 8h14.8l-2.1 6.5a1.5 1.5 0 0 1-1.4 1H8.6a1.5 1.5 0 0 1-1.5-1.2z" fill={f} />
    <path d="M2.5 4.2h2.2l2.4 10.1a1.5 1.5 0 0 0 1.5 1.2h8.7" />
    <path d="M10.6 8.4v6.6M14.6 8.4v6.6" strokeWidth="1.2" opacity=".55" />
    <circle cx="9.2" cy="19.4" r="1.6" fill="#fff" /><circle cx="16.6" cy="19.4" r="1.6" fill="#fff" />
  </>,
  "Tertiaire": (f) => <>
    <path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7" />
    <rect x="3" y="7" width="18" height="12.5" rx="2" fill={f} />
    <path d="M3 12.4h18" />
    <rect x="10.5" y="10.9" width="3" height="3" rx=".7" fill="#fff" />
  </>,
  "BTP": (f) => <>
    <path d="M4.4 16.2a7.6 7.6 0 0 1 15.2 0z" fill={f} />
    <rect x="10.4" y="7.4" width="3.2" height="6.4" rx="1.3" fill="#fff" />
    <path d="M7.6 16.2v-3.4M16.4 16.2v-3.4" strokeWidth="1.3" opacity=".55" />
    <rect x="2.4" y="16.2" width="19.2" height="2.8" rx="1.4" fill={f} />
  </>,
  "Boulangerie": (f) => <g transform="rotate(-38 12 12)">
    <rect x="1.8" y="8.8" width="20.4" height="6.4" rx="3.2" fill={f} />
    <path d="M6.6 10.4l1.6 3.2M10.6 10.4l1.6 3.2M14.6 10.4l1.6 3.2" />
  </g>,
  "Immobilier": (f) => <>
    <path d="M15.6 6.8V4.4h2.2v4.3" fill={f} />
    <path d="M5.4 9.6V19a1 1 0 0 0 1 1h11.2a1 1 0 0 0 1-1V9.6L12 4.4z" fill={f} />
    <path d="M3.4 11.2 12 4.2l8.6 7" />
    <path d="M10 20v-4.8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20" fill="#fff" />
  </>,
  "Restauration": (f) => <>
    <path d="M6.4 3.2v4.4a2.6 2.6 0 0 0 5.2 0V3.2M9 3.2v4.9M9 10.2V21" />
    <path d="M17.4 21V3.4c-2 1-3.4 3.5-3.4 6.6V14h3.4" fill={f} />
  </>,
  "Générales": (f) => <>
    <rect x="4" y="3.8" width="10" height="16.2" rx="1.2" fill={f} />
    <rect x="14" y="9.6" width="6" height="10.4" rx="1.2" fill={f} />
    <path d="M7.2 7.6h.6M10.2 7.6h.6M7.2 11.2h.6M10.2 11.2h.6M7.2 14.8h.6M10.2 14.8h.6M16.7 13.2h.6M16.7 16.4h.6" strokeWidth="1.9" />
    <path d="M2.6 20h18.8" />
  </>,
};
export function SectorIcon({ secteur, size = 18 }) {
  const draw = SECTEUR_ICONS[secteur] || SECTEUR_ICONS["Générales"];
  return (
    <svg className="ob-sector-ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={SECTEUR_INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {draw(SECTEUR_FILL)}
    </svg>
  );
}

// ── Icônes des onglets d'état (dev 29/10/2026, « très bons svg ») ────────────
// Une image par onglet, en deux tons : trait dans la teinte de l'état, volume en aplat pâle ; blanches sur la
// pastille marine. Au survol, chacune bouge à sa façon : les feuilles s'écartent, la coche se redessine, le
// sablier se retourne, la croix se trace, la flèche sort du contrat, le marteau frappe.
const TAB_DOC = "M14 3H7.2A2.2 2.2 0 0 0 5 5.2v13.6A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2V8z";
const TAB_DOC_FOLD = "M14 3v3.8A1.2 1.2 0 0 0 15.2 8H19";
const TAB_ICONS = {
  "Tous": (t) => <>
    <path className="ob-ti-l3" d="M3.5 16.4 12 20.6l8.5-4.2" />
    <path d="M3.5 12.2 12 16.4l8.5-4.2" />
    <path className="ob-ti-l1" d="M12 3.4 3.5 7.7 12 12l8.5-4.3z" fill={t} />
  </>,
  "Signé": (t) => <>
    <path d={TAB_DOC} fill={t} /><path d={TAB_DOC_FOLD} />
    <path className="ob-ti-check" d="M8.4 14.4l2.6 2.6 4.8-5" pathLength="1" />
  </>,
  "Attente Opti'Lex": (t) => <g className="ob-ti-glass">
    <path d="M8 3v2.4a5 5 0 0 0 1.8 3.85L12 12l2.2-2.75A5 5 0 0 0 16 5.4V3z" fill={t} />
    <path d="M8 21v-2.4a5 5 0 0 1 1.8-3.85L12 12l2.2 2.75A5 5 0 0 1 16 18.6V21z" fill={t} />
    <path d="M9.4 19.8c.5-1.4 1.4-2.2 2.6-2.2s2.1.8 2.6 2.2z" fill="currentColor" stroke="none" />
    <path d="M6.5 3h11M6.5 21h11" />
  </g>,
  "En cours de résiliation": (t) => <>
    <path d={TAB_DOC} fill={t} /><path d={TAB_DOC_FOLD} />
    <path className="ob-ti-x" d="M9.4 12.4l5.2 5.2" pathLength="1" /><path className="ob-ti-x ob-ti-x2" d="M14.6 12.4l-5.2 5.2" pathLength="1" />
  </>,
  "En cours de rétractation": (t) => <>
    <path d="M9 9.6V5.2A2.2 2.2 0 0 1 11.2 3H16l4 4v11.8a2.2 2.2 0 0 1-2.2 2.2h-6.6A2.2 2.2 0 0 1 9 18.8v-2.4" fill={t} />
    <path d="M16 3v2.8A1.2 1.2 0 0 0 17.2 7H20" />
    <g className="ob-ti-arrow"><path d="M14.5 13H3.8" /><path d="M7.1 9.7 3.8 13l3.3 3.3" /></g>
  </>,
  "En cours de liquidation": (t) => <>
    <rect x="12.2" y="17.9" width="9" height="3.3" rx="1.1" fill={t} />
    <g className="ob-ti-gavel">
      <path d="M11.9 11.3 4 19.2" strokeWidth="2.2" />
      <g transform="rotate(45 14.3 8.7)">
        <rect x="8.4" y="5.6" width="11.8" height="6.2" rx="1.5" fill={t} />
        <path d="M11.3 5.6v6.2M17.3 5.6v6.2" />
      </g>
    </g>
  </>,
};
function TabIcon({ tab, on }) {
  const draw = TAB_ICONS[tab];
  if (!draw) return null;
  const s = ETAT_STYLE[tab];
  const ink = s ? s.fg : on ? "#1c1b19" : "#55514b";
  const tint = s ? `${s.dot}38` : "#55514b26";
  return (
    <svg className="ob-tab-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ color: ink }}>
      {draw(tint)}
    </svg>
  );
}

// ── Filtre par date de signature Owner ──────────────────────────────────────
// owner_signed_at (fallback fiche appliqué côté back) -> date seule YYYY-MM-DD.
const sigDateOf = (r) => (r.owner_signed_at ? String(r.owner_signed_at).slice(0, 10) : null);

// ── Tri par colonne de date (en-têtes cliquables) ────────────────────────────
const SORT_ACCESSORS = {
  owner_signed: (r) => sigDateOf(r),
  onboarding: (r) => { const d = r.rdv_onboarding_date_manual || r.rdv_onboarding_date; return d ? String(d).slice(0, 10) : null; },
};
// Comparateur : dates absentes toujours en bas, sinon ascendant / descendant.
const byDateSort = (accessor, dir) => (a, b) => {
  const da = accessor(a), db = accessor(b);
  const ta = da ? Date.parse(da) : NaN, tb = db ? Date.parse(db) : NaN;
  const na = Number.isNaN(ta), nb = Number.isNaN(tb);
  if (na && nb) return 0;
  if (na) return 1;
  if (nb) return -1;
  return dir === "asc" ? ta - tb : tb - ta;
};
// Flèche de tri : ▲ (asc) / ▼ (desc). Les deux grisées quand la colonne est triable mais inactive.
function SortArrow({ dir }) {
  return (
    <svg width="9" height="13" viewBox="0 0 10 14" style={{ flexShrink: 0, marginLeft: 2 }} aria-hidden>
      <path d="M5 1 L9 5.5 L1 5.5 Z" fill={dir === "asc" ? NAVY : "#d8d3cb"} />
      <path d="M5 13 L1 8.5 L9 8.5 Z" fill={dir === "desc" ? NAVY : "#d8d3cb"} />
    </svg>
  );
}
const _toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// "2026-07" -> { from: "2026-07-01", to: "2026-07-31" }
const monthToRange = (month) => {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: _toISODate(new Date(y, m, 0)) };
};
// "2026-07" -> "Juillet 2026"
const monthLabel = (m) => {
  const s = new Date(`${m}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const _fmtShort = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };
// Libellé du bouton : "juil. 2026" si mois plein, sinon "du → au".
const sigRangeLabel = (from, to) => {
  if (!from && !to) return null;
  if (from && to) {
    const r = monthToRange(from.slice(0, 7));
    if (from === r.from && to === r.to) {
      return new Date(`${from}T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    }
    return `${_fmtShort(from)} → ${_fmtShort(to)}`;
  }
  return from ? `dès ${_fmtShort(from)}` : `jusqu'au ${_fmtShort(to)}`;
};

const fmt = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
// Date + heure (les rdv_*_date stockent l'heure-mur Paris labellisée UTC -> parties UTC).
// Heure masquée si minuit pile (dates saisies sans heure : fiche, overrides manuels).
const fmtDT = (iso) => {
  const base = fmt(iso);
  if (!base) return "";
  const t = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!t) return base;                    // date seule
  return (+t[1] || +t[2]) ? `${base} · ${t[1]}h${t[2]}` : base;   // minuit = pas d'heure
};
const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24); if (j < 30) return `il y a ${j} j`;
  return fmt(iso);
};

const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

const hashStr = (s) => { let h = 0; const str = s || ""; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };

function Avatar({ name, n, src, size = 30, round = false }) {
  const c = AVATAR_COLORS[(n != null ? n : hashStr(name)) % AVATAR_COLORS.length];
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  // Lettre de couleur sur fond pâle (dev 28/10/2026, « meilleur tableau ») : la couleur repère sans crier.
  return <div style={{ width: size, height: size, borderRadius: round ? "50%" : Math.round(size * 0.32), background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}24`, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.43), fontWeight: 500, flexShrink: 0 }}>{letter}</div>;
}

// ── Icônes de statut (dev 28/10/2026 : « meilleur état en svg ») ─────────────────
// Une seule famille, dessinée sur 16 px : le cercle dit où en est le client. Pointillé = pas commencé,
// demi = en attente, trois quarts = sortie en cours, plein avec coche = signé, plein avec glyphe = sorti.
const ETAT_ICON = {
  "Signé": "done",
  "Attente Opti'Lex": "half",
  "En cours": "half",
  "En cours de résiliation": "three",
  "En cours de rétractation": "three",
  "En cours de liquidation": "three",
  "Résiliation": "cross",
  "Self-Résiliation": "outcross",
  "Rétractation": "back",
  "Liquidation": "minus",
  "Pause": "pause",
  "Renouvellement client": "renew",
  "Inactifs": "clock",
  "En attente": "dashed",
  "Sans suite": "dashslash",
};
const FILLED_GLYPHS = new Set(["done", "cross", "back", "minus"]);
export function StatusGlyph({ kind, color, size = 14 }) {
  const ring = <circle cx="8" cy="8" r="6.25" fill="none" stroke={color} strokeWidth="1.5" />;
  const ink = { fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const white = { fill: "none", stroke: "#fff", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const disc = <circle cx="8" cy="8" r="7" fill={color} />;
  const glyphs = {
    done: <>{disc}<path d="M5 8.3 7.1 10.3 11 6.2" {...white} /></>,
    cross: <>{disc}<path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" {...white} /></>,
    back: <>{disc}<path d="M6.9 5.1 5 7l1.9 1.9M5.2 7h4a2.1 2.1 0 0 1 0 4.2H7.8" {...white} strokeWidth="1.4" /></>,
    minus: <>{disc}<path d="M5.2 8h5.6" {...white} /></>,
    half: <>{ring}<path d="M8 8V3.6a4.4 4.4 0 0 1 0 8.8Z" fill={color} /></>,
    three: <>{ring}<path d="M8 8V3.6a4.4 4.4 0 1 1-4.4 4.4Z" fill={color} /></>,
    outcross: <>{ring}<path d="M6 6l4 4M10 6l-4 4" {...ink} /></>,
    pause: <>{ring}<path d="M6.6 5.9v4.2M9.4 5.9v4.2" {...ink} /></>,
    clock: <>{ring}<path d="M8 5.1V8l1.9 1.3" {...ink} /></>,
    renew: <path d="M12.5 8a4.5 4.5 0 1 1-1.32-3.18M11.3 2.7l-.1 2.1 2.1.2" {...ink} />,
    dashslash: <><circle cx="8" cy="8" r="6.25" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2.2 1.73" /><path d="M5.4 10.6l5.2-5.2" {...ink} /></>,
    dashed: <circle cx="8" cy="8" r="6.25" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2.2 1.73" />,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>{glyphs[kind] || glyphs.dashed}</svg>;
}
// Icône d'un état du board : glyphe plein dans la teinte du texte, contour dans la teinte vive.
export function EtatIcon({ etat, size = 14 }) {
  const s = ETAT_STYLE[etat];
  const kind = ETAT_ICON[etat] || "dashed";
  const color = !s ? "#c9c4bc" : FILLED_GLYPHS.has(kind) ? s.fg : s.dot;
  return <StatusGlyph kind={kind} color={color} size={size} />;
}

// `withIcon` : pastille à icône SVG du board (Signé, en cours, sorti…) ; sans, l'ancien point de couleur,
// que la page Finance réutilise telle quelle. `pop` change à chaque nouvel état : l'icône rebondit une fois.
export function EtatBadge({ etat, withIcon = false, pop = 0 }) {
  const s = ETAT_STYLE[etat] || { bg: "#f1eee9", fg: "#4a4540", dot: "#c9c4bc", bd: "#e3ded6" };
  if (withIcon) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px 3px 6px", borderRadius: 7, background: s.bg, border: `1px solid ${s.bd || "transparent"}`, color: s.fg, fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap" }}>
        <span key={pop} className={`ob-etat-ic${pop ? " is-pop" : ""}`}><EtatIcon etat={etat} /></span>
        {etat || "—"}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 9px", borderRadius: 7, background: s.bg, border: `1px solid ${s.bd || "transparent"}`, color: s.fg, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />{etat || "—"}
    </span>
  );
}

// Badge d'état CLIQUABLE : menu pour changer l'état (override cabinet). Read-only si disabled.
// Menu en PORTAL (échappe l'overflow de la table) + fontFamily Inter réappliquée. "Automatique
// (Sheet)" -> onPick(null) efface l'override. Se ferme au scroll/resize ; flip vers le haut.
const ETAT_MENU_H = 360;
function EtatPicker({ etat, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  // Pose en cours : l'état affiché vient du serveur, le badge garde donc l'état confirmé,
  // estompé, jusqu'à sa réponse (pas d'état deviné, pas de double pose).
  const [saving, setSaving] = useState(false);
  // Rebond de l'icône quand l'état change (pas au premier affichage : 700 lignes rebondiraient d'un coup).
  const [pop, setPop] = useState(0);
  const shownEtat = useRef(etat);
  useEffect(() => {
    if (shownEtat.current === etat) return;
    shownEtat.current = etat;
    setPop((n) => n + 1);
  }, [etat]);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  if (disabled) return <EtatBadge etat={etat} withIcon />;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + ETAT_MENU_H > window.innerHeight && r.top > ETAT_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  const pick = (opt) => {
    const pending = onPick(opt);
    if (!pending?.then) return;
    const done = () => setSaving(false);
    setSaving(true);
    pending.then(done, done);
  };
  // "Automatique" = état calculé (suivi cabinet / signatures), efface l'override manuel.
  const items = [...(isFinanceTeam() ? [] : [{ opt: null, label: "Automatique" }]), ...etatOptionsForUser().map((o) => ({ opt: o, label: o }))];
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Changer l'état" disabled={saving} aria-busy={saving || undefined}
        className="ob-etat" style={{ border: "none", background: "transparent", padding: 0, cursor: saving ? "progress" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, opacity: saving ? 0.5 : 1, transition: "opacity 0.2s ease" }}>
        <EtatBadge etat={etat} withIcon pop={pop} />
        {/* Caret d'affordance : le badge est cliquable ; pivote quand le menu est ouvert. */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04)", padding: 5, minWidth: 210, maxHeight: ETAT_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            {items.map(({ opt, label }) => {
              const sel = opt === etat;
              return (
                <button key={label} type="button" onClick={() => { setOpen(false); if (!sel) pick(opt); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none",
                    background: sel ? "#f7f5f2" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 500, color: opt ? TEXT : MUTED, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f7f5f2"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  {opt ? <EtatIcon etat={opt} size={13} /> : <StatusGlyph kind="dashed" color={MUTED} size={13} />}
                  {label}
                  {sel && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0 }}>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

// Badge météo : la tuile colorée (1-2 rouge / 3 orange / 4-5 vert), puis le libellé sur une ligne et la note
// dessous en petit, alignés à gauche comme la colonne Client (dev 28/10/2026 : « meilleur agencement »).
// `inline` : libellé et note sur une ligne (« Satisfait · 5/5 »), pour la ligne Météo des propriétés de la fiche.
function MeteoBadge({ score, context, showLabel = true, inline = false }) {
  const s = weatherPresentation(score, context);
  if (!s) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#c9c4bc", fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap" }}>
      <span className="ob-meteo-tile" style={{ width: 26, height: 26, borderRadius: 8, border: "1.5px dashed #d8d3cb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#d8d3cb", flexShrink: 0, boxSizing: "border-box" }}>?</span>
      {showLabel && "À noter"}
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, textAlign: "left" }}>
      <span className="ob-meteo-tile" style={{ width: 26, height: 26, borderRadius: 8, background: s.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MeteoIcon score={score} size={16} color={s.color} />
      </span>
      {showLabel && inline && (
        <span style={{ fontSize: 13, fontWeight: 500, color: s.color, whiteSpace: "nowrap" }}
          title={s.legacy ? `Note posée sur l'ancienne échelle : ${score}/5` : undefined}>
          {s.label}<span style={{ fontWeight: 500, color: MUTED }}> · {score}/5{s.legacy ? " (ancienne)" : ""}</span>
        </span>
      )}
      {showLabel && !inline && (
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: MUTED, marginTop: 2, whiteSpace: "nowrap" }}
            title={s.legacy ? `Note posée sur l'ancienne échelle : ${score}/5` : undefined}>
            {s.legacy ? `${score}/5 · ancienne` : `${score}/5`}
          </span>
        </span>
      )}
    </span>
  );
}

// Sélecteur météo CLIQUABLE : popup (portal) avec les 5 notes (sens + action) + une note
// d'interaction. onSave(score, note). Read-only si disabled (badge seul).
// Ouverture (dev 28/10/2026) : la fenêtre naît de la tuile cliquée et s'installe au centre sur un ressort,
// puis son contenu arrive en cascade (titre, les 5 tuiles, icônes qui éclosent) ; à la fermeture elle
// repart vers la tuile. Police posée sur la fenêtre : rendue dans document.body, elle héritait sinon
// de la police par défaut du navigateur (titre à empattements).
const METEO_DIALOG_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
// `readOnly` (rôles en lecture seule) : badge affiché comme valeur ; le bouton « Ajouter une météo » désactivé.
function MeteoPicker({ score, context, onSave, disabled, triggerLabel, inline = false, readOnly = false }) {
  const [open,setOpen]=useState(false);
  const [from,setFrom]=useState({x:0,y:0});
  const reduce=useReducedMotion();
  const button=useRef(null);
  const dialog=useRef(null);
  const close=()=>{setOpen(false);button.current?.focus();};
  const openFromTrigger=()=>{const r=button.current?.getBoundingClientRect();
    if(r)setFrom({x:r.left+r.width/2-window.innerWidth/2,y:r.top+r.height/2-window.innerHeight/2});setOpen(true);};
  useEffect(()=>{if(!open)return; dialog.current?.querySelector('button')?.focus();
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();close();}
      if(e.key==='Tab'){const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),textarea,input,summary')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;};},[open]);
  const enter=reduce?{opacity:0}:{opacity:0,x:from.x*0.6,y:from.y*0.6,scale:0.72};
  const leave=reduce?{opacity:0,transition:{duration:0.12}}:{opacity:0,x:from.x*0.3,y:from.y*0.3,scale:0.9,transition:{duration:0.18,ease:[0.4,0,1,1]}};
  const ro = !readOnly ? {} : triggerLabel ? READ_ONLY_PROPS : { disabled: true, title: READ_ONLY_TITLE };
  return <span onClick={e=>e.stopPropagation()}><button ref={button} type="button" disabled={disabled} onClick={openFromTrigger} aria-label={triggerLabel || "Mettre à jour la météo"} className={triggerLabel ? "wc-add-weather" : "ob-meteo"} style={triggerLabel ? undefined : {border:0,background:'transparent',padding:0,textAlign:'left',font:'inherit',cursor:disabled||readOnly?'default':'pointer'}} {...ro}>{triggerLabel ? <><MeteoIcon score={5} size={18}/>{triggerLabel}</> : <MeteoBadge score={score} context={context} inline={inline}/>}</button>
    {createPortal(<AnimatePresence>{open && <motion.div key="meteo-overlay" role="presentation" initial={{opacity:0}} animate={{opacity:1,transition:{duration:0.22,ease:'easeOut'}}} exit={{opacity:0,transition:{duration:0.2,ease:'easeIn'}}}
      style={{position:'fixed',inset:0,zIndex:10050,background:'rgba(28,27,25,.22)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)',display:'grid',placeItems:'center',padding:16}} onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Mettre à jour la météo client" className="ob-meteo-dialog"
        initial={enter} animate={{opacity:1,x:0,y:0,scale:1,transition:reduce?{duration:0.15}:{type:'spring',stiffness:420,damping:34,mass:0.9,opacity:{duration:0.16}}}} exit={leave}
        style={{width:'min(580px,100%)',maxHeight:'90vh',overflowY:'auto',background:'white',borderRadius: 22,padding:'26px 26px 22px',boxShadow:'0 24px 70px rgba(28,27,25,.14), 0 2px 6px rgba(43,41,39,.042)',fontFamily:METEO_DIALOG_FONT}}>
        <WeatherCaseComposer onSave={async payload=>{const ok=await onSave(payload);if(ok!==false)close();return ok;}} onCancel={close}/>
      </motion.div>
    </motion.div>}</AnimatePresence>,document.body)}
  </span>;
}

function FunnelIcon({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

// Filtre multi-sélection (catégories secondaires). Menu en PORTAL (échappe l'overflow),
// fontFamily Inter réappliquée, se ferme au scroll/resize, flip vers le haut si besoin.
// Cocher/décocher plusieurs états -> union affichée dans la table.
const FILTER_MENU_H = 380;
function FilterMenu({ label = "Filtre", cats, counts, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    // Fermer quand la PAGE scrolle (le menu portalisé se détacherait du bouton),
    // mais PAS quand on scrolle DANS le menu : avec 13 états le panneau dépasse
    // sa hauteur max, et l'écouteur en phase capture attrapait aussi le scroll
    // interne -> le menu se fermait dès qu'on essayait de le faire défiler.
    const close = (e) => {
      // Un redimensionnement vise la fenêtre, qui n'est pas un nœud : contains() lèverait une erreur.
      if (e && e.target instanceof Node && menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  const active = selected.length > 0;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + FILTER_MENU_H > window.innerHeight && r.top > FILTER_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Filtrer par état"
        className={`ob-trigger${active ? " is-on" : ""}${open ? " is-open" : ""}`}>
        <FunnelIcon color={active ? "#fff" : MUTED} />
        {label}
        {active && <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{selected.length}</span>}
        <svg className="ob-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div ref={menuRef} style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04)", padding: 5, minWidth: 236, maxHeight: FILTER_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Filtrer par état</span>
              {active && <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: "#55514b", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tout effacer</button>}
            </div>
            {cats.map((cat) => {
              const on = selected.includes(cat);
              const n = counts[cat] || 0;
              return (
                <button key={cat} type="button" onClick={() => onToggle(cat)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", background: on ? "#f7f5f2" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: TEXT, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f7f5f2"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? CHARCOAL : "#d8d3cb"}`, background: on ? CHARCOAL : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s, border-color 0.14s" }}>
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <EtatIcon etat={cat} size={13} />
                  <span style={{ flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{n}</span>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

// Filtre par date de signature Owner : un mois (raccourci) OU une période du/au.
// Même mécanique de popup portalisé que FilterMenu (ferme au scroll/resize, flip haut).
const SIG_MENU_H = 300;
// Menu générique à cases (même mécanique portalisée que FilterMenu : ferme au
// scroll/resize, flip vers le haut près du bord). Sert les familles « Onboarding »
// et « Programmes » (demande dev 2026-09-03 : moins de gros blocs dans la barre).
// Multi-sélection = UNION au sein du menu. `items` : [{ key, label, icon, count }].
function ChecklistMenu({ label, title, icon, items, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  const active = selected.length > 0;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + 240 > window.innerHeight && r.top > 240;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title={title}
        className={`ob-trigger${active ? " is-on" : ""}${open ? " is-open" : ""}`}>
        {icon(active ? "#fff" : MUTED)}
        {label}
        {active && <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{selected.length}</span>}
        <svg className="ob-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04)", padding: 5, minWidth: 236, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</span>
              {active && <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: "#55514b", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tout effacer</button>}
            </div>
            {items.map((it) => {
              const on = selected.includes(it.key);
              return (
                <button key={it.key} type="button" onClick={() => onToggle(it.key)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", background: on ? "#f7f5f2" : "transparent", borderRadius: 7, padding: it.sub ? "6px 10px 6px 34px" : "8px 10px", cursor: "pointer", fontSize: it.sub ? 12 : 12.5, fontWeight: it.sub ? 500 : 500, color: it.sub ? MUTED : TEXT, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f7f5f2"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? CHARCOAL : "#d8d3cb"}`, background: on ? CHARCOAL : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s, border-color 0.14s" }}>
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  {it.icon}
                  <span style={{ flex: 1 }}>
                    {it.label}
                    {it.hint && <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, color: MUTED }}>{it.hint}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{it.count}</span>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

function SigDateFilter({ from, to, onChange, months = [], target = "signature", onTarget }) {
  const isOnb = target === "onboarding";
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  const active = !!(from || to);
  const label = sigRangeLabel(from, to);
  const monthValue = (from && to && (() => { const r = monthToRange(from.slice(0, 7)); return from === r.from && to === r.to; })()) ? from.slice(0, 7) : "";
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + SIG_MENU_H > window.innerHeight && r.top > SIG_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  const fieldStyle = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%" };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle}
        title={isOnb ? "Filtrer par date d'onboarding Owner" : "Filtrer par date de signature Owner"}
        className={`ob-trigger${active ? " is-on" : ""}${open ? " is-open" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {active ? `${isOnb ? "Onboarding" : "Signature"} · ${label}` : (isOnb ? "Date onboarding" : "Date signature")}
        <svg className="ob-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04)", padding: 12, width: 250, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{isOnb ? "Onboarding entre" : "Signé le"}</span>
              {active && <button type="button" onClick={() => onChange({ from: "", to: "" })} style={{ border: "none", background: "transparent", color: "#55514b", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Effacer</button>}
            </div>
            {/* Cible du filtre : période de SIGNATURE (défaut) ou d'ONBOARDING. */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10, padding: 3, background: "#f7f5f2", borderRadius: 8 }}>
              {[["signature", "Signature"], ["onboarding", "Onboarding"]].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => onTarget?.(val)}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 11.5, fontWeight: 500, transition: "background 0.15s, color 0.15s",
                    background: target === val ? CARD : "transparent", color: target === val ? NAVY : MUTED,
                    boxShadow: target === val ? "0 1px 2px rgba(43,41,39,.07)" : "none" }}>
                  {lbl}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Mois</label>
            <select value={monthValue} onChange={(e) => onChange(e.target.value ? monthToRange(e.target.value) : { from: "", to: "" })}
              style={{ ...fieldStyle, marginBottom: 12, cursor: "pointer", appearance: "auto" }}>
              <option value="">Tous les mois</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 10px" }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>ou période</span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>
            <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Du</label>
            <input type="date" value={from || ""} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} style={{ ...fieldStyle, marginBottom: 10 }} />
            <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Au</label>
            <input type="date" value={to || ""} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} style={fieldStyle} />
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

// Petit crayon = modification.
function PencilIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Icônes de section du panneau détail (style lucide : trait 2, sobres, cohérentes).
const SEC_ICONS = {
  infos: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  etat: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
  histo: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  contrats: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  signature: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  rdv: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  facturation: <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
  emails: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  meteo: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  ambassador: <><path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
};
// Titre de section du panneau : icône + libellé (remplace les titres nus).
// Titre de bloc de la fiche : phrase simple, plus de capitales espacées (dev 29/10/2026, fiche plus claire).
// `hint` : une phrase d'aide sous le titre, comme les blocs de la fiche Finance.
function SecTitle({ icon, children, style, hint }) {
  const title = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, color: NAVY, letterSpacing: "-.005em", marginBottom: 10, ...(hint ? { marginBottom: 0 } : style) }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a8a39b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{SEC_ICONS[icon]}</svg>
      {children}
    </div>
  );
  if (!hint) return title;
  return <div style={{ minWidth: 0, marginBottom: 12, ...style }}>{title}<p className="ob-sec-hint">{hint}</p></div>;
}

// Sous-titre de la barre « Convention Opti'Lex » : quand elle est partie, depuis combien de temps, ou quand elle partira.
function conventionSub(row) {
  const sent = row.optilex_sent_at;
  const days = sent ? Math.floor((Date.now() - new Date(sent).getTime()) / 86400000) : null;
  const day = (iso) => fmt(iso).slice(0, 5);
  if (row.optilex_status === "expired") return sent ? `Envoyée le ${day(sent)}, pas signée à temps` : "Pas signée à temps";
  if (row.optilex_status === "ongoing") return sent ? `Envoyée le ${day(sent)}${days > 0 ? `, il y a ${days} j` : ""}` : "En attente de signature";
  return row.optilex_scheduled_at ? `Envoi prévu le ${day(row.optilex_scheduled_at)}` : "Envoi planifié";
}

// Statut de signature riche : signé / envoyé (en attente) / planifié / expiré…
function sigInfo(status, sentAt, signedAt, scheduledAt) {
  if (status === "done") return { label: "Signé", sub: fmt(signedAt), color: GREEN, kind: "done" };
  // Pas de contrat lié mais une date de signature (fiche client interne, remplie à la
  // déclaration de vente) : le client est signé, on l'affiche au lieu d'un "—" trompeur.
  if (!status && signedAt) return { label: "Signé", sub: fmt(signedAt), color: GREEN, kind: "done" };
  if (status === "ongoing") return { label: "Envoyé", sub: fmt(sentAt) + " · en attente", color: "#c2500e", kind: "half" };
  if (status === "scheduled") return { label: "Planifié", sub: fmt(scheduledAt), color: "#6b665f", kind: "dashed" };
  if (status === "expired") return { label: "Expiré", sub: "", color: "#c5221f", kind: "cross" };
  if (status === "canceled") return { label: "Annulé", sub: "", color: "#c5221f", kind: "cross" };
  if (status === "failed") return { label: "Échec", sub: "", color: "#c5221f", kind: "cross" };
  return null;
}
function SigCell({ status, sentAt, signedAt, scheduledAt, grouped }) {
  const i = sigInfo(status, sentAt, signedAt, scheduledAt);
  // Contrat groupé (pas de volet Opti'Lex séparé) : Opti'Lex est inclus dans l'Owner signé.
  if (!i && grouped) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.25 }}>
        <span style={{ marginTop: 1 }}><StatusGlyph kind="done" color={GREEN} /></span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: GREEN }}>Inclus</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>au contrat Owner</div>
        </div>
      </div>
    );
  }
  if (!i) return <span style={{ color: "#d8d3cb" }}>—</span>;
  // Expirée : pastille corail et sablier qui se secoue à l'apparition, pour la repérer d'un coup d'œil (29/10/2026).
  if (status === "expired") {
    return (
      <div style={{ lineHeight: 1.25 }}>
        <span className="ob-exp"><ConventionGlyph status="expired" size={13} />Expiré</span>
        {sentAt && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>envoyé le {fmt(sentAt)}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.25 }}>
      <span style={{ marginTop: 1 }}><StatusGlyph kind={i.kind} color={i.color} /></span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: i.color }}>{i.label}</div>
        {i.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{i.sub}</div>}
      </div>
    </div>
  );
}

// Ligne du tableau, mémorisée (dev 28/10/2026) : elle ne se redessine que si SES données changent (client,
// sélection, no show, entrée animée). Avant, tout rendu de la page redessinait les 700 à 900 lignes
// (400 à 550 ms à chaque onglet, chaque sélection) ; les rappels reçus sont stables (useCallback, setState).
const BoardRow = memo(function BoardRow({ r, rk, isSel, newIdx, noShow, renewal, onSelect, patch, changeEtat, recordMeteo, readOnly = false }) {
  const td = ROW_TD;
  return (
    <tr onClick={() => onSelect(rk)} className={`ob-row${isSel ? " is-sel" : ""}`}
      style={newIdx !== undefined ? { animation: "obRowIn 0.28s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${Math.min(newIdx, 14) * 20}ms` } : undefined}>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={primaryName(r)} n={r.sheet_num} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={primaryName(r)}>{primaryName(r)}</div>
              {r.rdv_onboarding_done && <span className="ob-pass is-icon" title={passTitle(r)}><OnboardedPass size={16} /></span>}
              {isInactif(r) && (
                <span title="Aucune mission suivie par le cabinet depuis 60 jours"
                  style={{ flexShrink: 0, fontSize: 10, fontWeight: 500, color: "#c2500e", background: "#fde9da", padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                  Inactif{r.days_since_last_mission != null ? ` · ${r.days_since_last_mission} j` : ""}
                </span>
              )}
              {renewal && (() => {
                const days = anniversaryDaysLeft(r);
                if (days == null) return null;
                const tone = days <= 30 ? { fg: "#c5221f", bg: "#fde6e6", dot: "#e0504c" }
                  : days <= 90 ? { fg: "#c2500e", bg: "#fde9da", dot: "#e08a2e" }
                  : { fg: "#4a3fc4", bg: "#eae9fb", dot: "#6c62d8" };
                return (
                  <span title={`Anniversaire du contrat dans ${days} jour${days > 1 ? "s" : ""}`}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: tone.fg, background: tone.bg, padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="9" stroke={tone.dot} strokeWidth="2.4" />
                      <path d="M12 7.5V12l3 2" stroke={tone.dot} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    J-{days}
                  </span>
                );
              })()}
            </div>
            <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowSubtitle(r) || "en cours d'envoi"}</div>
          </div>
        </div>
      </td>
      <td style={{ ...td, color: r.secteur_activite ? TEXT : "#d8d3cb" }}>
        {r.secteur_activite ? (
          <div className="ob-sector" title={`Secteur d'activité : ${secteurLabel(r.secteur_activite)}`}>
            <SectorIcon secteur={r.secteur_activite} size={20} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secteurLabel(r.secteur_activite)}</span>
          </div>
        ) : <span title="Secteur non renseigné">—</span>}
      </td>
      <td style={{ ...td, whiteSpace: "normal" }}>
        <MeteoPicker score={r.meteo_score} context={r.meteo_context} disabled={!r.numero_client} readOnly={readOnly}
          onSave={payload => recordMeteo(r.numero_client, payload)} />
      </td>
      {/* État daté (Résiliation, Pause…) posé depuis la table -> on ouvre la fiche
          pour saisir la date dans la foulée. + rappel sous le badge si la pause est
          échue ou si la date d'effet manque. */}
      <td style={td}>
        <EtatPicker etat={displayEtat(r)} disabled={!r.numero_client || readOnly}
          onPick={(v) => { const saving = changeEtat(r.numero_client, { etat: v }); if (ETAT_DATE_CONFIG[v]) onSelect(rk); return saving; }} />
        {isEtatPending(r) && r.etat_date && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 500, color: "#c2500e", marginTop: 5, lineHeight: 1.3 }}
            title={`${r.etat_manuel} prévue le ${fmt(r.etat_date)} — pas encore effective, le client reste actif jusqu'à cette date`}>
            <StatusGlyph kind="clock" color="#c2500e" size={11} />{r.etat_manuel} · prévu {fmt(r.etat_date)}
          </div>
        )}
        {(() => {
          const h = etatHint(r);
          return h ? (
            <div style={{ fontSize: 10.5, fontWeight: 500, color: h.urgent ? "#c2500e" : "#a8a39b", marginTop: 3 }}>{h.text}</div>
          ) : null;
        })()}
      </td>
      <td style={td}><SigCell status={r.owner_status} sentAt={r.owner_sent_at} signedAt={r.owner_signed_at} /></td>
      {/* Colonne Intégration retirée (dev 28/10/2026) : ses deux alertes passent sous le contrat Opti'Lex. */}
      <td style={td}>
        <SigCell status={r.optilex_status} sentAt={r.optilex_sent_at} signedAt={r.optilex_signed_at} scheduledAt={r.optilex_scheduled_at} grouped={r.owner_status === "done" && r.optilex_status == null} />
        {/* « À venir » englobe le retard (non effectué) : un seul badge, le retard d'abord ; le contrat non signé se lit déjà au-dessus. */}
        {isIntegrationOverdue(r) ? <div><IntegrationOverdueBadge /></div> : integrationAlert(r) && <div><OptilexAlertBadge /></div>}
      </td>
      <td style={td}>
        <TableDateEdit value={r.rdv_onboarding_date_manual || r.rdv_onboarding_date}
          disabled={!r.numero_client || isFinanceTeam() || readOnly}
          onSave={(d) => patch(r.numero_client, { rdv_onboarding_date_manual: d })} />
        {r.rdv_onboarding_done && r.rdv_onboarding_done_date && (
          <div title="Onboarding réalisé saisi à la main (ancien client)" style={{ marginTop: 3, fontSize: 10.5, fontWeight: 500, color: GREEN }}>
            Réalisé le {fmtDT(r.rdv_onboarding_done_date)}
          </div>
        )}
        {(() => {
          // Pastilles sous la date, pas sur sa ligne (elles débordaient sur la colonne voisine).
          const recaler = r.onboarding_reschedule_pending && !r.rdv_onboarding_done;
          const toConfirm = !!r.onboarding_to_confirm;
          return (noShow || recaler || toConfirm) ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
              {toConfirm && (
                <div title="Onboarding à confirmer : en attente de qualification par le Client Success (fiche du client)" style={{ display: "inline-block", padding: "2px 7px", borderRadius: 999, background: "#eae9fb", color: "#4a3fc4", fontSize: 10.5, fontWeight: 500 }}>À confirmer</div>
              )}
              {noShow && <OnboardingNoShowBadge date={r.rdv_onboarding_date_manual || r.rdv_onboarding_date} />}
              {recaler && (
                <div title={r.onboarding_reschedule_note || "Onboarding à recaler, sans date"} style={{ display: "inline-block", padding: "2px 7px", borderRadius: 999, background: "#fde9da", color: "#c2500e", fontSize: 10.5, fontWeight: 500 }}>À recaler</div>
              )}
            </div>
          ) : null;
        })()}
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        <span className="ob-chev">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </td>
    </tr>
  );
});

export default function OptilexBoard({ embed = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Lu une fois : passé aux lignes du tableau (des centaines) plutôt que relu ligne par ligne.
  const [readOnly] = useState(isBoardReadOnly);
  const requestedClient = searchParams.get('client');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etatFilter, setEtatFilter] = useState("Signé");   // onglet primaire actif (défaut Signé, décision dev 2026-08-25)
  const [multiFilter, setMultiFilter] = useState([]);      // catégories secondaires cochées (union)
  const [sigRange, setSigRange] = useState({ from: "", to: "" });
  // Cible du filtre de dates : "signature" (défaut) ou "onboarding" — choix
  // explicite dans le menu, jamais déduit des vignettes actives.
  const [dateTarget, setDateTarget] = useState("signature"); // filtre date signature Owner
  const [meteoFilter, setMeteoFilter] = useState([]);      // bandes météo cochées (rouge/orange/vert)
  // Familles regroupées en menus (demande dev 2026-09-03, barre trop chargée) :
  // multi-sélection = UNION au sein du menu, la famille reste en ET avec le reste.
  const [programmeSel, setProgrammeSel] = useState([]);    // 'ambassadeur' | 'parrainage'
  const [onboardingSel, setOnboardingSel] = useState([]);  // 'venir' | 'done' | 'confirm' | 'todo' | 'noshow' | 'recaler'
  const [sortCol, setSortCol] = useState(null);   // tri manuel par en-tête : null | owner_signed | onboarding
  // Largeur disponible du tableau -> part égale du surplus pour chaque colonne (cf. TABLE_COLS).
  const tableWrapRef = useRef(null);
  const [tableW, setTableW] = useState(0);
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setTableW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const colExtra = Math.max(0, Math.floor((tableW - TABLE_MIN_W) / TABLE_COLS.length));
  const [sortDir, setSortDir] = useState("asc");  // asc | desc
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // numero_client du client ouvert
  useEffect(() => {
    if (!requestedClient) return;
    const row = rows.find(r => r.numero_client === requestedClient);
    if (row) setSelected(row.row_key || row.numero_client);
  }, [requestedClient, rows]);
  const closeDetail = () => {
    setSelected(null);
    if (requestedClient) {
      const next = new URLSearchParams(searchParams);
      next.delete('client');
      setSearchParams(next, { replace: true });
    }
  };

  // Anti-stale : toute mutation locale incrémente mutSeq ; une réponse de polling partie AVANT
  // la mutation est jetée (sinon elle écraserait l'optimiste avec une photo périmée de la base).
  const mutSeq = useRef(0);
  // Feedback d'échec d'enregistrement (bandeau discret, auto-dismiss).
  const [saveError, setSaveError] = useState("");
  const errTimer = useRef(null);
  const flagSaveError = useCallback((error) => {
    const detail = error?.data?.detail;
    const message = error?.status >= 400 && error.status < 500 && typeof detail === "string"
      ? detail
      : error?.status === 422
        ? "Certaines informations sont invalides. Vérifiez les champs renseignés et les dates avant de réessayer."
        : error?.status >= 500
          ? "Le serveur n’a pas pu enregistrer la modification. Réessayez dans quelques instants ou contactez le support."
          : "Enregistrement non confirmé. Vérifiez votre connexion, actualisez la fiche puis réessayez.";
    setSaveError(message);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setSaveError(""), 15000);
  }, []);
  useEffect(() => () => clearTimeout(errTimer.current), []);

  useEffect(() => {
    let alive = true;
    const load = (spinner) => {
      if (spinner) setLoading(true);
      const seq = mutSeq.current;
      apiClient.get("/api/v1/optilex/board")
        .then((r) => { if (alive && seq === mutSeq.current) setRows(r.clients || []); })
        .catch((e) => console.error("board load failed", e))
        .finally(() => { if (alive && spinner) setLoading(false); });
    };
    load(true);
    const id = setInterval(() => load(false), 30000);   // temps réel : refetch toutes les 30 s
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Rechargement manuel du board (ex. apres un envoi force) -- additif, ne touche pas le polling.
  const reloadBoard = useCallback(() => {
    const seq = mutSeq.current;
    apiClient.get("/api/v1/optilex/board")
      .then((r) => { if (seq === mutSeq.current) setRows(r.clients || []); })
      .catch((e) => console.error("board reload failed", e));
  }, []);

  const counts = useMemo(() => {
    const c = { "En cours": 0, "Attente Opti'Lex": 0 };
    for (const r of rows) {
      const e = displayEtat(r);   // état effectif (override / Sheet / signé interne / attente / en cours)
      if (e) c[e] = (c[e] || 0) + 1;
      if (e !== "Signé" && matchesSignedClient(r, e)) c["Signé"] = (c["Signé"] || 0) + 1;
      if (isOnboardingUpcoming(r)) c["Onboarding à venir"] = (c["Onboarding à venir"] || 0) + 1;
      if (isInactif(r)) c["Inactifs"] = (c["Inactifs"] || 0) + 1;
      if (isUnpaid(r)) c["Impayés"] = (c["Impayés"] || 0) + 1;
      if (isRenewalUpcoming(r)) c["Renouvellement client"] = (c["Renouvellement client"] || 0) + 1;
    }
    return c;
  }, [rows]);
  const establishedCount = useMemo(() => rows.filter((r) => !r.is_pending_contract).length, [rows]);
  // Changer d'onglet réinitialise le tri manuel -> on retombe sur le défaut intelligent de l'onglet.
  useEffect(() => { setSortCol(null); }, [etatFilter]);

  // Filtres de la vue SAUF la météo, et situation d'onboarding de chaque ligne. `withOnboarding`
  // à false : même vue sans le menu Onboarding, socle de ses compteurs.
  const viewFilter = useMemo(() => {
    const ql = q.trim().toLowerCase();
    // Sélection multiple : les ÉTATS se combinent en OU, les CRITÈRES en ET.
    const activeCats = [...new Set(etatFilter !== "Tous" ? [etatFilter, ...multiFilter] : multiFilter)];
    const etatsSel = activeCats.filter((c) => !CRITERIA_CATS.includes(c));
    const critsSel = activeCats.filter((c) => CRITERIA_CATS.includes(c));
    const today = _todayParisISO();
    // Réalisé / à venir / à faire : une seule case par client (Vincent 30/09 : leur cumul dépassait
    // le nombre de clients signés). Les clients partis (résiliés / rétractés / liquidés) n'entrent
    // dans aucune case… SAUF si leur état est explicitement sélectionné : Vincent croise
    // résiliés/rétractés × « à faire » pour tenter de les récupérer via la plateforme (retour dev
    // 2026-08-28). Un client parti qui arrive ici avec une sélection d'états active a forcément été
    // demandé (il a passé le filtre d'états).
    const situationOf = (r) => onboardingSituation(r, today, {
      exited: isOutOfOnboarding(displayEtat(r)), includeExited: etatsSel.length > 0,
    });
    const passes = (r, withOnboarding = true) => {
      // « Tous » regroupe les clients actuels et anciens, pas les prospects.
      // Le statut du contrat ne suffit pas : un client peut avoir un contrat expiré.
      if (activeCats.length === 0 && r.is_pending_contract) return false;
      if (etatsSel.length > 0 && !etatsSel.some((cat) => matchesCat(r, cat))) return false;
      if (critsSel.length > 0 && !critsSel.every((cat) => matchesCat(r, cat))) return false;
      // Menu « Programmes » : UNION des programmes cochés (ambassadeur / parrainage / témoignage).
      if (programmeSel.length > 0) {
        const inProgramme = (programmeSel.includes("ambassadeur") && r.ambassador_eligible)
          || (programmeSel.includes("parrainage") && r.parrainage_eligible)
          || (programmeSel.includes("temoignage") && r.temoignage_eligible);
        if (!inProgramme) return false;
      }
      // Menu « Onboarding » : UNION des situations cochées, qui sont EXCLUSIVES (voir situationOf).
      if (withOnboarding && onboardingSel.length > 0) {
        const situation = situationOf(r);
        const recaler = isOnboardingToReschedule(r, situation);
        if (!onboardingSel.includes(situation) && !(onboardingSel.includes("recaler") && recaler)) return false;
      }
      // Filtre date de signature Owner (mois ou période). Une ligne sans date de
      // signature est exclue dès qu'un filtre date est actif.
      if (sigRange.from || sigRange.to) {
        // Cible « Onboarding » (choisie dans le menu) -> la plage porte sur la date d'onboarding,
        // sinon sur la date de signature Owner (comportement historique).
        const d = dateTarget === "onboarding" ? onboardingDateOf(r) : sigDateOf(r);
        if (!d) return false;
        if (sigRange.from && d < sigRange.from) return false;
        if (sigRange.to && d > sigRange.to) return false;
      }
      if (ql) {
        const hay = `${ov(r, "contact_name_ovr", "contact_name") || ""} ${r.crm_societe || ""} ${r.societe_sheet || ""} ${r.numero_client || ""} ${ov(r, "email_ovr", "email") || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    };
    return { passes, situationOf };
  }, [etatFilter, multiFilter, sigRange, dateTarget, q, programmeSel, onboardingSel]);

  // Base : toutes les lignes passant les filtres SAUF la météo. Sert de socle à la vue finale
  // ET aux compteurs par bande (qui restent stables quand on coche/décoche une bande météo).
  const preMeteoRows = useMemo(() => rows.filter((r) => viewFilter.passes(r)), [rows, viewFilter]);

  // Compteurs du menu Onboarding : sur la vue affichée (onglet, filtres, météo) hors ce menu.
  // « À venir + réalisé + à faire + no show » = clients comptés (`total`, affiché dans le menu) ;
  // « à recaler » est un sous-ensemble de « à faire » et du no show.
  const onboardingCounts = useMemo(() => {
    const c = { venir: 0, done: 0, confirm: 0, todo: 0, noshow: 0, recaler: 0, total: 0 };
    for (const r of rows) {
      if (!viewFilter.passes(r, false)) continue;
      if (meteoFilter.length > 0 && !meteoFilter.includes(weatherFilter(r.meteo_score, r.meteo_context))) continue;
      const situation = viewFilter.situationOf(r);
      if (!situation) continue;
      c[situation] += 1;
      c.total += 1;
      if (isOnboardingToReschedule(r, situation)) c.recaler += 1;
    }
    return c;
  }, [rows, viewFilter, meteoFilter]);

  // Onboardings restants (dev 29/10/2026, compteur à volets à gauche de la recherche, comme le Suivi des ventes) :
  // exactement les cases « à venir + à confirmer + à faire + no show » du menu Onboarding, sur la même vue (onglet,
  // filtres, météo) — dev 10/11/2026 : « il faut que ce soit cohérent, sinon on sait qu'il y a un problème ».
  // Clients partis ou en cours de départ exclus, comme dans le menu.
  const onboardingsLeft = onboardingCounts.venir + onboardingCounts.confirm + onboardingCounts.todo + onboardingCounts.noshow;

  // Compteurs par bande météo (rouge 1-2 / orange 3 / vert 4-5 / "none" = non noté), calculés
  // sur la base pré-météo -> le nombre affiché sur chaque chip ne bouge pas quand on coche.
  const meteoCounts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, none: 0 };
    for (const r of preMeteoRows) c[weatherFilter(r.meteo_score, r.meteo_context)]++;
    return c;
  }, [preMeteoRows]);

  // Vue finale = base pré-météo + filtre bande météo (union des bandes cochées ; "none" = non noté).
  const filtered = useMemo(() => {
    const base = meteoFilter.length === 0
      ? preMeteoRows
      : preMeteoRows.filter((r) => meteoFilter.includes(weatherFilter(r.meteo_score, r.meteo_context)));
    // 1) Tri MANUEL par en-tête de colonne (clic) : prioritaire sur tout.
    if (sortCol && SORT_ACCESSORS[sortCol]) {
      return [...base].sort(byDateSort(SORT_ACCESSORS[sortCol], sortDir));
    }
    // 2) Tris par DÉFAUT selon l'onglet (jamais le bazar, même sans clic).
    if (multiFilter.length === 0) {
      if (etatFilter === "Renouvellement client")
        return [...base].sort((a, b) => (anniversaryDaysLeft(a) ?? Infinity) - (anniversaryDaysLeft(b) ?? Infinity));
      if (etatFilter === "Onboarding à venir")
        return [...base].sort(byDateSort(SORT_ACCESSORS.onboarding, "asc"));    // RDV le plus proche en haut
      if (etatFilter === "Signé")
        return [...base].sort(byDateSort(SORT_ACCESSORS.owner_signed, "desc")); // signés récents en haut
      // Autre onglet d'état : entré le plus RÉCEMMENT dans l'état en haut (tracking_updated_at ; NULLs en bas).
      if (!NON_ETAT_SORTED_TABS.includes(etatFilter))
        return [...base].sort((a, b) => {
          const ta = a.tracking_updated_at ? Date.parse(a.tracking_updated_at) : null;
          const tb = b.tracking_updated_at ? Date.parse(b.tracking_updated_at) : null;
          if (ta == null && tb == null) return 0;
          if (ta == null) return 1;
          if (tb == null) return -1;
          return tb - ta;
        });
    }
    return base;
  }, [preMeteoRows, meteoFilter, etatFilter, multiFilter, sortCol, sortDir]);
  // Tri effectif (manuel OU défaut de l'onglet) -> pilote les flèches des en-têtes.
  const effectiveSort = useMemo(() => {
    if (sortCol) return { col: sortCol, dir: sortDir };
    if (multiFilter.length === 0) {
      if (etatFilter === "Onboarding à venir") return { col: "onboarding", dir: "asc" };
      if (etatFilter === "Signé") return { col: "owner_signed", dir: "desc" };
    }
    return { col: null, dir: null };
  }, [sortCol, sortDir, etatFilter, multiFilter]);
  const clickSort = (col) => {
    const nextDir = effectiveSort.col === col ? (effectiveSort.dir === "asc" ? "desc" : "asc") : "asc";
    setSortCol(col); setSortDir(nextDir);
  };

  // Mois qui ont au moins une signature Owner (pour le dropdown), du + récent au + ancien.
  const sigMonths = useMemo(() => {
    const set = new Set();
    for (const r of rows) { const d = sigDateOf(r); if (d) set.add(d.slice(0, 7)); }
    return [...set].sort().reverse();
  }, [rows]);
  // Mois d'ONBOARDING (passés ET à venir) : raccourcis du filtre date quand on
  // travaille sur l'onboarding — Vincent raisonne « quels onboarding me
  // restent sur tel mois », y compris des dates déjà passées jamais traitées.
  const onbMonths = useMemo(() => {
    const set = new Set();
    for (const r of rows) { const d = onboardingDateOf(r); if (d) set.add(d.slice(0, 7)); }
    return [...set].sort().reverse();
  }, [rows]);

  const patch = useCallback(async (numero, changes) => {
    if (!numero) return; // contrat pré-client : pas de jalons éditables
    if (isBoardReadOnly()) return; // rôles en lecture seule : aucun contrôle ne mène ici, garde-fou
    // finance_team : lecture seule sauf cocher l'onboarding owner.
    if (isFinanceTeam()) {
      if (!("rdv_onboarding_done" in changes)) return;
      changes = { rdv_onboarding_done: changes.rdv_onboarding_done };
    }
    mutSeq.current += 1;
    let snapshot = null;   // ligne d'avant la MAJ optimiste, pour rollback si le PATCH échoue
    // Le Client Success qui coche ou décoche l'onboarding tranche un « à confirmer » : le back efface le marqueur.
    const local = ("rdv_onboarding_done" in changes && ONBOARDING_FLOW_ROLES.includes(roleOf()))
      ? { ...changes, onboarding_to_confirm: false } : changes;
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, ...local };
    }));
    try { await apiClient.patch("/api/v1/optilex/board-tracking", { numero_client: numero, ...changes }); }
    catch (e) {
      console.error("patch failed", e);
      if (snapshot) setRows((prev) => prev.map((r) => (r.numero_client === numero ? snapshot : r)));
      flagSaveError(e);
    }
  }, [flagSaveError]);

  // Poser un état + ses dates : passe par l'endpoint dédié (trace l'historique). Les dates de
  // pause ne valent que pour "Pause". Optimiste avec ROLLBACK si le POST échoue (un état qui
  // "a l'air posé" mais ne l'est pas est inacceptable pour un outil d'audit) ; la timeline ne
  // se rafraîchit qu'en cas de succès.
  // L'état AFFICHÉ (`etat_affiche`) n'est jamais deviné ici : il reste celui du serveur jusqu'à sa
  // réponse, qui renvoie le nouvel état calculé ; seuls les champs posés (état, dates) sont optimistes.
  const [etatHistVersion, setEtatHistVersion] = useState(0);
  const [etatRequests] = useState(createLatestRequestTracker);
  const changeEtat = useCallback(async (numero, payload) => {
    if (isBoardReadOnly()) return; // rôles en lecture seule : aucun contrôle ne mène ici, garde-fou
    if (requiresExitDecision(apiClient.getUser()?.role, payload.etat)) {
      payload = await confirmBoardFinanceExit(numero, payload);
      if (!payload) return { cancelled: true };
    }
    const { etat = null, etat_date = null, pause_end_date = null, pause_relance_date = null, finance_decision = null } = payload;
    if (!numero) return;
    if (isFinanceTeam() && !FINANCE_TEAM_ETATS.includes(etat)) return; // finance_team : seulement les 2 "en cours"
    mutSeq.current += 1;
    const isLatest = etatRequests.start(numero);
    const pe = etat === "Pause" ? pause_end_date : null;
    const pr = etat === "Pause" ? pause_relance_date : null;
    let snapshot = null;
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, etat_manuel: etat, etat_date, pause_end_date: pe, pause_relance_date: pr };
    }));
    try {
      const saved = await apiClient.post("/api/v1/optilex/etat-change", { numero_client: numero, etat, etat_date, pause_end_date: pe, pause_relance_date: pr, finance_decision });
      if (isLatest()) {
        // Un rechargement parti avant cette réponse peut porter l'ancien état : on l'écarte.
        mutSeq.current += 1;
        setRows((prev) => prev.map((r) => (r.numero_client === numero
          ? { ...withConfirmedEtat(r, saved), pause_end_date: pe, pause_relance_date: pr, finance_review_status: saved.finance_review?.status }
          : r)));
      }
      setEtatHistVersion((v) => v + 1);   // succès uniquement
    } catch (e) {
      console.error("etat-change failed", e);
      if (snapshot && isLatest()) setRows((prev) => prev.map((r) => (r.numero_client === numero ? snapshot : r)));
      flagSaveError(e);
    }
  }, [flagSaveError, etatRequests]);

  // Poser une note météo (1-5) + note d'interaction : POST dédié (historisé). Optimiste avec
  // rollback. La dernière note = la météo courante (badge/filtre/CSV). Bump la version pour
  // rafraîchir l'historique dans la fiche.
  const [meteoHistVersion, setMeteoHistVersion] = useState(0);
  const recordMeteo = useCallback(async (numero, payload) => {
    const {score,note,qualification}=payload;
    if (!numero || !score) return;
    if (isBoardReadOnly()) return false; // rôles en lecture seule : aucun contrôle ne mène ici, garde-fou
    mutSeq.current += 1;
    const u = apiClient.getUser() || {};
    const by = u.name || u.full_name || u.first_name || u.email || "";
    const at = new Date().toISOString();
    let snapshot = null;
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, meteo_score: score, meteo_context: {version:2,qualification}, meteo_note: note || null, meteo_by: by, meteo_at: at };
    }));
    try {
      await apiClient.post("/api/v1/optilex/weather-cases", { numero_client: numero, ...payload });
      setMeteoHistVersion((v) => v + 1);
      return true;
    } catch (e) {
      console.error("meteo failed", e);
      if (snapshot) setRows((prev) => prev.map((r) => (r.numero_client === numero ? snapshot : r)));
      flagSaveError(e);
      return false;
    }
  }, [flagSaveError]);

  const selRow = useMemo(() => rows.find((r) => rowKey(r) === selected) || null, [rows, selected]);

  // Vue = l'ensemble des filtres (onglets, autres états, météo, affiner ; ni la frappe de la recherche ni le tri).
  // Quand elle change, la liste glisse (VIEW_SLIDE) dans le sens du contrôle cliqué : `navTo(position)` le note
  // (un contrôle plus à droite que le précédent pousse la liste vers la gauche) ; sans clic noté, elle avance.
  const reduceMotion = useReducedMotion();
  const viewKey = JSON.stringify([etatFilter, multiFilter, meteoFilter, sigRange, dateTarget, onboardingSel, programmeSel]);
  const slideNav = useRef({ pos: 1, dir: 1 });
  const navTo = (pos) => { const n = slideNav.current; n.dir = pos < n.pos ? -1 : 1; n.pos = pos; };
  const [view, setView] = useState({ key: viewKey, dir: 1, limit: ROWS_FIRST });
  if (view.key !== viewKey) setView({ key: viewKey, dir: slideNav.current.dir, limit: ROWS_FIRST });
  useEffect(() => { slideNav.current.dir = 1; }, [viewKey]);
  // Rendu à la demande (29/10/2026) : les premières lignes glissent ; après la glissade, un paquet de lignes
  // s'ajoute chaque fois que le bas de la liste approche en défilant. Les 680 lignes rendues d'un coup faisaient
  // 57 000 nœuds et ralentissaient toute la page, fiche comprise.
  const sentinelRef = useRef(null);
  const [settledKey, setSettledKey] = useState(null);
  useEffect(() => { const t = setTimeout(() => setSettledKey(view.key), ROWS_SETTLE_MS); return () => clearTimeout(t); }, [view.key]);
  const moreRows = view.limit < filtered.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !moreRows || settledKey !== view.key || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setView((v) => ({ ...v, limit: v.limit + ROWS_CHUNK })); },
      { root: tableWrapRef.current, rootMargin: "0px 0px 900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [moreRows, settledKey, view.key, view.limit]);
  const shownRows = moreRows ? filtered.slice(0, view.limit) : filtered;

  // Entrée SEEN-KEYS : seules les lignes jamais affichées s'animent. Au changement de vue, la glissade porte
  // toute la liste : ses lignes sont marquées vues d'emblée (pas de cascade en plus). Les lignes révélées par la
  // recherche (backspace) entrent proprement SANS faire clignoter celles déjà en place. Le polling ne rejoue rien.
  const seenRows = useRef(new Set());
  const prevViewRef = useRef(viewKey);
  if (prevViewRef.current !== viewKey) { seenRows.current = new Set(filtered.map(rowKey)); prevViewRef.current = viewKey; }
  const newIdxByKey = new Map();
  { let ni = 0; for (const r of filtered) { const k = rowKey(r); if (!seenRows.current.has(k)) newIdxByKey.set(k, ni++); } }
  useEffect(() => { for (const r of filtered) seenRows.current.add(rowKey(r)); }, [filtered]);

  // Onglet primaire -> vide le multi-filtre ; cocher une catégorie -> vide l'onglet primaire.
  // Sélection MULTIPLE (demande Vincent 2026-08-26) : l'onglet actif et les
  // catégories cochées se CUMULENT (union des états). « Tous » = clients actuels
  // et anciens ; les autres familles de filtres (météo, programmes,
  // onboarding, date, recherche) restent en ET par-dessus.
  const pickTab = (t) => {
    setSortCol(null);
    navTo(PRIMARY_TABS.indexOf(t));
    // « Tous » réinitialise ; sinon l'onglet se COCHE/DÉCOCHE et se cumule avec
    // les autres (Vincent doit pouvoir voir résiliation + rétractation +
    // liquidation ensemble). `etatFilter` ne sert plus qu'au tri par défaut :
    // il ne vaut un onglet que si la sélection est unique.
    if (t === "Tous") { setMultiFilter([]); setEtatFilter("Tous"); return; }
    const next = multiFilter.includes(t) ? multiFilter.filter((c) => c !== t) : [...multiFilter, t];
    setMultiFilter(next);
    setEtatFilter(next.length === 1 ? next[0] : "Tous");
  };
  const toggleCat = (cat) => {
    setSortCol(null);
    navTo(PRIMARY_TABS.length);
    setMultiFilter((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  // Export CSV de la vue filtrée courante (onglet + filtres + date + recherche).
  // Le nom de fichier reflète le filtre actif (ex. resiliation, en_cours_de_resiliation).
  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const label = multiFilter.length ? multiFilter.join("_") : (etatFilter !== "Tous" ? etatFilter : "board");
    exportRowsToCsv(filtered, label);
  };

  // Filtres posés hors des onglets d'état, rappelés sous la barre et retirables un par un.
  const activeTags = [
    ...multiFilter.filter((c) => !PRIMARY_TABS.includes(c)).map((c) => {
      const alert = ALERT_FILTERS.find((a) => a.cat === c && a.cat !== "Pause");
      return { key: `etat-${c}`, group: alert ? "Alerte" : "État", label: alert ? alert.label : c, clear: () => toggleCat(c) };
    }),
    ...meteoFilter.map((b) => ({ key: `meteo-${b}`, group: "Météo", label: b === "none" ? "Non noté" : WEATHER[b].label, clear: () => setMeteoFilter((p) => p.filter((x) => x !== b)) })),
    ...(sigRange.from || sigRange.to ? [{ key: "date", group: dateTarget === "onboarding" ? "Onboarding" : "Signature", label: sigRangeLabel(sigRange.from, sigRange.to), clear: () => setSigRange({ from: "", to: "" }) }] : []),
    ...onboardingSel.map((k) => ({ key: `onb-${k}`, group: "Onboarding", label: ONBOARDING_TAGS[k] || k, clear: () => setOnboardingSel((p) => p.filter((x) => x !== k)) })),
    ...programmeSel.map((k) => ({ key: `prog-${k}`, group: "Programme", label: PROGRAMME_TAGS[k] || k, clear: () => setProgrammeSel((p) => p.filter((x) => x !== k)) })),
    ...(q ? [{ key: "q", group: "Recherche", label: `« ${q} »`, clear: () => setQ("") }] : []),
  ];
  // Compteur à volets (dev 10/11/2026) : par défaut (onglet Signé, aucun filtre), les onboardings restants ; dès
  // qu'un autre onglet ou un filtre est choisi, le nom de ce filtre et le nombre de clients affichés.
  const tabsOn = multiFilter.length ? multiFilter : [etatFilter];
  const tagText = (t) => (t.group === "Onboarding" ? `Onboarding ${t.label.toLowerCase()}`
    : t.group === "Recherche" ? `Recherche ${t.label}`
    : t.group === "Signature" || t.group === "Onboarding date" ? `${t.group} ${t.label}` : t.label);
  const isDefaultView = activeTags.length === 0 && tabsOn.length === 1 && tabsOn[0] === "Signé";
  const counter = isDefaultView
    ? { label: "Onboardings restants", value: onboardingsLeft,
        title: "Onboardings pas encore réalisés dans la vue affichée : à venir + à confirmer + à faire + no show du menu Onboarding" }
    : (() => {
        const label = activeTags.length ? activeTags.map(tagText).join(" · ") : tabsOn.map(tabLabel).join(" · ");
        return { label, value: filtered.length, title: `${label} : ${filtered.length} client${filtered.length > 1 ? "s" : ""} affiché${filtered.length > 1 ? "s" : ""}` };
      })();
  // « Tout effacer » retire ces filtres et garde les onglets d'état choisis.
  const clearRefinements = () => {
    setSortCol(null);
    navTo(0);
    setMultiFilter((p) => p.filter((c) => PRIMARY_TABS.includes(c)));
    setMeteoFilter([]);
    setSigRange({ from: "", to: "" });
    setOnboardingSel([]);
    setProgrammeSel([]);
    setQ("");
  };

  // En-tête léger (le filet du bas est une ombre : une bordure ne suit pas un en-tête collant) ; sa hauteur
  // fixe est celle que l'ascenseur saute (.ob-table-wrap).
  const th = { textAlign: "left", padding: "0 14px", height: 40, boxSizing: "border-box", fontSize: 13, fontWeight: 500, color: "#55514b", whiteSpace: "nowrap", position: "sticky", top: 0, background: CARD, boxShadow: "inset 0 -1px 0 #e8e4de", zIndex: 1 };
  const thIn = { display: "inline-flex", alignItems: "center", gap: 7 };
  const thIc = { size: 14, color: "#a8a39b", strokeWidth: 1.75, "aria-hidden": true };
  const td = ROW_TD;

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : BG, padding: embed ? "10px 24px 28px" : "24px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", fontFeatureSettings: "'cv11','ss01'", color: TEXT }} className="ob-root">
      <style>{`
        .ob-alert-chip .ob-chip-ic{color:var(--al-ink)}
        .ob-alert-chip.is-on{background:var(--al-tile);border-color:transparent;color:var(--al-ink)}
        .ob-alert-chip.is-on .ob-n{color:var(--al-ink)}
        .al{overflow:visible}
        .al-bang,.al-z{transform-box:fill-box;transform-origin:center bottom}
        .ob-alert-chip:hover .al-bang{animation:obAlBang .6s cubic-bezier(.36,.07,.19,.97)}
        @keyframes obAlBang{0%,100%{transform:none}25%{transform:rotate(-14deg)}55%{transform:rotate(10deg)}80%{transform:rotate(-5deg)}}
        .ob-alert-chip:hover .al-z{animation:obAlZ .8s ease-in-out}
        @keyframes obAlZ{0%,100%{transform:none;opacity:1}50%{transform:translate(1px,-2px) scale(1.15);opacity:.5}}
        /* Agenda du client (même mise en page que les autres fenêtres de la fiche). */
        .ag-modal{position:relative;display:flex;flex-direction:column;width:min(680px,100%);max-height:86vh;overflow:hidden;border-radius:22px;background:${CARD};box-shadow:0 24px 70px rgba(28,27,25,.14),0 2px 6px rgba(43,41,39,.042)}
        .ag-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 16px 26px;border-bottom:1px solid #f4f2ee}
        .ag-head h3{margin:0;font-size:17px;font-weight:500;letter-spacing:-.01em;color:${NAVY}}
        .ag-head p{margin:2px 0 0;font-size:12.5px;color:${MUTED};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ag-close{display:grid;place-items:center;width:32px;height:32px;border:0;background:transparent;padding:0;color:${MUTED};cursor:pointer}
        .ag-close svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ag-close:hover{color:${NAVY}}
        .ag-close:hover svg{transform:rotate(90deg)}
        .ag-body{overflow-y:auto;padding:16px 18px 18px;background:#f4f2ef}
        .ag-day{font-size:13px;text-transform:capitalize}
        .ag-list{display:flex;flex-direction:column;gap:6px}
        .ag-item{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 12px 6px 6px;border:1px solid #f1eee9;border-radius:14px;background:#faf9f7;animation:obAgIn .4s cubic-bezier(.16,1,.3,1) backwards;animation-delay:calc(.15s + var(--ag-i) * .04s);transition:border-color .15s,background .15s}
        .ag-item:hover{border-color:#e8e4de;background:#fff}
        @keyframes obAgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ag-time{display:grid;place-items:center;flex-shrink:0;width:58px;height:40px;border-radius:10px;background:#f4f2ee;font-size:13.5px;font-weight:500;font-variant-numeric:tabular-nums;color:${NAVY}}
        .ag-bar{flex-shrink:0;width:3px;align-self:stretch;margin:4px 0;border-radius:2px;background:var(--ag-tone)}
        .ag-tx{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
        .ag-tx strong{font-size:13.5px;font-weight:500;color:${NAVY};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ag-tx small{font-size:12px;color:${MUTED};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ag-item.is-cancelled .ag-time,.ag-item.is-cancelled .ag-tx strong{color:#a8a39b}
        .ag-item.is-cancelled .ag-tx strong{text-decoration:line-through}
        .ob-contact{gap:8px}
        /* Témoignage : petite fenêtre « un mot pour Morgane ». */
        .tm-anchor{position:relative;display:inline-flex}
        .tm-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:330px;padding:16px;border:1px solid #ece9e4;border-radius:20px;background:${CARD};box-shadow:0 14px 34px rgba(28,27,25,.10),0 2px 6px rgba(28,27,25,.04);transform-origin:top right;font-weight:500}
        .tm-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
        .tm-head>div{display:flex;flex-direction:column;gap:2px}
        .tm-head strong{font-size:13.5px;font-weight:500;color:${NAVY}}
        .tm-head small{font-size:12px;line-height:1.45;color:#8b867e}
        .tm-ic{display:grid;place-items:center;flex-shrink:0;width:34px;height:34px;border-radius:10px;background:#fde9da;color:#c2500e}
        .tm-pop textarea{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #e8e4de;border-radius:12px;font:inherit;font-size:13px;line-height:1.5;color:${TEXT};resize:vertical;outline:0;transition:border-color .15s,box-shadow .15s}
        .tm-pop textarea:focus{border-color:#d8d3cb;box-shadow:0 0 0 3px rgba(43,41,39,.05)}
        .tm-error{margin:8px 0 0;font-size:12px;color:#c5221f}
        .tm-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}
        .tm-ghost,.tm-go{flex-shrink:0;white-space:nowrap}
        .tm-ghost{height:32px;padding:0 12px;border:1px solid #e8e4de;border-radius:9px;background:${CARD};font:inherit;font-size:12.5px;font-weight:500;color:${TEXT};cursor:pointer}
        .tm-go{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border:0;border-radius:9px;background:#2b2927;font:inherit;font-size:12.5px;font-weight:500;color:#fff;cursor:pointer}
        .tm-go svg{transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
        .tm-go:hover:not(:disabled) svg{transform:translate(2px,-2px) rotate(-6deg)}
        .tm-go:disabled{opacity:.6;cursor:progress}
        /* Une petite fenêtre ouverte dans un bloc de la fiche passe au-dessus des blocs qui suivent. */
        .ob-dp-block:has(.bcl-pop,.ocv-pop,.br-pal,.ob-menu-pop,.tm-pop){position:relative;z-index:30}
        .ob-prop:has(.tm-pop){position:relative;z-index:31}
        .ob-prop:has(.bcl-pop){position:relative;z-index:31}
        .ob-contact .bcl-more{opacity:.0;transition:opacity .15s,border-color .15s,color .15s}
        .ob-prop:hover .ob-contact .bcl-more,.ob-contact .bcl-more[aria-expanded="true"],.ob-contact .bcl-more:focus-visible{opacity:1}
        @media (hover:none){.ob-contact .bcl-more{opacity:1}}
        .ob-exp{display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 6px;border-radius:999px;background:#ffe2dc;color:#bf4436;font-size:12px;font-weight:500}
        .ob-dp-convention{margin-bottom:18px}
        .ob-dp-wallet{margin:4px 0 0}
        @keyframes obMenuIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:none}}
        @keyframes obRowIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes obFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes obShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
        .ob-sk{background:linear-gradient(90deg,#f4f2ee 25%,#f7f5f2 50%,#f4f2ee 75%);background-size:200% 100%;animation:obShimmer 1.4s ease-in-out infinite;display:inline-block;flex-shrink:0}
        .ob-chev{display:inline-flex;color:#cfc9c0;transition:transform .18s ease,color .18s ease}
        tr:hover .ob-chev{transform:translateX(3px);color:#1c1b19}
        .ob-sec{animation:obFadeUp .32s cubic-bezier(0.16,1,0.3,1) both}
        /* Fiche client (dev 10/11/2026) : le gabarit de la fiche Finance. Carte blanche flottante à dix pixels du
           bord, en-tête (qui, où il en est, trois repères), propriétés en lignes fines, onglets qui restent collés. */
        .ob-detail-panel{position:fixed;top:10px;right:10px;z-index:9999;display:flex;flex-direction:column;width:clamp(600px,42vw,720px);max-width:calc(100vw - 20px);height:calc(100dvh - 20px);overflow:hidden;border:1px solid #ece9e4;border-radius:22px;background:${CARD};box-shadow:0 0 0 5px rgba(255,255,255,.5),-24px 0 60px rgba(43,41,39,.13),0 10px 30px rgba(43,41,39,.08);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;transition:width .34s cubic-bezier(.22,1,.36,1),height .34s cubic-bezier(.22,1,.36,1),top .34s cubic-bezier(.22,1,.36,1),right .34s cubic-bezier(.22,1,.36,1),border-radius .34s cubic-bezier(.22,1,.36,1)}
        .ob-detail-panel.is-full{top:0;right:0;width:100vw;max-width:100vw;height:100dvh;border-color:transparent;border-radius:0;box-shadow:none}
        @media (max-width:680px){.ob-detail-panel{top:0;right:0;width:100vw;max-width:100vw;height:100dvh;border-color:transparent;border-radius:0}}
        @media (prefers-reduced-motion:reduce){.ob-detail-panel{transition:none}}
        .ob-dp-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
        .ob-dp-scroll::-webkit-scrollbar{width:12px;height:12px}
        .ob-dp-scroll::-webkit-scrollbar-track{background:transparent;margin:16px 0}
        .ob-dp-scroll::-webkit-scrollbar-thumb{background-color:#e3ded6;border:4px solid transparent;border-radius:999px;background-clip:padding-box}
        .ob-dp-scroll:hover::-webkit-scrollbar-thumb{background-color:#cfc9c0}
        .ob-dp-scroll::-webkit-scrollbar-thumb:hover{background-color:#a8a39b}
        @supports not selector(::-webkit-scrollbar){.ob-dp-scroll{scrollbar-width:thin;scrollbar-color:#d8d3cb transparent}}
        /* Croix ronde posée sur le voile, à gauche du panneau ; dans le panneau en petit écran, dans l'en-tête en plein écran. */
        .ob-dp-close{position:fixed;top:24px;right:calc(clamp(600px,42vw,720px) + 22px);z-index:9999;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid #ece9e4;border-radius:50%;background:${CARD};color:#4a4540;box-shadow:0 8px 22px rgba(43,41,39,.16),0 1px 3px rgba(43,41,39,.08);cursor:pointer;transition:color .15s ease,box-shadow .2s ease}
        .ob-dp-close:hover{color:${NAVY};box-shadow:0 10px 28px rgba(43,41,39,.22),0 1px 3px rgba(43,41,39,.1)}
        .ob-dp-close.is-hidden{display:none}
        .ob-dp-close svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-dp-close:hover svg{transform:rotate(90deg)}
        @media (max-width:680px){.ob-dp-close{top:12px;right:12px;z-index:10000;width:34px;height:34px}}
        /* En-tête : pastille ronde, nom, société, étiquettes, puis trois repères en tuiles. */
        .ob-fh{margin-bottom:24px}
        .ob-fh-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .ob-fh-id{display:flex;align-items:center;gap:14px;min-width:0}
        .ob-fh-name{margin:0;font-size:22px;font-weight:500;line-height:1.25;letter-spacing:-.02em;color:${TEXT};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
        .ob-fh-sub{margin-top:2px;font-size:13.5px;color:${MUTED};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ob-fh-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .ob-fh-ring{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid #e8e4de;border-radius:50%;background:${CARD};color:${MUTED};box-shadow:0 1px 2px rgba(43,41,39,.06);cursor:pointer;transition:color .15s,border-color .15s,transform .15s}
        .ob-fh-ring:hover{color:${NAVY};border-color:#d8d3cb}
        .ob-fh-ring:active{transform:scale(.9)}
        .ob-fh-ring svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-fh-ring:hover svg{transform:scale(1.14)}
        .ob-fh-ring.is-close:hover svg{transform:rotate(90deg)}
        .ob-fh-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:14px}
        .ob-fh-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border:1px solid #e3ded6;border-radius:7px;background:#f1eee9;color:#4a4540;font-size:12.5px;font-weight:500;white-space:nowrap}
        .ob-fh-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
        .ob-fh-tile{display:flex;flex-direction:column;gap:6px;min-width:0;padding:14px 14px 13px;border:1px solid ${BORDER};border-radius:16px;background:${CARD};transition:border-color .18s,box-shadow .18s}
        .ob-fh-tile:hover{border-color:#e3ded6;box-shadow:0 6px 18px rgba(43,41,39,.07)}
        .ob-fh-tile-k{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:${MUTED}}
        .ob-fh-tile-k svg{flex-shrink:0;color:#b3aea6;transition:transform .32s cubic-bezier(.34,1.56,.64,1),color .18s}
        .ob-fh-tile:hover .ob-fh-tile-k svg{transform:translateY(-1px) scale(1.12);color:${NAVY}}
        .ob-fh-tile-v{font-size:20px;font-weight:500;line-height:1.2;letter-spacing:-.015em;color:${TEXT};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ob-fh-tile-n{font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        @media (max-width:680px){.ob-fh-top{padding-right:40px}.ob-fh-actions{display:none}}
        @media (max-width:520px){.ob-fh-tiles{grid-template-columns:1fr}}
        .ob-sec-hint{margin:3px 0 0;font-size:12.5px;font-weight:400;line-height:1.45;color:${MUTED}}
        .ob-dp-close-sr{position:absolute;top:10px;right:12px;z-index:3;padding:6px 10px;border:0;border-radius:8px;background:#2b2927;color:#fff;font:inherit;font-size:12px;font-weight:500;cursor:pointer;opacity:0;pointer-events:none}
        .ob-dp-close-sr:focus-visible{opacity:1;pointer-events:auto;outline:2px solid #d8d3cb;outline-offset:2px}
        .ob-dp-body{--dp-x:28px;--dp-y:26px;padding:var(--dp-y) var(--dp-x) 56px}
        .ob-detail-panel.is-full .ob-dp-body{--dp-x:40px;--dp-y:34px;max-width:1240px;margin:0 auto;padding-bottom:72px}
        /* Plein écran large : la fiche à gauche, le suivi (onglets) à droite. */
        @media (min-width:1100px){
          .ob-detail-panel.is-full .ob-dp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);column-gap:52px;align-items:start}
          .ob-detail-panel.is-full .ob-dp-side .ob-tabs{margin:-20px 0 24px;padding-left:0;padding-right:0}
        }
        .ob-dp-block{margin-bottom:24px}
        .ob-props{display:flex;flex-direction:column}
        .ob-props{gap:2px}
        .ob-props-group{display:flex;flex-direction:column;gap:2px}
        .ob-props-group+.ob-props-group{margin-top:12px;padding-top:12px;border-top:1px solid #f1eee9}
        .ob-props-title{padding:2px 0 6px;font-size:10.5px;font-weight:500;color:#a8a39b;text-transform:uppercase;letter-spacing:.09em}
        .ob-prop{display:grid;grid-template-columns:130px minmax(0,1fr);align-items:center;column-gap:16px;min-height:40px;margin:0 -10px;padding:4px 10px;border-radius:10px;transition:background .15s}
        .ob-prop:hover{background:#f7f5f2}
        .ob-prop-vline{display:flex;align-items:center;gap:4px;min-width:0}
        .ob-prop-vline>:first-child{min-width:0}
        /* Ligne qui peut grandir (dates d'effet sous l'état) : contenu en haut, mais marges égales en haut et en bas,
           pour que la zone de survol reste centrée sur une seule ligne (dev 29/10/2026). */
        .ob-prop.is-top{align-items:start;padding-top:8px;padding-bottom:8px}
        .ob-prop-k{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:400;color:${MUTED};white-space:nowrap}
        .ob-prop.is-wrap .ob-prop-k{white-space:normal;line-height:1.25}
        .ob-prop-k svg{flex-shrink:0;color:#b3aea6;transition:transform .32s cubic-bezier(.34,1.56,.64,1),color .18s}
        .ob-prop:hover .ob-prop-k svg{transform:translateY(-1px) scale(1.12);color:${NAVY}}
        .ob-prop-v{min-width:0;font-size:13.5px;font-weight:500;color:${TEXT};overflow-wrap:anywhere}
        .ob-pv-line{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;max-width:100%}
        .ob-pv-sub{font-size:12px;font-weight:500;color:${MUTED}}
        .ob-pv-none{font-weight:500;color:#c9c4bc}
        .ob-pv-more{margin-left:8px;padding:0;border:0;background:none;font:inherit;font-size:12px;font-weight:500;color:#8b867e;cursor:pointer;text-decoration:underline;text-underline-offset:2px}.ob-pv-more:hover{color:#1c1b19}
        .ob-pv-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ob-contract-line{display:flex;align-items:center;gap:12px;min-width:0}

        .ob-prop-edit{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:4px 2px;color:${MUTED};font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:color .16s}
        .ob-prop-edit svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-prop-edit:hover{color:${NAVY}}
        .ob-prop-edit:hover svg{transform:rotate(-12deg) translateY(-1px)}
        .ob-prog{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px 0 8px;border-radius:999px;border:1px solid ${BORDER};background:${CARD};color:#55514b;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:background .18s,border-color .18s,color .18s}
        .ob-prog:disabled{cursor:default}
        .ob-prog:not(:disabled):hover{border-color:#e3ded6;color:var(--pg-ink)}
        .ob-prog.is-on{border-color:transparent;background:var(--pg-tile);color:var(--pg-ink)}
        .ob-prog-ic{display:grid;place-items:center;color:#a8a39b;transition:color .18s}
        .ob-prog:not(:disabled):hover .ob-prog-ic,.ob-prog.is-on .ob-prog-ic{color:var(--pg-ink)}
        .ob-prog.is-on .ob-prog-ic{animation:obPgPop .5s cubic-bezier(.34,1.56,.64,1)}
        @keyframes obPgPop{0%{transform:scale(.5) rotate(-20deg)}60%{transform:scale(1.25) rotate(6deg)}100%{transform:none}}
        .pg{overflow:visible}
        .pg-wave{opacity:1;transform-box:fill-box;transform-origin:left center}
        .ob-prog:not(:disabled):hover .pg-wave-1{animation:obPgWave .9s ease-in-out}
        .ob-prog:not(:disabled):hover .pg-wave-2{animation:obPgWave .9s ease-in-out .12s}
        @keyframes obPgWave{0%,100%{opacity:1;transform:none}40%{opacity:.2;transform:scaleX(.6)}70%{opacity:1;transform:scaleX(1.12)}}
        .pg-shake{transform-box:fill-box;transform-origin:center}
        .ob-prog:not(:disabled):hover .pg-shake{animation:obPgShake .6s ease-in-out}
        @keyframes obPgShake{0%,100%{transform:none}25%{transform:translateY(-1.2px) rotate(-6deg)}50%{transform:translateY(.8px) rotate(4deg)}75%{transform:translateY(-.6px) rotate(-3deg)}}
        .pg-star{transform-box:fill-box;transform-origin:center}
        .ob-prog:not(:disabled):hover .pg-star{animation:obPgStar .7s cubic-bezier(.34,1.56,.64,1)}
        @keyframes obPgStar{0%{transform:none}50%{transform:scale(1.35) rotate(72deg)}100%{transform:rotate(144deg)}}
        .ob-tabs{position:sticky;top:calc(-1 * var(--dp-y));z-index:6;display:flex;gap:20px;margin:0 calc(-1 * var(--dp-x)) 20px;padding:calc(var(--dp-y) + 4px) var(--dp-x) 0;background:${CARD};border-bottom:1px solid ${BORDER};overflow-x:auto;scrollbar-width:none}
        .ob-detail-panel.is-full .ob-tabs{gap:28px;margin-bottom:24px}
        .ob-tabs::-webkit-scrollbar{display:none}
        .ob-tab{position:relative;display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;padding:10px 0 12px;font:inherit;font-size:13.5px;font-weight:500;color:${MUTED};cursor:pointer;white-space:nowrap;transition:color .16s}
        .ob-tab:hover{color:#4a4540}
        .ob-tab.is-on{color:${NAVY}}
        .ob-tab-n{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#f1eee9;color:#4a4540;font-size:11px;font-weight:500;font-variant-numeric:tabular-nums;transition:background .16s,color .16s}
        .ob-tab.is-on .ob-tab-n{background:#2b2927;color:#fff}
        .ob-tab-line{position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:${NAVY}}
        .ob-tabpanel{animation:obPanelIn .26s cubic-bezier(.16,1,.3,1) both}
        @keyframes obPanelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .ob-steps{border:1px solid ${BORDER};border-radius:12px;overflow:hidden}
        .ob-step{display:flex;align-items:center;gap:12px;padding:11px 14px}
        .ob-step+.ob-step{border-top:1px solid ${BORDER}}
        .ob-step-ic{flex-shrink:0;color:#cfc9c0}
        .ob-step.is-done .ob-step-ic{color:${GREEN}}
        .ob-step-t{font-size:13px;font-weight:500;color:${MUTED}}
        .ob-step.is-done .ob-step-t{color:${NAVY}}
        .ob-step-s{margin-top:1px;font-size:11.5px;color:${MUTED}}
        .ob-step-r{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:#cfc9c0;white-space:nowrap}
        .ob-step.is-done .ob-step-r{color:${GREEN}}
        /* Passe « Onboardé » : se penche et brille au survol. */
        .ob-pass{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;vertical-align:middle;margin-left:10px;padding:3px 9px 3px 6px;border-radius:999px;background:#e2f6ea;color:${GREEN};font-size:12px;font-weight:500;letter-spacing:0;cursor:default}
        .ob-pass.is-icon{margin-left:0;padding:0;background:transparent}
        .ob-pass-svg{display:block;overflow:visible;transition:transform .4s cubic-bezier(.34,1.56,.64,1)}
        .ob-pass:hover .ob-pass-svg,.ob-row:hover .ob-pass .ob-pass-svg{transform:rotate(-10deg) translateY(-1px) scale(1.1)}
        @keyframes obPassGlint{from{transform:rotate(24deg) translateX(0)}to{transform:rotate(24deg) translateX(34px)}}
        .ob-pass-glint{transform-box:view-box;transform-origin:10px 11px}
        .ob-pass:hover .ob-pass-glint,.ob-row:hover .ob-pass .ob-pass-glint{animation:obPassGlint .7s cubic-bezier(.4,0,.2,1)}
        /* Billet d'onboarding (v3, d'après la carte d'embarquement de la référence, dev 29/10/2026) : de → à en
           pointillés avec la fusée, grandes dates, bandeau bleu, lancements, grosses encoches (masque à la hauteur
           de la perforation, contour suivi par l'ombre du conteneur), souche et son code-barres pleine largeur. */
        .ob-tkw{margin-bottom:24px}
        .ob-tk{position:relative;border-radius:22px}
        .ob-tk-shape{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
        .ob-tk-top{position:relative;padding:20px 24px 22px}
        .ob-tk-line{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#8b867e}
        .ob-tk-o{flex-shrink:0;width:8px;height:8px;border:1.4px solid #8b867e;border-radius:50%}
        .ob-tk-o.is-full{background:#8b867e}
        .ob-tk-dots{flex:1;height:0;border-top:1.6px dotted #a8a39b}
        .ob-tk-rocket{flex-shrink:0;display:block;color:${NAVY};transition:transform .4s cubic-bezier(.34,1.56,.64,1)}
        .ob-tk:hover .ob-tk-rocket{transform:translateX(4px)}
        .ob-tk-flame{transform-box:fill-box;transform-origin:100% 50%}
        .ob-tk:hover .ob-tk-flame{animation:obFlame .3s ease-in-out infinite alternate}
        @keyframes obFlame{from{transform:scaleX(.65)}to{transform:scaleX(1.2)}}
        .ob-tk.is-done .ob-tk-rocket{color:${GREEN}}
        .ob-tk.is-done .ob-tk-flame{display:none}
        .ob-tk-codes{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:12px;margin-top:10px}
        .ob-tk-codes>div{display:flex;flex-direction:column;min-width:0}
        .ob-tk-codes>div.is-right{align-items:flex-end;text-align:right}
        .ob-tk-code-big{font-size:34px;line-height:1.05;font-weight:500;letter-spacing:-.02em;color:${NAVY};white-space:nowrap}
        .ob-tk-city{margin-top:6px;font-size:12px;line-height:1.35;color:#8b867e}
        .ob-tk-mid{display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:4px}
        .ob-tk-dur{font-size:11px;font-weight:500;color:${TEXT};white-space:nowrap}
        .ob-tk-status{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:#2b2927;color:#fff;font-size:11px;font-weight:500;white-space:nowrap;cursor:default}
        .ob-tk-status svg{transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
        .ob-tk-status:hover svg{transform:rotate(-8deg) scale(1.14)}
        .ob-tk-flag{transform-box:fill-box;transform-origin:0 100%}
        @keyframes obFlag{0%,100%{transform:skewY(0)}50%{transform:skewY(-7deg)}}
        .ob-tk-status:hover .ob-tk-flag{animation:obFlag .55s ease-in-out 2}
        .ob-tk-status.is-warn{background:#c2500e}
        .ob-tk-status.is-done{background:${GREEN}}
        .ob-tk-status.is-idle{background:#8b867e}
        .ob-tk-times{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
        .ob-tk-times>div{display:flex;flex-direction:column}
        .ob-tk-times>div.is-right{align-items:flex-end;text-align:right}
        .ob-tk-times strong{font-size:15px;font-weight:500;color:${NAVY}}
        .ob-tk-times span{margin-top:2px;font-size:11px;color:#8b867e}
        .ob-tk-band{display:grid;grid-template-columns:1.3fr 1fr 1fr .9fr;gap:10px;margin-top:18px;padding:12px 16px;border-radius:12px;background:#c9e0fa}
        .ob-tk.is-done .ob-tk-band{background:#bfe3cd}
        .ob-tk-band>div{display:flex;flex-direction:column;gap:3px;min-width:0}
        .ob-tk-band span{font-size:11px;font-weight:500;color:#4a4540}
        .ob-tk-band strong{display:flex;align-items:center;gap:6px;min-height:22px;font-size:15px;font-weight:500;color:${NAVY};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ob-tk-band a{display:inline-flex;align-items:center;gap:3px;color:${NAVY};text-decoration:none}
        .ob-tk-band a svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-tk-band a:hover svg{transform:translate(1px,-1px) scale(1.1)}
        .ob-tk-band .ob-copy.has-text{font-size:15px;font-weight:500;color:${NAVY}}
        .ob-tk-band .ob-copy.has-text .ob-copy-ic{opacity:1;color:#4a4540}
        .ob-tk-legs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
        .ob-tk-leg{display:flex;flex-direction:column;gap:3px;min-width:0}
        .ob-tk-leg:nth-child(2){align-items:center;text-align:center}
        .ob-tk-leg:nth-child(3){align-items:flex-end;text-align:right}
        .ob-tk-leg>span:first-child{font-size:11px;color:#8b867e}
        .ob-tk-leg strong{display:flex;align-items:center;gap:5px;font-size:14px;font-weight:500;color:${NAVY};font-variant-numeric:tabular-nums;white-space:nowrap}
        .ob-tk-leg strong.is-none{font-weight:500;color:#c9c4bc}
        .ob-tk-legact{display:flex;gap:10px}
        .ob-tk-link{border:0;background:transparent;padding:0;font:inherit;font-size:12px;font-weight:500;color:#55514b;cursor:pointer}
        .ob-tk-link:hover{text-decoration:underline}
        .ob-tk-link.is-danger{color:#c5221f}
        .ob-tk-stubwrap{position:relative;z-index:3;transform-origin:30% 0}
        .ob-tk-stubshape{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
        .ob-tk-perf{position:relative;height:0}
        .ob-tk-scissors{position:absolute;top:-12px;z-index:2;overflow:visible;filter:drop-shadow(0 2px 3px rgba(43,41,39,.175))}
        .ob-tk-cutline{position:absolute;left:30px;right:30px;top:-1px;height:2px;background:#2b2927;transform-origin:left center}
        .ob-tk-seal{display:block;width:88px;height:88px;margin:-14px auto -6px;pointer-events:none;mix-blend-mode:multiply}
        .ob-seal{display:block;opacity:.9}
        .ob-tk-after{display:flex;align-items:center;flex-wrap:wrap;gap:12px 18px;margin:14px 6px 0}
        .ob-tk-after .ob-tk-link{display:inline-flex;align-items:center;gap:6px}
        .ob-tk-perf::after{content:"";position:absolute;left:30px;right:30px;top:-1px;border-top:2px dotted #c9c4bc}
        .ob-tk-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-top:12px}
        .ob-tk-stub{position:relative;padding:22px 24px 20px}
        .ob-tk-stubrow{display:flex;align-items:center;justify-content:space-between;gap:18px}
        .ob-tk-stubact{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
        .ob-tk-codebox{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:1;min-width:0}
        .ob-tk-barcode{display:block;width:230px;max-width:100%;height:52px;color:#1c1b19}
        .ob-tk-num{font-size:10px;letter-spacing:.3em;color:#8b867e;font-variant-numeric:tabular-nums}
        .ob-tk-cta-ic{flex-shrink:0}
        @keyframes obLift{0%,100%{transform:none}40%{transform:translateY(-2px) rotate(-8deg)}75%{transform:translateY(.5px)}}
        .ob-tk-cta:hover .ob-tk-cta-ic{animation:obLift .9s cubic-bezier(.45,0,.55,1)}
        .ob-tk-cta{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border:0;border-radius:11px;background:#2b2927;color:#fff;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;box-shadow:0 6px 16px rgba(43,41,39,.126)}
        .ob-tk-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 4px;border:1px solid ${BORDER};border-radius:999px;background:${CARD};font:inherit;font-size:12px;font-weight:500;color:${NAVY};cursor:pointer;transition:border-color .15s}
        .ob-tk-chip:hover{border-color:#e3ded6}
        .ob-tk-resched{display:inline-flex;align-items:center;gap:6px;padding:4px 11px 4px 8px;border:1px solid ${BORDER};border-radius:999px;background:${CARD};font:inherit;font-size:12px;font-weight:500;color:${NAVY};cursor:pointer;transition:border-color .15s,background-color .15s,transform .15s}
        .ob-tk-resched svg{flex-shrink:0;color:#55514b}
        .ob-tk-resched-hand{transform-origin:16px 16px;transition:transform .7s cubic-bezier(.34,1.56,.64,1)}
        .ob-tk-resched:hover{border-color:#e3ded6;background:#faf9f7}
        .ob-tk-resched:hover .ob-tk-resched-hand{transform:rotate(360deg)}
        .ob-tk-resched:active{transform:scale(.97)}
        .ob-tk-resched:focus-visible{outline:2px solid #55514b;outline-offset:2px}
        @media (prefers-reduced-motion: reduce){.ob-tk-resched,.ob-tk-resched-hand{transition:none}.ob-tk-resched:hover .ob-tk-resched-hand{transform:none}}
        .ob-tk-manual{display:block;margin-top:14px;border:0;background:transparent;padding:0;font:inherit;font-size:12px;color:${MUTED};text-decoration:underline;cursor:pointer}
        .ob-tk-manualform{margin-top:12px;padding:12px;border:1px solid ${BORDER};border-radius:10px;background:${CARD};color:${TEXT}}
        .ob-tk-manualform label{display:block;font-size:12px;font-weight:500;color:${TEXT}}
        .ob-tk-manualform input{display:block;margin-top:6px;padding:7px 10px;border:1px solid ${BORDER};border-radius:8px;background:${CARD};font:inherit;font-size:13px;color:${TEXT}}
        .ob-dp-empty{padding:18px;border-radius:12px;border:1px dashed #e3ded6;font-size:12.5px;line-height:1.5;color:${MUTED};text-align:center}
        /* Copie rapide : l'icône apparaît au survol de la ligne ; une bulle confirme. */
        .ob-copy{position:relative;display:inline-flex;align-items:center;gap:6px;flex-shrink:0;border:0;background:transparent;padding:0;font:inherit;color:#a8a39b;cursor:pointer;transition:color .15s}
        .ob-copy-ic{display:grid;place-items:center;width:24px;height:24px;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .15s}
        .ob-copy:not(.has-text) .ob-copy-ic{opacity:0}
        .ob-prop:hover .ob-copy .ob-copy-ic,.ob-copy:focus-visible .ob-copy-ic,.ob-copy.is-done .ob-copy-ic{opacity:1}
        .ob-copy:hover{color:${NAVY}}
        .ob-copy:hover .ob-copy-ic{transform:translateY(-1px) scale(1.12)}
        .ob-copy.is-done,.ob-copy.is-done:hover{color:${GREEN}}
        .ob-copy.is-fail{color:#c5221f}
        .ob-copy.has-text{color:${TEXT};font-size:12px;font-weight:500}
        .ob-copy.has-text .ob-copy-ic{width:18px;height:18px;opacity:0}
        .ob-copy.has-text:hover .ob-copy-ic,.ob-copy.has-text.is-done .ob-copy-ic{opacity:1}
        .ob-copy-tip{position:absolute;left:50%;bottom:calc(100% + 6px);z-index:5;padding:3px 8px;border-radius:6px;background:#2b2927;color:#fff;font-size:11px;font-weight:500;white-space:nowrap;pointer-events:none}
        @media (hover:none){.ob-copy .ob-copy-ic{opacity:1!important}}
        /* Fil d'échanges : zone de saisie avec sa barre, messages aérés, menu « ⋯ », réponses en fil. */
        .ob-composer{border:1px solid ${BORDER};border-radius:12px;background:${CARD};transition:border-color .16s,box-shadow .16s}
        .ob-composer:focus-within{border-color:#d8d3cb;box-shadow:0 0 0 3px rgba(43,41,39,.05)}
        .ob-composer-ta{display:block;width:100%;min-height:58px;border:0;outline:0;resize:none;background:transparent;padding:12px 14px 8px;font:inherit;font-size:13.5px;line-height:1.55;color:${TEXT}}
        .ob-composer-ta::placeholder{color:#a8a39b}
        .ob-composer-bar{display:flex;align-items:center;gap:8px;padding:8px 10px 10px 12px;border-top:1px solid #f4f2ee}
        .ob-composer-tool{display:grid;place-items:center;width:28px;height:28px;border:0;background:transparent;padding:0;color:${MUTED};font:inherit;font-size:16px;font-weight:500;cursor:pointer;transition:color .15s,transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-composer-tool:hover{color:${NAVY};transform:translateY(-1px) scale(1.15)}
        .ob-composer .wc-add-weather{padding:5px 10px 5px 8px;border:1px solid ${BORDER};border-radius:8px;background:${CARD};color:${TEXT};font-size:12px;font-weight:500}
        .ob-composer .wc-add-weather:hover{background:${CARD};border-color:#e3ded6}
        .ob-composer .wc-add-weather svg{width:16px;height:16px;color:#c2500e;transition:transform .4s cubic-bezier(.34,1.56,.64,1)}
        .ob-composer .wc-add-weather:hover svg{transform:rotate(35deg) scale(1.12)}
        .ob-composer-hint{margin-left:auto;font-size:11px;color:#c9c4bc;white-space:nowrap}
        .ob-composer-send{padding:7px 16px;border:0;border-radius:9px;background:#2b2927;color:#fff;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,transform .15s}
        .ob-composer-send:not(:disabled):active{transform:scale(.97)}
        .ob-composer-send:disabled{background:#f1eee9;color:#a8a39b;cursor:default}
        .ob-thread-notice{margin:10px 2px 0;font-size:12px;font-weight:500;color:${GREEN}}
        .ob-thread-error{margin:10px 2px 0;font-size:12px;color:#c5221f}
        .ob-thread-error button{margin-left:6px;border:0;background:transparent;padding:0;font:inherit;font-weight:500;color:#c5221f;text-decoration:underline;cursor:pointer}
        .ob-thread-empty{margin:18px 2px;font-size:12.5px;color:${MUTED}}
        .ob-thread-more{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:10px;padding:9px 0;border:1px solid ${BORDER};border-radius:10px;background:${CARD};font:inherit;font-size:12.5px;font-weight:500;color:${TEXT};cursor:pointer;transition:border-color .15s,background .15s}
        .ob-thread-more:hover{border-color:#e3ded6;background:#faf9f7}
        .ob-thread-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 4px}
        .ob-thread-count{font-size:12.5px;font-weight:500;color:${MUTED}}
        .ob-seg-mini{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:#f7f5f2}
        .ob-seg-mini button{position:relative;border:0;background:transparent;padding:4px 11px;border-radius:7px;font:inherit;font-size:12px;font-weight:500;color:${MUTED};cursor:pointer;transition:color .15s}
        .ob-seg-mini button.is-on,.ob-seg-mini button:hover{color:${TEXT}}
        .ob-seg-mini button>span:last-child{position:relative;z-index:1}
        .ob-seg-mini-pill{position:absolute;inset:0;z-index:0;border-radius:7px;background:${CARD};box-shadow:0 1px 2px rgba(43,41,39,.084)}
        /* Échanges en cartes (réf. de carte de commentaire) : en-tête avatar · nom · ancienneté · ⋯, contenu aligné
           sur le nom, réponses reliées par un fil. Survol : la carte se pose un peu plus nettement. */
        .ob-thread{display:flex;flex-direction:column;gap:10px;margin-top:12px}
        .ob-xc{padding:14px 16px 12px;border:1px solid #f1eee9;border-radius:18px;background:${CARD};box-shadow:0 1px 2px rgba(43,41,39,.021);transition:border-color .2s,box-shadow .2s}
        .ob-xc:hover{border-color:#e8e4de;box-shadow:0 4px 14px rgba(43,41,39,.035)}
        .ob-xc-head{display:flex;align-items:center;gap:8px;min-height:30px}
        .ob-xc-head>:first-child{margin-right:2px}
        .ob-xc-author{font-size:13.5px;font-weight:500;color:${TEXT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ob-xc-author.is-small{font-size:12.5px}
        .ob-xc-time{min-width:0;font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ob-xc-head .ob-menu{margin-left:auto}
        .ob-xc-in{padding-left:40px}
        .ob-xc-text{margin-top:2px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13.5px;line-height:1.6;color:#55514b}
        .ob-xc-chip{display:inline-flex;align-items:center;gap:6px;margin:4px 0 6px;padding:3px 10px 3px 7px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap}
        .ob-xc-chip .mi{transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
        .ob-xc:hover .ob-xc-chip .mi{transform:rotate(-8deg) scale(1.08)}
        .ob-xc-qual .wc-summary{margin:2px 0 0;border:0;border-radius:14px;background:#f7f5f2}
        .ob-xc-qual .wc-summary>div{padding:10px 14px}
        .ob-xc-qual .wc-summary>div+div{border-top:1px solid #f1eee9}
        .ob-xc-qual .wc-summary dt{font-size:11px;color:${MUTED}}
        .ob-xc-foot{display:flex;align-items:flex-start;gap:10px;margin-top:10px}
        .ob-xc-foot .br{flex:1;margin-top:0}
        .ob-xc-foot .ob-xc-reply{height:28px;flex-shrink:0}
        .ob-xr .br{margin-top:8px}
        .ob-xr .br .br-add{display:none}
        .ob-xr-tools{display:flex;align-items:center;gap:2px;margin-left:auto}
        .ob-xr-tools .br-add{width:24px;height:24px;border:0;opacity:0;transition:opacity .15s,color .15s}
        .ob-xr:hover .ob-xr-tools .br-add,.ob-xr-tools .br-add[aria-expanded="true"]{opacity:1}
        @media (hover:none){.ob-xr-tools .br-add{opacity:1}}
        .ob-xr.is-fresh{animation:obFresh 1.8s cubic-bezier(.22,1,.36,1)}
        @keyframes obFresh{0%{opacity:0;transform:translateY(-6px);background:#fbf1c2}18%{opacity:1;transform:none;background:#fbf1c2}100%{background:#faf9f7}}
        /* Réponse sous le message : une ligne de saisie avec son avatar et l'envoi en avion. */
        .ob-xi{overflow:hidden}
        .ob-xi-box{display:flex;align-items:flex-end;gap:8px;margin-top:10px;padding:6px 6px 6px 8px;border:1px solid #e8e4de;border-radius:14px;background:${CARD};transition:border-color .15s,box-shadow .15s}
        .ob-xi-box:focus-within{border-color:#d8d3cb;box-shadow:0 0 0 3px rgba(43,41,39,.05)}
        .ob-xi-box>:first-child{margin-bottom:4px}
        .ob-xi-ta{flex:1;min-width:0;min-height:30px;max-height:160px;padding:5px 2px;border:0;outline:0;resize:none;background:transparent;font:inherit;font-size:13.5px;line-height:1.5;color:${TEXT}}
        .ob-xi-send{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border:0;border-radius:50%;background:#2b2927;color:#fff;cursor:pointer;transition:background .15s,opacity .15s}
        .ob-xi-send svg{transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
        .ob-xi-send:hover:not(:disabled) svg{transform:translate(2px,-2px) rotate(-8deg)}
        .ob-xi-send:disabled{opacity:.3;cursor:default}
        .ob-xc-reply[aria-expanded="true"]{color:${NAVY}}
        .ob-xc .br-add{opacity:0;transition:opacity .15s,color .15s,border-color .15s}
        .ob-xc:hover .br-add,.ob-xc:focus-within .br-add,.ob-xc .br-add[aria-expanded="true"]{opacity:1}
        @media (hover:none){.ob-xc .br-add{opacity:1}}
        .ob-composer.is-drag{border-color:#d8d3cb;background:#faf9f7}
        .ob-xc-reply{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:2px 0;font:inherit;font-size:12.5px;font-weight:500;color:${MUTED};cursor:pointer;transition:color .15s}
        .ob-xc-reply svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-xc-reply:hover{color:${NAVY}}
        .ob-xc-reply:hover svg{transform:translateX(-2px) rotate(-8deg)}
        /* « Voir plus » : le texte s'arrête en fondu, s'ouvre en douceur. */
        .ob-clamp-in{overflow:hidden;transition:max-height .38s cubic-bezier(.22,1,.36,1)}
        .ob-clamp.is-clamped .ob-clamp-in{-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 26px),transparent)}
        .ob-clamp-more{display:inline-flex;align-items:center;gap:4px;margin-top:4px;border:0;background:transparent;padding:2px 0;font:inherit;font-size:12.5px;font-weight:500;color:${NAVY};cursor:pointer}
        .ob-clamp-more svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-clamp-more:hover svg{transform:translateY(1px)}
        .ob-clamp-more[aria-expanded="true"] svg{transform:rotate(180deg)}
        /* Avatars empilés et fil des réponses. */
        .ob-stack{display:inline-flex;flex-shrink:0}
        .ob-stack>span{display:block;margin-left:-7px;border-radius:50%;box-shadow:0 0 0 2px ${CARD}}
        .ob-stack>span:first-child{margin-left:0}
        .ob-xt{margin-top:12px;padding-top:12px;border-top:1px solid #f4f2ee}
        .ob-xt-sum{display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:0;font:inherit;font-size:12.5px;color:${MUTED};cursor:pointer;text-align:left}
        .ob-xt-sum b{font-weight:500;color:${TEXT}}
        .ob-xt-sum>svg{flex-shrink:0;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-xt-sum[aria-expanded="true"]>svg{transform:rotate(180deg)}
        .ob-xt-sum:hover b{color:${NAVY}}
        .ob-xt-list{display:flex;flex-direction:column;gap:8px;padding:8px 0 0 30px;overflow:hidden}
        .ob-xr{position:relative;padding:10px 12px;border:1px solid #f4f2ee;border-radius:14px;background:#faf9f7}
        .ob-xr::before{content:"";position:absolute;left:-20px;top:-8px;width:14px;height:31px;border-left:1.5px solid #e8e4de;border-bottom:1.5px solid #e8e4de;border-bottom-left-radius:10px}
        .ob-xr:not(:last-child)::after{content:"";position:absolute;left:-20px;top:22px;bottom:-9px;border-left:1.5px solid #e8e4de}
        .ob-xr .ob-xc-head{min-height:24px}
        .ob-xr-in{padding-left:31px}
        .ob-dot{display:inline-block;flex-shrink:0;width:3px;height:3px;border-radius:50%;background:#d8d3cb}
        .ob-msg-edit{margin-top:6px;border:1px solid ${BORDER};border-radius:10px;background:${CARD};transition:border-color .16s,box-shadow .16s}
        .ob-msg-edit:focus-within{border-color:#d8d3cb;box-shadow:0 0 0 3px rgba(43,41,39,.05)}
        .ob-msg-edit .ob-composer-ta{min-height:0;padding:10px 12px 6px}
        .ob-msg-edit .ob-msg-panel-bar{padding:0 8px 8px}
        .ob-msg-panel{margin-top:10px;padding:12px;border:1px solid ${BORDER};border-radius:10px;background:#faf9f7}
        .ob-msg-panel-bar{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:8px}
        .ob-msg-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px;padding:8px 10px;border-radius:9px;background:#fdf2f1;font-size:12.5px;font-weight:500;color:${TEXT}}
        .ob-msg-confirm>span{margin-right:auto}
        .ob-btn-ghost{padding:6px 12px;border:1px solid ${BORDER};border-radius:8px;background:${CARD};color:${TEXT};font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}
        .ob-btn-ghost:hover{border-color:#e3ded6}
        .ob-btn-danger{padding:6px 12px;border:0;border-radius:8px;background:#c5221f;color:#fff;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}
        .ob-btn-danger:disabled{opacity:.6;cursor:default}
        .ob-menu{position:relative;display:inline-flex}
        .ob-menu-btn{display:grid;place-items:center;width:28px;height:24px;border:0;background:transparent;padding:0;color:#a8a39b;cursor:pointer;transition:color .15s}
        .ob-menu-btn svg{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-menu-btn:hover,.ob-menu-btn[aria-expanded="true"]{color:${NAVY}}
        .ob-menu-btn:hover svg{transform:scale(1.18)}
        .ob-menu-pop{position:absolute;right:0;top:calc(100% + 4px);z-index:20;min-width:200px;padding:5px;border:1px solid ${BORDER};border-radius:14px;background:${CARD};box-shadow:0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04);transform-origin:top right}
        .ob-menu-item{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;border-radius:7px;background:transparent;font:inherit;font-size:12.5px;font-weight:500;color:${TEXT};text-align:left;cursor:pointer}
        .ob-menu-item svg{color:${MUTED}}
        .ob-menu-item:hover{background:#f7f5f2}
        .ob-menu-item.is-danger,.ob-menu-item.is-danger svg{color:#c5221f}
        .ob-menu-item.is-danger:hover{background:#fde6e6}
        /* Barre de filtres : une carte, une ligne par famille, un libellé par ligne. */
        .ob-filters{container-type:inline-size;background:${CARD};border:1px solid ${BORDER};border-radius:22px;padding:3px 18px;margin-bottom:14px}
        .ob-frow{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:10px 0}
        .ob-frows{border-top:1px solid #f1eee9}
        .ob-frow--alerts{border-top:1px solid #f1eee9}
        .ob-frows>.ob-frow+.ob-frow{border-top:1px solid #f1eee9}
        .ob-flabel{flex:0 0 56px;font-size:10.5px;font-weight:500;letter-spacing:.09em;text-transform:uppercase;color:#a8a39b}
        .ob-fgroup{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
        @container (min-width: 1400px){
          .ob-frows{display:flex;align-items:center;gap:24px}
          .ob-frows>.ob-frow+.ob-frow{border-top:0;margin-left:auto}
          .ob-frow--refine .ob-flabel{flex:none}
        }
        .ob-n{font-size:11px;font-weight:500;color:${MUTED};font-variant-numeric:tabular-nums;transition:color .18s}
        /* États : contrôle segmenté, la pastille marine glisse d'un onglet à l'autre. */
        .ob-seg{display:inline-flex;align-items:center;flex-wrap:wrap;gap:2px;padding:3px;background:#ebe8e3;border-radius:12px}
        .ob-seg-btn{position:relative;border:0;background:transparent;border-radius:9px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:500;color:#55514b;cursor:pointer;white-space:nowrap;transition:background .16s,color .18s}
        .ob-seg-btn:not(.is-on):hover{background:rgba(255,255,255,.55)}
        .ob-seg-btn.is-on{color:#1c1b19}
        .ob-seg-btn.is-on .ob-n{color:#8b867e}
        .ob-seg-pill{position:absolute;inset:0;background:#fff;border-radius:9px;z-index:0;box-shadow:0 1px 2px rgba(43,41,39,.06),0 0 0 1px rgba(43,41,39,.04)}
        .ob-seg-txt{position:relative;z-index:1;display:flex;align-items:center;gap:7px}
        /* Icônes des onglets : rebond à l'activation, un geste propre à chacune au survol. */
        .ob-tab-ic{flex-shrink:0;margin-right:-1px;overflow:visible;transition:color .18s}
        .ob-tab-ic path,.ob-tab-ic rect{transition:fill .18s}
        .ob-seg-btn.is-on .ob-tab-ic{animation:obPop .45s cubic-bezier(.34,1.56,.64,1)}
        .ob-ti-l1,.ob-ti-l3{transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
        .ob-seg-btn:hover .ob-ti-l1{transform:translateY(-2.2px)}
        .ob-seg-btn:hover .ob-ti-l3{transform:translateY(1.8px)}
        .ob-ti-check{stroke-dasharray:1}
        @keyframes obTiDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
        .ob-seg-btn:hover .ob-ti-check{animation:obTiDraw .42s cubic-bezier(.65,0,.35,1)}
        .ob-ti-glass{transform-box:fill-box;transform-origin:center;transition:transform .6s cubic-bezier(.34,1.4,.64,1)}
        .ob-seg-btn:hover .ob-ti-glass{transform:rotate(180deg)}
        .ob-ti-x{stroke-dasharray:1}
        .ob-seg-btn:hover .ob-ti-x{animation:obTiDraw .24s cubic-bezier(.65,0,.35,1) backwards}
        .ob-seg-btn:hover .ob-ti-x2{animation-delay:.14s}
        @keyframes obTiOut{0%,100%{transform:none}45%{transform:translateX(-2.2px)}70%{transform:translateX(.6px)}}
        .ob-seg-btn:hover .ob-ti-arrow{animation:obTiOut .55s cubic-bezier(.34,1.3,.64,1)}
        @keyframes obTiStrike{0%,100%{transform:none}35%{transform:rotate(-16deg)}58%{transform:rotate(9deg)}74%{transform:rotate(4deg)}}
        .ob-ti-gavel{transform-box:view-box;transform-origin:4px 19.2px}
        .ob-seg-btn:hover .ob-ti-gavel{animation:obTiStrike .6s cubic-bezier(.34,1.3,.64,1)}
        /* Météo : puces à bascule, l'icône se redresse au survol. */
        .ob-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;border:1px solid ${BORDER};background:${CARD};color:${TEXT};font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .18s,border-color .18s,color .18s}
        .ob-chip:not(.is-on):hover{background:#f7f5f2;border-color:#e3ded6}
        .ob-chip-ic{display:inline-flex;transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
        .ob-chip:hover .ob-chip-ic{transform:translateY(-1px) scale(1.14)}
        /* Menus : rectangle arrondi, la flèche pivote à l'ouverture. */
        .ob-trigger{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:10px;border:1px solid ${BORDER};background:${CARD};color:${TEXT};font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .16s,border-color .16s,color .16s}
        .ob-trigger:not(.is-on):not(:disabled):hover{background:#f7f5f2;border-color:#e3ded6}
        .ob-trigger.is-open{border-color:${NAVY}}
        .ob-trigger.is-on{background:#2b2927;border-color:${NAVY};color:#fff}
        .ob-trigger:disabled{opacity:.55;cursor:default;color:${MUTED}}
        .ob-trigger>svg:first-child{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-trigger:not(:disabled):hover>svg:first-child{transform:translateY(-1px) scale(1.1)}
        .ob-caret{flex-shrink:0;transition:transform .22s cubic-bezier(.22,1,.36,1)}
        .ob-trigger.is-open .ob-caret{transform:rotate(180deg)}
        /* Filtres posés : une étiquette par filtre. */
        .ob-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:12px;min-height:38px}
        .ob-left{display:flex;align-items:center;gap:10px;margin-right:8px}
        .ob-left>span{font-size:10.5px;font-weight:500;line-height:1.25;letter-spacing:.08em;text-transform:uppercase;color:#a8a39b;text-align:right}
        .ob-left-label{display:block;max-width:112px}
        .ob-left-text{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;will-change:transform,opacity}
        .ob-active{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;flex:1;min-width:0;padding:0 4px}
        .ob-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 10px;border-radius:999px;background:#f4f2ee;color:${TEXT};font-size:12px;font-weight:500;white-space:nowrap}
        .ob-tag small{font-size:11px;font-weight:500;color:${MUTED}}
        .ob-tag button{display:grid;place-items:center;width:18px;height:18px;border:0;border-radius:50%;background:transparent;color:${MUTED};cursor:pointer;transition:background .14s,color .14s}
        .ob-tag button:hover{background:#e8e4de;color:${TEXT}}
        .ob-clear{border:0;background:transparent;padding:0 4px;color:#55514b;font:inherit;font-size:12px;font-weight:500;cursor:pointer}
        /* Tableau : une carte ; l'ascenseur vit dedans (pas de piste, pouce fin et arrondi), commence sous
           l'en-tête collant (40 px) et s'arrête avant les coins arrondis. */
        .ob-table-wrap{background:${CARD};border:1px solid ${BORDER};border-radius:14px;overflow:auto;max-height:calc(100vh - 190px)}
        .ob-table-wrap.is-sliding{overflow-x:hidden}
        .ob-table-wrap::-webkit-scrollbar{width:12px;height:12px}
        .ob-table-wrap::-webkit-scrollbar-track{background:transparent}
        .ob-table-wrap::-webkit-scrollbar-track:vertical{margin:40px 0 10px}
        .ob-table-wrap::-webkit-scrollbar-track:horizontal{margin:0 12px}
        .ob-table-wrap::-webkit-scrollbar-thumb{background-color:#e3ded6;border:4px solid transparent;border-radius:999px;background-clip:padding-box}
        .ob-table-wrap:hover::-webkit-scrollbar-thumb{background-color:#cfc9c0}
        .ob-table-wrap::-webkit-scrollbar-thumb:hover{background-color:#a8a39b}
        .ob-table-wrap::-webkit-scrollbar-corner{background:transparent}
        @supports not selector(::-webkit-scrollbar){.ob-table-wrap{scrollbar-width:thin;scrollbar-color:#d8d3cb transparent}}
        .ob-row{cursor:pointer;transition:background .14s}
        .ob-row:hover{background:#faf9f7}
        .ob-row.is-sel{background:#f4f2ee}
                .ob-edit{color:${MUTED};opacity:0;transition:opacity .16s}
        .ob-row:hover .ob-edit{opacity:.7}
        /* No show : une petite carte ; le fantôme flotte au-dessus de son ombre, cligne des yeux, fait « bouh » au survol. */
        .ob-noshow{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 5px;border-radius:8px;background:#fdeeee;box-shadow:inset 0 0 0 1px #f7d4d1;color:#c5221f;font-size:11px;font-weight:500;white-space:nowrap;transition:background .18s,box-shadow .18s}
        .ob-noshow:hover{background:#fbe2e0;box-shadow:inset 0 0 0 1px #f1bdb8}
        @keyframes obGhostFloat{0%,100%{transform:translateY(.4px) rotate(-4deg)}50%{transform:translateY(-2.4px) rotate(4deg)}}
        @keyframes obGhostShadow{0%,100%{transform:scaleX(1);opacity:.22}50%{transform:scaleX(.6);opacity:.09}}
        @keyframes obGhostBlink{0%,91%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
        @keyframes obGhostBoo{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-3.5px) scale(1.28) rotate(-7deg)}55%{transform:translateY(-1px) scale(.94) rotate(5deg)}78%{transform:translateY(-1.6px) scale(1.04) rotate(-2deg)}100%{transform:translateY(0) scale(1)}}
        /* Le fantôme flotte au survol de sa ligne ou de son bouton : en boucle sur chaque ligne, ces animations SVG
           faisaient recalculer toute la page à chaque image, même au repos (mesuré le 29/10/2026). */
        .ob-ghost-body{transform-box:fill-box;transform-origin:50% 85%}
        .ob-ghost-shadow{transform-box:fill-box;transform-origin:center;opacity:.2}
        .ob-ghost-eye{transform-box:fill-box;transform-origin:center}
        :is(.ob-row,button,[role="button"]):hover .ob-ghost-body{animation:obGhostFloat 3s ease-in-out var(--ob-ghost-delay,0s) infinite}
        :is(.ob-row,button,[role="button"]):hover .ob-ghost-shadow{animation:obGhostShadow 3s ease-in-out var(--ob-ghost-delay,0s) infinite}
        :is(.ob-row,button,[role="button"]):hover .ob-ghost-eye{animation:obGhostBlink 4.8s ease-in-out var(--ob-ghost-delay,0s) infinite}
        .ob-noshow:hover .ob-ghost-body{animation:obGhostBoo .75s cubic-bezier(.34,1.56,.64,1)}
        /* Météo : la tuile se soulève au survol. */
        .ob-meteo-tile{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-meteo:not(:disabled):hover .ob-meteo-tile{transform:translateY(-1px) scale(1.08)}
        /* État : l'icône se redresse au survol et rebondit une fois quand l'état change. */
        .ob-etat-ic{display:inline-flex;transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
        .ob-etat:hover .ob-etat-ic{transform:rotate(-14deg) scale(1.1)}
        @keyframes obPop{0%{transform:scale(.55);opacity:.4}60%{transform:scale(1.14);opacity:1}100%{transform:scale(1)}}
        .ob-etat-ic.is-pop{animation:obPop .45s cubic-bezier(.34,1.56,.64,1)}
        /* Secteur : l'icône se soulève au survol de la ligne. */
        .ob-sector{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;font-weight:500}
        .ob-sector-ic{flex-shrink:0;transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
        .ob-row:hover .ob-sector-ic{transform:translateY(-1px) rotate(-6deg) scale(1.12)}
        /* Fenêtre météo : le contenu arrive en cascade après le ressort de la fenêtre ; les icônes éclosent.
           Remplissage « backwards » : une fois jouée, l'animation rend la main aux effets de survol. */
        @keyframes obWcRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes obWcTile{from{opacity:0;transform:translateY(12px) scale(.9)}to{opacity:1;transform:none}}
        @keyframes obWcBloom{0%{opacity:0;transform:scale(.3) rotate(-20deg)}60%{opacity:1;transform:scale(1.18) rotate(5deg)}100%{opacity:1;transform:none}}
        .ob-meteo-dialog .wc-heading{animation:obWcRise .42s cubic-bezier(.16,1,.3,1) .05s backwards}
        .ob-meteo-dialog .wc-symbol svg{animation:obWcBloom .55s cubic-bezier(.34,1.56,.64,1) .1s backwards}
        .ob-meteo-dialog .wc-choices>button{animation:obWcTile .5s cubic-bezier(.34,1.4,.64,1) backwards;transition:transform .25s cubic-bezier(.34,1.56,.64,1),background .18s,border-color .18s,box-shadow .18s}
        .ob-meteo-dialog .wc-choices>button>svg{animation:obWcBloom .6s cubic-bezier(.34,1.56,.64,1) backwards;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        ${[1, 2, 3, 4, 5].map((i) => `.ob-meteo-dialog .wc-choices>button:nth-child(${i}){animation-delay:${0.09 + i * 0.045}s}.ob-meteo-dialog .wc-choices>button:nth-child(${i})>svg{animation-delay:${0.16 + i * 0.045}s}`).join("")}
        .ob-meteo-dialog .wc-choices>button:hover{transform:translateY(-2px)}
        .ob-meteo-dialog .wc-choices>button:hover>svg{transform:scale(1.14) rotate(-6deg)}
        .ob-meteo-dialog .wc-choices>button:active{transform:translateY(0) scale(.97)}
        .ob-meteo-dialog footer{animation:obWcRise .4s cubic-bezier(.16,1,.3,1) .34s backwards}
        .ob-meteo-dialog .wc-description,.ob-meteo-dialog .wc-form,.ob-meteo-dialog .wc-note,.ob-meteo-dialog .wc-recipients,.ob-meteo-dialog .wc-delivery{animation:obWcRise .36s cubic-bezier(.16,1,.3,1) backwards}
        @media (prefers-reduced-motion: reduce){.ob-meteo-dialog *{animation:none!important;transition:none!important}}
        @media (prefers-reduced-motion: reduce){.ob-chip-ic,.ob-trigger>svg:first-child,.ob-caret,.ob-seg-btn,.ob-chip,.ob-trigger,.ob-etat-ic,.ob-row,.ob-edit,.ob-meteo-tile,.ob-ghost-body,.ob-ghost-shadow,.ob-ghost-eye,.ob-noshow,.ob-sector-ic,.ob-tab-ic,.ob-tab-ic *{transition:none!important;animation:none!important}}
      `}</style>
      {/* Échec d'enregistrement : l'UI a été restaurée (rollback), on le DIT clairement. */}
      <AnimatePresence>
        {saveError && (
          <motion.div initial={{ opacity: 0, y: -10, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -10, x: "-50%" }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="alert" style={{ maxWidth: "min(620px, calc(100vw - 32px))", lineHeight: 1.5, position: "fixed", top: 16, left: "50%", zIndex: 10060, background: "#c5221f", color: "#fff", padding: "9px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 500, boxShadow: "0 8px 24px rgba(180,35,24,0.32)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{saveError}</span>
            <button type="button" aria-label="Fermer le message" onClick={() => setSaveError("")} style={{ background: "none", border: 0, color: "inherit", fontSize: 20, cursor: "pointer" }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", color: NAVY, marginBottom: 18 }}>Board Cabinet partenaire</div>
      {/* Barre de filtres (dev 28/10/2026 : « séparer les choses ») : trois familles nommées, chacune sa forme.
          États = contrôle segmenté (la pastille glisse d'un onglet à l'autre), Météo = puces à bascule,
          Affiner = menus. Le filtrage ne change pas : mêmes onglets, mêmes unions, mêmes menus qu'avant. */}
      <div className="ob-filters">
        <div className="ob-frow">
          <span className="ob-flabel">États</span>
          <div className="ob-seg" role="group" aria-label="États du client">
            {PRIMARY_TABS.map((t) => {
              const active = t === "Tous"
                ? (multiFilter.length === 0 && etatFilter === "Tous")
                : (multiFilter.includes(t) || (multiFilter.length === 0 && etatFilter === t));
              // Pilule animée uniquement en sélection unique : plusieurs éléments
              // partageant un layoutId feraient sauter l'animation Framer Motion.
              const soloPill = active && multiFilter.length <= 1;
              const n = t === "Tous" ? establishedCount : (counts[t] || 0);
              return (
                <motion.button key={t} type="button" onClick={() => pickTab(t)} whileTap={{ scale: 0.97 }} aria-pressed={active}
                  className={`ob-seg-btn${active ? " is-on" : ""}`}>
                  {active && (soloPill
                    ? <motion.span layoutId="obActiveTab" className="ob-seg-pill" transition={{ type: "spring", stiffness: 560, damping: 42 }} />
                    : <span className="ob-seg-pill" />)}
                  <span className="ob-seg-txt"><TabIcon tab={t} on={active} />{tabLabel(t)}<span className="ob-n">{n}</span></span>
                </motion.button>
              );
            })}
          </div>
          <FilterMenu label="Autres états" cats={SECONDARY_CATS} counts={counts} selected={multiFilter.filter((c) => SECONDARY_CATS.includes(c))}
            onToggle={toggleCat} onClear={() => setMultiFilter((p) => p.filter((c) => PRIMARY_TABS.includes(c)))} />
        </div>
        {/* Alertes (dev 29/10/2026) : les clients à traiter d'un coup d'œil. Ce sont des critères (ils se cumulent
            avec les états) sauf « En pause », qui est un état. « Impayés » n'existe que si le board envoie le retard. */}
        <div className="ob-frow ob-frow--alerts">
          <span className="ob-flabel">Alertes</span>
          <div className="ob-fgroup" role="group" aria-label="Alertes clients">
            {ALERT_FILTERS.filter((a) => a.cat !== "Impayés" || rows.some((r) => r.finance_overdue_months != null)).map((a) => {
              const on = multiFilter.includes(a.cat);
              return (
                <motion.button key={a.cat} type="button" whileTap={{ scale: 0.96 }} aria-pressed={on} title={a.hint} onClick={() => toggleCat(a.cat)}
                  className={`ob-chip ob-alert-chip${on ? " is-on" : ""}`} style={{ "--al-tile": a.tile, "--al-ink": a.ink }}>
                  <span className="ob-chip-ic"><svg className={`al al-${a.key}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{a.icon}</svg></span>
                  {a.label}
                  <span className="ob-n">{counts[a.cat] || 0}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
        {/* Météo et Affiner : une ligne chacun, côte à côte quand la barre est assez large. */}
        <div className="ob-frows">
          <div className="ob-frow">
            {/* Météo client : puces directes (demande dev 2026-09-03), multi-sélection = union. */}
            <span className="ob-flabel">Météo</span>
            <div className="ob-fgroup" role="group" aria-label="Météo client">
              {["5", "4", "3", "2", "1", "none"].map((b, i) => {
                const st = b === "none"
                  ? { label: "Non noté", bg: "#f4f2ee", fg: MUTED, dot: "#d8d3cb" }
                  : { label: WEATHER[b].label, bg: WEATHER[b].bg, fg: WEATHER[b].color, dot: WEATHER[b].color };
                const on = meteoFilter.includes(b);
                return (
                  <motion.button key={b} type="button" whileTap={{ scale: 0.96 }} title={`Météo client : ${st.label}`} aria-pressed={on}
                    onClick={() => { navTo(10 + i); setMeteoFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])); }}
                    className={`ob-chip${on ? " is-on" : ""}`}
                    style={on ? { background: st.bg, borderColor: st.dot, color: st.fg } : undefined}>
                    <span className="ob-chip-ic">
                      {b === "none"
                        ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px dashed ${st.dot}`, display: "inline-block" }} />
                        : <MeteoIcon score={Number(b)} size={14} color={on ? st.fg : st.dot} />}
                    </span>
                    {st.label}
                    <span className="ob-n" style={on ? { color: st.fg } : undefined}>{meteoCounts[b] || 0}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
          {/* Affiner : dates, onboarding et programmes, chacun dans UN menu (demande dev 2026-09-03). */}
          <div className="ob-frow ob-frow--refine">
            <span className="ob-flabel">Affiner</span>
            <div className="ob-fgroup">
              <SigDateFilter from={sigRange.from} to={sigRange.to} onChange={setSigRange}
                months={dateTarget === "onboarding" ? onbMonths : sigMonths}
                target={dateTarget} onTarget={setDateTarget} />
              <ChecklistMenu label="Onboarding" title={`Onboarding Owner · ${onboardingCounts.total} client${onboardingCounts.total > 1 ? "s" : ""}`}
                icon={(c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
                items={[
                  { key: "venir", label: "Onboarding à venir", count: onboardingCounts.venir,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
                  { key: "done", label: "Onboarding réalisé", count: onboardingCounts.done,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></svg> },
                  // En attente de qualification (dev 10/11/2026) : cochés sans action du Client Success, ou action du
                  // Client Success sans onboarding coché. Ni réalisé ni à faire tant qu'il n'a pas tranché sur la fiche.
                  { key: "confirm", label: "Onboarding à confirmer", hint: "en attente de qualification", count: onboardingCounts.confirm,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg> },
                  { key: "todo", label: "Onboarding à faire", count: onboardingCounts.todo,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 14v4M12 14h.01" /></svg> },
                  { key: "noshow", label: "Onboarding no show", count: onboardingCounts.noshow,
                    icon: <span style={{ display: "inline-flex", color: MUTED }}><GhostIcon size={14} /></span> },
                  // Sous-ensemble de « à faire » et du no show (dev 10/11/2026 : les cinq cases additionnées
                  // dépassaient le nombre de clients) : affiché en retrait, « dont », jamais comme une case de plus.
                  { key: "recaler", label: "dont à recaler", sub: true, count: onboardingCounts.recaler,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg> },
                ]}
                selected={onboardingSel}
                onToggle={(k) => setOnboardingSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                onClear={() => setOnboardingSel([])} />
              <ChecklistMenu label="Programmes" title="Programmes clients"
                icon={(c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>}
                items={[
                  { key: "ambassadeur", label: "Programme ambassadeur", count: rows.filter((r) => r.ambassador_eligible).length,
                    icon: <span style={{ display: "inline-flex", color: MUTED }}><ProgramIcon kind="ambassadeur" size={14} /></span> },
                  { key: "parrainage", label: "Programme de parrainage", count: rows.filter((r) => r.parrainage_eligible).length,
                    icon: <span style={{ display: "inline-flex", color: MUTED }}><ProgramIcon kind="parrainage" size={14} /></span> },
                  { key: "temoignage", label: "Témoignage", count: rows.filter((r) => r.temoignage_eligible).length,
                    icon: <span style={{ display: "inline-flex", color: MUTED }}><ProgramIcon kind="temoignage" size={14} /></span> },
                ]}
                selected={programmeSel}
                onToggle={(k) => setProgrammeSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                onClear={() => setProgrammeSel([])} />
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'outils entre les filtres et le tableau (dev 28/10/2026) :
          à gauche, les filtres posés hors des onglets, une étiquette chacun, retirable d'un clic (le nombre de
          résultats, jugé inutile, a été retiré) ; à droite, la recherche et l'export. */}
      <div className="ob-toolbar">
        <div className="ob-active">
          <AnimatePresence initial={false}>
            {activeTags.map((tag) => (
              <motion.span key={tag.key} layout className="ob-tag"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.14 } }}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}>
                <small>{tag.group}</small>{tag.label}
                <button type="button" onClick={tag.clear} aria-label={`Retirer le filtre ${tag.group} : ${tag.label}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </motion.span>
            ))}
            {activeTags.length > 1 && (
              <motion.button key="clear" layout type="button" className="ob-clear" onClick={clearRefinements}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                Tout effacer
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div className="ob-left" title={counter.title}>
            <span className="ob-left-label">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={counter.label} className="ob-left-text"
                  initial={{ opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(2px)" }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
                  {counter.label}
                </motion.span>
              </AnimatePresence>
            </span>
            <AirportKPI label="" value={counter.value} minDigits={3} scale={0.66} />
          </div>
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 11, pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…"
              onFocus={(e) => { e.target.style.borderColor = "#d8d3cb"; e.target.style.boxShadow = "0 0 0 4px rgba(43,41,39,.05)"; }}
              onBlur={(e) => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = "none"; }}
              style={{ ...inputStyle, width: 260, padding: "9px 12px 9px 33px", borderRadius: 11, transition: "border-color 0.18s, box-shadow 0.18s" }} />
          </span>
          <motion.button type="button" className="ob-trigger" onClick={handleExportCsv} disabled={filtered.length === 0} whileTap={{ scale: 0.96 }}
            title="Exporter la vue filtrée au format CSV" style={{ padding: "8px 14px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exporter CSV
          </motion.button>
        </div>
      </div>

      {/* Fenêtre étroite ou zoomée (dev 27/10/2026) : le tableau garde une largeur minimale et défile horizontalement,
          au lieu d'écraser la colonne Client (noms coupés puis invisibles). */}
      <div className="ob-table-wrap" ref={tableWrapRef}>
        {loading ? (
          // Skeleton shimmer : la structure de la table se devine pendant le chargement.
          <div style={{ padding: "6px 0" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderTop: i ? `1px solid ${BORDER}` : "none", opacity: Math.max(0.25, 1 - i * 0.11) }}>
                <span className="ob-sk" style={{ width: 30, height: 30, borderRadius: "50%" }} />
                <span className="ob-sk" style={{ width: 170 - (i % 3) * 22, height: 12, borderRadius: 6 }} />
                <span className="ob-sk" style={{ width: 96, height: 22, borderRadius: 12, marginLeft: "auto" }} />
                <span className="ob-sk" style={{ width: 110, height: 12, borderRadius: 6 }} />
                <span className="ob-sk" style={{ width: 110, height: 12, borderRadius: 6 }} />
                <span className="ob-sk" style={{ width: 64, height: 12, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={view.dir}
            onExitComplete={() => { if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0; }}>
            {/* Une page par vue : la clé change avec les filtres, l'ancienne page sort, la nouvelle entre. Pendant la
                glissade, le défilement horizontal est coupé (sinon la page décalée ferait apparaître l'ascenseur). */}
            <motion.div key={view.key} custom={view.dir} variants={reduceMotion ? VIEW_FADE : VIEW_SLIDE}
              initial="enter" animate="center" exit="exit"
              onAnimationStart={() => tableWrapRef.current?.classList.add("is-sliding")}
              onAnimationComplete={(def) => { if (def === "center") tableWrapRef.current?.classList.remove("is-sliding"); }}>
              <table style={{ width: "100%", minWidth: TABLE_MIN_W, borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  {TABLE_COLS.map((w, i) => <col key={i} style={{ width: w + colExtra }} />)}
                  <col style={{ width: TABLE_CHEVRON_W }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}><span style={thIn}><UserRound {...thIc} />Client</span></th>
                    <th style={th}><span style={thIn}><Store {...thIc} />Secteur</span></th>
                    <th style={th}><span style={thIn}><CloudSun {...thIc} />Météo</span></th>
                    <th style={th}><span style={thIn}><CircleDashed {...thIc} />État</span></th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => clickSort("owner_signed")} title="Trier par date de signature">
                      <span style={thIn}><FileSignature {...thIc} />Contrat Owner<SortArrow dir={effectiveSort.col === "owner_signed" ? effectiveSort.dir : null} /></span>
                    </th>
                    <th style={th}><span style={thIn}><Scale {...thIc} />Contrat Opti'Lex</span></th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => clickSort("onboarding")} title="Trier par date d'onboarding">
                      <span style={thIn}><CalendarCheck {...thIc} />Onboarding<SortArrow dir={effectiveSort.col === "onboarding" ? effectiveSort.dir : null} /></span>
                    </th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r) => {
                    const key = rowKey(r);
                    return (
                      <BoardRow key={key} r={r} rk={key} isSel={selected === key}
                        newIdx={newIdxByKey.get(key)}   // undefined = déjà vue -> pas d'animation
                        noShow={viewFilter.situationOf(r) === "noshow"} renewal={etatFilter === "Renouvellement client"}
                        onSelect={setSelected} patch={patch} changeEtat={changeEtat} recordMeteo={recordMeteo} readOnly={readOnly} />
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr style={{ animation: "obRowIn 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
                      <td colSpan={8} style={{ ...td, textAlign: "center", padding: "52px 0" }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#d8d3cb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: MUTED }}>Aucun client</div>
                        <div style={{ fontSize: 12, color: "#c9c4bc", marginTop: 3 }}>Modifiez vos filtres ou votre recherche.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {moreRows && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selRow && <DetailPanel key="detail" row={selRow} onClose={closeDetail} reload={reloadBoard} reloadRatings={() => { mutSeq.current += 1; reloadBoard(); }} patch={patch} changeEtat={changeEtat} etatHistVersion={etatHistVersion} recordMeteo={recordMeteo} meteoHistVersion={meteoHistVersion} />}
      </AnimatePresence>
    </div>
  );
}

// Alerte : RDV d'intégration à venir mais contrat Opti'Lex non signé. Disparaît dès signature.
function OptilexAlertBadge() {
  return (
    <span title="RDV d'intégration à venir, mais le contrat Opti'Lex n'est pas signé"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 10, background: "#fde9da", color: "#c2500e", fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      Intégration prévue
    </span>
  );
}

// Badge "En retard" : RDV intégration dont la date est passée mais qui n'a PAS été marqué
// "effectué" (donc pas réalisé). Aide Lisa à repérer immédiatement les RDV qui ont dérapé.
function IntegrationOverdueBadge() {
  return (
    <span title="RDV d'intégration en retard : la date est passée mais il n'a pas été marqué « effectué »"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 10, background: "#fde6e6", color: "#c0392b", fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
      </svg>
      Intégration en retard
    </span>
  );
}

// Badge « No show » (dev 26/10/2026) : pastille en contour (ghost) dans la colonne Onboarding, même
// pictogramme que la ligne du menu ; la bulle dit pourquoi le client est compté en no show.
// Le client ne s'est pas présenté : un petit fantôme (dev 28/10/2026, « better ghost, better animation »).
// Un drap blanc cerné de la teinte du badge, qui s'estompe vers le bas ; yeux avec reflet, joues roses,
// bouche en « o ». Au survol de sa ligne ou de son bouton, il flotte au-dessus de son ombre (qui rétrécit quand
// il monte), son ourlet ondule (morphose du tracé entre deux phases de vague), il cligne des yeux ; il fait « bouh »
// au survol de sa pastille. Immobile au repos (29/10/2026) : animé en boucle, l'ourlet faisait redessiner toute la
// page 60 fois par seconde. `phase` décale le cycle d'un fantôme à l'autre pour qu'ils ne bougent pas ensemble.
const GHOST_HEM_A = "M5 18V10a7 7 0 0 1 14 0v8c-.78 1.9-3.89 1.9-4.67 0c-.78-1.4-3.89-1.4-4.67 0c-.78 1.9-3.89 1.9-4.66 0Z";
const GHOST_HEM_B = "M5 18V10a7 7 0 0 1 14 0v8c-.78-1.4-3.89-1.4-4.67 0c-.78 1.9-3.89 1.9-4.67 0c-.78-1.4-3.89-1.4-4.66 0Z";
function GhostIcon({ size = 18, phase = 0 }) {
  const reduce = useReducedMotion();
  const gid = `ob-ghost-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svgRef = useRef(null);
  const hemRef = useRef(null);
  useEffect(() => {
    const hem = hemRef.current;
    const svg = svgRef.current;
    const host = svg?.closest(".ob-row") || svg?.closest("button, [role='button'], .ob-noshow") || svg;
    if (!host || !hem?.beginElement) return undefined;
    const wave = () => hem.beginElement();
    const rest = () => hem.endElement();
    host.addEventListener("pointerenter", wave);
    host.addEventListener("pointerleave", rest);
    return () => { host.removeEventListener("pointerenter", wave); host.removeEventListener("pointerleave", rest); };
  }, [reduce]);
  return (
    <svg ref={svgRef} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, overflow: "visible", "--ob-ghost-delay": `-${phase}s` }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <ellipse className="ob-ghost-shadow" cx="12" cy="22.8" rx="5" ry="1.1" fill="currentColor" opacity="0.2" />
      <g className="ob-ghost-body">
        <path d={GHOST_HEM_A} fill={`url(#${gid})`} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          {!reduce && <animate ref={hemRef} begin="indefinite" attributeName="d" dur="1.5s" repeatCount="indefinite" values={`${GHOST_HEM_A};${GHOST_HEM_B};${GHOST_HEM_A}`} calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />}
        </path>
        <ellipse cx="7.7" cy="12.9" rx="1.05" ry=".6" fill="#f4a6a0" opacity=".75" />
        <ellipse cx="16.3" cy="12.9" rx="1.05" ry=".6" fill="#f4a6a0" opacity=".75" />
        <g className="ob-ghost-eye"><ellipse cx="9.5" cy="10.4" rx="1.15" ry="1.5" fill="currentColor" /><circle cx="9.85" cy="9.85" r=".38" fill="#fff" /></g>
        <g className="ob-ghost-eye"><ellipse cx="14.5" cy="10.4" rx="1.15" ry="1.5" fill="currentColor" /><circle cx="14.85" cy="9.85" r=".38" fill="#fff" /></g>
        <ellipse cx="12" cy="13.6" rx=".85" ry="1" fill="currentColor" />
      </g>
    </svg>
  );
}

function OnboardingNoShowBadge({ date }) {
  // Phase du fantôme tirée de la date : stable d'un rendu à l'autre, différente d'une ligne à l'autre.
  const phase = (hashStr(String(date || "")) % 30) / 10;
  return (
    <span className="ob-noshow" title={`No show : onboarding du ${fmt(date)} passé, ni coché réalisé ni noté par le Client Success`}>
      <GhostIcon size={18} phase={phase} />
      No show
    </span>
  );
}

// Sélecteur d'email de destination Opti'Lex : dropdown Owner / Opti'Lex (par SIREN) / historique.
// Pose email_ovr (via patch /board-tracking). Les 5 emails Opti'Lex + la relance contrat Yousign
// partent sur l'email sélectionné (backend). Réservé admin + ceo + optilex.
const EMAIL_SELECT_ROLES = ["admin", "ceo", "optilex", "customer_success_manager"];
const canSelectEmail = () => { try { return EMAIL_SELECT_ROLES.includes((apiClient.getUser() || {}).role); } catch { return false; } };
// Relance de la signature Opti'Lex : le cabinet (Lisa), l'admin et le CEO. Le Client Success ne
// relance jamais lui-même : il corrige l'adresse puis PRÉVIENT Lisa (règle du 24/09/2026).
const RELAUNCH_ROLES = ["admin", "ceo", "optilex"];
const ALERT_CABINET_ROLES = ["customer_success_manager", "admin", "ceo"];
const ONBOARDING_FLOW_ROLES = ["customer_success_manager", "admin", "ceo"];

// Onboarding « à confirmer, en attente de qualification » (dev 10/11/2026) : le Client Success tranche en un geste.
// « Réalisé » pose la date réelle (souvent passée) ; « Pas encore fait » le remet en « à faire ». Pur suivi : ni
// e-mail au client, ni agenda, ni facturation (même enregistrement que « Marquer l'onboarding réalisé sans le parcours »).
function OnboardingToConfirm({ row, onDone, onNotDone }) {
  const todayParis = _todayParisISO();
  const planned = String(row.rdv_onboarding_date_manual || row.rdv_onboarding_date || "").slice(0, 10);
  const [day, setDay] = useState(() => String(row.rdv_onboarding_done_date || "").slice(0, 10)
    || (planned && planned <= todayParis ? planned : todayParis));
  return (
    <div style={{ border: "1px solid #d6d4f6", background: "#f6f5fd", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#4a3fc4" }}>Onboarding à confirmer</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
        En attente de qualification : {row.rdv_onboarding_done ? "coché réalisé sans action du Client Success" : "le Client Success est intervenu, l'onboarding n'est pas coché"}.
        Le client n'est pas prévenu.
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (day) onDone(day); }} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
        <label style={{ fontSize: 12, color: TEXT, display: "flex", alignItems: "center", gap: 6 }}>
          Réalisé le
          <input type="date" required value={day} max={todayParis} onChange={(e) => setDay(e.target.value)}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "4px 6px", fontFamily: "inherit", fontSize: 12 }} />
        </label>
        <button type="submit" className="ob-composer-send" disabled={!day}>Réalisé</button>
        <button type="button" className="ob-btn-ghost" onClick={onNotDone}>Pas encore fait</button>
      </form>
    </div>
  );
}
const roleOf = () => { try { return (apiClient.getUser() || {}).role; } catch { return undefined; } };

// Onglet Détails allégé pour le Client Success : l'état de l'onboarding en une carte et un seul
// bouton « Faire l'onboarding » ; les rendez-vous de lancement, la convention et la météo
// vivent dans le parcours. Les autres rôles gardent les lignes détaillées. Les RDV fiscal et
// social se reprogramment aussi d'ici (client absent, Vincent 29/09).
// ── Passe « Onboardé » (dev 29/10/2026 : « un petit badge quand l'onboarding est fait, comme un jeu ») ──────
// Un ticket vert à encoches (OnboardingPass.jsx), posé sur le client dans le tableau et sur la fiche une fois
// l'onboarding réalisé ; il se penche et brille au survol.
const passTitle = (r) => {
  const d = r.rdv_onboarding_done_date || r.rdv_onboarding_date_manual || r.rdv_onboarding_date;
  return `Onboardé${d ? ` le ${fmt(d)}` : ""}`;
};

// ── Carte d'onboarding en billet d'embarquement (dev 29/10/2026, réfs de billets) ────────────────────
// En haut, le trajet de la signature à l'onboarding et le bandeau (animateur, visio, lien du client, dossier) ;
// sous la perforation, la souche : les lancements, l'action, un code-barres tiré du numéro client. Mêmes
// fonctions qu'avant : Meet, lien de réservation, reprogrammer, confier, lancer le parcours, date de
// réalisation, réalisé sans le parcours. Dates lues comme la chaîne du CRM (heure-mur, pas de fuseau).
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const wallParts = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const day = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return { day, label: `${+m[3]} ${MONTHS_SHORT[+m[2] - 1]}`, weekday: WEEKDAYS[new Date(day).getUTCDay()], year: m[1],
    time: m[4] && (+m[4] || +m[5]) ? `${m[4]}h${m[5]}` : "" };
};
const ROCKET = <>
  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
</>;

// Fusée pleine, de profil, tournée vers le rendez-vous (comme l'avion d'une carte d'embarquement) : coque effilée,
// deux ailerons, hublot, et une petite flamme qui vacille.
const ROCKET_SIDE = <>
  <path className="ob-tk-flame" d="M3.6 12c-1.3-.9-2.4-.8-3.1 0 .7.8 1.8.9 3.1 0Z" fill="#f59e0b" />
  <path d="M7.6 9.4 5.5 5.6c-.3-.5 0-1 .6-1h2.4c.5 0 .9.2 1.2.6l2.9 3.9Z" fill="currentColor" />
  <path d="M7.6 14.6 5.5 18.4c-.3.5 0 1 .6 1h2.4c.5 0 .9-.2 1.2-.6l2.9-3.9Z" fill="currentColor" />
  <path d="M3.4 12c0-1.9 4.2-3.4 9.6-3.4 3.9 0 7 1.2 9 3.1a.4.4 0 0 1 0 .6c-2 1.9-5.1 3.1-9 3.1-5.4 0-9.6-1.5-9.6-3.4Z" fill="currentColor" />
  <circle cx="15.4" cy="12" r="1.55" fill="#fff" />
  <path d="M5.4 12h4" stroke="#fff" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" />
</>;
// Pictogramme de chaque statut du billet : à clôturer = drapeau d'arrivée à damier.
const TK_STATUS_ICONS = {
  plan: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18" /><path d="M12 12.8v2.8l1.9 1.2" /></>,
  close: <g className="ob-tk-flag"><path d="M5 21V3.6" /><path d="M5 4h13.2l-2.4 4.5 2.4 4.5H5" /><path d="M5 4h4.4v4.5H5zM9.4 8.5h4.4V13H9.4zM13.8 4h4.4l-2.4 4.5h-2Z" fill="currentColor" stroke="none" /></g>,
  recaler: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8.2" /><path d="M3 3.2v5h5" /></>,
  done: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16 9.6" /></>,
  idle: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" strokeDasharray="3 2.6" /><path d="M8 2.5v4M16 2.5v4" /></>,
};
const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const fullDay = (p) => (p ? `${p.label.replace(".", "")} ${p.year}` : "");

function OnboardingCard({ row, holdCut = false, onStart, onManualDone, onReschedule, onCancel, onDateSaved, hostInfo, onTransfer }) {
  const reduce = useReducedMotion();
  const date = row.rdv_onboarding_date_manual || row.rdv_onboarding_date;
  const done = !!row.rdv_onboarding_done;
  // Date d'un onboarding réalisé saisie à la main (anciens clients) : elle fait foi une fois réalisé.
  const doneDate = row.rdv_onboarding_done_date || date;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const todayParis = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const plannedDay = date ? String(date).slice(0, 10) : "";
  const pending = !!row.onboarding_reschedule_pending && !done;
  const status = done ? { label: "Réalisé", tone: "done", icon: "done" }
    : pending ? { label: "À recaler", tone: "warn", icon: "recaler", title: row.onboarding_reschedule_note || "Sans date pour le moment" }
    : !date ? { label: "Sans date", tone: "idle", icon: "idle" }
    : plannedDay < todayParis ? { label: "À clôturer", tone: "warn", icon: "close", title: "La date est passée : lancez le parcours pour le clôturer" }
    : { label: "Prévu", tone: "plan", icon: "plan" };
  const from = wallParts(row.owner_signed_at);
  const to = wallParts(done ? doneDate : date);
  const total = from && to ? Math.round((to.day - from.day) / 86400000) : null;
  const rdv = [
    ["Intégration Opti'Lex", row.rdv_lancement_date, row.rdv_lancement_done],
    ["Lancement fiscal", row.rdv_fiscal_date_manual || row.rdv_fiscal_date, row.rdv_fiscal_done, "fiscal"],
    ["Lancement social", row.rdv_social_date_manual || row.rdv_social_date, row.rdv_social_done, "social"],
  ];
  const host = date && !done ? hostInfo?.host : null;
  // Forme du billet : dessinée en SVG derrière le contenu (fond, contour, ombre, encoches à la hauteur de la
  // perforation), à la taille mesurée du billet. Un masque CSS ombré par un filtre perdait son ombre dans Safari.
  const ticketRef = useRef(null);
  const perfRef = useRef(null);
  const [shape, setShape] = useState(null);
  // Onboarding réalisé (dev 29/10/2026 : « it should cut automatically and fall, the detail rearranged ») : quand il
  // passe à réalisé sous les yeux, les ciseaux parcourent la perforation, la souche tombe, le billet se referme sur un
  // bord déchiré et le tampon « Onboardé » prend la place du statut. Déjà réalisé à l'ouverture : billet déchiré direct.
  // Réalisé depuis le parcours « Faire l'onboarding » : la découpe attend que sa fenêtre se ferme (`holdCut`), pour
  // se jouer sous les yeux et non derrière la fenêtre.
  const [stubGone, setStubGone] = useState(done);
  const [cutting, setCutting] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [cutDue, setCutDue] = useState(false);
  const wasDone = useRef(done);
  useEffect(() => {
    const before = wasDone.current;
    wasDone.current = done;
    if (!done) { setStubGone(false); setCutting(false); setJustDone(false); setCutDue(false); return; }
    if (!before) { if (reduce) setStubGone(true); else setCutDue(true); }
  }, [done, reduce]);
  useEffect(() => {
    if (!cutDue || holdCut) return undefined;
    setJustDone(true); setCutting(true);
    const t = setTimeout(() => { setCutting(false); setStubGone(true); setCutDue(false); }, 720);
    return () => clearTimeout(t);
  }, [cutDue, holdCut]);
  const measureRef = useRef(() => {});
  useLayoutEffect(() => {
    const ticket = ticketRef.current;
    if (!ticket) return undefined;
    const measure = () => {
      const perf = perfRef.current;
      // Perforation dans le conteneur de la souche : sa hauteur dans le billet = haut du conteneur (insensible à la chute).
      const w = ticket.offsetWidth, h = ticket.offsetHeight, cut = perf ? perf.parentElement.offsetTop + perf.offsetTop : null;
      setShape((prev) => (prev && prev.w === w && prev.h === h && prev.cut === cut ? prev : { w, h, cut }));
    };
    measureRef.current = measure;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ticket);
    return () => ro.disconnect();
  }, []);
  // Souche découpée : le billet se referme tout de suite sur la perforation (bord déchiré), la souche tombe avec sa
  // propre forme (moitiés d'encoches en haut, coins arrondis en bas).
  const tornAt = shape ? (stubGone && shape.cut != null ? shape.cut : shape.h) : 0;
  const shapePath = shape && (shape.cut != null && !stubGone
    ? ((w, h, c, r = 24, n = 20) =>
      `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${c - n}A${n} ${n} 0 0 0 ${w} ${c + n}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}`
      + `H${r}A${r} ${r} 0 0 1 0 ${h - r}V${c + n}A${n} ${n} 0 0 0 0 ${c - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`)(shape.w, shape.h, shape.cut)
    // Souche partie : le bas du billet est le bord déchiré, en dents fines.
    : ((w, h, r = 24, t = 7, step = 14) => {
      let d = `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - t}`;
      for (let x = w; x > 0; x -= step) d += `L${Math.max(0, x - step / 2)} ${h}L${Math.max(0, x - step)} ${h - t}`;
      return `${d}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    })(shape.w, tornAt));
  const stubH = shape && shape.cut != null ? shape.h - shape.cut : 0;
  const stubFill = shape && stubH > 0 ? `M20 0H${shape.w - 20}A20 20 0 0 0 ${shape.w} 20V${stubH - 24}A24 24 0 0 1 ${shape.w - 24} ${stubH}H24A24 24 0 0 1 0 ${stubH - 24}V20A20 20 0 0 0 20 0Z` : null;
  const stubEdge = shape && stubH > 0 ? `M${shape.w} 20V${stubH - 24}A24 24 0 0 1 ${shape.w - 24} ${stubH}H24A24 24 0 0 1 0 ${stubH - 24}V20` : null;
  const shadowId = `tk-shadow-${String(row.numero_client || row.id).replace(/[^\w-]/g, "")}`;
  return (
    <div className="ob-tkw">
      <div ref={ticketRef} className={`ob-tk is-${status.tone}${done ? " is-done" : ""}`}>
        {shape && (
          <svg className="ob-tk-shape" width={shape.w} height={shape.h} viewBox={`0 0 ${shape.w} ${shape.h}`} aria-hidden="true">
            <defs>
              <filter id={shadowId} x="-10%" y="-10%" width="120%" height="125%">
                <feDropShadow dx="0" dy="10" stdDeviation="11" floodColor="#1c1b19" floodOpacity="0.09" />
              </filter>
            </defs>
            <path d={shapePath} fill="#fff" stroke="rgba(43,41,39,.091)" strokeWidth="1" filter={`url(#${shadowId})`} />
          </svg>
        )}
        <div className="ob-tk-top">
          {/* De → à : la signature du contrat, l'onboarding ; la fusée au milieu de la ligne pointillée. */}
          <div className="ob-tk-line">
            <span>Signature</span><i className="ob-tk-o" />
            <span className="ob-tk-dots" />
            <svg className="ob-tk-rocket" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">{ROCKET_SIDE}</svg>
            <span className="ob-tk-dots" />
            <i className="ob-tk-o is-full" /><span>Onboarding</span>
          </div>
          <div className="ob-tk-codes">
            <div>
              <span className="ob-tk-code-big">{from ? from.label : "—"}</span>
              <span className="ob-tk-city">Signature du<br />contrat Owner</span>
            </div>
            <div className="ob-tk-mid">
              {!(done && stubGone) && total != null && total >= 0 && <span className="ob-tk-dur">{total === 0 ? "le jour même" : `${total} jour${total > 1 ? "s" : ""}`}</span>}
              {done && stubGone ? (
                // Le tampon s'écrase sur le billet (grand, incliné, transparent → posé), puis s'enfonce un peu.
                <motion.span className="ob-tk-seal" initial={justDone ? { opacity: 0, scale: 2.1, rotate: -32 } : false}
                  animate={justDone ? { opacity: [0, 1, 1], scale: [2.1, 0.9, 1], rotate: [-32, -11, -12] } : { opacity: 1, scale: 1, rotate: -12 }}
                  transition={{ duration: 0.55, times: [0, 0.62, 1], ease: [0.2, 0.8, 0.3, 1], delay: justDone ? 0.4 : 0 }}>
                  <OnboardedSeal date={doneDate} size={88} />
                </motion.span>
              ) : (
                <span className={`ob-tk-status is-${status.tone}`} title={status.title}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TK_STATUS_ICONS[status.icon]}</svg>
                  {status.label}
                </span>
              )}
              {/* Réalisé : la durée passe sous le tampon. */}
              {done && stubGone && total != null && total >= 0 && <span className="ob-tk-dur">{total === 0 ? "le jour même" : `${total} jour${total > 1 ? "s" : ""}`}</span>}
            </div>
            <div className="is-right">
              <span className="ob-tk-code-big">{to ? to.label : "À fixer"}</span>
              <span className="ob-tk-city">{done ? <>Onboarding<br />réalisé</> : <>Rendez-vous<br />d'onboarding</>}</span>
            </div>
          </div>
          <div className="ob-tk-times">
            <div><strong>{from ? capFirst(from.weekday) : "—"}</strong><span>{fullDay(from)}</span></div>
            <div className="is-right"><strong>{to ? to.time || capFirst(to.weekday) : pending ? "À recaler" : "—"}</strong><span>{to ? `${capFirst(to.weekday)} ${fullDay(to)}` : "pas de date"}</span></div>
          </div>
          {/* Le bandeau : qui anime, la visio, le lien que le client utilise, le dossier. */}
          <div className="ob-tk-band">
            <div><span>Animateur</span><strong>{host ? <><HostFace name={host.name} photo={host.photo} size={18} />{host.name}</> : "—"}</strong></div>
            <div><span>Visio</span><strong>{row.onboarding_meet_link && !done
              ? <a href={row.onboarding_meet_link} target="_blank" rel="noreferrer">Rejoindre <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg></a>
              : "—"}</strong></div>
            <div><span>Lien du client</span><strong>{row.onboarding_url && !done
              ? <CopyButton value={row.onboarding_url} label="le lien de prise de rendez-vous du client">Copier</CopyButton>
              : "—"}</strong></div>
            <div><span>Dossier</span><strong>{row.numero_client || "—"}</strong></div>
          </div>
          {/* Reprogrammer, et transfert à l'équipe pour le responsable (dev 29/10/2026). */}
          {host && (onReschedule || (onTransfer && hostInfo.transfer_to?.length)) && (
            <div className="ob-tk-actions">
              {onReschedule && (
                <button type="button" className="ob-tk-resched" onClick={() => onReschedule("onboarding")} {...(isBoardReadOnly() ? READ_ONLY_PROPS : {})}>
                  {/* Calendrier et horloge : l'aiguille fait un tour au survol. */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4M8 2v4M3 10h5" />
                    <circle cx="16" cy="16" r="6" /><path className="ob-tk-resched-hand" d="M16 14v2.3l1.5 1.2" />
                  </svg>
                  Reprogrammer
                </button>
              )}
              {onTransfer && (hostInfo.transfer_to || []).map((t) => (
                <button key={t.name} type="button" className="ob-tk-chip" onClick={() => onTransfer(t)}>
                  <HostFace name={t.name} photo={t.photo} size={18} />Transférer à {t.name}
                </button>
              ))}
            </div>
          )}
          {/* Les lancements, comme passager / siège / classe. */}
          <div className="ob-tk-legs">
            {rdv.map(([label, d, ok, kind]) => (
              <div key={label} className="ob-tk-leg">
                <span>{label}</span>
                <strong className={d ? "" : "is-none"}>
                  {d ? fmtDT(d) : "À placer"}
                  {ok && <span title="Effectué"><StatusGlyph kind="done" color={GREEN} size={13} /></span>}
                </strong>
                {kind && ((d && !ok && onReschedule) || (onCancel && launchCancellable(d, ok))) && (
                  <span className="ob-tk-legact">
                    {d && !ok && onReschedule && <button type="button" className="ob-tk-link" onClick={() => onReschedule(kind)}>Reprogrammer</button>}
                    {onCancel && launchCancellable(d, ok) && <button type="button" className="ob-tk-link is-danger" onClick={() => onCancel(kind)}>Annuler</button>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Perforation entre les deux encoches, puis la souche et son code-barres. Réalisé : les ciseaux passent,
            la souche tombe (sortie animée), le billet se referme. */}
        <AnimatePresence initial={false} onExitComplete={() => measureRef.current()}>
          {!stubGone && (
            <motion.div key="stub" className="ob-tk-stubwrap"
              exit={reduce ? { opacity: 0, height: 0 } : { y: 110, rotate: 7, opacity: 0, height: 0,
                transition: { y: { duration: 0.6, ease: [0.55, 0, 0.8, 0.4] }, rotate: { duration: 0.6, ease: "easeIn" }, opacity: { duration: 0.45, delay: 0.15 },
                  height: { duration: 0.45, delay: 0.3, ease: [0.22, 1, 0.36, 1] } } }}>
              {stubFill && (
                <svg className="ob-tk-stubshape" width={shape.w} height={stubH} viewBox={`0 0 ${shape.w} ${stubH}`} aria-hidden="true">
                  <path d={stubFill} fill="#fff" />
                  <path d={stubEdge} fill="none" stroke="rgba(43,41,39,.091)" strokeWidth="1" />
                </svg>
              )}
              <div ref={perfRef} className="ob-tk-perf" aria-hidden="true">
                {cutting && (
                  <motion.svg className="ob-tk-scissors" width="24" height="24" viewBox="0 0 24 24" initial={{ left: "2%" }} animate={{ left: "94%" }}
                    transition={{ duration: 0.65, ease: [0.45, 0, 0.55, 1] }}>{TK_SCISSORS}</motion.svg>
                )}
                {cutting && <motion.span className="ob-tk-cutline" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.65, ease: [0.45, 0, 0.55, 1] }} />}
              </div>
              <div className="ob-tk-stub">
                <div className="ob-tk-stubrow">
                  <div className="ob-tk-stubact">
                    <motion.button type="button" className="ob-tk-cta" whileTap={{ scale: 0.97 }} onClick={onStart}>
                      {/* La fusée décolle au survol. Rien ne bouge en continu dans le billet : toute animation permanente le
                          ferait redessiner à chaque image. */}
                      <svg className="ob-tk-cta-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {ROCKET}
                      </svg>
                      {pending ? "Reprendre l'onboarding" : "Faire l'onboarding"}
                    </motion.button>
                  </div>
                  <div className="ob-tk-codebox">
                    <Barcode value={row.numero_client || row.id} width={260} height={52} className="ob-tk-barcode" />
                    <span className="ob-tk-num">{row.numero_client || ""}</span>
                  </div>
                </div>
                {/* Onboarding réalisé sans le parcours (anciens clients 28/09/2026, tout client 29/09/2026) :
                    date proposée = date prévue si elle est passée, sinon aujourd'hui. Pur suivi : ni agenda,
                    ni facturation (champ rdv_onboarding_done_date, distinct de la date du RDV). */}
                {!done && onManualDone && (!manualOpen ? (
                  <button type="button" className="ob-tk-manual" onClick={() => { setManualDate(plannedDay && plannedDay <= todayParis ? plannedDay : todayParis); setManualOpen(true); }}>
                    Marquer l'onboarding réalisé sans le parcours
                  </button>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); if (manualDate) { onManualDone(manualDate); setManualOpen(false); } }} className="ob-tk-manualform">
                    <label>
                      Date de l'onboarding réalisé
                      <input type="date" required autoFocus value={manualDate} max={todayParis} onChange={(e) => setManualDate(e.target.value)} />
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button type="submit" className="ob-composer-send" disabled={!manualDate}>Marquer réalisé</button>
                      <button type="button" className="ob-btn-ghost" onClick={() => setManualOpen(false)}>Annuler</button>
                    </div>
                  </form>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Sous le billet déchiré : rouvrir le parcours, corriger la date de réalisation. */}
      {done && stubGone && (
        <motion.div className="ob-tk-after" initial={justDone ? { opacity: 0, y: -6 } : false} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: justDone ? 0.75 : 0, ease: [0.22, 1, 0.36, 1] }}>
          <button type="button" className="ob-tk-link" onClick={onStart}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ROCKET}</svg>
            Rouvrir le parcours
          </button>
          <BoardOnboardingDateCorrection key={row.numero_client} numero={row.numero_client} completed
            initialDate={toDateInput(doneDate)} onSaved={onDateSaved} />
        </motion.div>
      )}
    </div>
  );
}
// Ciseaux qui découpent la souche le long de la perforation.
const TK_SCISSORS = <g fill="none" stroke="#2b2927" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" fill="#fff" /><circle cx="6" cy="18" r="3" fill="#fff" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></g>;
function EmailSelect({ row, patch, onSaved, bare = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef(null);
  const [newEmail, setNewEmail] = useState("");
  const [extra, setExtra] = useState([]); // emails ajoutés à la main, affichés localement de suite
  const owner = (row.email || "").trim();
  // Emails Opti'Lex : liste labellisée (client + dirigeants), résolue par SIREN côté backend
  // (un client à plusieurs sociétés matche si UN SIREN correspond). Fallback sur l'ancien
  // champ unique email_optilex si la liste n'est pas encore servie.
  const optilexOpts = (Array.isArray(row.email_optilex_options) && row.email_optilex_options.length)
    ? row.email_optilex_options
    : (row.email_optilex ? [{ email: row.email_optilex, label: "" }] : []);
  const current = ov(row, "email_ovr", "email") || "";
  const opts = useMemo(() => {
    const seen = new Set(); const list = [];
    const add = (email, source) => {
      const e = (email || "").trim();
      if (!e || seen.has(e.toLowerCase())) return;
      seen.add(e.toLowerCase()); list.push({ email: e, source });
    };
    add(owner, "Owner");
    for (const o of optilexOpts) if (o && o.email) add(o.email, o.label ? `Opti'Lex · ${o.label}` : "Opti'Lex");
    for (const h of (Array.isArray(row.email_history) ? row.email_history : [])) {
      if (h && h.email) add(h.email, h.source === "optilex" ? "Opti'Lex" : "Owner");
    }
    // Emails ajoutés par la finance (client_contact, table partagée).
    for (const o of sharedEmailOptions(row)) add(o.email, o.source);
    for (const e of extra) add(e, "Owner");
    return list;
  }, [owner, row.email_optilex_options, row.email_optilex, row.email_history, row.shared_contacts, extra]);
  const canOpen = canSelectEmail(); // autorisé à choisir/ajouter (admin/ceo/optilex/client success)
  const choose = async (email) => {
    setSaving(true);
    const ovr = email.toLowerCase() === owner.toLowerCase() ? null : email; // Owner = efface l'override
    try { await patch(row.numero_client, { email_ovr: ovr }); onSaved?.(); setOpen(false); }
    finally { setSaving(false); }
  };
  // Ajouter un email saisi à la main : l'enregistre dans l'historique ET le pose en destination.
  const addEmail = async () => {
    const e = newEmail.trim();
    if (!e || !e.includes("@") || saving) return;
    setSaving(true);
    try {
      await apiClient.post("/api/v1/optilex/email-history", { numero_client: row.numero_client, emails: [{ email: e, source: "owner" }] });
      const ovr = e.toLowerCase() === owner.toLowerCase() ? null : e;
      await patch(row.numero_client, { email_ovr: ovr });
      setExtra((prev) => (prev.some((x) => x.toLowerCase() === e.toLowerCase()) ? prev : [...prev, e]));
      setNewEmail("");
      onSaved?.();
      setOpen(false);
    } catch (err) { console.error("addEmail failed", err); }
    finally { setSaving(false); }
  };
  const toggle = (e) => {
    e.stopPropagation();
    if (!canOpen) return;
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };
  return (
    <div style={{ minWidth: 0 }}>
      {!bare && <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>Email</div>}
      <button ref={btnRef} type="button" onClick={toggle} title={canOpen ? "Choisir l'adresse des envois Opti'Lex" : undefined}
        style={{ display: "flex", alignItems: "center", gap: 6, width: bare ? "auto" : "100%", maxWidth: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: canOpen ? "pointer" : "default", fontFamily: "inherit", minWidth: 0 }}>
        <span style={{ fontSize: bare ? 13.5 : 14, fontWeight: 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current || "—"}</span>
        {canOpen && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s" }}><polyline points="6 9 12 15 18 9" /></svg>}
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 240), zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 14px 34px rgba(28,27,25,.10), 0 2px 6px rgba(28,27,25,.04)", padding: 6, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px 4px" }}>Email des envois Opti'Lex</div>
            {opts.map((o) => {
              const on = o.email.toLowerCase() === current.toLowerCase();
              return (
                <button key={o.email} type="button" disabled={saving} onClick={() => choose(o.email)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", padding: "8px", borderRadius: 8, border: "none", background: on ? "#f4f2ee" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: on ? 500 : 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.email}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{o.source}</span>
                  </span>
                  {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              );
            })}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 6 }}>
              <form onSubmit={(ev) => { ev.preventDefault(); addEmail(); }} style={{ display: "flex", gap: 6, padding: "2px 4px" }}>
                <input type="email" value={newEmail} disabled={saving} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => setNewEmail(ev.target.value)} placeholder="Ajouter un email…"
                  style={{ flex: 1, minWidth: 0, fontSize: 13, padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 8, fontFamily: "inherit", color: TEXT, outline: "none", background: CARD }} />
                <button type="submit" disabled={saving || !newEmail.trim()}
                  style={{ flexShrink: 0, fontSize: 13, fontWeight: 500, padding: "7px 12px", border: "none", borderRadius: 8, background: CHARCOAL, color: "#fff", cursor: (saving || !newEmail.trim()) ? "default" : "pointer", opacity: (saving || !newEmail.trim()) ? 0.5 : 1 }}>Ajouter</button>
              </form>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// Bloc "Informations client" éditable : affiche override ?? original ; l'édition écrit la
// couche cabinet (optilex_client_tracking) SANS toucher client_data (antériorité Owner préservée).
const INFO_FIELDS = [
  { ovr: "contact_name_ovr", orig: "contact_name", label: "Nom du client" },
  { ovr: "tranche_ovr", orig: "contact_tranche", label: "Tranche salariale" },
  // email_ovr retiré du crayon libre : l'email de destination Opti'Lex se change UNIQUEMENT via
  // le dropdown EmailSelect (gaté admin+ceo+optilex+client success, enforce backend). Voir EmailSelect.
  { ovr: "phone_ovr", orig: "contact_phone", label: "Téléphone" },
  { ovr: "siren_ovr", orig: "siren", label: "SIREN" },
];
// Emails et téléphones partagés avec la finance : Client Success, CEO et admin (même règle que le backend).
const CONTACT_EDIT_ROLES = ["admin", "ceo", "customer_success_manager"];

// ── Copie rapide (dev 29/10/2026, « copier vite les infos importantes ») ──────────────────────────────
// Le bouton apparaît au survol de la ligne (toujours visible sur écran tactile), copie la valeur et confirme
// d'une coche et d'une bulle « Copié ».
const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* repli ci-dessous */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
};
// `children` : texte cliquable (« Copier » du lien client sur le billet), l'icône après le texte.
function CopyButton({ value, label, children }) {
  const [state, setState] = useState("idle");   // idle | done | fail
  useEffect(() => {
    if (state === "idle") return undefined;
    const timer = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(timer);
  }, [state]);
  if (!value) return null;
  const copy = async (e) => { e.stopPropagation(); setState((await copyText(String(value))) ? "done" : "fail"); };
  const icon = (
    <span className="ob-copy-ic">
      <AnimatePresence mode="wait" initial={false}>
        {state === "done"
          ? <motion.svg key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 24 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></motion.svg>
          : <motion.svg key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.12 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></motion.svg>}
      </AnimatePresence>
    </span>
  );
  return (
    <button type="button" onClick={copy} aria-label={`Copier ${label}`} title={`Copier ${label}`}
      className={`ob-copy${children ? " has-text" : ""}${state !== "idle" ? ` is-${state}` : ""}`}>
      {children}{icon}
      <AnimatePresence>
        {state !== "idle" && (
          <motion.span key="tip" className="ob-copy-tip" role="status" initial={{ opacity: 0, y: 4, x: "-50%", scale: 0.92 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }} exit={{ opacity: 0, y: -2, x: "-50%" }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
            {state === "done" ? "Copié" : "Copie impossible"}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
// SIREN lisible (trois groupes de trois chiffres) ; la copie garde les chiffres seuls.
const sirenDigits = (v) => String(v || "").replace(/\s+/g, "");
const fmtSiren = (v) => { const d = sirenDigits(v); return /^\d{9}$/.test(d) ? d.replace(/(\d{3})(?=\d)/g, "$1 ") : v; };

// ── Propriétés du client (dev 29/10/2026, « détails plus clairs », réfs de fiches de tâche) ─────────────
// Une ligne par information : icône et libellé à gauche, valeur à droite. La situation, la météo, l'e-mail
// et les programmes se modifient sur leur ligne ; le crayon ouvre l'édition des champs du cabinet.
// Pictogrammes des propriétés (redessinés le 29/10/2026 d'après la réf. de filtres du dev : carnet de contact, @, immeuble,
// carte d'identité, combiné, et des pointillés « statut » pour la situation).
const PROP_ICONS = {
  situation: <path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M5.6 18.4l1.9-1.9M16.5 7.5l1.9-1.9" />,
  meteo: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  secteur: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  contact: <><rect x="5" y="3" width="15" height="18" rx="2.5" /><circle cx="12.5" cy="10" r="2.6" /><path d="M8.5 17c.6-1.8 2.2-3 4-3s3.4 1.2 4 3M3 7.5h2M3 12h2M3 16.5h2" /></>,
  societe: <><path d="M3 21h18" /><rect x="5" y="3" width="10" height="18" rx="1.5" /><path d="M15 9h3.5a.5.5 0 0 1 .5.5V21M8.5 7h1M11 7h1M8.5 11h1M11 11h1M8.5 15h1M11 15h1" /></>,
  numero: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.6 16c.5-1.2 1.6-2 2.9-2s2.4.8 2.9 2M14 10h4M14 13.5h3" /></>,
  siren: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />,
  tranche: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  email: <><circle cx="12" cy="12" r="3.8" /><path d="M15.8 12v1.4a2.6 2.6 0 0 0 5.2 0V12a9 9 0 1 0-3.6 7.2" /></>,
  phone: <path d="M8.3 3.6 6.1 3a2 2 0 0 0-2.2 1A12 12 0 0 0 20 20.1a2 2 0 0 0 1-2.2l-.6-2.2a1.5 1.5 0 0 0-1.6-1.1l-2.5.3a1.5 1.5 0 0 0-1.1.8l-.6 1.2a10 10 0 0 1-5.5-5.5l1.2-.6a1.5 1.5 0 0 0 .8-1.1l.3-2.5a1.5 1.5 0 0 0-1.1-1.6Z" />,
  contrat: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 16.5c.9-1.2 1.6-1.2 2.2 0s1.4 1.2 2.3 0" /></>,
  programmes: <><circle cx="12" cy="8" r="6" /><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" /></>,
  creances: <><ellipse cx="9" cy="6.5" rx="6" ry="2.5" /><path d="M3 6.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" /><path d="M9 13v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V13" /><ellipse cx="15" cy="13" rx="6" ry="2.5" /></>,
  missions: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M9 5V3h6v2M8 11l2 2 5-5M8 17h8" /></>,
  ville: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  periodicite: <><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20.5V16h-4.5" /></>,
};
// `top` : la valeur peut grandir (dates d'effet, alertes) ; le libellé reste en face de sa première ligne,
// décalé de `top` pixels (hauteur de la pastille ou de la ligne de texte). `wrap` : libellé long sur deux lignes.
// Prénom du client : le premier seulement ; les autres prénoms (NDA) au clic, jamais copiés ni exportés.
function FirstNameValue({ first, others }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ob-pv-text" title={first}>
      {first}
      {others && (open
        ? <span className="ob-pv-none"> · autres prénoms : {others}</span>
        : <button type="button" className="ob-pv-more" onClick={() => setOpen(true)}>voir le détail</button>)}
    </span>
  );
}
function PropRow({ icon, label, children, top = 0, wrap = false, copy, copyLabel }) {
  return (
    <div className={`ob-prop${top ? " is-top" : ""}${wrap ? " is-wrap" : ""}`}>
      <div className="ob-prop-k" style={top ? { paddingTop: top } : undefined}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{PROP_ICONS[icon]}</svg>
        {label}
      </div>
      <div className="ob-prop-v">
        {copy ? <div className="ob-prop-vline">{children}<CopyButton value={copy} label={copyLabel || label.toLowerCase()} /></div> : children}
      </div>
    </div>
  );
}
// Les deux conventions, pour les dossiers (ContractFolders) : l'état (même icône que le tableau), sa date,
// l'envoi en gris, et s'il y a un PDF à ouvrir. Opti'Lex inclus au contrat Owner : pas de convention séparée.
function contractFolderItems(row) {
  const grouped = row.owner_status === "done" && row.optilex_status == null;
  const make = (key, label, title, status, sentAt, signedAt, scheduledAt) => {
    const i = sigInfo(status, sentAt, signedAt, scheduledAt);
    if (!i) {
      const included = key === "optilex" && grouped;
      return { key, label, title, empty: true, available: false,
        status: included ? <><StatusGlyph kind="done" color={GREEN} /><b style={{ color: GREEN }}>Inclus</b>au contrat Owner</> : <span className="ob-pv-none">Pas de contrat</span> };
    }
    const signed = status === "done" || (!status && !!signedAt);
    const when = signed ? signedAt : status === "ongoing" ? sentAt : status === "scheduled" ? scheduledAt : null;
    const date = when ? `${status === "scheduled" ? "pour le" : "le"} ${fmt(when)}` : "";
    return { key, label, title, signed, available: true, statusText: [i.label, date].filter(Boolean).join(" "),
      status: <><StatusGlyph kind={i.kind} color={i.color} /><b style={{ color: i.color }}>{i.label}</b>{date}</>,
      sub: status === "ongoing" ? "en attente de signature" : sentAt && status !== "scheduled" ? `envoyé le ${fmt(sentAt)}` : "" };
  };
  return [
    make("owner", "Owner", "Convention Owner", row.owner_status, row.owner_sent_at, row.owner_signed_at),
    make("optilex", "Opti'Lex", "Convention Opti'Lex", row.optilex_status, row.optilex_sent_at, row.optilex_signed_at, row.optilex_scheduled_at),
  ];
}
// Programme ambassadeur ou parrainage : une puce cochable ; la bulle rappelle ce que le programme veut dire.
// Témoignage (dev 30/10/2026) : cocher ouvre une petite fenêtre, un mot facultatif pour Morgane Girard (Social Media &
// Content Manager), qui est prévenue par e-mail (Resend) ; décocher reste le simple suivi, sans e-mail.
function TemoignageChip({ row, num, editable, patch, onDone }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localOn, setLocalOn] = useState(null);
  const [sent, setSent] = useState(null);
  const ref = useRef(null);
  useEffect(() => { setLocalOn(null); setSent(null); }, [num, row.temoignage_eligible]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open]);
  const on = localOn ?? !!row.temoignage_eligible;
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await apiClient.post("/api/v1/optilex/temoignage", { numero_client: num, note: note.trim() || null });
      setLocalOn(true); setSent(r?.already ? { already: true } : r?.notified || null); setOpen(false); setNote("");
      onDone?.();
    } catch (e) { setError(e?.message || "Le programme n'a pas pu être enregistré."); }
    finally { setBusy(false); }
  };
  return (
    <span ref={ref} className="tm-anchor">
      <ProgramChip kind="temoignage" label="Témoignage" on={on} editable={editable}
        hint={sent?.already ? "Déjà proposé à Morgane" : sent?.ok ? "Morgane a été prévenue par e-mail" : sent?.ok === false ? "Coché, mais l'e-mail à Morgane n'est pas parti" : "Client prêt à témoigner : avis, cas client ou vidéo."}
        onToggle={(v) => { if (v) setOpen(true); else { setLocalOn(false); patch(num, { temoignage_eligible: false }); } }} />
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Programme témoignage" className="tm-pop" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }} transition={{ type: "spring", stiffness: 520, damping: 34 }}>
            <div className="tm-head">
              <span className="tm-ic"><ProgramIcon kind="temoignage" size={18} /></span>
              <div><strong>Témoignage</strong><small>Morgane Girard, Social Media & Content Manager, sera prévenue par e-mail.</small></div>
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} autoFocus placeholder="Un petit mot pour Morgane (facultatif)"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm(); } }} />
            {error && <p role="alert" className="tm-error">{error}</p>}
            <div className="tm-actions">
              <button type="button" className="tm-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="button" className="tm-go" disabled={busy} onClick={confirm}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.5 2.5 10.6 13.4" /><path d="m21.5 2.5-7 19-3.9-8.1-8.1-3.9Z" /></svg>
                {busy ? "Envoi…" : "Prévenir Morgane"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Puce de programme (dev 29/10/2026) : son pictogramme à la place de la case ; cochée, elle prend sa teinte pastel
// et le pictogramme « éclot » ; au survol il fait son geste (le porte-voix parle, les mains se serrent, l'étoile brille).
function ProgramChip({ kind, on, label, hint, editable, onToggle }) {
  const [tile, ink] = PROGRAM_TONES[kind];
  return (
    <button type="button" className={`ob-prog${on ? " is-on" : ""}`} disabled={!editable} aria-pressed={on} title={hint}
      style={{ "--pg-tile": tile, "--pg-ink": ink }} onClick={() => { if (editable) onToggle(!on); }}>
      <span className="ob-prog-ic" key={on ? "on" : "off"}><ProgramIcon kind={kind} size={15} /></span>
      {label}
    </button>
  );
}

function ClientInfoSection({ row, num, patch, onEmailSaved, changeEtat, onContactsChanged, recordMeteo }) {
  const [editing, setEditing] = useState(false);
  // E-mails et téléphones par rang (primaire, secondaire…) ; l'e-mail affiché reste celui d'envoi des contrats.
  const contactEditable = !!num && CONTACT_EDIT_ROLES.includes(roleOf()) && !isBoardReadOnly();
  const mainEmail = ov(row, "email_ovr", "email");
  const [emails, localEmail] = useContactEntries("email", num, mainEmail, row.shared_contacts?.emails);
  const [phones, localPhone] = useContactEntries("phone", num, ov(row, "phone_ovr", "contact_phone"), row.shared_contacts?.phones);
  const mainEmailEntry = emails.find((e) => e.value.toLowerCase() === String(mainEmail || "").trim().toLowerCase()) || emails[0];
  const [draft, setDraft] = useState({});
  const startEdit = () => {
    const d = {};
    INFO_FIELDS.forEach((f) => { d[f.ovr] = ov(row, f.ovr, f.orig) || ""; });
    setDraft(d); setEditing(true);
  };
  const save = () => {
    // Antériorité : on ne pose un override QUE s'il diffère de l'original ; sinon null
    // (efface l'override -> retombe sur l'original Owner, et permet de réinitialiser).
    const out = {};
    INFO_FIELDS.forEach((f) => {
      const v = (draft[f.ovr] || "").trim();
      const orig = (row[f.orig] ?? "").toString();
      out[f.ovr] = v && v !== orig ? v : null;
    });
    patch(num, out);
    setEditing(false);
  };
  const name = ov(row, "contact_name_ovr", "contact_name");
  const readOnly = isBoardReadOnly();  // rôles en lecture seule : informations lues, contrôles visibles et désactivés
  const programmeEditable = !!num && meteoSettable() && !isFinanceTeam() && !readOnly;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SecTitle icon="infos" style={{ marginBottom: 0 }} hint="Le suivi, les coordonnées et les contrats du client.">Informations client</SecTitle>
        {num && !editing && !isFinanceTeam() && (
          <button type="button" className="ob-prop-edit" onClick={startEdit} title="Modifier le nom, la tranche, le téléphone et le SIREN" {...(isBoardReadOnly() ? READ_ONLY_PROPS : {})}>
            <PencilIcon size={13} />Modifier
          </button>
        )}
      </div>
      {editing ? (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {INFO_FIELDS.map((f) => (
              <div key={f.ovr} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{f.label}</div>
                <input value={draft[f.ovr] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.ovr]: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", fontSize: 13 }} />
              </div>
            ))}
          </div>
          {CONTACT_EDIT_ROLES.includes(roleOf()) && (
            <BoardContactsEditor numero={num} contacts={row.shared_contacts} onChanged={onContactsChanged} />
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" onClick={() => setEditing(false)}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button type="button" onClick={save}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: CHARCOAL, color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <div className="ob-props">
          {/* Suivi */}
          <div className="ob-props-group">
            <div className="ob-props-title">Suivi</div>
            <PropRow icon="situation" label="Situation" top={2}><EtatSection row={row} num={num} changeEtat={changeEtat} bare /></PropRow>
            <PropRow icon="meteo" label="Météo">
              <span className="ob-pv-line" title="À mettre à jour à chaque échange avec le client, avant ou après l'onboarding.">
                <MeteoPicker score={row.meteo_score} context={row.meteo_context} disabled={!num} inline readOnly={isBoardReadOnly()} onSave={(payload) => recordMeteo(num, payload)} />
                {row.meteo_by && row.meteo_score != null && <span className="ob-pv-sub">par {row.meteo_by}{row.meteo_at ? ` · ${timeAgo(row.meteo_at)}` : ""}</span>}
              </span>
            </PropRow>
            <PropRow icon="secteur" label="Secteur">
              {row.secteur_activite
                ? <span className="ob-pv-line"><SectorIcon secteur={row.secteur_activite} size={18} />{secteurLabel(row.secteur_activite)}</span>
                : <span className="ob-pv-none">Non renseigné</span>}
            </PropRow>
            {num && (
              <PropRow icon="programmes" label="Programmes">
                <span className="ob-pv-line" style={{ gap: 6, flexWrap: "wrap" }}>
                  <ProgramChip kind="ambassadeur" label="Ambassadeur" on={!!row.ambassador_eligible} editable={programmeEditable}
                    hint="Client à valoriser, à solliciter pour un témoignage ou une recommandation."
                    onToggle={(v) => patch(num, { ambassador_eligible: v })} />
                  <ProgramChip kind="parrainage" label="Parrainage" on={!!row.parrainage_eligible} editable={programmeEditable}
                    hint="Le programme vise à encourager les parrains à générer régulièrement de nouvelles opportunités commerciales qualifiées."
                    onToggle={(v) => patch(num, { parrainage_eligible: v })} />
                  <TemoignageChip row={row} num={num} editable={programmeEditable} patch={patch} onDone={onContactsChanged} />
                </span>
              </PropRow>
            )}
            {/* Missions du cabinet (dev 30/10/2026) : une ligne, les nombres par état ; le détail au clic. */}
            {num && <PropRow icon="missions" label="Missions cabinet partenaire" wrap><MissionsValue key={num} numero={num} /></PropRow>}
          </div>
          {/* Coordonnées : à copier d'un clic (bouton au survol de la ligne) */}
          <div className="ob-props-group">
            <div className="ob-props-title">Coordonnées</div>
            {/* Infos de base (dev 29/10/2026 : « on n'a plus le nom et tout ») : nom, société, numéro, copiables. */}
            {/* Nom, prénom et ville du client (dev 10/11/2026) : ceux du NDA, jamais devinés. Sans prénom et nom séparés
                dans le NDA, le nom connu reste affiché, signalé « à séparer » ; prénom et ville « à compléter » (ensemble). */}
            {row.client_last_name ? (
              <PropRow icon="contact" label="Nom du client" copy={row.client_last_name} copyLabel="le nom du client"><span className="ob-pv-text" title={row.client_last_name}>{row.client_last_name}</span></PropRow>
            ) : (
              <PropRow icon="contact" label="Nom du client" copy={name} copyLabel="le nom du client">{name
                ? <span className="ob-pv-text" title={`${name} : nom complet, prénom et nom à séparer`}>{name} <span className="ob-pv-none">· à séparer</span></span>
                : <span className="ob-pv-none">À compléter</span>}</PropRow>
            )}
            {/* Un seul prénom (dev 10/11/2026) : le premier, copié et exporté seul ; les autres prénoms du NDA
                n'apparaissent qu'au clic sur « voir le détail ». */}
            <PropRow icon="contact" label="Prénom du client" copy={row.client_first_name} copyLabel="le prénom du client">{row.client_first_name ? <FirstNameValue first={row.client_first_name} others={row.client_other_first_names} /> : <span className="ob-pv-none">À compléter</span>}</PropRow>
            <PropRow icon="ville" label="Ville" copy={row.client_city} copyLabel="la ville">{row.client_city ? <span className="ob-pv-text" title={row.client_city}>{row.client_city}</span> : <span className="ob-pv-none">À compléter</span>}</PropRow>
            <PropRow icon="societe" label="Société" copy={companyName(row)} copyLabel="la société">{companyName(row) ? <span className="ob-pv-text" title={companyName(row)}>{companyName(row)}</span> : <span className="ob-pv-none">—</span>}</PropRow>
            <PropRow icon="numero" label="N° client" copy={num} copyLabel="le numéro client">{num || <span className="ob-pv-none">Contrat en cours d'envoi</span>}</PropRow>
            <PropRow icon="siren" label="SIREN" copy={sirenDigits(ov(row, "siren_ovr", "siren"))} copyLabel="le SIREN">{fmtSiren(ov(row, "siren_ovr", "siren")) || <span className="ob-pv-none">—</span>}</PropRow>
            {row.periodicite && <PropRow icon="periodicite" label="Périodicité">{row.periodicite}</PropRow>}
            {num && RECEIVABLES_ROLES.includes(roleOf()) && <PropRow icon="creances" label="Créances"><ReceivablesValue numero={num} /></PropRow>}
            <PropRow icon="tranche" label="Tranche">{fmtTranche(ov(row, "tranche_ovr", "contact_tranche")) || <span className="ob-pv-none">—</span>}</PropRow>
            <PropRow icon="email" label="E-mail" copy={mainEmail} copyLabel="l'e-mail">
              <span className="ob-pv-line ob-contact"><EmailSelect row={row} patch={patch} onSaved={onEmailSaved} bare />
                {mainEmailEntry && <RankTag entry={mainEmailEntry} />}
                {num && <ContactMore kind="email" numero={num} entries={emails} displayed={mainEmail} editable={contactEditable} onChanged={onContactsChanged} onLocal={localEmail} />}</span>
            </PropRow>
            <PropRow icon="phone" label="Téléphone" copy={phones[0]?.value || ""} copyLabel="le téléphone">
              {phones.length ? (
                <span className="ob-pv-line ob-contact"><span className="ob-pv-text">{phones[0].value}</span><RankTag entry={phones[0]} />
                  {num && <ContactMore kind="phone" numero={num} entries={phones} editable={contactEditable} onChanged={onContactsChanged} onLocal={localPhone} />}</span>
              ) : (
                <span className="ob-pv-line ob-contact"><span className="ob-pv-none">—</span>
                  {num && contactEditable && <ContactMore kind="phone" numero={num} entries={phones} editable onChanged={onContactsChanged} onLocal={localPhone} />}</span>
              )}
            </PropRow>
          </div>
          {/* Contrats : l'état et ses dates ; les dossiers et leurs PDF vivent dans l'onglet Intégration (dev 29/10/2026). */}
          <div className="ob-props-group">
            <div className="ob-props-title">Contrats</div>
            {contractFolderItems(row).map((it) => (
              <PropRow key={it.key} icon="contrat" label={`Contrat ${it.label}`}
                top={it.key === "optilex" && (isIntegrationOverdue(row) || integrationAlert(row)) ? 1 : 0}>
                <div className="ob-contract-line">
                  <div style={{ minWidth: 0 }}>
                    <span className="ob-pv-line">{it.status}{it.sub && <span className="ob-pv-sub">· {it.sub}</span>}</span>
                    {it.key === "optilex" && (isIntegrationOverdue(row) ? <div><IntegrationOverdueBadge /></div> : integrationAlert(row) && <div><OptilexAlertBadge /></div>)}
                  </div>
                  {/* Le fichier du contrat : la page s'envole et devient le PDF. */}
                  <ContractThumb contractId={row.contract_id} it={it} group={`fiche-${num || row.id}`} />
                </div>
              </PropRow>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Toggle segmenté animé (remplace le dropdown Oui/Non). Pastille qui glisse en
// spring (navy -> vert quand positif) + check qui pop. labels[1] = état positif.
// `disabled` (rôles en lecture seule) : la valeur reste affichée, les deux boutons sont désactivés.
function StatusToggle({ value, onChange, labels = ["Non", "Oui"], disabled = false }) {
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f4f2ee", borderRadius: 9, minWidth: 150, userSelect: "none", flexShrink: 0 }}
      {...(disabled ? { title: READ_ONLY_TITLE, "data-read-only": "true" } : {})}>
      <motion.div
        animate={{ x: value ? "100%" : "0%", backgroundColor: value ? GREEN : NAVY }}
        transition={{ type: "spring", stiffness: 480, damping: 34 }}
        style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", borderRadius: 9, zIndex: 0, boxShadow: "0 1px 3px rgba(43,41,39,.126)" }}
      />
      {labels.map((lab, i) => {
        const active = (i === 1) === !!value;
        return (
          <button key={i} type="button" onClick={() => onChange(i === 1)} disabled={disabled}
            style={{ position: "relative", zIndex: 1, border: "none", background: "transparent", cursor: "pointer",
              padding: "7px 6px", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit",
              color: active ? "#fff" : MUTED, transition: "color 0.25s",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" }}>
            {i === 1 && (
              <motion.svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
                initial={false} animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} style={{ overflow: "visible" }}>
                <path d="M20 6 9 17l-5-5" />
              </motion.svg>
            )}
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// Cellule date éditable inline dans le tableau (clic = saisir/modifier la date d'onboarding).
// Stoppe la propagation pour ne PAS ouvrir la fiche ; désactivée -> texte simple (clic = ouvre la fiche).
function TableDateEdit({ value, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const cancelRef = useRef(false);
  if (disabled) return <span style={{ color: value ? TEXT : "#d8d3cb" }}>{fmtDT(value) || "—"}</span>;
  if (editing) {
    return (
      <input type="date" autoFocus defaultValue={toDateInput(value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { if (cancelRef.current) { cancelRef.current = false; setEditing(false); return; } onSave(e.target.value || null); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancelRef.current = true; setEditing(false); } }}
        style={{ ...inputStyle, width: 140, padding: "4px 7px", fontSize: 12.5 }} />
    );
  }
  return (
    <button type="button" title="Saisir/modifier la date d'onboarding"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit",
        display: "inline-flex", alignItems: "center", gap: 6, color: value ? TEXT : "#d8d3cb" }}>
      {fmtDT(value) || "—"}
      <span className="ob-edit" style={{ display: "inline-flex", lineHeight: 0 }}><PencilIcon /></span>
    </button>
  );
}

// Ligne RDV : date (planifiée ou saisie manuellement) + toggle "effectué" + lien (optionnel).
// onDate présent -> crayon pour saisir/modifier la date à la main (antériorité).
// `readOnly` (rôles en lecture seule) : bascule, crayon, « Reprogrammer » et « Annuler » visibles, désactivés.
function RdvRow({ label, date, done, editable, onToggle, link, onDate, meetLink, onReschedule, onCancel, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const cancelRef = useRef(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#faf9f7" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
        {editing ? (
          <input type="date" autoFocus defaultValue={toDateInput(date)}
            onBlur={(e) => { if (cancelRef.current) { cancelRef.current = false; setEditing(false); return; } onDate(e.target.value || null); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancelRef.current = true; setEditing(false); } }}
            style={{ ...inputStyle, width: 156, padding: "6px 9px", fontSize: 13, marginTop: 2 }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: date ? TEXT : "#d8d3cb" }}>{fmtDT(date) || "—"}</div>
            {onDate && (
              <button type="button" onClick={() => setEditing(true)} title="Saisir/modifier la date"
                style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}
                {...(readOnly ? READ_ONLY_PROPS : {})}>
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {link && <RdvLink url={link} />}
        {onReschedule && <button type="button" className="ob-detail-link" onClick={onReschedule} {...(readOnly ? READ_ONLY_PROPS : {})}>Reprogrammer ce rendez-vous</button>}
        {onCancel && <button type="button" className="ob-detail-link" onClick={onCancel} style={{ color: CANCEL_RED }} {...(readOnly ? READ_ONLY_PROPS : {})}>Annuler ce rendez-vous</button>}
        {meetLink && (
          <a href={meetLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, padding: "4px 10px", borderRadius: 8, background: GREEN + "14", border: `1px solid ${GREEN}44`, color: GREEN, fontSize: 11.5, fontWeight: 500, textDecoration: "none" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" /></svg>
            Rejoindre le Meet
          </a>
        )}
      </div>
      {editable && <StatusToggle value={!!done} onChange={onToggle} labels={["À venir", "Effectué"]} disabled={readOnly} />}
    </div>
  );
}

// Lien de prise de RDV (fiscal/social) : ouvrir dans un onglet + copier.
function RdvLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.preventDefault(); e.stopPropagation();
    try { navigator.clipboard.writeText(url); } catch { /* fallback: sélection manuelle */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5 }}>
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        style={{ fontSize: 11.5, fontWeight: 500, color: NAVY, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Lien de prise de RDV
      </a>
      <button type="button" onClick={copy}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 500, color: copied ? GREEN : MUTED, padding: 0, fontFamily: "inherit" }}>
        {copied ? "copié ✓" : "copier"}
      </button>
    </div>
  );
}

// Lien de signature Opti'Lex (copier) + relance native Yousign (double-clic de confirmation).
function OptilexSignatureBlock({ email, chosenEmail, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [relance, setRelance] = useState(null); // null | 'sending' | 'sent' | 'error'

  useEffect(() => {
    let alive = true;
    setLoading(true); setData(null); setConfirming(false); setRelance(null);
    apiClient.get(`/api/v1/optilex/optilex-signature?email=${encodeURIComponent(email)}`)
      .then((r) => { if (alive) { setData(r); setLoading(false); } })
      .catch(() => { if (alive) { setData({ available: false }); setLoading(false); } });
    return () => { alive = false; };
  }, [email, refreshKey]);

  const link = data?.signature_link;
  const canRelaunch = RELAUNCH_ROLES.includes(roleOf());
  const canRemind = data?.can_remind && canRelaunch;

  const copy = () => {
    if (!link) return;
    try { navigator.clipboard.writeText(link); } catch { /* fallback: sélection manuelle */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const sendReminder = async () => {
    setRelance("sending"); setConfirming(false);
    try { await apiClient.post("/api/v1/optilex/optilex-reminder", { email }); setRelance("sent"); }
    catch { setRelance("error"); setTimeout(() => setRelance(null), 2600); }
  };

  if (loading) return <div style={{ fontSize: 13, color: MUTED }}>Chargement du lien…</div>;
  if (!data?.available || !link) return <div style={{ fontSize: 13, color: "#d8d3cb" }}>Lien de signature indisponible.</div>;

  const done = relance === "sent";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input readOnly value={link} onFocus={(e) => e.target.select()}
          style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 11.5, color: MUTED, background: "#faf9f7" }} />
        <button onClick={copy}
          style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", background: copied ? GREEN : NAVY, color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>

      {canRemind && (
        <>
          <div style={{ fontSize: 11.5, color: MUTED, margin: "10px 0 6px" }}>
            Rappel Yousign à <strong style={{ color: TEXT }}>{data.recipient || chosenEmail || email}</strong>
          </div>
          <button onClick={confirming ? sendReminder : () => setConfirming(true)}
            onMouseLeave={() => { if (relance !== "sending") setConfirming(false); }}
            disabled={relance === "sending" || done}
            style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 500, fontFamily: "inherit",
              background: done ? GREEN : confirming ? "#c5221f" : "transparent",
              color: done || confirming ? "#fff" : NAVY, cursor: relance === "sending" || done ? "default" : "pointer", transition: "all 0.2s" }}>
            {!done && relance !== "sending" && <MailIcon />}
            {done ? "Rappel envoyé ✓" : relance === "sending" ? "Envoi…" : relance === "error" ? "Échec, réessayer" : confirming ? "Confirmer l'envoi du rappel" : "Relancer le client"}
          </button>
        </>
      )}
      {!canRemind && canRelaunch && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Rappel indisponible (statut : {data.signer_status || data.optilex_status || "—"}).</div>}
      {!canRelaunch && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
          Adresse d'envoi actuelle : <strong style={{ color: TEXT }}>{data.recipient || chosenEmail || email}</strong>.
          {" "}La relance est faite par le cabinet : utilisez « Prévenir le cabinet partenaire » en haut de la fiche.
        </div>
      )}
    </div>
  );
}

// Forcage d'envoi du contrat Opti'Lex encore PLANIFIE (cas special : RDV d'integration le
// jour meme de la signature Owner). Rejoue le dispatch existant cote api-owner (envoi immediat
// + emails) sans toucher la regle de planification ni le flux. Double-clic de confirmation.
function ForceSendBlock({ email, scheduledAt, onForced }) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState(null); // null | 'sending' | 'sent' | 'error'

  const doForce = async () => {
    setState("sending"); setConfirming(false);
    try {
      await apiClient.post("/api/v1/optilex/force-send-contract", { email });
      setState("sent");
      setTimeout(() => { onForced && onForced(); }, 1200);
    } catch {
      setState("error"); setTimeout(() => setState(null), 2800);
    }
  };

  const done = state === "sent";
  const sending = state === "sending";
  return (
    <>
      <SecTitle icon="signature">Contrat Opti'Lex planifie</SecTitle>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
          Le contrat Opti'Lex partira automatiquement{scheduledAt && <> le <strong style={{ color: TEXT }}>{fmt(scheduledAt)}</strong></>}.
          {" "}Cas special (RDV d'integration le jour meme) : force l'envoi maintenant.
        </div>
        <button onClick={confirming ? doForce : () => setConfirming(true)}
          onMouseLeave={() => { if (!sending) setConfirming(false); }}
          disabled={sending || done}
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            background: done ? GREEN : confirming ? "#c5221f" : "transparent",
            color: done || confirming ? "#fff" : NAVY, cursor: sending || done ? "default" : "pointer", transition: "all 0.2s" }}>
          {!done && !sending && <MailIcon />}
          {done ? "Contrat envoye ✓" : sending ? "Envoi…" : state === "error" ? "Echec, reessayer" : confirming ? "Confirmer l'envoi immediat" : "Forcer l'envoi du contrat Opti'Lex"}
        </button>
      </div>
    </>
  );
}

// Renouvellement d'un contrat Opti'Lex EXPIRE : recree une demande de signature Yousign.
function RenewBlock({ email, sentAt, onRenewed, bare = false }) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState(null); // null | 'sending' | 'sent' | 'error'
  // La confirmation s'annule seule après 5 s (dev 10/11/2026). Plus d'annulation à la sortie de la souris :
  // « Confirmer » est plus court que « Renouveler » et le bouton, calé à droite, sortait de sous le curseur au
  // premier clic, ce qui annulait aussitôt la confirmation (« j'appuie sur Renouveler, rien ne se passe »).
  useEffect(() => {
    if (!confirming) return undefined;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  const doRenew = async () => {
    setState("sending"); setConfirming(false);
    try {
      await apiClient.post("/api/v1/optilex/renew-contract", { email });
      setState("sent");
      setTimeout(() => { onRenewed && onRenewed(); }, 1200);
    } catch {
      setState("error"); setTimeout(() => setState(null), 2800);
    }
  };

  const done = state === "sent";
  const sending = state === "sending";
  // `bare` : le bouton seul, dans la barre « Convention Opti'Lex » en tête de fiche (titre et date y sont déjà).
  if (bare) {
    return (
      <button type="button" className={`ocv-btn${done ? " is-done" : confirming ? " is-confirm" : ""}`}
        onClick={confirming ? doRenew : () => setConfirming(true)} disabled={sending || done}>
        {!done && !sending && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20.5V16h-4.5" /></svg>}
        {done ? "Renouvelée ✓" : sending ? "Envoi…" : state === "error" ? "Échec, réessayer" : confirming ? "Confirmer" : "Renouveler"}
      </button>
    );
  }
  return (
    <>
      <SecTitle icon="signature">Contrat Opti'Lex expiré</SecTitle>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
          La demande de signature Opti'Lex a expiré{sentAt && <> (envoyée le <strong style={{ color: TEXT }}>{fmt(sentAt)}</strong>)</>}.
          {" "}Renouvelle-la pour renvoyer le contrat à signer au client.
        </div>
        <button onClick={confirming ? doRenew : () => setConfirming(true)}
          disabled={sending || done}
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            background: done ? GREEN : confirming ? "#c5221f" : "transparent",
            color: done || confirming ? "#fff" : NAVY, cursor: sending || done ? "default" : "pointer", transition: "all 0.2s" }}>
          {!done && !sending && <MailIcon />}
          {done ? "Contrat renouvelé ✓" : sending ? "Envoi…" : state === "error" ? "Échec, réessayer" : confirming ? "Confirmer le renouvellement" : "Renouveler le contrat Opti'Lex"}
        </button>
      </div>
    </>
  );
}

// ── PANNEAU DÉTAILS (slide-in droite, façon Notion) ──────────────────────────
// Toutes les dates de situation utilisent le calendrier français partagé.
// La validation se fait en quittant le contrôle complet ou avec Entrée.
// Sans onChange (lecture seule) : le même champ, désactivé, avec la date enregistrée.
function DateRow({ label, value, onChange }) {
  const committed = toDateInput(value);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
      {onChange ? (
        <BoardStateDateInput key={committed} value={committed} label={label} onChange={onChange}
          style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }} />
      ) : (
        <input type="text" aria-label={label} value={fmt(committed)} placeholder="jj/mm/aaaa" readOnly
          style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }} {...READ_ONLY_PROPS} />
      )}
    </div>
  );
}

// Libellé des dates d'une entrée d'historique (Pause = période, sinon date d'effet).
const etatHistDates = (h) => {
  if (h.etat === "Pause") {
    const start = h.etat_date ? `Début ${fmt(h.etat_date)}` : "Début —";
    const end = h.pause_end_date ? ` → fin ${fmt(h.pause_end_date)}`
      : h.pause_relance_date ? ` → relance ${fmt(h.pause_relance_date)}` : " → fin indéterminée";
    return start + end;
  }
  return h.etat_date ? fmt(h.etat_date) : "—";
};
// Auteur affiché d'un changement d'état : nom/prénom (users.full_name résolu côté back via
// created_by_name, Owner ET cabinet), sinon libellé pour les imports d'antériorité, sinon email.
const etatAuthor = (h) => {
  if (h.created_by_name) return h.created_by_name;
  const by = h.created_by;
  if (!by) return "";
  if (/^import/i.test(by)) return "Antériorité (import)";
  return String(by).split("@")[0];
};

// Bloc "État du client" (détail, sous le SIREN) : sélecteur d'état + date(s) selon l'état
// (fiscaliste), révélation animée. Toute pose passe par changeEtat -> trace l'historique.
// `bare` : sans libellé, pour la ligne « Situation » des propriétés de la fiche.
function EtatSection({ row, num, changeEtat, compact = false, bare = false }) {
  const readOnly = isBoardReadOnly();  // rôles en lecture seule : état affiché, dates en champs désactivés
  const etat = row.etat_manuel || displayEtat(row);  // le détail montre l'état POSÉ (pour éditer sa date d'effet, même s'il est encore prévu)
  const cfg = ETAT_DATE_CONFIG[etat];
  // Mode fin de pause : connue (date de fin) vs indéterminée (date de relance). Dérivé des
  // données UNIQUEMENT au changement de client : le choix local du toggle ne doit pas être
  // écrasé par la MAJ optimiste qui suit (sinon snap-back visuel du toggle).
  const [pauseMode, setPauseMode] = useState("connue");
  useEffect(() => {
    setPauseMode(row.pause_relance_date && !row.pause_end_date ? "indeterminee" : "connue");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.numero_client]);
  // Applique un changement de date en conservant l'état + les autres dates courantes.
  const applyDate = readOnly ? undefined : (chg) => changeEtat(num, {
    etat, etat_date: row.etat_date, pause_end_date: row.pause_end_date,
    pause_relance_date: row.pause_relance_date, ...chg,
  });
  const dateChange = (build) => (applyDate ? (d) => applyDate(build(d)) : undefined);
  return (
    <div style={{ marginBottom: compact || bare ? 0 : 22, minWidth: 0, ...(compact && (cfg || isEtatPending(row)) ? { gridColumn: "1 / -1" } : {}) }}>
      {bare ? null : compact ? <div style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>Situation du client</div> : <SecTitle icon="etat">État du client</SecTitle>}
      <EtatPicker etat={etat} disabled={!num || readOnly} onPick={(v) => changeEtat(num, { etat: v })} />
      {num && row.finance_review_status === 'pending' && <div style={{marginTop:9,padding:'8px 10px',borderRadius:8,background:'#fff8e9',color:'#866013',fontSize:12,lineHeight:1.5}}>
        Situation enregistrée dans le board. La finance doit en traiter les conséquences sur les montants ; elle ne valide pas le changement de situation.
      </div>}
      {num && isEtatPending(row) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, padding: "6px 10px", borderRadius: 8, background: "#fde9da", color: "#c2500e", fontSize: 12, fontWeight: 500, lineHeight: 1.45 }}>
          <span style={{ flexShrink: 0 }}>⏳</span>
          {row.etat_date
            ? `${row.etat_manuel} prévue le ${fmt(row.etat_date)} — pas encore effective.`
            : `${row.etat_manuel} : renseignez la date d'effet (obligatoire).`}
        </div>
      )}
      {/* Contrat en vol (vente pas encore déclarée -> pas de n° client) : l'état est calculé,
          en lecture seule. On le DIT au lieu de laisser un badge muet. */}
      {!num && (
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
          État calculé automatiquement · modifiable une fois la vente déclarée.
        </div>
      )}
      {/* Pause échue : le rappel d'action est aussi visible sur la fiche. */}
      {(() => {
        const h = etatHint(row);
        return h && h.urgent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12, fontWeight: 500, color: "#c2500e" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {h.text.charAt(0).toUpperCase() + h.text.slice(1)}
          </div>
        ) : null;
      })()}
      <AnimatePresence initial={false}>
        {cfg && num && (
          <motion.div key={etat} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "visible" }}>
            <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {cfg.pause ? (
                <>
                  <DateRow label="Début de pause" value={row.etat_date} onChange={dateChange((d) => ({ etat_date: d }))} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>Fin de pause</div>
                    {/* Flip PUREMENT LOCAL : un clic exploratoire ne détruit jamais une date en
                        base ni dans l'audit. La persistance passe par la saisie de la date
                        elle-même (les DateRow nullent la contrepartie au commit). */}
                    <StatusToggle value={pauseMode === "connue"} labels={["Indéterminée", "Connue"]}
                      onChange={(v) => setPauseMode(v ? "connue" : "indeterminee")} />
                  </div>
                  {pauseMode === "connue"
                    ? <DateRow label="Fin de pause" value={row.pause_end_date} onChange={dateChange((d) => ({ pause_end_date: d, pause_relance_date: null }))} />
                    : <DateRow label="Relancer le" value={row.pause_relance_date} onChange={dateChange((d) => ({ pause_relance_date: d, pause_end_date: null }))} />}
                </>
              ) : (
                <DateRow label={cfg.label} value={row.etat_date} onChange={dateChange((d) => ({ etat_date: d }))} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Timeline verticale de l'historique des états (audit fiscaliste). Le plus récent en haut.
function EtatHistory({ num, version }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const prevNum = useRef(null);
  useEffect(() => {
    if (!num) return undefined;
    let alive = true;
    // changement de client : on vide d'abord (évite d'afficher l'historique du client précédent).
    if (prevNum.current !== num) { setItems([]); setLoaded(false); prevNum.current = num; }
    apiClient.get(`/api/v1/optilex/etat-history?numero_client=${encodeURIComponent(num)}`)
      .then((r) => { if (alive) setItems(r.history || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [num, version]);
  // Rien tant qu'on ne SAIT pas qu'il y a quelque chose à montrer : évite le flash du titre
  // (apparu puis retiré) sur les clients sans historique, à chaque ouverture de fiche.
  if (!num || !loaded || items.length === 0) return null;
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
    <div style={{ marginBottom: 22 }}>
      <SecTitle icon="histo" style={{ marginBottom: 12 }}>Historique des états</SecTitle>
      <div style={{ position: "relative", paddingLeft: 20 }}>
        <div style={{ position: "absolute", left: 4, top: 5, bottom: 5, width: 2, background: BORDER }} />
        {items.map((h, i) => {
          const st = ETAT_STYLE[h.etat] || {};
          return (
            <motion.div key={h.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 6) * 0.03 }}
              style={{ position: "relative", paddingBottom: i === items.length - 1 ? 0 : 15 }}>
              {/* Même icône d'état que le tableau et les onglets (dev 29/10/2026), posée sur le fil. */}
              <span style={{ position: "absolute", left: -22, top: 1, padding: 1, borderRadius: "50%", background: CARD, lineHeight: 0 }}><EtatIcon etat={h.etat} size={12} /></span>
              <div style={{ fontSize: 13, fontWeight: 500, color: st.fg || TEXT }}>{h.etat}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{etatHistDates(h)}</div>
              <div style={{ fontSize: 10.5, color: "#a8a39b", marginTop: 1 }}>
                {etatAuthor(h) ? `${etatAuthor(h)} · ` : ""}{timeAgo(h.created_at)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
    </motion.div>
  );
}

// Pop-up "Agenda du client" : consolide les RDV standards (fiche) + les RDV
// juristes (GET /optilex/client-agenda) en une timeline, avec le juriste de
// référence (= dernier juriste "booked"). createPortal -> fontFamily Inter remise
// sur le root du portail (sort du conteneur de police sinon).
function ClientAgendaModal({ row, num, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    apiClient.get(`/api/v1/optilex/client-agenda?numero_client=${encodeURIComponent(num)}`)
      .then((r) => { if (alive) { setData(r); setLoading(false); } })
      .catch(() => { if (alive) { setData({ rdv: [], reference_jurist: null, count: 0 }); setLoading(false); } });
    return () => { alive = false; };
  }, [num]);

  const items = useMemo(() => {
    const std = [
      { key: "onb", label: "Onboarding Owner", type: "Owner", date: row.rdv_onboarding_date_manual || row.rdv_onboarding_date || row.rdv_onboarding_done_date, done: row.rdv_onboarding_done },
      { key: "int", label: "Intégration Opti'Lex", type: "Opti'Lex", date: row.rdv_lancement_date, done: row.rdv_lancement_done },
      { key: "fis", label: "Lancement fiscal", type: "Opti'Lex", date: row.rdv_fiscal_date_manual || row.rdv_fiscal_date, done: row.rdv_fiscal_done },
      { key: "soc", label: "Lancement social", type: "Opti'Lex", date: row.rdv_social_date_manual || row.rdv_social_date, done: row.rdv_social_done },
    ].filter((x) => x.date).map((x) => ({ ...x, kind: "standard", when: String(x.date) }));
    const jur = ((data && data.rdv) || []).map((b, i) => ({
      key: `jur-${b.juriste_email || ""}-${b.slot_start || i}`,
      label: b.summary || `RDV juriste ${b.team || ""}`.trim(),
      juriste: `${b.juriste_name || "Juriste"}${b.team ? " · " + b.team : ""}`,
      cancelled: b.status === "cancelled",
      kind: "jurist", when: String(b.slot_start),
    }));
    return [...std, ...jur].sort((a, b) => (b.when || "").localeCompare(a.when || ""));
  }, [row, data]);

  // Heure d'un RDV. DEUX conventions cohabitent ici, ne jamais les confondre :
  //  - RDV CRM (kind 'standard') : heure-MUR déjà en heure de Paris -> on lit la
  //    chaîne telle quelle (une conversion la décalerait de 1 à 2 h) ;
  //  - RDV juristes (kind 'jurist', venus du SaaS) : vrais instants UTC -> on
  //    convertit vers Europe/Paris.
  const wallTime = (s) => { const m = String(s).match(/T(\d{2}):(\d{2})/); return m ? `${m[1]}:${m[2]}` : null; };
  const timeOf = (it) => {
    const s = String(it?.when || "");
    if (!/T\d\d:\d\d/.test(s)) return "·";
    if (it.kind === "standard") return wallTime(s) || "·";
    try { return new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }); }
    catch { return "·"; }
  };
  // Groupe les RDV par JOUR, jour le plus récent d'abord -> vue agenda.
  const days = useMemo(() => {
    const dayKey = (it) => {
      if (it.kind === "standard") return String(it.when).slice(0, 10);
      try { return new Date(it.when).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); }
      catch { return String(it.when).slice(0, 10); }
    };
    const dayLabel = (key) => {
      try { return new Date(`${key}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
      catch { return key; }
    };
    const map = new Map();
    for (const it of items) {
      const k = dayKey(it);
      if (!map.has(k)) map.set(k, { key: k, label: dayLabel(k), items: [] });
      map.get(k).items.push(it);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [items]);

  const ref = data && data.reference_jurist;
  // Chiffres-clés : le prochain rendez-vous à venir (non annulé), le total et ceux déjà faits.
  const nowIso = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const upcoming = [...items].filter((it) => !it.cancelled && !it.done && String(it.when).slice(0, 10) >= nowIso)
    .sort((a, b) => String(a.when).localeCompare(String(b.when)))[0];
  const doneCount = items.filter((it) => it.done).length;
  const shortDay = (it) => { const k = String(it.when).slice(0, 10); try { return new Date(`${k}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", ""); } catch { return k; } };
  const toneOf = (it) => (it.cancelled ? "#cfc9c0" : it.kind === "jurist" ? "#6c62d8" : it.type === "Owner" ? NAVY : "#3e7d5a");

  // Même mise en page que « Faire l'onboarding » et « Créances » (dev 29/10/2026, « better this pop up same way »).
  return createPortal(
    <div className="ag" style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(28,27,25,.22)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
      <motion.div className="ag-modal" role="dialog" aria-modal="true" aria-label="Agenda du client"
        initial={{ opacity: 0, scale: 0.94, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
        <header className="ag-head">
          <div style={{ minWidth: 0 }}>
            <h3>Agenda du client</h3>
            <p>{ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || row.numero_client}</p>
          </div>
          <button type="button" className="ag-close" onClick={onClose} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="ag-body ofd">
          <div className="ofd-stats">
            <Stat i={0} label="Juriste référent" value={ref ? String(ref.name || "").split(" ")[0] : "Aucun"}
              sub={ref ? [String(ref.name || "").split(" ").slice(1).join(" "), ref.team].filter(Boolean).join(" · ") : "pas encore de RDV"} art="person" />
            <Stat i={1} label="Prochain RDV" value={upcoming ? shortDay(upcoming) : "Aucun"} sub={upcoming ? `${timeOf(upcoming)} · ${String(upcoming.label).split(" · ")[0]}` : "rien de prévu"} art="calendar" />
            <Stat i={2} label="Rendez-vous" value={loading ? "…" : String(items.length)} sub={`dont ${doneCount} effectué${doneCount > 1 ? "s" : ""}`} art="stack" />
          </div>
          {loading ? (
            <p className="ofd-note">Chargement de l'agenda…</p>
          ) : items.length === 0 ? (
            <p className="ofd-note">Aucun rendez-vous enregistré.</p>
          ) : days.map((d, di) => (
            <Panel key={d.key} title={<span className="ag-day">{d.label}</span>}>
              <div className="ag-list">
                {d.items.map((it, ii) => (
                  <div key={it.key} className={`ag-item${it.cancelled ? " is-cancelled" : ""}`} style={{ "--ag-tone": toneOf(it), "--ag-i": di * 2 + ii }}>
                    <span className="ag-time">{timeOf(it)}</span>
                    <span className="ag-bar" />
                    <div className="ag-tx">
                      <strong>{it.label}</strong>
                      <small>{it.kind === "jurist" ? (it.juriste || "Juriste") + (it.cancelled ? " · annulé" : "") : it.type}</small>
                    </div>
                    {it.kind === "standard" && <Tag tone={it.done ? GREEN : MUTED}>{it.done ? "Effectué" : "À venir"}</Tag>}
                    {it.cancelled && <Tag tone="#c5221f">Annulé</Tag>}
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ── En-tête de la fiche (dev 10/11/2026) : le gabarit de la fiche Finance. Qui est le client, où il en est, et trois
//    repères lus d'un coup d'œil. Rien ne s'y règle : la situation, la météo et les coordonnées se modifient juste
//    dessous, dans les propriétés.
const ONBOARDING_TILE = { done: "Réalisé", venir: "À venir", confirm: "À confirmer", todo: "À faire", noshow: "No show" };
// Ancienneté depuis la signature du contrat Owner : « 12 jours », « 7 mois », « 1 an 2 mois ».
function sinceSigned(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = _todayParisISO().split("-").map(Number);
  let months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  if (months < 1) {
    const days = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000));
    return days === 0 ? "Aujourd'hui" : `${days} jour${days > 1 ? "s" : ""}`;
  }
  const years = Math.floor(months / 12);
  months %= 12;
  if (!years) return `${months} mois`;
  return `${years} an${years > 1 ? "s" : ""}${months ? ` ${months} mois` : ""}`;
}
function FicheTile({ i, label, icon, value, note, reduce }) {
  return (
    <motion.div className="ob-fh-tile" initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.34, delay: 0.04 + i * 0.05, ease: [0.16, 1, 0.3, 1] } }}
      whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.18 } }}>
      <span className="ob-fh-tile-k">{label}{icon}</span>
      <span className="ob-fh-tile-v" title={typeof value === "string" ? value : undefined}>{value}</span>
      <span className="ob-fh-tile-n" title={note}>{note}</span>
    </motion.div>
  );
}
function FicheHeader({ row, full, onToggleFull, onClose }) {
  const reduce = useReducedMotion();
  const num = row.numero_client;
  const name = primaryName(row);
  const company = companyName(row);
  const etat = displayEtat(row);
  const weather = weatherPresentation(row.meteo_score, row.meteo_context);
  const situation = onboardingSituation(row, _todayParisISO(), { exited: isOutOfOnboarding(etat) });
  const onboardingDate = onboardingDateOf(row);
  const onboardingNote = situation === "done" ? (onboardingDate ? `le ${fmt(onboardingDate)}` : "date non renseignée")
    : situation === "venir" ? `prévu le ${fmt(onboardingDate)}`
    : situation === "confirm" ? "en attente de qualification"
    : situation ? (onboardingDate ? `rendez-vous du ${fmt(onboardingDate)}` : "aucune date posée")
    : num ? "hors parcours" : "vente non déclarée";
  const signed = sigDateOf(row);
  return (
    <header className="ob-fh">
      <div className="ob-fh-top">
        <motion.div className="ob-fh-id" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
          <Avatar name={name} n={row.sheet_num} size={48} round />
          <div style={{ minWidth: 0 }}>
            <h1 className="ob-fh-name">{name}</h1>
            {company && company !== name && <div className="ob-fh-sub">{company}</div>}
          </div>
        </motion.div>
        <div className="ob-fh-actions">
          <button type="button" className="ob-fh-ring" onClick={onToggleFull} title={full ? "Revenir au panneau" : "Afficher en plein écran"} aria-label={full ? "Revenir au panneau" : "Afficher en plein écran"}>
            {full ? <Minimize2 size={15} strokeWidth={1.9} /> : <Maximize2 size={15} strokeWidth={1.9} />}
          </button>
          {full && (
            <button type="button" className="ob-fh-ring is-close" onClick={onClose} title="Fermer" aria-label="Fermer la fiche">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="ob-fh-meta">
        {etat && <EtatBadge etat={etat} withIcon />}
        {num && <span className="ob-fh-chip">Client n° {num}</span>}
        {row.secteur_activite && <span className="ob-fh-chip"><SectorIcon secteur={row.secteur_activite} size={15} />{secteurLabel(row.secteur_activite)}</span>}
      </div>
      <div className="ob-fh-tiles">
        <FicheTile i={0} reduce={reduce} label="Météo"
          icon={weather ? <MeteoIcon score={row.meteo_score} size={16} color={weather.color} /> : <CloudSun size={15} strokeWidth={1.9} />}
          value={weather ? weather.label : "À noter"}
          note={weather ? `${row.meteo_score}/5${row.meteo_at ? ` · ${timeAgo(row.meteo_at)}` : weather.legacy ? " · ancienne échelle" : ""}` : "aucune note posée"} />
        <FicheTile i={1} reduce={reduce} label="Onboarding" icon={<CalendarCheck size={15} strokeWidth={1.9} />}
          value={situation ? ONBOARDING_TILE[situation] : "—"} note={onboardingNote} />
        <FicheTile i={2} reduce={reduce} label="Client depuis" icon={<FileSignature size={15} strokeWidth={1.9} />}
          value={signed ? sinceSigned(signed) : "—"} note={signed ? `signé le ${fmt(signed)}` : "contrat Owner non signé"} />
      </div>
    </header>
  );
}

export function DetailPanel({ row, onClose, reload, reloadRatings, patch, changeEtat, etatHistVersion, recordMeteo, meteoHistVersion }) {
  const num = row.numero_client;
  // Plein écran : la même fiche sur toute la fenêtre, fiche à gauche et suivi à droite sur grand écran.
  const [full, setFull] = useState(false);
  // Rôles en lecture seule (RH) : la fiche se lit, aucun contrôle d'écriture (voir isBoardReadOnly).
  const readOnly = isBoardReadOnly();
  // Rafraîchit le bloc signature Opti'Lex après un changement d'email (le destinataire du
  // rappel Yousign est re-résolu côté backend) : bumpé par EmailSelect après le patch commité.
  const [sigRefresh, setSigRefresh] = useState(0);
  // Après une correction d'adresse par le Client Success : le bloc « Prévenir Lisa » se
  // positionne sur le motif « Adresse e-mail corrigée » (l'envoi reste un clic explicite).
  const [alertPrefill, setAlertPrefill] = useState(null);
  const [agendaOpen, setAgendaOpen] = useState(false); // pop-up "Agenda du client" (RDV standards + RDV juristes)
  const [reschedOpen, setReschedOpen] = useState(false); // pop-up "Recaler le RDV onboarding" (Vincent / facturation)
  const [cancelOpen, setCancelOpen] = useState(false);   // "fiscal" | "social" : annuler un RDV de lancement (30/09)
  const [apptVersion, setApptVersion] = useState(0);      // recalage fait depuis le parcours : il relit ses RDV
  const [onboardingOpen, setOnboardingOpen] = useState(false); // parcours « Faire l'onboarding » (Client Success)
  const [transferTo, setTransferTo] = useState(null);      // « Transférer à … » : animateur cible (dev 29/10/2026)
  const onboardingHost = useOnboardingHost(num, ONBOARDING_FLOW_ROLES.includes(roleOf()) && !row.rdv_onboarding_done
    && !!(row.rdv_onboarding_date_manual || row.rdv_onboarding_date), apptVersion);
  // Antériorité emails : à l'ouverture d'une fiche, on enregistre les emails vus (Owner + Opti'Lex
  // courant par SIREN) dans l'historique -> on garde la trace même quand l'email change ensuite,
  // pour pouvoir revenir à un email antérieur dans le dropdown. Best-effort (silencieux).
  // Une écriture : jamais pour les rôles en lecture seule (le serveur la refuserait).
  useEffect(() => {
    if (!num || readOnly) return;
    const emails = [];
    if (row.email) emails.push({ email: row.email, source: "owner" });
    if (row.email_optilex) emails.push({ email: row.email_optilex, source: "optilex" });
    if (emails.length) apiClient.post("/api/v1/optilex/email-history", { numero_client: num, emails }).catch(() => {});
  }, [num, row.email, row.email_optilex, readOnly]);
  // Étape du parcours e-mail Opti'Lex, sur une ligne : enveloppe grise (pas parti) ou verte (envoyé) et sa
  // date. On trace l'ENVOI (le dispatch Resend marque *_email_sent_at), pas l'ouverture.
  const emailStep = (label, trigger, sentAt) => {
    const sent = !!sentAt;
    return (
      <div className={`ob-step${sent ? " is-done" : ""}`}>
        <svg className="ob-step-ic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ob-step-t">{label}</div>
          <div className="ob-step-s">{trigger}</div>
        </div>
        <div className="ob-step-r">
          {sent ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Envoyé le {fmt(sentAt)}</> : "Non envoyé"}
        </div>
      </div>
    );
  };
  // Le parcours e-mail n'a de sens que pour un client dans le flux Opti'Lex (contrat
  // séparé) : un contrat groupé (inclus à l'Owner) n'a pas d'e-mails cabinet dédiés.
  const hasOptilexTrack = row.optilex_status != null || !!row.rdv_lancement_date || !!row.optilex_welcome_email_at || !!row.optilex_livret_email_at || !!row.optilex_docs_email_at || !!row.optilex_contract_forms_email_at;
  // Onglets (dev 29/10/2026) : le suivi du client sous les propriétés et les rendez-vous. Les panneaux restent
  // montés (cachés) : un brouillon de commentaire ou un dépliage survit au changement d'onglet. « Échanges »
  // est ouvert par défaut, ce qui garde l'ouverture directe sur le fil depuis une notification (?focus=comments).
  const [tab, setTab] = useState("echanges");
  const [echangesCount, setEchangesCount] = useState(0);
  // Dossier du client (pièces jointes, appels) : lu une fois pour les onglets Documents et Appels.
  const files = useClientFiles(num);
  const appointments = <>
          {/* RDV + statut "effectué" */}
          <div className="ob-sec" style={{ animationDelay: "0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <SecTitle icon="rdv" style={{ marginBottom: 0 }} hint="L'onboarding Owner et les rendez-vous du cabinet.">Rendez-vous</SecTitle>
            {num && (
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setAgendaOpen(true)}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f5f2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = CARD; }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Voir l'agenda
              </motion.button>
            )}
          </div>
          {ONBOARDING_FLOW_ROLES.includes(roleOf()) && !!num && row.onboarding_to_confirm && (
            <OnboardingToConfirm key={num} row={row}
              onDone={(d) => patch(num, { rdv_onboarding_done: true, rdv_onboarding_done_date: d })}
              onNotDone={() => patch(num, { rdv_onboarding_done: false })} />
          )}
          {ONBOARDING_FLOW_ROLES.includes(roleOf()) && !!num ? (
            // Onglet Détails allégé (dev 24/09/2026) : un seul bouton, le reste vit dans le parcours.
            <OnboardingCard row={row} holdCut={onboardingOpen} onStart={() => setOnboardingOpen(true)} onDateSaved={reload}
              onManualDone={(d) => patch(num, { rdv_onboarding_done: true, rdv_onboarding_done_date: d })}
              onReschedule={(kind) => setReschedOpen(kind)} onCancel={!isFinanceTeam() ? (kind) => setCancelOpen(kind) : undefined}
              hostInfo={onboardingHost} onTransfer={(t) => setTransferTo(t)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <RdvRow label="Rendez-vous Onboarding Owner" date={row.rdv_onboarding_date_manual || row.rdv_onboarding_date || row.rdv_onboarding_done_date} done={row.rdv_onboarding_done}
                editable={!!num && ["customer_success_manager", "admin", "ceo"].includes((apiClient.getUser() || {}).role)}
                link={!row.rdv_onboarding_done ? row.onboarding_url || null : null}
                meetLink={row.onboarding_meet_link}
                onToggle={(v) => patch(num, { rdv_onboarding_done: v })} />
              {!!num && ["customer_success_manager", "admin", "ceo"].includes((apiClient.getUser() || {}).role) && (
                <BoardOnboardingDateCorrection key={num} numero={num}
                  initialDate={toDateInput(row.rdv_onboarding_date_manual || row.rdv_onboarding_date)} onSaved={reload} />
              )}
              {/* Recalage direct du RDV onboarding (Vincent / facturation / admin) : déplace la
                  date CRM ET les 2 événements Google (Vincent + facturation), client notifié. */}
              {!!num && !!(row.rdv_onboarding_date_manual || row.rdv_onboarding_date)
                && ["admin", "ceo", "customer_success_manager", "finance_team"].includes((apiClient.getUser() || {}).role) && (
                <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setReschedOpen("onboarding")}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f5f2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = CARD; }}
                  style={{ alignSelf: "flex-start", marginTop: -2, display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                  Recaler le RDV onboarding
                </motion.button>
              )}
              <RdvRow label="Rendez-vous Intégration Opti'Lex" date={row.rdv_lancement_date} done={row.rdv_lancement_done} editable={!!num && !isFinanceTeam()} readOnly={readOnly} meetLink={row.lancement_meet_link}
                onToggle={(v) => patch(num, { rdv_lancement_done: v })} />
              <RdvRow label="Rendez-vous lancement fiscal" date={row.rdv_fiscal_date_manual || row.rdv_fiscal_date} done={row.rdv_fiscal_done} readOnly={readOnly} editable={!!num && !isFinanceTeam() && !!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date)}
                link={row.fiscal_url || null}
                onReschedule={num && !isFinanceTeam() && (row.rdv_fiscal_date_manual || row.rdv_fiscal_date) ? () => setReschedOpen("fiscal") : undefined}
                onCancel={num && !isFinanceTeam() && launchCancellable(row.rdv_fiscal_date_manual || row.rdv_fiscal_date, row.rdv_fiscal_done) ? () => setCancelOpen("fiscal") : undefined}
                onToggle={(v) => patch(num, { rdv_fiscal_done: v })} />
              <RdvRow label="Rendez-vous lancement social" date={row.rdv_social_date_manual || row.rdv_social_date} done={row.rdv_social_done} readOnly={readOnly} editable={!!num && !isFinanceTeam() && !!(row.rdv_social_date_manual || row.rdv_social_date)}
                link={row.social_url || null}
                onReschedule={num && !isFinanceTeam() && (row.rdv_social_date_manual || row.rdv_social_date) ? () => setReschedOpen("social") : undefined}
                onCancel={num && !isFinanceTeam() && launchCancellable(row.rdv_social_date_manual || row.rdv_social_date, row.rdv_social_done) ? () => setCancelOpen("social") : undefined}
                onToggle={(v) => patch(num, { rdv_social_done: v })} />
            </div>
          )}
          </div>

  </>;
  const role = (apiClient.getUser() || {}).role;
  const tabs = [
    { key: "echanges", label: "Échanges", count: echangesCount },
    files.allowed && { key: "appels", label: "Appels" },
    { key: "documents", label: "Documents", count: files.items.filter((i) => i.kind !== "call").length },
    { key: "integration", label: "Intégration" },
    { key: "facturation", label: "Facturation" },
    { key: "historique", label: "Historique" },
  ].filter(Boolean);
  const emptyNote = (text) => <div className="ob-dp-empty">{text}</div>;
  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: "fixed", inset: 0, background: "rgba(28,27,25,.22)", zIndex: 9998 }} />
      <motion.button type="button" className={`ob-dp-close${full ? " is-hidden" : ""}`} onClick={onClose} title="Fermer" aria-hidden="true" tabIndex={-1}
        initial={{ opacity: 0, scale: 0.7, x: 12 }} animate={{ opacity: 1, scale: 1, x: 0, transition: { delay: 0.1, type: "spring", stiffness: 520, damping: 30 } }}
        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </motion.button>
      <motion.div
        initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 56, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`ob-detail-panel${full ? " is-full" : ""}`} role="dialog" aria-modal="true" aria-hidden={agendaOpen || !!reschedOpen || !!cancelOpen || undefined} aria-label="Détails du client">
        {/* En-tête revenu (dev 10/11/2026) sur le modèle de la fiche Finance ; le nom, la société et la périodicité
            restent aussi dans les propriétés. Fermeture : la croix ronde posée à gauche du panneau (décorative) et,
            pour le clavier et les lecteurs d'écran, ce bouton qui apparaît au focus. */}
        <button type="button" className="ob-dp-close-sr" onClick={onClose}>Fermer la fiche</button>
        <div className="ob-dp-scroll">
        <div className="ob-dp-body">
          <FicheHeader row={row} full={full} onToggleFull={() => setFull((v) => !v)} onClose={onClose} />
          <div className="ob-dp-cols">
          <div className="ob-dp-main">
          {/* Convention Opti'Lex pas signée (planifiée, envoyée, expirée) : en tête, pour que tout le monde le voie
              tout de suite ; le Client Success prévient le cabinet (jamais de relance directe), la direction et le
              cabinet renouvellent une convention expirée (dev 29/10/2026). */}
          {["scheduled", "ongoing", "expired"].includes(row.optilex_status) && (
            <div className="ob-dp-block ob-dp-convention">
              <ConventionBar status={row.optilex_status} sub={conventionSub(row)}>
                {row.optilex_status === "expired" && ["admin", "ceo", "optilex"].includes(role) && (
                  <RenewBlock bare email={row.email} sentAt={row.optilex_sent_at} onRenewed={reload} />
                )}
                {!!num && ALERT_CABINET_ROLES.includes(roleOf()) && <AlertCabinetButton numero={num} prefill={alertPrefill} />}
              </ConventionBar>
            </div>
          )}
          <div className="ob-sec ob-dp-block" style={{ animationDelay: "0.04s" }}>
            <ClientInfoSection row={row} num={num} patch={patch} recordMeteo={recordMeteo} onEmailSaved={() => { setSigRefresh((v) => v + 1); setAlertPrefill("email_changed"); }} changeEtat={changeEtat} onContactsChanged={reload} />
          </div>

          {appointments}

          {/* Fiche d'intégration remontée sous le rendez-vous (dev 29/10/2026, « more up ») : le portefeuille. */}
          {!!num && <div className="ob-dp-block ob-dp-wallet"><BoardIntegrationSheet key={`sheet-${num || row.id}`} numero={num} onRated={reloadRatings} compact /></div>}

          </div>
          <div className="ob-dp-side">
          <div className="ob-tabs" role="tablist" aria-label="Suivi du client">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" id={`ob-tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`ob-panel-${t.key}`}
                className={`ob-tab${tab === t.key ? " is-on" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
                {t.count > 0 && <span className="ob-tab-n">{t.count}</span>}
                {tab === t.key && <motion.span layoutId="obDetailTab" className="ob-tab-line" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              </button>
            ))}
          </div>

          {/* Échanges : la météo (échelle, historique) et l'espace commun (commentaires et notations). */}
          <div role="tabpanel" id="ob-panel-echanges" aria-labelledby="ob-tab-echanges" hidden={tab !== "echanges"} className="ob-tabpanel">
            {row.numero_client
              ? <MeteoSection key={num} row={row} num={num} recordMeteo={recordMeteo} version={meteoHistVersion} onChanged={reloadRatings} onCount={setEchangesCount} />
              : emptyNote("Contrat en cours d'envoi : les échanges seront disponibles une fois la vente déclarée.")}
          </div>

          {/* Intégration : convention Opti'Lex (forçage, signature), e-mails. La carte convention et la fiche
              d'intégration sont en tête de fiche (29/10/2026), les missions dans les infos client (30/10/2026). */}
          <div role="tabpanel" id="ob-panel-integration" aria-labelledby="ob-tab-integration" hidden={tab !== "integration"} className="ob-tabpanel">
            {/* Les conventions en dossiers : au clic la feuille sort du dossier et devient le PDF. */}
            <div style={{ marginBottom: 24 }}>
              <SecTitle icon="signature" hint="Au clic, la feuille sort du dossier et s'ouvre.">Contrats</SecTitle>
              <ContractFolders contractId={row.contract_id} items={contractFolderItems(row)} group={`integration-${num || row.id}`} />
            </div>
            {["admin", "optilex"].includes(role) && row.owner_status === "done" && (row.optilex_status === "scheduled" || row.optilex_status === "awaiting_owner_signature") && (
              <ForceSendBlock email={row.email} scheduledAt={row.optilex_scheduled_at} onForced={reload} />
            )}
            {/* Lien de signature Opti'Lex + relance (uniquement si le contrat est envoyé) */}
            {row.optilex_status === "ongoing" && (
              <>
                <SecTitle icon="signature">Signature Opti'Lex</SecTitle>
                <div style={{ marginBottom: 22 }}><OptilexSignatureBlock email={row.email} chosenEmail={ov(row, "email_ovr", "email")} refreshKey={sigRefresh} /></div>
              </>
            )}
            {/* Parcours des 4 e-mails Opti'Lex automatisés : enveloppe grise = pas parti, verte = envoyé et sa date. */}
            {hasOptilexTrack && (
              <div style={{ marginBottom: 22 }}>
                <SecTitle icon="emails" hint="Les quatre e-mails automatiques du cabinet et leur date d'envoi.">E-mails Opti'Lex</SecTitle>
                <div className="ob-steps">
                  {emailStep("Accueil", "À l'envoi du contrat Opti'Lex", row.optilex_welcome_email_at)}
                  {emailStep("Livret", "À la signature du contrat", row.optilex_livret_email_at)}
                  {emailStep("Documents à envoyer", "Au RDV d'intégration effectué", row.optilex_docs_email_at)}
                  {emailStep("Formulaires contrats", "Au RDV d'intégration effectué", row.optilex_contract_forms_email_at)}
                </div>
              </div>
            )}
          </div>

          {/* Appels : toutes les communications téléphoniques avec le client (Allo), écoute et transcription. */}
          {files.allowed && (
            <div role="tabpanel" id="ob-panel-appels" aria-labelledby="ob-tab-appels" hidden={tab !== "appels"} className="ob-tabpanel">
              {num ? <BoardCalls files={files} active={tab === "appels"} /> : emptyNote("Contrat en cours d'envoi : les appels seront disponibles une fois la vente déclarée.")}
            </div>
          )}

          {/* Documents : les pièces jointes et e-mails partagés avec la finance. */}
          <div role="tabpanel" id="ob-panel-documents" aria-labelledby="ob-tab-documents" hidden={tab !== "documents"} className="ob-tabpanel">
            {num ? <BoardDocuments files={files} /> : emptyNote("Contrat en cours d'envoi : les documents seront disponibles une fois la vente déclarée.")}
          </div>

          {/* Facturation : jalons éditables (indisponibles tant que le client n'est pas établi) et RDV +2 mois. */}
          <div role="tabpanel" id="ob-panel-facturation" aria-labelledby="ob-tab-facturation" hidden={tab !== "facturation"} className="ob-tabpanel">
            {num ? (
              <>
                <SecTitle icon="facturation" hint="Les jalons de facturation Owner et Opti'Lex, puis le rendez-vous à deux mois.">Suivi facturation</SecTitle>
                <JalonRow label="Statut facturation Owner" editable={!isFinanceTeam()} readOnly={readOnly} done={row.facturation_honoraires_done} date={row.facturation_honoraires_date}
                  onToggle={(v) => patch(num, { facturation_honoraires_done: v })} onDate={(d) => patch(num, { facturation_honoraires_date: d })} />
                <JalonRow label="Statut facturation Opti'Lex" editable={!isFinanceTeam()} readOnly={readOnly} done={row.setup_facturation_done} date={row.setup_facturation_date}
                  onToggle={(v) => patch(num, { setup_facturation_done: v })} onDate={(d) => patch(num, { setup_facturation_date: d })} />
                {/* RDV +2 mois : RdvRow avec LIEN de prise de RDV (30 min avec le cabinet).
                    Date affichée = manuelle (rdv_plus1mois_date, prime) sinon date réservée par
                    le client (rdv_plus2mois_date, via le booking). Lien copiable tant qu'aucune
                    date n'est posée. Toggle À venir/Effectué conservé (planifiable avant). */}
                <RdvRow label="RDV +2 mois" date={row.rdv_plus1mois_date || row.rdv_plus2mois_date} done={row.rdv_plus1mois_done} editable={!!num && !isFinanceTeam()} readOnly={readOnly}
                  link={row.plus2mois_url || null}
                  onDate={(d) => patch(num, { rdv_plus1mois_date: d })}
                  onToggle={(v) => patch(num, { rdv_plus1mois_done: v })} />
              </>
            ) : emptyNote("Contrat en cours d'envoi. Le suivi facturation et les commentaires seront disponibles une fois la vente déclarée (client rattaché).")}
          </div>

          {/* Historique de la situation (audit fiscaliste). */}
          <div role="tabpanel" id="ob-panel-historique" aria-labelledby="ob-tab-historique" hidden={tab !== "historique"} className="ob-tabpanel">
            <EtatHistory num={num} version={etatHistVersion} />
          </div>

          </div>
          </div>
          {agendaOpen && <ClientAgendaModal row={row} num={num} onClose={() => setAgendaOpen(false)} />}
          {onboardingOpen && <OnboardingFlowModal row={row} num={num} patch={patch} onClose={() => setOnboardingOpen(false)}
            onRescheduleWithDate={() => setReschedOpen("onboarding")} onReschedule={(kind) => setReschedOpen(kind)}
            onCancel={!isFinanceTeam() ? (kind) => setCancelOpen(kind) : undefined}
            blocked={!!reschedOpen || !!cancelOpen} refreshKey={apptVersion} onChanged={() => { reload(); reloadRatings?.(); }} />}
          {reschedOpen && <ReschedOnboardingModal kind={reschedOpen} row={row} num={num} onClose={() => { setReschedOpen(false); setApptVersion((v) => v + 1); reload(); }} onDone={() => { setReschedOpen(false); setApptVersion((v) => v + 1); reload(); }} />}
          {transferTo && <TransferOnboardingModal row={row} num={num} target={transferTo} current={onboardingHost?.host} slot={onboardingHost?.slot}
            onClose={() => setTransferTo(null)} onDone={() => { setTransferTo(null); setApptVersion((v) => v + 1); reload(); }} />}
          {cancelOpen && <CancelLaunchModal kind={cancelOpen} row={row} num={num} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); setApptVersion((v) => v + 1); reload(); }} />}
        </div>
        </div>
      </motion.div>
    </>
  );
}

// Recalage du RDV Onboarding Owner depuis le board (chantier Vincent 2026-08-25).
// Créneaux libres = API de la déclaration de vente (freebusy Vincent + facturation,
// heures-mur Paris). La confirmation déplace la date CRM et les événements agenda.
// ── Animateur de l'onboarding (dev 29/10/2026) : qui anime, avec sa photo, et ce que l'utilisateur peut en faire.
//    Le back décide : choisir l'animateur au recalage (responsable d'équipe) et confier ses rendez-vous à son équipe.
function useOnboardingHost(num, enabled, version = 0) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!enabled || !num) { setInfo(null); return undefined; }
    let alive = true;
    apiClient.get(`/api/v1/optilex/board-onboarding-host?numero_client=${encodeURIComponent(num)}`)
      .then((r) => { if (alive) setInfo(r || null); })
      .catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [num, enabled, version]);
  return info;
}

function HostFace({ name, photo, size = 20, ring = false }) {
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, boxShadow: ring ? "0 0 0 1.5px #fff" : "none" };
  return photo ? (
    <img src={photo} alt={name || ""} draggable={false} style={{ ...base, objectFit: "cover" }} />
  ) : (
    <span aria-hidden="true" style={{ ...base, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#f1eee9", color: NAVY, fontSize: Math.round(size * 0.48), fontWeight: 500 }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Transférer l'onboarding à l'autre animateur de l'équipe, au même créneau : l'événement passe d'un agenda à l'autre,
// même lien Meet, même si l'autre a déjà un rendez-vous à cette heure ; ce n'est pas une reprogrammation,
// et le client ne reçoit rien (dev 29/10/2026).
// Élision devant une voyelle : « de … » devient « d’… ».
const deName = (name) => (/^[aeiouyàâéèêîïôû]/i.test(name || "") ? `d’${name}` : `de ${name}`);

function TransferOnboardingModal({ row, num, target, current, slot, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const label = ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || num;
  const confirm = async () => {
    if (saving || done) return;
    setSaving(true); setError(null);
    try {
      await apiClient.post("/api/v1/optilex/board-transfer-onboarding", { numero_client: num, host: target.name });
      setDone(true);
      setTimeout(() => onDone(), 1400);
    } catch (e) {
      const d = e?.data?.detail;
      setError(typeof d === "string" ? d : "Le rendez-vous n’a pas pu être transféré. Rien n’a changé.");
      setSaving(false);
    }
  };
  return createPortal(
    <div className="ob-transfer-modal" role="dialog" aria-modal="true" aria-label={`Transférer le rendez-vous à ${target.name}`} style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { if (!saving) onClose(); }} style={{ position: "absolute", inset: 0, background: "rgba(28,27,25,.22)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(440px, 100%)", background: CARD, borderRadius: 22, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(28,27,25,.14)", padding: "20px 22px" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ display: "inline-flex" }}><HostFace name={target.name} photo={target.photo} size={44} /></div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 500, color: GREEN }}>Rendez-vous transféré à {target.name}</div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: MUTED }}>Il est dans son agenda. Le client n’a rien reçu.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {current && <HostFace name={current.name} photo={current.photo} size={34} />}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              <HostFace name={target.name} photo={target.photo} size={34} />
              <div style={{ minWidth: 0, marginLeft: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: NAVY }}>Transférer le rendez-vous à {target.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}{slot ? ` · ${fmtDT(slot)}` : ""}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 13, color: TEXT, lineHeight: 1.55 }}>
              Le rendez-vous passe de l’agenda {current ? deName(current.name) : "de l’animateur actuel"} à celui {deName(target.name)}, au même créneau et avec le même lien Meet, même si {target.name} a déjà un rendez-vous à cette heure. La facturation ne bouge pas. Le client ne reçoit rien.
            </div>
            {error && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: "#c5221f", lineHeight: 1.5 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" disabled={saving} onClick={onClose}
                style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>Annuler</button>
              <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={saving} onClick={confirm}
                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
                {saving ? "Transfert…" : `Transférer à ${target.name}`}
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

function ReschedOnboardingModal({ row, num, onClose, onDone, kind = "onboarding" }) {
  const todayIso = () => new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const [start, setStart] = useState(todayIso());
  const [days, setDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);           // { date, slot }
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(null);
  // Onboarding : animateur du RDV et sa photo ; le responsable d'équipe peut en choisir un autre (dev 29/10/2026).
  const hostInfo = useOnboardingHost(num, kind === "onboarding");
  const [chosenHost, setChosenHost] = useState(null);
  const [hostPhotos, setHostPhotos] = useState({});
  const currentHost = hostInfo?.host?.name || null;
  const hostName = chosenHost || currentHost;
  const hostParam = hostInfo?.can_choose && chosenHost && chosenHost !== currentHost ? chosenHost : null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Onboarding : créneaux de l'animateur du client (celui du rendez-vous, y compris un ancien relais),
    // ou de l'animateur choisi par le responsable d'équipe.
    const client = kind === "onboarding" && num ? `&numero_client=${encodeURIComponent(num)}` : "";
    const chosen = hostParam ? `&host=${encodeURIComponent(hostParam)}` : "";
    apiClient.get(`/api/v1/optilex/board-reschedule-slots?kind=${kind}&start=${start}${client}${chosen}`)
      .then((r) => { if (alive) { setDays(r.days || []); setHostPhotos(r.host_photos || {}); setLoading(false); } })
      .catch(() => { if (alive) { setDays([]); setError("Impossible de charger les disponibilités. Réessayez."); setLoading(false); } });
    return () => { alive = false; };
  }, [start, kind, num, hostParam]);

  const shiftWeek = (dir) => {
    const d = new Date(start + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    const iso = d.toLocaleDateString("fr-CA");
    setSel(null);
    setStart(iso < todayIso() ? todayIso() : iso);
  };

  const confirm = async () => {
    if (!sel || saving || completed) return;
    setSaving(true); setError(null);
    try {
      const result = await apiClient.post("/api/v1/optilex/board-reschedule", { numero_client: num, kind, new_dt: `${sel.date}T${sel.slot}`, ...(hostParam ? { host: hostParam } : {}) });
      appointmentConfirmation(result, sel);
      setCompleted(result);
      setSaving(false);
    } catch (e) {
      const failure = appointmentFailure(e);
      setError(failure.message);
      setUncertain(failure.uncertain);
      setSaving(false);
    }
  };

  const dayLabel = (iso) => { try { return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); } catch { return iso; } };

  if (completed) return createPortal(<AppointmentConfirmation result={completed} selected={sel} label={ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || num} onClose={() => onDone()} />, document.body);

  return createPortal(
    <div className="ob-reschedule-modal" role="dialog" aria-modal="true" aria-label="Reprogrammer le rendez-vous" style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { if (!saving) onClose(); }}
        style={{ position: "absolute", inset: 0, background: "rgba(28,27,25,.22)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(640px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: CARD, borderRadius: 22, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(28,27,25,.14)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: NAVY }}>Reprogrammer le rendez-vous {kind === "onboarding" ? "onboarding" : kind}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || num} · le client sera notifié du nouveau créneau
            </div>
          </div>
          <button type="button" aria-label="Fermer la reprogrammation" disabled={saving} onClick={() => { if (!saving) onClose(); }} style={{ border: "none", background: "none", cursor: "pointer", color: MUTED, fontSize: 17, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>
        {kind === "onboarding" && hostInfo?.can_choose && (hostInfo.options || []).length > 1 && (
          // Responsable d'équipe : il choisit qui anime (dev 29/10/2026). Un autre animateur = l'événement passe
          // dans son agenda, même lien Meet ; le client n'est prévenu que du nouveau créneau.
          <div role="radiogroup" aria-label="Animateur de l'onboarding" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, color: MUTED, marginRight: 2 }}>Animateur</span>
            {hostInfo.options.map((o) => {
              const active = o.name === hostName;
              return (
                <button key={o.name} type="button" role="radio" aria-checked={active} disabled={saving || uncertain}
                  onClick={() => { if (!active) { setChosenHost(o.name); setSel(null); } }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px 4px 5px", borderRadius: 999, border: `1px solid ${active ? CHARCOAL : BORDER}`, background: active ? CHARCOAL : CARD, color: active ? "#fff" : NAVY, fontSize: 12.5, fontWeight: 500, cursor: active ? "default" : "pointer", fontFamily: "inherit", transition: "all .12s ease" }}>
                  <HostFace name={o.name} photo={o.photo} size={22} ring={active} />
                  {o.name}{o.name === currentHost ? <span style={{ fontWeight: 500, opacity: 0.7 }}> · actuel</span> : null}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <button type="button" onClick={() => shiftWeek(-1)} disabled={saving || uncertain || start <= todayIso()}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 500, color: start <= todayIso() ? MUTED : NAVY, cursor: start <= todayIso() ? "default" : "pointer", fontFamily: "inherit" }}>← Sem. préc.</button>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: NAVY }}>Créneaux libres · {kind === "onboarding" ? `${hostName || "animateur"} + facturation` : kind} · heure de Paris</span>
          <button type="button" disabled={saving || uncertain} onClick={() => shiftWeek(1)}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 500, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}>Sem. suiv. →</button>
        </div>
        <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Chargement des créneaux…</div>
          ) : (() => {
            // Slots API = objets {t:'HH:MM', free:bool}. Même règle et même UX que le
            // picker de la déclaration de vente (TrackingSheet) : TOUS les créneaux
            // affichés, les occupés GRISÉS/barrés, seuls les libres sont cliquables.
            // free = Vincent dispo sur [t0, t0+50] ET facturation sur [t0+35, t0+50]
            // (calculé côté serveur via le freebusy Google, comme pour les sales).
            const shown = (days || []).filter((d) => d.slots && d.slots.length > 0);
            if (shown.length === 0) {
              return <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucun créneau libre sur cette semaine.</div>;
            }
            return shown.map((d) => (
              <div key={d.date} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: MUTED, textTransform: "capitalize", marginBottom: 7 }}>{dayLabel(d.date)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {d.slots.map((s) => {
                    const on = sel && sel.date === d.date && sel.slot === s.t;
                    const host = s.free ? s.host : null;
                    const photo = host && hostPhotos[host];
                    return (
                      <button key={s.t} type="button" disabled={saving || uncertain || !s.free}
                        onClick={() => s.free && setSel({ date: d.date, slot: s.t })}
                        title={host || undefined}
                        style={{ padding: "6px 12px", borderRadius: 8,
                          border: `1px solid ${on ? GREEN : (s.free ? BORDER : "transparent")}`,
                          background: on ? GREEN : (s.free ? CARD : "#f7f5f2"),
                          color: on ? "#fff" : (s.free ? NAVY : "#cfc9c0"),
                          textDecoration: s.free ? "none" : "line-through",
                          fontSize: 12.5, fontWeight: 500, cursor: s.free ? "pointer" : "default", fontFamily: "inherit", transition: "all .12s ease" }}>
                        {s.t}
                        {/* Animateur : sa photo comme sur le calendrier du sales, sinon son prénom. */}
                        {photo ? (
                          <img src={photo} alt={host} draggable={false}
                            style={{ width: 20, height: 20, margin: "-4px 0 -4px 7px", verticalAlign: "middle", borderRadius: "50%", objectFit: "cover", boxShadow: on ? "0 0 0 1.5px #fff" : "none" }} />
                        ) : host && (
                          <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 500, color: on ? "rgba(255,255,255,0.78)" : MUTED }}>{host}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span role={error ? "alert" : undefined} style={{ fontSize: 12, color: error ? "#c5221f" : MUTED, minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.5 }}>
            {error || (sel ? `Nouveau créneau : ${dayLabel(sel.date)} à ${sel.slot}` : "Sélectionne un créneau")}
          </span>
          <motion.button type="button" whileTap={sel ? { scale: 0.97 } : undefined} disabled={!sel || saving} onClick={confirm}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: sel ? GREEN : "#ece9e4", color: sel ? "#fff" : MUTED, fontSize: 13, fontWeight: 500, cursor: sel && !saving ? "pointer" : "default", fontFamily: "inherit", flexShrink: 0 }}>
            {saving ? "Recalage…" : (uncertain ? "Vérifier ce créneau" : "Confirmer le recalage")}
          </motion.button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// Annulation d'un RDV de lancement fiscal / social depuis le board (dev 2026-09-30). Même moteur
// que l'espace client : événement retiré de l'agenda du juriste (client prévenu par Google, juriste
// par e-mail), droit de réserver rendu au client. Pas de délai de 24 h ici ; un RDV passé reste consommé.
const CANCEL_RED = "#c5221f";
const launchCancellable = (date, done) => {
  if (!date || done) return false;
  const today = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  return String(date).slice(0, 10) >= today;   // heure-mur Paris, jamais de conversion
};

function CancelLaunchModal({ row, num, kind, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const date = kind === "fiscal" ? (row.rdv_fiscal_date_manual || row.rdv_fiscal_date) : (row.rdv_social_date_manual || row.rdv_social_date);
  const label = ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || num;

  const confirm = async () => {
    if (saving || done) return;
    setSaving(true); setError(null);
    try {
      await apiClient.post("/api/v1/optilex/board-cancel", { numero_client: num, kind });
      setDone(true);
    } catch (e) {
      setError(!e.status || e.status >= 500
        ? "L'agenda n'a pas confirmé l'annulation. Réessayez : elle reprendra sans doublon."
        : (typeof e.data?.detail === "string" ? e.data.detail : e.message || "L'annulation a échoué."));
    }
    setSaving(false);
  };
  const close = () => { if (saving) return; if (done) onDone(); else onClose(); };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Annuler le rendez-vous de lancement" style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close}
        style={{ position: "absolute", inset: 0, background: "rgba(28,27,25,.22)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(460px, 100%)", background: CARD, borderRadius: 22, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(28,27,25,.14)", padding: "20px 22px" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: NAVY }}>{done ? "Rendez-vous annulé" : `Annuler le rendez-vous de lancement ${kind}`}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 3, overflowWrap: "anywhere" }}>{label}{date ? ` · ${fmtDT(date)}` : ""}</div>
        <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.55, margin: "14px 0 0" }}>
          {done
            ? "Il est retiré de l'agenda du juriste. Le client a reçu l'annulation et peut réserver un nouveau créneau avec son lien."
            : "Le rendez-vous sera retiré de l'agenda du juriste. Le client reçoit l'annulation de Google, le juriste un e-mail, et le client pourra réserver un nouveau créneau avec son lien."}
        </p>
        {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: CANCEL_RED, lineHeight: 1.5, overflowWrap: "anywhere" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          {done ? (
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onDone} autoFocus
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: CHARCOAL, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Fermer</motion.button>
          ) : (
            <>
              <button type="button" disabled={saving} onClick={onClose}
                style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>Garder le rendez-vous</button>
              <motion.button type="button" whileTap={saving ? undefined : { scale: 0.97 }} disabled={saving} onClick={confirm}
                style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: CANCEL_RED, color: "#fff", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
                {saving ? "Annulation…" : "Annuler le rendez-vous"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// alwaysDate : la date est TOUJOURS saisissable (RDV à planifier), pas seulement une
// fois "effectué". Sinon (statut fait/pas-fait), la date se révèle au passage à Oui.
// `readOnly` (rôles en lecture seule) : bascule et date visibles, désactivées.
function JalonRow({ label, done, date, onToggle, onDate, alwaysDate = false, toggleLabels, editable = true, readOnly = false }) {
  const showDate = alwaysDate || done;
  const dateLabel = alwaysDate ? "Date prévue" : null;
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
        {editable
          ? <StatusToggle value={!!done} onChange={onToggle} labels={toggleLabels} disabled={readOnly} />
          : <span style={{ fontSize: 12.5, fontWeight: 500, color: done ? GREEN : MUTED }}>{(toggleLabels || ["Non", "Oui"])[done ? 1 : 0]}</span>}
      </div>
      <AnimatePresence initial={false}>
        {showDate && (
          <motion.div key="date" initial={alwaysDate ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: dateLabel ? "space-between" : "flex-end", paddingTop: 10, gap: 10 }}>
              {dateLabel && <div style={{ fontSize: 12, color: MUTED }}>{dateLabel}</div>}
              {/* Commit au blur (cohérent avec DateRow) : pas d'écriture partielle pendant la frappe. */}
              <input key={toDateInput(date)} type="date" defaultValue={toDateInput(date)}
                onBlur={(e) => { const v = e.target.value || null; if (v !== (toDateInput(date) || null)) onDate(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }}
                {...(readOnly ? READ_ONLY_PROPS : {})} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Section météo de la fiche : note courante (badge + qui/quand), saisie inline (Owner
// et cabinet : tous les rôles autorisés sur le board), et historique des notations.
// Onglet « Échanges » de la fiche (dev 29/10/2026) : la météo courante est sur la ligne « Météo » des
// propriétés ; ici l'échelle, l'historique et l'espace commun. `onCount` = commentaires + notations.
function MeteoSection({ row, num, recordMeteo, version, onChanged, onCount }) {
  const [hist,setHist]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [commentCount,setCommentCount]=useState(0);

  useEffect(()=>{let alive=true;setError('');apiClient.get(`/api/v1/optilex/meteo-history?numero_client=${encodeURIComponent(num)}`).then(r=>{if(alive){setHist(r.history||[]);setLoaded(true);}}).catch(()=>{if(alive)setError('Impossible de charger les notations.');});return()=>{alive=false;};},[num,version,refresh]);
  useEffect(()=>{onCount?.(commentCount+hist.length);},[commentCount,hist.length,onCount]);
  const current=loaded?hist[0]:{score:row.meteo_score,weather_context:row.meteo_context,author_name:row.meteo_by,created_at:row.meteo_at};
  const readOnly=isBoardReadOnly();  // rôles en lecture seule : météo et fil lus, saisies visibles et désactivées
  return <div>
    {weatherPresentation(current?.score,current?.weather_context)?.legacy && <p className="wc-legacy-notice">Cette évaluation utilise l’ancienne échelle. Elle est conservée telle qu’elle a été saisie. La prochaine météo utilisera les 5 niveaux ci-dessous.</p>}
    {error && <p role="alert" className="ob-thread-error">{error} <button type="button" onClick={()=>setRefresh(v=>v+1)}>Réessayer</button></p>}
    <CommentThread numero={num} readOnly={readOnly} onCount={setCommentCount} onAddWeather={async payload=>{const ok=await recordMeteo(num,payload);if(ok!==false)setRefresh(v=>v+1);return ok;}} ratings={hist} ratingsLoading={!loaded&&!error} onRatingEdited={updated=>{setHist(items=>items.map(item=>item.id===updated.id?updated:item));onChanged();}} onRatingDeleted={()=>{setRefresh(v=>v+1);onChanged();}} onRatingConflict={()=>setRefresh(v=>v+1)}/>
    <WeatherScaleGuide/>
  </div>;
}

// ── Fil d'échanges de la fiche (dev 29/10/2026, réf. de fil de commentaires) ─────────────────────────────
// Chaque message : avatar, auteur, menu « ⋯ » (modifier, supprimer), texte aéré, puis « Répondre · il y a… ».
// Une notation météo est un message à part entière : sa tuile, son niveau, ses réponses en fil.
const MENU_ICONS = {
  edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  delete: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
};
const menuIcon = (k) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MENU_ICONS[k]}</svg>;
function ItemMenu({ items, label = "Actions" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <span ref={ref} className="ob-menu">
      <button type="button" className="ob-menu-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" className="ob-menu-pop" initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
            {list.map((it) => (
              <button key={it.label} type="button" role="menuitem" className={`ob-menu-item${it.danger ? " is-danger" : ""}`}
                onClick={() => { setOpen(false); it.onClick(); }}>
                {it.icon}{it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Édition et suppression d'une notation : le score et la chronologie ne bougent pas ; les droits viennent de l'API.
function useRatingEditor(rating, numero, { onEdited, onDeleted, onConflict }) {
  const [mode, setMode] = useState(null);
  const [draft, setDraft] = useState("");
  const [expectedNote, setExpectedNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const begin = (nextMode) => {
    setExpectedNote(rating.note ?? null);
    setDraft(rating.note || "");
    setError(""); setMode(nextMode);
  };
  const cancel = () => { setMode(null); setError(""); };
  const submit = async () => {
    if (busy || (mode === 'edit' && !draft.trim())) return;
    setBusy(true); setError("");
    try {
      const payload = { numero_client: numero, expected_note: expectedNote };
      if (mode === 'edit') {
        const updated = await apiClient.patch(`/api/v1/optilex/meteo/${rating.id}/comment`, { ...payload, note: draft.trim() });
        onEdited(updated);
      } else {
        await apiClient.request(`/api/v1/optilex/meteo/${rating.id}`, { method: 'DELETE', body: JSON.stringify(payload) });
        onDeleted();
      }
      setMode(null);
    } catch (e) {
      setError(typeof e.message === 'string' ? e.message : "Impossible d’enregistrer cette modification.");
      if (e.status === 409 || e.status === 404) onConflict();
    } finally { setBusy(false); }
  };
  return { mode, begin, cancel, submit, draft, setDraft, busy, error };
}
function RatingEditorForm({ rating, ed }) {
  return (
    <motion.div className="ob-msg-panel" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}>
      {ed.mode === 'edit' ? <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: TEXT }}>
        Commentaire de la notation {rating.score}/5
        <textarea aria-label="Modifier le commentaire de notation" value={ed.draft} onChange={(e) => ed.setDraft(e.target.value)}
          maxLength={4000} rows={3} disabled={ed.busy} autoFocus
          style={{ ...inputStyle, width: "100%", marginTop: 6, resize: "vertical" }} />
      </label> : <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
        Supprimer cette note de {rating.score}/5 et son commentaire ? La dernière notation restante deviendra la note courante, ou le client sera « non noté ». Les alertes déjà envoyées ne seront pas retirées.
      </p>}
      {ed.error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12, margin: "8px 0 0" }}>{ed.error}</p>}
      <div className="ob-msg-panel-bar">
        <button type="button" className="ob-btn-ghost" disabled={ed.busy} onClick={ed.cancel}>Annuler</button>
        <button type="button" className={ed.mode === 'delete' ? "ob-btn-danger" : "ob-composer-send"} disabled={ed.busy || (ed.mode === 'edit' && !ed.draft.trim())} onClick={ed.submit}>
          {ed.busy ? "Enregistrement…" : ed.mode === 'edit' ? "Enregistrer le commentaire" : "Supprimer la notation"}
        </button>
      </div>
    </motion.div>
  );
}

// Modifier un message : la même zone que la saisie, Échap annule, Cmd/Ctrl + Entrée enregistre.
function MessageEdit({ t }) {
  return (
    <div className="ob-msg-edit">
      <MentionTextarea value={t.editDraft} onChange={t.setEditDraft} people={t.people} rows={2} autoFocus maxLength={4000} className="ob-composer-ta"
        aria-label="Modifier le message"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); t.saveEdit(); }
          if (e.key === "Escape") { e.stopPropagation(); t.cancelEdit(); }
        }} />
      <div className="ob-msg-panel-bar">
        <button type="button" className="ob-btn-ghost" onClick={t.cancelEdit}>Annuler</button>
        <button type="button" className="ob-composer-send" disabled={!t.editDraft.trim() || t.savingEdit} onClick={t.saveEdit}>{t.savingEdit ? "…" : "Enregistrer"}</button>
      </div>
    </div>
  );
}
function DeleteConfirm({ id, t, what }) {
  return (
    <motion.div className="ob-msg-confirm" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <span>Supprimer {what} ?</span>
      <button type="button" className="ob-btn-ghost" onClick={t.cancelDelete}>Annuler</button>
      <button type="button" className="ob-btn-danger" disabled={t.deletingId === id} onClick={() => t.deleteComment(id)}>{t.deletingId === id ? "…" : "Supprimer"}</button>
    </motion.div>
  );
}
const msgTime = (iso) => <time dateTime={iso} title={fmtDT(iso)}>{timeAgo(iso)}</time>;
const editItems = (c, t) => t.readOnly ? [] : [
  { label: "Modifier", icon: menuIcon("edit"), onClick: () => t.startEdit(c) },
  { label: "Supprimer", icon: menuIcon("delete"), danger: true, onClick: () => t.askDelete(c.id) },
];
// Échanges (dev 29/10/2026, réf. de carte de commentaire, « see more smart ») : une carte par échange, avatar rond,
// nom · ancienneté, menu ⋯. Le texte se replie à 4 lignes et le lien « Voir plus » n'apparaît que s'il dépasse
// vraiment ; le motif d'une météo se replie de même ; les réponses se regroupent derrière « N réponses de … ».
const authorOf = (c) => c.author_name || c.author_email || "—";
const CHEVRON = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const REPLY_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
// Bloc replié : hauteur limitée à `max` avec un fondu, ouverture en douceur. La hauteur réelle est mesurée (et
// remesurée quand la fiche change de largeur) : pas de lien pour un texte qui tient.
function Clamp({ max, measureKey, labels = ["Voir plus", "Voir moins"], children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setFull(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureKey]);
  const over = full > max + 4;
  return (
    <div className={`ob-clamp${over && !open ? " is-clamped" : ""}`}>
      <div ref={ref} className="ob-clamp-in" style={over ? { maxHeight: open ? full : max } : undefined}>{children}</div>
      {over && <button type="button" className="ob-clamp-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? labels[1] : labels[0]}{CHEVRON}</button>}
    </div>
  );
}
function AvatarStack({ names, size = 22, max = 4 }) {
  return <span className="ob-stack">{[...new Set(names)].slice(0, max).map((n) => <span key={n}><Avatar name={n} size={size} round /></span>)}</span>;
}
// « Sarah et Hugo », « Sarah, Hugo et Léa », « Sarah, Hugo, Léa et d'autres ».
const whoReplied = (names) => {
  const u = [...new Set(names.map((n) => n.split(/[\s@]/)[0]))];
  if (u.length <= 2) return u.join(" et ");
  return u.length === 3 ? `${u[0]}, ${u[1]} et ${u[2]}` : `${u.slice(0, 3).join(", ")} et d'autres`;
};
function MsgHead({ author, size = 30, small = false, time, extra, menu }) {
  return (
    <header className="ob-xc-head">
      <Avatar name={author} size={size} round />
      <span className={`ob-xc-author${small ? " is-small" : ""}`}>{author}</span>
      <i className="ob-dot" /><span className="ob-xc-time">{time}{extra}</span>
      {menu}
    </header>
  );
}
// Réponse sous le message (dev 29/10/2026 : « les réponses vraiment en dessous du message ») : une ligne de saisie
// dans la carte ; ⌘ Entrée envoie, Échap ferme. L'auteur du message est prévenu comme une mention.
function InlineReply({ t, placeholder, onSend }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(body);
    setBusy(false);
    if (ok) setText("");
  };
  return (
    <motion.div className="ob-xi" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
      <div className="ob-xi-box">
        <Avatar name={t.myName} size={22} round />
        <MentionTextarea value={text} onChange={setText} people={t.people} rows={1} autoFocus className="ob-xi-ta" placeholder={placeholder}
          aria-label="Votre réponse" maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            if (e.key === "Escape") { e.stopPropagation(); t.cancelReply(); }
          }} />
        <button type="button" className="ob-xi-send" disabled={!text.trim() || busy} onClick={send} aria-label="Envoyer la réponse" title="Envoyer (⌘ Entrée)">{SEND_ICON}</button>
      </div>
    </motion.div>
  );
}
function CommentItem({ c, replies, t, openSignal }) {
  const author = authorOf(c);
  const key = `comment:${c.id}`;
  return (
    <motion.article id={`msg-${c.id}`} layout="position" className="ob-xc" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], layout: { type: "spring", stiffness: 380, damping: 36 } }}>
      <MsgHead author={author} time={msgTime(c.created_at)} extra={c.updated_at ? " · modifié" : ""}
        menu={t.canEdit(c) && t.editingId !== c.id && <ItemMenu label="Actions du message" items={editItems(c, t)} />} />
      <div className="ob-xc-in">
        {t.editingId === c.id ? <MessageEdit t={t} />
          : c.body && <Clamp max={88} measureKey={c.body}><div className="ob-xc-text"><MentionedText text={c.body} mentions={c.mentions} /></div></Clamp>}
        <MessageFiles files={c.attachments} />
        {t.confirmDeleteId === c.id && <DeleteConfirm id={c.id} t={t} what="ce message" />}
        <footer className="ob-xc-foot">
          <Reactions list={t.reactionsOf("comment", c.id)} onToggle={(e) => t.react("comment", c.id, e)} />
          <button type="button" className="ob-xc-reply" aria-expanded={t.replying === key} onClick={() => t.startReply(key)} {...(t.readOnly ? READ_ONLY_PROPS : {})}>{REPLY_ICON}Répondre</button>
        </footer>
        {replies.length > 0 && <ReplyThread replies={replies} t={t} openSignal={openSignal} />}
        <AnimatePresence initial={false}>
          {t.replying === key && <InlineReply key="reply" t={t} placeholder={`Répondre à ${author.split(" ")[0]}…`} onSend={(body) => t.sendReply("comment", c, body)} />}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
function ThreadReply({ c, t }) {
  const author = authorOf(c);
  return (
    <div className={`ob-xr${c.fresh ? " is-fresh" : ""}`}>
      {/* Réagir à une réponse : le bouton vit dans l'en-tête (au survol) ; les pastilles n'apparaissent que s'il y en a. */}
      <MsgHead author={author} size={22} small time={msgTime(c.created_at)}
        menu={<span className="ob-xr-tools"><EmojiPalette onPick={(e) => t.react("comment", c.id, e)} />{t.canEdit(c) && t.editingId !== c.id && <ItemMenu label="Actions de la réponse" items={editItems(c, t)} />}</span>} />
      <div className="ob-xr-in">
        {t.editingId === c.id ? <MessageEdit t={t} />
          : c.body && <Clamp max={88} measureKey={c.body}><div className="ob-xc-text"><MentionedText text={c.body} mentions={c.mentions} /></div></Clamp>}
        <MessageFiles files={c.attachments} />
        {t.confirmDeleteId === c.id && <DeleteConfirm id={c.id} t={t} what="cette réponse" />}
        {t.reactionsOf("comment", c.id).length > 0 && <Reactions list={t.reactionsOf("comment", c.id)} onToggle={(e) => t.react("comment", c.id, e)} />}
      </div>
    </div>
  );
}
// Les réponses d'un message ou d'une météo : ouvertes s'il y en a deux au plus, sinon regroupées derrière leurs
// auteurs ; elles s'ouvrent d'elles-mêmes à l'arrivée d'une réponse (`openSignal` change) ou depuis une notification.
function ReplyThread({ replies, t, openSignal }) {
  const [open, setOpen] = useState(replies.length <= 2);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const names = replies.map(authorOf);
  return (
    <div className="ob-xt">
      <button type="button" className="ob-xt-sum" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <AvatarStack names={names} />
        <span><b>{replies.length} réponse{replies.length > 1 ? "s" : ""}</b> de {whoReplied(names)}</span>
        {CHEVRON}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ob-xt-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {replies.map((reply) => <ThreadReply key={reply.id} c={reply} t={t} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function RatingItem({ r, numero, replies, t, openSignal, onEdited, onDeleted, onConflict }) {
  const ed = useRatingEditor(r, numero, { onEdited, onDeleted, onConflict });
  const w = weatherPresentation(r.score, r.weather_context);
  const qualification = r.weather_context?.qualification;
  const key = `rating:${r.id}`;
  return (
    <motion.article id={`weather-${r.id}`} layout="position" className="ob-xc" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ layout: { type: "spring", stiffness: 380, damping: 36 } }}>
      <MsgHead author={authorOf(r)} time={msgTime(r.created_at)}
        extra={r.note_updated_at ? <span title={fmtDT(r.note_updated_at)}> · commentaire modifié{r.note_updated_by_name ? ` par ${r.note_updated_by_name}` : ""}</span> : null}
        menu={!ed.mode && !t.readOnly && <ItemMenu label="Actions de la notation" items={[
          r.can_edit_note && { label: "Modifier le commentaire", icon: menuIcon("edit"), onClick: () => ed.begin('edit') },
          r.can_delete && { label: "Supprimer la notation", icon: menuIcon("delete"), danger: true, onClick: () => ed.begin('delete') },
        ]} />} />
      <div className="ob-xc-in">
        <span className="ob-xc-chip" style={{ color: w?.color, background: w?.bg }}><MeteoIcon score={r.score} size={14} color={w?.color} />{weatherRatingLabel(r.score, r.weather_context)}</span>
        {qualification
          ? <Clamp max={124} measureKey={JSON.stringify(qualification)} labels={["Voir le détail", "Réduire"]}><div className="ob-xc-qual"><WeatherQualification context={r.weather_context} /></div></Clamp>
          : r.note && <Clamp max={88} measureKey={r.note}><div className="ob-xc-text">{r.note}</div></Clamp>}
        {ed.mode && <RatingEditorForm rating={r} ed={ed} />}
        <footer className="ob-xc-foot">
          <Reactions list={t.reactionsOf("rating", r.id)} onToggle={(e) => t.react("rating", r.id, e)} />
          <button type="button" className="ob-xc-reply" aria-expanded={t.replying === key} onClick={() => t.startReply(key)} {...(t.readOnly ? READ_ONLY_PROPS : {})}>{REPLY_ICON}Répondre</button>
        </footer>
        {replies.length > 0 && <ReplyThread replies={replies} t={t} openSignal={openSignal} />}
        <AnimatePresence initial={false}>
          {t.replying === key && <InlineReply key="reply" t={t} placeholder={`Répondre à ${authorOf(r).split(" ")[0]}…`} onSend={(body) => t.sendReply("rating", r, body)} />}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

const THREAD_STEP = 5;
const SEND_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.5 2.5 10.6 13.4" /><path d="m21.5 2.5-7 19-3.9-8.1-8.1-3.9Z" /></svg>;
const CLIP_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.6 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.9l8.5-8.5" /></svg>;
const EMOJI_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14.5s1.4 2 4 2 4-2 4-2" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" /></svg>;
// `readOnly` (rôles en lecture seule, main 850b0d3) : fil, notations et réactions affichés ; saisie, pièces, météo, réponses,
// réactions, modification et suppression visibles et désactivées, et aucune écriture ne part.
function CommentThread({ numero, onAddWeather, ratings = [], ratingsLoading = false, onRatingEdited, onRatingDeleted, onRatingConflict, onCount, readOnly = false }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});   // « comment:<id> » | « rating:<id> » -> [{ emoji, count, mine, names }]
  const [files, setFiles] = useState([]);           // pièces jointes choisies, envoyées avec le message
  const [dragFiles, setDragFiles] = useState(false);
  const fileInput = useRef(null);
  // Compte des messages du fil (les réponses vivent sous leur message ou leur météo et ne s'ajoutent pas).
  const isTopLevel = (c) => !c.parent_id && (!c.rating_id || !ratings.some((r) => r.id === c.rating_id));
  const topLevel = comments.filter(isTopLevel).length;
  useEffect(() => { onCount?.(topLevel); }, [topLevel, onCount]);
  const [kind, setKind] = useState("all");   // filtre du fil : all | comment | rating
  const composerId = `ob-composer-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(null);           // « comment:<id> » | « rating:<id> » : saisie ouverte sous ce message
  const [bump, setBump] = useState({ key: null, n: 0 });      // dernier fil qui a reçu une réponse : il remonte et s'ouvre
  const [limit, setLimit] = useState(THREAD_STEP);   // échanges affichés : 5, puis 5 de plus à chaque clic
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [posting, setPosting] = useState(false);
  // Édition en place (demande dev 2026-09-03 : Paul corrige un commentaire au
  // lieu d'en rempiler). Autorisé : l'AUTEUR sur le sien, admin/ceo sur tous —
  // même règle que le backend, qui reste le juge.
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Suppression (même règle que la modification) : confirmation sur la ligne même.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const deleteComment = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/optilex/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
      setConfirmDeleteId(null);
    } catch { setError("Le commentaire n’a pas pu être supprimé. Réessayez."); }
    finally { setDeletingId(null); }
  };
  // Mentions @ (espace commun Owner / Opti'Lex / finance, demande dev 2026-09-24) : annuaire des
  // personnes taguables, confirmation « prévenu(e) » après publication, ouverture directe sur le fil
  // depuis une notification ou un e-mail (?focus=comments).
  const [people, setPeople] = useState([]);
  const [notice, setNotice] = useState("");
  const [searchParams] = useSearchParams();
  const focusComments = searchParams.get("focus") === "comments";
  const focusRating = searchParams.get("rating");
  const rootRef = useRef(null);
  useEffect(() => {
    let alive = true;
    apiClient.get("/api/v1/optilex/comments/mentionables")
      .then((r) => { if (alive) setPeople(r.people || []); })
      .catch(() => { /* sans annuaire, le fil reste utilisable sans complétion */ });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!focusComments || loading) return undefined;
    setLimit(Infinity);
    const timer = setTimeout(() => (focusRating && document.getElementById(`weather-${focusRating}`) || rootRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(timer);
  }, [focusComments, focusRating, loading, ratings]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  // finance_team écrit dans l'espace commun depuis le 25/09 (demande dev) ; le backend reste le juge.
  const canEdit = (c) => (((me.email || "").toLowerCase() === (c.author_email || "").toLowerCase())
      || ["admin", "ceo"].includes(me.role));
  const ro = readOnly ? READ_ONLY_PROPS : {};
  const saveEdit = async () => {
    const body = editDraft.trim();
    if (!body || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient.patch(`/api/v1/optilex/comments/${editingId}`, { body, mentions: mentionedIds(body, people) });
      setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setEditingId(null); setEditDraft("");
      setNotice(notifiedSummary(updated.notified));
    } catch (e) { setError("Le commentaire n’a pas pu être modifié. Réessayez."); }
    finally { setSavingEdit(false); }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    apiClient.get(`/api/v1/optilex/comments?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) { setComments(r.comments || []); setReactions(r.reactions || {}); } })
      .catch(() => { if (alive) setError("Les commentaires n’ont pas pu être chargés."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [numero, refresh]);

  const submit = async () => {
    const body = draft.trim();
    if (readOnly || (!body && !files.length) || posting || loading) return;
    setPosting(true); setError("");
    try {
      // Les pièces partent d'abord (en attente côté serveur), puis le message les rattache.
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadMessageFile(numero, f.file));
      const created = await apiClient.post("/api/v1/optilex/comments", { numero_client: numero, body, mentions: mentionedIds(body, people),
        attachment_ids: uploaded.map((u) => u.id) });
      // Pièces du message : celles que renvoie le serveur, sinon celles qu'on vient de déposer (jamais une liste vide
      // qui effacerait les fichiers envoyés).
      setComments((prev) => [{ ...created, attachments: created.attachments?.length ? created.attachments : uploaded }, ...prev]);
      setDraft(""); setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return []; });
      setNotice(notifiedSummary(created.notified));
    } catch (e) { setError("Le message n’a pas pu être publié. Votre texte et vos fichiers sont conservés."); }
    finally { setPosting(false); }
  };
  const addFiles = (list) => {
    if (readOnly) return;
    const next = [...(list || [])];
    const big = next.find((f) => f.size > MESSAGE_FILE_MAX);
    setError(big ? `« ${big.name} » dépasse 20 Mo.` : "");
    setFiles((prev) => [...prev, ...next.filter((f) => f.size <= MESSAGE_FILE_MAX).map((f) => ({ key: `${f.name}-${f.size}-${f.lastModified}`, file: f,
      thumb: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }))]
      .filter((f, i, all) => all.findIndex((o) => o.key === f.key) === i).slice(0, 10));
  };
  // Coller une image (⌘V / Ctrl V, dev 29/10/2026) : une capture d'écran collée devient une pièce jointe, nommée avec
  // la date ; le texte collé en même temps (page web) reste collé normalement.
  const pasteFiles = (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((it) => it.kind === "file");
    if (!items.length) return;
    const stamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      .replace(/\//g, "-").replace(" ", " à ").replace(":", " h ");
    const pasted = items.map((it, i) => {
      const f = it.getAsFile();
      if (!f) return null;
      if (f.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(f.name)) return f;
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      return new File([f], `Capture du ${stamp}${i ? ` (${i + 1})` : ""}.${ext}`, { type: f.type, lastModified: Date.now() + i });
    }).filter(Boolean);
    if (!e.clipboardData.types.includes("text/plain")) e.preventDefault();
    addFiles(pasted);
  };
  const dropFile = (key) => setFiles((list) => list.filter((f) => { if (f.key === key && f.thumb) URL.revokeObjectURL(f.thumb); return f.key !== key; }));
  // Réaction : affichée tout de suite, puis remplacée par la réponse du serveur (ou annulée s'il refuse).
  const myName = me.full_name || me.email || "Moi";
  const react = async (kind, id, emoji) => {
    if (readOnly) return;
    const key = `${kind}:${id}`;
    const before = reactions[key] || [];
    setReactions((all) => ({ ...all, [key]: toggledReactions(all[key], emoji, myName) }));
    try {
      const r = await apiClient.post("/api/v1/optilex/comments/reactions", { target: kind, target_id: id, emoji });
      if (Array.isArray(r?.reactions)) setReactions((all) => ({ ...all, [key]: r.reactions }));
    } catch {
      setReactions((all) => ({ ...all, [key]: before }));
      setError("La réaction n’a pas pu être enregistrée.");
    }
  };

  // Un fil remonte quand il reçoit une réponse : ordre par dernière activité (le message ou sa réponse la plus récente).
  const repliesOf = (kind, id) => comments.filter((r) => (kind === "rating" ? r.rating_id === id : r.parent_id === id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const activity = (e) => Math.max(+new Date(e.created_at), ...repliesOf(e.kind, e.id).map((r) => +new Date(r.created_at)));
  const entries = [
    ...comments.filter(isTopLevel).map((c) => ({ ...c, kind: "comment", key: `comment-${c.id}` })),
    ...ratings.map((c) => ({ ...c, kind: "rating", key: `rating-${c.id}` })),
  ].map((e) => ({ ...e, at: activity(e) }))
    .sort((a, b) => b.at - a.at || (a.kind === b.kind ? b.id - a.id : a.kind.localeCompare(b.kind)));
  const visible = kind === "all" ? entries : entries.filter((e) => e.kind === kind);
  const shown = visible.slice(0, limit);
  const older = visible.slice(limit);
  // Répondre sous un message ou une météo ; l'auteur d'origine est prévenu (mention), le fil s'ouvre et remonte.
  const sendReply = async (kind, parent, body) => {
    if (readOnly) return false;
    setError("");
    try {
      const mail = (parent.author_email || "").toLowerCase();
      const author = people.find((p) => mail && (p.email || "").toLowerCase() === mail);
      const ids = [...new Set([...mentionedIds(body, people), ...(author && mail !== (me.email || "").toLowerCase() ? [author.id] : [])])];
      const link = kind === "rating" ? { rating_id: parent.id } : { parent_id: parent.id };
      const created = await apiClient.post("/api/v1/optilex/comments", { numero_client: numero, body, mentions: ids, ...link });
      setComments((prev) => [{ ...created, ...link, fresh: true }, ...prev]);
      setReplying(null);
      setBump((b) => ({ key: `${kind}:${parent.id}`, n: b.n + 1 }));
      setNotice(notifiedSummary(created.notified));
      return true;
    } catch {
      setError("La réponse n’a pas pu être publiée. Votre texte est conservé.");
      return false;
    }
  };
  // Le fil qui vient de remonter reste sous les yeux : on le suit une fois sa glissade terminée.
  useEffect(() => {
    if (!bump.n) return undefined;
    const [k, id] = bump.key.split(":");
    const timer = setTimeout(() => document.getElementById(k === "rating" ? `weather-${id}` : `msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 480);
    return () => clearTimeout(timer);
  }, [bump]);
  const openSignalOf = (e) => (bump.key === `${e.kind}:${e.id}` ? bump.n : 0) || (e.kind === "rating" && String(focusRating) === String(e.id) ? 1 : 0);
  const t = {
    readOnly, canEdit: (c) => !readOnly && canEdit(c), people, editingId, editDraft, setEditDraft, saveEdit, savingEdit, confirmDeleteId, deleteComment, deletingId, react,
    myName, replying, sendReply, startReply: (key) => { if (!readOnly) setReplying((k) => (k === key ? null : key)); }, cancelReply: () => setReplying(null),
    reactionsOf: (kind, id) => reactions[`${kind}:${id}`] || [],
    startEdit: (c) => { setEditingId(c.id); setEditDraft(c.body); setConfirmDeleteId(null); },
    cancelEdit: () => { setEditingId(null); setEditDraft(""); },
    askDelete: (id) => { setConfirmDeleteId(id); setEditingId(null); },
    cancelDelete: () => setConfirmDeleteId(null),
  };
  // Bouton « @ » : insère l'arobase au curseur ; la liste des personnes s'ouvre comme à la frappe.
  const insertAt = () => {
    const el = document.getElementById(composerId);
    const pos = el ? (el.selectionStart ?? draft.length) : draft.length;
    const before = draft.slice(0, pos);
    const sep = before && !/\s$/.test(before) ? " " : "";
    setDraft(`${before}${sep}@${draft.slice(pos)}`);
    requestAnimationFrame(() => { if (!el) return; el.focus(); const caret = pos + sep.length + 1; el.setSelectionRange(caret, caret); });
  };
  const insertEmoji = (emoji) => {
    const el = document.getElementById(composerId);
    const pos = el ? (el.selectionStart ?? draft.length) : draft.length;
    setDraft(`${draft.slice(0, pos)}${emoji}${draft.slice(pos)}`);
    requestAnimationFrame(() => { if (!el) return; el.focus(); const caret = pos + emoji.length; el.setSelectionRange(caret, caret); });
  };
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  const unit = kind === "rating" ? "notation" : kind === "comment" ? "message" : "échange";

  return (
    <div ref={rootRef} id="ob-comments" style={{ scrollMarginTop: 16 }}>
      {/* Zone de saisie : toujours visible ; ouverte à tous les rôles du board, finance_team comprise (retour dev 25/09). */}
      <div className={`ob-composer${dragFiles ? " is-drag" : ""}`}
        onDragEnter={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragFiles(true); } }}
        onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragFiles(false); }}
        onDrop={(e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); setDragFiles(false); addFiles(e.dataTransfer.files); }}>
        <MentionTextarea id={composerId} {...ro} value={draft} onChange={setDraft} people={people} rows={2} className="ob-composer-ta"
          aria-label="Message de l'espace commun"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }} onPaste={pasteFiles}
          placeholder="Écrire à Owner, Opti'Lex et la finance… (collez une image avec ⌘ V)" />
        <ComposerFiles files={files} disabled={posting} onRemove={dropFile} />
        <div className="ob-composer-bar">
          <button type="button" className="ob-composer-tool" onClick={insertAt} {...ro} aria-label="Mentionner quelqu'un"
            title="Mentionner quelqu'un : il reçoit un e-mail et une notification">@</button>
          <button type="button" className="ob-composer-tool" onClick={() => fileInput.current?.click()} disabled={posting} {...ro}
            aria-label="Joindre des fichiers" title="Joindre des fichiers (PDF, image, e-mail, audio · 20 Mo au plus) ou les glisser ici">{CLIP_ICON}</button>
          <EmojiPalette label="Insérer un emoji" className="ob-composer-tool" onPick={insertEmoji}>{EMOJI_ICON}</EmojiPalette>
          <input ref={fileInput} type="file" hidden multiple accept={MESSAGE_FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {onAddWeather && <MeteoPicker triggerLabel="Ajouter une météo" onSave={onAddWeather} disabled={!numero} readOnly={readOnly} />}
          <span className="ob-composer-hint" aria-hidden="true">{isMac ? "⌘" : "Ctrl"} Entrée</span>
          <button type="button" className="ob-composer-send" onClick={submit} disabled={(!draft.trim() && !files.length) || posting} {...ro}>{posting ? "Envoi…" : "Envoyer"}</button>
        </div>
      </div>
      <AnimatePresence>
        {notice && <motion.p key="notice" role="status" className="ob-thread-notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</motion.p>}
      </AnimatePresence>
      {error && <p role="alert" className="ob-thread-error">{error} <button type="button" onClick={() => setRefresh(v => v + 1)}>Réessayer</button></p>}

      {(loading || ratingsLoading) ? <p className="ob-thread-empty">Chargement des échanges…</p>
        : !entries.length ? (!error && <p className="ob-thread-empty">Aucun échange pour le moment.</p>)
        : (
          <div className="ob-thread-bar">
            <span className="ob-thread-count">{visible.length} {unit}{visible.length > 1 ? "s" : ""}</span>
            <div className="ob-seg-mini" role="group" aria-label="Filtrer les échanges">
              {[["all", "Tout"], ["comment", "Messages"], ["rating", "Météo"]].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? "is-on" : ""} onClick={() => { setKind(k); setLimit(THREAD_STEP); }}>
                  {kind === k && <motion.span layoutId="obThreadKind" className="ob-seg-mini-pill" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      <div className="ob-thread">
        <AnimatePresence initial={false}>
          {shown.map((e) => e.kind === "rating"
            ? <RatingItem key={e.key} r={e} numero={numero} replies={repliesOf("rating", e.id)} t={t} openSignal={openSignalOf(e)}
                onEdited={onRatingEdited} onDeleted={onRatingDeleted} onConflict={onRatingConflict} />
            : <CommentItem key={e.key} c={e} replies={repliesOf("comment", e.id)} t={t} openSignal={openSignalOf(e)} />)}
        </AnimatePresence>
      </div>

      {/* Les plus anciens par paquets de 5, avec leurs auteurs ; « Réduire » une fois tout affiché. */}
      {older.length > 0 ? (
        <button type="button" className="ob-thread-more" onClick={() => setLimit((l) => l + THREAD_STEP)}>
          <AvatarStack names={older.slice(0, THREAD_STEP).map(authorOf)} size={20} max={3} />
          Voir {Math.min(THREAD_STEP, older.length)} {unit}{Math.min(THREAD_STEP, older.length) > 1 ? "s" : ""} plus ancien{Math.min(THREAD_STEP, older.length) > 1 ? "s" : ""}
          <span className="ob-thread-more-n">sur {older.length}</span>
        </button>
      ) : visible.length > THREAD_STEP && (
        <button type="button" className="ob-thread-more" onClick={() => { setLimit(THREAD_STEP); rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Réduire</button>
      )}
    </div>
  );
}
