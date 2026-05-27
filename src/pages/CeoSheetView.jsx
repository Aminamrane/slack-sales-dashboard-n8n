// src/pages/CeoSheetView.jsx
//
// Route /ceo/sheet/:email — vue CEO d'une Tracking Sheet sales individuelle.
//
// Architecture :
// - URL navigation (router) : /ceo/sheet/<email>?ghost=true
// - À l'arrivée, on injecte via history.replaceState les params que TS lit :
//   ?sheet_id=<email>&ghost=true&embed=true. On garde le path /ceo/sheet/...
//   (donc reload / Back fonctionne normalement).
// - On rend la CeoSidebar (importée nommée de CeoDashboard) + TrackingSheet
//   tel quel. TS lit window.location.search au mount → fonctionne grâce au
//   replaceState. SharedNavbar interne du TS est masqué via embed=true.
//
// Gate : seul role=ceo (et admin, pour debug interne) peut accéder.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import TrackingSheet from "./TrackingSheet.jsx";
import { CeoSidebar, SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";

export default function CeoSheetView() {
  const navigate = useNavigate();
  const { email } = useParams();

  // ── DARK MODE (read-only sync with localStorage; TS owns its own toggle) ──
  // CeoSheetView is a layout shell — the embedded TrackingSheet has its own
  // dark mode toggle inside its dynamic-island navbar. We only read the
  // current value to colour the sidebar consistently, and re-sync on a
  // storage event in case the user toggles it from the TS.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "darkMode") setDarkMode(e.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    // Poll body class for same-window changes (storage event doesn't fire in same tab).
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
  useEffect(() => {
    const u = apiClient.getUser();
    if (!u || (u.role !== "ceo" && u.role !== "admin")) {
      navigate("/");
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  // ── INJECT TS QUERY PARAMS via history.replaceState ─────────────────
  // TrackingSheet lit `sheet_id`, `ghost`, `embed` depuis window.location.search
  // au mount (l.224-226 + l.347 + l.2404). On préserve le path /ceo/sheet/<email>
  // (pour le routing + Back) mais on remplace la query string avec ce que TS attend.
  // Ceci doit s'exécuter AVANT le mount de TrackingSheet, donc en effect synchrone
  // ici, et on attend authChecked + paramsInjected pour rendre TS.
  const [paramsInjected, setParamsInjected] = useState(false);
  useEffect(() => {
    if (!authChecked || !email) return;
    const incoming = new URLSearchParams(window.location.search);
    // Ghost is the default for CEO impersonation (lecture transparente, pas
    // d'effet collatéral côté presence cursors / WS). Honour an explicit
    // ?ghost=false escape hatch for admin debug.
    const wantGhost = incoming.get("ghost") === "false" ? "false" : "true";
    const targetSearch = new URLSearchParams();
    targetSearch.set("sheet_id", email);
    targetSearch.set("ghost", wantGhost);
    targetSearch.set("embed", "true");
    const newUrl = `${window.location.pathname}?${targetSearch.toString()}`;
    if (window.location.search !== `?${targetSearch.toString()}`) {
      window.history.replaceState(null, "", newUrl);
    }
    setParamsInjected(true);
  }, [authChecked, email]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  // Clicking any sidebar item from this view returns to /ceo with the chosen
  // tab pre-selected. We pass the tab id via localStorage (`ceoActiveTab`)
  // which CeoDashboard reads at mount. Simple, no API change, no router-level
  // state. Cleared after consumption by CeoDashboard.
  const handleSidebarTabClick = (tabId) => {
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
        background: C.surface,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* Shared CSS scaffolding mirrors CeoDashboard so the sidebar looks identical. */}
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

      <CeoSidebar
        width={sideCollapsed ? 56 : 260}
        collapsed={sideCollapsed}
        onToggle={() => setSideCollapsed((v) => !v)}
        sections={SIDEBAR_SECTIONS}
        activeTab="sales_team"
        setActiveTab={handleSidebarTabClick}
        C={C}
        darkMode={darkMode}
      />

      {/* Embedded TrackingSheet — params are already in window.location.search via replaceState. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TrackingSheet key={email} />
      </div>
    </div>
  );
}
