// src/pages/CeoVariablesView.jsx
//
// Route /ceo/variables : poste de travail Variables (features/variablesReview)
// dans le shell CEO (sidebar shared + SharedNavbar conservés). Calque de CeoAutoAssignView.
// Données CRM lues en direct par l'API, brouillon d'ajustements partagé côté serveur.
//
// Salaires = donnée CONFIDENTIELLE : accès admin, ceo, hr, finance_director
// (contrôlé aussi par le back, require_variables_access).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import VariablesWorkbench from "../features/variablesReview/VariablesWorkbench.jsx";
import { loadWorkbench, saveWorkbenchDraft } from "../features/variablesReview/api.js";
import { preloadAvatars } from "../features/variablesReview/avatars.js";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "hr", "finance_director"]);

// Même en-tête que le poste de travail : la page ne saute pas quand les données arrivent.
function WorkbenchStatus({ title, detail, onRetry, busy = false, darkMode = false }) {
  return (
    <div className={`vr-app vr-embedded ${darkMode ? "vr-dark" : ""}`}>
      <div className="vr-workspace"><main className="vr-main">
        <header className="vr-heading"><div><div className="vr-eyebrow">ÉQUIPE COMMERCIALE</div><h1>Variables & rémunérations</h1></div></header>
        <div className={`vr-status ${busy ? "busy" : ""}`} role={busy ? "status" : "alert"}>
          {busy && <span className="vr-status-spinner" aria-hidden="true" />}
          <h3>{title}</h3>
          {detail && <div className="vr-status-detail">{detail}</div>}
          {onRetry && <button className="vr-button" onClick={onRetry}>Réessayer</button>}
        </div>
      </main></div>
    </div>
  );
}

// GET /api/v1/variables/workbench → { source, draft }, relu à chaque visite de la page.
function LiveVariablesWorkbench({ darkMode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadWorkbench()
      .then((data) => {
        if (cancelled) return;
        if (!data?.source || !Array.isArray(data.source.statements)) {
          setState({ status: "error", detail: "Réponse inattendue du serveur." });
          return;
        }
        // Photos chargées et décodées avant l'affichage (plafond 1,5 s) : jamais de cercle vide.
        return preloadAvatars(data.source).then(() => {
          if (!cancelled) setState({ status: "ready", source: data.source, draft: data.draft });
        });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 403) setState({ status: "forbidden" });
        else setState({
          status: "error",
          detail: error?.status ? `Le serveur a répondu une erreur (${error.status}).` : "Connexion au serveur impossible.",
        });
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (state.status === "loading") return <WorkbenchStatus busy darkMode={darkMode} title="Lecture des données CRM…" />;
  if (state.status === "forbidden") {
    return <WorkbenchStatus darkMode={darkMode} title="Accès réservé" detail="Votre compte n’a pas accès aux variables des sales." />;
  }
  if (state.status === "error") {
    return <WorkbenchStatus darkMode={darkMode} title="Impossible de charger les variables" detail={state.detail} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (!state.source.statements.length) {
    return <WorkbenchStatus darkMode={darkMode} title="Aucune donnée à afficher" />;
  }
  return <VariablesWorkbench source={state.source} initialDraft={state.draft} saveDraft={saveWorkbenchDraft} darkMode={darkMode} />;
}

export default function CeoVariablesView() {
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

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // Cliquer "Variables Sales" depuis cette vue = no-op (déjà dessus).
  // Les autres onglets-route renvoient vers leur route dédiée (sinon page blanche).
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
    if (tabId === "variables") return;
    if (tabId === "conges") { navigate("/ceo/conges"); return; }
    if (tabId === "work_hours") { navigate("/ceo/work-hours"); return; }
    if (tabId === "autoassign") { navigate("/ceo/auto-affectation"); return; }
    if (tabId === "perf_sales") { navigate("/ceo/perf-sales"); return; }
    if (tabId === "dispatch") { navigate("/ceo/dispatch"); return; }
    if (tabId === "leaderboard") { navigate("/ceo/leaderboard"); return; }
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "sales_recordings") { navigate("/ceo/sales-recordings"); return; }
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
        background: darkMode ? "#13141b" : "#f7f8fa",
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
          activeTab="variables"
          setActiveTab={handleSidebarTabClick}
          C={C}
          darkMode={darkMode}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <LiveVariablesWorkbench darkMode={darkMode} />
      </div>
    </div>
  );
}
