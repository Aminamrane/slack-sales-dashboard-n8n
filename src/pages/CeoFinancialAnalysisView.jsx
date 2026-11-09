// src/pages/CeoFinancialAnalysisView.jsx
//
// « Analyse financière » dans le dashboard (section Finance), même gabarit que
// CeoSmallLeadsView : sidebar CEO filtrée par rôle (menu de gauche, sans navbar). Page VIDE pour
// l'instant (09/11/2026) : le contenu viendra plus tard.
// Accès : CEO et admin (onglet + route).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "financial_analysis";

// Routes propres aux onglets de la barre ; les autres passent par navigateBackToDashboard.
const TAB_ROUTES = {
  sequences: "/ceo/sequences", webinar: "/ceo/webinar", dispatch: "/ceo/dispatch", leaderboard: "/ceo/leaderboard",
  perf_sales: "/ceo/perf-sales", autoassign: "/ceo/auto-affectation", variables: "/ceo/variables", conges: "/ceo/conges",
  work_hours: "/ceo/work-hours", lead_quality: "/ceo/lead-quality", sales_team: "/ceo/sales-team",
  sales_recordings: "/ceo/sales-recordings", campaigns: "/ceo/campaigns", funnel_leads: "/ceo/funnel-leads",
  my_tracking_sheet: "/tracking-sheet", optilex_board: "/ceo/optilex-board", leads_management: "/ceo/leads-management",
};

export default function CeoFinancialAnalysisView() {
  const navigate = useNavigate();

  // ── DARK MODE (piloté par le menu de gauche de ce wrapper) ──
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

  // La coquille est la source du thème de cette route (même raison que CeoSmallLeadsView).
  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode));
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  // ── SIDEBAR COLLAPSE ──
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => {
    localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed));
  }, [sideCollapsed]);

  // ── AUTH GATE ──
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

  const handleSidebarTabClick = (tabId) => {
    if (tabId === TAB_ID) return;
    if (TAB_ROUTES[tabId]) { navigate(TAB_ROUTES[tabId]); return; }
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

      <div style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", display: "flex" }}>
        <Sidebar
          width={sideCollapsed ? 56 : 260}
          collapsed={sideCollapsed}
          onToggle={() => setSideCollapsed((v) => !v)}
          sections={visibleSections}
          activeTab={TAB_ID}
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: 16 }}>
        {/* Page vide : le contenu de l'analyse financière viendra ici. */}
        <main aria-label="Analyse financière" />
      </div>
    </div>
  );
}
