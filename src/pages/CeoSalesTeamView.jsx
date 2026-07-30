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
import SalesTeamGrid from "../components/SalesTeamGrid.jsx";
import SettersGrid from "../components/SettersGrid.jsx";
import SalesSettersToggle from "../components/SalesSettersToggle.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "acquisition_director", "head_of_acquisition", "finance_director"]);

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
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => {
    localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed));
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

  // ── FETCH ASSIGNABLE USERS + ÉQUIPES ────────────────────────────────
  // Les deux en parallèle : /assignable donne la liste (email + avatar +
  // rôle, déjà filtrée is_active), /teams sert à regrouper par équipe.
  const [salesTeamUsers, setSalesTeamUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [salesTeamLoading, setSalesTeamLoading] = useState(false);
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    setSalesTeamLoading(true);
    Promise.all([
      apiClient.getAssignableUsers().catch((e) => { console.warn("[CeoSalesTeamView] getAssignableUsers failed:", e); return null; }),
      apiClient.getTeams().catch((e) => { console.warn("[CeoSalesTeamView] getTeams failed:", e); return null; }),
    ])
      .then(([usersResp, teamsResp]) => {
        if (!alive) return;
        const list = Array.isArray(usersResp) ? usersResp : (usersResp?.users || usersResp?.data || []);
        setSalesTeamUsers(list);
        setTeams(Array.isArray(teamsResp) ? teamsResp : (teamsResp?.teams || []));
      })
      .finally(() => { if (alive) setSalesTeamLoading(false); });
    return () => { alive = false; };
  }, [authChecked]);

  // ── VUE Sales / Setters (toggle) + fetch setters (lazy, 1re visite) ──
  const [view, setView] = useState("sales");
  const [setters, setSetters] = useState([]);
  const [settersLoading, setSettersLoading] = useState(false);
  const [settersFetched, setSettersFetched] = useState(false);
  useEffect(() => {
    if (view !== "setters" || settersFetched || settersLoading) return;
    let alive = true;
    setSettersLoading(true);
    apiClient.getSettersOverview()
      .then((resp) => { if (alive) setSetters(Array.isArray(resp) ? resp : (resp?.setters || [])); })
      .catch((e) => { console.warn("[CeoSalesTeamView] getSettersOverview failed:", e); })
      .finally(() => { if (alive) { setSettersLoading(false); setSettersFetched(true); } });
    return () => { alive = false; };
  }, [view, settersFetched, settersLoading]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "sales_team") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === 'optilex_board') { navigate('/ceo/optilex-board'); return; }
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  {view === 'sales' ? 'Équipe Sales' : 'Setters'}
                </h1>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                  {view === 'sales'
                    ? 'Accédez aux Tracking Sheets individuels en mode ghost (lecture transparente, pas de notification).'
                    : 'Les setters classés par équipe, avec les sales dont ils traitent les leads.'}
                </p>
              </div>
              <SalesSettersToggle view={view} setView={setView} C={C} darkMode={darkMode} />
            </div>

            {view === 'sales' ? (
              <SalesTeamGrid
                users={salesTeamUsers}
                teams={teams}
                loading={salesTeamLoading}
                C={C}
                darkMode={darkMode}
                onOpenSheet={(email) => navigate(`/ceo/sheet/${encodeURIComponent(email)}?ghost=true`)}
              />
            ) : (
              <SettersGrid
                setters={setters}
                teams={teams}
                loading={settersLoading}
                C={C}
                darkMode={darkMode}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
