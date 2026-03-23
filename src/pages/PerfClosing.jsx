import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

import companyLogo from "../assets/my_image.png";
import iconGlobal from "../assets/global.png";
import iconFinance from "../assets/finance.png";
import iconFiles from "../assets/files.png";

const TABS = [
  { key: "dashboard",    label: "Dashboard",     color: "#5b6abf" },
  { key: "perf_closing", label: "Perf.Closing",  color: "#f59e0b" },
  { key: "coordonnees",  label: "Coordonnées",   color: "#3b82f6" },
];

const ETAT_CONFIG = [
  { key: "a_signe",          label: "À signé",          color: "#10b981" },
  { key: "en_attente",       label: "En attente",       color: "#f59e0b" },
  { key: "resilie",          label: "Résilié",           color: "#ef4444" },
  { key: "sans_suite",       label: "Sans suite",        color: "#94a3b8" },
  { key: "liquidation",      label: "Liquidation",       color: "#8b5cf6" },
  { key: "pause",            label: "Pause",             color: "#64748b" },
  { key: "self_resiliation", label: "Self-résiliation",  color: "#f87171" },
  { key: "retractation",     label: "Rétractation",      color: "#fb923c" },
];

const COUNTER_DEFS = [
  { key: "en_cours",          label: "Nbr clients (en cours)", color: "#5b6abf" },
  { key: "resilie",           label: "Nbr de Résiliation",     color: "#ef4444" },
  { key: "self_resiliation",  label: "Nbr Self-Résiliation",   color: "#f87171" },
  { key: "liquidation",       label: "Nbr Liquidation",        color: "#8b5cf6" },
  { key: "pause",             label: "Nbr clients Pause",      color: "#64748b" },
  { key: "sans_suite",        label: "Nbr Sans suite",         color: "#94a3b8" },
  { key: "retractation",      label: "Nbr Rétractation",       color: "#fb923c" },
];

const YOUSIGN_LABELS = { done: 'Signé', ongoing: 'En cours', expired: 'Expiré', canceled: 'Annulé', failed: 'Erreur', draft: 'Brouillon' };
const YOUSIGN_COLORS = { done: '#10b981', ongoing: '#3b82f6', expired: '#fb923c', canceled: '#94a3b8', failed: '#ef4444', draft: '#9ca3af' };

export default function PerfClosing() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#f6f7f9', text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af', subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280', accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [clients, setClients] = useState([]);
  const [coordonnees, setCoordonnees] = useState([]);
  const [updatingEtat, setUpdatingEtat] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        if (user.role !== 'admin') { navigate("/"); return; }
        await fetchDashboard();
      } catch { navigate("/login"); }
      finally { setLoading(false); }
    };
    check();
  }, [navigate]);

  const fetchDashboard = async () => {
    try { const r = await apiClient.get('/api/v1/perf-closing/dashboard'); setDashboard(r); }
    catch (e) { console.warn('Dashboard fetch failed:', e); }
  };
  const fetchClients = async () => {
    try { const r = await apiClient.get('/api/v1/perf-closing/clients'); setClients(r.clients || []); }
    catch (e) { console.warn('Clients fetch failed:', e); }
  };
  const fetchCoordonnees = async () => {
    try { const r = await apiClient.get('/api/v1/perf-closing/coordonnees'); setCoordonnees(r.coordonnees || []); }
    catch (e) { console.warn('Coordonnees fetch failed:', e); }
  };

  const handleTabChange = async (idx) => {
    setActiveTab(idx);
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

  const groupedClients = useMemo(() => {
    const groups = {};
    ETAT_CONFIG.forEach(e => { groups[e.key] = []; });
    clients.forEach(c => {
      const key = c.etat || 'a_signe';
      if (groups[key]) groups[key].push(c);
      else groups['a_signe'].push(c);
    });
    return groups;
  }, [clients]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface }}>
      <div style={{ fontSize: 15, color: C.muted }}>Chargement...</div>
    </div>
  );

  // ── Date helpers ───────────────────────────────────────────────────────────
  // Backend returns mixed formats: "DD/MM/YYYY", "DD/MM/YYYY HH:MM:SS", "YYYY-MM-DDTHH:MM:SS"
  const fmtDate = (val) => {
    if (!val) return '—';
    // Already DD/MM format
    if (val.includes('/')) {
      const parts = val.split(' ')[0].split('/');
      if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
      return val.split(' ')[0];
    }
    // ISO format
    const d = val.slice(0, 10).split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  };
  const fmtDateShort = (val) => {
    if (!val) return '';
    if (val.includes('/')) {
      const parts = val.split(' ')[0].split('/');
      return `${parts[0]}/${parts[1]}`;
    }
    const d = val.slice(0, 10).split('-');
    return `${d[2]}/${d[1]}`;
  };

  const cellS = { fontSize: 11, color: C.text, padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const hdrS = { fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px', whiteSpace: 'nowrap' };

  return (
    <>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`
        @keyframes pageReveal { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes sidebarReveal { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
        html, body { background: ${darkMode ? '#13141b' : '#ffffff'}; }
        .pc-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
        .pc-scroll::-webkit-scrollbar-track { background: transparent; }
        .pc-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
      `}</style>

      <div style={{ animation: 'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>

          {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
          <div style={{ width: 220, minWidth: 220, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: darkMode ? C.subtle : '#eceef2', animation: 'sidebarReveal 0.4s ease both' }}>
            <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 12, paddingTop: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, border: `1px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: darkMode ? '#fff' : '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={companyLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', filter: darkMode ? 'none' : 'brightness(0) invert(1)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Owner</div>
              </div>
            </div>
            {[
              { key: 'dashboard', label: 'Dashboard', iconSrc: iconGlobal },
              { key: 'perf_closing', label: 'Perf.Closing', iconSrc: iconFinance },
              { key: 'coordonnees', label: 'Coordonnées', iconSrc: iconFiles },
            ].map((item, idx) => {
              const isActive = activeTab === idx;
              return (
                <div key={item.key} onClick={() => handleTabChange(idx)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', margin: '1px 12px', cursor: 'pointer', borderRadius: 10,
                  background: isActive ? (darkMode ? '#fff' : '#1e2330') : 'transparent',
                  color: isActive ? (darkMode ? '#1e2330' : '#fff') : C.muted, transition: 'all 0.2s ease',
                }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: isActive ? (darkMode ? '#1e2330' : '#fff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)'), WebkitMaskImage: `url(${item.iconSrc})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${item.iconSrc})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? (darkMode ? '#1e2330' : '#fff') : C.muted }}>{item.label}</span>
                </div>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>

          {/* ── RIGHT ─────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '8px 8px 8px 0', gap: 12 }}>

            {/* Tab header */}
            <div style={{ height: 76, background: darkMode ? C.bg : '#f6f7f9', borderRadius: 8, flexShrink: 0, border: `1px solid ${C.border}`, marginLeft: 8, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 8 }}>
              {TABS.map((tab, idx) => {
                const isActive = idx === activeTab;
                return (
                  <button key={tab.key} onClick={() => handleTabChange(idx)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                    border: `1px solid ${isActive ? C.border : 'transparent'}`,
                    background: isActive ? (darkMode ? 'rgba(255,255,255,0.06)' : '#fff') : 'transparent',
                    color: isActive ? C.text : C.muted, fontSize: 13, fontWeight: isActive ? 650 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: isActive ? (darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)') : 'none',
                  }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; } }}
                  >
                    {tab.label}
                    {isActive && <span style={{ width: 8, height: 8, borderRadius: '50%', background: tab.color }} />}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div style={{ flex: 1, marginLeft: 8 }}>
              <div className="pc-scroll" style={{ background: darkMode ? C.bg : '#f6f7f9', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'auto', minHeight: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}>

                {/* ═══ DASHBOARD ═══ */}
                {TABS[activeTab].key === 'dashboard' && (
                  <div style={{ padding: 28 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Dashboard Perf Closing</h2>
                    <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>Totale — Vue globale</p>

                    {dashboard ? (
                      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                        {/* Délais */}
                        <div style={{ flex: 1, minWidth: 300 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Délais moyens</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(dashboard.delays || []).map((d, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: 10,
                                background: darkMode ? C.subtle : '#fff', border: `1px solid ${C.border}`,
                                opacity: d.available ? 1 : 0.45,
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{d.label}</div>
                                  {d.available && d.count != null && (
                                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{d.count} clients</div>
                                  )}
                                </div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: d.available ? C.accent : C.muted }}>
                                  {d.available && d.avg_days != null ? `${d.avg_days.toFixed(1)}j` : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Compteurs */}
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Compteurs clients</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {COUNTER_DEFS.map(cd => (
                              <div key={cd.key} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: 10,
                                background: darkMode ? C.subtle : '#fff', border: `1px solid ${C.border}`,
                                borderLeft: `4px solid ${cd.color}`,
                              }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{cd.label}</span>
                                <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{dashboard.counters?.[cd.key] ?? 0}</span>
                              </div>
                            ))}
                            {/* Total */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 16px', borderRadius: 10, marginTop: 4,
                              background: darkMode ? C.accent + '20' : C.accent + '10', border: `1px solid ${C.accent}30`,
                            }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>Total clients</span>
                              <span style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{dashboard.counters?.total ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: C.muted, textAlign: 'center', padding: 40 }}>Chargement...</div>
                    )}
                  </div>
                )}

                {/* ═══ PERF.CLOSING ═══ */}
                {TABS[activeTab].key === 'perf_closing' && (
                  <div style={{ padding: '20px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Perf.Closing</h2>
                      <span style={{ fontSize: 13, color: C.muted }}>{clients.length} clients</span>
                    </div>

                    {ETAT_CONFIG.map(etat => {
                      const items = groupedClients[etat.key] || [];
                      if (items.length === 0) return null;
                      const cols = '70px 1.8fr 1.3fr 95px 100px 80px 80px 80px minmax(80px,auto)';
                      return (
                        <div key={etat.key} style={{ marginBottom: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${etat.color}10`, borderRadius: '10px 10px 0 0', border: `1px solid ${etat.color}25`, borderBottom: 'none' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: etat.color, padding: '2px 10px', borderRadius: 6, background: `${etat.color}18` }}>{etat.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{items.length}</span>
                          </div>

                          <div style={{ border: `1px solid ${etat.color}25`, borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, padding: '8px 10px', background: darkMode ? C.subtle : '#f4f5f8', borderBottom: `1px solid ${C.border}` }}>
                              {['N° Client', 'Société', 'Mail', 'État', 'Commercial', '1er Contact', 'Signature', 'Lancement', 'Type'].map(h => (
                                <span key={h} style={hdrS}>{h}</span>
                              ))}
                            </div>

                            {/* Rows */}
                            {items.map((cl, i) => (
                              <div key={cl.id} style={{
                                display: 'grid', gridTemplateColumns: cols, gap: 4, padding: '8px 10px',
                                borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                                background: darkMode ? C.bg : '#fff', alignItems: 'center',
                              }}
                                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? C.subtle : '#fafafb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? C.bg : '#fff'}
                              >
                                <span style={{ ...cellS, fontFamily: 'monospace', fontWeight: 600, color: C.muted }}>{cl.numero_client || '—'}</span>
                                <span style={{ ...cellS, fontWeight: 600 }}>{cl.societe || '—'}</span>
                                <span style={{ ...cellS, fontSize: 10.5, color: C.secondary }}>{cl.email || '—'}</span>
                                <select value={cl.etat || 'a_signe'} onChange={(e) => handleEtatChange(cl.id, e.target.value)} disabled={updatingEtat === cl.id}
                                  style={{ fontSize: 10, fontWeight: 600, padding: '3px 4px', borderRadius: 5, border: `1px solid ${etat.color}40`, background: `${etat.color}10`, color: etat.color, cursor: 'pointer', outline: 'none', opacity: updatingEtat === cl.id ? 0.5 : 1 }}>
                                  {ETAT_CONFIG.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                                </select>
                                <span style={{ ...cellS, fontSize: 10.5 }}>{cl.sales_name || cl.rapporteur || '—'}</span>
                                <span style={cellS}>{fmtDateShort(cl.date_premier_contact)}</span>
                                <span style={cellS}>{fmtDateShort(cl.date_signature)}</span>
                                <span style={cellS}>{fmtDateShort(cl.rdv_lancement)}</span>
                                <span style={{ ...cellS, fontSize: 10, color: C.accent }}>{cl.funnel || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {clients.length === 0 && (
                      <div style={{ fontSize: 14, color: C.muted, textAlign: 'center', padding: 40 }}>Chargement...</div>
                    )}
                  </div>
                )}

                {/* ═══ COORDONNÉES ═══ */}
                {TABS[activeTab].key === 'coordonnees' && (
                  <div style={{ padding: '20px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Coordonnées</h2>
                      <span style={{ fontSize: 13, color: C.muted }}>{coordonnees.length} NDA</span>
                    </div>

                    {(() => {
                      const cols = '1.4fr 1fr 100px 100px 90px 110px 100px';
                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '10px 12px', background: darkMode ? C.subtle : '#f4f5f8', borderRadius: '10px 10px 0 0', border: `1px solid ${C.border}`, borderBottom: 'none' }}>
                            {['Entreprise / Représentant', 'Contact', 'Statut', 'Type contrat', 'Salariés', 'Ville', 'Date envoi'].map(h => (
                              <span key={h} style={hdrS}>{h}</span>
                            ))}
                          </div>
                          <div style={{ border: `1px solid ${C.border}`, borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                            {coordonnees.map((nda, i) => {
                              const sColor = YOUSIGN_COLORS[nda.yousign_status] || C.muted;
                              return (
                                <div key={nda.contract_id || i} style={{
                                  display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 12px',
                                  borderBottom: i < coordonnees.length - 1 ? `1px solid ${C.border}` : 'none',
                                  background: darkMode ? C.bg : '#fff', alignItems: 'center',
                                }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? C.subtle : '#fafafb'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? C.bg : '#fff'}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {nda.legal_name || nda.client_company || nda.client_name || '—'}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {nda.representative_name || ''} {nda.representative_title ? `(${nda.representative_title})` : ''}
                                    </div>
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nda.client_email || '—'}</div>
                                    <div style={{ fontSize: 10.5, color: C.muted, fontFamily: 'monospace' }}>{nda.client_phone || ''}</div>
                                  </div>

                                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: `${sColor}15`, color: sColor, width: 'fit-content' }}>
                                    {YOUSIGN_LABELS[nda.yousign_status] || nda.yousign_status || '—'}
                                  </span>

                                  <span style={{ fontSize: 11, color: C.secondary }}>{nda.contract_type || '—'}</span>

                                  <span style={{ fontSize: 11, color: C.text }}>{nda.employee_range || '—'}</span>

                                  <span style={{ fontSize: 11, color: C.muted }}>
                                    {nda.city || ''}{nda.postal_code ? ` (${nda.postal_code})` : ''}
                                  </span>

                                  <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(nda.sent_at || nda.created_at)}</span>
                                </div>
                              );
                            })}
                            {coordonnees.length === 0 && (
                              <div style={{ fontSize: 14, color: C.muted, textAlign: 'center', padding: 40 }}>Chargement...</div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
