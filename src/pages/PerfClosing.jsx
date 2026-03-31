import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Radar } from "react-chartjs-2";
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";
import apiClient from "../services/apiClient";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

import companyLogo from "../assets/my_image.png";
import iconGlobal from "../assets/global.png";
import iconFinance from "../assets/finance.png";
import iconFiles from "../assets/files.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";

/* ─── Config ──────────────────────────────────────────────────────────── */
const TABS = [
  { key: "dashboard",    label: "Dashboard",     icon: "📊" },
  { key: "perf_closing", label: "Perf.Closing",  icon: "📋" },
  { key: "coordonnees",  label: "Coordonnées",   icon: "📇" },
];

const ETAT_CONFIG = [
  { key: "a_signe",          label: "A signé",           color: "#10b981", bg: "#ecfdf5", icon: "✓" },
  { key: "en_attente",       label: "En attente",        color: "#f59e0b", bg: "#fffbeb", icon: "◷" },
  { key: "resilie",          label: "Résilié",            color: "#ef4444", bg: "#fef2f2", icon: "✕" },
  { key: "sans_suite",       label: "Sans suite",         color: "#94a3b8", bg: "#f8fafc", icon: "—" },
  { key: "liquidation",      label: "Liquidation",        color: "#8b5cf6", bg: "#f5f3ff", icon: "⚡" },
  { key: "pause",            label: "Pause",              color: "#64748b", bg: "#f1f5f9", icon: "⏸" },
  { key: "self_resiliation", label: "Self-résiliation",   color: "#f87171", bg: "#fef2f2", icon: "↩" },
  { key: "retractation",     label: "Rétractation",       color: "#fb923c", bg: "#fff7ed", icon: "↶" },
];

const COUNTER_DEFS = [
  { key: "en_cours",          label: "En cours",          color: "#5b6abf", icon: "●" },
  { key: "resilie",           label: "Résiliation",       color: "#ef4444", icon: "✕" },
  { key: "self_resiliation",  label: "Self-Résiliation",  color: "#f87171", icon: "↩" },
  { key: "liquidation",       label: "Liquidation",       color: "#8b5cf6", icon: "⚡" },
  { key: "pause",             label: "Pause",             color: "#64748b", icon: "⏸" },
  { key: "sans_suite",        label: "Sans suite",        color: "#94a3b8", icon: "—" },
  { key: "retractation",      label: "Rétractation",      color: "#fb923c", icon: "↶" },
];

const YOUSIGN_LABELS = { done: 'Signé', ongoing: 'En cours', expired: 'Expiré', canceled: 'Annulé', failed: 'Erreur', draft: 'Brouillon' };
const YOUSIGN_COLORS = { done: '#10b981', ongoing: '#3b82f6', expired: '#fb923c', canceled: '#94a3b8', failed: '#ef4444', draft: '#9ca3af' };

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const fmtDate = (val) => {
  if (!val) return '—';
  if (val.includes('/')) { const p = val.split(' ')[0].split('/'); return p.length === 3 ? `${p[0]}/${p[1]}/${p[2]}` : val.split(' ')[0]; }
  const d = val.slice(0, 10).split('-'); return `${d[2]}/${d[1]}/${d[0]}`;
};
const fmtDateShort = (val) => {
  if (!val) return '—';
  if (val.includes('/')) { const p = val.split(' ')[0].split('/'); return `${p[0]}/${p[1]}`; }
  const d = val.slice(0, 10).split('-'); return `${d[2]}/${d[1]}`;
};
const daysSince = (val) => {
  if (!val) return null;
  let date;
  if (val.includes('/')) { const p = val.split(' ')[0].split('/'); date = new Date(`${p[2]}-${p[1]}-${p[0]}`); }
  else date = new Date(val);
  if (isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
};

const normalizeName = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const AVATAR_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4'];
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
};
const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function PerfClosing() {
  const navigate = useNavigate();

  /* ── Dark mode ──────────────────────────────────────────────────────── */
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e5e7eb',
    surface: darkMode ? '#13141b' : '#f9fafb', text: darkMode ? '#eef0f6' : '#111827',
    muted: darkMode ? '#5e6273' : '#6b7280', subtle: darkMode ? '#252636' : '#f3f4f6',
    secondary: darkMode ? '#8b8fa0' : '#4b5563', accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    cardBg: darkMode ? '#23243a' : '#ffffff',
    rowHover: darkMode ? '#2a2b40' : '#f9fafb',
    headerBg: darkMode ? '#1a1b2e' : '#f9fafb',
  };

  /* ── State ──────────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [eodScores, setEodScores] = useState(null); // EOD scores for current week
  const [clients, setClients] = useState([]);
  const [coordonnees, setCoordonnees] = useState([]);
  const [updatingEtat, setUpdatingEtat] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEtat, setFilterEtat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('date_signature');
  const [sortDir, setSortDir] = useState('desc');

  // Pagination
  const [perfPage, setPerfPage] = useState(1);
  const [perfPerPage, setPerfPerPage] = useState(25);
  const [coordPage, setCoordPage] = useState(1);
  const [coordPerPage, setCoordPerPage] = useState(10);

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState(null);
  // Etat dropdown
  const [etatDropdown, setEtatDropdown] = useState(null);
  const etatDropdownRef = useRef(null);
  useEffect(() => {
    if (!etatDropdown) return;
    const close = (e) => { if (etatDropdownRef.current && !etatDropdownRef.current.contains(e.target)) setEtatDropdown(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [etatDropdown]);

  // User avatars mapping (name → avatar_url)
  const [userAvatars, setUserAvatars] = useState({});
  const [topSellers, setTopSellers] = useState([]); // top 4 from leaderboard
  const [totalMonthlySales, setTotalMonthlySales] = useState(0);

  /* ── Init ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        if (user.role !== 'admin') { navigate("/"); return; }
        await fetchDashboard();
        // Fetch user avatars from multiple sources
        try {
          const map = {};
          const addToMap = (name, avatar) => {
            if (!name || !avatar) return;
            const norm = normalizeName(name);
            map[norm] = avatar;
            // Also store by each individual word (first name, last name) as fallback
            norm.split(/\s+/).forEach(part => { if (part.length >= 3 && !map[part]) map[part] = avatar; });
          };
          // Source 1: all users
          try {
            const users = await apiClient.getUsers();
            (users || []).forEach(u => {
              const name = u.full_name || u.name || '';
              const avatar = u.avatar_url || u.slack_image || u.photo_url || u.image || '';
              addToMap(name, avatar);
            });
          } catch {}
          // Source 2: leaderboard (all time for avatars)
          try {
            const data = await apiClient.getLeaderboardStats('all');
            (data.all_sellers || []).forEach(s => addToMap(s.name, s.avatar_url));
            (data.teams || []).forEach(t => {
              addToMap(t.captain?.name, t.captain?.avatar_url);
              (t.members || []).forEach(m => addToMap(m.name, m.avatar_url));
            });
          } catch {}
          // Source 3: current month leaderboard for top sellers
          try {
            const monthly = await apiClient.getLeaderboardStats('current_month');
            const allSellers = monthly.all_sellers || [];
            const sorted = [...allSellers].sort((a, b) => (b.sales || 0) - (a.sales || 0));
            setTopSellers(sorted.slice(0, 4).map(s => ({
              name: s.name, sales: s.sales || 0, revenue: s.revenue || s.cash_collected || 0, avatar: s.avatar_url || '',
            })));
            setTotalMonthlySales(allSellers.reduce((sum, s) => sum + (s.sales || 0), 0));
          } catch {}
          setUserAvatars(map);
        } catch {}
      } catch { navigate("/login"); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const fetchDashboard = async () => {
    try { const r = await apiClient.get('/api/v1/perf-closing/dashboard'); setDashboard(r); } catch (e) { console.warn('Dashboard fetch failed:', e); }
    // Fetch EOD scores for current week
    try {
      const now = new Date();
      const day = now.getDay() || 7; // 1=Mon, 7=Sun
      const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
      const year = monday.getFullYear();
      const jan1 = new Date(year, 0, 1);
      const week = Math.ceil(((monday - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      const weekStr = `${year}-W${String(week).padStart(2, '0')}`;
      const resp = await apiClient.get(`/api/v1/eod/dashboard/scores?period=${weekStr}`);
      if (resp?.scores) {
        const DIMS = ['charge', 'energie', 'clarte', 'efficacite', 'relations', 'alignement'];
        const scores = resp.scores;
        const n = scores.length || 1;
        const avgGlobal = scores.reduce((s, d) => s + (d.global_score || 0), 0) / n;
        const dimAvgs = {};
        DIMS.forEach(dim => { dimAvgs[dim] = scores.reduce((s, d) => s + (d[dim] || 0), 0) / n; });
        setEodScores({ avgGlobal, dims: dimAvgs, count: scores.length, week: weekStr });
      }
    } catch (e) { console.warn('EOD scores fetch failed:', e); }
  };
  const fetchClients = async () => { try { const r = await apiClient.get('/api/v1/perf-closing/clients'); setClients(r.clients || []); } catch (e) { console.warn('Clients fetch failed:', e); } };
  const fetchCoordonnees = async () => { try { const r = await apiClient.get('/api/v1/perf-closing/coordonnees'); setCoordonnees(r.coordonnees || []); } catch (e) { console.warn('Coordonnees fetch failed:', e); } };

  const handleTabChange = async (idx) => {
    setActiveTab(idx);
    setSearchQuery('');
    setFilterEtat('all');
    setFilterStatus('all');
    setExpandedRow(null);
    if (TABS[idx].key === 'dashboard' && !dashboard) await fetchDashboard();
    if (TABS[idx].key === 'perf_closing' && clients.length === 0) await fetchClients();
    if (TABS[idx].key === 'coordonnees' && coordonnees.length === 0) await fetchCoordonnees();
  };

  const handleEtatChange = async (clientId, newEtat) => {
    setUpdatingEtat(clientId);
    try {
      await apiClient.patch(`/api/v1/perf-closing/clients/${clientId}`, { etat: newEtat });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, etat: newEtat } : c));
    } catch (e) { console.warn('Etat update failed:', e); }
    setUpdatingEtat(null);
  };

  /* ── Filtered + sorted clients ─────────────────────────────────────── */
  const filteredClients = useMemo(() => {
    let list = [...clients];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.societe || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.sales_name || '').toLowerCase().includes(q) ||
        (c.numero_client || '').toLowerCase().includes(q)
      );
    }
    if (filterEtat !== 'all') list = list.filter(c => (c.etat || 'a_signe') === filterEtat);
    // Sort by numero_client descending (newest first)
    list.sort((a, b) => {
      const na = parseInt((a.numero_client || '0').replace(/\D/g, ''), 10) || 0;
      const nb = parseInt((b.numero_client || '0').replace(/\D/g, ''), 10) || 0;
      return nb - na;
    });
    return list;
  }, [clients, searchQuery, filterEtat]);

  const filteredCoord = useMemo(() => {
    let list = [...coordonnees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.legal_name || c.client_company || c.client_name || '').toLowerCase().includes(q) ||
        (c.client_email || '').toLowerCase().includes(q) ||
        (c.representative_name || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(c => c.yousign_status === filterStatus);
    return list;
  }, [coordonnees, searchQuery, filterStatus]);

  const perfTotalPages = Math.max(1, Math.ceil(filteredClients.length / perfPerPage));
  const perfSlice = filteredClients.slice((perfPage - 1) * perfPerPage, perfPage * perfPerPage);
  const coordTotalPages = Math.max(1, Math.ceil(filteredCoord.length / coordPerPage));
  const coordSlice = filteredCoord.slice((coordPage - 1) * coordPerPage, coordPage * coordPerPage);

  // Reset page on filter change
  useEffect(() => { setPerfPage(1); }, [searchQuery, filterEtat, perfPerPage]);
  useEffect(() => { setCoordPage(1); }, [searchQuery, filterStatus, coordPerPage]);

  /* ── Grouped stats for etat pills ──────────────────────────────────── */
  const etatCounts = useMemo(() => {
    const counts = {};
    ETAT_CONFIG.forEach(e => { counts[e.key] = 0; });
    clients.forEach(c => { const k = c.etat || 'a_signe'; if (counts[k] !== undefined) counts[k]++; });
    return counts;
  }, [clients]);

  if (loading) return <div style={{ minHeight: '100vh', background: C.surface }} />;

  /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`
        @keyframes pcReveal { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes pcSlideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
        @keyframes pcRowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes pcCardPop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes pcExpandDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 400px; } }
        @keyframes pcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        html, body { background: ${darkMode ? '#13141b' : '#ffffff'}; }
        .pc-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
        .pc-scroll::-webkit-scrollbar-track { background: transparent; }
        .pc-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.10); border-radius: 4px; }
        .pc-row:hover { background: ${C.rowHover} !important; }
        .pc-row td { transition: background 0.15s ease; }
        .pc-input:focus { outline: none; border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accent}18; }
        .pc-select:focus { outline: none; border-color: ${C.accent}; }
        .pc-grid > span, .pc-grid > div { border-right: 1px solid ${darkMode ? '#2a2b36' : '#f0f0f3'}; align-self: stretch; display: flex; align-items: center; padding-right: 10px; }
        .pc-grid > span:last-child, .pc-grid > div:last-child { border-right: none; padding-right: 0; }
      `}</style>

      <div style={{ animation: 'pcReveal 0.5s cubic-bezier(0.4,0,0.2,1) both', fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', letterSpacing: '-0.011em' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>

          {/* ══ SIDEBAR ══════════════════════════════════════════════════ */}
          <div style={{
            width: 220, minWidth: 220, borderRight: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column',
            background: darkMode ? C.subtle : '#fafbfc',
            animation: 'pcSlideIn 0.4s ease both',
          }}>
            {/* Logo header */}
            <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 8, paddingTop: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: darkMode ? '#fff' : '#111827',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <img src={companyLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', filter: darkMode ? 'none' : 'brightness(0) invert(1)' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Owner</div>
              </div>
            </div>

            {/* Nav sections */}
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { section: null, items: [
                  { key: 'dashboard', label: 'Dashboard', tab: 0 },
                ]},
                { section: 'Human', items: [
                  { key: 'eod_report', label: 'EOD Report', href: '/eod-report' },
                  { key: 'eod_dashboard', label: 'Dashboard EOD', href: '/eod-dashboard' },
                ]},
                { section: 'Acquisition', items: [
                  { key: 'monitoring', label: 'Perf Sales', href: '/monitoring-perf' },
                  { key: 'leaderboard', label: 'Leaderboard', href: '/' },
                ]},
                { section: 'Marketing', items: [
                  { key: 'campaigns', label: 'Campagnes', href: '/campaigns' },
                ]},
                { section: 'Finance', items: [
                  { key: 'perf_closing', label: 'Perf.Closing', tab: 1 },
                  { key: 'coordonnees', label: 'Coordonnées', tab: 2 },
                ]},
              ].map(group => (
                <div key={group.section} style={{ marginBottom: 8 }}>
                  {group.section && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px 4px' }}>
                      {group.section}
                    </div>
                  )}
                  {group.items.map(item => {
                    const isActive = item.tab != null && activeTab === item.tab;
                    return (
                      <div key={item.key} onClick={() => item.href ? navigate(item.href) : handleTabChange(item.tab)} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        cursor: 'pointer', borderRadius: 8, transition: 'all 0.2s ease',
                        background: isActive ? (darkMode ? '#fff' : '#111827') : 'transparent',
                        color: isActive ? (darkMode ? '#111827' : '#fff') : C.muted,
                      }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                        {item.href && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        )}
                        {item.key === 'perf_closing' && clients.length > 0 && (
                          <span style={{
                            marginLeft: 'auto', fontSize: 10, fontWeight: 600, minWidth: 18, textAlign: 'center',
                            padding: '1px 5px', borderRadius: 8,
                            background: isActive ? 'rgba(255,255,255,0.2)' : C.accent + '15',
                            color: isActive ? (darkMode ? '#111827' : '#fff') : C.accent,
                          }}>{clients.length}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Sidebar footer — quick stats */}
            {dashboard && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, margin: '0 8px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Résumé</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.secondary }}>Total clients</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{dashboard.counters?.total ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.secondary }}>En cours</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{dashboard.counters?.en_cours ?? 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* ══ RIGHT COLUMN ═════════════════════════════════════════════ */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '8px 8px 8px 0', gap: 12 }}>

            {/* ── Top bar ───────────────────────────────────────────────── */}
            <div style={{
              height: 64, background: C.cardBg, borderRadius: 10, flexShrink: 0,
              border: `1px solid ${C.border}`, marginLeft: 8,
              display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
              boxShadow: C.shadow,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {TABS.map((tab, idx) => {
                  const isActive = idx === activeTab;
                  return (
                    <button key={tab.key} onClick={() => handleTabChange(idx)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                      borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent',
                      color: isActive ? (darkMode ? '#a5b4fc' : C.accent) : C.muted,
                      fontSize: 13, fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s ease',
                    }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : '#f3f4f6'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent'; }}
                    >
                      {tab.label}
                      {isActive && clients.length > 0 && tab.key === 'perf_closing' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                          background: darkMode ? C.accent + '30' : C.accent + '15', color: C.accent,
                        }}>{filteredClients.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1 }} />

              {/* Search */}
              {TABS[activeTab].key !== 'dashboard' && (
                <div style={{ position: 'relative', width: 240 }}>
                  <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    className="pc-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    style={{
                      width: '100%', padding: '8px 12px 8px 32px', fontSize: 13,
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
                      color: C.text, fontFamily: 'inherit', transition: 'all 0.2s ease',
                    }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: 2,
                    }}>×</button>
                  )}
                </div>
              )}
            </div>

            {/* ── Content ───────────────────────────────────────────────── */}
            <div style={{ flex: 1, marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ═══ DASHBOARD ═══════════════════════════════════════════ */}
              {TABS[activeTab].key === 'dashboard' && (
                <div className="pc-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
                  {dashboard ? (<>
                    {/* KPI Hero Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                      {[
                        { label: 'Total Clients', value: dashboard.counters?.total ?? 0, color: '#5b6abf', sub: 'Tous états confondus' },
                        { label: 'En Cours', value: dashboard.counters?.en_cours ?? 0, color: '#10b981', sub: 'Clients actifs' },
                        { label: 'Résiliés', value: (dashboard.counters?.resilie ?? 0) + (dashboard.counters?.self_resiliation ?? 0) + (dashboard.counters?.retractation ?? 0), color: '#ef4444', sub: 'Résiliation + Self + Rétractation' },
                        { label: 'Autres', value: (dashboard.counters?.pause ?? 0) + (dashboard.counters?.sans_suite ?? 0) + (dashboard.counters?.liquidation ?? 0), color: '#f59e0b', sub: 'Pause, sans suite, etc.' },
                      ].map((kpi, i) => (
                        <div key={i} style={{
                          background: C.cardBg, borderRadius: 12, padding: '20px 22px',
                          border: `1px solid ${C.border}`, boxShadow: C.shadow,
                          animation: `pcCardPop 0.4s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms both`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{kpi.label}</span>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: kpi.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, background: kpi.color + '30' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.value}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{kpi.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Main content: Delays + Leaderboard | Counters */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                      {/* Delays card */}
                      <div style={{
                        background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                        boxShadow: C.shadow, overflow: 'hidden',
                      }}>
                        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Délais Moyens</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Temps moyen entre les étapes clés</div>
                        </div>
                        <div style={{ padding: '2px 0' }}>
                          {(dashboard.delays || []).filter(d => !d.label.toLowerCase().includes('paiement')).map((d, i, arr) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10,
                              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                              opacity: d.available ? 1 : 0.4,
                              animation: `pcRowIn 0.3s ease ${i * 50}ms both`,
                            }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 6,
                                background: d.available ? C.accent + '10' : C.subtle,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={d.available ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{d.label}</div>
                                {d.available && d.count != null && (
                                  <div style={{ fontSize: 10, color: C.muted }}>{d.count} client{d.count > 1 ? 's' : ''}</div>
                                )}
                              </div>
                              {(() => {
                                const useMedian = d.label && d.label.toLowerCase().includes('arriv');
                                const displayVal = useMedian && d.median_days != null ? d.median_days : d.avg_days;
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <div style={{
                                      fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                      color: d.available ? C.text : C.muted, whiteSpace: 'nowrap', minWidth: 50, textAlign: 'right',
                                    }}>
                                      {d.available && displayVal != null ? (
                                        <>{displayVal % 1 === 0 ? displayVal.toFixed(0) : displayVal.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 2 }}>j</span></>
                                      ) : 'N/A'}
                                    </div>
                                    {d.available && displayVal != null && (
                                      <div style={{ width: 40, height: 5, borderRadius: 3, background: C.subtle, overflow: 'hidden', flexShrink: 0 }}>
                                        <div style={{
                                          height: '100%', borderRadius: 3,
                                          width: `${Math.min(100, (displayVal / 60) * 100)}%`,
                                          background: displayVal > 30 ? '#ef4444' : displayVal > 15 ? '#f59e0b' : '#10b981',
                                          transition: 'width 0.8s ease',
                                        }} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Mini Leaderboard */}
                      {topSellers.length > 0 && (
                        <div style={{
                          background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                          boxShadow: C.shadow, overflow: 'hidden',
                          animation: 'pcCardPop 0.4s cubic-bezier(0.4,0,0.2,1) 0.2s both',
                        }}>
                          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Classement</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Top vendeurs — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1 }}>{totalMonthlySales}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>ventes</div>
                            </div>
                          </div>
                          <div style={{ padding: '2px 0' }}>
                            {topSellers.map((seller, i) => {
                              const medalImgs = [firstPlace, secondPlace, thirdPlace];
                              const norm = normalizeName(seller.name);
                              const avatarUrl = userAvatars[norm] || norm.split(/\s+/).reduce((f, p) => f || (p.length >= 3 ? userAvatars[p] : null), null);
                              return (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10,
                                  borderBottom: i < topSellers.length - 1 ? `1px solid ${C.border}` : 'none',
                                  animation: `pcRowIn 0.3s ease ${i * 60}ms both`,
                                }}>
                                  {i < 3 ? (
                                    <img src={medalImgs[i]} alt="" style={{ width: 22, height: 22, flexShrink: 0 }} />
                                  ) : (
                                    <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, width: 22, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                                  )}
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                  ) : (
                                    <div style={{
                                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                      background: getAvatarColor(seller.name),
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 11, fontWeight: 700, color: '#fff',
                                    }}>{getInitials(seller.name)}</div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seller.name}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{seller.sales}</div>
                                    <div style={{ fontSize: 10, color: C.muted }}>ventes</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      </div>{/* end left column */}

                      {/* EOD Scores — Two separate containers */}
                      {eodScores ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {/* Radar container */}
                          <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow, padding: '20px' }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Moyenne globale</div>
                            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Semaine en cours</div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <div style={{ width: 300, height: 300 }}>
                                <Radar
                                  data={{
                                    labels: ['Charge', 'Énergie', 'Clarté', 'Efficacité', 'Relations', 'Alignement'],
                                    datasets: [{
                                      data: ['charge', 'energie', 'clarte', 'efficacite', 'relations', 'alignement'].map(k => eodScores.dims[k] || 0),
                                      backgroundColor: darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(91,106,191,0.12)',
                                      borderColor: C.accent, borderWidth: 2,
                                      pointBackgroundColor: C.accent, pointBorderColor: C.accent,
                                      pointRadius: 4, pointHoverRadius: 6,
                                    }],
                                  }}
                                  options={{
                                    responsive: true, maintainAspectRatio: true,
                                    plugins: { legend: { display: false }, tooltip: { enabled: true }, datalabels: false },
                                    scales: { r: {
                                      min: 0, max: 5,
                                      ticks: { stepSize: 1, display: true, font: { size: 9 }, color: C.muted, backdropColor: 'transparent' },
                                      pointLabels: { font: { size: 11, weight: 600 }, color: C.text },
                                      grid: { color: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                                      angleLines: { color: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                                    }},
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                              <span style={{
                                fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                                color: eodScores.avgGlobal >= 3.5 ? '#10b981' : eodScores.avgGlobal >= 2.5 ? '#f59e0b' : '#ef4444',
                              }}>{eodScores.avgGlobal.toFixed(1)}</span>
                              <span style={{ fontSize: 16, fontWeight: 500, color: C.muted }}>/5</span>
                            </div>
                          </div>

                          {/* Dimensions container */}
                          <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Détail par dimension</div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Score moyen /5</div>
                            </div>
                            <div style={{ padding: '4px 0' }}>
                              {[
                                { key: 'charge', label: 'Charge', color: '#6366f1' },
                                { key: 'energie', label: 'Énergie', color: '#f59e0b' },
                                { key: 'clarte', label: 'Clarté', color: '#3b82f6' },
                                { key: 'efficacite', label: 'Efficacité', color: '#10b981' },
                                { key: 'relations', label: 'Relations', color: '#ec4899' },
                                { key: 'alignement', label: 'Alignement', color: '#8b5cf6' },
                              ].map((dim, i) => {
                                const val = eodScores.dims[dim.key] || 0;
                                const pct = (val / 5 * 100).toFixed(0);
                                return (
                                  <div key={dim.key} style={{
                                    display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 12,
                                    borderBottom: i < 5 ? `1px solid ${C.border}` : 'none',
                                    animation: `pcRowIn 0.3s ease ${i * 50}ms both`,
                                  }}>
                                    <div style={{ width: 10, height: 10, borderRadius: 3, background: dim.color, flexShrink: 0 }} />
                                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.text }}>{dim.label}</div>
                                    <div style={{ width: 80, height: 6, borderRadius: 3, background: C.subtle, overflow: 'hidden', flexShrink: 0 }}>
                                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: dim.color, transition: 'width 0.8s ease' }} />
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {val.toFixed(1)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement des scores EOD...</div>
                      )}
                    </div>
                  </>) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
                      <div style={{ fontSize: 14, color: C.muted, animation: 'pcPulse 1.5s ease infinite' }}>Chargement des données...</div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ PERF.CLOSING ════════════════════════════════════════ */}
              {TABS[activeTab].key === 'perf_closing' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {/* Filter bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap',
                  }}>
                    {/* Etat filter pills */}
                    <button onClick={() => setFilterEtat('all')} style={{
                      padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterEtat === 'all' ? C.accent : C.border}`,
                      background: filterEtat === 'all' ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent',
                      color: filterEtat === 'all' ? C.accent : C.muted,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}>
                      Tous <span style={{ opacity: 0.7, marginLeft: 4 }}>{clients.length}</span>
                    </button>
                    {ETAT_CONFIG.map(etat => {
                      const cnt = etatCounts[etat.key];
                      if (cnt === 0) return null;
                      const isActive = filterEtat === etat.key;
                      return (
                        <button key={etat.key} onClick={() => setFilterEtat(isActive ? 'all' : etat.key)} style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1px solid ${isActive ? etat.color : C.border}`,
                          background: isActive ? etat.color + '12' : 'transparent',
                          color: isActive ? etat.color : C.muted,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', background: etat.color, flexShrink: 0,
                          }} />
                          {etat.label}
                          <span style={{ opacity: 0.7 }}>{cnt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Table */}
                  <div style={{
                    flex: 1, background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                    boxShadow: C.shadow, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Table header */}
                    <div className="pc-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.5fr 2fr 1fr 1.5fr 1fr 1fr 32px',
                      gap: '0 12px',
                      padding: '0 16px', background: C.headerBg, borderBottom: `1px solid ${C.border}`,
                      minHeight: 42, alignItems: 'center',
                    }}>
                      {['N°Client', 'Société', 'Email', 'État', 'Commercial', 'Lancement', 'Type', ''].map((h, i) => (
                        <span key={h || i} style={{
                          fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.04em', padding: '0 4px',
                          textAlign: undefined,
                        }}>{h}</span>
                      ))}
                    </div>

                    {/* Table body */}
                    <div className="pc-scroll" style={{ flex: 1, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                      {perfSlice.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                          {searchQuery ? `Aucun résultat pour "${searchQuery}"` : clients.length === 0 ? 'Chargement...' : 'Aucun client dans cette catégorie'}
                        </div>
                      ) : perfSlice.map((cl, i) => {
                        const etatConf = ETAT_CONFIG.find(e => e.key === (cl.etat || 'a_signe')) || ETAT_CONFIG[0];
                        const isExpanded = expandedRow === cl.id;
                        return (
                          <React.Fragment key={cl.id}>
                            <div
                              className="pc-row pc-grid"
                              onClick={() => setExpandedRow(isExpanded ? null : cl.id)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1.5fr 2fr 1fr 1.5fr 1fr 1fr 32px',
                                gap: '0 12px',
                                padding: '0 16px', minHeight: 48, alignItems: 'center',
                                borderBottom: `1px solid ${C.border}`,
                                background: darkMode ? C.bg : '#fff', cursor: 'pointer',
                                animation: `pcRowIn 0.25s ease ${i * 30}ms both`,
                                transition: 'background 0.15s ease',
                              }}
                            >
                              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.muted, padding: '0 4px' }}>
                                {cl.numero_client || '—'}
                              </span>
                              <div style={{ padding: '0 4px', minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                  {cl.societe ? cl.societe.split(' - ')[0].trim() : '—'}
                                </span>
                              </div>
                              <span style={{ fontSize: 12, color: C.secondary, padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cl.email || '—'}
                              </span>
                              <div style={{ padding: '0 4px', position: 'relative', display: 'flex', justifyContent: 'flex-start' }} ref={etatDropdown === cl.id ? etatDropdownRef : undefined}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEtatDropdown(etatDropdown === cl.id ? null : cl.id); }}
                                  disabled={updatingEtat === cl.id}
                                  style={{
                                    fontSize: 11, fontWeight: 600, padding: '3px 6px', borderRadius: 6,
                                    border: `1px solid ${etatConf.color}35`,
                                    background: etatConf.color + '10', color: etatConf.color,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    opacity: updatingEtat === cl.id ? 0.5 : 1,
                                    transition: 'opacity 0.2s', whiteSpace: 'nowrap',
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                  }}
                                >
                                  {etatConf.label}
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                                {etatDropdown === cl.id && (
                                  <div style={{
                                    position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                                    background: darkMode ? '#2a2b3d' : '#fff', borderRadius: 8,
                                    border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                    padding: '4px 0', minWidth: 140,
                                  }}>
                                    {ETAT_CONFIG.map(opt => (
                                      <div key={opt.key}
                                        onClick={(e) => { e.stopPropagation(); handleEtatChange(cl.id, opt.key); setEtatDropdown(null); }}
                                        style={{
                                          padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                          color: opt.key === (cl.etat || 'a_signe') ? opt.color : C.text,
                                          background: opt.key === (cl.etat || 'a_signe') ? opt.color + '10' : 'transparent',
                                          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = opt.color + '10'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = opt.key === (cl.etat || 'a_signe') ? opt.color + '10' : 'transparent'}
                                      >
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                        {opt.label}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                {(() => {
                                  const name = cl.sales_name || cl.rapporteur || '';
                                  const norm = normalizeName(name);
                                  const avatarUrl = userAvatars[norm] || norm.split(/\s+/).reduce((found, part) => found || (part.length >= 3 ? userAvatars[part] : null), null);
                                  if (!name) return null;
                                  return avatarUrl ? (
                                    <img src={avatarUrl} alt="" style={{
                                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover',
                                    }} />
                                  ) : (
                                    <div style={{
                                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                      background: getAvatarColor(name),
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1,
                                    }}>{getInitials(name)}</div>
                                  );
                                })()}
                                <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cl.sales_name || cl.rapporteur || '—'}
                                </span>
                              </div>
                              <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>{fmtDateShort(cl.rdv_lancement)}</span>
                              <span style={{ fontSize: 12, color: C.accent, fontWeight: 500, padding: '0 4px' }}>{cl.funnel || '—'}</span>
                              <span style={{
                                fontSize: 14, color: C.muted, textAlign: 'center',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.25s ease',
                              }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                              </span>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div style={{
                                padding: '16px 24px', background: darkMode ? C.subtle : '#fafbff',
                                borderBottom: `1px solid ${C.border}`,
                                animation: 'pcExpandDown 0.3s ease both', overflow: 'hidden',
                              }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                  {[
                                    { label: 'Tarif', value: cl.tarif || '—' },
                                    { label: 'Date signature', value: fmtDate(cl.date_signature) },
                                    { label: '1er contact', value: fmtDate(cl.date_premier_contact) },
                                    { label: 'RDV Lancement', value: fmtDate(cl.rdv_lancement) },
                                    { label: 'Funnel', value: cl.funnel || '—' },
                                    { label: 'Commercial', value: cl.sales_name || cl.rapporteur || '—' },
                                    { label: 'Créé le', value: fmtDate(cl.created_at) },
                                    { label: 'Ancienneté', value: (() => { const d = daysSince(cl.date_signature); return d != null ? `${d} jour${d > 1 ? 's' : ''}` : '—'; })() },
                                  ].map((f, fi) => (
                                    <div key={fi}>
                                      <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    <div style={{ flex: 1 }} />
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', borderTop: `1px solid ${C.border}`,
                      background: C.headerBg,
                    }}>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        {filteredClients.length > 0
                          ? `${(perfPage - 1) * perfPerPage + 1}–${Math.min(perfPage * perfPerPage, filteredClients.length)} sur ${filteredClients.length}`
                          : '0 résultat'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={perfPerPage} onChange={(e) => setPerfPerPage(Number(e.target.value))} style={{
                          fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`,
                          background: darkMode ? C.bg : '#fff', color: C.text, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          {ITEMS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <PaginationBtn label="‹" disabled={perfPage <= 1} onClick={() => setPerfPage(p => p - 1)} C={C} darkMode={darkMode} />
                          {Array.from({ length: Math.min(perfTotalPages, 5) }, (_, i) => {
                            let page;
                            if (perfTotalPages <= 5) page = i + 1;
                            else if (perfPage <= 3) page = i + 1;
                            else if (perfPage >= perfTotalPages - 2) page = perfTotalPages - 4 + i;
                            else page = perfPage - 2 + i;
                            return <PaginationBtn key={page} label={page} active={page === perfPage} onClick={() => setPerfPage(page)} C={C} darkMode={darkMode} />;
                          })}
                          <PaginationBtn label="›" disabled={perfPage >= perfTotalPages} onClick={() => setPerfPage(p => p + 1)} C={C} darkMode={darkMode} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ COORDONNÉES ═════════════════════════════════════════ */}
              {TABS[activeTab].key === 'coordonnees' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {/* Filter bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterStatus('all')} style={{
                      padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterStatus === 'all' ? C.accent : C.border}`,
                      background: filterStatus === 'all' ? (darkMode ? C.accent + '20' : '#f0f1ff') : 'transparent',
                      color: filterStatus === 'all' ? C.accent : C.muted,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Tous <span style={{ opacity: 0.7, marginLeft: 4 }}>{coordonnees.length}</span>
                    </button>
                    {Object.entries(YOUSIGN_LABELS).map(([key, label]) => {
                      const cnt = coordonnees.filter(c => c.yousign_status === key).length;
                      if (cnt === 0) return null;
                      const isActive = filterStatus === key;
                      const color = YOUSIGN_COLORS[key];
                      return (
                        <button key={key} onClick={() => setFilterStatus(isActive ? 'all' : key)} style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1px solid ${isActive ? color : C.border}`,
                          background: isActive ? color + '12' : 'transparent',
                          color: isActive ? color : C.muted,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {label}
                          <span style={{ opacity: 0.7 }}>{cnt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Table */}
                  <div style={{
                    flex: 1, background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                    boxShadow: C.shadow, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 95px 95px 80px 100px 90px',
                      padding: '0 16px', background: C.headerBg, borderBottom: `1px solid ${C.border}`,
                      minHeight: 42, alignItems: 'center',
                    }}>
                      {['Entreprise', 'Contact', 'Statut', 'Type', 'Salariés', 'Ville', 'Date envoi'].map(h => (
                        <span key={h} style={{
                          fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.04em', padding: '0 4px',
                        }}>{h}</span>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="pc-scroll" style={{ flex: 1, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                      {coordSlice.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                          {searchQuery ? `Aucun résultat pour "${searchQuery}"` : coordonnees.length === 0 ? 'Chargement...' : 'Aucun contrat trouvé'}
                        </div>
                      ) : coordSlice.map((nda, i) => {
                        const sColor = YOUSIGN_COLORS[nda.yousign_status] || C.muted;
                        return (
                          <div key={nda.contract_id || i} className="pc-row" style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 1fr 95px 95px 80px 100px 90px',
                            padding: '0 16px', minHeight: 52, alignItems: 'center',
                            borderBottom: `1px solid ${C.border}`,
                            background: darkMode ? C.bg : '#fff',
                            animation: `pcRowIn 0.25s ease ${i * 30}ms both`,
                            transition: 'background 0.15s ease',
                          }}>
                            <div style={{ padding: '0 4px', minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nda.legal_name || nda.client_company || nda.client_name || '—'}
                              </div>
                              <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nda.representative_name || ''}{nda.representative_title ? ` · ${nda.representative_title}` : ''}
                              </div>
                            </div>
                            <div style={{ padding: '0 4px', minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nda.client_email || '—'}</div>
                              <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{nda.client_phone || ''}</div>
                            </div>
                            <div style={{ padding: '0 4px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                background: sColor + '12', color: sColor,
                                display: 'inline-block',
                              }}>
                                {YOUSIGN_LABELS[nda.yousign_status] || nda.yousign_status || '—'}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: C.secondary, padding: '0 4px' }}>{nda.contract_type || '—'}</span>
                            <span style={{ fontSize: 12, color: C.text, padding: '0 4px' }}>{nda.employee_range || '—'}</span>
                            <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {nda.city || ''}{nda.postal_code ? ` (${nda.postal_code})` : ''}
                            </span>
                            <span style={{ fontSize: 12, color: C.muted, padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(nda.sent_at || nda.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    <div style={{ flex: 1 }} />
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', borderTop: `1px solid ${C.border}`,
                      background: C.headerBg,
                    }}>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        {filteredCoord.length > 0
                          ? `${(coordPage - 1) * coordPerPage + 1}–${Math.min(coordPage * coordPerPage, filteredCoord.length)} sur ${filteredCoord.length}`
                          : '0 résultat'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={coordPerPage} onChange={(e) => setCoordPerPage(Number(e.target.value))} style={{
                          fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`,
                          background: darkMode ? C.bg : '#fff', color: C.text, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          {ITEMS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <PaginationBtn label="‹" disabled={coordPage <= 1} onClick={() => setCoordPage(p => p - 1)} C={C} darkMode={darkMode} />
                          {Array.from({ length: Math.min(coordTotalPages, 5) }, (_, i) => {
                            let page;
                            if (coordTotalPages <= 5) page = i + 1;
                            else if (coordPage <= 3) page = i + 1;
                            else if (coordPage >= coordTotalPages - 2) page = coordTotalPages - 4 + i;
                            else page = coordPage - 2 + i;
                            return <PaginationBtn key={page} label={page} active={page === coordPage} onClick={() => setCoordPage(page)} C={C} darkMode={darkMode} />;
                          })}
                          <PaginationBtn label="›" disabled={coordPage >= coordTotalPages} onClick={() => setCoordPage(p => p + 1)} C={C} darkMode={darkMode} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Pagination Button ───────────────────────────────────────────────── */
function PaginationBtn({ label, active, disabled, onClick, C, darkMode }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      width: typeof label === 'number' ? 32 : 28, height: 32,
      borderRadius: 8, border: `1px solid ${active ? C.accent : C.border}`,
      background: active ? C.accent : 'transparent',
      color: active ? '#fff' : disabled ? C.muted + '60' : C.text,
      fontSize: 13, fontWeight: active ? 700 : 500, cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', transition: 'all 0.2s ease',
      opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  );
}
