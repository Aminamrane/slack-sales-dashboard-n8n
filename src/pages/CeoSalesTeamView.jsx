// src/pages/CeoSalesTeamView.jsx
//
// Route /ceo/sales-team — grille "Équipe Sales" embeddée dans le shell
// CEO / Acquisition Director (sidebar shared + SharedNavbar).
//
// Pattern strictement aligné sur CeoPerfSalesView. Comme la grille de
// l'onglet sales_team de CeoDashboard est purement UI + un appel
// apiClient.getAssignableUsers(), on la reproduit ici en standalone
// pour ne pas toucher au CeoDashboard qui tourne en prod (sacred-ish
// zone : 1996 lignes, refactor récent).
//
// Auth gate : admin | ceo | acquisition_director | head_of_acquisition.
// L'endpoint /api/v1/users/assignable est ouvert à tout user actif
// authentifié (pas de require_admin), donc les 4 rôles peuvent fetch.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_acquisition"]);

const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function CeoSalesTeamView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync) ──────────────────────────────────────
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

  // ── SIDEBAR COLLAPSE ────────────────────────────────────────────────
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed");
    return stored === null ? false : stored === "true";
  });
  useEffect(() => {
    localStorage.setItem("ceoSideCollapsed", String(sideCollapsed));
  }, [sideCollapsed]);

  // ── AUTH GATE ───────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || !ALLOWED_ROLES.has(u.role)) {
      navigate("/");
      return;
    }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  // ── FETCH ASSIGNABLE USERS ──────────────────────────────────────────
  const [salesTeamUsers, setSalesTeamUsers] = useState([]);
  const [salesTeamLoading, setSalesTeamLoading] = useState(false);
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    setSalesTeamLoading(true);
    apiClient.getAssignableUsers()
      .then((resp) => {
        if (!alive) return;
        const list = Array.isArray(resp) ? resp : (resp?.users || resp?.data || []);
        setSalesTeamUsers(list);
      })
      .catch((e) => { console.warn("[CeoSalesTeamView] getAssignableUsers failed:", e); })
      .finally(() => { if (alive) setSalesTeamLoading(false); });
    return () => { alive = false; };
  }, [authChecked]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sales_team") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    navigateBackToDashboard(navigate, userRole, tabId);
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
        background: darkMode ? "#13141b" : "#f6f7f9",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      <style>{`
        @keyframes ceoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes ceoCardPop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes ceoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .ceo-side { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
        .ceo-side-item { transition: background 0.12s ease; }
        .ceo-side-item:hover { background: ${darkMode ? "rgba(255,255,255,0.05)" : "#f5f5f4"}; }
        .ceo-icon-btn { transition: background 0.12s, color 0.12s; }
        .ceo-icon-btn:hover { background: ${darkMode ? "rgba(255,255,255,0.05)" : "#f5f5f4"}; }
        .ceo-side-scroll::-webkit-scrollbar { width: 10px; }
        .ceo-side-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .ceo-side-scroll:hover::-webkit-scrollbar-thumb { background: ${darkMode ? "rgba(255,255,255,0.18)" : "rgba(55,53,47,0.16)"}; background-clip: padding-box; }
        .ceo-side-scroll::-webkit-scrollbar-track { background: transparent; }
        /* ceo-card border (miroir CeoDashboard) pour cohérence visuelle. */
        .ceo-card {
          position: relative;
          border-radius: 16px;
          background: transparent;
          border: none;
          overflow: visible;
          isolation: isolate;
        }
        .ceo-card::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 18px;
          background: linear-gradient(180deg, #EDEDEE 0%, #DCDCDD 100%);
          z-index: -2;
          pointer-events: none;
        }
        .ceo-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          background: linear-gradient(180deg, #FCFCFD 0%, #F8F8F8 40%, #F8F8F8 60%, #F3F3F4 100%);
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.85);
          pointer-events: none;
          z-index: -1;
        }
      `}</style>

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
          activeTab="sales_team"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      {/* Workspace — SharedNavbar (dynamic-island) au-dessus, puis la
          grille Équipe Sales. paddingTop pour passer sous la navbar
          flottante. */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

        <div style={{ padding: '32px 56px 64px' }}>
          <div style={{ animation: 'ceoFadeIn 0.35s ease both' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Équipe Sales</h1>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>
              Accédez aux Tracking Sheets individuels — mode ghost (lecture transparente, pas de notification).
            </p>

            {salesTeamLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="ceo-card" style={{ padding: '18px 20px', height: 96, animation: `ceoCardPop 0.4s ease ${i * 60}ms both` }}>
                    <div style={{ width: '100%', height: '100%', background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 8, animation: 'ceoPulse 1.4s ease-in-out infinite' }} />
                  </div>
                ))}
              </div>
            )}

            {!salesTeamLoading && salesTeamUsers.length === 0 && (
              <div className="ceo-card" style={{ padding: 40, textAlign: 'center', color: C.muted, animation: 'ceoCardPop 0.4s ease both' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <p style={{ fontSize: 14, margin: 0 }}>Aucun commercial trouvé.</p>
              </div>
            )}

            {!salesTeamLoading && salesTeamUsers.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {salesTeamUsers.map((u, i) => {
                  const name = u.full_name || u.name || u.email;
                  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#fb923c'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={u.email || u.id} className="ceo-card" style={{
                      padding: '18px 20px',
                      display: 'flex', flexDirection: 'column', gap: 14,
                      animation: `ceoCardPop 0.4s ease ${i * 60}ms both`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 14, fontWeight: 700,
                        }}>{getInitials(name)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                          <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/ceo/sheet/${encodeURIComponent(u.email)}?ghost=true`)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '9px 14px', borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          color: C.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = C.accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border; }}
                      >
                        Voir tracking sheet
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
