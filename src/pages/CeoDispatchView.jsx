// src/pages/CeoDispatchView.jsx
//
// Route /ceo/dispatch — vue CEO de la page TrackingSheetFinance (dispatch).
//
// Architecture (miroir de CeoSheetView pour TS embed) :
// - URL : /ceo/dispatch
// - On injecte `?embed=true` dans window.location.search via replaceState
//   (TSF lit ce flag pour masquer sa sidebar interne + élargir son auth
//   gate au rôle ceo).
// - On rend la CeoSidebar (importée nommée de CeoDashboard) + TSF tel quel.
//
// Gate : seul role=ceo (et admin pour debug) peut accéder.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import TrackingSheetFinance from "./TrackingSheetFinance/index.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_acquisition"]);

export default function CeoDispatchView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync with localStorage; TSF owns its own) ──
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

  // ── SIDEBAR COLLAPSE (mirror CeoDashboard pattern) ──────────────────
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

  // ── INJECT TSF EMBED FLAG via history.replaceState ──────────────────
  // TSF lit `embed` depuis window.location.search au mount. On préserve
  // le path /ceo/dispatch (pour le routing + Back) mais on injecte
  // ?embed=true. Doit s'exécuter AVANT le mount de TSF.
  const [paramsInjected, setParamsInjected] = useState(false);
  useEffect(() => {
    if (!authChecked) return;
    const incoming = new URLSearchParams(window.location.search);
    if (incoming.get("embed") !== "true") {
      incoming.set("embed", "true");
      const newUrl = `${window.location.pathname}?${incoming.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
    setParamsInjected(true);
  }, [authChecked]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  // Clicking any sidebar item returns to /ceo with the chosen tab
  // pre-selected via localStorage `ceoActiveTab`. Cliquer "Dispatch"
  // depuis cette vue est un no-op (déjà dessus).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "dispatch") return;
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
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
        height: "100vh",
        overflow: "hidden",
        background: C.surface,
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

      <Sidebar
        width={sideCollapsed ? 56 : 260}
        collapsed={sideCollapsed}
        onToggle={() => setSideCollapsed((v) => !v)}
        sections={visibleSections}
        activeTab="dispatch"
        setActiveTab={handleSidebarTabClick}
        C={C}
        darkMode={darkMode}
      />

      {/* Embedded TrackingSheetFinance — `?embed=true` est déjà dans la query
          via replaceState (lecture sync au mount). On rend la SharedNavbar
          (dynamic-island) au-dessus pour cohérence avec /ceo. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: 'relative' }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <TrackingSheetFinance />
      </div>
    </div>
  );
}
