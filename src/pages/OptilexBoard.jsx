import { confirmBoardFinanceExit } from '../components/BoardFinanceExitDialog.jsx';
import { requiresExitDecision } from '../utils/boardFinanceExit.js';
import ClientHistoryAttachments from '../components/ClientHistoryAttachments.jsx';
import WeatherCaseComposer, { WeatherQualification, WeatherScaleGuide } from '../components/WeatherCaseComposer';
import { WEATHER, weatherPresentation, weatherFilter, weatherRatingLabel } from '../utils/weatherCase';
import AppointmentConfirmation from "../components/booking/AppointmentConfirmation";
import BoardIntegrationSheet from "../components/BoardIntegrationSheet";
import BoardContactsEditor from "../components/BoardContactsEditor";
import { AlertCabinetBlock, MailIcon } from "../components/CabinetAlertBlock";
import OnboardingFlowModal from "../components/OnboardingFlowModal";
import BoardOnboardingDateCorrection from "../components/BoardOnboardingDateCorrection";
import BoardStateDateInput from "../components/BoardStateDateInput";
import { appointmentConfirmation, appointmentFailure } from "../utils/appointmentConfirmation";
import { ClientMissions, DetailFold, DetailText } from "../components/OptilexClientDetail";
import MentionTextarea, { MentionedText } from "../components/MentionTextarea";
import { mentionedIds, notifiedSummary } from "../utils/mentions.js";
import { isOnboardingToReschedule, onboardingDateOf, onboardingSituation } from "../utils/boardIntegration.js";
import { isOnboardingUpcoming, isOnboardingOverdue, isIntegrationUpcoming, isIntegrationOverdue } from "../utils/boardPredicates.js";
import { createLatestRequestTracker, displayEtat, EXITED_ETATS, matchesSignedClient, withConfirmedEtat } from "../utils/boardClientState.js";
import { Fragment, memo, useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { phoneDisplay, sharedEmailOptions } from "../utils/boardContacts.js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import apiClient from "../services/apiClient";
// Météo client : primitives partagées avec la météo d'onboarding (fiche d'intégration, parcours).
import { METEO_BANDS, meteoBandOf, meteoStyle, METEO_MEANING, MeteoIcon } from "../components/meteo.jsx";

// ── Charte sobre (navy + neutre, style Attio/Linear) ─────────────────────────
const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const BG = "#f6f7f9";
const CARD = "#ffffff";
const GREEN = "#15794a";

export const ETAT_STYLE = {
  "Signé":            { bg: "#e9f9f0", fg: "#15794a", dot: "#22c55e" },
  "Résiliation":      { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Rétractation":     { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "Self-Résiliation": { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Pause":            { bg: "#eef1f6", fg: "#5b6472", dot: "#94a3b8" },
  "Liquidation":      { bg: "#f6e9e9", fg: "#7a271a", dot: "#991b1b" },
  "En cours de liquidation": { bg: "#fef3e2", fg: "#92400e", dot: "#d97706" },
  "Renouvellement client":   { bg: "#eef2ff", fg: "#3730a3", dot: "#6366f1" },
  "Attente Opti'Lex": { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "En cours":         { bg: "#eaf1fd", fg: "#1e40af", dot: "#2563eb" },
  "En cours de résiliation":  { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "En cours de rétractation": { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "En attente":       { bg: "#eef1f6", fg: "#5b6472", dot: "#94a3b8" },
  "Sans suite":       { bg: "#eef1f6", fg: "#5b6472", dot: "#cbd2e0" },
  "Inactifs":         { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
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
const ONBOARDING_TAGS = { venir: "À venir", done: "Réalisé", todo: "À faire", noshow: "No show", recaler: "À recaler" };
const PROGRAMME_TAGS = { ambassadeur: "Ambassadeur", parrainage: "Parrainage" };
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
const CRITERIA_CATS = ["Onboarding à venir", "Renouvellement client", "Inactifs"];
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
const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777", "#4f46e5", "#0d9488"];

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
  const { first, last } = splitName(person);
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
// lignes : le reste se dessine par paquets une fois la glissade posée (hors de la vue), sans saccade.
const ROWS_FIRST = 30;
const ROWS_CHUNK = 120;
const ROWS_SETTLE_MS = 520;
const VIEW_SLIDE = {
  enter: (dir) => ({ x: 72 * dir, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { x: { type: "spring", stiffness: 360, damping: 36, mass: 0.9 }, opacity: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } } },
  exit: (dir) => ({ x: -72 * dir, opacity: 0, transition: { duration: 0.17, ease: [0.4, 0, 1, 1] } }),
};
const VIEW_FADE = { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } };

const ROW_TD = { padding: "12px 14px", fontSize: 13, color: TEXT, borderTop: "1px solid #eef0f4", verticalAlign: "middle", whiteSpace: "nowrap" };

// ── Secteur d'activité (dev 28/10/2026) ─────────────────────────────────────
// Type d'entreprise du NDA (client_data.business_type), déduit du code NAF trouvé sur Pappers.
// Seule l'orthographe de la valeur enregistrée « Micro créche » est corrigée à l'affichage.
const secteurLabel = (v) => (v === "Micro créche" ? "Micro-crèche" : v);
// Une icône dessinée par secteur de la liste du NDA, en deux tons : trait marine, volumes en bleu
// Owner pâle ; seuls la croix de l'ambulance et celle de la pharmacie gardent leur couleur.
// Secteur inconnu : l'immeuble de « Générales ».
const SECTEUR_INK = "#27324f";
const SECTEUR_FILL = "#e6ecf6";
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
  const ink = on ? "#fff" : s ? s.fg : "#3f4a5f";
  const tint = on ? "rgba(255,255,255,0.22)" : s ? `${s.dot}38` : "#3f4a5f26";
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
      <path d="M5 1 L9 5.5 L1 5.5 Z" fill={dir === "asc" ? NAVY : "#cdd4df"} />
      <path d="M5 13 L1 8.5 L9 8.5 Z" fill={dir === "desc" ? NAVY : "#cdd4df"} />
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

function Avatar({ name, n, src, size = 30 }) {
  const c = AVATAR_COLORS[(n != null ? n : hashStr(name)) % AVATAR_COLORS.length];
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  // Lettre de couleur sur fond pâle (dev 28/10/2026, « meilleur tableau ») : la couleur repère sans crier.
  return <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}24`, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.43), fontWeight: 700, flexShrink: 0 }}>{letter}</div>;
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
  const color = !s ? "#b6bdc9" : FILLED_GLYPHS.has(kind) ? s.fg : s.dot;
  return <StatusGlyph kind={kind} color={color} size={size} />;
}

// `withIcon` : pastille à icône SVG du board (Signé, en cours, sorti…) ; sans, l'ancien point de couleur,
// que la page Finance réutilise telle quelle. `pop` change à chaque nouvel état : l'icône rebondit une fois.
export function EtatBadge({ etat, withIcon = false, pop = 0 }) {
  const s = ETAT_STYLE[etat] || { bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" };
  if (withIcon) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 7px", borderRadius: 8, background: s.bg, color: s.fg, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
        <span key={pop} className={`ob-etat-ic${pop ? " is-pop" : ""}`}><EtatIcon etat={etat} /></span>
        {etat || "—"}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
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
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 5, minWidth: 210, maxHeight: ETAT_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            {items.map(({ opt, label }) => {
              const sel = opt === etat;
              return (
                <button key={label} type="button" onClick={() => { setOpen(false); if (!sel) pick(opt); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none",
                    background: sel ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, color: opt ? TEXT : MUTED, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f7f8fa"; }}
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
function MeteoBadge({ score, context, showLabel = true }) {
  const s = weatherPresentation(score, context);
  if (!s) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#b6bdc9", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span className="ob-meteo-tile" style={{ width: 26, height: 26, borderRadius: 8, border: "1.5px dashed #cbd2e0", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#cbd2e0", flexShrink: 0, boxSizing: "border-box" }}>?</span>
      {showLabel && "À noter"}
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, textAlign: "left" }}>
      <span className="ob-meteo-tile" style={{ width: 26, height: 26, borderRadius: 8, background: s.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MeteoIcon score={score} size={16} color={s.color} />
      </span>
      {showLabel && (
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: MUTED, marginTop: 2, whiteSpace: "nowrap" }}
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
function MeteoPicker({ score, context, onSave, disabled, triggerLabel }) {
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
  return <span onClick={e=>e.stopPropagation()}><button ref={button} type="button" disabled={disabled} onClick={openFromTrigger} aria-label={triggerLabel || "Mettre à jour la météo"} className={triggerLabel ? "wc-add-weather" : "ob-meteo"} style={triggerLabel ? undefined : {border:0,background:'transparent',padding:0,textAlign:'left',font:'inherit',cursor:disabled?'default':'pointer'}}>{triggerLabel ? <><MeteoIcon score={5} size={18}/>{triggerLabel}</> : <MeteoBadge score={score} context={context}/>}</button>
    {createPortal(<AnimatePresence>{open && <motion.div key="meteo-overlay" role="presentation" initial={{opacity:0}} animate={{opacity:1,transition:{duration:0.22,ease:'easeOut'}}} exit={{opacity:0,transition:{duration:0.2,ease:'easeIn'}}}
      style={{position:'fixed',inset:0,zIndex:10050,background:'rgba(18,27,53,0.34)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)',display:'grid',placeItems:'center',padding:16}} onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Mettre à jour la météo client" className="ob-meteo-dialog"
        initial={enter} animate={{opacity:1,x:0,y:0,scale:1,transition:reduce?{duration:0.15}:{type:'spring',stiffness:420,damping:34,mass:0.9,opacity:{duration:0.16}}}} exit={leave}
        style={{width:'min(680px,100%)',maxHeight:'90vh',overflowY:'auto',background:'white',borderRadius:18,padding:24,boxShadow:'0 24px 70px rgba(18,27,53,0.22), 0 2px 6px rgba(18,27,53,0.06)',fontFamily:METEO_DIALOG_FONT}}>
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
        {active && <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{selected.length}</span>}
        <svg className="ob-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div ref={menuRef} style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 5, minWidth: 236, maxHeight: FILTER_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Filtrer par état</span>
              {active && <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tout effacer</button>}
            </div>
            {cats.map((cat) => {
              const on = selected.includes(cat);
              const n = counts[cat] || 0;
              return (
                <button key={cat} type="button" onClick={() => onToggle(cat)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", background: on ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: TEXT, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f7f8fa"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? NAVY : "#cbd2e0"}`, background: on ? NAVY : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s, border-color 0.14s" }}>
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <EtatIcon etat={cat} size={13} />
                  <span style={{ flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{n}</span>
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
        {active && <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{selected.length}</span>}
        <svg className="ob-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 5, minWidth: 236, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</span>
              {active && <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tout effacer</button>}
            </div>
            {items.map((it) => {
              const on = selected.includes(it.key);
              return (
                <button key={it.key} type="button" onClick={() => onToggle(it.key)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", background: on ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: TEXT, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f7f8fa"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? NAVY : "#cbd2e0"}`, background: on ? NAVY : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s, border-color 0.14s" }}>
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  {it.icon}
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{it.count}</span>
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
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 12, width: 250, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{isOnb ? "Onboarding entre" : "Signé le"}</span>
              {active && <button type="button" onClick={() => onChange({ from: "", to: "" })} style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Effacer</button>}
            </div>
            {/* Cible du filtre : période de SIGNATURE (défaut) ou d'ONBOARDING. */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10, padding: 3, background: "#f3f4f6", borderRadius: 8 }}>
              {[["signature", "Signature"], ["onboarding", "Onboarding"]].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => onTarget?.(val)}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 11.5, fontWeight: 700, transition: "background 0.15s, color 0.15s",
                    background: target === val ? CARD : "transparent", color: target === val ? NAVY : MUTED,
                    boxShadow: target === val ? "0 1px 2px rgba(17,24,39,0.10)" : "none" }}>
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
              <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>ou période</span>
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
function SecTitle({ icon, children, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, ...style }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{SEC_ICONS[icon]}</svg>
      {children}
    </div>
  );
}

// Statut de signature riche : signé / envoyé (en attente) / planifié / expiré…
function sigInfo(status, sentAt, signedAt, scheduledAt) {
  if (status === "done") return { label: "Signé", sub: fmt(signedAt), color: GREEN, kind: "done" };
  // Pas de contrat lié mais une date de signature (fiche client interne, remplie à la
  // déclaration de vente) : le client est signé, on l'affiche au lieu d'un "—" trompeur.
  if (!status && signedAt) return { label: "Signé", sub: fmt(signedAt), color: GREEN, kind: "done" };
  if (status === "ongoing") return { label: "Envoyé", sub: fmt(sentAt) + " · en attente", color: "#b45309", kind: "half" };
  if (status === "scheduled") return { label: "Planifié", sub: fmt(scheduledAt), color: "#5b6472", kind: "dashed" };
  if (status === "expired") return { label: "Expiré", sub: "", color: "#b42318", kind: "cross" };
  if (status === "canceled") return { label: "Annulé", sub: "", color: "#b42318", kind: "cross" };
  if (status === "failed") return { label: "Échec", sub: "", color: "#b42318", kind: "cross" };
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
          <div style={{ fontSize: 12.5, fontWeight: 600, color: GREEN }}>Inclus</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>au contrat Owner</div>
        </div>
      </div>
    );
  }
  if (!i) return <span style={{ color: "#cbd2e0" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.25 }}>
      <span style={{ marginTop: 1 }}><StatusGlyph kind={i.kind} color={i.color} /></span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: i.color }}>{i.label}</div>
        {i.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{i.sub}</div>}
      </div>
    </div>
  );
}

// Ligne du tableau, mémorisée (dev 28/10/2026) : elle ne se redessine que si SES données changent (client,
// sélection, no show, entrée animée). Avant, tout rendu de la page redessinait les 700 à 900 lignes
// (400 à 550 ms à chaque onglet, chaque sélection) ; les rappels reçus sont stables (useCallback, setState).
const BoardRow = memo(function BoardRow({ r, rk, isSel, newIdx, noShow, renewal, onSelect, patch, changeEtat, recordMeteo }) {
  const td = ROW_TD;
  return (
    <tr onClick={() => onSelect(rk)} className={`ob-row${isSel ? " is-sel" : ""}`}
      style={newIdx !== undefined ? { animation: "obRowIn 0.28s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${Math.min(newIdx, 14) * 20}ms` } : undefined}>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={primaryName(r)} n={r.sheet_num} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={primaryName(r)}>{primaryName(r)}</div>
              {isInactif(r) && (
                <span title="Aucune mission suivie par le cabinet depuis 60 jours"
                  style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fff3e3", padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                  Inactif{r.days_since_last_mission != null ? ` · ${r.days_since_last_mission} j` : ""}
                </span>
              )}
              {renewal && (() => {
                const days = anniversaryDaysLeft(r);
                if (days == null) return null;
                const tone = days <= 30 ? { fg: "#b42318", bg: "#fdecec", dot: "#ef4444" }
                  : days <= 90 ? { fg: "#b45309", bg: "#fff3e3", dot: "#f59e0b" }
                  : { fg: "#3730a3", bg: "#eef2ff", dot: "#6366f1" };
                return (
                  <span title={`Anniversaire du contrat dans ${days} jour${days > 1 ? "s" : ""}`}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: tone.fg, background: tone.bg, padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
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
      <td style={{ ...td, color: r.secteur_activite ? TEXT : "#cbd2e0" }}>
        {r.secteur_activite ? (
          <div className="ob-sector" title={`Secteur d'activité (NDA) : ${secteurLabel(r.secteur_activite)}`}>
            <SectorIcon secteur={r.secteur_activite} size={20} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secteurLabel(r.secteur_activite)}</span>
          </div>
        ) : <span title="Secteur non renseigné au NDA">—</span>}
      </td>
      <td style={{ ...td, whiteSpace: "normal" }}>
        <MeteoPicker score={r.meteo_score} context={r.meteo_context} disabled={!r.numero_client}
          onSave={payload => recordMeteo(r.numero_client, payload)} />
      </td>
      {/* État daté (Résiliation, Pause…) posé depuis la table -> on ouvre la fiche
          pour saisir la date dans la foulée. + rappel sous le badge si la pause est
          échue ou si la date d'effet manque. */}
      <td style={td}>
        <EtatPicker etat={displayEtat(r)} disabled={!r.numero_client}
          onPick={(v) => { const saving = changeEtat(r.numero_client, { etat: v }); if (ETAT_DATE_CONFIG[v]) onSelect(rk); return saving; }} />
        {isEtatPending(r) && r.etat_date && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#b45309", marginTop: 5, lineHeight: 1.3 }}
            title={`${r.etat_manuel} prévue le ${fmt(r.etat_date)} — pas encore effective, le client reste actif jusqu'à cette date`}>
            <StatusGlyph kind="clock" color="#b45309" size={11} />{r.etat_manuel} · prévu {fmt(r.etat_date)}
          </div>
        )}
        {(() => {
          const h = etatHint(r);
          return h ? (
            <div style={{ fontSize: 10.5, fontWeight: 600, color: h.urgent ? "#b45309" : "#a3a9b6", marginTop: 3 }}>{h.text}</div>
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
          disabled={!r.numero_client || isFinanceTeam()}
          onSave={(d) => patch(r.numero_client, { rdv_onboarding_date_manual: d })} />
        {r.rdv_onboarding_done && r.rdv_onboarding_done_date && (
          <div title="Onboarding réalisé saisi à la main (ancien client)" style={{ marginTop: 3, fontSize: 10.5, fontWeight: 600, color: GREEN }}>
            Réalisé le {fmtDT(r.rdv_onboarding_done_date)}
          </div>
        )}
        {(() => {
          // Pastilles sous la date, pas sur sa ligne (elles débordaient sur la colonne voisine).
          const recaler = r.onboarding_reschedule_pending && !r.rdv_onboarding_done;
          return (noShow || recaler) ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
              {noShow && <OnboardingNoShowBadge date={r.rdv_onboarding_date_manual || r.rdv_onboarding_date} />}
              {recaler && (
                <div title={r.onboarding_reschedule_note || "Onboarding à recaler, sans date"} style={{ display: "inline-block", padding: "2px 7px", borderRadius: 999, background: "#fff4e0", color: "#b45309", fontSize: 10.5, fontWeight: 700 }}>À recaler</div>
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
  const [onboardingSel, setOnboardingSel] = useState([]);  // 'venir' | 'done' | 'todo' | 'noshow' | 'recaler'
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
      exited: TERMINATED_ETATS.includes(displayEtat(r)), includeExited: etatsSel.length > 0,
    });
    const passes = (r, withOnboarding = true) => {
      // « Tous » regroupe les clients actuels et anciens, pas les prospects.
      // Le statut du contrat ne suffit pas : un client peut avoir un contrat expiré.
      if (activeCats.length === 0 && r.is_pending_contract) return false;
      if (etatsSel.length > 0 && !etatsSel.some((cat) => matchesCat(r, cat))) return false;
      if (critsSel.length > 0 && !critsSel.every((cat) => matchesCat(r, cat))) return false;
      // Menu « Programmes » : UNION des programmes cochés (ambassadeur / parrainage).
      if (programmeSel.length > 0) {
        const inProgramme = (programmeSel.includes("ambassadeur") && r.ambassador_eligible)
          || (programmeSel.includes("parrainage") && r.parrainage_eligible);
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
    const c = { venir: 0, done: 0, todo: 0, noshow: 0, recaler: 0, total: 0 };
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
    // finance_team : lecture seule sauf cocher l'onboarding owner.
    if (isFinanceTeam()) {
      if (!("rdv_onboarding_done" in changes)) return;
      changes = { rdv_onboarding_done: changes.rdv_onboarding_done };
    }
    mutSeq.current += 1;
    let snapshot = null;   // ligne d'avant la MAJ optimiste, pour rollback si le PATCH échoue
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, ...changes };
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
  const [view, setView] = useState({ key: viewKey, dir: 1, limit: Infinity });
  if (view.key !== viewKey) setView({ key: viewKey, dir: slideNav.current.dir, limit: ROWS_FIRST });
  useEffect(() => { slideNav.current.dir = 1; }, [viewKey]);
  // Rendu progressif : les premières lignes glissent, le reste suit par paquets après la glissade.
  useEffect(() => {
    if (view.limit >= filtered.length) return undefined;
    const t = setTimeout(() => setView((v) => ({ ...v, limit: v.limit + ROWS_CHUNK })), view.limit === ROWS_FIRST ? ROWS_SETTLE_MS : 0);
    return () => clearTimeout(t);
  }, [view.limit, filtered.length]);
  const shownRows = view.limit >= filtered.length ? filtered : filtered.slice(0, view.limit);

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
    ...multiFilter.filter((c) => !PRIMARY_TABS.includes(c)).map((c) => ({ key: `etat-${c}`, group: "État", label: c, clear: () => toggleCat(c) })),
    ...meteoFilter.map((b) => ({ key: `meteo-${b}`, group: "Météo", label: b === "none" ? "Non noté" : WEATHER[b].label, clear: () => setMeteoFilter((p) => p.filter((x) => x !== b)) })),
    ...(sigRange.from || sigRange.to ? [{ key: "date", group: dateTarget === "onboarding" ? "Onboarding" : "Signature", label: sigRangeLabel(sigRange.from, sigRange.to), clear: () => setSigRange({ from: "", to: "" }) }] : []),
    ...onboardingSel.map((k) => ({ key: `onb-${k}`, group: "Onboarding", label: ONBOARDING_TAGS[k] || k, clear: () => setOnboardingSel((p) => p.filter((x) => x !== k)) })),
    ...programmeSel.map((k) => ({ key: `prog-${k}`, group: "Programme", label: PROGRAMME_TAGS[k] || k, clear: () => setProgrammeSel((p) => p.filter((x) => x !== k)) })),
    ...(q ? [{ key: "q", group: "Recherche", label: `« ${q} »`, clear: () => setQ("") }] : []),
  ];
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
  const th = { textAlign: "left", padding: "0 14px", height: 40, boxSizing: "border-box", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#fbfcfd", boxShadow: `inset 0 -1px 0 ${BORDER}`, zIndex: 1 };
  const td = ROW_TD;

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : BG, padding: embed ? "10px 24px 28px" : "24px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: TEXT }}>
      <style>{`
        @keyframes mailWiggle{0%,100%{transform:translateX(0)}25%{transform:translateX(-2.5px)}75%{transform:translateX(2.5px)}}
        @keyframes obMenuIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:none}}
        @keyframes obRowIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes obFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes obShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
        .ob-sk{background:linear-gradient(90deg,#eef1f6 25%,#f7f8fa 50%,#eef1f6 75%);background-size:200% 100%;animation:obShimmer 1.4s ease-in-out infinite;display:inline-block;flex-shrink:0}
        .ob-chev{display:inline-flex;color:#c3cad6;transition:transform .18s ease,color .18s ease}
        tr:hover .ob-chev{transform:translateX(3px);color:#1e2330}
        .ob-sec{animation:obFadeUp .32s cubic-bezier(0.16,1,0.3,1) both}
        /* Barre de filtres : une carte, une ligne par famille, un libellé par ligne. */
        .ob-filters{container-type:inline-size;background:${CARD};border:1px solid ${BORDER};border-radius:14px;padding:0 14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(17,24,39,0.03)}
        .ob-frow{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:10px 0}
        .ob-frows{border-top:1px solid ${BORDER}}
        .ob-frows>.ob-frow+.ob-frow{border-top:1px solid ${BORDER}}
        .ob-flabel{flex:0 0 56px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}}
        .ob-fgroup{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
        @container (min-width: 1400px){
          .ob-frows{display:flex;align-items:center;gap:24px}
          .ob-frows>.ob-frow+.ob-frow{border-top:0;margin-left:auto}
          .ob-frow--refine .ob-flabel{flex:none}
        }
        .ob-n{font-size:11px;font-weight:700;color:${MUTED};font-variant-numeric:tabular-nums;transition:color .18s}
        /* États : contrôle segmenté, la pastille marine glisse d'un onglet à l'autre. */
        .ob-seg{display:inline-flex;align-items:center;flex-wrap:wrap;gap:2px;padding:3px;background:#f2f4f7;border-radius:11px}
        .ob-seg-btn{position:relative;border:0;background:transparent;border-radius:8px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:600;color:${TEXT};cursor:pointer;white-space:nowrap;transition:background .16s,color .18s}
        .ob-seg-btn:not(.is-on):hover{background:rgba(255,255,255,0.85)}
        .ob-seg-btn.is-on{color:#fff}
        .ob-seg-btn.is-on .ob-n{color:rgba(255,255,255,0.7)}
        .ob-seg-pill{position:absolute;inset:0;background:${NAVY};border-radius:8px;z-index:0;box-shadow:0 1px 3px rgba(17,24,39,0.18)}
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
        .ob-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;border:1px solid ${BORDER};background:${CARD};color:${TEXT};font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .18s,border-color .18s,color .18s}
        .ob-chip:not(.is-on):hover{background:#f7f8fa;border-color:#d5dae3}
        .ob-chip-ic{display:inline-flex;transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
        .ob-chip:hover .ob-chip-ic{transform:translateY(-1px) scale(1.14)}
        /* Menus : rectangle arrondi, la flèche pivote à l'ouverture. */
        .ob-trigger{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:10px;border:1px solid ${BORDER};background:${CARD};color:${TEXT};font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .16s,border-color .16s,color .16s}
        .ob-trigger:not(.is-on):not(:disabled):hover{background:#f7f8fa;border-color:#d5dae3}
        .ob-trigger.is-open{border-color:${NAVY}}
        .ob-trigger.is-on{background:${NAVY};border-color:${NAVY};color:#fff}
        .ob-trigger:disabled{opacity:.55;cursor:default;color:${MUTED}}
        .ob-trigger>svg:first-child{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
        .ob-trigger:not(:disabled):hover>svg:first-child{transform:translateY(-1px) scale(1.1)}
        .ob-caret{flex-shrink:0;transition:transform .22s cubic-bezier(.22,1,.36,1)}
        .ob-trigger.is-open .ob-caret{transform:rotate(180deg)}
        /* Filtres posés : une étiquette par filtre. */
        .ob-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:12px;min-height:38px}
        .ob-active{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;flex:1;min-width:0;padding:0 4px}
        .ob-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 10px;border-radius:999px;background:#eef1f6;color:${TEXT};font-size:12px;font-weight:600;white-space:nowrap}
        .ob-tag small{font-size:11px;font-weight:600;color:${MUTED}}
        .ob-tag button{display:grid;place-items:center;width:18px;height:18px;border:0;border-radius:50%;background:transparent;color:${MUTED};cursor:pointer;transition:background .14s,color .14s}
        .ob-tag button:hover{background:#dfe4ec;color:${TEXT}}
        .ob-clear{border:0;background:transparent;padding:0 4px;color:#2563eb;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
        /* Tableau : une carte ; l'ascenseur vit dedans (pas de piste, pouce fin et arrondi), commence sous
           l'en-tête collant (40 px) et s'arrête avant les coins arrondis. */
        .ob-table-wrap{background:${CARD};border:1px solid ${BORDER};border-radius:14px;overflow:auto;max-height:calc(100vh - 190px);box-shadow:0 1px 2px rgba(17,24,39,0.03)}
        .ob-table-wrap.is-sliding{overflow-x:hidden}
        .ob-table-wrap::-webkit-scrollbar{width:12px;height:12px}
        .ob-table-wrap::-webkit-scrollbar-track{background:transparent}
        .ob-table-wrap::-webkit-scrollbar-track:vertical{margin:40px 0 10px}
        .ob-table-wrap::-webkit-scrollbar-track:horizontal{margin:0 12px}
        .ob-table-wrap::-webkit-scrollbar-thumb{background-color:#dde1e8;border:4px solid transparent;border-radius:999px;background-clip:padding-box}
        .ob-table-wrap:hover::-webkit-scrollbar-thumb{background-color:#c4cad5}
        .ob-table-wrap::-webkit-scrollbar-thumb:hover{background-color:#a9b1bf}
        .ob-table-wrap::-webkit-scrollbar-corner{background:transparent}
        @supports not selector(::-webkit-scrollbar){.ob-table-wrap{scrollbar-width:thin;scrollbar-color:#cfd5df transparent}}
        .ob-row{cursor:pointer;transition:background .14s}
        .ob-row:hover{background:#f8f9fb}
        .ob-row.is-sel{background:#eff3fb}
        .ob-row.is-sel>td:first-child{box-shadow:inset 3px 0 0 ${NAVY}}
        .ob-edit{color:${MUTED};opacity:0;transition:opacity .16s}
        .ob-row:hover .ob-edit{opacity:.7}
        /* No show : une petite carte ; le fantôme flotte au-dessus de son ombre, cligne des yeux, fait « bouh » au survol. */
        .ob-noshow{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 5px;border-radius:8px;background:#fdeeee;box-shadow:inset 0 0 0 1px #f7d4d1;color:#b42318;font-size:11px;font-weight:700;white-space:nowrap;transition:background .18s,box-shadow .18s}
        .ob-noshow:hover{background:#fbe2e0;box-shadow:inset 0 0 0 1px #f1bdb8}
        @keyframes obGhostFloat{0%,100%{transform:translateY(.4px) rotate(-4deg)}50%{transform:translateY(-2.4px) rotate(4deg)}}
        @keyframes obGhostShadow{0%,100%{transform:scaleX(1);opacity:.22}50%{transform:scaleX(.6);opacity:.09}}
        @keyframes obGhostBlink{0%,91%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
        @keyframes obGhostBoo{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-3.5px) scale(1.28) rotate(-7deg)}55%{transform:translateY(-1px) scale(.94) rotate(5deg)}78%{transform:translateY(-1.6px) scale(1.04) rotate(-2deg)}100%{transform:translateY(0) scale(1)}}
        .ob-ghost-body{transform-box:fill-box;transform-origin:50% 85%;animation:obGhostFloat 3s ease-in-out var(--ob-ghost-delay,0s) infinite}
        .ob-ghost-shadow{transform-box:fill-box;transform-origin:center;animation:obGhostShadow 3s ease-in-out var(--ob-ghost-delay,0s) infinite}
        .ob-ghost-eye{transform-box:fill-box;transform-origin:center;animation:obGhostBlink 4.8s ease-in-out var(--ob-ghost-delay,0s) infinite}
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
        .ob-meteo-dialog .wc-choices>button:hover{transform:translateY(-2px);border-color:var(--wc-color)}
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
            role="alert" style={{ maxWidth: "min(620px, calc(100vw - 32px))", lineHeight: 1.5, position: "fixed", top: 16, left: "50%", zIndex: 10060, background: "#b42318", color: "#fff", padding: "9px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, boxShadow: "0 8px 24px rgba(180,35,24,0.32)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{saveError}</span>
            <button type="button" aria-label="Fermer le message" onClick={() => setSaveError("")} style={{ background: "none", border: 0, color: "inherit", fontSize: 20, cursor: "pointer" }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 18 }}>Board Cabinet partenaire</div>
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
        {/* Météo et Affiner : une ligne chacun, côte à côte quand la barre est assez large. */}
        <div className="ob-frows">
          <div className="ob-frow">
            {/* Météo client : puces directes (demande dev 2026-09-03), multi-sélection = union. */}
            <span className="ob-flabel">Météo</span>
            <div className="ob-fgroup" role="group" aria-label="Météo client">
              {["5", "4", "3", "2", "1", "none"].map((b, i) => {
                const st = b === "none"
                  ? { label: "Non noté", bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" }
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
                  { key: "todo", label: "Onboarding à faire", count: onboardingCounts.todo,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 14v4M12 14h.01" /></svg> },
                  { key: "noshow", label: "Onboarding no show", count: onboardingCounts.noshow,
                    icon: <span style={{ display: "inline-flex", color: MUTED }}><GhostIcon size={14} /></span> },
                  { key: "recaler", label: "Onboarding à recaler", count: onboardingCounts.recaler,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg> },
                ]}
                selected={onboardingSel}
                onToggle={(k) => setOnboardingSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                onClear={() => setOnboardingSel([])} />
              <ChecklistMenu label="Programmes" title="Programmes clients"
                icon={(c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>}
                items={[
                  { key: "ambassadeur", label: "Programme ambassadeur", count: rows.filter((r) => r.ambassador_eligible).length,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg> },
                  { key: "parrainage", label: "Programme de parrainage", count: rows.filter((r) => r.parrainage_eligible).length,
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></svg> },
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
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 11, pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…"
              onFocus={(e) => { e.target.style.borderColor = NAVY; }}
              onBlur={(e) => { e.target.style.borderColor = BORDER; }}
              style={{ ...inputStyle, width: 260, padding: "9px 12px 9px 33px", transition: "border-color 0.18s" }} />
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
                    <th style={th}>Client</th>
                    <th style={th}>Secteur</th>
                    <th style={th}>Météo</th>
                    <th style={th}>État</th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => clickSort("owner_signed")} title="Trier par date de signature">
                      <span style={{ display: "inline-flex", alignItems: "center" }}>Contrat Owner<SortArrow dir={effectiveSort.col === "owner_signed" ? effectiveSort.dir : null} /></span>
                    </th>
                    <th style={th}>Contrat Opti'Lex</th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => clickSort("onboarding")} title="Trier par date d'onboarding">
                      <span style={{ display: "inline-flex", alignItems: "center" }}>Onboarding<SortArrow dir={effectiveSort.col === "onboarding" ? effectiveSort.dir : null} /></span>
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
                        onSelect={setSelected} patch={patch} changeEtat={changeEtat} recordMeteo={recordMeteo} />
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr style={{ animation: "obRowIn 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
                      <td colSpan={8} style={{ ...td, textAlign: "center", padding: "52px 0" }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#cbd2e0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: MUTED }}>Aucun client</div>
                        <div style={{ fontSize: 12, color: "#b6bdc9", marginTop: 3 }}>Modifiez vos filtres ou votre recherche.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 10, background: "#fff3e3", color: "#b45309", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
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
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 10, background: "#fdecec", color: "#c0392b", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
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
// bouche en « o ». Il flotte au-dessus de son ombre (qui rétrécit quand il monte), son ourlet ondule (morphose
// du tracé entre deux phases de vague), il cligne des yeux, et fait « bouh » au survol. `phase` décale le cycle
// d'un fantôme à l'autre pour qu'ils ne bougent pas tous ensemble.
const GHOST_HEM_A = "M5 18V10a7 7 0 0 1 14 0v8c-.78 1.9-3.89 1.9-4.67 0c-.78-1.4-3.89-1.4-4.67 0c-.78 1.9-3.89 1.9-4.66 0Z";
const GHOST_HEM_B = "M5 18V10a7 7 0 0 1 14 0v8c-.78-1.4-3.89-1.4-4.67 0c-.78 1.9-3.89 1.9-4.67 0c-.78-1.4-3.89-1.4-4.66 0Z";
function GhostIcon({ size = 18, phase = 0 }) {
  const reduce = useReducedMotion();
  const gid = `ob-ghost-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, overflow: "visible", "--ob-ghost-delay": `-${phase}s` }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <ellipse className="ob-ghost-shadow" cx="12" cy="22.8" rx="5" ry="1.1" fill="currentColor" opacity="0.2" />
      <g className="ob-ghost-body">
        <path d={GHOST_HEM_A} fill={`url(#${gid})`} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          {!reduce && <animate attributeName="d" dur="1.5s" repeatCount="indefinite" values={`${GHOST_HEM_A};${GHOST_HEM_B};${GHOST_HEM_A}`} calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />}
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

function InfoField({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: value ? TEXT : "#cbd2e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value || ""}>{value || "—"}</div>
    </div>
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
const roleOf = () => { try { return (apiClient.getUser() || {}).role; } catch { return undefined; } };

// Onglet Détails allégé pour le Client Success : l'état de l'onboarding en une carte et un seul
// bouton « Faire l'onboarding » ; les rendez-vous de lancement, la convention et la météo
// vivent dans le parcours. Les autres rôles gardent les lignes détaillées. Les RDV fiscal et
// social se reprogramment aussi d'ici (client absent, Vincent 29/09).
function OnboardingCard({ row, onStart, onManualDone, onReschedule, onCancel, onDateSaved, hostInfo, onTransfer }) {
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
  const tone = done ? GREEN : pending ? "#b45309" : NAVY;
  const status = done ? `Onboarding réalisé${doneDate ? ` · ${fmtDT(doneDate)}` : ""}`
    : pending ? `À recaler${row.onboarding_reschedule_note ? ` · ${row.onboarding_reschedule_note}` : " · sans date pour le moment"}`
    : date ? `Prévu le ${fmtDT(date)}` : "Aucune date d'onboarding";
  const rdv = [
    ["Intégration Opti'Lex", row.rdv_lancement_date, row.rdv_lancement_done],
    ["Lancement fiscal", row.rdv_fiscal_date_manual || row.rdv_fiscal_date, row.rdv_fiscal_done, "fiscal"],
    ["Lancement social", row.rdv_social_date_manual || row.rdv_social_date, row.rdv_social_done, "social"],
  ];
  return (
    <div style={{ marginBottom: 22, padding: "14px 16px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#fafbfc" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED }}>Onboarding Owner</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: tone, overflowWrap: "anywhere" }}>{status}</div>
          {row.onboarding_meet_link && !done && (
            <a href={row.onboarding_meet_link} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontWeight: 700, color: GREEN, textDecoration: "none" }}>Rejoindre le Meet</a>
          )}
          {/* Lien public de réservation / déplacement par le client (dev 28/10/2026), copiable comme les liens de lancement. */}
          {row.onboarding_url && !done && <RdvLink url={row.onboarding_url} />}
          {/* Animateur du RDV, recalage direct, et transfert à l'équipe pour le responsable (dev 29/10/2026). */}
          {date && !done && hostInfo?.host && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: MUTED }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <HostFace name={hostInfo.host.name} photo={hostInfo.host.photo} size={20} />
                avec <strong style={{ color: TEXT }}>{hostInfo.host.name}</strong>
              </span>
              {onReschedule && (
                <button type="button" className="ob-detail-link" onClick={() => onReschedule("onboarding")} style={{ padding: 0, margin: 0 }}>Reprogrammer</button>
              )}
              {onTransfer && (hostInfo.transfer_to || []).map((t) => (
                <button key={t.name} type="button" onClick={() => onTransfer(t)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 4px", borderRadius: 999, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>
                  <HostFace name={t.name} photo={t.photo} size={18} />
                  Confier à {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onStart}
          style={{ padding: "10px 16px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 10, border: "none", background: done ? CARD : NAVY, color: done ? NAVY : "#fff", boxShadow: done ? `inset 0 0 0 1px ${NAVY}` : "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {/* Fusée discrète : un léger décollage avec des pauses, comme une invitation. Le pictogramme du
              lancement client ; immobile si l'utilisateur préfère moins d'animations ou une fois réalisé. */}
          <motion.svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}
            animate={reduce || done ? undefined : { y: [0, -1.5, 0.5, 0], rotate: [0, -6, 0, 0] }}
            transition={{ duration: 1.4, times: [0, 0.4, 0.75, 1], ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatDelay: 2.2 }}>
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </motion.svg>
          {done ? "Rouvrir le parcours" : pending ? "Reprendre l'onboarding" : "Faire l'onboarding"}
        </motion.button>
      </div>
      {done && <div style={{ marginTop: 12 }}>
        <BoardOnboardingDateCorrection key={row.numero_client} numero={row.numero_client} completed
          initialDate={toDateInput(doneDate)} onSaved={onDateSaved} />
      </div>}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: MUTED }}>
        {rdv.map(([label, d, ok, kind]) => (
          <span key={label}>{label} : <strong style={{ color: d ? TEXT : "#cbd2e0" }}>{fmtDT(d) || "à placer"}</strong>{ok ? " ✓" : ""}
            {kind && d && !ok && onReschedule && (
              <button type="button" className="ob-detail-link" onClick={() => onReschedule(kind)} style={{ padding: 0, margin: "0 0 0 6px" }}>Reprogrammer</button>
            )}
            {kind && onCancel && launchCancellable(d, ok) && (
              <button type="button" className="ob-detail-link" onClick={() => onCancel(kind)} style={{ padding: 0, margin: "0 0 0 6px", color: CANCEL_RED }}>Annuler</button>
            )}
          </span>
        ))}
      </div>
      {/* Onboarding réalisé sans le parcours (anciens clients 28/09/2026, tout client 29/09/2026) :
          date proposée = date prévue si elle est passée, sinon aujourd'hui. Pur suivi : ni agenda,
          ni facturation (champ rdv_onboarding_done_date, distinct de la date du RDV). */}
      {!done && onManualDone && (!manualOpen ? (
        <button type="button" onClick={() => { setManualDate(plannedDay && plannedDay <= todayParis ? plannedDay : todayParis); setManualOpen(true); }}
          style={{ marginTop: 10, padding: 0, border: "none", background: "transparent", color: MUTED, fontSize: 12, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
          Marquer l'onboarding réalisé sans le parcours
        </button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (manualDate) { onManualDone(manualDate); setManualOpen(false); } }}
          style={{ marginTop: 10, padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 650, color: TEXT }}>
            Date de l'onboarding réalisé
            <input type="date" required autoFocus value={manualDate} max={todayParis}
              onChange={(e) => setManualDate(e.target.value)}
              style={{ display: "block", marginTop: 6, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontFamily: "inherit", fontSize: 13, color: TEXT, background: CARD }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={!manualDate}
              style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: NAVY, color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: manualDate ? "pointer" : "default", opacity: manualDate ? 1 : 0.6 }}>
              Marquer réalisé
            </button>
            <button type="button" onClick={() => setManualOpen(false)}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: TEXT, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
function EmailSelect({ row, patch, onSaved }) {
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
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>Email</div>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: canOpen ? "pointer" : "default", fontFamily: "inherit", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current || "—"}</span>
        {canOpen && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s" }}><polyline points="6 9 12 15 18 9" /></svg>}
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 240), zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 6, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px 4px" }}>Email des envois Opti'Lex</div>
            {opts.map((o) => {
              const on = o.email.toLowerCase() === current.toLowerCase();
              return (
                <button key={o.email} type="button" disabled={saving} onClick={() => choose(o.email)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", padding: "8px", borderRadius: 8, border: "none", background: on ? "#eff3fb" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: on ? 700 : 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.email}</span>
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
                  style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, padding: "7px 12px", border: "none", borderRadius: 8, background: NAVY, color: "#fff", cursor: (saving || !newEmail.trim()) ? "default" : "pointer", opacity: (saving || !newEmail.trim()) ? 0.5 : 1 }}>Ajouter</button>
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
function ClientInfoSection({ row, num, patch, onEmailSaved, changeEtat, onContactsChanged }) {
  const [editing, setEditing] = useState(false);
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
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SecTitle icon="infos" style={{ marginBottom: 0 }}>Informations client</SecTitle>
        {num && !editing && !isFinanceTeam() && (
          <button type="button" onClick={startEdit} title="Modifier les informations"
            style={{ border: "none", background: "transparent", padding: 3, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}>
            <PencilIcon size={14} />
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
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            <button type="button" onClick={save}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: NAVY, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px", marginBottom: 22 }}>
          <InfoField label="Nom du client" value={name} />
          <InfoField label="Tranche salariale" value={fmtTranche(ov(row, "tranche_ovr", "contact_tranche"))} />
          <EmailSelect row={row} patch={patch} onSaved={onEmailSaved} />
          <InfoField label="Téléphone" value={phoneDisplay(ov(row, "phone_ovr", "contact_phone"), row.shared_contacts?.phones)} />
          <InfoField label="SIREN" value={ov(row, "siren_ovr", "siren")} />
          <EtatSection row={row} num={num} changeEtat={changeEtat} compact />
          {companyName(row) && companyName(row) !== name && <InfoField label="Société" value={companyName(row)} full />}
        </div>
      )}
    </>
  );
}

// Toggle segmenté animé (remplace le dropdown Oui/Non). Pastille qui glisse en
// spring (navy -> vert quand positif) + check qui pop. labels[1] = état positif.
function StatusToggle({ value, onChange, labels = ["Non", "Oui"] }) {
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#eef1f6", borderRadius: 9, minWidth: 150, userSelect: "none", flexShrink: 0 }}>
      <motion.div
        animate={{ x: value ? "100%" : "0%", backgroundColor: value ? GREEN : NAVY }}
        transition={{ type: "spring", stiffness: 480, damping: 34 }}
        style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", borderRadius: 9, zIndex: 0, boxShadow: "0 1px 3px rgba(30,35,48,0.18)" }}
      />
      {labels.map((lab, i) => {
        const active = (i === 1) === !!value;
        return (
          <button key={i} type="button" onClick={() => onChange(i === 1)}
            style={{ position: "relative", zIndex: 1, border: "none", background: "transparent", cursor: "pointer",
              padding: "7px 6px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
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
  if (disabled) return <span style={{ color: value ? TEXT : "#cbd2e0" }}>{fmtDT(value) || "—"}</span>;
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
        display: "inline-flex", alignItems: "center", gap: 6, color: value ? TEXT : "#cbd2e0" }}>
      {fmtDT(value) || "—"}
      <span className="ob-edit" style={{ display: "inline-flex", lineHeight: 0 }}><PencilIcon /></span>
    </button>
  );
}

// Ligne RDV : date (planifiée ou saisie manuellement) + toggle "effectué" + lien (optionnel).
// onDate présent -> crayon pour saisir/modifier la date à la main (antériorité).
function RdvRow({ label, date, done, editable, onToggle, link, onDate, meetLink, onReschedule, onCancel }) {
  const [editing, setEditing] = useState(false);
  const cancelRef = useRef(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
        {editing ? (
          <input type="date" autoFocus defaultValue={toDateInput(date)}
            onBlur={(e) => { if (cancelRef.current) { cancelRef.current = false; setEditing(false); return; } onDate(e.target.value || null); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancelRef.current = true; setEditing(false); } }}
            style={{ ...inputStyle, width: 156, padding: "6px 9px", fontSize: 13, marginTop: 2 }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: date ? TEXT : "#cbd2e0" }}>{fmtDT(date) || "—"}</div>
            {onDate && (
              <button type="button" onClick={() => setEditing(true)} title="Saisir/modifier la date"
                style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}>
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {link && <RdvLink url={link} />}
        {onReschedule && <button type="button" className="ob-detail-link" onClick={onReschedule}>Reprogrammer ce rendez-vous</button>}
        {onCancel && <button type="button" className="ob-detail-link" onClick={onCancel} style={{ color: CANCEL_RED }}>Annuler ce rendez-vous</button>}
        {meetLink && (
          <a href={meetLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, padding: "4px 10px", borderRadius: 8, background: GREEN + "14", border: `1px solid ${GREEN}44`, color: GREEN, fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" /></svg>
            Rejoindre le Meet
          </a>
        )}
      </div>
      {editable && <StatusToggle value={!!done} onChange={onToggle} labels={["À venir", "Effectué"]} />}
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
        style={{ fontSize: 11.5, fontWeight: 600, color: NAVY, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Lien de prise de RDV
      </a>
      <button type="button" onClick={copy}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: copied ? GREEN : MUTED, padding: 0, fontFamily: "inherit" }}>
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
  if (!data?.available || !link) return <div style={{ fontSize: 13, color: "#cbd2e0" }}>Lien de signature indisponible.</div>;

  const done = relance === "sent";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input readOnly value={link} onFocus={(e) => e.target.select()}
          style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 11.5, color: MUTED, background: "#fafbfc" }} />
        <button onClick={copy}
          style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", background: copied ? GREEN : NAVY, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
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
              padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: done ? GREEN : confirming ? "#b42318" : "transparent",
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
          {" "}La relance est faite par le cabinet : utilisez « Prévenir Lisa » ci-dessous.
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
            padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            background: done ? GREEN : confirming ? "#b42318" : "transparent",
            color: done || confirming ? "#fff" : NAVY, cursor: sending || done ? "default" : "pointer", transition: "all 0.2s" }}>
          {!done && !sending && <MailIcon />}
          {done ? "Contrat envoye ✓" : sending ? "Envoi…" : state === "error" ? "Echec, reessayer" : confirming ? "Confirmer l'envoi immediat" : "Forcer l'envoi du contrat Opti'Lex"}
        </button>
      </div>
    </>
  );
}

// Renouvellement d'un contrat Opti'Lex EXPIRE : recree une demande de signature Yousign.
function RenewBlock({ email, sentAt, onRenewed }) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState(null); // null | 'sending' | 'sent' | 'error'

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
  return (
    <>
      <SecTitle icon="signature">Contrat Opti'Lex expiré</SecTitle>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
          La demande de signature Opti'Lex a expiré{sentAt && <> (envoyée le <strong style={{ color: TEXT }}>{fmt(sentAt)}</strong>)</>}.
          {" "}Renouvelle-la pour renvoyer le contrat à signer au client.
        </div>
        <button onClick={confirming ? doRenew : () => setConfirming(true)}
          onMouseLeave={() => { if (!sending) setConfirming(false); }}
          disabled={sending || done}
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 0", borderRadius: 9, border: confirming ? "none" : `1px solid ${NAVY}`, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            background: done ? GREEN : confirming ? "#b42318" : "transparent",
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
function DateRow({ label, value, onChange }) {
  const committed = toDateInput(value);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
      <BoardStateDateInput key={committed} value={committed} label={label} onChange={onChange}
        style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }} />
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
function EtatSection({ row, num, changeEtat, compact = false }) {
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
  const applyDate = (chg) => changeEtat(num, {
    etat, etat_date: row.etat_date, pause_end_date: row.pause_end_date,
    pause_relance_date: row.pause_relance_date, ...chg,
  });
  return (
    <div style={{ marginBottom: compact ? 0 : 22, minWidth: 0, ...(compact && (cfg || isEtatPending(row)) ? { gridColumn: "1 / -1" } : {}) }}>
      {compact ? <div style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>Situation du client</div> : <SecTitle icon="etat">État du client</SecTitle>}
      <EtatPicker etat={etat} disabled={!num} onPick={(v) => changeEtat(num, { etat: v })} />
      {num && row.finance_review_status === 'pending' && <div style={{marginTop:9,padding:'8px 10px',borderRadius:8,background:'#fff8e9',color:'#866013',fontSize:12,lineHeight:1.5}}>
        Situation enregistrée dans le board. La finance doit en traiter les conséquences sur les montants ; elle ne valide pas le changement de situation.
      </div>}
      {num && isEtatPending(row) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, padding: "6px 10px", borderRadius: 8, background: "#fff3e3", color: "#b45309", fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12, fontWeight: 600, color: "#b45309" }}>
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
                  <DateRow label="Début de pause" value={row.etat_date} onChange={(d) => applyDate({ etat_date: d })} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>Fin de pause</div>
                    {/* Flip PUREMENT LOCAL : un clic exploratoire ne détruit jamais une date en
                        base ni dans l'audit. La persistance passe par la saisie de la date
                        elle-même (les DateRow nullent la contrepartie au commit). */}
                    <StatusToggle value={pauseMode === "connue"} labels={["Indéterminée", "Connue"]}
                      onChange={(v) => setPauseMode(v ? "connue" : "indeterminee")} />
                  </div>
                  {pauseMode === "connue"
                    ? <DateRow label="Fin de pause" value={row.pause_end_date} onChange={(d) => applyDate({ pause_end_date: d, pause_relance_date: null })} />
                    : <DateRow label="Relancer le" value={row.pause_relance_date} onChange={(d) => applyDate({ pause_relance_date: d, pause_end_date: null })} />}
                </>
              ) : (
                <DateRow label={cfg.label} value={row.etat_date} onChange={(d) => applyDate({ etat_date: d })} />
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
              <div style={{ position: "absolute", left: -20, top: 3, width: 10, height: 10, borderRadius: "50%", background: st.dot || "#cbd2e0", border: `2px solid ${CARD}`, boxSizing: "content-box" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: st.fg || TEXT }}>{h.etat}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{etatHistDates(h)}</div>
              <div style={{ fontSize: 10.5, color: "#aab2c0", marginTop: 1 }}>
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

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.42)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(560px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(17,24,39,0.28)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Agenda du client</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ov(row, "contact_name_ovr", "contact_name") || row.crm_societe || row.numero_client}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: MUTED, fontSize: 17, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>
          <div style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${ref ? GREEN + "55" : BORDER}`, background: ref ? "#f0f7f3" : "#fafbfc", display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: ref ? GREEN : "#e5e8ee", color: "#fff", fontSize: 12, fontWeight: 800 }}>
              {ref ? (ref.name || "?").trim().charAt(0).toUpperCase() : "?"}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Juriste de référence</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: ref ? NAVY : MUTED }}>
                {ref ? `${ref.name}${ref.team ? " · " + ref.team : ""}` : "Aucun RDV juriste pour l'instant"}
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ fontSize: 13, color: MUTED, padding: "8px 0" }}>Chargement de l'agenda…</div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, padding: "8px 0" }}>Aucun rendez-vous enregistré.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {days.map((d) => (
                <div key={d.key}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, textTransform: "capitalize", marginBottom: 7, paddingLeft: 2 }}>{d.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {d.items.map((it) => (
                      <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, opacity: it.cancelled ? 0.5 : 1 }}>
                        <span style={{ width: 46, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: it.cancelled ? MUTED : NAVY, textAlign: "center" }}>{timeOf(it)}</span>
                        <span style={{ width: 1, alignSelf: "stretch", background: BORDER, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, textDecoration: it.cancelled ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                          <div style={{ fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.kind === "jurist" ? (it.juriste || "Juriste") + (it.cancelled ? " · annulé" : "") : it.type}
                          </div>
                        </div>
                        {it.kind === "standard" && (
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: it.done ? GREEN : MUTED, background: it.done ? "#e7f3ec" : "#eef1f6" }}>{it.done ? "Effectué" : "À venir"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export function DetailPanel({ row, onClose, reload, reloadRatings, patch, changeEtat, etatHistVersion, recordMeteo, meteoHistVersion }) {
  const num = row.numero_client;
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
  const [transferTo, setTransferTo] = useState(null);      // « Confier à … » : animateur cible (dev 29/10/2026)
  const onboardingHost = useOnboardingHost(num, ONBOARDING_FLOW_ROLES.includes(roleOf()) && !row.rdv_onboarding_done
    && !!(row.rdv_onboarding_date_manual || row.rdv_onboarding_date), apptVersion);
  // Antériorité emails : à l'ouverture d'une fiche, on enregistre les emails vus (Owner + Opti'Lex
  // courant par SIREN) dans l'historique -> on garde la trace même quand l'email change ensuite,
  // pour pouvoir revenir à un email antérieur dans le dropdown. Best-effort (silencieux).
  useEffect(() => {
    if (!num) return;
    const emails = [];
    if (row.email) emails.push({ email: row.email, source: "owner" });
    if (row.email_optilex) emails.push({ email: row.email_optilex, source: "optilex" });
    if (emails.length) apiClient.post("/api/v1/optilex/email-history", { numero_client: num, emails }).catch(() => {});
  }, [num, row.email, row.email_optilex]);
  // Carte compacte d'un contrat, dans les informations client (dev 25/09) :
  // signé ou pas (pastille, même style que la situation du client), envoyé
  // quand, signé quand.
  const sigLine = (title, status, sentAt, signedAt, scheduledAt, grouped) => {
    const i = sigInfo(status, sentAt, signedAt, scheduledAt);
    const tone = i ? i.color : grouped ? GREEN : "#9aa3b2";
    const label = i ? i.label : grouped ? "Signé" : "Pas de contrat";
    const rows = [
      sentAt && ["Envoyé", fmt(sentAt)],
      scheduledAt && status === "scheduled" && ["Planifié", fmt(scheduledAt)],
      signedAt && ["Signé", fmt(signedAt)],
    ].filter(Boolean);
    return (
      <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc", minWidth: 0 }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{title}</div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: `${tone}17`, color: tone, fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone }} />{label}
        </span>
        {(rows.length > 0 || (!i && grouped)) && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 10, rowGap: 3, marginTop: 8, fontSize: 11.5 }}>
            {rows.map(([k, v]) => (
              <Fragment key={k}>
                <span style={{ color: MUTED }}>{k}</span>
                <span style={{ color: TEXT, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </Fragment>
            ))}
            {!i && grouped && <span style={{ gridColumn: "1 / -1", color: MUTED }}>Inclus au contrat Owner</span>}
          </div>
        )}
      </div>
    );
  };
  // Étape du parcours email Opti'Lex : enveloppe grise (non envoyé) -> verte (envoyé)
  // + date. On trace l'ENVOI (dispatch Resend marque *_email_sent_at), pas l'ouverture.
  const emailStep = (label, trigger, sentAt) => {
    const sent = !!sentAt;
    return (
      <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc", display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: sent ? "#e9f9f0" : "#eef1f6", color: sent ? GREEN : "#c0c7d4", transition: "background 0.25s, color 0.25s" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sent ? NAVY : MUTED }}>{label}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{trigger}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 5, color: sent ? GREEN : "#c0c7d4", display: "flex", alignItems: "center", gap: 5 }}>
            {sent ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Envoyé le {fmt(sentAt)}
              </>
            ) : "Non envoyé"}
          </div>
        </div>
      </div>
    );
  };
  // Le parcours email n'a de sens que pour un client dans le flux Opti'Lex (contrat
  // séparé) : un contrat groupé (inclus à l'Owner) n'a pas d'emails cabinet dédiés.
  const [emailsOpen, setEmailsOpen] = useState(false);
  const hasOptilexTrack = row.optilex_status != null || !!row.rdv_lancement_date || !!row.optilex_welcome_email_at || !!row.optilex_livret_email_at || !!row.optilex_docs_email_at || !!row.optilex_contract_forms_email_at;
  const appointments = <>
          {/* RDV + statut "effectué" */}
          <div className="ob-sec" style={{ animationDelay: "0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <SecTitle icon="rdv" style={{ marginBottom: 0 }}>Rendez-vous</SecTitle>
            {num && (
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setAgendaOpen(true)}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f8fa"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = CARD; }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Voir l'agenda
              </motion.button>
            )}
          </div>
          {ONBOARDING_FLOW_ROLES.includes(roleOf()) && !!num ? (
            // Onglet Détails allégé (dev 24/09/2026) : un seul bouton, le reste vit dans le parcours.
            <OnboardingCard row={row} onStart={() => setOnboardingOpen(true)} onDateSaved={reload}
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
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f8fa"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = CARD; }}
                  style={{ alignSelf: "flex-start", marginTop: -2, display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                  Recaler le RDV onboarding
                </motion.button>
              )}
              <RdvRow label="Rendez-vous Intégration Opti'Lex" date={row.rdv_lancement_date} done={row.rdv_lancement_done} editable={!!num && !isFinanceTeam()} meetLink={row.lancement_meet_link}
                onToggle={(v) => patch(num, { rdv_lancement_done: v })} />
              <RdvRow label="Rendez-vous lancement fiscal" date={row.rdv_fiscal_date_manual || row.rdv_fiscal_date} done={row.rdv_fiscal_done} editable={!!num && !isFinanceTeam() && !!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date)}
                link={row.fiscal_url || null}
                onReschedule={num && !isFinanceTeam() && (row.rdv_fiscal_date_manual || row.rdv_fiscal_date) ? () => setReschedOpen("fiscal") : undefined}
                onCancel={num && !isFinanceTeam() && launchCancellable(row.rdv_fiscal_date_manual || row.rdv_fiscal_date, row.rdv_fiscal_done) ? () => setCancelOpen("fiscal") : undefined}
                onToggle={(v) => patch(num, { rdv_fiscal_done: v })} />
              <RdvRow label="Rendez-vous lancement social" date={row.rdv_social_date_manual || row.rdv_social_date} done={row.rdv_social_done} editable={!!num && !isFinanceTeam() && !!(row.rdv_social_date_manual || row.rdv_social_date)}
                link={row.social_url || null}
                onReschedule={num && !isFinanceTeam() && (row.rdv_social_date_manual || row.rdv_social_date) ? () => setReschedOpen("social") : undefined}
                onCancel={num && !isFinanceTeam() && launchCancellable(row.rdv_social_date_manual || row.rdv_social_date, row.rdv_social_done) ? () => setCancelOpen("social") : undefined}
                onToggle={(v) => patch(num, { rdv_social_done: v })} />
            </div>
          )}
          </div>

  </>;
  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 9998 }} />
      <motion.div
        initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 56, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="ob-detail-panel" role="dialog" aria-modal="true" aria-hidden={agendaOpen || !!reschedOpen || !!cancelOpen || undefined} aria-label="Détails du client" style={{ position: "fixed", top: 0, right: 0, height: "100dvh", width: 520, maxWidth: "100vw", background: CARD, zIndex: 9999, boxShadow: "-12px 0 40px rgba(0,0,0,0.12)", overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, background: CARD, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Avatar name={primaryName(row)} n={row.sheet_num} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{primaryName(row)}</div>
                <div style={{ marginTop: 5, marginBottom: 5 }}><EtatBadge etat={displayEtat(row)} withIcon /></div>
                <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[companyName(row) !== primaryName(row) ? companyName(row) : null, row.numero_client, row.periodicite].filter(Boolean).join(" · ") || row.email || "—"}</div>
              </div>
            </div>
            <button onClick={onClose} title="Fermer"
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e6ee"; e.currentTarget.style.color = NAVY; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#eef1f6"; e.currentTarget.style.color = MUTED; }}
              style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#eef1f6", color: MUTED, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.16s, color 0.16s" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 22px 40px" }}>
          {/* Ordre de l'onglet Détails (dev 25/09) : 1. informations client (avec le
              contrat, la fiche d'intégration et les missions quand il y en a), 2. rendez-vous
              et « Faire l'onboarding », 3. météo et espace commun, 4. historique,
              5. ambassadeur et parrainage, 6. facturation et suivi. */}
          <div className="ob-sec" style={{ animationDelay: "0.05s" }}>
            <ClientInfoSection row={row} num={num} patch={patch} onEmailSaved={() => { setSigRefresh((v) => v + 1); setAlertPrefill("email_changed"); }} changeEtat={changeEtat} onContactsChanged={reload} />
          {integrationAlert(row) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid #f5deba", background: "#fff8ec", marginBottom: 12, fontSize: 12.5, fontWeight: 600, color: "#b45309" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              RDV d'intégration à venir, mais le contrat Opti'Lex n'est pas encore signé.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {sigLine("Contrat Owner", row.owner_status, row.owner_sent_at, row.owner_signed_at)}
            {sigLine("Contrat Opti'Lex", row.optilex_status, row.optilex_sent_at, row.optilex_signed_at, row.optilex_scheduled_at, row.owner_status === "done" && row.optilex_status == null)}
          </div>

          {["admin", "optilex"].includes((apiClient.getUser() || {}).role) && row.owner_status === "done" && (row.optilex_status === "scheduled" || row.optilex_status === "awaiting_owner_signature") && (
            <ForceSendBlock email={row.email} scheduledAt={row.optilex_scheduled_at} onForced={reload} />
          )}

          {["admin", "ceo", "optilex"].includes((apiClient.getUser() || {}).role) && row.optilex_status === "expired" && (
            <RenewBlock email={row.email} sentAt={row.optilex_sent_at} onRenewed={reload} />
          )}

          {/* Lien de signature Opti'Lex + relance (uniquement si le contrat est envoyé) */}
          {row.optilex_status === "ongoing" && (
            <>
              <SecTitle icon="signature">Signature Opti'Lex</SecTitle>
              <div style={{ marginBottom: 22 }}><OptilexSignatureBlock email={row.email} chosenEmail={ov(row, "email_ovr", "email")} refreshKey={sigRefresh} /></div>
            </>
          )}

          {/* Le Client Success prévient le cabinet (adresse corrigée, non signé…) : jamais de relance directe. */}
          {!!num && ALERT_CABINET_ROLES.includes(roleOf()) && ["scheduled", "ongoing", "expired"].includes(row.optilex_status) && (
            <>
              <SecTitle icon="signature">Prévenir le cabinet</SecTitle>
              <div style={{ marginBottom: 22 }}><AlertCabinetBlock numero={num} status={row.optilex_status} prefill={alertPrefill} /></div>
            </>
          )}

          {/* Parcours des 4 emails Opti'Lex automatisés. Section repliable, pliée par
              défaut (clic sur le titre). Enveloppe grise = pas parti, verte = envoyé + date. */}
          {hasOptilexTrack && (
            <>
              <div onClick={() => setEmailsOpen((o) => !o)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEmailsOpen((o) => !o); } }}
                style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: emailsOpen ? 10 : 22 }}>
                <SecTitle icon="emails" style={{ marginBottom: 0 }}>Emails Opti'Lex</SecTitle>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, transform: emailsOpen ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }}><path d="m6 9 6 6 6-6" /></svg>
              </div>
              {emailsOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                  {emailStep("1er email · Accueil", "À l'envoi du contrat Opti'Lex", row.optilex_welcome_email_at)}
                  {emailStep("2ème email · Livret", "À la signature du contrat", row.optilex_livret_email_at)}
                  {emailStep("3ème email · Documents à envoyer", "Au RDV d'intégration effectué", row.optilex_docs_email_at)}
                  {emailStep("4ème email · Formulaires contrats", "Au RDV d'intégration effectué", row.optilex_contract_forms_email_at)}
                </div>
              )}
            </>
          )}

            <BoardIntegrationSheet key={`sheet-${num || row.id}`} numero={num} onRated={reloadRatings} compact />
            <ClientMissions key={num || row.id} numero={num} hideWhenEmpty />
          </div>

          {appointments}

          {/* Météo client (note courante + saisie) et espace commun (commentaires + notations) */}
          {row.numero_client && (
            <div className="ob-sec" style={{ animationDelay: "0.075s" }}>
              <SecTitle icon="meteo">Météo client</SecTitle>
              <MeteoSection key={num} row={row} num={num} recordMeteo={recordMeteo} version={meteoHistVersion} onChanged={reloadRatings} />
            </div>
          )}
          {num && <ClientHistoryAttachments numero={num}/>}
          <DetailFold title="Historique de la situation"><EtatHistory num={num} version={etatHistVersion} /></DetailFold>
          <DetailFold title="Ambassadeur et parrainage">
          {/* Programme ambassadeur : client à valoriser / à solliciter pour un témoignage (case à cocher). */}
          {row.numero_client && (
            <div className="ob-sec" style={{ animationDelay: "0.085s" }}>
              <SecTitle icon="ambassador">Programme ambassadeur</SecTitle>
              {(() => {
                const on = !!row.ambassador_eligible;
                const editable = meteoSettable() && !isFinanceTeam();
                return (
                  <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc", marginBottom: 22 }}>
                    <motion.button type="button" disabled={!editable} whileTap={editable ? { scale: 0.99 } : undefined}
                      onClick={() => { if (editable) patch(num, { ambassador_eligible: !on }); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 0, border: "none", background: "none", cursor: editable ? "pointer" : "default", textAlign: "left", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${on ? GREEN : "#cbd2e0"}`, background: on ? GREEN : "transparent", transition: "background .15s ease, border-color .15s ease" }}>
                        {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Éligible au programme ambassadeur</span>
                        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>Client à valoriser, à solliciter pour un témoignage / une recommandation.</span>
                      </span>
                    </motion.button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Programme de parrainage : parrains générant des opportunités qualifiées (case à cocher). */}
          {row.numero_client && (
            <div className="ob-sec" style={{ animationDelay: "0.09s" }}>
              <SecTitle icon="ambassador">Programme de parrainage</SecTitle>
              {(() => {
                const on = !!row.parrainage_eligible;
                const editable = meteoSettable() && !isFinanceTeam();
                return (
                  <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc", marginBottom: 22 }}>
                    <motion.button type="button" disabled={!editable} whileTap={editable ? { scale: 0.99 } : undefined}
                      onClick={() => { if (editable) patch(num, { parrainage_eligible: !on }); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 0, border: "none", background: "none", cursor: editable ? "pointer" : "default", textAlign: "left", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${on ? GREEN : "#cbd2e0"}`, background: on ? GREEN : "transparent", transition: "background .15s ease, border-color .15s ease" }}>
                        {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Éligible au programme de parrainage</span>
                        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>Le programme vise à encourager les parrains à générer régulièrement de nouvelles opportunités commerciales qualifiées.</span>
                      </span>
                    </motion.button>
                  </div>
                );
              })()}
            </div>
          )}

          </DetailFold>

          {agendaOpen && <ClientAgendaModal row={row} num={num} onClose={() => setAgendaOpen(false)} />}
          {onboardingOpen && <OnboardingFlowModal row={row} num={num} patch={patch} onClose={() => setOnboardingOpen(false)}
            onRescheduleWithDate={() => setReschedOpen("onboarding")} onReschedule={(kind) => setReschedOpen(kind)}
            onCancel={!isFinanceTeam() ? (kind) => setCancelOpen(kind) : undefined}
            blocked={!!reschedOpen || !!cancelOpen} refreshKey={apptVersion} onChanged={() => { reload(); reloadRatings?.(); }} />}
          {reschedOpen && <ReschedOnboardingModal kind={reschedOpen} row={row} num={num} onClose={() => { setReschedOpen(false); setApptVersion((v) => v + 1); reload(); }} onDone={() => { setReschedOpen(false); setApptVersion((v) => v + 1); reload(); }} />}
          {transferTo && <TransferOnboardingModal row={row} num={num} target={transferTo} current={onboardingHost?.host} slot={onboardingHost?.slot}
            onClose={() => setTransferTo(null)} onDone={() => { setTransferTo(null); setApptVersion((v) => v + 1); reload(); }} />}
          {cancelOpen && <CancelLaunchModal kind={cancelOpen} row={row} num={num} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); setApptVersion((v) => v + 1); reload(); }} />}

          <DetailFold title="Facturation et suivi">
          {/* Jalons éditables (indisponibles tant que le client n'est pas établi) */}
          <div className="ob-sec" style={{ animationDelay: "0.25s" }}>
          {num ? (
            <>
              <SecTitle icon="facturation">Suivi facturation</SecTitle>
              <JalonRow label="Statut facturation Owner" editable={!isFinanceTeam()} done={row.facturation_honoraires_done} date={row.facturation_honoraires_date}
                onToggle={(v) => patch(num, { facturation_honoraires_done: v })} onDate={(d) => patch(num, { facturation_honoraires_date: d })} />
              <JalonRow label="Statut facturation Opti'Lex" editable={!isFinanceTeam()} done={row.setup_facturation_done} date={row.setup_facturation_date}
                onToggle={(v) => patch(num, { setup_facturation_done: v })} onDate={(d) => patch(num, { setup_facturation_date: d })} />
              {/* RDV +2 mois : RdvRow avec LIEN de prise de RDV (30 min avec Lisa Gentaire).
                  Date affichée = manuelle (rdv_plus1mois_date, prime) sinon date réservée par
                  le client (rdv_plus2mois_date, via le booking). Lien copiable tant qu'aucune
                  date n'est posée. Toggle À venir/Effectué conservé (planifiable avant). */}
              <RdvRow label="RDV +2 mois" date={row.rdv_plus1mois_date || row.rdv_plus2mois_date} done={row.rdv_plus1mois_done} editable={!!num && !isFinanceTeam()}
                link={row.plus2mois_url || null}
                onDate={num ? (d) => patch(num, { rdv_plus1mois_date: d }) : undefined}
                onToggle={(v) => patch(num, { rdv_plus1mois_done: v })} />

            </>
          ) : (
            <div style={{ padding: "14px 16px", borderRadius: 10, border: `1px dashed ${BORDER}`, background: "#fafbfc", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              Contrat en cours d'envoi. Le suivi facturation et les commentaires seront disponibles une fois la vente déclarée (client rattaché).
            </div>
          )}
          </div>
          </DetailFold>
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
    <span aria-hidden="true" style={{ ...base, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#e9eef6", color: NAVY, fontSize: Math.round(size * 0.48), fontWeight: 800 }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Confier l'onboarding à l'équipe, au même créneau : l'événement passe d'un agenda à l'autre, même lien Meet,
// et le client ne reçoit rien (dev 29/10/2026).
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
      setError(typeof d === "string" ? d : "Le rendez-vous n’a pas pu être confié. Rien n’a changé.");
      setSaving(false);
    }
  };
  return createPortal(
    <div className="ob-transfer-modal" role="dialog" aria-modal="true" aria-label={`Confier le rendez-vous à ${target.name}`} style={{ position: "fixed", inset: 0, zIndex: 10070, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { if (!saving) onClose(); }} style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.42)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(440px, 100%)", background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(17,24,39,0.28)", padding: "20px 22px" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ display: "inline-flex" }}><HostFace name={target.name} photo={target.photo} size={44} /></div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, color: GREEN }}>Rendez-vous confié à {target.name}</div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: MUTED }}>Il est dans son agenda. Le client n’a rien reçu.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {current && <HostFace name={current.name} photo={current.photo} size={34} />}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              <HostFace name={target.name} photo={target.photo} size={34} />
              <div style={{ minWidth: 0, marginLeft: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Confier le rendez-vous à {target.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}{slot ? ` · ${fmtDT(slot)}` : ""}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 13, color: TEXT, lineHeight: 1.55 }}>
              Le rendez-vous passe de votre agenda à celui {/^[aeiouyàâéèêîïôû]/i.test(target.name) ? `d’${target.name}` : `de ${target.name}`}, au même créneau et avec le même lien Meet. La facturation ne bouge pas. Le client ne reçoit rien.
            </div>
            {error && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: "#b42318", lineHeight: 1.5 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" disabled={saving} onClick={onClose}
                style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>Annuler</button>
              <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={saving} onClick={confirm}
                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
                {saving ? "Transfert…" : `Confier à ${target.name}`}
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
        style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.42)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(640px, 100%)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(17,24,39,0.28)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Reprogrammer le rendez-vous {kind === "onboarding" ? "onboarding" : kind}</div>
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
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px 4px 5px", borderRadius: 999, border: `1px solid ${active ? NAVY : BORDER}`, background: active ? NAVY : CARD, color: active ? "#fff" : NAVY, fontSize: 12.5, fontWeight: 650, cursor: active ? "default" : "pointer", fontFamily: "inherit", transition: "all .12s ease" }}>
                  <HostFace name={o.name} photo={o.photo} size={22} ring={active} />
                  {o.name}{o.name === currentHost ? <span style={{ fontWeight: 500, opacity: 0.7 }}> · actuel</span> : null}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <button type="button" onClick={() => shiftWeek(-1)} disabled={saving || uncertain || start <= todayIso()}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, color: start <= todayIso() ? MUTED : NAVY, cursor: start <= todayIso() ? "default" : "pointer", fontFamily: "inherit" }}>← Sem. préc.</button>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>Créneaux libres · {kind === "onboarding" ? `${hostName || "animateur"} + facturation` : kind} · heure de Paris</span>
          <button type="button" disabled={saving || uncertain} onClick={() => shiftWeek(1)}
            style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}>Sem. suiv. →</button>
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
                <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "capitalize", marginBottom: 7 }}>{dayLabel(d.date)}</div>
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
                          background: on ? GREEN : (s.free ? CARD : "#f3f4f6"),
                          color: on ? "#fff" : (s.free ? NAVY : "#c3cad6"),
                          textDecoration: s.free ? "none" : "line-through",
                          fontSize: 12.5, fontWeight: 600, cursor: s.free ? "pointer" : "default", fontFamily: "inherit", transition: "all .12s ease" }}>
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
          <span role={error ? "alert" : undefined} style={{ fontSize: 12, color: error ? "#b42318" : MUTED, minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.5 }}>
            {error || (sel ? `Nouveau créneau : ${dayLabel(sel.date)} à ${sel.slot}` : "Sélectionne un créneau")}
          </span>
          <motion.button type="button" whileTap={sel ? { scale: 0.97 } : undefined} disabled={!sel || saving} onClick={confirm}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: sel ? GREEN : "#e5e8ee", color: sel ? "#fff" : MUTED, fontSize: 13, fontWeight: 700, cursor: sel && !saving ? "pointer" : "default", fontFamily: "inherit", flexShrink: 0 }}>
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
const CANCEL_RED = "#b42318";
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
        style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.42)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(460px, 100%)", background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(17,24,39,0.28)", padding: "20px 22px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{done ? "Rendez-vous annulé" : `Annuler le rendez-vous de lancement ${kind}`}</div>
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
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Fermer</motion.button>
          ) : (
            <>
              <button type="button" disabled={saving} onClick={onClose}
                style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>Garder le rendez-vous</button>
              <motion.button type="button" whileTap={saving ? undefined : { scale: 0.97 }} disabled={saving} onClick={confirm}
                style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: CANCEL_RED, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
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
function JalonRow({ label, done, date, onToggle, onDate, alwaysDate = false, toggleLabels, editable = true }) {
  const showDate = alwaysDate || done;
  const dateLabel = alwaysDate ? "Date prévue" : null;
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
        {editable
          ? <StatusToggle value={!!done} onChange={onToggle} labels={toggleLabels} />
          : <span style={{ fontSize: 12.5, fontWeight: 600, color: done ? GREEN : MUTED }}>{(toggleLabels || ["Non", "Oui"])[done ? 1 : 0]}</span>}
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
                style={{ ...inputStyle, width: 168, padding: "7px 10px", fontSize: 12.5 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Section météo de la fiche : note courante (badge + qui/quand), saisie inline (Owner
// et cabinet : tous les rôles autorisés sur le board), et historique des notations.
function MeteoSection({ row, num, recordMeteo, version, onChanged }) {
  const [hist,setHist]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{let alive=true;setError('');apiClient.get(`/api/v1/optilex/meteo-history?numero_client=${encodeURIComponent(num)}`).then(r=>{if(alive){setHist(r.history||[]);setLoaded(true);}}).catch(()=>{if(alive)setError('Impossible de charger les notations.');});return()=>{alive=false;};},[num,version,refresh]);
  const current=loaded?hist[0]:{score:row.meteo_score,weather_context:row.meteo_context,author_name:row.meteo_by,created_at:row.meteo_at};
  return <div>
    <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14}}><MeteoBadge score={current?.score} context={current?.weather_context}/>{current?.author_name && <span style={{fontSize:11,color:MUTED}}>Par {current.author_name} · {timeAgo(current.created_at)}</span>}</div>
    <p style={{fontSize:12,color:MUTED,lineHeight:1.5,margin:'0 0 10px'}}>À mettre à jour à chaque échange avec le client, avant ou après l’onboarding.</p>
    {weatherPresentation(current?.score,current?.weather_context)?.legacy && <p className="wc-legacy-notice">Cette évaluation utilise l’ancienne échelle. Elle est conservée telle qu’elle a été saisie. La prochaine météo utilisera les 5 niveaux ci-dessous.</p>}
    <WeatherScaleGuide/>
    {error && <p role="alert">{error} <button onClick={()=>setRefresh(v=>v+1)}>Réessayer</button></p>}
    <SecTitle icon="comments">Échanges et notations</SecTitle>
    <CommentThread numero={num} onAddWeather={async payload=>{const ok=await recordMeteo(num,payload);if(ok!==false)setRefresh(v=>v+1);return ok;}} ratings={hist} ratingsLoading={!loaded&&!error} onRatingEdited={updated=>{setHist(items=>items.map(item=>item.id===updated.id?updated:item));onChanged();}} onRatingDeleted={()=>{setRefresh(v=>v+1);onChanged();}} onRatingConflict={()=>setRefresh(v=>v+1)}/>
  </div>;
}

// Editing preserves the score and original chronology. Capabilities come from the API.
function RatingHistoryActions({ rating, numero, onEdited, onDeleted, onConflict }) {
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
  const actionStyle = { border: "none", background: "transparent", padding: "5px 0", fontSize: 12, color: MUTED, cursor: "pointer", fontFamily: "inherit" };
  return <div>
    {rating.weather_context?.qualification ? <WeatherQualification context={rating.weather_context}/> : rating.note && <DetailText text={rating.note} />}
    {rating.note_updated_at && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
      Commentaire modifié{rating.note_updated_by_name ? ` par ${rating.note_updated_by_name}` : ""} · {timeAgo(rating.note_updated_at)}
    </div>}
    {!mode && <div style={{ display: "flex", gap: 16 }}>
      {rating.can_edit_note && <button type="button" style={actionStyle} onClick={() => begin('edit')}>Modifier le commentaire</button>}
      {rating.can_delete && <button type="button" style={{ ...actionStyle, color: "#b91c1c" }} onClick={() => begin('delete')}>Supprimer la notation</button>}
    </div>}
    {mode && <div style={{ marginTop: 8, padding: 12, border: `1px solid ${BORDER}`, borderRadius: 8, background: "#f7f8fa" }}>
      {mode === 'edit' ? <label style={{ display: "block", fontSize: 12 }}>
        Commentaire de la notation {rating.score}/5
        <textarea aria-label="Modifier le commentaire de notation" value={draft} onChange={(e) => setDraft(e.target.value)}
          maxLength={4000} rows={3} disabled={busy} autoFocus
          style={{ ...inputStyle, width: "100%", marginTop: 6, resize: "vertical" }} />
      </label> : <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
        Supprimer cette note de {rating.score}/5 et son commentaire ? La dernière notation restante deviendra la note courante, ou le client sera « non noté ». Les alertes déjà envoyées ne seront pas retirées.
      </p>}
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <button type="button" disabled={busy || (mode === 'edit' && !draft.trim())} onClick={submit}
          style={{ ...actionStyle, fontWeight: 700, color: mode === 'delete' ? "#b91c1c" : NAVY }}>
          {busy ? "Enregistrement…" : mode === 'edit' ? "Enregistrer le commentaire" : "Confirmer la suppression"}
        </button>
        <button type="button" disabled={busy} onClick={cancel} style={actionStyle}>Annuler</button>
      </div>
    </div>}
  </div>;
}

function CommentThread({ numero, onAddWeather, ratings = [], ratingsLoading = false, onRatingEdited, onRatingDeleted, onRatingConflict }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const meName = me.name || me.full_name || me.first_name || me.email || "Moi";
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyTo,setReplyTo]=useState(null);
  const [expanded, setExpanded] = useState(false);
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
      setComments((prev) => prev.filter((c) => c.id !== id));
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
    setExpanded(true);
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
      .then((r) => { if (alive) setComments(r.comments || []); })
      .catch(() => { if (alive) setError("Les commentaires n’ont pas pu être chargés."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [numero, refresh]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting || loading) return;
    setPosting(true);
    try {
      const created = await apiClient.post("/api/v1/optilex/comments", { numero_client: numero, body, mentions: mentionedIds(body, people), rating_id: replyTo?.id || null });
      setComments((prev) => [created, ...prev]);
      setDraft(""); setReplyTo(null);
      setNotice(notifiedSummary(created.notified));
    } catch (e) { setError("Le commentaire n’a pas pu être publié. Votre texte est conservé."); }
    finally { setPosting(false); }
  };

  const entries = [
    ...comments.filter(c=>!c.rating_id || !ratings.some(r=>r.id===c.rating_id)).map(c => ({ ...c, kind: "comment", key: `comment-${c.id}` })),
    ...ratings.map(c => ({ ...c, kind: "rating", key: `rating-${c.id}` })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || (a.kind === b.kind ? b.id - a.id : a.kind.localeCompare(b.kind)));
  const shown = expanded ? entries : entries.slice(0, 3);

  return (
    <div ref={rootRef} id="ob-comments" style={{ scrollMarginTop: 16 }}>
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error} <button type="button" onClick={() => setRefresh(v => v + 1)}>Réessayer</button></p>}
      {notice && <p role="status" style={{ color: "#3e7d5a", fontSize: 12, margin: "6px 0 10px" }}>{notice}</p>}
      {(loading || ratingsLoading) && <p role="status" style={{ color: MUTED, fontSize: 12 }}>Chargement de l’historique…</p>}
      {!loading && !ratingsLoading && !error && !entries.length && <p style={{ color: MUTED, fontSize: 12 }}>Aucun échange pour le moment.</p>}
      {/* Espace commun : le composer est toujours visible et nommé, pour que chacun sache où écrire
          (retour dev 25/09). Ouvert à tous les rôles du board, finance_team comprise. */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", marginBottom: comments.length ? 18 : 4, background: "#fafbfc" }}>
        <div className="wc-comment-heading"><div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>Écrire dans l’espace commun</div>
          {onAddWeather && <MeteoPicker triggerLabel="Ajouter une météo" onSave={onAddWeather} disabled={!numero}/>}
        </div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8, lineHeight: 1.45 }}>Visible par Owner, Opti’Lex et la finance. Tapez @ pour prévenir quelqu’un : il reçoit un e-mail et une notification.</div>
      {replyTo && <div className="wc-reply-context"><span>Réponse à la météo {weatherRatingLabel(replyTo.score,replyTo.weather_context)}</span><button type="button" onClick={()=>setReplyTo(null)}>Annuler</button></div>}
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={meName} src={me.avatar_url} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <MentionTextarea value={draft} onChange={setDraft} people={people}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder="Ajouter un commentaire… (@ pour mentionner quelqu’un)" rows={2}
            style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={submit} disabled={!draft.trim() || posting}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: draft.trim() && !posting ? "pointer" : "default",
                background: draft.trim() ? NAVY : "#e5e7eb", color: draft.trim() ? "#fff" : MUTED, transition: "background 0.2s" }}>
              {posting ? "…" : "Publier"}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Fil */}
      <AnimatePresence initial={false}>
        {shown.map((c) => c.kind === "rating" ? (
          <motion.div key={c.key} id={`weather-${c.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", gap: 10, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: weatherPresentation(c.score,c.weather_context)?.bg, display: "grid", placeItems: "center", flexShrink: 0 }}><MeteoIcon score={c.score} size={18} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
                <strong>{c.author_name || c.author_email || "—"}</strong>
                <span style={{ color: weatherPresentation(c.score,c.weather_context)?.color, fontWeight: 600 }}>Météo · {weatherRatingLabel(c.score,c.weather_context)}</span>
                <span title={fmt(c.created_at)} style={{ color: MUTED }}>{timeAgo(c.created_at)}</span>
              </div>
              <RatingHistoryActions rating={c} numero={numero} onEdited={onRatingEdited} onDeleted={onRatingDeleted} onConflict={onRatingConflict} />
              <button type="button" className="wc-reply-button" onClick={()=>{setReplyTo(c);rootRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}>Répondre à cette météo{comments.filter(r=>r.rating_id===c.id).length ? ` (${comments.filter(r=>r.rating_id===c.id).length})` : ''}</button>
              {comments.filter(r=>r.rating_id===c.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(reply=><div className="wc-linked-reply" key={reply.id}><p style={{fontSize:11,color:MUTED}}><strong>{reply.author_name||reply.author_email}</strong> · {timeAgo(reply.created_at)}</p>{editingId===reply.id ? <div><MentionTextarea value={editDraft} onChange={setEditDraft} people={people} rows={2} maxLength={4000}/><button type="button" className="wc-reply-button" disabled={savingEdit||!editDraft.trim()} onClick={saveEdit}>Enregistrer</button><button type="button" className="wc-reply-button" onClick={()=>setEditingId(null)}>Annuler</button></div> : <DetailText text={<MentionedText text={reply.body} mentions={reply.mentions}/>} measureKey={reply.body}/>}{canEdit(reply)&&editingId!==reply.id&&<div><button type="button" className="wc-reply-button" onClick={()=>{setEditingId(reply.id);setEditDraft(reply.body);}}>Modifier</button>{confirmDeleteId===reply.id?<><button type="button" className="wc-reply-button" disabled={!!deletingId} onClick={()=>deleteComment(reply.id)}>Confirmer la suppression</button><button type="button" className="wc-reply-button" onClick={()=>setConfirmDeleteId(null)}>Annuler</button></>:<button type="button" className="wc-reply-button" onClick={()=>setConfirmDeleteId(reply.id)}>Supprimer</button>}</div>}</div>)}
            </div>
          </motion.div>
        ) : (
          <motion.div key={c.key} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", gap: 10, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
            <Avatar name={c.author_name || c.author_email} size={32} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{c.author_name || c.author_email || "—"}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(c.created_at)}{c.updated_at ? " · modifié" : ""}</span>
                {canEdit(c) && editingId !== c.id && (
                  <button type="button" title="Modifier ce commentaire"
                    onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                    style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer", padding: "0 2px", display: "inline-flex", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = NAVY; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                )}
                {canEdit(c) && editingId !== c.id && confirmDeleteId !== c.id && (
                  <button type="button" title="Supprimer ce commentaire" aria-label="Supprimer ce commentaire"
                    onClick={() => setConfirmDeleteId(c.id)}
                    style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer", padding: "0 2px", display: "inline-flex", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#b91c1c"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                )}
                {confirmDeleteId === c.id && (
                  <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: TEXT }}>
                    Supprimer ce commentaire ?
                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                      style={{ border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Annuler
                    </button>
                    <button type="button" onClick={() => deleteComment(c.id)} disabled={deletingId === c.id}
                      style={{ border: "none", background: "#b91c1c", color: "#fff", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, fontWeight: 600, cursor: deletingId === c.id ? "default" : "pointer", fontFamily: "inherit" }}>
                      {deletingId === c.id ? "…" : "Supprimer"}
                    </button>
                  </motion.span>
                )}
              </div>
              {editingId === c.id ? (
                <div style={{ marginTop: 6 }}>
                  <MentionTextarea value={editDraft} onChange={setEditDraft} people={people} rows={2} autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
                      if (e.key === "Escape") { setEditingId(null); setEditDraft(""); }
                    }}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45 }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                    <button type="button" onClick={() => { setEditingId(null); setEditDraft(""); }}
                      style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Annuler
                    </button>
                    <button type="button" onClick={saveEdit} disabled={!editDraft.trim() || savingEdit}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                        cursor: editDraft.trim() && !savingEdit ? "pointer" : "default",
                        background: editDraft.trim() ? NAVY : "#e5e7eb", color: editDraft.trim() ? "#fff" : MUTED }}>
                      {savingEdit ? "…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              ) : (
                <DetailText text={<MentionedText text={c.body} mentions={c.mentions} />} measureKey={c.body} />
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {entries.length > 3 && (
        <button onClick={() => setExpanded((v) => !v)}
          style={{ border: "none", background: "transparent", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "2px 0", fontFamily: "inherit" }}>
          {expanded ? "Réduire l’historique" : `Voir plus (${entries.length - 3})`}
        </button>
      )}

    </div>
  );
}
