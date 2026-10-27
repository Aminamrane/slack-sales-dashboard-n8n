import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { setNavScope } from "../utils/sidebarPermissions";
import Sidebar from "../components/shared/Sidebar";
import SharedNavbar from "../components/SharedNavbar.jsx";
import SalesTeamGrid from "../components/SalesTeamGrid.jsx";
import SettersGrid from "../components/SettersGrid.jsx";
import SalesSettersToggle from "../components/SalesSettersToggle.jsx";
import { computeBoardStats, etatPeriodOptions, MONTH_LABELS_FR } from "../utils/ceoDashboardStats.js";
import ParcPanel from "../components/ceo/ParcPanel.jsx";
import FinancePanel from "../components/ceo/FinancePanel.jsx";
import ProduitPanel from "../components/ceo/ProduitPanel.jsx";
import DelaysFrieze from "../components/ceo/DelaysFrieze.jsx";
import PodiumPanel from "../components/ceo/PodiumPanel.jsx";
import GlobeArch from "../components/ceo/GlobeArch.jsx";
import { Inscription } from "../components/ceo/Ornaments.jsx";
import { useMotionPrefs } from "../components/ceo/motion.js";
import "../components/ceo/antique.css";
import "../index.css";

// ── DESIGN SYSTEM (same C object as all pages) ────────────────────────────
// Exporté pour réutilisation par les vues /ceo/* (mêmes palettes dark/light).
export const getColors = (dark) => ({
  bg: dark ? '#1e1f28' : '#ffffff',
  surface: dark ? '#13141b' : '#f6f7f9',
  border: dark ? '#2a2b36' : '#d5dae5',
  text: dark ? '#eef0f6' : '#1e2330',
  muted: dark ? '#5e6273' : '#9ca3af',
  subtle: dark ? '#252636' : '#f4f6fb',
  secondary: dark ? '#8b8fa0' : '#6b7280',
  accent: dark ? '#7c8adb' : '#5b6abf',
  shadow: dark ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
});

// ── SIDEBAR TABS ──────────────────────────────────────────────────────────
const SIDEBAR_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  )},
  // Sa propre Tracking Sheet (demande dev 2026-09-30 : Paul envoie aussi des contrats).
  // Réservée ceo/admin (ITEM_ROLE_GATE) : la page refuse les autres rôles sans l'accès.
  { key: 'my_tracking_sheet', label: 'Ma Tracking Sheet', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
  )},
  { section: 'HUMAN' },
  { key: 'conges', label: 'Absence', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )},
  { key: 'variables', label: 'Variables Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  )},
  { key: 'work_hours', label: 'Heures de travail', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
  )},
  { section: 'ACQUISITION' },
  { key: 'perf_sales', label: 'Perf Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
  { key: 'lead_quality', label: 'Qualité Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
  )},
  { key: 'leaderboard', label: 'Leaderboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )},
  { key: 'sales_team', label: 'Équipe Sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  // RDV posés par les setters (CRM, lien webinaire) et clients amenés au mois de signature (05/10).
  // Icône : casque-micro, l'outil du setter (appels et prise de RDV).
  { key: 'setters_stats', label: 'Setters', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>
  )},
  // Agenda des RDV de l'équipe, jour par jour et par commercial : suivis par un setter ou à relancer
  // par la direction (05/10). Icône : calendrier avec une coche.
  { key: 'acquisition_agenda', label: 'Agenda des RDV', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
  )},
  { key: 'sales_recordings', label: 'Enregistrement sales', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
  )},
  { key: 'webinar', label: 'Webinaire', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  )},
  // Même mégaphone que l'en-tête de la page Meta Ads (MetaAds/icons.jsx « ads »).
  { key: 'meta_ads', label: 'Meta Ads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.6 10.2v3.6a1.6 1.6 0 001.6 1.6h2.2l6.4 3.6V5l-6.4 3.6H5.2a1.6 1.6 0 00-1.6 1.6z"/><path d="M17 9.4a3.4 3.4 0 010 5.2"/><path d="M19.4 7a6.6 6.6 0 010 10"/></svg>
  )},
  { key: 'funnel_leads', label: 'Funnel Leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  )},
  { key: 'leads_management', label: 'Gestion des leads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  // Leads qui ont déclaré moins de 100 000 € de CA, la plupart non affectés (29/09).
  { key: 'small_leads', label: 'Leads < 100 k€', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  )},
  { key: 'autoassign', label: 'Auto-affectation', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  )},
  { key: 'sequences', label: 'Séquences email', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  )},
  // Sub Tickets : demandes des opérationnels (landing pages, séquences),
  // traitées par l'agent interne. Onglet réservé par rôle (sidebarPermissions).
  { key: 'bot_ia', label: 'Sub Tickets', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></svg>
  )},
  { section: 'FINANCE' },
  { key: 'dispatch', label: 'Finance', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  )},
  { key: 'campaigns', label: 'Campagnes', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  )},
  { section: 'PRODUIT' },
  { key: 'optilex_board', label: "Board Owner/Opti'Lex", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
  )},
];

// ── Mapping SIDEBAR_TABS → sections (format Notion-style Sidebar) ─────────
// SIDEBAR_TABS est un flat array avec separators `{ section: 'NAME' }`. Le
// composant Sidebar attend `[{ key, label, items: [{ id, label, icon }] }]`.
// Les items avant le premier separator sont regroupés dans une section
// "Récentes" (équivalent du pattern TSF). Chaque `{ section }` ouvre une
// nouvelle section dont le label devient le suivant.
export const SIDEBAR_SECTIONS = (() => {
  const sections = [];
  let current = { key: 'recent', label: 'Récentes', items: [] };
  SIDEBAR_TABS.forEach((entry) => {
    if (entry.section) {
      if (current.items.length) sections.push(current);
      current = { key: entry.section.toLowerCase(), label: entry.section, items: [] };
    } else {
      current.items.push({ id: entry.key, label: entry.label, icon: entry.icon });
    }
  });
  if (current.items.length) sections.push(current);
  return sections;
})();

// Onglets de la barre latérale qui sont des routes à part entière (vues /ceo/*).
const ROUTE_TABS = {
  dispatch: '/ceo/dispatch', leaderboard: '/ceo/leaderboard', perf_sales: '/ceo/perf-sales', lead_quality: '/ceo/lead-quality',
  webinar: '/ceo/webinar', funnel_leads: '/ceo/funnel-leads', leads_management: '/ceo/leads-management', small_leads: '/ceo/leads-moins-100k',
  setters_stats: '/ceo/setters', acquisition_agenda: '/ceo/agenda', autoassign: '/ceo/auto-affectation', sequences: '/ceo/sequences',
  variables: '/ceo/variables', conges: '/ceo/conges', work_hours: '/ceo/work-hours', campaigns: '/ceo/campaigns',
  my_tracking_sheet: '/tracking-sheet', optilex_board: '/ceo/optilex-board', sales_recordings: '/ceo/sales-recordings',
  meta_ads: '/ceo/meta-ads', bot_ia: '/ceo/Sub-Tickets',
};

// Rafraîchissements : le board et le classement bougent dans la journée (60 s, en
// pause quand l'onglet est caché) ; les montants de la Finance au rythme de la
// facturation (5 min). Une source lourde n'est jamais rechargée toutes les 30 s.
const BOARD_REFRESH_MS = 60000;
const LEADERBOARD_REFRESH_MS = 60000;
const ARR_REFRESH_MS = 300000;

function usePolling(user, load, every) {
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const run = () => load(() => cancelled);
    run();
    const refresh = () => { if (!document.hidden) run(); };
    const timer = setInterval(refresh, every);
    document.addEventListener('visibilitychange', refresh);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [user, load, every]);
}

export default function CeoDashboard() {
  const navigate = useNavigate();
  // Vue CEO/admin "tout" -> on réinitialise le scope de navigation (les sous-vues
  // /ceo/* repassent en vue complète, contrairement au contexte RH).
  setNavScope(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  // Initial tab — honour `ceoActiveTab` in localStorage (set by CeoSheetView
  // when returning from an embedded TrackingSheet view). Consume + clear so
  // a hard reload of /ceo always lands on Dashboard.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hint = localStorage.getItem('ceoActiveTab');
      if (hint) {
        localStorage.removeItem('ceoActiveTab');
        return hint;
      }
    } catch { /* noop */ }
    return 'dashboard';
  });
  // Sidebar collapse state (persisted). Pattern miroir TSF : défaut = REPLIÉ
  // (survol pour déplier, cohérent tous navigateurs), clé v2.
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem('ceoSideCollapsed_v2');
    return stored === null ? true : stored === 'true';
  });
  useEffect(() => {
    localStorage.setItem('ceoSideCollapsed_v2', String(sideCollapsed));
  }, [sideCollapsed]);
  const [user, setUser] = useState(null);
  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const { list } = useMotionPrefs();

  // ── AUTH CHECK ──────────────────────────────────────────────────────
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || (u.role !== 'admin' && u.role !== 'ceo' && u.role !== 'finance_director')) {
      navigate('/login');
      return;
    }
    setUser(u);
  }, [navigate]);

  // ── DONNÉES ─────────────────────────────────────────────────────────
  // Classement du mois (+ avatars poussés au globe) ; board Owner/Opti'Lex (états
  // clients, onboarding) ; ARR Owner par client (part Owner facturée par la Finance,
  // annualisée : null = en cours, false = échec, jamais 0 €) ; objectifs mensuels.
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [avatarMap, setAvatarMap] = useState({});
  const [boardRows, setBoardRows] = useState(null);
  const [ownerArr, setOwnerArr] = useState(null);
  const [monthlyObjectives, setMonthlyObjectives] = useState({});
  const [etatPeriod, setEtatPeriod] = useState('all');

  const loadLeaderboard = useCallback(async (cancelled) => {
    try {
      const lb = await apiClient.getLeaderboardStats('current_month');
      if (cancelled()) return;
      setLeaderboardData(lb);
      const map = {};
      const names = ['paul', 'ismahane', 'timothy', 'mohamed', 'yohan', 'léo', 'leo'];
      (lb?.all_sellers || []).forEach((s) => {
        if (!s.name || !s.avatar_url) return;
        const lower = s.name.toLowerCase();
        names.forEach((n) => { if (lower.includes(n)) map[n.replace('é', 'e')] = s.avatar_url; });
      });
      setAvatarMap(map);
    } catch (e) {
      console.warn('[CeoDashboard] classement indisponible:', e);
    } finally {
      if (!cancelled()) setLeaderboardLoading(false);
    }
  }, []);
  const loadBoard = useCallback(async (cancelled) => {
    try {
      const data = await apiClient.get('/api/v1/optilex/board');
      if (!cancelled()) setBoardRows(data?.clients || []);
    } catch (e) {
      // `boardRows` reste à null : les cartes restent sur "—". Un board
      // indisponible ne doit pas se lire comme "0".
      console.warn('[CeoDashboard] board Owner/Opti\'Lex indisponible:', e);
    }
  }, []);
  const loadArr = useCallback(async (cancelled) => {
    try {
      const data = await apiClient.get('/api/v1/ceo-dashboard/owner-arr');
      if (!cancelled()) setOwnerArr(data?.clients || {});
    } catch (e) {
      console.warn('[CeoDashboard] ARR Owner indisponible:', e);
      if (!cancelled()) setOwnerArr((prev) => prev || false);
    }
  }, []);
  usePolling(user, loadLeaderboard, LEADERBOARD_REFRESH_MS);
  usePolling(user, loadBoard, BOARD_REFRESH_MS);
  usePolling(user, loadArr, ARR_REFRESH_MS);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get('/api/v1/monthly-objectives');
        if (cancelled || !data?.objectives) return;
        setMonthlyObjectives(Object.fromEntries(data.objectives.map((o) => [o.period, o.target])));
      } catch {
        // Silencieux : carte « Objectif : — ».
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const periodOptions = useMemo(() => etatPeriodOptions(), []);
  const stats = useMemo(() => computeBoardStats(boardRows, etatPeriod, ownerArr || null), [boardRows, etatPeriod, ownerArr]);

  // ── OBJECTIFS MENSUELS ───────────────────────────────────────────────
  const [objectivesModalOpen, setObjectivesModalOpen] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(null);
  const [objectiveError, setObjectiveError] = useState(null);
  const canEditObjectives = user?.role === 'ceo' || user?.role === 'admin' || user?.role === 'finance_director';
  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const rollingMonths = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTH_LABELS_FR[d.getMonth()]} ${d.getFullYear()}` });
    }
    return out;
  }, []);
  const saveObjective = useCallback(async (period, rawValue) => {
    if (!canEditObjectives) return;
    const target = parseInt(rawValue, 10);
    if (!Number.isFinite(target) || target < 0) {
      setObjectiveError({ period, message: 'Valeur invalide' });
      return;
    }
    const previous = monthlyObjectives[period];
    setMonthlyObjectives((prev) => ({ ...prev, [period]: target }));
    setSavingPeriod(period);
    setObjectiveError(null);
    try {
      await apiClient.put(`/api/v1/monthly-objectives/${period}`, { target });
    } catch (e) {
      setMonthlyObjectives((prev) => {
        const next = { ...prev };
        if (previous === undefined) delete next[period];
        else next[period] = previous;
        return next;
      });
      setObjectiveError({ period, message: e?.message || 'Erreur sauvegarde' });
    } finally {
      setSavingPeriod(null);
    }
  }, [canEditObjectives, monthlyObjectives]);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.style.background = C.surface;
    return () => { document.body.style.background = ''; };
  }, [darkMode, C]);

  // ── ÉQUIPE SALES (onglet inline, chargé à la première visite) ───────
  const [salesTeamUsers, setSalesTeamUsers] = useState([]);
  const [salesTeams, setSalesTeams] = useState([]);
  const [salesTeamLoading, setSalesTeamLoading] = useState(false);
  const [salesTeamView, setSalesTeamView] = useState("sales");
  const [settersOverview, setSettersOverview] = useState([]);
  const [settersLoading, setSettersLoading] = useState(false);
  const [settersFetched, setSettersFetched] = useState(false);
  useEffect(() => {
    if (activeTab !== 'sales_team' || salesTeamUsers.length > 0 || salesTeamLoading) return;
    setSalesTeamLoading(true);
    Promise.all([
      apiClient.getAssignableUsers().catch((e) => { console.warn('[CeoDashboard] getAssignableUsers failed:', e); return null; }),
      apiClient.getTeams().catch((e) => { console.warn('[CeoDashboard] getTeams failed:', e); return null; }),
    ])
      .then(([usersResp, teamsResp]) => {
        const l = Array.isArray(usersResp) ? usersResp : (usersResp?.users || usersResp?.data || []);
        setSalesTeamUsers(l);
        setSalesTeams(Array.isArray(teamsResp) ? teamsResp : (teamsResp?.teams || []));
      })
      .finally(() => setSalesTeamLoading(false));
  }, [activeTab, salesTeamUsers.length, salesTeamLoading]);
  useEffect(() => {
    if (activeTab !== 'sales_team' || salesTeamView !== 'setters' || settersFetched) return;
    setSettersLoading(true);
    apiClient.getSettersOverview()
      .then((resp) => { setSettersOverview(Array.isArray(resp) ? resp : (resp?.setters || [])); })
      .catch((e) => { console.warn('[CeoDashboard] getSettersOverview failed:', e); })
      .finally(() => { setSettersLoading(false); setSettersFetched(true); });
  }, [activeTab, salesTeamView, settersFetched]);

  if (!user) return null;

  const now = new Date();
  const monthLabel = `${MONTH_LABELS_FR[now.getMonth()].toLowerCase()} ${now.getFullYear()}`;

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="ceo-page" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.surface, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}>
      <style>{`
        @keyframes ceoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes ceoCardPop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes ceoRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
        @keyframes ceoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes ceoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* Objectifs mensuels modal — input number Notion-style (pas de
           spinners natifs, plus discret et cohérent avec le pattern de la page). */
        .ceo-objective-input { -moz-appearance: textfield; appearance: textfield; }
        .ceo-objective-input::-webkit-inner-spin-button,
        .ceo-objective-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .ceo-optilex-map .mapboxgl-ctrl-bottom-left,
        .ceo-optilex-map .mapboxgl-ctrl-bottom-right { display: none !important; }
        .ceo-scroll::-webkit-scrollbar { width: 3px; }
        .ceo-scroll::-webkit-scrollbar-track { background: transparent; }
        .ceo-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        /* Sidebar Notion-style (miroir TSF, palette dynamique via inline style). */
        .ceo-side { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
        .ceo-side-item { transition: background 0.12s ease; }
        .ceo-side-item:hover { background: ${darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}; }
        .ceo-icon-btn { transition: background 0.12s, color 0.12s; }
        .ceo-icon-btn:hover { background: ${darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f4'}; }
        .ceo-side-scroll::-webkit-scrollbar { width: 10px; }
        .ceo-side-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .ceo-side-scroll:hover::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(55,53,47,0.16)'}; background-clip: padding-box; }
        .ceo-side-scroll::-webkit-scrollbar-track { background: transparent; }
        .ceo-page *, .ceo-page *::before, .ceo-page *::after { box-sizing: border-box; }
        /* Cartes de l'onglet Équipe Sales (grilles partagées). */
        .ceo-card { position: relative; border-radius: 16px; background: transparent; border: none; overflow: visible; isolation: isolate; }
        .ceo-card::before { content: ''; position: absolute; inset: -3px; border-radius: 18px; background: linear-gradient(180deg, #EDEDEE 0%, #DCDCDD 100%); z-index: -2; pointer-events: none; }
        .ceo-card::after { content: ''; position: absolute; inset: 0; border-radius: 16px; background: linear-gradient(180deg, #FCFCFD 0%, #F8F8F8 40%, #F8F8F8 60%, #F3F3F4 100%); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.85); pointer-events: none; z-index: -1; }
      `}</style>

      {/* ═══ LEFT SIDEBAR (Notion-style — mirror TSF) ═══════════════════ */}
      <Sidebar
        width={sideCollapsed ? 56 : 260}
        collapsed={sideCollapsed}
        onToggle={() => setSideCollapsed((v) => !v)}
        sections={SIDEBAR_SECTIONS}
        activeTab={activeTab}
        setActiveTab={(tabId) => {
          // La plupart des onglets sont des routes (vues /ceo/* qui enveloppent les
          // pages existantes) ; « Dashboard » et « Équipe Sales » se rendent ici.
          if (ROUTE_TABS[tabId]) { navigate(ROUTE_TABS[tabId]); return; }
          setActiveTab(tabId);
        }}
        C={C}
        darkMode={darkMode}
      />

      {/* ═══ MAIN AREA ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

        <div className={`ceo-scroll an-page ceo-antique${darkMode ? ' is-dark' : ''}`} style={{ flex: 1, overflowY: 'auto', padding: '0 32px 28px' }}>

          {/* ═══ DASHBOARD ═══ */}
          {activeTab === 'dashboard' && (
            <div className="an-wrap">
              {/* Aucun ornement en tête de page (barre « Répondre… » retirée le 27/10, frise
                  grecque le 28/10, à la demande du dev) : le parc garde sa place, à 104 px. */}
              <motion.section className="an-section" style={{ marginTop: 104 }} variants={list(0.09)} initial="hidden" animate="show" aria-label="Clients">
                <ParcPanel
                  stats={stats}
                  period={etatPeriod}
                  setPeriod={setEtatPeriod}
                  periodOptions={periodOptions}
                  ownerArrFailed={ownerArr === false}
                  dark={darkMode}
                />
              </motion.section>

              <FinancePanel dark={darkMode} onOpenFinance={(period) => navigate(`/ceo/dispatch?period=${period}`)} />
              <ProduitPanel boardRows={boardRows} dark={darkMode} />
              <DelaysFrieze dark={darkMode} />

              <section className="an-section" aria-label="Équipe">
                <Inscription sub={`${monthLabel}`}>Équipe</Inscription>
                <motion.div className="an-bottom" variants={list()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
                  <PodiumPanel
                    leaderboard={leaderboardData}
                    loading={leaderboardLoading}
                    objective={monthlyObjectives[currentMonthKey]}
                    canEdit={canEditObjectives}
                    onEditObjectives={() => setObjectivesModalOpen(true)}
                    monthLabel={monthLabel}
                  />
                  <GlobeArch avatarMap={avatarMap} dark={darkMode} C={C} />
                </motion.div>
              </section>
            </div>
          )}

          {/* ═══ SALES TEAM TAB (CEO → Tracking Sheets individuels) ═══════════ */}
          {activeTab === 'sales_team' && (
            <div style={{ animation: 'ceoFadeIn 0.35s ease both', paddingTop: 96 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                    {salesTeamView === 'sales' ? 'Équipe Sales' : 'Setters'}
                  </h1>
                  <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                    {salesTeamView === 'sales'
                      ? 'Accédez aux Tracking Sheets individuels en mode ghost (lecture transparente, pas de notification).'
                      : 'Les setters classés par équipe, avec les sales dont ils traitent les leads.'}
                  </p>
                </div>
                <SalesSettersToggle view={salesTeamView} setView={setSalesTeamView} C={C} darkMode={darkMode} />
              </div>
              {salesTeamView === 'sales' ? (
                <SalesTeamGrid users={salesTeamUsers} teams={salesTeams} loading={salesTeamLoading} C={C} darkMode={darkMode}
                  onOpenSheet={(email) => navigate(`/ceo/sheet/${encodeURIComponent(email)}?ghost=true`)} />
              ) : (
                <SettersGrid setters={settersOverview} teams={salesTeams} loading={settersLoading} C={C} darkMode={darkMode}
                  onOpenAccount={(email) => navigate(`/ceo/setter-sheet/${encodeURIComponent(email)}?ghost=true`)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MONTHLY OBJECTIVES MODAL (CEO/admin only, portal) ───────── */}
      {objectivesModalOpen && canEditObjectives && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setObjectivesModalOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(15,18,30,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ceoFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both', padding: 20 }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: darkMode ? '0 24px 64px rgba(0,0,0,0.5)' : '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'ceoCardPop 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Objectifs mensuels</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Ventes cibles par mois</div>
              </div>
              <button
                onClick={() => setObjectivesModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '10px 14px 16px' }}>
              {rollingMonths.map(({ period, label }) => (
                <ObjectiveRow
                  key={period}
                  period={period}
                  label={label}
                  currentValue={monthlyObjectives[period]}
                  saving={savingPeriod === period}
                  errorMessage={objectiveError?.period === period ? objectiveError.message : null}
                  onSave={(val) => saveObjective(period, val)}
                  C={C}
                  darkMode={darkMode}
                  isCurrent={period === currentMonthKey}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Single editable row inside the objectives modal ─────────────────────────
function ObjectiveRow({ label, currentValue, saving, errorMessage, onSave, C, darkMode, isCurrent }) {
  const [draft, setDraft] = useState(currentValue !== undefined ? String(currentValue) : '');
  // Sync local draft when external value changes (e.g. successful save or refetch).
  useEffect(() => {
    setDraft(currentValue !== undefined ? String(currentValue) : '');
  }, [currentValue]);

  const dirty = draft !== (currentValue !== undefined ? String(currentValue) : '');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && dirty && !saving) onSave(draft);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: isCurrent ? (darkMode ? 'rgba(124,138,219,0.08)' : 'rgba(91,106,191,0.06)') : 'transparent', transition: 'background 0.15s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: C.text, letterSpacing: '-0.01em' }}>
          {label}{isCurrent && <span style={{ marginLeft: 8, fontSize: 10, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>actuel</span>}
        </div>
        {errorMessage && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errorMessage}</div>
        )}
      </div>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="45"
        disabled={saving}
        className="ceo-objective-input"
        style={{ width: 84, padding: '8px 12px', border: `1px solid ${errorMessage ? '#ef4444' : C.border}`, borderRadius: 10, background: C.subtle, color: C.text, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', textAlign: 'right', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s, opacity 0.15s', opacity: saving ? 0.6 : 1 }}
        onFocus={(e) => { if (!errorMessage) e.target.style.borderColor = C.accent; }}
        onBlur={(e) => { if (!errorMessage) e.target.style.borderColor = C.border; }}
      />
      <button
        onClick={() => onSave(draft)}
        disabled={!dirty || saving}
        style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${dirty && !saving ? C.accent : C.border}`, background: dirty && !saving ? C.accent : 'transparent', color: dirty && !saving ? '#fff' : C.muted, cursor: dirty && !saving ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', padding: 0, opacity: dirty && !saving ? 1 : 0.5 }}
        aria-label="Sauvegarder"
      >
        {saving ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'ceoSpin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    </div>
  );
}
