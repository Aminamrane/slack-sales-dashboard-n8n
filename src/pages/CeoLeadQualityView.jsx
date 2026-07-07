// src/pages/CeoLeadQualityView.jsx
//
// Route /ceo/lead-quality — embed MonitoringPerf en mode "Qualité Leads"
// dans le shell CEO / Acquisition Director. Strictement identique à
// CeoPerfSalesView, sauf injection `?view=lead-quality` qui pousse
// MonitoringPerf à initialiser son viewMode sur lead_quality.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import MonitoringPerf from "./MonitoringPerf.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "acquisition_director", "head_of_acquisition"]);

export default function CeoLeadQualityView() {
  const navigate = useNavigate();

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

  // Inject `embed=true` + `view=lead-quality` via replaceState.
  const [paramsInjected, setParamsInjected] = useState(false);
  useEffect(() => {
    if (!authChecked) return;
    const incoming = new URLSearchParams(window.location.search);
    let changed = false;
    if (incoming.get("embed") !== "true") { incoming.set("embed", "true"); changed = true; }
    if (incoming.get("view") !== "lead-quality") { incoming.set("view", "lead-quality"); changed = true; }
    if (changed) {
      window.history.replaceState(null, "", `${window.location.pathname}?${incoming.toString()}`);
    }
    setParamsInjected(true);
  }, [authChecked]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  const handleSidebarTabClick = (tabId) => {
    if (tabId === "lead_quality") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === 'optilex_board') { navigate('/ceo/optilex-board'); return; }
    navigateBackToDashboard(navigate, userRole, tabId);
  };

  if (!authChecked || !paramsInjected) {
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
        // Aligné sur le body override de MonitoringPerf
        // (#ffffff light / #13141b dark) pour éviter la bande sous la
        // SharedNavbar dans la zone paddingTop:64 du wrapper droit.
        background: darkMode ? "#13141b" : "#ffffff",
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
          activeTab="lead_quality"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <MonitoringPerf />
      </div>
    </div>
  );
}
