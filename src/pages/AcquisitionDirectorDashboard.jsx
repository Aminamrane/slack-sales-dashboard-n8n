// src/pages/AcquisitionDirectorDashboard.jsx
//
// Route /acquisition-director — dashboard du Directeur Acquisition.
//
// Le dashboard AFFICHE le Leaderboard de la section Acquisition (la même vue
// que /ceo/leaderboard), embarqué dans la coquille : sidebar adaptée au rôle
// + SharedNavbar. On garde l'onglet "Dashboard" actif -> leur dashboard EST
// le leaderboard. Calque de CeoLeaderboardView, avec activeTab="dashboard".
//
// - Sidebar filtrée : Acquisition Director ne voit que {recent, acquisition}
//   (sidebarPermissions). Admin / CEO voient tout.
// - Leaderboard lit ?embed=true (injecté ici via replaceState) pour masquer
//   sa SharedNavbar interne et son paddingTop dédié.
//
// Gate : admin | ceo | head_of_acquisition | acquisition_director | marketing.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import Leaderboard from "./Leaderboard.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections, setNavScope } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = ["admin", "ceo", "head_of_acquisition", "acquisition_director", "marketing"];

export default function AcquisitionDirectorDashboard() {
  const navigate = useNavigate();
  // Contexte acquisition : la sidebar reste scopée Acquisition (recent + acquisition)
  // même dans les sous-vues /ceo/*, y compris pour un admin/ceo qui consulte. Et le
  // "Dashboard" renvoie ici (/acquisition-director), pas au dashboard CEO complet.
  setNavScope("acquisition_director");

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
    if (!u || !ALLOWED_ROLES.includes(u.role)) {
      navigate("/login");
      return;
    }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  // Le dashboard Acquisition Director = le Leaderboard. On injecte ?embed=true
  // AVANT le mount du Leaderboard (il lit ce flag au mount pour masquer sa navbar
  // interne), comme CeoLeaderboardView. On préserve le path /acquisition-director.
  const [paramsInjected, setParamsInjected] = useState(false);
  useEffect(() => {
    if (!authChecked) return;
    const incoming = new URLSearchParams(window.location.search);
    if (incoming.get("embed") !== "true") {
      incoming.set("embed", "true");
      window.history.replaceState(null, "", `${window.location.pathname}?${incoming.toString()}`);
    }
    setParamsInjected(true);
  }, [authChecked]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // Cliquer "Dashboard" = no-op (on est déjà dessus, il affiche le leaderboard).
  // Les autres onglets-route rejoignent leur route dédiée (sinon page blanche).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "dashboard") return;
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
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    try { localStorage.setItem("ceoActiveTab", tabId); } catch { /* noop */ }
    navigate("/ceo");
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
        // Aligné sur CARD.surface du Leaderboard (#edf0f8 light / #13141b dark)
        // pour éviter une coupure de couleur avec la zone droite embarquée.
        background: darkMode ? "#13141b" : "#edf0f8",
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
          activeTab="dashboard"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      {/* Dashboard Acquisition Director = Leaderboard embarqué (?embed=true injecté). */}
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <Leaderboard />
      </div>
    </div>
  );
}
