// src/pages/CeoSalesTeamView.jsx
//
// Route /ceo/sales-team — la page « Équipe » (Sales / Setters) dans le shell CEO / Acquisition Director
// (barre latérale partagée). Le contenu vit dans components/equipe/ (refonte du 19/11/2026 : une équipe = un panneau,
// une personne = une rangée avec un bouton rond, les setters à plat puisqu'il n'y a plus d'équipes côté setters).
//
// Gabarit identique aux autres vues CEO (CeoSettersView, CeoPerfSalesView…).
// Auth gate : admin | ceo | hr | acquisition_director | head_of_acquisition | finance_director.
// Les lectures (/api/v1/users/assignable, /teams, /users/setters-overview) sont ouvertes à tout compte actif authentifié.
// ?view=setters ouvre la vue Setters (retour depuis un compte setter en mode ghost).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import EquipePage from "../components/equipe/EquipePage.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "acquisition_director", "head_of_acquisition", "finance_director"]);

export default function CeoSalesTeamView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync) ──────────────────────────────────────
  // La classe `dark-mode` du body est posée par le bouton de thème de la barre latérale : on la suit à chaque changement
  // (plus de sondage toutes les 500 ms), et une fois à l'ouverture, comme le premier passage du sondage le faisait.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "darkMode") setDarkMode(e.newValue === "true");
    };
    const sync = () => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((prev) => (prev !== isDark ? isDark : prev));
    };
    window.addEventListener("storage", onStorage);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => {
      window.removeEventListener("storage", onStorage);
      observer.disconnect();
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

  // ── VUE Sales / Setters : portée par l'adresse (?view=setters), donc retour du navigateur et lien direct fonctionnent ──
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "setters" ? "setters" : "sales";
  const setView = useCallback((next) => {
    setSearchParams((prev) => {
      const q = new URLSearchParams(prev);
      if (next === "setters") q.set("view", "setters"); else q.delete("view");
      return q;
    }, { replace: true });
  }, [setSearchParams]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "sales_recordings") { navigate("/ceo/sales-recordings"); return; }
    if (tabId === "sales_team") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "variables") { navigate("/ceo/variables"); return; }
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "work_hours") { navigate("/ceo/work-hours"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
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
          activeTab="sales_team"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', paddingTop: 16 }}>
        <EquipePage darkMode={darkMode} view={view} onView={setView} />
      </div>
    </div>
  );
}
