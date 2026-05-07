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
// Composition :
//   - SharedNavbar (top bar, dark mode)
//   - Sticky header (month nav, KPIs, search, refresh)
//   - <TableView /> virtualized (react-virtuoso) — 559+ rows
//   - <ClientDetailModal /> for timeline + audit
//
// Optimistic edits :
//   PATCH succeeds → server returns the recomputed row, we replace it.
//   PATCH fails (422 / network) → toast + rollback to the original row.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';
import '../../index.css';

import TableView from './TableView.jsx';
import ClientDetailModal from './ClientDetailModal.jsx';
import {
  ALLOWED_ROLES,
  formatEUR,
  formatMonthLabel,
  shiftMonth,
  currentPeriod,
  toNumber,
} from './constants.js';

// CSS injected once (animations + scrollbar). Inline-style elsewhere.
const STYLE_BLOCK = `
  @keyframes tsfFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes tsfPageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes tsfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .tsf-page { animation: tsfPageIn 0.45s cubic-bezier(0.4,0,0.2,1) both; }
  .tsf-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .tsf-scroll::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }
  .tsf-scroll::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
  .tsf-scroll::-webkit-scrollbar-track { background: transparent; }
`;

export default function TrackingSheetFinance() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  // ── Auth gating (mirrors Campaigns.jsx) ─────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate('/login'); return; }
    if (!ALLOWED_ROLES.includes(user.role)) { navigate('/'); return; }
    setAuthChecked(true);
  }, [navigate]);

  // ── State ────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClientId, setModalClientId] = useState(null);
  const [modalRowId, setModalRowId] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Persist dark mode ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

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

    // Optimistic local update (just the patched fields).
    setRows((rs) => rs.map((r) => r.id === rowId ? { ...r, ...patch } : r));

    try {
      const updated = await apiClient.patch(`/api/v1/finance-periods/${rowId}`, patch);
      // Replace row entirely (server-recomputed overdue / global ttc).
      setRows((rs) => rs.map((r) => r.id === rowId ? { ...r, ...updated } : r));
      // No toast on success (the cell flashes "saved" by itself).
    } catch (e) {
      // Rollback.
      setRows((rs) => rs.map((r) => r.id === rowId ? prev : r));
      const msg = e?.data?.detail || e?.message || 'Erreur lors de la sauvegarde';
      showToast(typeof msg === 'string' ? msg : 'Erreur 422 — valeur refusée par le serveur', 'error');
      throw e; // EditableCell's flash relies on the rejection.
    }
  }, [rows, showToast]);

  // ── KPI summary ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let expectedOwner = 0;
    let expectedOptilex = 0;
    let expectedGlobal = 0;
    let receivedOwner = 0;
    let receivedOptilex = 0;
    let overdueOwner = 0;
    let overdueOptilex = 0;

    rows.forEach((r) => {
      expectedOwner    += toNumber(r.expected_owner) || 0;
      expectedOptilex  += toNumber(r.expected_optilex_ttc) || 0;
      expectedGlobal   += toNumber(r.expected_global_ttc) || 0;
      receivedOwner    += toNumber(r.received_owner) || 0;
      receivedOptilex  += toNumber(r.received_optilex_ttc) || 0;
      overdueOwner     += toNumber(r.overdue_owner_current_month) || 0;
      overdueOptilex   += toNumber(r.overdue_optilex_current_month) || 0;
    });

    return {
      total: rows.length,
      expectedOwner,
      expectedOptilex,
      expectedGlobal,
      receivedOwner,
      receivedOptilex,
      receivedTotal: receivedOwner + receivedOptilex,
      overdueOwner,
      overdueOptilex,
      overdueTotal: overdueOwner + overdueOptilex,
    };
  }, [rows]);

  // ── Modal handlers ──────────────────────────────────────────────────
  const openClient = useCallback((clientId) => {
    setModalClientId(clientId);
    setModalRowId(null);
    setModalOpen(true);
  }, []);
  const openAudit = useCallback((rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    setModalClientId(row.client_id);
    setModalRowId(rowId);
    setModalOpen(true);
  }, [rows]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // ── Refresh ─────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    fetchPeriod(period, { soft: true });
  }, [period, fetchPeriod]);

  if (!authChecked) {
    // Render nothing until auth is decided — avoids an empty-table flash
    // for unauthorized users before the redirect kicks in.
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafafa',
      color: '#111827',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{STYLE_BLOCK}</style>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="tsf-page" style={{ paddingTop: 76, paddingLeft: 32, paddingRight: 32, paddingBottom: 40, flex: 1 }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#9ca3af', marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
        }}>
          <span>Finance</span>
          <ChevronRight size={12} />
          <span style={{ color: '#374151' }}>Tracking</span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 32, fontWeight: 700, color: '#111827',
          margin: '0 0 6px', letterSpacing: '-0.025em',
        }}>
          Tracking Finance
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
          Suivi mensuel des paiements clients (Owner + Opti'Lex). Édition en place sauvegardée automatiquement.
        </p>

        {/* Toolbar : month nav + search + refresh */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          <MonthNavigator
            period={period}
            setPeriod={setPeriod}
          />

          <div style={{ flex: 1 }} />

          <SearchBox value={searchQuery} onChange={setSearchQuery} />

          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Recharger"
            style={{
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: refreshing ? 'wait' : 'pointer',
              padding: '7px 12px',
              borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 500, color: '#374151',
              fontFamily: 'inherit',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <motion.span
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
              style={{ display: 'inline-flex' }}
            >
              <RefreshCw size={13} />
            </motion.span>
            Recharger
          </button>
        </div>

        {/* KPI cards */}
        <KpiBar kpis={kpis} loading={loading} />

        {error && (
          <div style={{
            margin: '12px 0',
            padding: 14,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 10,
            fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Table */}
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <TableView
              rows={rows}
              onPatchRow={onPatchRow}
              onOpenClient={openClient}
              onOpenAudit={openAudit}
              loading={loading}
              searchQuery={searchQuery}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <ClientDetailModal
        open={modalOpen}
        clientId={modalClientId}
        initialRowId={modalRowId}
        onClose={closeModal}
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
              background: toast.type === 'error' ? '#991b1b' : '#111827',
              color: '#fff', padding: '11px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
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

// ── Month navigator (← Mai 2026 → + native date input shortcut) ─────────
function MonthNavigator({ period, setPeriod }) {
  const dateInputRef = useRef(null);
  const onPickDate = (e) => {
    const v = e.currentTarget.value; // YYYY-MM-DD
    if (!v) return;
    setPeriod(v.slice(0, 7));
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => setPeriod(shiftMonth(period, -1))}
        title="Mois précédent"
        style={navBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronLeft size={15} />
      </button>

      <button
        onClick={() => dateInputRef.current?.showPicker?.()}
        style={{
          border: 'none', outline: 'none', cursor: 'pointer',
          background: 'transparent',
          padding: '6px 12px', borderRadius: 8,
          fontSize: 14, fontWeight: 600, color: '#111827',
          fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          minWidth: 150, justifyContent: 'center',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Choisir un mois"
      >
        <Calendar size={13} style={{ color: '#6b7280' }} />
        <motion.span
          key={period}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          {formatMonthLabel(period)}
        </motion.span>
      </button>

      <button
        onClick={() => setPeriod(shiftMonth(period, 1))}
        title="Mois suivant"
        style={navBtnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronRight size={15} />
      </button>

      {/* Hidden date input — opens native picker for far-month nav */}
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

const navBtnStyle = {
  border: 'none', outline: 'none', cursor: 'pointer',
  background: 'transparent',
  padding: 7, borderRadius: 8,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: '#6b7280',
  transition: 'background 0.12s, color 0.12s',
};

// ── Search box ──────────────────────────────────────────────────────────
function SearchBox({ value, onChange }) {
  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex', alignItems: 'center',
      width: 220,
    }}>
      <Search size={13} style={{
        position: 'absolute', left: 10,
        color: '#9ca3af', pointerEvents: 'none',
      }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder="Rechercher société..."
        style={{
          width: '100%',
          padding: '7px 10px 7px 30px',
          fontSize: 13,
          fontFamily: 'inherit',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          outline: 'none',
          color: '#111827',
          background: '#fff',
          transition: 'border-color 0.12s',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
        onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
      />
    </div>
  );
}

// ── KPI bar ─────────────────────────────────────────────────────────────
function KpiBar({ kpis, loading }) {
  const cards = [
    { label: 'Clients ce mois',     value: kpis.total,            isCount: true },
    { label: 'Total attendu (TTC)', value: kpis.expectedGlobal,   tone: 'neutral' },
    { label: 'Total reçu',          value: kpis.receivedTotal,    tone: 'success' },
    { label: 'Retard mois courant', value: kpis.overdueTotal,     tone: kpis.overdueTotal > 0 ? 'danger' : 'neutral' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12, marginBottom: 16,
    }}>
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} loading={loading} />
      ))}
    </div>
  );
}

function KpiCard({ label, value, isCount = false, tone = 'neutral', loading }) {
  const palette = {
    neutral: { fg: '#111827', accent: '#6b7280' },
    success: { fg: '#065f46', accent: '#10b981' },
    danger:  { fg: '#991b1b', accent: '#ef4444' },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.accent }} />
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: palette.fg,
        letterSpacing: '-0.02em',
      }}>
        {loading ? (
          <span style={{
            display: 'inline-block', width: 80, height: 22,
            background: '#f3f4f6', borderRadius: 6,
            animation: 'tsfPulse 1.4s ease-in-out infinite',
          }} />
        ) : isCount ? (
          value
        ) : (
          formatEUR(value)
        )}
      </div>
    </motion.div>
  );
}
