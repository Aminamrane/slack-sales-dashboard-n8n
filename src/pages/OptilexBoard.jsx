import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";

// ── Charte sobre (navy + neutre, style Attio/Linear) ─────────────────────────
const NAVY = "#1e2330";
const BORDER = "#e9ebf0";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const BG = "#f6f7f9";
const CARD = "#ffffff";
const GREEN = "#15794a";

const ETAT_STYLE = {
  "Signé":            { bg: "#e9f9f0", fg: "#15794a", dot: "#22c55e" },
  "Résiliation":      { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Rétractation":     { bg: "#fff3e3", fg: "#b45309", dot: "#f59e0b" },
  "Self-Résiliation": { bg: "#fdecec", fg: "#b42318", dot: "#ef4444" },
  "Pause":            { bg: "#eef1f6", fg: "#5b6472", dot: "#94a3b8" },
  "Liquidation":      { bg: "#f6e9e9", fg: "#7a271a", dot: "#991b1b" },
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
const PRIMARY_TABS = ["Tous", "Signé", "Attente Opti'Lex", "Inactifs", "Onboarding à venir", "Intégration à venir", "En cours de résiliation", "En cours de rétractation"];
const SECONDARY_CATS = ["En cours", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation", "En attente", "Sans suite"];
const TAB_LABEL = { "Attente Opti'Lex": "En attente Opti'Lex", "Onboarding à venir": "Onboarding Owner à venir", "Intégration à venir": "RDV intégration à venir" };
const tabLabel = (t) => TAB_LABEL[t] || t;
// États que le cabinet peut poser manuellement (badge cliquable, table + fiche).
const ETAT_OPTIONS = ["Signé", "En cours de résiliation", "En cours de rétractation", "Résiliation", "Rétractation", "Self-Résiliation", "Pause", "Liquidation"];
// RÈGLE MÉTIER : le rôle optilex (fiscalistes du cabinet) ne peut pas POSER Résiliation/
// Rétractation (états actés par Owner) — seulement les "En cours de ...". Le backend
// applique la même règle (403) ; ici on retire les options de leur picker.
const CABINET_FORBIDDEN_ETATS = ["Résiliation", "Rétractation"];
const etatOptionsForUser = () => {
  try {
    if ((apiClient.getUser() || {}).role === "optilex") {
      return ETAT_OPTIONS.filter((o) => !CABINET_FORBIDDEN_ETATS.includes(o));
    }
  } catch { /* défaut : liste complète */ }
  return ETAT_OPTIONS;
};
// ── Météo client : note 1-5 -> bande couleur + sens/action ───────────────────
// 1-2 rouge (critique, risque résiliation), 3 orange (mécontent), 4-5 vert (satisfait).
const METEO_BANDS = {
  rouge:  { label: "Critique",  color: "#dc2626", bg: "#fdecec", dot: "#dc2626" },
  orange: { label: "Mécontent", color: "#d97706", bg: "#fff3e3", dot: "#d97706" },
  vert:   { label: "Satisfait", color: "#15a34a", bg: "#e9f9ef", dot: "#15a34a" },
};
const meteoBandOf = (score) => (score == null ? null : score <= 2 ? "rouge" : score === 3 ? "orange" : "vert");
const meteoStyle = (score) => { const b = meteoBandOf(score); return b ? METEO_BANDS[b] : null; };
// Sens de chaque note (affiché dans le sélecteur) + action implicite (automatisable via CSV).
const METEO_MEANING = {
  1: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  2: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  3: { txt: "Client mécontent", action: "Axes d'optimisation (Opti'Lex)" },
  4: { txt: "Client satisfait", action: null },
  5: { txt: "Client satisfait", action: "Programme ambassadeur (Owner)" },
};
// Qui peut POSER une note : pour l'instant Owner uniquement (le cabinet la voit mais ne la
// modifie pas). Plus tard on ouvrira au rôle optilex -> retirer ce gate (backend déjà OK).
const meteoSettable = () => { try { return (apiClient.getUser() || {}).role !== "optilex"; } catch { return true; } };
// Icône météo par note (progression orage -> grand soleil, style lucide, colorée par la bande).
const METEO_ICONS = {
  1: <><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" /><path d="m13 12-3 5h4l-3 5" /></>,      // orage
  2: <><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14v5M8 14v5M12 16v5" /></>, // pluie
  3: <><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></>,                                          // nuageux
  4: <><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" /><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /></>, // éclaircie
  5: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>, // grand soleil
};
function MeteoIcon({ score, size = 16, color = "currentColor" }) {
  const paths = METEO_ICONS[score];
  if (!paths) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{paths}</svg>;
}
// Champ(s) date à saisir par état (raisonnement fiscaliste). Absent = pas de date.
// Pause = période : début (etat_date) + fin CONNUE (pause_end_date) OU indéterminée -> relance
// (pause_relance_date), car en B2B le dirigeant ne sait pas toujours quand il reprend.
const ETAT_DATE_CONFIG = {
  "Résiliation": { label: "Date de résiliation" },
  "Self-Résiliation": { label: "Date de résiliation" },
  "Rétractation": { label: "Date de rétractation" },
  "Liquidation": { label: "Date de clôture" },
  "Pause": { pause: true },
};

// Volet Opti'Lex actif : planifié (va être envoyé) ou envoyé (en attente signature).
const optilexPending = (r) => r.optilex_status === "scheduled" || r.optilex_status === "ongoing";
// "Attente Opti'Lex" = Owner SIGNÉ mais Opti'Lex encore en attente -> le cabinet doit agir.
const isAttenteOptilex = (r) => r.owner_status === "done" && optilexPending(r);
// "En cours" = Opti'Lex actif mais Owner PAS encore signé (les 2 contrats encore en vol).
const isEnCours = (r) => r.owner_status !== "done" && optilexPending(r);
// RDV à venir (date de RDV >= aujourd'hui à Paris, pas encore effectué) — onglets dédiés.
// Dates stockées en heure-mur Paris labellisée UTC -> on compare les PARTIES date (YYYY-MM-DD),
// indépendamment du fuseau du navigateur, pour coller à l'affichage. Restreint aux lignes avec
// un numéro client (RDV réellement pilotables ; un contrat pas encore résolu n'est pas actionnable).
const _todayParisISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const isOnboardingUpcoming = (r) => !!r.numero_client && !!r.rdv_onboarding_date && !r.rdv_onboarding_done && String(r.rdv_onboarding_date).slice(0, 10) >= _todayParisISO();
const isIntegrationUpcoming = (r) => !!r.numero_client && !!r.rdv_lancement_date && !r.rdv_lancement_done && String(r.rdv_lancement_date).slice(0, 10) >= _todayParisISO();
// Contrat Opti'Lex SÉPARÉ (split) pas encore signé : optilex_status existe (non null =
// pas le cas "groupé/inclus") et != done. Sert l'alerte "RDV intégration mais Opti'Lex
// non signé". Disparaît d'elle-même dès que le contrat est signé (status -> done).
const optilexNotSigned = (r) => !!r.optilex_status && r.optilex_status !== "done";
const integrationAlert = (r) => isIntegrationUpcoming(r) && optilexNotSigned(r);
// État affiché : l'état du Sheet en priorité, sinon le statut du contrat en cours.
const displayEtat = (r) => {
  if (r.etat_manuel) return r.etat_manuel;   // override manuel du cabinet (prioritaire)
  if (r.etat) return r.etat;                 // état du Sheet (vérité des ÉTATS)
  // Vérité des DATA = interne : Owner signé -> "Signé" même pas (encore) dans le Sheet.
  // Deux régimes : contrat GROUPÉ (optilex null = Opti'Lex inclus dans l'Owner, signé avec)
  // ou SPLIT dont le volet Opti'Lex est signé (optilex 'done'). Owner signé + Opti'Lex
  // encore en vol (scheduled/ongoing) reste "Attente Opti'Lex" (traité plus bas).
  if (r.owner_status === "done" && (r.optilex_status == null || r.optilex_status === "done")) return "Signé";
  if (isAttenteOptilex(r)) return "Attente Opti'Lex";
  if (isEnCours(r)) return "En cours";
  // Owner signé mais volet Opti'Lex terminal (expiré/annulé/refusé) : le client reste acquis
  // côté Owner -> "Signé" (la colonne/le détail Opti'Lex montre le statut réel).
  if (r.owner_status === "done") return "Signé";
  return null;
};
// Une ligne appartient-elle à une catégorie (onglet primaire OU secondaire) ? Unifie les
// prédicats calculés (RDV à venir) et les états (Sheet/override/interne) pour un filtrage unique.
// Client cabinet sans mission suivie depuis 60 j (enrichissement SaaS Opti'Lex, jointure email).
// Indépendant de l'état : un client peut être "Signé" ET inactif — signal de churn silencieux.
// Inactif = sans mission depuis >= 60 j ET au moins une mission passée (le cabinet a
// travaillé puis plus rien = vrai churn). Les zéro-mission (probablement encore en
// onboarding) ne sont affichés NULLE PART comme inactifs (décision produit 2026-07-08).
const isInactif = (r) => r.is_inactive_60d === true && (r.mission_count_total || 0) > 0;
const matchesCat = (r, cat) => {
  if (cat === "Onboarding à venir") return isOnboardingUpcoming(r);
  if (cat === "Intégration à venir") return isIntegrationUpcoming(r);
  if (cat === "Inactifs") return isInactif(r);
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
  const band = r.meteo_score != null ? meteoBandOf(r.meteo_score) : "";
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

// ── Filtre par date de signature Owner ──────────────────────────────────────
// owner_signed_at (fallback fiche appliqué côté back) -> date seule YYYY-MM-DD.
const sigDateOf = (r) => (r.owner_signed_at ? String(r.owner_signed_at).slice(0, 10) : null);
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
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
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
  return <div style={{ width: size, height: size, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.43), fontWeight: 700, flexShrink: 0 }}>{letter}</div>;
}

function EtatBadge({ etat }) {
  const s = ETAT_STYLE[etat] || { bg: "#eef1f6", fg: MUTED, dot: "#cbd2e0" };
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
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  if (disabled) return <EtatBadge etat={etat} />;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + ETAT_MENU_H > window.innerHeight && r.top > ETAT_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  // "Automatique" = état calculé (suivi cabinet / signatures), efface l'override manuel.
  const items = [{ opt: null, label: "Automatique" }, ...etatOptionsForUser().map((o) => ({ opt: o, label: o }))];
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Changer l'état"
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <EtatBadge etat={etat} />
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
              const st = opt ? (ETAT_STYLE[opt] || {}) : null;
              const sel = opt === etat;
              return (
                <button key={label} type="button" onClick={() => { setOpen(false); if (!sel) onPick(opt); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none",
                    background: sel ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, color: opt ? TEXT : MUTED, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f7f8fa"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: st ? (st.dot || "#cbd2e0") : "transparent", border: opt ? "none" : `1.5px dashed ${MUTED}`, flexShrink: 0 }} />
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

// Badge météo : note colorée très visible (1-2 rouge / 3 orange / 4-5 vert).
function MeteoBadge({ score, showLabel = true }) {
  const s = meteoStyle(score);
  if (!s) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#b6bdc9", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, border: "1.5px dashed #cbd2e0", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#cbd2e0" }}>?</span>
      {showLabel && "À noter"}
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: s.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MeteoIcon score={score} size={16} color={s.color} />
      </span>
      {showLabel && <span style={{ fontSize: 12, fontWeight: 700, color: s.color, whiteSpace: "nowrap" }}>{score} · {s.label}</span>}
    </span>
  );
}

// Sélecteur météo CLIQUABLE : popup (portal) avec les 5 notes (sens + action) + une note
// d'interaction. onSave(score, note). Read-only si disabled (badge seul).
const METEO_MENU_H = 420;
function MeteoPicker({ score, onSave, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [sel, setSel] = useState(score || null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  if (disabled) return <MeteoBadge score={score} />;
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    setSel(score || null); setNote("");
    const r = btnRef.current.getBoundingClientRect();
    const up = r.bottom + METEO_MENU_H > window.innerHeight && r.top > METEO_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  const save = async () => {
    if (!sel || saving) return;
    setSaving(true);
    try { await onSave(sel, note.trim() || null); setOpen(false); }
    finally { setSaving(false); }
  };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Noter le client"
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <MeteoBadge score={score} />
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 14, width: 300, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Météo du client</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const st = METEO_BANDS[meteoBandOf(n)];
                const on = sel === n;
                return (
                  <button key={n} type="button" onClick={() => setSel(n)}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: on ? `2px solid ${st.color}` : `1px solid ${BORDER}`, background: on ? st.bg : CARD, color: on ? st.color : TEXT, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <MeteoIcon score={n} size={19} color={on ? st.color : "#9aa0ab"} />{n}</button>
                );
              })}
            </div>
            {sel && (
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10, lineHeight: 1.45 }}>
                <span style={{ fontWeight: 700, color: METEO_BANDS[meteoBandOf(sel)].color }}>{METEO_MEANING[sel].txt}.</span>
                {METEO_MEANING[sel].action ? ` → ${METEO_MEANING[sel].action}` : ""}
              </div>
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note d'interaction (optionnel)…" rows={2}
              style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setOpen(false)}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
              <button type="button" onClick={save} disabled={!sel || saving}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: sel ? NAVY : "#e5e7eb", color: sel ? "#fff" : MUTED, fontSize: 12.5, fontWeight: 600, cursor: sel && !saving ? "pointer" : "default", fontFamily: "inherit" }}>{saving ? "…" : "Enregistrer"}</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </span>
  );
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
function FilterMenu({ cats, counts, selected, onToggle, onClear }) {
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
    const up = r.bottom + FILTER_MENU_H > window.innerHeight && r.top > FILTER_MENU_H;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, up });
    setOpen(true);
  };
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" onClick={toggle} title="Filtrer par état"
        style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${active || open ? NAVY : BORDER}`, background: active ? NAVY : CARD, color: active ? "#fff" : TEXT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
        <FunnelIcon color={active ? "#fff" : MUTED} />
        Filtre
        {active && <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{selected.length}</span>}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 5, minWidth: 236, maxHeight: FILTER_MENU_H, overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Filtrer par état</span>
              {active && <button type="button" onClick={onClear} style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tout effacer</button>}
            </div>
            {cats.map((cat) => {
              const on = selected.includes(cat);
              const st = ETAT_STYLE[cat] || {};
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
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot || "#cbd2e0", flexShrink: 0 }} />
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
function SigDateFilter({ from, to, onChange, months = [] }) {
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
      <button ref={btnRef} type="button" onClick={toggle} title="Filtrer par date de signature Owner"
        style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${active || open ? NAVY : BORDER}`, background: active ? NAVY : CARD, color: active ? "#fff" : TEXT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {active ? label : "Date signature"}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={active ? "rgba(255,255,255,0.75)" : MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10050 }} />
          <div style={{ position: "fixed", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }), left: pos.left, zIndex: 10051, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(17,24,39,0.14)", padding: 12, width: 250, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", animation: "obMenuIn 0.15s cubic-bezier(0.16,1,0.3,1) both", transformOrigin: pos.up ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Signé le</span>
              {active && <button type="button" onClick={() => onChange({ from: "", to: "" })} style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Effacer</button>}
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
  if (status === "done") return { label: "Signé", sub: fmt(signedAt), color: GREEN, icon: "✓" };
  // Pas de contrat lié mais une date de signature (fiche client interne, remplie à la
  // déclaration de vente) : le client est signé, on l'affiche au lieu d'un "—" trompeur.
  if (!status && signedAt) return { label: "Signé", sub: fmt(signedAt), color: GREEN, icon: "✓" };
  if (status === "ongoing") return { label: "Envoyé", sub: fmt(sentAt) + " · en attente", color: "#b45309", icon: "•" };
  if (status === "scheduled") return { label: "Planifié", sub: fmt(scheduledAt), color: "#5b6472", icon: "◷" };
  if (status === "expired") return { label: "Expiré", sub: "", color: "#b42318", icon: "✕" };
  if (status === "canceled") return { label: "Annulé", sub: "", color: "#b42318", icon: "✕" };
  if (status === "failed") return { label: "Échec", sub: "", color: "#b42318", icon: "!" };
  return null;
}
function SigCell({ status, sentAt, signedAt, scheduledAt, grouped }) {
  const i = sigInfo(status, sentAt, signedAt, scheduledAt);
  // Contrat groupé (pas de volet Opti'Lex séparé) : Opti'Lex est inclus dans l'Owner signé.
  if (!i && grouped) {
    return (
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: GREEN }}>✓ Inclus</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>au contrat Owner</div>
      </div>
    );
  }
  if (!i) return <span style={{ color: "#cbd2e0" }}>—</span>;
  return (
    <div style={{ lineHeight: 1.25 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: i.color }}>{i.icon} {i.label}</div>
      {i.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{i.sub}</div>}
    </div>
  );
}

export default function OptilexBoard({ embed = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etatFilter, setEtatFilter] = useState("Tous");   // onglet primaire actif
  const [multiFilter, setMultiFilter] = useState([]);      // catégories secondaires cochées (union)
  const [sigRange, setSigRange] = useState({ from: "", to: "" }); // filtre date signature Owner
  const [meteoFilter, setMeteoFilter] = useState([]);      // bandes météo cochées (rouge/orange/vert)
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // numero_client du client ouvert

  // Anti-stale : toute mutation locale incrémente mutSeq ; une réponse de polling partie AVANT
  // la mutation est jetée (sinon elle écraserait l'optimiste avec une photo périmée de la base).
  const mutSeq = useRef(0);
  // Feedback d'échec d'enregistrement (bandeau discret, auto-dismiss).
  const [saveError, setSaveError] = useState(false);
  const errTimer = useRef(null);
  const flagSaveError = useCallback(() => {
    setSaveError(true);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setSaveError(false), 4200);
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

  const counts = useMemo(() => {
    const c = { "En cours": 0, "Attente Opti'Lex": 0 };
    for (const r of rows) {
      const e = displayEtat(r);   // état effectif (override / Sheet / signé interne / attente / en cours)
      if (e) c[e] = (c[e] || 0) + 1;
      if (isOnboardingUpcoming(r)) c["Onboarding à venir"] = (c["Onboarding à venir"] || 0) + 1;
      if (isIntegrationUpcoming(r)) c["Intégration à venir"] = (c["Intégration à venir"] || 0) + 1;
      if (isInactif(r)) c["Inactifs"] = (c["Inactifs"] || 0) + 1;
    }
    return c;
  }, [rows]);
  const establishedCount = useMemo(() => rows.filter((r) => !r.is_pending_contract).length, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      // Multi-filtre (catégories cochées) prioritaire = union ; sinon onglet primaire unique.
      if (multiFilter.length > 0) {
        if (!multiFilter.some((cat) => matchesCat(r, cat))) return false;
      } else if (etatFilter !== "Tous" && !matchesCat(r, etatFilter)) {
        return false;
      }
      // Filtre par bande météo (rouge 1-2 / orange 3 / vert 4-5), union des bandes cochées.
      if (meteoFilter.length > 0 && !meteoFilter.includes(meteoBandOf(r.meteo_score))) return false;
      // Filtre date de signature Owner (mois ou période). Une ligne sans date de
      // signature est exclue dès qu'un filtre date est actif.
      if (sigRange.from || sigRange.to) {
        const d = sigDateOf(r);
        if (!d) return false;
        if (sigRange.from && d < sigRange.from) return false;
        if (sigRange.to && d > sigRange.to) return false;
      }
      if (ql) {
        const hay = `${ov(r, "contact_name_ovr", "contact_name") || ""} ${r.crm_societe || ""} ${r.societe_sheet || ""} ${r.numero_client || ""} ${ov(r, "email_ovr", "email") || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, etatFilter, multiFilter, meteoFilter, sigRange, q]);

  // Mois qui ont au moins une signature Owner (pour le dropdown), du + récent au + ancien.
  const sigMonths = useMemo(() => {
    const set = new Set();
    for (const r of rows) { const d = sigDateOf(r); if (d) set.add(d.slice(0, 7)); }
    return [...set].sort().reverse();
  }, [rows]);

  const patch = useCallback(async (numero, changes) => {
    if (!numero) return; // contrat pré-client : pas de jalons éditables
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
      flagSaveError();
    }
  }, [flagSaveError]);

  // Poser un état + ses dates : passe par l'endpoint dédié (trace l'historique). Les dates de
  // pause ne valent que pour "Pause". Optimiste avec ROLLBACK si le POST échoue (un état qui
  // "a l'air posé" mais ne l'est pas est inacceptable pour un outil d'audit) ; la timeline ne
  // se rafraîchit qu'en cas de succès.
  const [etatHistVersion, setEtatHistVersion] = useState(0);
  const changeEtat = useCallback(async (numero, { etat = null, etat_date = null, pause_end_date = null, pause_relance_date = null }) => {
    if (!numero) return;
    mutSeq.current += 1;
    const pe = etat === "Pause" ? pause_end_date : null;
    const pr = etat === "Pause" ? pause_relance_date : null;
    let snapshot = null;
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, etat_manuel: etat, etat_date, pause_end_date: pe, pause_relance_date: pr };
    }));
    try {
      await apiClient.post("/api/v1/optilex/etat-change", { numero_client: numero, etat, etat_date, pause_end_date: pe, pause_relance_date: pr });
      setEtatHistVersion((v) => v + 1);   // succès uniquement
    } catch (e) {
      console.error("etat-change failed", e);
      if (snapshot) setRows((prev) => prev.map((r) => (r.numero_client === numero ? snapshot : r)));
      flagSaveError();
    }
  }, [flagSaveError]);

  // Poser une note météo (1-5) + note d'interaction : POST dédié (historisé). Optimiste avec
  // rollback. La dernière note = la météo courante (badge/filtre/CSV). Bump la version pour
  // rafraîchir l'historique dans la fiche.
  const [meteoHistVersion, setMeteoHistVersion] = useState(0);
  const recordMeteo = useCallback(async (numero, score, note) => {
    if (!numero || !score) return;
    mutSeq.current += 1;
    const u = apiClient.getUser() || {};
    const by = u.name || u.full_name || u.first_name || u.email || "";
    const at = new Date().toISOString();
    let snapshot = null;
    setRows((prev) => prev.map((r) => {
      if (r.numero_client !== numero) return r;
      snapshot = r;
      return { ...r, meteo_score: score, meteo_note: note || null, meteo_by: by, meteo_at: at };
    }));
    try {
      await apiClient.post("/api/v1/optilex/meteo", { numero_client: numero, score, note: note || null });
      setMeteoHistVersion((v) => v + 1);
    } catch (e) {
      console.error("meteo failed", e);
      if (snapshot) setRows((prev) => prev.map((r) => (r.numero_client === numero ? snapshot : r)));
      flagSaveError();
    }
  }, [flagSaveError]);

  const selRow = useMemo(() => rows.find((r) => rowKey(r) === selected) || null, [rows, selected]);

  // Stagger d'entrée SEEN-KEYS : seules les lignes jamais affichées s'animent. Plein replay au
  // changement d'onglet primaire (reset + remount du tbody) ; les lignes révélées par la
  // recherche (backspace) ou le multi-filtre entrent proprement SANS faire clignoter celles
  // déjà en place (même famille que le fix cardStaggerIn du setter). Le polling ne rejoue rien.
  const seenRows = useRef(new Set());
  const prevTabRef = useRef(etatFilter);
  if (prevTabRef.current !== etatFilter) { seenRows.current = new Set(); prevTabRef.current = etatFilter; }
  const newIdxByKey = new Map();
  { let ni = 0; for (const r of filtered) { const k = rowKey(r); if (!seenRows.current.has(k)) newIdxByKey.set(k, ni++); } }
  useEffect(() => { for (const r of filtered) seenRows.current.add(rowKey(r)); }, [filtered]);

  // Onglet primaire -> vide le multi-filtre ; cocher une catégorie -> vide l'onglet primaire.
  const pickTab = (t) => { setEtatFilter(t); setMultiFilter([]); };
  const toggleCat = (cat) => {
    setEtatFilter("Tous");
    setMultiFilter((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };
  // Export CSV de la vue filtrée courante (onglet + filtres + date + recherche).
  // Le nom de fichier reflète le filtre actif (ex. resiliation, en_cours_de_resiliation).
  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const label = multiFilter.length ? multiFilter.join("_") : (etatFilter !== "Tous" ? etatFilter : "board");
    exportRowsToCsv(filtered, label);
  };

  const th = { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#f2f4f7", zIndex: 1 };
  const td = { padding: "11px 14px", fontSize: 13, color: TEXT, borderTop: `1px solid ${BORDER}`, verticalAlign: "middle", whiteSpace: "nowrap" };

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
      `}</style>
      {/* Échec d'enregistrement : l'UI a été restaurée (rollback), on le DIT clairement. */}
      <AnimatePresence>
        {saveError && (
          <motion.div initial={{ opacity: 0, y: -10, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -10, x: "-50%" }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "fixed", top: 16, left: "50%", zIndex: 10060, background: "#b42318", color: "#fff", padding: "9px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, boxShadow: "0 8px 24px rgba(180,35,24,0.32)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Enregistrement impossible. Vérifiez votre connexion et réessayez.
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>Suivi cabinet Opti'Lex</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{establishedCount} clients{counts["Attente Opti'Lex"] ? ` · ${counts["Attente Opti'Lex"]} en attente Opti'Lex` : ""}{counts["En cours"] ? ` · ${counts["En cours"]} en cours` : ""} · temps réel</div>
        </div>
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
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {PRIMARY_TABS.map((t) => {
          const active = multiFilter.length === 0 && etatFilter === t;
          const n = t === "Tous" ? rows.length : (counts[t] || 0);
          return (
            <motion.button key={t} onClick={() => pickTab(t)} whileTap={{ scale: 0.96 }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f7f8fa"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = active ? "transparent" : CARD; }}
              style={{ position: "relative", padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? "transparent" : BORDER}`, background: active ? "transparent" : CARD, color: active ? "#fff" : TEXT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, transition: "color 0.18s, border-color 0.18s" }}>
              {/* Pilule active : GLISSE d'un onglet à l'autre (layoutId partagé, ressort sobre). */}
              {active && (
                <motion.span layoutId="obActiveTab" transition={{ type: "spring", stiffness: 560, damping: 42 }}
                  style={{ position: "absolute", inset: -1, background: NAVY, borderRadius: 20, zIndex: 0 }} />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 7 }}>
                {tabLabel(t)}<span style={{ fontSize: 11, fontWeight: 700, color: active ? "rgba(255,255,255,0.7)" : MUTED, transition: "color 0.18s" }}>{n}</span>
              </span>
            </motion.button>
          );
        })}
        <FilterMenu cats={SECONDARY_CATS} counts={counts} selected={multiFilter} onToggle={toggleCat} onClear={() => setMultiFilter([])} />
        <SigDateFilter from={sigRange.from} to={sigRange.to} onChange={setSigRange} months={sigMonths} />
        {/* Filtre météo (bandes couleur). Toggle multiple = union. */}
        <span style={{ width: 1, height: 22, background: BORDER, margin: "0 2px" }} />
        {["rouge", "orange", "vert"].map((b) => {
          const on = meteoFilter.includes(b);
          const st = METEO_BANDS[b];
          return (
            <motion.button key={b} type="button" whileTap={{ scale: 0.96 }} title={`Météo ${st.label}`}
              onClick={() => setMeteoFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f7f8fa"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = on ? st.bg : CARD; }}
              style={{ padding: "7px 12px", borderRadius: 20, border: `1px solid ${on ? st.color : BORDER}`, background: on ? st.bg : CARD, color: on ? st.color : TEXT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <MeteoIcon score={{ rouge: 1, orange: 3, vert: 5 }[b]} size={15} color={st.dot} />{st.label}
            </motion.button>
          );
        })}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {(sigRange.from || sigRange.to || multiFilter.length || etatFilter !== "Tous" || q) && (
            <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
          )}
          <motion.button type="button" onClick={handleExportCsv} disabled={filtered.length === 0} whileTap={{ scale: 0.96 }}
            title="Exporter la vue filtrée au format CSV"
            onMouseEnter={(e) => { if (filtered.length) e.currentTarget.style.background = "#f7f8fa"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = CARD; }}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD, color: filtered.length ? TEXT : MUTED, fontSize: 12.5, fontWeight: 600, cursor: filtered.length ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, opacity: filtered.length ? 1 : 0.55 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exporter CSV
          </motion.button>
        </span>
      </div>

      <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, overflowX: "hidden", overflowY: "auto", maxHeight: "calc(100vh - 190px)" }}>
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
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col />{/* client (reste) */}
              <col style={{ width: 124 }} />{/* météo */}
              <col style={{ width: 232 }} />{/* état (large pour "En cours de rétractation", le libellé le plus long) */}
              <col style={{ width: 150 }} />{/* owner */}
              <col style={{ width: 170 }} />{/* opti'lex */}
              <col style={{ width: 108 }} />{/* onboarding */}
              <col style={{ width: 108 }} />{/* lancement */}
              <col style={{ width: 120 }} />{/* facturation */}
              <col style={{ width: 44 }} />{/* chevron */}
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>Météo</th>
                <th style={th}>État</th>
                <th style={th}>Contrat Owner</th>
                <th style={th}>Contrat Opti'Lex</th>
                <th style={th}>Onboarding</th>
                <th style={th}>Intégration</th>
                <th style={th}>Facturation</th>
                <th style={th}></th>
              </tr>
            </thead>
            {/* key = onglet primaire : remount + plein stagger au changement d'onglet uniquement.
                Recherche/multi-filtre/polling : DOM stable, seules les lignes NOUVELLES s'animent. */}
            <tbody key={etatFilter}>
              {filtered.map((r) => {
                const key = rowKey(r);
                const isSel = selected === key;
                const newIdx = newIdxByKey.get(key);   // undefined = déjà vue -> pas d'animation
                return (
                  <tr key={key} onClick={() => setSelected(key)}
                    style={{ cursor: "pointer", background: isSel ? "#eff3fb" : "transparent",
                      ...(newIdx !== undefined ? { animation: "obRowIn 0.28s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${Math.min(newIdx, 14) * 20}ms` } : {}) }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#f7f8fa"; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Avatar name={primaryName(r)} n={r.sheet_num} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={primaryName(r)}>{primaryName(r)}</div>
                            {isInactif(r) && (
                              <span title="Aucune mission suivie par le cabinet depuis 60 jours"
                                style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fff3e3", padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                                Inactif{r.days_since_last_mission != null ? ` · ${r.days_since_last_mission} j` : ""}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowSubtitle(r) || "en cours d'envoi"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <MeteoPicker score={r.meteo_score} disabled={!r.numero_client || !meteoSettable()}
                        onSave={(sc, note) => recordMeteo(r.numero_client, sc, note)} />
                    </td>
                    {/* État daté (Résiliation, Pause…) posé depuis la table -> on ouvre la fiche
                        pour saisir la date dans la foulée. + rappel sous le badge si la pause est
                        échue ou si la date d'effet manque. */}
                    <td style={td}>
                      <EtatPicker etat={displayEtat(r)} disabled={!r.numero_client}
                        onPick={(v) => { changeEtat(r.numero_client, { etat: v }); if (ETAT_DATE_CONFIG[v]) setSelected(key); }} />
                      {(() => {
                        const h = etatHint(r);
                        return h ? (
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: h.urgent ? "#b45309" : "#a3a9b6", marginTop: 3 }}>{h.text}</div>
                        ) : null;
                      })()}
                    </td>
                    <td style={td}><SigCell status={r.owner_status} sentAt={r.owner_sent_at} signedAt={r.owner_signed_at} /></td>
                    <td style={td}><SigCell status={r.optilex_status} sentAt={r.optilex_sent_at} signedAt={r.optilex_signed_at} scheduledAt={r.optilex_scheduled_at} grouped={r.owner_status === "done" && r.optilex_status == null} /></td>
                    <td style={{ ...td, color: r.rdv_onboarding_date ? TEXT : "#cbd2e0" }}>{fmt(r.rdv_onboarding_date) || "—"}</td>
                    <td style={{ ...td, color: r.rdv_lancement_date ? TEXT : "#cbd2e0" }}>
                      {fmt(r.rdv_lancement_date) || "—"}
                      {integrationAlert(r) && <div><OptilexAlertBadge compact /></div>}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <MiniDot label="O" on={r.facturation_honoraires_done} />
                        <MiniDot label="OL" on={r.setup_facturation_done} />
                        <MiniDot label="+2M" on={r.rdv_plus1mois_done} />
                      </div>
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
              })}
              {filtered.length === 0 && (
                <tr style={{ animation: "obRowIn 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
                  <td colSpan={9} style={{ ...td, textAlign: "center", padding: "52px 0" }}>
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
        )}
      </div>

      <AnimatePresence>
        {selRow && <DetailPanel key="detail" row={selRow} onClose={() => setSelected(null)} patch={patch} changeEtat={changeEtat} etatHistVersion={etatHistVersion} recordMeteo={recordMeteo} meteoHistVersion={meteoHistVersion} />}
      </AnimatePresence>
    </div>
  );
}

function MiniDot({ label, on }) {
  return (
    <span title={label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, height: 20, padding: "0 5px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: on ? "#e9f9f0" : "#eef1f6", color: on ? GREEN : "#b6bdc9" }}>{label}</span>
  );
}

// Alerte : RDV d'intégration à venir mais contrat Opti'Lex non signé. Disparaît dès signature.
function OptilexAlertBadge({ compact }) {
  return (
    <span title="RDV d'intégration à venir, mais le contrat Opti'Lex n'est pas signé"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 10, background: "#fff3e3", color: "#b45309", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      {compact ? "Opti'Lex non signé" : "Contrat Opti'Lex non signé"}
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

// Bloc "Informations client" éditable : affiche override ?? original ; l'édition écrit la
// couche cabinet (optilex_client_tracking) SANS toucher client_data (antériorité Owner préservée).
const INFO_FIELDS = [
  { ovr: "contact_name_ovr", orig: "contact_name", label: "Nom du client" },
  { ovr: "tranche_ovr", orig: "contact_tranche", label: "Tranche salariale" },
  { ovr: "email_ovr", orig: "email", label: "Email" },
  { ovr: "phone_ovr", orig: "contact_phone", label: "Téléphone" },
  { ovr: "siren_ovr", orig: "siren", label: "SIREN" },
];
function ClientInfoSection({ row, num, patch }) {
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
        {num && !editing && (
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
          <InfoField label="Email" value={ov(row, "email_ovr", "email")} />
          <InfoField label="Téléphone" value={ov(row, "phone_ovr", "contact_phone")} />
          <InfoField label="SIREN" value={ov(row, "siren_ovr", "siren")} />
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

// Ligne RDV : date (planifiée ou saisie manuellement) + toggle "effectué" + lien (optionnel).
// onDate présent -> crayon pour saisir/modifier la date à la main (antériorité).
function RdvRow({ label, date, done, editable, onToggle, link, onDate }) {
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
            <div style={{ fontSize: 14, fontWeight: 700, color: date ? TEXT : "#cbd2e0" }}>{fmt(date) || "—"}</div>
            {onDate && (
              <button type="button" onClick={() => setEditing(true)} title="Saisir/modifier la date"
                style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", color: MUTED, display: "inline-flex", lineHeight: 0 }}>
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {link && <RdvLink url={link} />}
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

// Enveloppe email qui gigote de droite à gauche (attire l'œil sur "Relancer").
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: "mailWiggle 0.9s ease-in-out infinite" }}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// Lien de signature Opti'Lex (copier) + relance native Yousign (double-clic de confirmation).
function OptilexSignatureBlock({ email }) {
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
  }, [email]);

  const link = data?.signature_link;
  const canRemind = data?.can_remind;

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
            Rappel Yousign à <strong style={{ color: TEXT }}>{data.recipient || email}</strong>
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
      {!canRemind && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Rappel indisponible (statut : {data.signer_status || data.optilex_status || "—"}).</div>}
    </div>
  );
}

// ── PANNEAU DÉTAILS (slide-in droite, façon Notion) ──────────────────────────
// Rangée date labellisée. COMMIT AU BLUR (pas à chaque frappe) : un input date natif émet un
// change par segment valide -> une année en cours de saisie ("0002") partirait en base ET dans
// l'historique d'audit. Enter = valider, Escape = annuler. key force la resynchro si la valeur
// change de l'extérieur (optimiste / polling).
function DateRow({ label, value, onChange }) {
  const cancelRef = useRef(false);
  const committed = toDateInput(value);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
      <input key={committed} type="date" defaultValue={committed}
        onBlur={(e) => {
          if (cancelRef.current) { cancelRef.current = false; return; }
          const v = e.target.value || null;
          if (v !== (committed || null)) onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { cancelRef.current = true; e.currentTarget.value = committed; e.currentTarget.blur(); }
        }}
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

// Bloc "État du client" (détail, sous le SIREN) : sélecteur d'état + date(s) selon l'état
// (fiscaliste), révélation animée. Toute pose passe par changeEtat -> trace l'historique.
function EtatSection({ row, num, changeEtat }) {
  const etat = displayEtat(row);
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
    <div style={{ marginBottom: 22 }}>
      <SecTitle icon="etat">État du client</SecTitle>
      <EtatPicker etat={etat} disabled={!num} onPick={(v) => changeEtat(num, { etat: v })} />
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
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
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
                {h.created_by ? `${String(h.created_by).split("@")[0]} · ` : ""}{timeAgo(h.created_at)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
    </motion.div>
  );
}

function DetailPanel({ row, onClose, patch, changeEtat, etatHistVersion, recordMeteo, meteoHistVersion }) {
  const num = row.numero_client;
  const sigBlock = (title, status, sentAt, signedAt, scheduledAt, grouped) => {
    const i = sigInfo(status, sentAt, signedAt, scheduledAt);
    return (
      <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fafbfc" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{title}</div>
        {i ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: i.color }}>{i.icon} {i.label}</div>
            {sentAt && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Envoyé le {fmt(sentAt)}</div>}
            {scheduledAt && status === "scheduled" && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Planifié le {fmt(scheduledAt)}</div>}
            {signedAt && <div style={{ fontSize: 12, color: GREEN, marginTop: 3 }}>Signé le {fmt(signedAt)}</div>}
          </>
        ) : grouped ? (
          // Contrat groupé : pas de volet Opti'Lex séparé, il est inclus dans l'Owner signé.
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>✓ Signé</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Inclus au contrat Owner</div>
          </>
        ) : <div style={{ fontSize: 13, color: "#cbd2e0" }}>—</div>}
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
  const hasOptilexTrack = row.optilex_status != null || !!row.optilex_welcome_email_at || !!row.optilex_livret_email_at;
  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 9998 }} />
      <motion.div
        initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        exit={{ x: 56, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: 460, maxWidth: "94vw", background: CARD, zIndex: 9999, boxShadow: "-12px 0 40px rgba(0,0,0,0.12)", overflowY: "auto", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, background: CARD, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Avatar name={primaryName(row)} n={row.sheet_num} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{primaryName(row)}</div>
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
          {/* Sections en révélation douce (stagger léger, une seule fois à l'ouverture). */}
          {/* Informations client (override cabinet ?? original Owner, antériorité préservée) */}
          <div className="ob-sec" style={{ animationDelay: "0.05s" }}>
            <ClientInfoSection row={row} num={num} patch={patch} />
          </div>

          {/* Météo client : note courante + saisie (score + note d'interaction) + historique */}
          {row.numero_client && (
            <div className="ob-sec" style={{ animationDelay: "0.075s" }}>
              <SecTitle icon="meteo">Météo client</SecTitle>
              <MeteoSection row={row} num={num} recordMeteo={recordMeteo} version={meteoHistVersion} />
            </div>
          )}

          {/* État du client (éditable, sous le SIREN) + dates fiscalistes + historique */}
          <div className="ob-sec" style={{ animationDelay: "0.1s" }}>
            <EtatSection row={row} num={num} changeEtat={changeEtat} />
            <EtatHistory num={num} version={etatHistVersion} />
          </div>

          {/* Signatures */}
          <div className="ob-sec" style={{ animationDelay: "0.15s" }}>
          <SecTitle icon="contrats">Contrats</SecTitle>
          {integrationAlert(row) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid #f5deba", background: "#fff8ec", marginBottom: 12, fontSize: 12.5, fontWeight: 600, color: "#b45309" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              RDV d'intégration à venir, mais le contrat Opti'Lex n'est pas encore signé.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            {sigBlock("Owner", row.owner_status, row.owner_sent_at, row.owner_signed_at)}
            {sigBlock("Opti'Lex", row.optilex_status, row.optilex_sent_at, row.optilex_signed_at, row.optilex_scheduled_at, row.owner_status === "done" && row.optilex_status == null)}
          </div>

          {/* Lien de signature Opti'Lex + relance (uniquement si le contrat est envoyé) */}
          {row.optilex_status === "ongoing" && (
            <>
              <SecTitle icon="signature">Signature Opti'Lex</SecTitle>
              <div style={{ marginBottom: 22 }}><OptilexSignatureBlock email={row.email} /></div>
            </>
          )}

          {/* Parcours des 2 emails Opti'Lex automatisés (accueil à l'envoi du contrat,
              livret à la signature). Enveloppe grise = pas encore parti, verte = envoyé + date. */}
          {hasOptilexTrack && (
            <>
              <SecTitle icon="emails">Emails Opti'Lex</SecTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {emailStep("1er email · Accueil", "À l'envoi du contrat Opti'Lex", row.optilex_welcome_email_at)}
                {emailStep("2ème email · Livret", "À la signature du contrat", row.optilex_livret_email_at)}
              </div>
            </>
          )}

          {/* Activité mission : client cabinet sans mission suivie depuis 60 j (churn silencieux). */}
          {isInactif(row) && (
            <>
              <SecTitle icon="activity">Activité mission</SecTitle>
              <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #f5deba", background: "#fff8ec", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: "#b45309" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Client inactif côté cabinet
                </div>
                <div style={{ fontSize: 12.5, color: "#8a6a35", marginTop: 5, lineHeight: 1.5 }}>
                  {row.last_mission_at
                    ? <>Dernière activité mission le <strong>{fmt(row.last_mission_at)}</strong>{row.days_since_last_mission != null ? <> ({row.days_since_last_mission} jours)</> : null}.</>
                    : <>Aucune mission suivie par le cabinet à ce jour.</>}
                  {row.mission_count_total != null && <> {row.mission_count_total} mission{row.mission_count_total > 1 ? "s" : ""} au total.</>}
                </div>
              </div>
            </>
          )}
          </div>

          {/* RDV + statut "effectué" */}
          <div className="ob-sec" style={{ animationDelay: "0.2s" }}>
          <SecTitle icon="rdv">Rendez-vous</SecTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <RdvRow label="Rendez-vous Onboarding Owner" date={row.rdv_onboarding_date} done={row.rdv_onboarding_done} editable={!!num}
              onToggle={(v) => patch(num, { rdv_onboarding_done: v })} />
            <RdvRow label="Rendez-vous Intégration Opti'Lex" date={row.rdv_lancement_date} done={row.rdv_lancement_done} editable={!!num}
              onToggle={(v) => patch(num, { rdv_lancement_done: v })} />
            <RdvRow label="Rendez-vous lancement fiscal" date={row.rdv_fiscal_date_manual || row.rdv_fiscal_date} done={row.rdv_fiscal_done} editable={!!num && !!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date)}
              link={!(row.rdv_fiscal_date_manual || row.rdv_fiscal_date) && row.fiscal_url ? row.fiscal_url : null}
              onDate={num ? (d) => patch(num, { rdv_fiscal_date_manual: d }) : undefined}
              onToggle={(v) => patch(num, { rdv_fiscal_done: v })} />
            <RdvRow label="Rendez-vous lancement social" date={row.rdv_social_date_manual || row.rdv_social_date} done={row.rdv_social_done} editable={!!num && !!(row.rdv_social_date_manual || row.rdv_social_date)}
              link={!(row.rdv_social_date_manual || row.rdv_social_date) && row.social_url ? row.social_url : null}
              onDate={num ? (d) => patch(num, { rdv_social_date_manual: d }) : undefined}
              onToggle={(v) => patch(num, { rdv_social_done: v })} />
          </div>
          </div>

          {/* Jalons éditables (indisponibles tant que le client n'est pas établi) */}
          <div className="ob-sec" style={{ animationDelay: "0.25s" }}>
          {num ? (
            <>
              <SecTitle icon="facturation">Suivi facturation</SecTitle>
              <JalonRow label="Statut facturation Owner" done={row.facturation_honoraires_done} date={row.facturation_honoraires_date}
                onToggle={(v) => patch(num, { facturation_honoraires_done: v })} onDate={(d) => patch(num, { facturation_honoraires_date: d })} />
              <JalonRow label="Statut facturation Opti'Lex" done={row.setup_facturation_done} date={row.setup_facturation_date}
                onToggle={(v) => patch(num, { setup_facturation_done: v })} onDate={(d) => patch(num, { setup_facturation_date: d })} />
              {/* RDV +2 mois : RdvRow avec LIEN de prise de RDV (30 min avec Lisa Gentaire).
                  Date affichée = manuelle (rdv_plus1mois_date, prime) sinon date réservée par
                  le client (rdv_plus2mois_date, via le booking). Lien copiable tant qu'aucune
                  date n'est posée. Toggle À venir/Effectué conservé (planifiable avant). */}
              <RdvRow label="RDV +2 mois" date={row.rdv_plus1mois_date || row.rdv_plus2mois_date} done={row.rdv_plus1mois_done} editable={!!num}
                link={!(row.rdv_plus1mois_date || row.rdv_plus2mois_date) && row.plus2mois_url ? row.plus2mois_url : null}
                onDate={num ? (d) => patch(num, { rdv_plus1mois_date: d }) : undefined}
                onToggle={(v) => patch(num, { rdv_plus1mois_done: v })} />

              {/* Commentaires (fil façon YouTube) */}
              <SecTitle icon="comments" style={{ margin: "22px 0 12px" }}>Commentaires{row.comment_count ? ` · ${row.comment_count}` : ""}</SecTitle>
              <CommentThread numero={num} />
            </>
          ) : (
            <div style={{ padding: "14px 16px", borderRadius: 10, border: `1px dashed ${BORDER}`, background: "#fafbfc", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              Contrat en cours d'envoi. Le suivi facturation et les commentaires seront disponibles une fois la vente déclarée (client rattaché).
            </div>
          )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// alwaysDate : la date est TOUJOURS saisissable (RDV à planifier), pas seulement une
// fois "effectué". Sinon (statut fait/pas-fait), la date se révèle au passage à Oui.
function JalonRow({ label, done, date, onToggle, onDate, alwaysDate = false, toggleLabels }) {
  const showDate = alwaysDate || done;
  const dateLabel = alwaysDate ? "Date prévue" : null;
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{label}</div>
        <StatusToggle value={!!done} onChange={onToggle} labels={toggleLabels} />
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
// uniquement pour l'instant : score + note d'interaction), et historique des notations.
function MeteoSection({ row, num, recordMeteo, version }) {
  const [hist, setHist] = useState([]);
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const settable = meteoSettable();
  useEffect(() => {
    let alive = true;
    setSel(null); setNote("");
    apiClient.get(`/api/v1/optilex/meteo-history?numero_client=${encodeURIComponent(num)}`)
      .then((r) => { if (alive) setHist(r.history || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [num, version]);
  const current = hist[0] || (row.meteo_score != null
    ? { score: row.meteo_score, note: row.meteo_note, author_name: row.meteo_by, created_at: row.meteo_at }
    : null);
  const save = async () => {
    if (!sel || saving) return;
    setSaving(true);
    try { await recordMeteo(num, sel, note.trim() || null); setSel(null); setNote(""); }
    finally { setSaving(false); }
  };
  return (
    <div>
      {/* Météo courante */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: settable ? 16 : (hist.length ? 16 : 4) }}>
        <MeteoBadge score={current ? current.score : null} />
        {current
          ? <span style={{ fontSize: 12, color: MUTED }}>dernière notation{current.author_name ? ` par ${current.author_name}` : ""} · {timeAgo(current.created_at)}</span>
          : <span style={{ fontSize: 12.5, color: "#b6bdc9" }}>Aucune notation pour l'instant.</span>}
      </div>

      {/* Saisie (Owner uniquement pour l'instant) */}
      {settable && (
        <div style={{ background: "#f7f8fa", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: hist.length ? 18 : 4 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const st = METEO_BANDS[meteoBandOf(n)];
              const on = sel === n;
              return (
                <button key={n} type="button" onClick={() => setSel(n)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: on ? `2px solid ${st.color}` : `1px solid ${BORDER}`, background: on ? st.bg : CARD, color: on ? st.color : TEXT, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <MeteoIcon score={n} size={19} color={on ? st.color : "#9aa0ab"} />{n}</button>
              );
            })}
          </div>
          {sel && (
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10, lineHeight: 1.45 }}>
              <span style={{ fontWeight: 700, color: METEO_BANDS[meteoBandOf(sel)].color }}>{METEO_MEANING[sel].txt}.</span>
              {METEO_MEANING[sel].action ? ` → ${METEO_MEANING[sel].action}` : ""}
            </div>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note d'interaction (optionnel)…" rows={2}
            style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button type="button" onClick={save} disabled={!sel || saving}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: sel ? NAVY : "#e5e7eb", color: sel ? "#fff" : MUTED, fontSize: 13, fontWeight: 600, cursor: sel && !saving ? "pointer" : "default", fontFamily: "inherit" }}>{saving ? "…" : "Enregistrer la note"}</button>
          </div>
        </div>
      )}

      {/* Historique des notations (plus récent d'abord) */}
      {hist.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Historique des notations</div>
          <AnimatePresence initial={false}>
            {hist.map((h) => {
              const st = meteoStyle(h.score) || { bg: "#eef1f6", color: MUTED };
              return (
                <motion.div key={h.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: st.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MeteoIcon score={h.score} size={15} color={st.color} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{h.author_name || h.author_email || "—"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>Note {h.score}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(h.created_at)}</span>
                    </div>
                    {h.note && <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{h.note}</div>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function CommentThread({ numero }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const meName = me.name || me.full_name || me.first_name || me.email || "Moi";
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    setComments([]); setExpanded(false);
    apiClient.get(`/api/v1/optilex/comments?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setComments(r.comments || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [numero]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await apiClient.post("/api/v1/optilex/comments", { numero_client: numero, body });
      setComments((prev) => [created, ...prev]);
      setDraft("");
    } catch (e) { console.error("comment failed", e); }
    finally { setPosting(false); }
  };

  const shown = expanded ? comments : comments.slice(0, 3);

  return (
    <div>
      {/* Nouveau commentaire */}
      <div style={{ display: "flex", gap: 10, marginBottom: comments.length ? 18 : 4 }}>
        <Avatar name={meName} src={me.avatar_url} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder="Ajouter un commentaire…" rows={2}
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

      {/* Fil */}
      <AnimatePresence initial={false}>
        {shown.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Avatar name={c.author_name || c.author_email} size={32} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{c.author_name || c.author_email || "—"}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{timeAgo(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {comments.length > 3 && (
        <button onClick={() => setExpanded((v) => !v)}
          style={{ border: "none", background: "transparent", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "2px 0", fontFamily: "inherit" }}>
          {expanded ? "Voir moins" : `Voir plus (${comments.length - 3})`}
        </button>
      )}
      {comments.length === 0 && <div style={{ fontSize: 13, color: "#cbd2e0", marginTop: 6 }}>Aucun commentaire pour l'instant.</div>}
    </div>
  );
}
