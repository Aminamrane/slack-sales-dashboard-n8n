// src/pages/CeoFinancialAnalysisView.jsx
//
// « Analyse financière » dans le dashboard (section Finance), même gabarit que les autres pages du dashboard (menu de
// gauche filtré par rôle), au style Owner. Demande de la direction du 26/10/2026 : la durée de vie moyenne d'un
// client (LTV), qui avance chaque jour sauf pour ceux qui sont partis, le taux de résiliation du mois et depuis le début,
// au bout de quand on résilie, les niches, SARL / SAS, les gains au global et par client.
//
// Refonte du 18/11/2026 (« it takes a long time to load », « this card with links doesn't make any sense », « GE doesn't
// mean anything », « we can't even select a date », « we don't know how you calculate the LTV ») :
//   - lecture par une route dédiée (lignes réduites, gardées quinze minutes côté serveur) et dernière lecture gardée dans
//     le navigateur : la page s'affiche tout de suite, puis se met à jour ;
//   - un mois se choisit en haut, ou d'un clic sur une barre des résiliations : tout est recalculé à cette date ;
//   - les niches en toutes lettres ; une niche restreint tous les chiffres ;
//   - la LTV posée comme une division, avec ses vrais nombres, et le détail du calcul à un clic ;
//   - le parcours en cartes reliées remplacé par une courbe de rétention et la répartition des départs.
// Accès : CEO et admin (onglet + route).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { Page } from "./TrackingSheetFinance/components/PageKit.jsx";
import { asOfMonth, financialAnalysis, fromApi, fromBoard, monthBounds, monthLabel } from "../utils/financialAnalysis.js";
import { Answer, Departures, Gains, LegalForms, MonthlyResiliations, MonthPicker, NicheBar, Niches, Panel, RetentionCurve, Skeleton }
  from "../components/financialAnalysis/Sections.jsx";
import { number, percent } from "../components/financialAnalysis/format.js";
import { lifetimeLabel } from "../utils/financialAnalysis.js";
// Le kit de la page Finance ne porte pas le mode sombre : cette feuille le lui donne sous `.ab-root`.
import "../components/automationBoard/automation.css";
import "./financialAnalysis.css";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "financial_analysis";
// La dernière lecture, gardée dans ce navigateur pour un affichage immédiat (lignes sans nom ni numéro).
const CACHE_KEY = "fa-clients-v2";
const todayInParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const readCache = () => { try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const writeCache = (rows) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows })); } catch { /* stockage plein ou bloqué */ } };

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

  // ── DONNÉES : le board (durée de vie, résiliations, niches) et les chiffres du portail (sociétés, économies) ──

  // ── DONNÉES ──
  // La dernière lecture s'affiche tout de suite ; la route dédiée la remplace dès qu'elle répond. Sans la route
  // (back pas encore livré), repli sur le board complet, plus lent.
  const [rows, setRows] = useState(() => readCache()?.rows || null);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const load = useCallback(async () => {
    try {
      let next;
      try {
        next = fromApi((await apiClient.get("/api/v1/ceo-dashboard/financial-analysis"))?.clients);
      } catch (e) {
        if (e?.status !== 404) throw e;
        next = fromBoard((await apiClient.get("/api/v1/optilex/board"))?.clients);
      }
      setRows(next);
      setFresh(true);
      setError("");
      writeCache(next);
    } catch (e) {
      setError(e?.message || "Les chiffres du board Owner/Opti'Lex sont indisponibles.");
    }
    // Les chiffres du portail sont un complément : sans eux, le reste de la page se lit quand même.
    try { setProduct(await apiClient.get("/api/v1/ceo-dashboard/product")); } catch { setProduct(null); }
  }, []);
  useEffect(() => {
    if (!authChecked) return undefined;
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [authChecked, load]);

  const today = todayInParis();
  const bounds = useMemo(() => monthBounds(rows || [], today), [rows, today]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sector, setSector] = useState(null);
  const asOf = asOfMonth(month, today);
  const stats = useMemo(() => financialAnalysis(rows, asOf, sector, { today }), [rows, asOf, sector, today]);
  const scope = sector == null ? null : stats?.sectors.find((item) => item.key === sector);
  const scopeName = sector == null ? "Tout le parc" : scope?.label || "Niche";
  const pickMonth = (key) => setMonth(key < bounds.first ? bounds.first : key > bounds.last ? bounds.last : key);

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
      className="ceo-page ab-root fa-root"
      style={{
        display: "flex",
        height: "100vh",
        background: darkMode ? "#141414" : "#f4f2ef",
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

      <div style={{ height: "100vh", display: "flex", flexShrink: 0 }}>
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

      <div style={{ flex: 1, minWidth: 0, display: "flex", height: "100vh" }}>
        <Page title="Analyse financière"
          sub="Combien de temps un client reste, combien partent, et de quoi le parc est fait."
          actions={<MonthPicker value={month} bounds={bounds} onChange={pickMonth} />}>
          {error && <div className="fst-error" role="alert">{error}<button type="button" onClick={load}>Réessayer</button></div>}
          {!stats ? <Skeleton /> : (
            <div className="fa-page" data-fresh={fresh || undefined}>
              <NicheBar sectors={stats.sectors} total={stats.sectors.reduce((sum, item) => sum + item.open, 0)} value={sector} onChange={setSector} />

              <Answer stats={stats} scopeName={scopeName} today={today} />

              <div className="fa-two">
                <Panel index={1} title="Combien de temps ils restent"
                  sub="La part des clients encore là, au bout de chaque durée. Survolez la courbe pour le détail.">
                  <RetentionCurve key={`${sector}-${month}`} curve={stats.curve} />
                </Panel>
                <Panel index={2} title="Au bout de quand ils résilient" sub="Le temps passé chez nous par les clients partis par résiliation.">
                  <Departures departures={stats.departures} />
                </Panel>
              </div>

              <Panel index={3} title="Les résiliations, mois par mois"
                sub={`Le taux de chaque mois${sector == null ? "" : ` pour ${scopeName}`} ; depuis le début : ${percent(stats.resiliationGlobal.rate)}. Cliquez un mois pour le regarder.`}>
                <MonthlyResiliations months={stats.months} value={month} onPick={pickMonth} />
              </Panel>

              <div className="fa-three">
                <Panel index={4} title="Les niches" className="fa-span-2"
                  sub={`${number(stats.named)} secteurs${stats.unknown ? ` · ${number(stats.unknown)} clients sans secteur` : ""}. Cliquez une niche pour la regarder.`}>
                  <Niches sectors={stats.sectors} value={sector} onPick={setSector} />
                </Panel>
                <div className="fa-stack">
                  <Panel index={5} title="Formes juridiques" sub={`Les clients en cours${sector == null ? "" : ` (${scopeName})`}.`}>
                    <LegalForms forms={stats.forms} />
                  </Panel>
                  <Panel index={6} title="Gains" sub="Les économies réalisées par les clients.">
                    <Gains product={product} inCourse={stats.inCourse} scoped={sector != null} />
                  </Panel>
                </div>
              </div>

              <p className="fa-source">
                Board Owner/Opti’Lex{fresh ? "" : " · dernière lecture gardée, mise à jour en cours"} · arrêté au {monthLabel(month) === monthLabel(today.slice(0, 7)) ? "jour" : `${asOf.split("-").reverse().join("/")}`}
                {" "}· {number(stats.measured)} clients mesurés, durée de vie médiane {lifetimeLabel(stats.lifetime.medianDays)}
              </p>
            </div>
          )}
        </Page>
      </div>
    </div>
  );
}
