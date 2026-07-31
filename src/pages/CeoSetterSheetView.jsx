// src/pages/CeoSetterSheetView.jsx
//
// Route /ceo/setter-sheet/:email — vue CEO (ghost, LECTURE) du tracking sheet
// d'un SETTER, INTÉGRÉE dans le shell dashboard (sidebar CEO + SharedNavbar),
// exactement comme CeoSheetView le fait pour un SALES.
//
// - On injecte sheet_id=<email>&ghost=true&embed=true (via replaceState, path
//   conservé pour le Back). TrackingSheetSetter lit `embed` -> masque sa navbar
//   et sa sidebar propres ; ce shell les fournit.
// - Les endpoints setter honorent ?as_setter=<email> pour les rôles privilégiés
//   (impersonation lecture seule) ; TrackingSheetSetter ajoute ce suffixe quand
//   sheet_id + ghost sont présents.
//
// Gate : admin / ceo / hr / acquisition_director / head_of_acquisition / finance_director.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import TrackingSheetSetter from "./TrackingSheetSetter.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "acquisition_director", "head_of_acquisition", "finance_director"]);

export default function CeoSetterSheetView() {
  const navigate = useNavigate();
  const { email } = useParams();

  // ── DARK MODE (read-only sync ; TS a son propre toggle) ─────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => { if (e.key === "darkMode") setDarkMode(e.newValue === "true"); };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((prev) => (prev !== isDark ? isDark : prev));
    }, 500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(interval); };
  }, []);

  // ── SIDEBAR COLLAPSE (miroir CeoDashboard) ──────────────────────────
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => { localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed)); }, [sideCollapsed]);

  // ── AUTH GATE ───────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || !ALLOWED_ROLES.has(u.role)) { navigate("/"); return; }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  // ── INJECT TS PARAMS via replaceState (sheet_id + ghost + embed) ────
  const [paramsInjected, setParamsInjected] = useState(false);
  useEffect(() => {
    if (!authChecked || !email) return;
    const target = new URLSearchParams();
    target.set("sheet_id", email);
    target.set("ghost", "true");
    target.set("embed", "true");
    const qs = `?${target.toString()}`;
    if (window.location.search !== qs) {
      window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
    }
    setParamsInjected(true);
  }, [authChecked, email]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER (miroir CeoSheetView) ────────────────
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === "optilex_board") { navigate("/ceo/optilex-board"); return; }
    navigateBackToDashboard(navigate, userRole, tabId);
  };

  if (!authChecked || !paramsInjected) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="ceo-page" style={{ display: "flex", minHeight: "100vh", background: C.surface, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", textRendering: "optimizeLegibility" }}>
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
        activeTab="sales_team"
        setActiveTab={handleSidebarTabClick}
        C={C}
        darkMode={darkMode}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <TrackingSheetSetter key={email} />
      </div>
    </div>
  );
}
