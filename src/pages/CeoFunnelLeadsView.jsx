// src/pages/CeoFunnelLeadsView.jsx
//
// Route /ceo/funnel-leads — page Funnel Leads embeddée dans le shell
// CEO / Acquisition Director (sidebar shared + SharedNavbar).
//
// Pattern strictement aligné sur CeoWebinarView : auth gate, sticky
// sidebar 100vh, injection `?embed=true` via history.replaceState pour
// masquer la SharedNavbar interne de FunnelLeads et réduire son padding.
//
// Auth gate : admin | ceo | acquisition_director. La page standalone reste
// accessible aux mêmes rôles via /funnel-leads (sans la sidebar Ceo).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import FunnelLeads from "./FunnelLeads/index.jsx";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director"]);

export default function CeoFunnelLeadsView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync — FunnelLeads gère son propre toggle) ──
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

  // ── INJECT EMBED FLAG via history.replaceState ──────────────────────
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
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "funnel_leads") return; // déjà ici
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
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
        background: darkMode ? "#0f1117" : "#ecedf2",
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
          activeTab="funnel_leads"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      {/* Funnel Leads embarqué — `?embed=true` masque sa SharedNavbar
          interne et réduit son padding-top. On rend ici la dynamic-island
          pour cohérence avec /ceo. `paddingTop: 64` pour passer dessous. */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <FunnelLeads />
      </div>
    </div>
  );
}
