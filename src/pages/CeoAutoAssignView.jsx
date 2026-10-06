// src/pages/CeoAutoAssignView.jsx
//
// Route /ceo/auto-affectation — embed <LeadAssignmentLive embed /> dans le
// shell CEO / Acquisition Director (sidebar shared + SharedNavbar conservés).
//
// Calque de CeoPerfSalesView. Différence : LeadAssignmentLive prend le prop
// `embed` directement (pas d'injection ?embed=true via l'URL). Lecture seule
// pour ceo/acquisition_director (isAdmin=role==='admin' côté composant).

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import LeadAssignmentLive from "./LeadAssignmentLive.jsx";
import SetterAutoAssignMonitor from "../components/SetterAutoAssignMonitor.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "acquisition_director", "head_of_acquisition", "finance_director"]);

export default function CeoAutoAssignView() {
  const navigate = useNavigate();
  // Deux monitorings (06/10/2026) : les leads ads (auto-affectation historique) et les RDV posés par les setters.
  const [params, setParams] = useSearchParams();
  const view = params.get("vue") === "setters" ? "setters" : "ads";

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

  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => {
    localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed));
  }, [sideCollapsed]);

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

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // Cliquer "Auto-affectation" depuis cette vue = no-op (déjà dessus).
  // Les autres onglets-route renvoient vers leur route dédiée (sinon page blanche).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "autoassign") return;
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "work_hours") { navigate("/ceo/work-hours"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "sales_recordings") { navigate("/ceo/sales-recordings"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === 'my_tracking_sheet') { navigate('/tracking-sheet'); return; }
    if (tabId === 'optilex_board') { navigate('/ceo/optilex-board'); return; }
    if (tabId === "leads_management") { navigate("/ceo/leads-management"); return; }
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
        background: darkMode ? "#13141b" : "#f7f8fa",
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
          activeTab="autoassign"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <div style={{ padding: "18px 6px 0 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>Auto-affectation</h1>
          <div role="tablist" aria-label="Monitoring" style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.05)" : "#eceef2" }}>
            {[["ads", "Leads ads"], ["setters", "RDV setters"]].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key}
                onClick={() => setParams(key === "setters" ? { vue: "setters" } : {}, { replace: true })}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                  background: view === key ? (darkMode ? "#2a2b36" : "#ffffff") : "transparent",
                  color: view === key ? C.text : C.muted,
                  boxShadow: view === key && !darkMode ? "0 1px 2px rgba(16,24,40,0.08)" : "none", transition: "all .15s ease" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === "setters" ? <div style={{ padding: "14px 0 0" }}><SetterAutoAssignMonitor darkMode={darkMode} /></div> : <LeadAssignmentLive embed />}
      </div>
    </div>
  );
}
