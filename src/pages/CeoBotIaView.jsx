// src/pages/CeoBotIaView.jsx

/**
 * @file CeoBotIaView.jsx
 * @brief Route /ceo/Sub-Tickets — onglet « Sub Tickets » de la section ACQUISITION.
 *
 * @note Reprend le shell CEO standard (Sidebar + SharedNavbar, même pattern
 * que CeoLeadQualityView / CeoPerfSalesView) et présente une interface de
 * CONVERSATION : fil de messages + composer identique à celui du dashboard
 * CEO (carte arrondie 22px, « + » à gauche, pastille de modèle et flèche
 * d'envoi à droite). Pas de bouton « Enregistrer », pas de confirmation de
 * sauvegarde : on soumet un ticket, point.
 *
 * @note Volontairement SANS entrée audio (le micro du composer du dashboard
 * n'est pas repris) tant que la fonction n'existe pas.
 *
 * @note Le modèle est branché : Claude Opus 5 en effort « medium », appelé
 * par la fonction serveur /api/bot-ia/chat (api/bot-ia/chat.mjs). La clé
 * API ne descend jamais jusqu'ici — le navigateur ne voit qu'un flux de texte.
 *
 * @note Rendu des réponses : le texte arrive réellement au fil de l'eau
 * (flux SSE) et s'écrit de gauche à droite. Les fragments sont accumulés
 * dans un tampon puis posés une fois par image (requestAnimationFrame) —
 * sans ça, une longue réponse déclencherait un rendu React par fragment
 * reçu. Passé un certain volume, la réponse défile dans sa propre zone
 * (drapeau `m.long`) — sans cadre, un simple liseré à gauche — pour ne pas
 * repousser le fil.
 *
 * @warning Chaque ticket envoyé est enregistré via apiClient dans la table
 * dédiée `bot_ia_prompts` (POST /api/v1/bot-ia-prompts) : l'auteur (id,
 * e-mail, rôle) y est recopié du jeton côté serveur, le front n'a rien à
 * déclarer. Le bouton « Archives » relit ces tickets (GET, même route).
 *
 * @warning Accès NOMINATIF : seuls les emails de ITEM_EMAIL_GATE.bot_ia
 * (sidebarPermissions.js) voient l'onglet et peuvent ouvrir la route. La
 * garde qui fait foi reste celle du backend — ceci n'est que du confort UI.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections, canSeeGatedItem } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";
import companyLogo from "../assets/my_image.png";
import { formatEur } from "../utils/botIaBilling";
import { BOT_IA_BUDGET_EUR } from "../config/botIaAccess.js";
import {
  suggestMentions, parseMention, expandMention, mentionRefusal,
} from "../config/botIaMentions.js";

// Typographie de la zone de saisie. Extraite en constante parce qu'elle est
// utilisée DEUX fois : par le textarea, et par le calque qui le double pour
// griser la mention. Le moindre écart entre les deux décalerait le texte
// affiché par rapport au curseur.
const TA_TYPO = {
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: "inherit",
  padding: "6px 2px",
  letterSpacing: "normal",
};

/** @brief Mention en tête de saisie, avec ses bornes — sert au calque et au menu. */
const LEADING_TOKEN_RE = /^(\s*)@([A-Za-z0-9/_-]*)/;

/** @brief Hauteur d'une ligne d'archives, en px — sert au calcul des lignes visibles. */
const ARCHIVES_ROW_H = 52;
/** @brief Nombre de lignes d'archives visibles avant défilement. */
const ARCHIVES_VISIBLE_ROWS = 7;

/**
 * @brief Écrit `text` de gauche à droite à son apparition (effet machine à écrire).
 * @param text Texte complet à révéler progressivement.
 * @param speed Vitesse en caractères par seconde (défaut 20).
 * @param style Style CSS appliqué au `<span>` de sortie.
 * @note Même principe que l'écriture des réponses, en miniature — les
 * coûts s'affichent donc du même geste que le reste.
 */
function TypedText({ text, speed = 20, style }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf;
    const duration = (text.length / speed) * 1000;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.floor(text.length * t));
      if (t < 1) raf = requestAnimationFrame(step);
      else setShown(text.length);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, speed]);
  return <span style={style}>{text.slice(0, shown)}</span>;
}

/**
 * @brief Clé localStorage du ticket en cours de suivi.
 * @note Sert à survivre à un rechargement de page : en dev, une écriture de
 * fichier pendant le traitement fait recharger Vite (HMR) et vide l'état
 * React ; grâce à ce marqueur, la page retrouve le ticket au chargement et
 * reprend le suivi (cf. `beginWait`).
 */
const PENDING_KEY = "botIaPending";
function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch { return null; }
}
function writePending(v) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}
function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* stockage indisponible */ }
}

/**
 * @brief Clé localStorage des tickets masqués (visuel seulement) des archives, par personne.
 * @param email Email de l'utilisateur connecté.
 */
function hiddenArchivesKey(email) {
  return `botIaArchivesHidden_${String(email || "").trim().toLowerCase()}`;
}
function readHiddenArchives(email) {
  try { return new Set(JSON.parse(localStorage.getItem(hiddenArchivesKey(email)) || "[]")); }
  catch { return new Set(); }
}
function writeHiddenArchives(email, ids) {
  try { localStorage.setItem(hiddenArchivesKey(email), JSON.stringify([...ids])); }
  catch { /* stockage indisponible */ }
}

/**
 * @brief Couleur/label de la LED d'un ticket d'archives, à partir de son `statut`.
 * @param statut Colonne `statut` de la ligne (`en_attente` | `en_cours` | `traite`, ou autre).
 * @returns `{ color, pulse, label }` — `pulse` anime la LED pour signaler un traitement en cours.
 * @note `en_attente` et `en_cours` partagent l'orange (rien n'est fini) ; seul `en_cours`
 * pulse, pour distinguer « en file » de « en train d'être traité » sans ajouter de couleur.
 * Toute valeur hors des trois statuts documentés (`instruction_file_dattente.md` §2) est
 * traitée comme un refus — cas volontairement rare, aucun ticket n'y arrive aujourd'hui.
 */
function archiveStatutLed(statut) {
  if (statut === "traite") return { color: "#16a34a", pulse: false, label: "Traité" };
  if (statut === "en_cours") return { color: "#f59e0b", pulse: true, label: "Traitement en cours" };
  if (statut === "en_attente" || !statut) return { color: "#f59e0b", pulse: false, label: "En attente" };
  return { color: "#ef4444", pulse: false, label: "Refusé" };
}

/** @brief Un ticket ne peut être masqué (visuel) que s'il n'est plus en file active. */
function isArchiveHideable(statut) {
  return statut !== "en_attente" && statut !== "en_cours";
}

export default function CeoBotIaView() {
  const navigate = useNavigate();

  // ── Dark mode (même mécanique que les autres vues /ceo/*) ──────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "darkMode") setDarkMode(e.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((prev) => (prev !== isDark ? isDark : prev));
    }, 500);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);
  // Cette vue ne faisait que LIRE la classe dark-mode (via le polling
  // ci-dessus) sans jamais l'écrire : le toggle du SharedNavbar appelait
  // seulement setDarkMode local, écrasé 500ms plus tard par le poll qui
  // relit un <body> jamais modifié. On applique donc nous-mêmes le
  // changement (même pattern que Marketing/index.jsx, TrackingSheet.jsx…).
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  // ── Sidebar repliée / dépliée (état partagé avec le reste du shell) ────
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => {
    localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed));
  }, [sideCollapsed]);

  // ── Garde d'accès ──────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  /**
   * @warning Accès nominatif : même liste que le gate de la sidebar, pas de
   * bypass admin. Quiconque ouvre l'URL sans y avoir droit repart sur l'accueil.
   */
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || !canSeeGatedItem("bot_ia")) {
      navigate("/");
      return;
    }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  const handleSidebarTabClick = (tabId) => {
    if (tabId === "bot_ia") return;
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "sales_recordings") { navigate("/ceo/sales-recordings"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === "optilex_board") { navigate("/ceo/optilex-board"); return; }
    if (tabId === "leads_management") { navigate("/ceo/leads-management"); return; }
    navigateBackToDashboard(navigate, userRole, tabId);
  };

  // ── Conversation ───────────────────────────────────────────────────────
  /**
   * @brief Fil de la conversation.
   * @note Forme de chaque élément : `{ id, role: "user"|"bot", content,
   * thinking?, streaming?, long?, failed?, truncated?, costEur? }`.
   */
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  /**
   * @brief Solde réel du budget commun, en euros.
   * @note Vient TOUJOURS du serveur, qui le recalcule depuis la somme des
   * dépenses enregistrées — jamais décrémenté de mémoire, sinon il
   * dériverait d'un onglet à l'autre.
   */
  const [balanceEur, setBalanceEur] = useState(null);
  const [budgetInfo, setBudgetInfo] = useState(null);
  /** @brief Archives : les tickets déjà envoyés, relus à la demande. */
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [archives, setArchives] = useState(null);   // null = pas encore chargé
  const [archivesError, setArchivesError] = useState(null);
  // Statut réel par ticket d'archives, complété à part (cf. fetchArchiveStatuts).
  const [archiveStatutById, setArchiveStatutById] = useState({});
  // Tickets masqués (visuel seulement, par personne) : cf. hiddenArchivesKey.
  const [hiddenArchiveIds, setHiddenArchiveIds] = useState(() => new Set());
  // Change à chaque variation du solde : sert de `key` au compteur, ce qui
  // le remonte et relance la secousse même sur deux débits d'affilée.
  const [balancePulse, setBalancePulse] = useState(0);
  // On compare le TEXTE affiché, pas le nombre : une dépense inférieure au
  // centime ne change pas « 19,98 € », et secouer un compteur identique
  // donnerait l'impression d'un bug.
  const shownBalance = balanceEur === null ? null : formatEur(balanceEur);
  const lastShownRef = useRef(null);
  useEffect(() => {
    if (shownBalance === null) return;
    if (lastShownRef.current === null) { lastShownRef.current = shownBalance; return; }
    if (lastShownRef.current === shownBalance) return;
    lastShownRef.current = shownBalance;
    setBalancePulse((k) => k + 1);
  }, [shownBalance]);
  const taRef = useRef(null);
  const threadRef = useRef(null);
  const threadEndRef = useRef(null);
  const abortRef = useRef(null);
  // Minuteur du sondage de statut (setTimeout) : arrêté au démontage.
  const pollTimerRef = useRef(null);
  // Le cadre à défilement d'une éventuelle réponse longue.
  const longBlockRef = useRef(null);
  // Le fil ne recolle au bas que si l'utilisateur y est déjà : s'il est
  // remonté pour relire, on ne lui arrache pas sa position.
  const stickToBottomRef = useRef(true);

  // Un départ de page pendant l'attente ne doit pas laisser un sondage
  // tourner dans le vide.
  useEffect(() => () => {
    abortRef.current?.abort();
    clearTimeout(pollTimerRef.current);
  }, []);

  // ── Fenêtre « Gestion de séquence » — mockup additif, gris et vide ──────
  // Machine à états pour l'enchaînement animé :
  //   idle → shake → fall (composer+bouton tombent hors écran) →
  //   window-in (la fenêtre apparaît) → window-open (interactive,
  //   déplaçable) → window-closing (la fenêtre tombe) → return
  //   (composer+bouton reviennent du haut) → idle.
  const [seqPhase, setSeqPhase] = useState("idle");
  const [seqWinPos, setSeqWinPos] = useState(null); // { w, h } px, calculé à l'ouverture
  // Décalage de drag depuis la position centrée par défaut — (0,0) = centré.
  // Coordonnées RELATIVES (pas des px absolus de viewport) : le centrage
  // lui-même est fait en CSS pur (calc + transform), donc aucun calcul
  // manuel ne peut le désaligner.
  const [seqDrag, setSeqDrag] = useState({ x: 0, y: 0 });
  const seqTimersRef = useRef([]);
  const seqDragRef = useRef(null);

  const seqClearTimers = () => {
    seqTimersRef.current.forEach(clearTimeout);
    seqTimersRef.current = [];
  };
  const seqAfter = (ms, fn) => { seqTimersRef.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => seqClearTimers(), []);

  const SEQ_SHAKE_MS = 500;
  const SEQ_FALL_MS = 600;
  const SEQ_WINDOW_IN_MS = 220;
  const SEQ_RETURN_MS = 650;
  const SEQ_WIN_W = 880;
  const SEQ_WIN_H = 600;
  // Espace réservé à la navbar flottante (profil, pages, dark mode…) : même
  // valeur que le `paddingTop` du shell CEO, + marge demandée avant de la
  // toucher en drag.
  const SEQ_NAVBAR_SAFE_TOP = 64 + 0;

  const openSeqWindow = () => {
    if (seqPhase !== "idle") return;
    // Le champ pourrait être focus au clic : lui couper le clavier avant
    // que le tremblement ne commence, sinon on pourrait continuer à taper
    // dans une barre en train de tomber.
    taRef.current?.blur();
    seqClearTimers();
    setSeqPhase("shake");
    seqAfter(SEQ_SHAKE_MS, () => setSeqPhase("fall"));
    seqAfter(SEQ_SHAKE_MS + SEQ_FALL_MS, () => {
      const sidebarW = sideCollapsed ? 56 : 260;
      const availW = window.innerWidth - sidebarW;
      const w = Math.min(SEQ_WIN_W, availW - 48);
      const h = Math.min(SEQ_WIN_H, window.innerHeight - 96);
      setSeqWinPos({ w, h });
      setSeqDrag({ x: 0, y: 0 }); // repart toujours centrée, jamais l'ancien drag
      setSeqPhase("window-in");
    });
    seqAfter(SEQ_SHAKE_MS + SEQ_FALL_MS + SEQ_WINDOW_IN_MS, () => setSeqPhase("window-open"));
  };

  const closeSeqWindow = () => {
    if (seqPhase !== "window-open") return;
    seqClearTimers();
    setSeqPhase("window-closing");
    seqAfter(SEQ_FALL_MS, () => setSeqPhase("return"));
    seqAfter(SEQ_FALL_MS + SEQ_RETURN_MS, () => setSeqPhase("idle"));
  };

  // Drag de la fenêtre via sa barre supérieure — décalage RELATIF au centre
  // (cf. seqDrag), pas une position absolue : le centrage CSS reste la seule
  // source de vérité pour la position de repos.
  const onSeqHeaderMouseDown = (e) => {
    if (seqPhase !== "window-open") return;
    e.preventDefault();
    seqDragRef.current = { startX: e.clientX, startY: e.clientY, origX: seqDrag.x, origY: seqDrag.y };
    const onMove = (ev) => {
      if (!seqDragRef.current) return;
      const { startX, startY, origX, origY } = seqDragRef.current;
      // Le plafond vertical est calculé en absolu (position réelle à l'écran),
      // pas en simple décalage relatif : il s'arrête à SEQ_NAVBAR_SAFE_TOP du
      // haut du viewport, quelle que soit la hauteur de fenêtre/écran.
      const centeredTop = (window.innerHeight - seqWinPos.h) / 2;
      const minY = SEQ_NAVBAR_SAFE_TOP - centeredTop;
      const nextX = Math.max(-500, Math.min(origX + (ev.clientX - startX), 500));
      const nextY = Math.max(minY, Math.min(origY + (ev.clientY - startY), 320));
      setSeqDrag({ x: nextX, y: nextY });
    };
    const onUp = () => {
      seqDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Même chaîne d'animation tant que la fenêtre est visible (fall/window-in/
  // window-open/window-closing) : pas de redémarrage, le composer reste
  // simplement hors écran, figé sur l'état final de la chute.
  const seqRowAnim =
    seqPhase === "shake" ? "ceoBotIaShake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both"
      : (seqPhase === "fall" || seqPhase === "window-in" || seqPhase === "window-open" || seqPhase === "window-closing")
        ? "ceoBotIaFallOut 0.6s cubic-bezier(0.55,0,0.85,0.35) both"
        : seqPhase === "return" ? "ceoBotIaReturnDown 0.65s cubic-bezier(0.16,1,0.3,1) both"
          : "none";
  const seqRowInteractive = seqPhase === "idle";
  const seqWindowVisible = seqPhase === "window-in" || seqPhase === "window-open" || seqPhase === "window-closing";
  const seqWindowInteractive = seqPhase === "window-open";

  const canSend = text.trim().length > 0 && !sending;
  const isEmpty = messages.length === 0;
  // Archives affichées à cette personne = tout sauf ce qu'elle a masqué (visuel,
  // définitif côté UI : pas de réaffichage — cf. hideArchiveEntry).
  const visibleArchives = (archives || []).filter((row) => !hiddenArchiveIds.has(row.id));

  // ── Mentions de page (@Ambulancev1…) ───────────────────────────────────
  /**
   * @brief État du menu de suggestion de mentions de page.
   * @note Un ticket doit dire sur quelle page il porte. L'utilisateur tape
   * une mention, l'agent reçoit l'URL. Le menu s'ouvre VERS LE HAUT : le
   * composer est collé au bas de la fenêtre, une liste descendante
   * sortirait de l'écran.
   * @note `start`/`end` sont les bornes du jeton dans le texte : les garder
   * en état évite de refaire tourner la regex au moment de l'insertion,
   * donc évite qu'un texte modifié entre-temps fasse écrire au mauvais
   * endroit.
   */
  const [mentionMenu, setMentionMenu] = useState({
    open: false, items: [], index: 0, start: 0, end: 0,
  });
  const overlayRef = useRef(null);
  const closeMentionMenu = () => setMentionMenu((s) => (s.open ? { ...s, open: false } : s));

  /**
   * @brief Recalcule le menu de mentions à partir de la valeur ET de la position du curseur.
   * @param value Valeur actuelle du champ de saisie.
   * @param caret Position du curseur dans `value`.
   * @note Les deux sont passés explicitement : au moment du `onChange`,
   * l'état `text` porte encore la valeur précédente.
   * @note Le menu ne s'ouvre que sur la mention de TÊTE, seule position où
   * elle compte. Proposer une complétion au milieu d'une phrase apprendrait
   * un geste que l'envoi refuserait ensuite.
   */
  const refreshMentionMenu = (value, caret) => {
    const m = String(value ?? "").match(LEADING_TOKEN_RE);
    if (!m) return closeMentionMenu();

    const start = m[1].length;               // position du « @ »
    const end = start + 1 + m[2].length;     // fin du jeton
    const pos = typeof caret === "number" ? caret : end;
    if (pos < start + 1 || pos > end) return closeMentionMenu();

    const items = suggestMentions(m[2]);
    if (!items.length) return closeMentionMenu();

    setMentionMenu((s) => ({
      open: true,
      items,
      // On garde l'élément visé tant qu'il est encore proposé, sinon la
      // sélection sauterait à chaque lettre tapée.
      index: Math.max(0, items.findIndex((it) => it.key === s.items[s.index]?.key)),
      start,
      end,
    }));
  };

  /**
   * @brief Insère la mention choisie à la place du jeton en cours de frappe.
   * @param mention Entrée de BOT_IA_MENTIONS choisie dans le menu.
   */
  const applyMention = (mention) => {
    const { start, end } = mentionMenu;
    const after = text.slice(end).replace(/^[ \t]+/, "");
    const next = `${text.slice(0, start)}@${mention.label} ${after}`;
    const caret = start + 1 + mention.label.length + 1;
    setText(next);
    closeMentionMenu();
    // Après le rendu : sinon setSelectionRange porterait sur l'ancienne valeur.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  /**
   * @brief Découpe la saisie pour le calque de superposition : la mention d'un côté, le reste de l'autre.
   * @note Bleue et ouvrable au Ctrl/Cmd+clic quand la mention est
   * complètement reconnue (`resolved`), grisée quand elle est seulement en
   * cours de frappe (tant qu'une page correspond encore), rouge quand plus
   * aucune page ne peut correspondre — l'utilisateur voit le refus arriver
   * avant d'appuyer sur Entrée.
   */
  const mentionView = useMemo(() => {
    const m = text.match(LEADING_TOKEN_RE);
    if (!m) return null;
    const raw = `${m[1]}@${m[2]}`;
    const parsed = parseMention(text);
    return {
      raw,
      rest: text.slice(raw.length),
      tone: parsed.status === "ok" || suggestMentions(m[2]).length > 0 ? "known" : "unknown",
      // Mention complète, pas juste « ça y ressemble encore » — seul ce cas
      // est bleu/cliquable (cf. rendu du calque et onClick du textarea).
      resolved: parsed.status === "ok" ? parsed.mention : null,
    };
  }, [text]);

  /**
   * @brief Synchronise le défilement du calque de superposition sur celui du textarea.
   * @note Sans cette synchro, un long ticket ferait glisser le texte du
   * textarea sous une mention restée en place.
   */
  const syncOverlayScroll = () => {
    const ta = taRef.current;
    const ov = overlayRef.current;
    if (ta && ov) ov.scrollTop = ta.scrollTop;
  };

  /** @brief Va chercher l'état du budget de Sub Tickets auprès du serveur. */
  const refreshBudget = async () => {
    const token = apiClient.getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/bot-ia/chat", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || `Solde indisponible (HTTP ${res.status})`); return; }
      setBalanceEur(data.balance_eur);
      setBudgetInfo(data);
    } catch {
      setError("Solde indisponible : le serveur de la page ne répond pas.");
    }
  };

  // Le solde s'affiche dès l'ouverture, avant même la première question.
  useEffect(() => { if (authChecked) refreshBudget(); }, [authChecked]);

  /**
   * @brief Ouvre (ou referme) les archives des tickets déjà envoyés.
   * @note Recharge la liste à chaque ouverture — un ticket envoyé à
   * l'instant doit s'y retrouver.
   * @note La route ne rend QUE les tickets de l'appelant : c'est le serveur
   * qui filtre sur le jeton, le front n'a rien à demander.
   */
  const openArchives = async () => {
    if (archivesOpen) { setArchivesOpen(false); return; }
    setArchivesOpen(true);
    setArchivesError(null);
    setHiddenArchiveIds(readHiddenArchives(apiClient.getUser()?.email));
    try {
      const res = await apiClient.get("/api/v1/bot-ia-prompts?limit=50");
      // Forme confirmée le 2026-09-24 (diagnostic console) : `{ prompts: [...] }`.
      // On garde `data`/`items` en repli au cas où le backend change un jour.
      const rows = Array.isArray(res) ? res : (res?.prompts ?? res?.data ?? res?.items ?? []);
      setArchives(rows);
      fetchArchiveStatuts(rows);
    } catch (e) {
      setArchives([]);
      setArchivesError(e?.message || "Archives indisponibles");
    }
  };

  /**
   * @brief Complète chaque ticket d'archives avec son `statut` réel.
   * @param rows Lignes venant de `/api/v1/bot-ia-prompts` (sans `statut`).
   * @note `/api/v1/bot-ia-prompts` ne renvoie que `id`/`content`/`created_at`
   * (confirmé le 2026-09-24) : le statut vient séparément de
   * `/api/bot-ia/statut?id=…` — la même route déjà utilisée pour le suivi
   * live d'un ticket (lecture seule, jeton de l'appelant). Un ticket dont la
   * requête échoue reste simplement sans statut connu (LED orange par défaut).
   */
  const fetchArchiveStatuts = (rows) => {
    const token = apiClient.getToken();
    if (!token || !rows?.length) return;
    Promise.allSettled(
      rows.map((row) => fetch(`/api/bot-ia/statut?id=${encodeURIComponent(row.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)).then((d) => [row.id, d?.statut])),
    ).then((results) => {
      setArchiveStatutById((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled" && r.value?.[1]) next[r.value[0]] = r.value[1];
        }
        return next;
      });
    });
  };

  /**
   * @brief Masque un ticket des archives — visuel uniquement, par personne.
   * @param id Identifiant du ticket à masquer.
   * @warning N'écrit jamais en base : la ligne `bot_ia_prompts` n'est pas
   * touchée, seule la liste locale (localStorage) de ce qui reste affiché
   * change pour cette personne.
   */
  const hideArchiveEntry = (id) => {
    if (!id) return;
    const email = apiClient.getUser()?.email;
    setHiddenArchiveIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeHiddenArchives(email, next);
      return next;
    });
  };

  /** @brief Intervalle de sondage du statut d'un ticket, en millisecondes. */
  const POLL_MS = 3000;

  /**
   * @brief Sonde `/api/bot-ia/statut` jusqu'à ce que le ticket `promptId` passe en `traite`.
   * @param botId Identifiant de la bulle de réponse à faire évoluer.
   * @param promptId Identifiant du ticket suivi.
   * @param token Jeton d'authentification (optionnel — relu via `apiClient.getToken()` sinon).
   * @param page Page ciblée par le ticket (pour le lien affiché une fois traité).
   * @note Bascule la bulle `botId` sur « changement effectué » une fois
   * `traite`. Partagé entre l'envoi (`handleSend`) et la reprise après
   * rechargement.
   */
  const beginWait = (botId, promptId, token, page) => {
    const auth = token || apiClient.getToken();
    const cancelled = { v: false };
    abortRef.current = { abort: () => { cancelled.v = true; clearTimeout(pollTimerRef.current); } };
    const poll = async () => {
      if (cancelled.v) return;
      try {
        const res = await fetch(`/api/bot-ia/statut?id=${encodeURIComponent(promptId)}`, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.statut === "traite") {
          setMessages((prev) => prev.map((m) => (
            m.id === botId
              // `page` vient de la mention en tête du prompt. Le lien pointe
              // vers `previewUrl` quand une mention en définit un (aucune
              // aujourd'hui — mécanisme prévu pour une page pas encore
              // accessible à l'URL qu'elle transmet à l'agent), sinon vers
              // `url` — jamais l'inverse. Voir botIaMentions.js.
              ? { ...m, thinking: false, done: true, content: "✅ Changement effectué.", pageUrl: page?.previewUrl || page?.url, pageLabel: page?.label }
              : m
          )));
          setSending(false);
          clearPending();
          return;
        }
        // La demande n'existe plus (supprimée) : inutile d'attendre indéfiniment.
        if (res.status === 404) {
          setMessages((prev) => prev.map((m) => (
            m.id === botId ? { ...m, thinking: false, failed: true, content: "Demande introuvable." } : m
          )));
          setSending(false);
          clearPending();
          return;
        }
      } catch { /* réseau : on retente au tour suivant */ }
      if (!cancelled.v) pollTimerRef.current = setTimeout(poll, POLL_MS);
    };
    poll();
  };

  /**
   * @brief Reprise après un rechargement de page.
   * @note Si un ticket était en cours, on ré-affiche sa bulle et on reprend
   * le suivi là où il en était. En prod il n'y a pas de rechargement
   * intempestif ; en dev, c'est ce qui fait que « changement effectué »
   * s'affiche même si Vite a rechargé la page.
   */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!authChecked || resumedRef.current) return;
    const p = readPending();
    if (!p?.promptId) return;
    resumedRef.current = true;
    setMessages([
      { id: p.userId, role: "user", content: p.content },
      { id: p.botId, role: "bot", content: "", thinking: true },
    ]);
    setSending(true);
    // `p.content` porte encore « @Mention … » tel que tapé (writePending
    // l'enregistre avant expansion) : la mention s'y relit à l'identique.
    const resumedParsed = parseMention(p.content);
    beginWait(p.botId, p.promptId, undefined, resumedParsed.mention);
  }, [authChecked]);

  /**
   * @brief Envoie le ticket en cours de saisie.
   * @note On ne répond PAS soi-même : le ticket entre dans la file
   * d'attente (statut `en_attente`), la bulle affiche « traitement en
   * cours… », et on sonde la base jusqu'à ce que l'agent de traitement le
   * fasse passer en `traite` — alors seulement on affiche « changement
   * effectué ».
   */
  const handleSend = async () => {
    if (!canSend) return;
    const content = text.trim();

    // ── Barrage dur : pas de page désignée, pas de ticket ──────────────
    // Rien ne part : ni écriture dans la file `bot_ia_prompts`, ni requête à
    // l'agent. Le refus est rendu sur place — un silence laisserait croire à
    // une panne, et l'utilisateur ne saurait pas quoi corriger. Les seules
    // mentions acceptées sont celles de botIaMentions.js.
    const parsed = parseMention(content);
    if (parsed.status !== "ok") {
      const refusStamp = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: `u-${refusStamp}`, role: "user", content },
        { id: `b-${refusStamp}`, role: "bot", content: mentionRefusal(parsed), failed: true },
      ]);
      setText("");
      setError(null);
      closeMentionMenu();
      taRef.current?.focus();
      return;
    }

    // Ce que l'agent lira : la mention cède la place à l'URL de la page.
    // L'utilisateur, lui, garde « @Ambulancev1 » dans son fil.
    const agentContent = expandMention(content);

    const stamp = Date.now();
    const userId = `u-${stamp}`;
    const botId = `b-${stamp}`;

    // Le message part tout de suite dans le fil.
    setMessages((prev) => [...prev, { id: userId, role: "user", content }]);
    setText("");
    setError(null);
    setSending(true);
    closeMentionMenu();
    taRef.current?.focus();

    // Bulle « traitement en cours » (les …), maintenue tant que le ticket
    // n'est pas passé en `traite` dans la base.
    setMessages((prev) => [...prev, { id: botId, role: "bot", content: "", thinking: true }]);

    const token = apiClient.getToken();
    const fail = (msg) => {
      clearTimeout(pollTimerRef.current);
      setMessages((prev) => prev.map((m) => (
        m.id === botId ? { ...m, thinking: false, failed: true, content: msg } : m
      )));
      setSending(false);
    };

    // 1. Enregistrer le ticket : il entre dans la file en `en_attente`,
    //    son auteur étant recopié du jeton côté serveur.
    try {
      await apiClient.post("/api/v1/bot-ia-prompts", { content: agentContent, source: "bot_ia" });
    } catch (e) {
      return fail(`Demande non enregistrée : ${e?.message || e}`);
    }

    // 2. Récupérer l'id du ticket qu'on vient de créer (le plus récent).
    let promptId = null;
    try {
      const res = await fetch("/api/bot-ia/statut", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return fail("Session expirée. Reconnecte-toi.");
      if (res.ok && data?.id) promptId = data.id;
    } catch { /* traité juste en dessous */ }
    if (!promptId) {
      return fail("Demande enregistrée, mais le suivi du statut est indisponible.");
    }

    // 3. Mémoriser le ticket en cours (survit à un rechargement) puis sonder
    //    le statut jusqu'à `traite` — c'est l'agent de traitement qui fera
    //    basculer le statut dans la base.
    writePending({ userId, botId, promptId, content });
    beginWait(botId, promptId, token, parsed.mention);
  };

  // Auto-grow du textarea : la carte grandit avec le contenu, jusqu'à 260px.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [text]);

  // Le fil recolle au bas à chaque mise à jour — y compris à chaque tranche
  // écrite — sauf si l'utilisateur est remonté lire. On vise le bas du
  // CONTENEUR (donc le bas de la page, composer compris) et pas la fin du
  // texte : un pavé de plusieurs Mo tient dans son propre cadre.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    // Le bloc long, lui, ne bouge PAS : il se remplit depuis le haut et on
    // le lit à la molette. Le faire suivre le texte rendait la frappe
    // invisible.
  }, [messages, sending]);

  // Position de lecture : à moins de 90 px du bas, on considère que
  // l'utilisateur « suit » et on continue de le coller au bas.
  const handleThreadScroll = (e) => {
    const el = e.currentTarget;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  if (!authChecked) {
    return (
      <div style={{
        minHeight: "100vh",
        background: C.surface,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.muted, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        fontSize: 14,
      }}>
        Chargement…
      </div>
    );
  }

  return (
    <div
      className="ceo-page"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: C.surface,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      <style>{`
        .ceo-side { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
        .ceo-side-item { transition: background 0.12s ease; }
        .ceo-side-item:hover { background: ${darkMode ? "rgba(255,255,255,0.05)" : "#f5f5f4"}; }
        .ceo-icon-btn { transition: background 0.12s, color 0.12s; }
        .ceo-icon-btn:hover { background: ${darkMode ? "rgba(255,255,255,0.05)" : "#f5f5f4"}; }
        .ceo-side-scroll::-webkit-scrollbar { width: 10px; }
        .ceo-side-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .ceo-side-scroll:hover::-webkit-scrollbar-thumb { background: ${darkMode ? "rgba(255,255,255,0.18)" : "rgba(55,53,47,0.16)"}; background-clip: padding-box; }
        .ceo-side-scroll::-webkit-scrollbar-track { background: transparent; }
        .ceo-botia-ta::placeholder { color: ${C.muted}; }
        /* Le texte du champ est transparent : c'est le calque au-dessous qui
           l'affiche, mention grisée comprise. La sélection, elle, est peinte
           PAR le champ, au-dessus du calque — sans cette règle, sélectionner
           du texte le ferait disparaître. */
        .ceo-botia-ta::selection { color: ${C.text}; background: ${darkMode ? "rgba(61,79,242,0.45)" : "rgba(61,79,242,0.24)"}; }
        .ceo-botia-ta::-webkit-scrollbar { width: 8px; }
        .ceo-botia-long::-webkit-scrollbar { width: 8px; }
        .ceo-botia-long::-webkit-scrollbar-thumb { background: ${darkMode ? "rgba(255,255,255,0.16)" : "rgba(55,53,47,0.16)"}; border-radius: 4px; }
        .ceo-botia-archive-row .ceo-botia-archive-dismiss { opacity: 0; transition: opacity 0.12s; }
        .ceo-botia-archive-row:hover .ceo-botia-archive-dismiss { opacity: 1; }
        .ceo-botia-thread::-webkit-scrollbar { width: 8px; }
        .ceo-botia-thread::-webkit-scrollbar-thumb { background: ${darkMode ? "rgba(255,255,255,0.16)" : "rgba(55,53,47,0.16)"}; border-radius: 4px; }
        .ceo-botia-ta::-webkit-scrollbar-thumb { background: ${darkMode ? "rgba(255,255,255,0.16)" : "rgba(55,53,47,0.16)"}; border-radius: 4px; }
        @keyframes ceoBotIaIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes ceoBotIaSpin { to { transform: rotate(360deg); } }
        @keyframes ceoBotIaLedPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes ceoBotIaShake {
          0%   { transform: translateX(0)    scale(1);    }
          12%  { transform: translateX(-4px) scale(1.10); }
          26%  { transform: translateX(4px)  scale(1.10); }
          40%  { transform: translateX(-3px) scale(1.06); }
          54%  { transform: translateX(3px)  scale(1.04); }
          68%  { transform: translateX(-2px) scale(1.02); }
          82%  { transform: translateX(1px)  scale(1.01); }
          100% { transform: translateX(0)    scale(1);    }
        }
        @keyframes ceoBotIaDot { 0%, 60%, 100% { opacity: 0.25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        /* Fenêtre « Gestion de séquence » : chute (composer ET fenêtre à la
           fermeture, même vecteur) et retour du composer depuis le haut. */
        @keyframes ceoBotIaFallOut {
          0%   { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(160vh) rotate(5deg); }
        }
        @keyframes ceoBotIaReturnDown {
          0%   { transform: translateY(-160vh) rotate(-4deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes ceoBotIaWindowPop {
          0%   { opacity: 0; transform: scale(0.94) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* ═══ SIDEBAR ═══ */}
      <div style={{
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        display: "flex",
      }}>
        <Sidebar
          width={sideCollapsed ? 56 : 260}
          collapsed={sideCollapsed}
          onToggle={() => setSideCollapsed((v) => !v)}
          sections={visibleSections}
          activeTab="bot_ia"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      {/* ═══ ZONE PRINCIPALE ═══ */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: 64, display: "flex", flexDirection: "column" }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

        {/* ═══ FIL + COMPOSER ═══ */}
        {/* Vide : tout est centré verticalement (écran d'accueil). Dès le
            premier message : le fil occupe le haut, le composer se colle en
            bas — exactement le comportement d'une fenêtre de chat. */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: isEmpty ? "center" : "flex-end",
          padding: "0 32px",
        }}>

          {/* Écran d'accueil (avant le premier message) : volontairement nu —
              seul le composer, centré. Pas de titre. */}

          {/* ── Fil de conversation ── */}
          {!isEmpty && (
            <div className="ceo-botia-thread" ref={threadRef} onScroll={handleThreadScroll} style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              width: "100%",
              maxWidth: 640,
              margin: "0 auto",
              padding: "24px 0 12px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    animation: "ceoBotIaIn 0.28s cubic-bezier(0.16,1,0.3,1) both",
                  }}
                >
                  {m.role === "user" ? (
                    <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <div style={{
                        background: C.subtle,
                        border: `1px solid ${C.border}`,
                        borderRadius: 18,
                        padding: "10px 15px",
                        fontSize: 15,
                        lineHeight: 1.55,
                        color: C.text,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      maxWidth: "88%",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: m.thinking ? C.muted : m.failed ? "#ef4444" : m.done ? "#16a34a" : C.text,
                      fontStyle: m.failed ? "italic" : "normal",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {m.thinking ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <span style={{ display: "inline-flex", gap: 4 }}>
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: "currentColor",
                                  animation: `ceoBotIaDot 1.1s ${i * 0.16}s ease-in-out infinite`,
                                }}
                              />
                            ))}
                          </span>
                          <span style={{ fontSize: 14 }}>Traitement en cours…</span>
                        </span>
                      ) : m.long ? (
                        // Réponse longue : pas de cadre, juste un liseré à
                        // gauche qui marque le bloc, et la molette pour
                        // descendre. La hauteur est plafonnée pour ne pas
                        // noyer la page, mais assez généreuse pour lire
                        // confortablement sans relancer le défilement tous
                        // les trois mots.
                        <div
                          className="ceo-botia-long"
                          ref={m.streaming ? longBlockRef : undefined}
                          style={{
                            width: "100%",
                            maxHeight: "58vh",
                            overflowY: "auto",
                            overflowX: "hidden",
                            paddingLeft: 18,
                            paddingRight: 12,
                            // Relief : une arête nette, prolongée par une
                            // ombre douce qui décolle le texte du fond. Pas
                            // de cadre, juste ce repère sur la gauche.
                            boxShadow: `inset 2px 0 0 ${C.border}, inset 8px 0 10px -9px ${darkMode ? "rgba(0,0,0,0.9)" : "rgba(30,35,48,0.30)"}`,
                            fontSize: 15,
                            lineHeight: 1.65,
                            color: C.text,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overscrollBehavior: "contain",
                          }}
                        >
                          {m.content}
                        </div>
                      ) : (
                        m.content
                      )}
                      {m.truncated && (
                        <div style={{ marginTop: 6, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                          Réponse coupée : la limite de longueur a été atteinte.
                        </div>
                      )}
                      {/* Accès direct à la page modifiée : la même URL que
                          celle transmise à l'agent de traitement (mention en
                          tête du prompt), affichée dès que « traité ». */}
                      {m.done && m.pageUrl && (
                        <div style={{ marginTop: 6 }}>
                          <a
                            href={m.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#3d4ff2",
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                          >
                            {m.pageLabel ? `Voir @${m.pageLabel}` : "Voir la page"}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 17 17 7" />
                              <path d="M8 7h9v9" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
          )}

          {/* ── Composer (calqué sur celui du dashboard CEO) ── */}
          <div style={{
            width: "100%",
            maxWidth: 640,
            margin: "0 auto",
            paddingBottom: 28,
            animation: isEmpty ? "ceoBotIaIn 0.35s cubic-bezier(0.16,1,0.3,1) both" : "none",
          }}>
            {/* ── Archives : les tickets déjà envoyés ──
                Un panneau qui se glisse au-dessus du composer, dans le même
                langage visuel que la carte de saisie. On reste dans le fil,
                on ne bascule pas sur une autre vue. */}
            {archivesOpen && (
              <div style={{
                marginBottom: 10,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 18,
                overflow: "hidden",
                animation: "ceoBotIaIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px 10px 16px",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    Mes anciennes demandes
                  </span>
                  <button
                    type="button"
                    aria-label="Fermer les archives"
                    onClick={() => setArchivesOpen(false)}
                    style={{
                      width: 24, height: 24, borderRadius: 6, border: "none",
                      background: "transparent", cursor: "pointer", color: C.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="ceo-botia-long" style={{ maxHeight: ARCHIVES_ROW_H * ARCHIVES_VISIBLE_ROWS, overflowY: "auto", padding: "6px 0" }}>
                  {archivesError ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: "#ef4444" }}>{archivesError}</div>
                  ) : archives === null ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>Chargement…</div>
                  ) : visibleArchives.length === 0 ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>Aucune demande enregistrée pour l'instant.</div>
                  ) : visibleArchives.map((row) => {
                    const led = archiveStatutLed(archiveStatutById[row.id]);
                    const hideable = isArchiveHideable(archiveStatutById[row.id]);
                    return (
                      <div
                        key={row.id}
                        className="ceo-botia-archive-row"
                        style={{ display: "flex", alignItems: "center", height: ARCHIVES_ROW_H }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "#f5f5f4"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <button
                          type="button"
                          title="Reprendre cette demande"
                          onClick={() => { setText(row.content || ""); setArchivesOpen(false); taRef.current?.focus(); }}
                          style={{
                            flex: 1, minWidth: 0, height: "100%",
                            display: "flex", alignItems: "center", gap: 10,
                            border: "none", background: "transparent", cursor: "pointer",
                            padding: "0 8px 0 16px", color: C.text, fontSize: 13.5,
                            lineHeight: 1.5, fontFamily: "inherit", textAlign: "left",
                          }}
                        >
                          {/* LED de statut : verte traité, orange en attente/en cours
                              (pulse si en cours), rouge pour un statut refusé/inconnu —
                              voir archiveStatutLed. */}
                          <span
                            title={led.label}
                            style={{
                              flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
                              background: led.color,
                              animation: led.pulse ? "ceoBotIaLedPulse 1.4s ease-in-out infinite" : "none",
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {row.content}
                            </span>
                            {row.created_at && (
                              <span style={{ fontSize: 11, color: C.muted }}>
                                {new Date(row.created_at).toLocaleString("fr-FR", {
                                  day: "2-digit", month: "2-digit", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            )}
                          </span>
                        </button>
                        {/* Masquage visuel (pas de suppression) : uniquement sur un
                            ticket qui n'est plus en file active — cf. isArchiveHideable.
                            Révélé au survol de la ligne (.ceo-botia-archive-dismiss). */}
                        {hideable && (
                          <button
                            type="button"
                            className="ceo-botia-archive-dismiss"
                            aria-label="Masquer"
                            title="Masquer . visuel seulement, ne supprime rien"
                            onClick={(e) => { e.stopPropagation(); hideArchiveEntry(row.id); }}
                            style={{
                              flexShrink: 0, width: 24, height: 24, marginRight: 10, borderRadius: 6,
                              border: "none", background: "transparent", cursor: "pointer", color: C.muted,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              animation: seqRowAnim,
              pointerEvents: seqRowInteractive ? "auto" : "none",
            }}>
              <div style={{
                // Ancre du menu de mentions, qui se pose juste au-dessus.
                position: "relative",
                background: C.bg,
                border: `1px solid ${focused ? C.accent : C.border}`,
                borderRadius: 22,
                padding: "14px 18px 10px",
                boxShadow: darkMode
                  ? "0 1px 3px rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.18)"
                  : "0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                transition: "border-color 0.15s, box-shadow 0.15s",
                // Reprend toute la largeur disponible dans la nouvelle rangée
                // flex (composer + bouton) — sans ça un flex-item retombe à sa
                // largeur de contenu, ce qui rétrécissait la zone de saisie.
                flex: 1,
                minWidth: 0,
              }}>
                {/* Propositions de pages. Posées VERS LE HAUT (`bottom: 100%`) :
                  le composer touche le bas de la fenêtre, une liste
                  descendante serait hors écran. */}
                {mentionMenu.open && mentionMenu.items.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Pages disponibles"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: 0,
                      right: 0,
                      zIndex: 30,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: 6,
                      boxShadow: darkMode
                        ? "0 10px 30px rgba(0,0,0,0.45)"
                        : "0 10px 30px rgba(16,24,40,0.14)",
                      maxHeight: 280,
                      overflowY: "auto",
                      animation: "ceoBotIaIn 0.12s ease-out",
                    }}
                  >
                    {mentionMenu.items.map((it, i) => {
                      const active = i === mentionMenu.index;
                      return (
                        <div
                          key={it.key}
                          role="option"
                          aria-selected={active}
                          // `onMouseDown` et pas `onClick` : le clic ferait
                          // d'abord perdre le focus au champ, ce qui fermerait
                          // le menu avant que la sélection soit prise.
                          onMouseDown={(e) => { e.preventDefault(); applyMention(it); }}
                          onMouseEnter={() => setMentionMenu((s) => ({ ...s, index: i }))}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 9,
                            cursor: "pointer",
                            background: active ? (darkMode ? "#2a2b36" : "#eef1f7") : "transparent",
                            transition: "background 0.12s",
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                            @{it.label}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.hint}
                          </span>
                          <span style={{ fontSize: 11, color: C.muted, opacity: 0.75, whiteSpace: "nowrap" }}>
                            {it.url.replace("https://webinaire.ownertechnology.com", "") || "/"}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{
                      padding: "6px 10px 2px",
                      fontSize: 11,
                      color: C.muted,
                      borderTop: `1px solid ${C.border}`,
                      marginTop: 4,
                    }}>
                      ↑↓ pour choisir · Entrée ou Tab pour valider
                    </div>
                  </div>
                )}

                {/* Le champ et son calque sont superposés au pixel près : le
                  champ porte le curseur et la frappe, le calque porte
                  l'affichage — c'est lui qui grise la mention. */}
                <div style={{ position: "relative", width: "100%" }}>
                  <div
                    ref={overlayRef}
                    aria-hidden="true"
                    style={{
                      ...TA_TYPO,
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      overflow: "hidden",
                      color: C.text,
                      boxSizing: "border-box",
                    }}
                  >
                    {mentionView ? (
                      <>
                        <span style={{
                          color: mentionView.resolved
                            ? "#3d4ff2"
                            : mentionView.tone === "known" ? C.muted : "#ef4444",
                          fontWeight: 500,
                        }}>
                          {mentionView.raw}
                        </span>
                        {mentionView.rest}
                      </>
                    ) : text}
                    {/* Une saisie finissant par un saut de ligne perdrait sa
                      dernière ligne dans le calque : on la maintient. */}
                    {"​"}
                  </div>

                  <textarea
                    ref={taRef}
                    className="ceo-botia-ta"
                    rows={1}
                    placeholder="@page puis votre demande…"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      refreshMentionMenu(e.target.value, e.target.selectionStart);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      setFocused(false);
                      // Laisse passer le clic sur une proposition avant de fermer.
                      setTimeout(closeMentionMenu, 120);
                    }}
                    onScroll={syncOverlayScroll}
                    onClick={(e) => {
                      const pos = e.currentTarget.selectionStart;
                      // Ctrl/Cmd+clic DANS la mention (pas ailleurs dans le
                      // texte) : ouvre directement la page, sans passer par
                      // l'envoi du ticket. Le clic normal garde son usage
                      // habituel (positionner le curseur, rouvrir le menu).
                      if ((e.ctrlKey || e.metaKey) && mentionView?.resolved && pos <= mentionView.raw.length) {
                        window.open(mentionView.resolved.url, "_blank", "noopener,noreferrer");
                        return;
                      }
                      refreshMentionMenu(text, pos);
                    }}
                    onKeyUp={(e) => {
                      // Les touches de navigation déplacent le curseur sans rien
                      // changer au texte : le menu doit suivre.
                      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                        refreshMentionMenu(text, e.currentTarget.selectionStart);
                      }
                    }}
                    onKeyDown={(e) => {
                      // Le menu ouvert capte les touches AVANT l'envoi : sinon
                      // Entrée expédierait la demande au lieu de valider la
                      // page sélectionnée.
                      if (mentionMenu.open && mentionMenu.items.length) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionMenu((s) => ({ ...s, index: (s.index + 1) % s.items.length }));
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionMenu((s) => ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length }));
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          applyMention(mentionMenu.items[mentionMenu.index]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          closeMentionMenu();
                          return;
                        }
                      }
                      // Entrée envoie, Maj+Entrée passe à la ligne.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    style={{
                      ...TA_TYPO,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      resize: "none",
                      // Transparent : le calque au-dessous fait l'affichage.
                      // Le curseur, lui, garde sa couleur.
                      color: "transparent",
                      caretColor: C.text,
                      position: "relative",
                      width: "100%",
                      maxHeight: 260,
                      overflowY: "auto",
                      boxSizing: "border-box",
                      display: "block",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Archives : les tickets déjà envoyés, relus depuis la
                      table bot_ia_prompts (GET /api/v1/bot-ia-prompts). */}
                    <button
                      type="button"
                      aria-label="Archives"
                      title="Mes anciennes demandes"
                      onClick={openArchives}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: "none",
                        background: archivesOpen ? (darkMode ? "#2a2b36" : "#eceef4") : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: C.text,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "#2a2b36" : "#eceef4"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = archivesOpen ? (darkMode ? "#2a2b36" : "#eceef4") : "transparent"; }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                    </button>
                    {/* Flèche d'envoi. Le micro du dashboard n'est PAS repris :
                      quand le champ est vide, le bouton reste là, grisé. */}
                    <button
                      type="button"
                      aria-label="Envoyer"
                      disabled={!canSend}
                      onClick={handleSend}
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        border: "none",
                        // Actif ET pendant la recherche : le bleu reste, sinon
                        // le spinner tournerait sur un fond gris.
                        background: (canSend || sending)
                          ? "#3d4ff2"
                          : (darkMode ? "#24252f" : "#dfe3ea"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canSend ? "pointer" : "default",
                        color: (canSend || sending) ? "#fff" : C.muted,
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      {sending ? (
                        <span style={{
                          width: 13, height: 13, borderRadius: "50%",
                          border: "2px solid currentColor", borderTopColor: "transparent",
                          animation: "ceoBotIaSpin 0.7s linear infinite",
                        }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bouton séparé, à droite du composer. Ouvre le mockup de
                fenêtre « Gestion de séquence » (vide pour l'instant). */}
              <button
                type="button"
                aria-label="Gestion séquence"
                title="Gestion séquence"
                onClick={openSeqWindow}
                style={{
                  width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                  border: "none",
                  background: darkMode ? "#1E0F74" : "#C8C2ED",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                  boxShadow: darkMode
                    ? "0 4px 14px rgba(30,15,116,0.45)"
                    : "0 4px 14px rgba(200,194,237,0.35)",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {/* Gene Structure — svgrepo.com/svg/530671/gene-structure */}
                <svg width="26" height="26" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path d="M608 156.8c4.8 1.6 6.4 4.8 6.4 9.6l-28.8 108.8c-1.6 4.8-4.8 6.4-9.6 6.4-4.8-1.6-6.4-4.8-6.4-9.6l28.8-108.8c0-4.8 4.8-8 9.6-6.4zM867.2 416c1.6 4.8-1.6 8-6.4 9.6L752 454.4c-4.8 1.6-8-1.6-9.6-6.4-1.6-4.8 1.6-8 6.4-9.6l108.8-28.8c4.8 0 8 3.2 9.6 6.4z m-94.4 356.8c-3.2 3.2-8 3.2-11.2 0l-78.4-78.4c-3.2-3.2-3.2-8 0-11.2 3.2-3.2 8-3.2 11.2 0l78.4 78.4c3.2 3.2 3.2 8 0 11.2zM416 867.2c-4.8-1.6-6.4-4.8-6.4-9.6l28.8-108.8c1.6-4.8 4.8-6.4 9.6-6.4 4.8 1.6 6.4 4.8 6.4 9.6l-28.8 108.8c0 4.8-4.8 8-9.6 6.4zM156.8 608c-1.6-4.8 1.6-8 6.4-9.6l108.8-28.8c4.8-1.6 8 1.6 9.6 6.4 1.6 4.8-1.6 8-6.4 9.6l-108.8 28.8c-4.8 0-8-3.2-9.6-6.4z m94.4-356.8c3.2-3.2 8-3.2 11.2 0l78.4 78.4c3.2 3.2 3.2 8 0 11.2s-8 3.2-11.2 0l-78.4-78.4c-3.2-3.2-3.2-8 0-11.2z" fill="#050D42" />
                  <path d="M355.2 355.2l-57.6 214.4 156.8 156.8 214.4-57.6 57.6-214.4-156.8-156.8-214.4 57.6z m230.4-86.4l169.6 169.6c4.8 4.8 6.4 9.6 4.8 16l-62.4 232c-1.6 4.8-6.4 9.6-11.2 11.2l-232 62.4c-4.8 1.6-11.2 0-16-4.8L268.8 585.6c-4.8-4.8-6.4-9.6-4.8-16l62.4-232c1.6-4.8 6.4-9.6 11.2-11.2l232-62.4c6.4 0 11.2 1.6 16 4.8z" fill="#050D42" />
                  <path d="M561.6 326.4c-25.6-6.4-41.6-33.6-33.6-59.2s33.6-41.6 59.2-33.6c25.6 6.4 41.6 33.6 33.6 59.2-6.4 25.6-33.6 40-59.2 33.6z m136 136c-6.4-25.6 8-51.2 33.6-59.2 25.6-6.4 51.2 8 59.2 33.6 6.4 25.6-8 51.2-33.6 59.2-25.6 6.4-52.8-8-59.2-33.6z m-49.6 185.6c19.2-19.2 49.6-19.2 67.2 0 19.2 19.2 19.2 49.6 0 67.2-19.2 19.2-49.6 19.2-67.2 0-19.2-17.6-19.2-48 0-67.2z m-185.6 49.6c25.6 6.4 41.6 33.6 33.6 59.2-6.4 25.6-33.6 41.6-59.2 33.6-25.6-6.4-41.6-33.6-33.6-59.2 6.4-25.6 33.6-40 59.2-33.6z m-136-136c6.4 25.6-8 51.2-33.6 59.2-25.6 6.4-51.2-8-59.2-33.6-6.4-25.6 8-51.2 33.6-59.2 25.6-6.4 52.8 8 59.2 33.6z m49.6-185.6c-19.2 19.2-49.6 19.2-67.2 0-19.2-19.2-19.2-49.6 0-67.2 19.2-19.2 49.6-19.2 67.2 0s19.2 48 0 67.2z" fill="#2F4BFF" />
                  <path d="M483.014155 620.184198a112 112 0 1 0 57.97169-216.368396 112 112 0 1 0-57.97169 216.368396Z" fill="#2F4BFF" />
                  <path d="M598.4 187.2c-17.6-4.8-27.2-22.4-22.4-38.4 4.8-17.6 22.4-27.2 38.4-22.4 17.6 4.8 27.2 22.4 22.4 38.4s-20.8 27.2-38.4 22.4z m238.4 238.4c-4.8-17.6 4.8-35.2 22.4-38.4 17.6-4.8 35.2 4.8 38.4 22.4 4.8 17.6-4.8 35.2-22.4 38.4-16 4.8-33.6-6.4-38.4-22.4z m-88 323.2c12.8-12.8 32-12.8 44.8 0s12.8 32 0 44.8c-12.8 12.8-32 12.8-44.8 0s-11.2-32 0-44.8z m-323.2 88c17.6 4.8 27.2 22.4 22.4 38.4-4.8 17.6-22.4 27.2-38.4 22.4-17.6-4.8-27.2-22.4-22.4-38.4 3.2-17.6 20.8-27.2 38.4-22.4zM187.2 598.4c4.8 17.6-4.8 35.2-22.4 38.4-17.6 4.8-35.2-4.8-38.4-22.4-4.8-17.6 4.8-35.2 22.4-38.4 16-4.8 33.6 6.4 38.4 22.4z m88-323.2c-12.8 12.8-32 12.8-44.8 0-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0 11.2 11.2 11.2 32 0 44.8z" fill="#2F4BFF" />
                </svg>
              </button>
            </div>

            {/* Fenêtre « Gestion de séquence » — mockup vide (étape 1). Position
                fixed calculée en px à l'ouverture (cf. openSeqWindow), pour que
                `transform` reste libre aux animations d'entrée/sortie. */}
            {seqWindowVisible && seqWinPos && (
              // Couche EXTERNE : positionnement pur, centrage CSS natif
              // (calc(50%) + transform self-centering — aucun calcul manuel
              // de px ne peut le désaligner) + décalage de drag additif.
              // `transform` reste donc TOUJOURS le même type de valeur ici ;
              // l'animation d'entrée/sortie vit sur la couche INTERNE pour
              // ne jamais rentrer en conflit avec ce transform de position.
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: `calc(50% + ${(sideCollapsed ? 56 : 260) / 2}px)`,
                  width: seqWinPos.w,
                  height: seqWinPos.h,
                  transform: `translate(calc(-50% + ${seqDrag.x}px), calc(-50% + ${seqDrag.y}px))`,
                  zIndex: 500,
                  pointerEvents: seqWindowInteractive ? "auto" : "none",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                    boxShadow: darkMode ? "0 24px 64px rgba(0,0,0,0.55)" : "0 24px 64px rgba(16,24,40,0.28)",
                    display: "flex",
                    flexDirection: "column",
                    animation:
                      seqPhase === "window-in" ? "ceoBotIaWindowPop 0.22s cubic-bezier(0.16,1,0.3,1) both"
                        : seqPhase === "window-closing" ? "ceoBotIaFallOut 0.6s cubic-bezier(0.55,0,0.85,0.35) both"
                          : "none",
                  }}
                >
                  {/* Barre supérieure : drag + réduire/agrandir (inertes)/fermer. */}
                  <div
                    onMouseDown={onSeqHeaderMouseDown}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      height: 42, flexShrink: 0, padding: "0 8px 0 14px",
                      background: C.bg, borderBottom: `1px solid ${C.border}`,
                      cursor: seqWindowInteractive ? "grab" : "default",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: darkMode ? "#fff" : "#1e2330",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <img src={companyLogo} alt="" style={{ width: 14, height: 14, objectFit: "contain", filter: darkMode ? "none" : "brightness(0) invert(1)" }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.secondary }}>Gestion de séquence</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        aria-label="Réduire"
                        title="Réduire"
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "none",
                          background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "default", color: C.muted,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="5" y1="19" x2="19" y2="19" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Agrandir"
                        title="Agrandir"
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "none",
                          background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "default", color: C.muted,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Fermer"
                        title="Fermer"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={closeSeqWindow}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "none",
                          background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: C.muted, transition: "background 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#ff3b30"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Corps — mockup volontairement vide, gris, sans contenu. */}
                  <div style={{ flex: 1, background: darkMode ? "#2a2b36" : "#e4e6ea" }} />
                </div>
              </div>
            )}

            {/* Rien ne s'affiche quand tout va bien. Un échec d'enregistrement
                reste signalé — le taire serait pire. */}
            <div style={{ minHeight: 18, marginTop: 8, paddingLeft: 6 }}>
              {error && (
                <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
