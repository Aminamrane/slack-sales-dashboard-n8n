// TrackingSheetFinance/index.jsx — Tracking Finance page (production).
//
// Plugged into the new backend (Phase 1+2) :
//   GET   /api/v1/finance-periods?period=YYYY-MM
//   GET   /api/v1/finance-periods/client/{id}/timeline
//   PATCH /api/v1/finance-periods/{row_id}
//   GET   /api/v1/finance-periods/{row_id}/audit
//
// Roles allowed : admin / finance_director / finance_team. Anyone else
// is redirected to '/'. Pattern mirrors Campaigns.jsx :77.
//
// Composition (Notion-like shell, v6 refonte 2026-05-08) :
//   - Left sidebar (collapsible, ~260px / 56px) with workspace header,
//     icon row, sections + items, footer composer. Mocks the CeoDashboard
//     layout for visual reference — content will be wired to real nav later.
//   - Main area :
//       · top bar : breadcrumb, "Dernière modif", share button, share icons
//       · title block : circular green icon + page name + subtitle
//       · tab row : "Toutes les périodes / Par état / Mes clients" + actions
//       · <TableView /> Notion-styled
//   - <ClientDetailModal /> for timeline + audit
//
// Optimistic edits :
//   PATCH succeeds → server returns the recomputed row, we replace it.
//   PATCH fails (422 / network) → toast + rollback to the original row.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Search, Calendar,
  AlertCircle, CheckCircle2, Home, MessageSquare, Mail, PanelLeft,
  Edit3, Plus, Filter, ArrowUpDown, MoreHorizontal, Share2,
  CheckCircle, Sparkles, FileText, Users, Settings, Clock,
  XCircle, CircleDot, FilterX, Eye,
  DollarSign, BarChart3, Trophy, Wallet, ShoppingBag, UserCircle, Megaphone, StickyNote, ListChecks,
} from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import companyLogo from '../../assets/my_image.png';
import '../../index.css';

import TableView, { AnimatedAmount } from './TableView.jsx';
import DetailPanel from './DetailPanel.jsx';
import {
  ALLOWED_ROLES,
  formatEUR,
  formatMonthLabel,
  shiftMonth,
  currentPeriod,
  parseDateFR,
  toNumber,
} from './constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Notion palette — single source of truth for surface tones.
// All colors picked to match Notion's web client (light theme).
// ─────────────────────────────────────────────────────────────────────────────
const N = {
  pageBg:        '#ffffff',         // main area background (canvas)
  sideBg:        '#ffffff',         // sidebar background (white, Apple clean)
  sideHover:     '#f5f5f4',         // sidebar item hover
  sideActive:    '#eeeeec',         // sidebar item active
  border:        '#e9e9e7',         // dividers + borders
  borderSoft:    '#f1f1ef',         // inline subtle borders
  text:          '#37352f',         // primary text (Notion's signature)
  textMuted:     '#787774',         // secondary text
  textFaint:     '#9b9a97',         // hint / placeholder
  accent:        '#2383e2',         // Notion blue (links, primary CTA)
  accentBg:      '#e7f0fb',         // blue tint
  green:         '#0f7b6c',         // "done" green
  greenBg:       '#ddedea',
  greenBgPill:   '#cfe9e3',
  red:           '#b74133',
  redBg:         '#ffe2dd',
  yellow:        '#cb912f',
  yellowBg:      '#fdecc8',
  purple:        '#6940a5',
  purpleBg:      '#eae4f2',
  pink:          '#ad1a72',
  pinkBg:        '#f4dfeb',
};

// Page-level CSS (animations + scrollbar). Inline styles everywhere else.
const STYLE_BLOCK = `
  @keyframes tsfFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes tsfPageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes tsfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .tsf-page { animation: tsfPageIn 0.45s cubic-bezier(0.4,0,0.2,1) both; }

  /* Notion-style thin scrollbar (hidden until hover for a cleaner canvas). */
  .tsf-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
  .tsf-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
  .tsf-scroll:hover::-webkit-scrollbar-thumb { background: rgba(55,53,47,0.16); background-clip: padding-box; }
  .tsf-scroll::-webkit-scrollbar-thumb:hover { background: rgba(55,53,47,0.32); background-clip: padding-box; }
  .tsf-scroll::-webkit-scrollbar-track { background: transparent; }

  .tsf-side { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
  .tsf-side-item { transition: background 0.12s ease; }
  .tsf-side-item:hover { background: ${N.sideHover}; }
  .tsf-icon-btn { transition: background 0.12s, color 0.12s; }
  .tsf-icon-btn:hover { background: ${N.sideHover}; }

  /* Subtle "gallery item" hover feedback used in the main area. */
  .tsf-tab { position: relative; transition: color 0.12s; }
  .tsf-tab:hover { color: ${N.text}; }
  .tsf-tab[data-active="true"]::after {
    content: '';
    position: absolute; left: 0; right: 0; bottom: -1px;
    height: 2px; background: ${N.text}; border-radius: 2px;
  }

  /* Hide-on-collapse helper — keeps DOM but eats opacity quickly. */
  .tsf-side-collapsed-hidden { opacity: 0; pointer-events: none; }

  /* Copy-to-clipboard wrapper : reveal the Copy button at hover.
     Used in the DetailPanel (every editable value) and around any
     CopyWrapper instance. */
  .tsf-copy-wrap .tsf-copy-btn { opacity: 0; }
  .tsf-copy-wrap:hover .tsf-copy-btn { opacity: 0.6; }
  .tsf-copy-wrap .tsf-copy-btn:hover { opacity: 1; background: ${N.sideHover}; color: ${N.text}; }

  /* "OUVRIR" button — appears at hover on the Nom + entreprise cell.
     Overlay positioning, doesn't push content, Notion-style. */
  .tsf-open-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: #ffffff;
    border: 1px solid #e3e2e0;
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(15,15,15,0.08);
    color: #37352f;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    cursor: pointer;
    opacity: 0;
    transition: opacity 100ms ease;
    font-family: inherit;
    pointer-events: none;
    user-select: none;
    z-index: 3;
  }
  .tsf-row:hover .tsf-open-btn { opacity: 1; pointer-events: auto; }
  .tsf-open-btn:hover { background: #f7f7f5; }

  /* Column hide button — invisible by default, appears on sub-header hover. */
  .tsf-subheader-cell .tsf-hide-col-btn { opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
  .tsf-subheader-cell:hover .tsf-hide-col-btn { opacity: 0.8; pointer-events: auto; }
  .tsf-subheader-cell .tsf-hide-col-btn:hover { opacity: 1; background: rgba(0,0,0,0.08) !important; border-radius: 4px; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Mock sidebar content (mirrors CeoDashboard layout). Real content TBD with dev.
// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  {
    key: 'recent', label: 'Récentes',
    items: [
      { id: 'finance-tracking', label: 'Tracking Finance', lucideIcon: DollarSign, color: '#0f7b6c', active: true },
      { id: 'perf-closing',     label: 'Perf. Closing',    lucideIcon: BarChart3,  color: '#2383e2' },
      { id: 'sales-leaderboard',label: 'Leaderboard',      lucideIcon: Trophy,     color: '#d9730d' },
    ],
  },
  {
    key: 'workspace', label: 'Espace de travail',
    items: [
      { id: 'finance',     label: 'Finance',     lucideIcon: Wallet,     color: '#0f7b6c' },
      { id: 'acquisition', label: 'Acquisition', lucideIcon: ShoppingBag, color: '#2383e2' },
      { id: 'human',       label: 'Human',       lucideIcon: UserCircle,  color: '#6940a5' },
      { id: 'marketing',   label: 'Marketing',   lucideIcon: Megaphone,   color: '#d44c8f' },
    ],
  },
  {
    key: 'private', label: 'Pages privées',
    items: [
      { id: 'notes', label: 'Notes', lucideIcon: StickyNote,  color: '#787774' },
      { id: 'todo',  label: 'To-do', lucideIcon: ListChecks,  color: '#787774' },
    ],
  },
];

// Tiny colored "page emblem" — Notion's signature visual cue per item.
function PageEmblem({ kind, size = 18 }) {
  const map = {
    'doc-green':    { bg: N.greenBg,  fg: N.green  },
    'doc-blue':     { bg: N.accentBg, fg: N.accent },
    'doc-yellow':   { bg: N.yellowBg, fg: N.yellow },
    'doc-grey':     { bg: '#ececeb', fg: N.textMuted },
    'folder-green': { bg: N.greenBg,  fg: N.green  },
    'folder-blue':  { bg: N.accentBg, fg: N.accent },
    'folder-purple':{ bg: N.purpleBg, fg: N.purple },
    'folder-pink':  { bg: N.pinkBg,   fg: N.pink   },
  };
  const c = map[kind] || map['doc-grey'];
  return (
    <span style={{
      width: size, height: size,
      flexShrink: 0,
      borderRadius: 4,
      background: c.bg, color: c.fg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <FileText size={Math.round(size * 0.6)} strokeWidth={1.8} />
    </span>
  );
}

export default function TrackingSheetFinance() {
  const navigate = useNavigate();

  // ── Embed mode (CEO Dispatch wrapper) ────────────────────────────────
  // Quand `?embed=true` est présent dans la query, on masque la sidebar
  // interne TSF + désactive son toggle (la CeoSidebar de CeoDispatchView
  // prend le relais). Le CEO est aussi autorisé à passer le gate dans ce
  // mode uniquement, sans élargir ALLOWED_ROLES global.
  const embedMode = useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === 'true',
    []
  );

  // ── Auth gating (mirrors Campaigns.jsx) ─────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate('/login'); return; }
    const allowed = ALLOWED_ROLES.includes(user.role) || (embedMode && user.role === 'ceo');
    if (!allowed) { navigate('/'); return; }
    setAuthChecked(true);
  }, [navigate, embedMode]);

  // ── State ────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Multi-select : Set des filtres actifs (vide = aucun filtre, row visible).
  // Toggle : re-click sur un filtre actif le désélectionne (demande dev 2026-05-11).
  const [tableFilters, setTableFilters] = useState(() => new Set());
  const [hiddenColsInfo, setHiddenColsInfo] = useState({ count: 0, keys: [] });
  const showAllColsRef = useRef(null);
  const showColRef = useRef(null);
  const onHiddenColsChange = useCallback((cols, colLabels) => setHiddenColsInfo({ count: cols.size, keys: [...cols], labels: colLabels || {} }), []);

  // Apply business filters to rows (union des filtres : un lead matche s'il
  // satisfait AU MOINS UN filtre actif).
  const filteredRows = useMemo(() => {
    if (tableFilters.size === 0) return rows;
    // Parser FR/ISO factorisé dans constants.js (`parseDateFR`).
    return rows.filter((r) => {
      const overdueCurrent = toNumber(r.overdue_owner_current_month) + toNumber(r.overdue_optilex_current_month);
      const overdueCumul = toNumber(r.overdue_owner_cumulative) + toNumber(r.overdue_optilex_cumulative);
      const matchOnboarding = () => {
        const d = parseDateFR(r.client?.rdv_onboarding);
        return d !== null && d.getTime() > Date.now();
      };
      // OR logic : matche si UN des filtres actifs est vrai
      if (tableFilters.has('onboarding_upcoming') && matchOnboarding()) return true;
      if (tableFilters.has('overdue_current') && overdueCurrent > 0 && overdueCumul === 0) return true;
      if (tableFilters.has('overdue_current_and_past') && overdueCurrent > 0 && overdueCumul > 0) return true;
      if (tableFilters.has('overdue_past_only') && overdueCurrent === 0 && overdueCumul > 0) return true;
      return false;
    });
  }, [rows, tableFilters]);

  // Toggle d'un filtre : ajoute si absent, retire si présent
  const toggleTableFilter = useCallback((filterValue) => {
    setTableFilters((prev) => {
      const next = new Set(prev);
      if (filterValue === null) {
        next.clear(); // "Aucun filtre" reset tout
      } else if (next.has(filterValue)) {
        next.delete(filterValue);
      } else {
        next.add(filterValue);
      }
      return next;
    });
  }, []);

  // Sidebar collapsed state (persisted).
  // Sidebar collapsée par défaut sur cette page (refonte tableau central
  // 2026-05-11) — finance team a besoin du max d'espace horizontal pour le
  // tableau. User peut l'ouvrir manuellement, choix préservé via localStorage.
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem('tsfSideCollapsed');
    return stored === null ? true : stored === 'true';
  });
  useEffect(() => {
    localStorage.setItem('tsfSideCollapsed', String(sideCollapsed));
  }, [sideCollapsed]);

  // Tab row (purely cosmetic on this 1st pass — wired later).
  const [activeTab, setActiveTab] = useState('all');

  // DetailPanel (slide-in right) — caller-controlled
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelClientId, setPanelClientId] = useState(null);
  const [panelRowId, setPanelRowId] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Fetch period rows ───────────────────────────────────────────────
  const fetchPeriod = useCallback(async (p, { soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get(`/api/v1/finance-periods?period=${encodeURIComponent(p)}`);
      setRows(Array.isArray(data?.periods) ? data.periods : []);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Erreur lors du chargement');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchPeriod(period);
  }, [authChecked, period, fetchPeriod]);

  // ── Patch a row (optimistic + reconcile) ─────────────────────────────
  const onPatchRow = useCallback(async (rowId, patch) => {
    const prev = rows.find((r) => r.id === rowId);
    if (!prev) return;

    setRows((rs) => rs.map((r) => r.id === rowId ? { ...r, ...patch } : r));

    try {
      const updated = await apiClient.patch(`/api/v1/finance-periods/${rowId}`, patch);
      setRows((rs) => rs.map((r) => r.id === rowId ? { ...r, ...updated } : r));
    } catch (e) {
      setRows((rs) => rs.map((r) => r.id === rowId ? prev : r));
      const msg = e?.data?.detail || e?.message || 'Erreur lors de la sauvegarde';
      showToast(typeof msg === 'string' ? msg : 'Erreur 422 — valeur refusée par le serveur', 'error');
      throw e;
    }
  }, [rows, showToast]);

  // ── KPI summary ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let expectedGlobal = 0;
    let receivedOwner = 0;
    let receivedOptilex = 0;
    let overdueOwner = 0;
    let overdueOptilex = 0;

    rows.forEach((r) => {
      expectedGlobal   += toNumber(r.expected_global_ttc) || 0;
      receivedOwner    += toNumber(r.received_owner) || 0;
      receivedOptilex  += toNumber(r.received_optilex_ttc) || 0;
      overdueOwner     += toNumber(r.overdue_owner_current_month) || 0;
      overdueOptilex   += toNumber(r.overdue_optilex_current_month) || 0;
    });

    return {
      total: rows.length,
      expectedGlobal,
      receivedTotal: receivedOwner + receivedOptilex,
      overdueTotal: overdueOwner + overdueOptilex,
    };
  }, [rows]);

  // ── DetailPanel handlers ──────────────────────────────────────────────
  // The panel is opened *only* via the explicit "OUVRIR" button on the
  // Nom + entreprise cell. Generic row clicks no longer open the panel —
  // editable cells stay clickable (they stopPropagation internally).
  // Toggle : re-cliquer OUVRIR sur la même row alors que le panel est déjà
  // ouvert ferme le panel (demande dev 2026-05-11).
  const onOpenRow = useCallback((row) => {
    setPanelOpen((wasOpen) => {
      // Si déjà ouvert SUR LA MÊME row → ferme. Sinon ouvre / change de row.
      if (wasOpen && panelRowId === row.id) {
        return false;
      }
      setPanelClientId(row.client_id);
      setPanelRowId(row.id);
      return true;
    });
  }, [panelRowId]);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const onSelectPanelRow = useCallback((rowId) => setPanelRowId(rowId), []);

  // ── Refresh ─────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    fetchPeriod(period, { soft: true });
  }, [period, fetchPeriod]);

  // Last-modif label : derived from rows (max updated_at). Falls back to "—".
  const lastModif = useMemo(() => {
    if (!rows.length) return null;
    let max = 0;
    rows.forEach((r) => {
      const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      if (t > max) max = t;
    });
    if (!max) return null;
    return new Date(max).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }, [rows]);

  if (!authChecked) {
    return null;
  }

  const sideWidth = sideCollapsed ? 56 : 260;

  return (
    <div className="tsf-page" style={{
      height: '100vh',
      overflow: 'hidden',
      background: N.sideBg,
      color: N.text,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      display: 'flex',
    }}>
      <style>{STYLE_BLOCK}</style>

      {/* ═══ LEFT SIDEBAR (Notion-style) ═══════════════════════════════
          En mode embed (CEO Dispatch), la sidebar interne est masquée :
          la CeoSidebar de CeoDispatchView prend le relais à gauche. */}
      {!embedMode && (
        <Sidebar
          width={sideWidth}
          collapsed={sideCollapsed}
          onToggle={() => setSideCollapsed((v) => !v)}
          sections={SIDEBAR_SECTIONS}
        />
      )}

      {/* ═══ MAIN AREA ═════════════════════════════════════════════════
          When the DetailPanel slide-in is open, we reserve space on the right
          via marginRight so the main area "shrinks" visually to ~60% (cf.
          split-view spec). The DetailPanel itself is `position: fixed`. */}
      <div style={{
        flex: 1,
        minWidth: 0,
        background: N.pageBg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Pas de marginRight quand panel ouvert : panel devient un vrai overlay
        // (position: fixed dans DetailPanel.jsx) → tableau reste pleine largeur
        // en background. Click hors panel ou ESC pour fermer.
      }}>
        {/* Top bar : breadcrumb + last-modif + share */}
        <TopBar
          period={period}
          lastModif={lastModif}
          onShowSidebar={() => setSideCollapsed(false)}
          showSidebarToggle={!embedMode && sideCollapsed}
        />

        {/* Main content area — flex column pour que le tableau prenne tout
            l'espace vertical restant (refonte 2026-05-11 : tableau pleine
            hauteur comme Google Sheets, scrollbar horizontale en bas écran). */}
        <div className="tsf-scroll" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '0 16px 8px',
          minHeight: 0,
        }}>
          {/* Title block */}
          <TitleBlock
            kpis={kpis}
            loading={loading}
          />

          {/* Tab row + actions */}
          <TabRow
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            period={period}
            setPeriod={setPeriod}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tableFilters={tableFilters}
            onToggleFilter={toggleTableFilter}
            hiddenColsInfo={hiddenColsInfo}
            onShowAllCols={() => showAllColsRef.current?.()}
            onShowCol={(key) => showColRef.current?.(key)}
          />

          {error && (
            <div style={{
              margin: '12px 0',
              padding: 14,
              background: N.redBg,
              border: `1px solid ${N.red}33`,
              color: N.red,
              borderRadius: 6,
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Table — flex: 1 pour prendre toute la hauteur restante */}
          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
              <TableView
                rows={filteredRows}
                onPatchRow={onPatchRow}
                onOpenRow={onOpenRow}
                activeRowId={panelOpen ? panelRowId : null}
                splitActive={false}
                loading={loading}
                searchQuery={searchQuery}
                onShowToast={showToast}
                onHiddenColsChange={onHiddenColsChange}
                showAllColsRef={showAllColsRef}
                showColRef={showColRef}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <DetailPanel
        open={panelOpen}
        clientId={panelClientId}
        rowId={panelRowId}
        onClose={closePanel}
        onSelectRow={onSelectPanelRow}
        onPatchRow={onPatchRow}
        onShowToast={showToast}
        rows={rows}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: toast.type === 'error' ? N.red : N.text,
              color: '#fff', padding: '11px 18px', borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 12px 32px rgba(15,15,15,0.15)',
              zIndex: 10000,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              maxWidth: 'min(560px, 90vw)',
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════════════
function Sidebar({ width, collapsed, onToggle, sections }) {
  return (
    <motion.aside
      className="tsf-side"
      animate={{ width }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        flexShrink: 0,
        background: N.sideBg,
        borderRight: `1px solid ${N.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Workspace header */}
      <WorkspaceHeader collapsed={collapsed} />

      {/* Icon row : Home / Chat / Mail / Search */}
      <IconRow collapsed={collapsed} />

      {/* Sections */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="tsf-scroll">
        {sections.map((sec) => (
          <SidebarSection key={sec.key} section={sec} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer composer */}
      <SidebarFooter collapsed={collapsed} onToggle={onToggle} />
    </motion.aside>
  );
}

function WorkspaceHeader({ collapsed }) {
  return (
    <div style={{
      padding: collapsed ? '10px 8px' : '10px 8px 6px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 6,
    }}>
      <button
        className="tsf-icon-btn"
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 6px',
          borderRadius: 4,
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          minWidth: 0,
        }}
      >
        <span style={{
          width: 22, height: 22,
          flexShrink: 0,
          borderRadius: 4,
          background: '#fff',
          border: `1px solid ${N.border}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src={companyLogo} alt="Owner" style={{ width: 18, height: 18, objectFit: 'contain' }} />
        </span>
        {!collapsed && (
          <>
            <span style={{
              fontSize: 14, fontWeight: 600, color: N.text,
              letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Owner Technology
            </span>
            <ChevronDown size={14} style={{ color: N.textMuted, flexShrink: 0, marginLeft: 'auto' }} />
          </>
        )}
      </button>
    </div>
  );
}

function IconRow({ collapsed }) {
  const items = [
    { key: 'home',   icon: <Home size={16} />,          label: 'Accueil' },
    { key: 'inbox',  icon: <MessageSquare size={16} />, label: 'Discussions' },
    { key: 'mail',   icon: <Mail size={16} />,          label: 'Boîte de réception' },
    { key: 'search', icon: <Search size={16} />,        label: 'Recherche' },
  ];
  return (
    <div style={{
      display: collapsed ? 'flex' : 'grid',
      flexDirection: collapsed ? 'column' : undefined,
      gridTemplateColumns: collapsed ? undefined : 'repeat(4, 1fr)',
      gap: 2,
      padding: collapsed ? '4px 8px 8px' : '0 8px 6px',
    }}>
      {items.map((it) => (
        <button
          key={it.key}
          className="tsf-icon-btn"
          title={it.label}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            padding: '6px 0',
            borderRadius: 4,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: N.textMuted, fontFamily: 'inherit',
          }}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function SidebarSection({ section, collapsed }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: collapsed ? '4px 6px' : '4px 8px' }}>
      {!collapsed && (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 6px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit',
            color: N.textFaint,
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.01em',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <ChevronDown
            size={12}
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
              color: N.textFaint,
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {section.label}
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
              {section.items.map((item) => (
                <SidebarItem key={item.id} item={item} collapsed={collapsed} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ item, collapsed }) {
  return (
    <button
      className="tsf-side-item"
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: collapsed ? '6px 0' : '4px 6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        border: 'none',
        background: item.active ? N.sideActive : 'transparent',
        cursor: 'pointer',
        borderRadius: 4,
        fontFamily: 'inherit',
        color: N.text,
        fontSize: 14,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
      }}
    >
      {item.lucideIcon ? (
        <span style={{
          width: 20, height: 20, flexShrink: 0, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: item.color || N.textMuted,
        }}>
          <item.lucideIcon size={16} strokeWidth={1.8} />
        </span>
      ) : (
        <PageEmblem kind={item.icon} size={18} />
      )}
      {!collapsed && (
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: item.active ? 500 : 400,
          color: N.text,
          flex: 1,
        }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

function SidebarFooter({ collapsed, onToggle }) {
  return (
    <div style={{
      borderTop: `1px solid ${N.border}`,
      padding: collapsed ? '6px 6px' : '6px 8px',
      display: 'flex',
      flexDirection: collapsed ? 'column' : 'row',
      alignItems: 'center',
      gap: 6,
    }}>
      {!collapsed && (
        <button
          className="tsf-side-item"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'inherit',
            color: N.text,
            fontSize: 13,
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          <Sparkles size={14} style={{ color: N.textMuted }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Nouvelle discussion
          </span>
          <span style={{
            fontSize: 11, color: N.textFaint,
            background: '#fff',
            border: `1px solid ${N.border}`,
            borderRadius: 3,
            padding: '0 4px',
            fontFamily: 'inherit',
          }}>
            ⌘O
          </span>
        </button>
      )}

      {/* Collapse / expand toggle */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        className="tsf-icon-btn"
        style={{
          width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer',
          borderRadius: 4,
          color: N.textMuted,
        }}
      >
        <PanelLeft size={15} />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TOP BAR (breadcrumb + last-modif + share)
// ════════════════════════════════════════════════════════════════════════════
function TopBar({ period, lastModif, onShowSidebar, showSidebarToggle }) {
  return (
    <div style={{
      height: 44,
      flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 16px 0 16px',
      borderBottom: `1px solid ${N.border}`,
      background: N.pageBg,
      gap: 10,
    }}>
      {/* When sidebar is collapsed, expose a re-open button on the canvas */}
      {showSidebarToggle && (
        <button
          onClick={onShowSidebar}
          className="tsf-icon-btn"
          title="Étendre la barre latérale"
          style={{
            width: 26, height: 26,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer',
            borderRadius: 4, color: N.textMuted,
          }}
        >
          <PanelLeft size={15} />
        </button>
      )}

      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: N.textMuted,
        minWidth: 0,
      }}>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Finance
        </span>
        <ChevronRight size={12} style={{ color: N.textFaint }} />
        <span style={{ color: N.text, fontWeight: 500 }}>
          Tracking
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Last modif */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12.5, color: N.textMuted,
      }}>
        <Clock size={12} />
        <span>Dernière modif{lastModif ? ` : ${lastModif}` : ''}</span>
      </div>

      {/* Share button */}
      <button
        className="tsf-icon-btn"
        style={{
          padding: '5px 10px',
          fontSize: 13,
          color: N.text,
          border: 'none', background: 'transparent', cursor: 'pointer',
          borderRadius: 4,
          fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        Partager
      </button>

      {/* Share icons : comment, star, more */}
      <button
        className="tsf-icon-btn"
        title="Commentaires"
        style={iconBtnStyle}
      >
        <MessageSquare size={15} />
      </button>
      <button
        className="tsf-icon-btn"
        title="Plus"
        style={iconBtnStyle}
      >
        <MoreHorizontal size={15} />
      </button>
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', cursor: 'pointer',
  borderRadius: 4,
  color: N.textMuted,
};

// ════════════════════════════════════════════════════════════════════════════
// TITLE BLOCK (icon + title + subtitle + KPI strip)
// ════════════════════════════════════════════════════════════════════════════
function TitleBlock({ kpis, loading }) {
  // Compactage 2026-05-11 : titre 40 → 22, KPIs inline avec le titre,
  // padding vertical réduit → max d'espace vertical pour le tableau.
  return (
    <div style={{
      paddingTop: 20, paddingBottom: 12,
      display: 'flex', alignItems: 'center', gap: 14,
      flexWrap: 'wrap',
    }}>
      {/* Icon emblem compact */}
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: N.greenBgPill,
        color: N.green,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <CheckCircle size={18} strokeWidth={2.2} />
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 22, fontWeight: 700, color: N.text,
        margin: 0,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        Tracking Finance
      </h1>

      {/* KPI mini-table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, auto)',
        marginLeft: 12,
        border: `1px solid ${N.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}>
        {[
          { label: 'Clients', value: loading ? '…' : kpis.total, color: N.text, dot: N.textFaint },
          { label: 'Attendu', value: loading ? '…' : formatEUR(kpis.expectedGlobal), color: N.text, dot: N.textFaint },
          { label: 'Reçu', value: loading ? '…' : <AnimatedAmount value={kpis.receivedTotal} style={{ fontWeight: 700, color: N.green }} />, color: N.green, dot: N.green },
          { label: 'Retard', value: loading ? '…' : <AnimatedAmount value={kpis.overdueTotal} style={{ fontWeight: 700, color: kpis.overdueTotal > 0 ? N.red : N.text }} />, color: kpis.overdueTotal > 0 ? N.red : N.text, dot: kpis.overdueTotal > 0 ? N.red : N.textFaint },
        ].map((kpi, i) => (
          <div key={i} style={{
            padding: '8px 16px',
            borderRight: i < 3 ? `1px solid ${N.borderSft}` : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            minWidth: 90,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: N.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {kpi.label}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiInline({ label, value, tone = 'neutral' }) {
  const palette = {
    neutral: { fg: N.text,  dotBg: N.textFaint },
    green:   { fg: N.green, dotBg: N.green },
    red:     { fg: N.red,   dotBg: N.red },
  }[tone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 13,
      color: N.textMuted,
      background: 'transparent',
      transition: 'background 0.12s',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = N.sideHover}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: palette.dotBg,
      }} />
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color: palette.fg, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB ROW (period nav + tabs + actions + new)
// ════════════════════════════════════════════════════════════════════════════
const FILTER_OPTIONS = [
  { value: null,                       label: 'Aucun filtre',                     Icon: FilterX     },
  { value: 'onboarding_upcoming',      label: 'RDV onboarding à venir',           Icon: Calendar    },
  { value: 'overdue_current',          label: 'Retard mois courant',              Icon: CircleDot   },
  { value: 'overdue_current_and_past', label: 'Retard mois courant + précédents', Icon: AlertCircle },
  { value: 'overdue_past_only',        label: 'Retard mois précédents seulement', Icon: Clock       },
];

function FilterDropdown({ values, onToggle }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset search at close
  useEffect(() => { if (!open) setSearch(''); }, [open]);

  const active = values && values.size > 0;
  const activeCount = values ? values.size : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FILTER_OPTIONS;
    return FILTER_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [search]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="tsf-icon-btn"
        title={active ? `${activeCount} filtre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}` : 'Filtrer'}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...iconBtnStyle,
          background: active ? N.rowHover : iconBtnStyle.background,
          color: active ? N.text : iconBtnStyle.color,
          position: 'relative',
        }}
      >
        <Filter size={14} />
        {active && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 14, height: 14, padding: '0 3px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 7,
            background: N.accent,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'inherit',
          }}>{activeCount}</span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%', right: 0,
            marginTop: 4,
            width: 320,
            background: '#fff',
            border: `1px solid ${N.border}`,
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(15,15,15,0.12), 0 1px 3px rgba(15,15,15,0.06)',
            zIndex: 100,
            padding: '8px 6px',
            fontFamily: 'inherit',
          }}
        >
          {/* Champ recherche (style Notion capture #37) */}
          <div style={{ padding: '4px 6px 8px' }}>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Filtrer par…"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 14,
                border: `2px solid ${N.accent}`,
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'inherit',
                color: N.text,
                background: '#fafafa',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Liste options */}
          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: N.textMuted, textAlign: 'center' }}>
              Aucun filtre trouvé
            </div>
          )}
          {filtered.map((opt) => {
            // "Aucun filtre" (value = null) : actif si Set vide. Click → clear tout.
            // Autres options : actif si dans le Set. Click → toggle (add/remove).
            const isAucun = opt.value === null;
            const isActive = isAucun ? !active : values && values.has(opt.value);
            const Icon = opt.Icon;
            return (
              <button
                key={String(opt.value)}
                onClick={() => {
                  onToggle(opt.value);
                  // Ne PAS fermer la dropdown : multi-select, dev peut continuer à toggler
                  // Exception : si on click "Aucun filtre", on ferme (action terminée)
                  if (isAucun) setOpen(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 14px',
                  border: 'none',
                  background: isActive ? N.sideHover : 'transparent',
                  borderRadius: 6,
                  fontSize: 14,
                  color: N.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = N.sideHover; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={18} strokeWidth={1.8} style={{ flexShrink: 0, color: N.textMuted }} />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {isActive && !isAucun && <span style={{ color: N.accent, fontSize: 14 }}>✓</span>}
              </button>
            );
          })}

          {/* Footer : filtre avancé (placeholder MVP) */}
          <div style={{
            marginTop: 4,
            paddingTop: 4,
            borderTop: `1px solid ${N.borderSoft}`,
          }}>
            <button
              type="button"
              disabled
              title="Bientôt"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                borderRadius: 6,
                fontSize: 14,
                color: N.textMuted,
                textAlign: 'left',
                cursor: 'not-allowed',
                fontFamily: 'inherit',
                opacity: 0.7,
              }}
            >
              <Plus size={18} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Ajouter un filtre avancé</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HiddenColsPill({ hiddenKeys, labels, onShowCol, onShowAll }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = hiddenKeys.length;
  return (
    <div ref={ref} style={{ position: 'relative', marginRight: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          height: 26, padding: '0 12px',
          background: open ? '#d0e8fd' : '#e8f4fd', color: '#1e6bb8',
          border: '1px solid #bdd8ef', borderRadius: 6,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = '#d0e8fd'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = '#e8f4fd'; }}
      >
        <Eye size={13} strokeWidth={1.8} />
        <span>{count} masquée{count > 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          minWidth: 220, background: '#fff',
          border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,15,15,0.12), 0 2px 6px rgba(15,15,15,0.06)',
          padding: '6px 0', zIndex: 200,
        }}>
          <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Colonnes masquées
          </div>
          {hiddenKeys.map((key) => (
            <button
              key={key}
              onClick={() => { onShowCol(key); if (count <= 1) setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 14px', border: 'none', background: 'transparent',
                color: '#37352f', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Eye size={14} strokeWidth={1.8} style={{ color: '#1e6bb8', flexShrink: 0 }} />
              <span>{labels[key] || key}</span>
            </button>
          ))}
          {count > 1 && (
            <>
              <div style={{ height: 1, background: '#f1f1ef', margin: '4px 0' }} />
              <button
                onClick={() => { onShowAll(); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 14px', border: 'none', background: 'transparent',
                  color: '#787774', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  fontStyle: 'italic', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Tout réafficher
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TabRow({
  activeTab, setActiveTab,
  period, setPeriod,
  searchQuery, setSearchQuery,
  onRefresh, refreshing,
  hiddenColsInfo = { count: 0, keys: [] }, onShowAllCols, onShowCol,
  tableFilters, onToggleFilter,
}) {
  const tabs = [
    { key: 'all',     label: 'Toutes les périodes' },
    { key: 'state',   label: 'Par état' },
    { key: 'mine',    label: 'Mes clients' },
  ];

  return (
    <div style={{
      marginTop: 32,
      display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${N.border}`,
      gap: 4,
      paddingBottom: 0,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              data-active={active}
              className="tsf-tab"
              onClick={() => setActiveTab(t.key)}
              style={{
                position: 'relative',
                padding: '6px 4px 8px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? N.text : N.textMuted,
              }}
            >
              {t.label}
            </button>
          );
        })}

        {/* Add view "+" */}
        <button
          className="tsf-icon-btn"
          title="Ajouter une vue"
          style={{
            width: 24, height: 24,
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: N.textFaint,
            borderRadius: 4,
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Hidden columns dropdown — left of month nav */}
      {hiddenColsInfo.count > 0 && (
        <HiddenColsPill
          hiddenKeys={hiddenColsInfo.keys}
          labels={hiddenColsInfo.labels || {}}
          onShowCol={onShowCol}
          onShowAll={onShowAllCols}
        />
      )}

      {/* Period navigator (compact) */}
      <MonthNavigator period={period} setPeriod={setPeriod} />

      {/* Action icons row */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
        <SearchInline value={searchQuery} onChange={setSearchQuery} />
        <FilterDropdown values={tableFilters} onToggle={onToggleFilter} />
        <button
          className="tsf-icon-btn"
          title="Trier"
          style={iconBtnStyle}
        >
          <ArrowUpDown size={14} />
        </button>
        <button
          className="tsf-icon-btn"
          title="Recharger"
          onClick={onRefresh}
          disabled={refreshing}
          style={{ ...iconBtnStyle, cursor: refreshing ? 'wait' : 'pointer' }}
        >
          <motion.span
            animate={{ rotate: refreshing ? 360 : 0 }}
            transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            style={{ display: 'inline-flex' }}
          >
            <RefreshCw size={14} />
          </motion.span>
        </button>
        <button
          className="tsf-icon-btn"
          title="Réglages"
          style={iconBtnStyle}
        >
          <Settings size={14} />
        </button>

        {/* Primary CTA — Notion blue */}
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: N.accent, color: '#fff',
            border: 'none', cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: 4,
            fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit',
            marginLeft: 4,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1a6fc2'}
          onMouseLeave={(e) => e.currentTarget.style.background = N.accent}
        >
          Nouveau
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Search inline (collapses to icon, expands on focus) ──────────────────────
function SearchInline({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!open && !value) {
    return (
      <button
        className="tsf-icon-btn"
        title="Rechercher"
        onClick={() => setOpen(true)}
        style={iconBtnStyle}
      >
        <Search size={14} />
      </button>
    );
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#fff',
      border: `1px solid ${N.border}`,
      borderRadius: 4,
      padding: '3px 6px',
      width: 180,
    }}>
      <Search size={13} style={{ color: N.textMuted, flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={() => { if (!value) setOpen(false); }}
        placeholder="Rechercher société..."
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          fontSize: 13, fontFamily: 'inherit',
          color: N.text,
          flex: 1, minWidth: 0,
        }}
      />
    </div>
  );
}

// ── Month navigator ──────────────────────────────────────────────────────────
function MonthNavigator({ period, setPeriod }) {
  const dateInputRef = useRef(null);
  const onPickDate = (e) => {
    const v = e.currentTarget.value;
    if (!v) return;
    setPeriod(v.slice(0, 7));
  };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      marginRight: 4,
    }}>
      <button
        onClick={() => setPeriod(shiftMonth(period, -1))}
        title="Mois précédent"
        className="tsf-icon-btn"
        style={iconBtnStyle}
      >
        <ChevronLeft size={14} />
      </button>

      <button
        onClick={() => dateInputRef.current?.showPicker?.()}
        title="Choisir un mois"
        className="tsf-icon-btn"
        style={{
          border: 'none', outline: 'none', cursor: 'pointer',
          background: 'transparent',
          padding: '4px 8px', borderRadius: 4,
          fontSize: 13, fontWeight: 500, color: N.text,
          fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        <Calendar size={12} style={{ color: N.textMuted }} />
        <motion.span
          key={period}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          {formatMonthLabel(period)}
        </motion.span>
      </button>

      <button
        onClick={() => setPeriod(shiftMonth(period, 1))}
        title="Mois suivant"
        className="tsf-icon-btn"
        style={iconBtnStyle}
      >
        <ChevronRight size={14} />
      </button>

      <input
        ref={dateInputRef}
        type="month"
        value={period}
        onChange={(e) => e.currentTarget.value && setPeriod(e.currentTarget.value)}
        onInput={onPickDate}
        style={{
          position: 'absolute',
          width: 0, height: 0,
          opacity: 0, pointerEvents: 'none',
          border: 'none', padding: 0, margin: 0,
        }}
      />
    </div>
  );
}
