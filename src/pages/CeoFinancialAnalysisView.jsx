// src/pages/CeoFinancialAnalysisView.jsx
//
// « Analyse financière » dans le dashboard (section Finance), même gabarit que les autres pages du dashboard
// (menu de gauche filtré par rôle), au style Owner, bâtie avec le kit de la page Finance.
// Demande du 26/10/2026 (pour le fonds) : la durée de vie moyenne d'un client, qui avance chaque jour sauf pour ceux
// qui sont partis, le taux de résiliation du mois et depuis le début, et de quoi le parc est fait (les niches).
// Tout se lit sur le board Owner/Opti'Lex, avec les mêmes définitions que le dashboard : les chiffres concordent.
// La rétention dans le temps répond à « combien de temps reste un client après sa première année ».
// Les sociétés et les économies réalisées viennent du portail (mêmes chiffres que le dashboard).
// À venir : formes juridiques, gains par client et par secteur (à lire dans Opti'Lex).
// Accès : CEO et admin (onglet + route).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { Building2, Calculator, CalendarClock, Hourglass, Layers, PiggyBank, Shapes, TrendingDown, Users } from "lucide-react";
import { Card, Empty, Page, Reveal, Stat, Stats, TableBox, Th } from "./TrackingSheetFinance/components/PageKit.jsx";
import { Fill } from "./TrackingSheetFinance/statistics/parts.jsx";
import { financialAnalysis, lifetimeLabel } from "../utils/financialAnalysis.js";
// Le kit de la page Finance ne porte pas le mode sombre : cette feuille le lui donne sous `.ab-root`.
import "../components/automationBoard/automation.css";
import "./financialAnalysis.css";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "financial_analysis";
const number = (value) => (value == null ? "–" : Number(value).toLocaleString("fr-FR"));
const percent = (rate) => (rate == null ? "–" : `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
const euros = (value) => (value == null ? "–" : `${Math.round(value).toLocaleString("fr-FR")} €`);
const frenchDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const todayInParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const plural = (count, one, many) => `${number(count)} ${count > 1 ? many : one}`;

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
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const load = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/v1/optilex/board");
      setRows(data?.clients || []);
      setError("");
    } catch (e) {
      setError(e?.message || "Le board Owner/Opti'Lex est indisponible.");
    }
    // Les chiffres du portail sont un complément : sans eux, le reste de la page se lit quand même.
    try { setProduct(await apiClient.get("/api/v1/ceo-dashboard/product")); } catch { setProduct(null); }
  }, []);
  useEffect(() => {
    if (!authChecked) return undefined;
    load();
    // Relue toutes les cinq minutes : la durée de vie gagne un jour chaque jour, les sorties s'y ajoutent.
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [authChecked, load]);
  const asOf = todayInParis();
  const stats = useMemo(() => financialAnalysis(rows, asOf), [rows, asOf]);

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

  const life = stats?.lifetime;
  const month = stats?.resiliationMonth;
  const previous = stats?.resiliationPreviousMonth;
  const global = stats?.resiliationGlobal;
  const year = stats?.afterFirstYear;

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
          actions={stats && <span className="fa-asof"><CalendarClock size={14} strokeWidth={1.9} />Au {frenchDate(asOf)}</span>}>
          {error && <div className="fst-error" role="alert">{error}<button type="button" onClick={load}>Réessayer</button></div>}
          {!stats && !error && <Empty boxed>Lecture du board Owner/Opti&apos;Lex…</Empty>}

          {stats && (
            <>
              <Stats>
                <Stat label="Durée de vie moyenne" text={lifetimeLabel(life.averageDays)} Icon={Hourglass}
                  title="De la signature à la date d’effet de la sortie ; pour un client encore là, jusqu’à aujourd’hui. Elle gagne un jour chaque jour."
                  note={`médiane ${lifetimeLabel(life.medianDays)} · ${plural(life.measured, "client mesuré", "clients mesurés")}`} />
                <Stat label="Résiliation du mois" text={percent(month.rate)} Icon={TrendingDown} tone={month.count ? "amber" : undefined}
                  title="Résiliations datées dans le mois, rapportées aux clients en cours la veille du 1er."
                  note={`${plural(month.count, "résiliation", "résiliations")} pour ${number(month.base)} clients · ${percent(previous.rate)} le mois dernier`} />
                <Stat label="Résiliation depuis le début" text={percent(global.rate)} Icon={Layers}
                  title="Toutes les résiliations depuis le début, rapportées aux clients en cours aujourd’hui (définition de la Finance)."
                  note={`${plural(global.count, "résiliation", "résiliations")} pour ${number(global.base)} clients en cours`} />
                <Stat label="Sociétés accompagnées" text={number(product?.companies)} Icon={Building2}
                  note={product?.companies_as_of ? `au ${frenchDate(product.companies_as_of)}` : "chiffre du portail indisponible"} />
                <Stat label="Économies réalisées" text={euros(product?.savings)} Icon={PiggyBank} tone="green"
                  title="Les gains réalisés par les clients, cumulés, tels que le portail les arrête chaque nuit."
                  note={product?.savings_as_of ? `arrêté au ${frenchDate(product.savings_as_of)}` : "chiffre du portail indisponible"} />
              </Stats>

              <Reveal className="fst-grid">
                <Card title="Rétention dans le temps" Icon={Users}
                  hint="Parmi les clients signés depuis au moins ce délai, la part encore là à son terme.">
                  {stats.survival.length === 0 ? <Empty>Pas encore assez d’ancienneté pour le dire.</Empty> : (
                    <div className="fa-steps">
                      {stats.survival.map((step) => (
                        <div key={step.months} className="fa-step" title={`${number(step.kept)} encore là sur ${number(step.eligible)} clients signés depuis au moins ${step.months} mois`}>
                          <span className="fa-step-label">{step.months >= 12 && step.months % 12 === 0 ? `${step.months / 12} an${step.months > 12 ? "s" : ""}` : `${step.months} mois`}</span>
                          <Fill value={step.rate} />
                          <span className="fa-step-rate fst-num">{percent(step.rate)}</span>
                          <span className="fa-step-base fst-num">{number(step.kept)} sur {number(step.eligible)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {year.passed > 0 && (
                    <p className="fa-note">
                      <strong>Après la première année</strong> : {plural(year.passed, "client l’a passée", "clients l’ont passée")}, dont {number(year.stillHere)} encore là.
                      Ils sont restés en moyenne <strong>{lifetimeLabel(year.extraDays)} de plus</strong>
                      {year.gone > 0 && <> ; ceux qui sont partis ensuite l’ont fait {lifetimeLabel(year.goneExtraDays)} après leur premier anniversaire</>}.
                    </p>
                  )}
                </Card>

                <Card title="La règle de calcul" Icon={Calculator} hint="La même partout : ici, sur le dashboard et dans la feuille de la Finance.">
                  <dl className="fa-rules">
                    <div><dt>Durée de vie</dt><dd>De la signature Owner à la date d’effet de la sortie. Un client encore là compte jusqu’à aujourd’hui : chaque jour qui passe l’allonge.</dd></div>
                    <div><dt>Résiliation du mois</dt><dd>Résiliations datées dans le mois ÷ clients en cours la veille du 1er.</dd></div>
                    <div><dt>Depuis le début</dt><dd>Toutes les résiliations ÷ clients en cours aujourd’hui.</dd></div>
                    <div><dt>Client en cours</dt><dd>Signé et pas encore sorti : pauses et départs annoncés compris.</dd></div>
                    <div><dt>Hors calcul</dt><dd>Les rétractés, qui n’ont jamais vraiment commencé{life.unmeasured + life.incoherent > 0 ? ` ; ${plural(life.unmeasured + life.incoherent, "client sans date exploitable", "clients sans date exploitable")}` : ""}{global.undated > 0 ? ` ; ${plural(global.undated, "résiliation sans date", "résiliations sans date")}` : ""}.</dd></div>
                  </dl>
                </Card>
              </Reveal>

              <Reveal>
                <Card title="Les niches" Icon={Shapes}
                  hint={`Les clients par secteur d’activité, tel qu’il est noté sur leur fiche. ${plural(stats.named, "secteur", "secteurs")}${stats.unknown ? ` ; ${plural(stats.unknown, "client sans secteur", "clients sans secteur")}` : ""}.`}>
                  {stats.sectors.length === 0 ? <Empty>Aucun client mesuré.</Empty> : (
                    <TableBox minWidth={720}>
                      <thead>
                        <tr>
                          <Th Icon={Shapes}>Secteur</Th>
                          <Th Icon={Users} num>Clients en cours</Th>
                          <Th Icon={Layers}>Part du parc</Th>
                          <Th Icon={TrendingDown} num>Résiliés</Th>
                          <Th Icon={Hourglass} num>Durée de vie moyenne</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sectors.map((sector, index) => (
                          <tr key={sector.key || "none"} style={{ "--i": index }} data-muted={sector.key === "" || sector.key === "others" ? "true" : undefined}>
                            <td><span className="fa-sector">{sector.label}</span></td>
                            <td className="fst-num fa-right">{number(sector.open)}</td>
                            <td><div className="fa-share"><Fill value={sector.share} /><span className="fst-num">{percent(sector.share)}</span></div></td>
                            <td className="fst-num fa-right">{sector.resiliated ? number(sector.resiliated) : <span className="fst-cell-muted">–</span>}</td>
                            <td className="fst-num fa-right">{lifetimeLabel(sector.averageDays)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </TableBox>
                  )}
                </Card>
              </Reveal>
            </>
          )}
        </Page>
      </div>
    </div>
  );
}
