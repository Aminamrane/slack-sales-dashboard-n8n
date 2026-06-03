// src/pages/AcquisitionDirectorDashboard.jsx
//
// Route /acquisition-director — coquille du Dashboard Directeur Acquisition.
//
// Architecture (miroir CeoLeaderboardView / CeoDispatchView) :
// - URL : /acquisition-director
// - Réutilise EXACTEMENT la CeoSidebar (exports nommés de CeoDashboard.jsx) :
//   même palette, mêmes sections (RÉCENTES / HUMAN / ACQUISITION / MARKETING
//   / FINANCE), mêmes animations.
// - Workspace de droite = coquille placeholder. Le dev précisera les KPIs
//   métier à implémenter dans une 2e passe (sections à venir).
// - Aucun mock de KPI ici : la coquille assume sa nature transitoire.
//
// Gate : admin | ceo | head_of_acquisition | marketing. À l'audit du
// codebase, `head_of_acquisition` n'apparaît nulle part côté front
// (rôles connus = admin, ceo, head_of_sales, head_of_sales_manager,
// sales, commercial, tech, finance, finance_director, finance_team,
// marketing). Le rôle est gardé dans la liste pour qu'il fonctionne
// dès que le backend l'aura matérialisé — aucune entrée nouvelle n'est
// créée côté front (role_permissions intouché par design).
//
// Navigation sidebar : cliquer un item rejoint l'écosystème CEO :
//   - "Dispatch"     → /ceo/dispatch
//   - "Leaderboard"  → /ceo/leaderboard
//   - tous les autres → /ceo avec `ceoActiveTab` posé en localStorage,
//     que CeoDashboard consomme à son mount (pattern identique aux
//     autres wrappers Ceo*).
// Cliquer "Dashboard" dans la sidebar = no-op (on est déjà dessus —
// activeTab est highlighté à 'dashboard').

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";

const ALLOWED_ROLES = ["admin", "ceo", "head_of_acquisition", "acquisition_director", "marketing"];

export default function AcquisitionDirectorDashboard() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync; pas de toggle interne ici) ───────────
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

  // ── SIDEBAR COLLAPSE (mirror CeoDashboard pattern, key partagée) ────
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
    if (!u || !ALLOWED_ROLES.includes(u.role)) {
      navigate("/login");
      return;
    }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);

  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  // Cliquer un item de la sidebar = rejoindre l'écosystème CEO :
  // - dispatch / leaderboard ont leur route dédiée (cohérent avec
  //   CeoLeaderboardView et CeoDispatchView entre eux).
  // - tous les autres tabs → on pose `ceoActiveTab` en localStorage et
  //   on navigate vers /ceo, où CeoDashboard lira le flag à son mount.
  // Cliquer "Dashboard" depuis cette vue est un no-op (déjà highlighté).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "dashboard") return;
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    try { localStorage.setItem("ceoActiveTab", tabId); } catch { /* noop */ }
    navigate("/ceo");
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
        background: darkMode ? "#13141b" : "#f6f7f9",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* CSS scopé identique à CeoLeaderboardView pour que la sidebar ait
          le même comportement hover / scrollbar / transitions. */}
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

        /* Keyframes locales pour ne pas dépendre de la chaîne d'import
           CeoDashboard (qui injecte ces keyframes en in-flight CSS dans
           son propre render). Noms identiques pour cohérence visuelle. */
        @keyframes acqFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes acqCardPop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Sidebar sticky comme CeoLeaderboardView : le wrapper est en flex
          column pour que la motion.aside enfant prenne toute la hauteur du
          viewport sans étirer la page entière. */}
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

      {/* Workspace droit — coquille placeholder. Le dev viendra brancher
          ici les sections métier acquisition (KPIs, tables, charts) dans
          une 2e passe. Pas de mock entre-temps : un placeholder neutre
          fait moins de bruit qu'un mock qui pourrait être confondu avec
          de la donnée réelle. */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "48px 56px 64px",
          animation: "acqFadeIn 0.4s ease both",
          overflowY: "auto",
        }}
      >
        <header style={{ marginBottom: 40 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: C.text,
              lineHeight: 1.15,
            }}
          >
            Acquisition Director Dashboard
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 15,
              fontWeight: 400,
              color: C.muted,
              letterSpacing: "-0.005em",
            }}
          >
            Vue Acquisition · Owner Technology
          </p>
        </header>

        <section
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "56px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textAlign: "center",
            boxShadow: C.shadow,
            animation: "acqCardPop 0.45s ease 80ms both",
          }}
        >
          <div
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: C.accent,
              marginBottom: 6,
            }}
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: C.text,
              letterSpacing: "-0.01em",
            }}
          >
            Sections à venir
          </h2>
        </section>
      </main>
    </div>
  );
}
