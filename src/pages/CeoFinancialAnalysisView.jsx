// src/pages/CeoFinancialAnalysisView.jsx
//
// « Analyse financière » dans le dashboard (section Finance), même gabarit que les autres pages du dashboard
// (menu de gauche filtré par rôle), au style Owner.
// Mise en page du 17/11/2026, d'après la référence donnée par le dev (« Customer Journeys » : grands panneaux arrondis
// posés l'un dans l'autre, un parcours en colonnes reliées par des traits, pastilles rondes, une tuile noire, des
// anneaux), avec nos couleurs. La page raconte le parcours d'un client dans le temps : la signature, la première
// année, l'après. Une niche se choisit en haut du panneau (ou dans le tableau) et restreint tous les chiffres.
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
import { AnimatePresence, motion as Motion } from "framer-motion";
import { CalendarClock, Hourglass, Info, LayoutGrid, PenLine, Timer, Undo2, X } from "lucide-react";
import { Empty, Page, Reveal } from "./TrackingSheetFinance/components/PageKit.jsx";
import { Collapse, Fill, Num, ProgressRing } from "./TrackingSheetFinance/statistics/parts.jsx";
import { financialAnalysis, lifetimeLabel } from "../utils/financialAnalysis.js";
// Le kit de la page Finance ne porte pas le mode sombre : cette feuille le lui donne sous `.ab-root`.
import "../components/automationBoard/automation.css";
import "./financialAnalysis.css";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "financial_analysis";
const number = (value) => (value == null ? "–" : Number(value).toLocaleString("fr-FR"));
const percent = (rate) => (rate == null ? "–" : `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
// Un montant en court, pour une tuile : 2 847 300 € se lit « 2,8 M€ ».
const compactEuros = (value) => (value == null ? "–" : value >= 1e6 ? `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`
  : value >= 1e4 ? `${Math.round(value / 1e3).toLocaleString("fr-FR")} k€` : `${Math.round(value).toLocaleString("fr-FR")} €`);
const frenchDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const todayInParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const plural = (count, one, many) => `${number(count)} ${count > 1 ? many : one}`;
const stepLabel = (months) => (months >= 12 && months % 12 === 0 ? `${months / 12} an${months > 12 ? "s" : ""}` : `${months} mois`);
const EASE = [0.22, 1, 0.36, 1];
// Le parcours : des lignes de hauteur fixe, pour que les traits tombent juste d'une colonne à l'autre.
const ROW = 72;
const PAD = 12;
const GAP = 64;
const rowY = (index) => PAD + index * ROW + ROW / 2;

// Bouton rond, comme sur la référence : une pastille blanche à trait fin.
function Round({ title, onClick, pressed, children }) {
  return <button type="button" className="fa-round" title={title} aria-label={title} aria-pressed={pressed} onClick={onClick}>{children}</button>;
}

// Les deux lettres d'une niche, dans son rond.
const monogram = (label) => {
  const words = String(label || "?").replace(/[^\p{L}\s-]/gu, "").split(/[\s-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
};

// Une ligne d'une carte du parcours : un rond (picto ou anneau), deux lignes de texte, le chiffre à droite.
function Step({ lead, title, sub, value, tone, hint }) {
  return (
    <div className="fa-row" data-tone={tone} title={hint}>
      <span className="fa-row-lead">{lead}</span>
      <span className="fa-row-text"><b>{title}</b><small>{sub}</small></span>
      <span className="fa-row-value fst-num">{value}</span>
    </div>
  );
}

// Les traits entre deux colonnes du parcours : une courbe par lien, un point à chaque bout. Un lien sans arrivée
// (`to` absent) s'arrête en chemin, en pointillé : ceux-là ne continuent pas.
function Links({ links, rows }) {
  const height = PAD * 2 + rows * ROW;
  return (
    <svg className="fa-links" width={GAP} height={height} viewBox={`0 0 ${GAP} ${height}`} aria-hidden="true">
      {links.map(({ from, to }, index) => {
        const y1 = rowY(from);
        const dead = to == null;
        const y2 = dead ? y1 : rowY(to);
        const path = dead ? `M0 ${y1} H${GAP * 0.5}` : `M0 ${y1} C${GAP * 0.5} ${y1} ${GAP * 0.5} ${y2} ${GAP} ${y2}`;
        return (
          <g key={`${from}-${to}`} className={dead ? "is-dead" : undefined}>
            <Motion.path d={path} fill="none" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.25 + index * 0.08 }} />
            <circle cx={3} cy={y1} r={3} />
            <circle cx={dead ? GAP * 0.5 : GAP - 3} cy={y2} r={3} />
          </g>
        );
      })}
    </svg>
  );
}

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
  // La niche choisie (clé du secteur) : tous les chiffres s'y restreignent ; `null` : tout le parc.
  const [sector, setSector] = useState(null);
  const [rules, setRules] = useState(false);
  const stats = useMemo(() => financialAnalysis(rows, asOf, sector), [rows, asOf, sector]);

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
  // Le parcours en deux temps : jusqu'à un an, puis après.
  const firstYear = (stats?.survival || []).filter((step) => step.months <= 12);
  const later = (stats?.survival || []).filter((step) => step.months > 12);
  const scope = sector == null ? null : stats?.sectors.find((item) => item.key === sector);
  const scopeName = sector == null ? "Tout le parc" : scope?.label || "Niche";

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
              {/* Le parcours d'un client : un grand panneau, les niches en haut, quatre colonnes reliées par des traits. */}
              <Reveal>
                <section className="fa-panel fa-journey" aria-label="Le parcours d’un client">
                  <div className="fa-niches" role="group" aria-label="Choisir une niche">
                    <button type="button" className="fa-niche" aria-pressed={sector == null} title="Tout le parc" onClick={() => setSector(null)}>
                      <span className="fa-niche-face"><LayoutGrid size={16} strokeWidth={1.8} /></span>
                      <span className="fa-niche-count fst-num">{number(stats.sectors.reduce((sum, item) => sum + item.open, 0))}</span>
                    </button>
                    {stats.sectors.filter((item) => item.key !== "others").slice(0, 8).map((item) => (
                      <button key={item.key || "none"} type="button" className="fa-niche" aria-pressed={sector === item.key}
                        title={`${item.label} : ${plural(item.open, "client en cours", "clients en cours")}`} onClick={() => setSector(sector === item.key ? null : item.key)}>
                        <span className="fa-niche-face">{item.key === "" ? "?" : monogram(item.label)}</span>
                        <span className="fa-niche-count fst-num">{number(item.open)}</span>
                      </button>
                    ))}
                  </div>
                  <header className="fa-panel-head">
                    <div>
                      <h3 className="fa-panel-title">Le parcours d’un client</h3>
                      <AnimatePresence mode="wait" initial={false}>
                        <Motion.p key={scopeName} className="fa-panel-sub" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                          {scopeName}
                        </Motion.p>
                      </AnimatePresence>
                    </div>
                    <div className="fa-panel-tools">
                      {sector != null && <Round title="Revenir à tout le parc" onClick={() => setSector(null)}><X size={16} strokeWidth={1.8} /></Round>}
                      <Round title="La règle de calcul" pressed={rules} onClick={() => setRules((value) => !value)}><Info size={16} strokeWidth={1.8} /></Round>
                    </div>
                  </header>

                  <div className="fa-flow" key={sector ?? "all"}>
                    <div className="fa-col">
                      <div className="fa-card">
                        <Step lead={<PenLine size={16} strokeWidth={1.8} />} title="Clients signés" sub="depuis le début" value={<Num value={stats.signed} />}
                          hint="Les clients dont la durée de vie est mesurée : signés, avec une date de signature exploitable." />
                        <Step tone="out" lead={<Undo2 size={16} strokeWidth={1.8} />} title="Rétractés" sub="hors calcul" value={<Num value={stats.retracted} />}
                          hint="Les rétractés n’entrent dans aucun calcul." />
                      </div>
                      <p className="fa-caption">Signature</p>
                    </div>
                    <Links rows={Math.max(2, firstYear.length)} links={[...firstYear.map((_, index) => ({ from: 0, to: index })), { from: 1 }]} />
                    <div className="fa-col">
                      <div className="fa-card">
                        {firstYear.length === 0 && <Step lead={<Timer size={16} strokeWidth={1.8} />} title="Trop tôt pour le dire" sub="aucun client assez ancien" value="–" />}
                        {firstYear.map((step) => (
                          <Step key={step.months} lead={<ProgressRing value={step.rate} size={38} stroke={4} label={`${percent(step.rate)} encore là à ${stepLabel(step.months)}`} />}
                            title={`À ${stepLabel(step.months)}`} sub={`${number(step.kept)} sur ${number(step.eligible)}`} value={percent(step.rate)}
                            hint={`Parmi les ${number(step.eligible)} clients signés depuis au moins ${stepLabel(step.months)}, ${number(step.kept)} étaient encore là à ce terme.`} />
                        ))}
                      </div>
                      <p className="fa-caption">Première année</p>
                    </div>
                    <Links rows={Math.max(firstYear.length, later.length + 1)} links={firstYear.length ? [...later.map((_, index) => ({ from: firstYear.length - 1, to: index })), { from: firstYear.length - 1, to: later.length }] : []} />
                    <div className="fa-col">
                      <div className="fa-card">
                        {later.map((step) => (
                          <Step key={step.months} lead={<ProgressRing value={step.rate} size={38} stroke={4} label={`${percent(step.rate)} encore là à ${stepLabel(step.months)}`} />}
                            title={`À ${stepLabel(step.months)}`} sub={`${number(step.kept)} sur ${number(step.eligible)}`} value={percent(step.rate)}
                            hint={`Parmi les ${number(step.eligible)} clients signés depuis au moins ${stepLabel(step.months)}, ${number(step.kept)} étaient encore là à ce terme.`} />
                        ))}
                        <Step tone="strong" lead={<Hourglass size={16} strokeWidth={1.8} />} title="Au-delà d’un an" sub={year.passed ? `en moyenne · ${number(year.passed)} clients` : "aucun client n’a un an"}
                          value={year.passed ? `+ ${lifetimeLabel(year.extraDays)}` : "–"}
                          hint="Ceux qui ont passé leur première année : le temps qu’ils sont restés en plus, en moyenne. Il avance chaque jour pour ceux qui sont encore là." />
                      </div>
                      <p className="fa-caption">Après un an</p>
                    </div>
                    <div className="fa-col fa-col--tiles">
                      <div className="fa-tiles">
                        <div className="fa-tile is-main" title="De la signature à la date d’effet de la sortie ; pour un client encore là, jusqu’à aujourd’hui.">
                          <span>Durée de vie moyenne</span><b>{lifetimeLabel(life.averageDays)}</b><small>gagne un jour chaque jour</small>
                        </div>
                        <div className="fa-tile"><span>Médiane</span><b>{lifetimeLabel(life.medianDays)}</b><small>la moitié reste plus</small></div>
                        <div className="fa-tile"><span>Clients en cours</span><b className="fst-num"><Num value={stats.inCourse} /></b><small>signés, pas sortis</small></div>
                        <div className="fa-tile"><span>Partis</span><b className="fst-num"><Num value={stats.gone} /></b><small>dont {plural(global.count, "résiliation", "résiliations")}</small></div>
                        {sector == null ? (
                          <>
                            <div className="fa-tile"><span>Sociétés</span><b className="fst-num">{number(product?.companies)}</b><small>{product?.companies_as_of ? "accompagnées" : "portail indisponible"}</small></div>
                            <div className="fa-tile" title="Les gains réalisés par les clients, cumulés, tels que le portail les arrête chaque nuit."><span>Économies</span><b className="fst-num">{compactEuros(product?.savings)}</b><small>{product?.savings_as_of ? "réalisées par les clients" : "portail indisponible"}</small></div>
                          </>
                        ) : (
                          <>
                            <div className="fa-tile"><span>Part du parc</span><b className="fst-num">{percent(scope?.share)}</b><small>des clients en cours</small></div>
                            <div className="fa-tile"><span>Résiliés</span><b className="fst-num">{percent(global.rate)}</b><small>depuis le début</small></div>
                          </>
                        )}
                      </div>
                      <p className="fa-caption">En chiffres</p>
                    </div>
                  </div>

                  <Collapse open={rules}>
                    <dl className="fa-rules">
                      <div><dt>Durée de vie</dt><dd>De la signature Owner à la date d’effet de la sortie. Un client encore là compte jusqu’à aujourd’hui : chaque jour qui passe l’allonge.</dd></div>
                      <div><dt>Encore là à N mois</dt><dd>Parmi les clients signés depuis au moins N mois, la part qui était encore cliente à ce terme.</dd></div>
                      <div><dt>Résiliation du mois</dt><dd>Résiliations datées dans le mois ÷ clients en cours la veille du 1er.</dd></div>
                      <div><dt>Depuis le début</dt><dd>Toutes les résiliations ÷ clients en cours aujourd’hui (définition de la feuille de la Finance).</dd></div>
                      <div><dt>Hors calcul</dt><dd>Les rétractés{life.unmeasured + life.incoherent > 0 ? ` ; ${plural(life.unmeasured + life.incoherent, "client sans date exploitable", "clients sans date exploitable")}` : ""}{global.undated > 0 ? ` ; ${plural(global.undated, "résiliation sans date", "résiliations sans date")}` : ""}.</dd></div>
                    </dl>
                  </Collapse>
                </section>
              </Reveal>

              <Reveal className="fa-bottom">
                {/* Les niches : le tableau complet ; un clic sur une ligne restreint la page à cette niche. */}
                <section className="fa-panel" aria-label="Les niches">
                  <header className="fa-panel-head">
                    <div>
                      <h3 className="fa-panel-title">Les niches</h3>
                      <p className="fa-panel-sub">{plural(stats.named, "secteur", "secteurs")}{stats.unknown ? ` · ${plural(stats.unknown, "client sans secteur", "clients sans secteur")}` : ""}</p>
                    </div>
                  </header>
                  <div className="fa-table" role="table" aria-label="Clients par secteur">
                    <div className="fa-tr fa-th" role="row">
                      <span role="columnheader">Secteur</span><span role="columnheader">En cours</span><span role="columnheader">Part du parc</span>
                      <span role="columnheader">Résiliés</span><span role="columnheader">Durée de vie</span>
                    </div>
                    {stats.sectors.map((item, index) => {
                      const pickable = item.key !== "others";
                      const Row = pickable ? "button" : "div";
                      return (
                        <Row key={item.key || "none"} role="row" className="fa-tr" style={{ "--i": index }} aria-pressed={pickable ? sector === item.key : undefined}
                          {...(pickable ? { type: "button", onClick: () => setSector(sector === item.key ? null : item.key), title: "Restreindre la page à cette niche" } : {})}>
                          <span role="cell" className="fa-sector"><i>{item.key === "" ? "?" : item.key === "others" ? "…" : monogram(item.label)}</i>{item.label}</span>
                          <span role="cell" className="fst-num">{number(item.open)}</span>
                          <span role="cell" className="fa-share"><Fill value={item.share} /><em className="fst-num">{percent(item.share)}</em></span>
                          <span role="cell" className="fst-num">{item.resiliated ? <mark>{number(item.resiliated)}</mark> : "–"}</span>
                          <span role="cell" className="fst-num">{lifetimeLabel(item.averageDays)}</span>
                        </Row>
                      );
                    })}
                  </div>
                </section>

                {/* Les résiliations : deux anneaux, le mois et depuis le début, le nombre dans sa pastille. */}
                <section className="fa-panel" aria-label="Les résiliations">
                  <header className="fa-panel-head">
                    <div>
                      <h3 className="fa-panel-title">Les résiliations</h3>
                      <p className="fa-panel-sub">{scopeName}</p>
                    </div>
                  </header>
                  <div className="fa-rings">
                    <div className="fa-ring" data-tone="out" title="Résiliations datées dans le mois, rapportées aux clients en cours la veille du 1er.">
                      <span className="fa-bubble fst-num">{number(month.count)}</span>
                      <ProgressRing value={month.rate} size={168} stroke={16} color="var(--red)" label={`Résiliation du mois : ${percent(month.rate)}`}>
                        <b className="fst-num">{percent(month.rate)}</b><small>ce mois</small>
                      </ProgressRing>
                      <p>{plural(month.count, "résiliation", "résiliations")} pour {number(month.base)} clients<br />{percent(previous.rate)} le mois dernier</p>
                    </div>
                    <div className="fa-ring" title="Toutes les résiliations depuis le début, rapportées aux clients en cours aujourd’hui.">
                      <span className="fa-bubble fst-num">{number(global.count)}</span>
                      <ProgressRing value={global.rate} size={168} stroke={16} label={`Résiliation depuis le début : ${percent(global.rate)}`}>
                        <b className="fst-num">{percent(global.rate)}</b><small>depuis le début</small>
                      </ProgressRing>
                      <p>{plural(global.count, "résiliation", "résiliations")}<br />pour {number(global.base)} clients en cours</p>
                    </div>
                  </div>
                </section>
              </Reveal>
            </>
          )}
        </Page>
      </div>
    </div>
  );
}
