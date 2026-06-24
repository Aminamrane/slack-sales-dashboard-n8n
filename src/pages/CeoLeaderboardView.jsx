// src/pages/CeoLeaderboardView.jsx
//
// Route /ceo/leaderboard — vue CEO de la page Leaderboard.
//
// Architecture (miroir de CeoDispatchView et CeoSheetView) :
// - URL : /ceo/leaderboard
// - On injecte `?embed=true` dans window.location.search via replaceState
//   (Leaderboard lit ce flag pour masquer son SharedNavbar interne + retirer
//   son paddingTop dédié à la navbar).
// - On rend la CeoSidebar (importée nommée de CeoDashboard) + Leaderboard
//   tel quel à droite.
//
// Gate : seul role=ceo (et admin pour debug) peut accéder à ce wrapper.
//   Leaderboard standalone reste accessible aux autres rôles via /leaderboard.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import Leaderboard from "./Leaderboard.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

// Rôles autorisés à embedder ce Leaderboard dans le wrapper sidebar.
// admin / ceo en ont toujours eu accès ; on ajoute acquisition_director
// pour qu'il puisse cliquer "Leaderboard" depuis son AcqDir Dashboard
// et atterrir ici avec SA sidebar restreinte (le filter s'occupe du reste).
const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_acquisition"]);

export default function CeoLeaderboardView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync ; Leaderboard owns its own toggle) ────
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

  // Sidebar filtrée selon le rôle (Acquisition Director ne voit que
  // RÉCENTES + ACQUISITION). Admin / CEO voient tout.
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── INJECT LEADERBOARD EMBED FLAG via history.replaceState ──────────
  // Leaderboard lit `embed` depuis window.location.search au mount. On
  // préserve le path /ceo/leaderboard (pour le routing + Back) mais on
  // injecte ?embed=true. Doit s'exécuter AVANT le mount de Leaderboard.
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

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  // Clicking any sidebar item returns to /ceo with the chosen tab
  // pre-selected via localStorage `ceoActiveTab`. Cliquer "Leaderboard"
  // depuis cette vue est un no-op (déjà dessus).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "leaderboard") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
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
        minHeight: "100vh",
        // Aligné sur CARD.surface du Leaderboard (#edf0f8 light, #13141b dark)
        // pour éviter une coupure de couleur entre `.ceo-page` et le wrapper
        // du Leaderboard quand ce dernier ne remplit pas toute la zone droite.
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

      {/* CeoSidebar sticky to viewport so scrolling the Leaderboard content
          on the right doesn't drag the sidebar. `display: flex` force le
          stretch par défaut → la motion.aside enfant prend 100% de la
          hauteur du wrapper et le footer flexShrink:0 se cale en bas. */}
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
          activeTab="leaderboard"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      {/* Embedded Leaderboard — `?embed=true` est déjà dans la query via
          replaceState (lecture sync au mount). On rend ici une SharedNavbar
          (dynamic-island) pour que le CEO / Acquisition Director gardent
          l'accès aux notifications et raccourcis comme sur /ceo. */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <Leaderboard />
      </div>
    </div>
  );
}
