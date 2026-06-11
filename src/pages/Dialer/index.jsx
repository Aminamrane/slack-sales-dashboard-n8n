// src/pages/Dialer/index.jsx — Power Dialer (page interne CRM).
//
// Roles : admin / finance_director / finance_team. Anyone else → '/'.
//   - finance_team  (opératrice, ex. Aurélie) → console d'appel
//   - finance_director (DAF)                  → supervision (upload + stats)
//   - admin                                   → les deux (onglets)
//
// 100 % additif : nouvelle route, nouveau service (dialerClient), aucune
// modification d'apiClient ni des zones sacrées. Le backend dialer est un
// service isolé (https://api.ownertechnology.com/dialer) ; il ne touche
// jamais l'interne (Supabase / leads / contrats / n8n).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PhoneCall, LayoutDashboard } from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import dialerClient from '../../services/dialerClient.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';
import { getTheme } from './theme.js';
import OperatorConsole from './OperatorConsole.jsx';
import SupervisorPanel from './SupervisorPanel.jsx';

const ALLOWED_ROLES = ['admin', 'finance_director', 'finance_team'];
const STATS_POLL_MS = 4000;

export default function Dialer() {
  const navigate = useNavigate();

  // ── auth gate ───────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState(null);
  const [operatorKey, setOperatorKey] = useState(null); // CRM identity → operator handset
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate('/login'); return; }
    if (!ALLOWED_ROLES.includes(user.role)) { navigate('/'); return; }
    setRole(user.role);
    setOperatorKey(user.email || String(user.id || user.role));
    setAuthChecked(true);
  }, [navigate]);

  // ── dark mode (synced like every page) ──────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  const T = useMemo(() => getTheme(darkMode), [darkMode]);

  // ── role-derived capabilities ───────────────────────────────────────────
  const isOperator   = role === 'finance_team' || role === 'admin';
  const isSupervisor = role === 'finance_director' || role === 'admin';
  const showTabs     = isOperator && isSupervisor; // admin only
  const [tab, setTab] = useState('console'); // 'console' | 'supervision'
  // operator-only users land on console ; DAF-only on supervision
  useEffect(() => {
    if (role === 'finance_director') setTab('supervision');
    else setTab('console');
  }, [role]);

  // ── campaigns + selection ───────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  const reloadCampaigns = useCallback(async () => {
    try {
      const list = await dialerClient.listCampaigns();
      setCampaigns(list || []);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null; // default = newest (backend orders desc)
      });
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e?.message || 'Backend dialer injoignable');
    }
  }, []);

  useEffect(() => { if (authChecked) reloadCampaigns(); }, [authChecked, reloadCampaigns]);

  // ── shared stats (polled), consumed by both panels ──────────────────────
  const [stats, setStats] = useState(null);
  const pollRef = useRef(null);

  const refreshStats = useCallback(async () => {
    if (!selectedId) { setStats(null); return; }
    try { setStats(await dialerClient.stats(selectedId)); } catch { /* keep last */ }
  }, [selectedId]);

  useEffect(() => {
    refreshStats();
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedId) pollRef.current = setInterval(refreshStats, STATS_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, refreshStats]);

  if (!authChecked) return null;

  return (
    <div style={{
      minHeight: '100vh', background: T.pageBg,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      color: T.text,
    }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '92px 24px 72px' }}>
        {/* ── title ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: T.accentBg, color: T.accent,
          }}>
            <PhoneCall size={20} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Power Dialer</h1>
        </div>
        <p style={{ margin: '0 0 26px 50px', fontSize: 14, color: T.textMuted }}>
          {role === 'finance_director'
            ? 'Préparez les listes d’appels et suivez l’avancement en temps réel.'
            : 'Traitez votre liste d’appels.'}
        </p>

        {/* ── admin tabs ── */}
        {showTabs && (
          <div style={{
            display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12,
            background: T.surfaceAlt, border: `1px solid ${T.border}`, marginBottom: 26,
          }}>
            {[
              { key: 'console', label: 'Console opérateur', icon: PhoneCall },
              { key: 'supervision', label: 'Supervision DAF', icon: LayoutDashboard },
            ].map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, background: 'transparent',
                    color: active ? T.text : T.textMuted, transition: 'color 0.2s',
                  }}>
                  {active && (
                    <motion.span layoutId="dlrTabPill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{
                        position: 'absolute', inset: 0, borderRadius: 9, background: T.surface,
                        boxShadow: T.shadowSoft, zIndex: 0,
                      }} />
                  )}
                  <t.icon size={15} style={{ position: 'relative', zIndex: 1 }} />
                  <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── backend unreachable ── */}
        {loadErr && (
          <div style={{
            padding: '16px', background: T.redBg, border: `1px solid ${T.red}33`,
            borderRadius: 12, color: T.red, fontSize: 13, marginBottom: 20,
          }}>
            {loadErr}
          </div>
        )}

        {/* ── empty : no campaign ── */}
        {!loadErr && campaigns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: T.textFaint, fontSize: 14 }}>
            {isSupervisor
              ? 'Aucune campagne pour l’instant — créez-en une puis importez un CSV.'
              : 'Aucune campagne disponible. La DAF doit en préparer une.'}
          </div>
        )}

        {/* ── panels ── */}
        {!loadErr && selectedId && (
          <>
            {(tab === 'console') && isOperator && (
              <OperatorConsole
                key={selectedId}
                campaignId={selectedId}
                operatorKey={operatorKey}
                stats={stats}
                refreshStats={refreshStats}
                theme={T}
              />
            )}
            {(tab === 'supervision') && isSupervisor && (
              <SupervisorPanel
                campaigns={campaigns}
                selectedId={selectedId}
                onSelect={setSelectedId}
                stats={stats}
                refreshStats={refreshStats}
                reloadCampaigns={reloadCampaigns}
                theme={T}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
