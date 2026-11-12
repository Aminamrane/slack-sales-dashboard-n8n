// src/pages/CeoAutomationView.jsx
//
// « Automatisation des missions » dans le dashboard (section Produit, sous le board Owner/Opti'Lex) :
// le suivi des process d'Opti'Lex, lu en direct dans le logiciel. Même gabarit que les autres pages du
// dashboard (menu de gauche filtré par rôle), au style Owner (12/11/2026). La liste donne la vue d'ensemble ;
// un clic sur une ligne ouvre la page de la mission (`?process=<id>`, le retour du navigateur revient à la liste), où l'on
// suit l'avancement, pose une note et règle le classement et l'étape. Les documents et la validation par la direction
// du cabinet restent dans Opti'Lex. Accès : CEO et admin (onglet + route + API).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { PERIODS, countLabel, visibleRows } from "../utils/automationBoard";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { CheckCheck, ChevronRight, CircleCheck, CircleDashed, CircleDot, Gauge, Hourglass, ListChecks, MessageCircle, Milestone, Search, Tags, X } from "lucide-react";
import { Card, Empty, OpenCue, Page, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th } from "./TrackingSheetFinance/components/PageKit.jsx";
import { Bar, Steps, Usage } from "../components/automationBoard/parts";
import { TONE_OF, number, palette } from "../components/automationBoard/theme";
import ProcessPage from "../components/automationBoard/ProcessPage";
import "../components/automationBoard/automation.css";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "optilex_automation";
const API = "/api/v1/optilex/automation-board";
const TILE_ICONS = { automated: CircleCheck, pending_validation: Hourglass, automated_unused: CircleDot, not_automated: CircleDashed };
const SPRING = { type: "spring", stiffness: 520, damping: 40 };

// Routes propres aux onglets de la barre ; les autres passent par navigateBackToDashboard.
const TAB_ROUTES = {
  sequences: "/ceo/sequences", webinar: "/ceo/webinar", dispatch: "/ceo/dispatch", leaderboard: "/ceo/leaderboard",
  perf_sales: "/ceo/perf-sales", autoassign: "/ceo/auto-affectation", variables: "/ceo/variables", conges: "/ceo/conges",
  work_hours: "/ceo/work-hours", lead_quality: "/ceo/lead-quality", sales_team: "/ceo/sales-team",
  sales_recordings: "/ceo/sales-recordings", campaigns: "/ceo/campaigns", funnel_leads: "/ceo/funnel-leads",
  my_tracking_sheet: "/tracking-sheet", optilex_board: "/ceo/optilex-board", leads_management: "/ceo/leads-management",
  financial_analysis: "/ceo/analyse-financiere",
};

export default function CeoAutomationView() {
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

  // ── DONNÉES : le tableau, relu toutes les minutes tant que l'onglet est visible ──
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [classification, setClassification] = useState("");
  const [pole, setPole] = useState("");
  const [toConfirm, setToConfirm] = useState(false);
  const [closed, setClosed] = useState(() => new Set());
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const next = await apiClient.get(`${API}${period ? `?periode=${period}` : ""}`);
      if (mine !== seq.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e?.message || "Le board Opti'Lex est indisponible.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!authChecked) return undefined;
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(timer);
  }, [authChecked, load]);

  const P = useMemo(() => palette(C, darkMode), [C, darkMode]);
  const lines = useMemo(
    () => visibleRows(data?.rows, { query, classification, pole, toConfirm, closed }),
    [data, query, classification, pole, toConfirm, closed],
  );
  const filtering = Boolean(query.trim() || classification || pole || toConfirm);
  const openId = Number(params.get("process")) || null;
  const openProcess = useCallback((id) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("process", String(id)); else next.delete("process");
      return next;
    }, { replace: !id });
  }, [setParams]);
  const closeProcess = useCallback(() => openProcess(null), [openProcess]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [openId]);
  const toggle = (id) => setClosed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const reset = () => { setQuery(""); setClassification(""); setPole(""); setToConfirm(false); };

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

  const periods = PERIODS.map((value) => ({ key: value ?? 0, label: value ? `${value} jours` : "Depuis le début" }));
  const chips = [
    classification && { key: "classification", label: data?.classifications?.find((item) => item.value === classification)?.shortLabel || classification, clear: () => setClassification("") },
    pole && { key: "pole", label: data?.poleGroups?.[pole] || pole, clear: () => setPole("") },
  ].filter(Boolean);

  return (
    <div
      className="ceo-page ab-root"
      style={{
        display: "flex",
        height: "100vh",
        background: P.page,
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
        {openId && data ? (
          <ProcessPage key={openId} id={openId} period={period} frame={data} onClose={closeProcess} onOpen={openProcess} onChanged={load} P={P} />
        ) : (
          <Page title="Automatisation des missions"
            sub="Où en est chaque mission d’Opti’Lex : ce que le logiciel fait déjà, ce qui attend une validation, ce qui reste à automatiser."
            actions={<Segmented options={periods} value={period ?? 0} onChange={(key) => setPeriod(key || null)} label="Période de l'utilisation du logiciel" />}>
            {((error && data) || (data?.stale && !error)) && (
              <div className="fst-error" role="status">
                Opti&apos;Lex ne répond pas pour l&apos;instant : les chiffres affichés sont {error ? `ceux de ${data.at}` : `les derniers reçus (${data.at})`}.
              </div>
            )}

            {!data && (error ? (
              <div className="fst-error" role="alert">{error}<button type="button" onClick={load}>Réessayer</button></div>
            ) : <Empty boxed>Lecture du board dans Opti&apos;Lex…</Empty>)}

            {data && (
              <>
                <Stats>
                  <Stat label="Part automatisée" text={`${data.totals.automatedShare} %`} Icon={Gauge} tone="green"
                    note="des missions classées passent par un process automatisé" />
                  {data.classifications.map((item) => {
                    const tile = data.tiles?.[item.value] || { count: 0, volume: 0 };
                    const active = classification === item.value;
                    return (
                      <Stat key={item.value} label={item.shortLabel} value={tile.count} Icon={TILE_ICONS[item.value] || CircleDashed} title={item.help || undefined}
                        note={countLabel(tile.volume, "mission", "missions")} onClick={() => setClassification(active ? "" : item.value)} pressed={active} />
                    );
                  })}
                </Stats>

                <Reveal>
                  <Card title="Les missions" Icon={ListChecks} state={{ data, loading, error: "" }}
                    hint="Un clic sur une ligne ouvre le suivi de la mission : cahier des charges, avancement, échanges.">
                    <div className="fst-tools">
                      <div className="fst-tabs" role="group" aria-label="Classements à confirmer">
                        {[[false, "Toutes", data.totals.lines], [true, "À confirmer", data.totals.toConfirm]].map(([value, label, count]) => (
                          <button key={label} type="button" className="fst-tab" aria-pressed={toConfirm === value} onClick={() => setToConfirm(value)}>
                            {toConfirm === value && <Motion.span layoutId="ab-confirm-tab" className="fst-tab-bg" transition={SPRING} />}
                            <span>{label}</span><span className="fst-tab-count fst-num">{number(count)}</span>
                          </button>
                        ))}
                      </div>
                      <select className="fst-select" value={pole} onChange={(e) => setPole(e.target.value)} aria-label="Pôle">
                        <option value="">Tous les pôles</option>
                        {Object.entries(data.poleGroups || {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <AnimatePresence initial={false}>
                        {chips.map((chip) => (
                          <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} onClick={chip.clear} title="Retirer ce filtre">
                            {chip.label}<X size={13} />
                          </Motion.button>
                        ))}
                      </AnimatePresence>
                      <label className="fst-search">
                        <Search size={14} />
                        <input type="search" placeholder="Chercher une mission" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher une mission" />
                      </label>
                    </div>

                    {lines.length === 0 ? <Empty boxed>Aucune mission ne correspond à ces filtres.{filtering && <> <button type="button" className="ab-textlink" onClick={reset}>Tout afficher</button></>}</Empty> : (
                      <TableBox minWidth={1020}>
                        <thead>
                          <tr>
                            <Th Icon={ListChecks}>Mission</Th>
                            <Th Icon={CheckCheck}>Réalisées</Th>
                            <Th Icon={Gauge}>Utilisation du logiciel</Th>
                            <Th Icon={MessageCircle}>Messagerie</Th>
                            <Th Icon={Tags}>Classement</Th>
                            <Th Icon={Milestone}>Avancement</Th>
                          </tr>
                        </thead>
                        <tbody key={`${period}-${classification}-${pole}-${toConfirm}-${query}`}>
                          {lines.map(({ row, depth, children, open, dimmed }, index) => (
                            <tr key={row.id} data-open="true" tabIndex={0} aria-label={`Ouvrir le suivi de ${row.name}`} style={{ "--i": index, opacity: dimmed ? 0.6 : 1 }}
                              onClick={() => openProcess(row.id)}
                              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openProcess(row.id); } }}>
                              <td>
                                <div className="ab-name" data-depth={depth}>
                                  {children > 0 ? (
                                    <button type="button" className="ab-fold" aria-expanded={open} aria-label={open ? `Replier ${row.name}` : `Déplier ${row.name}`}
                                      onClick={(e) => { e.stopPropagation(); toggle(row.id); }}><ChevronRight size={15} /></button>
                                  ) : <span className="ab-rank fst-num">{depth ? "" : row.rank}</span>}
                                  <div style={{ minWidth: 0 }}>
                                    <div className="ab-title">{row.name}</div>
                                    <div className="ab-sub">
                                      {[
                                        row.isParent ? `Process · ${countLabel(row.members, "mission", "missions")}` : null,
                                        row.pole?.label,
                                        row.comments ? countLabel(row.comments, "note", "notes") : null,
                                        row.files ? countLabel(row.files, "document", "documents") : null,
                                      ].filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                  <OpenCue />
                                </div>
                              </td>
                              <td>
                                <div className="fst-num" style={{ fontWeight: 500 }}>{number(row.total)} <span className="fst-cell-muted" style={{ fontWeight: 400, fontSize: 12 }}>· {number(row.recent)} sur 90 j</span></div>
                                <div style={{ marginTop: 6, maxWidth: 150 }}><Bar value={row.bar} color={P.faint} P={P} /></div>
                              </td>
                              <td style={{ minWidth: 190 }}><Usage usage={row.usage} P={P} /></td>
                              <td className="fst-num">
                                {row.messaging?.total ? <>{number(row.messaging.total)} <span className="fst-cell-muted" style={{ fontSize: 12 }}>· {row.messaging.share} %</span></> : <span className="fst-cell-muted">–</span>}
                              </td>
                              <td>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  <Tag tone={TONE_OF[row.classification]} title={data.classifications.find((item) => item.value === row.classification)?.help}>
                                    {data.classifications.find((item) => item.value === row.classification)?.shortLabel || "Non classée"}
                                  </Tag>
                                  {row.validated && <Tag tone="green">Validé</Tag>}
                                  {!row.validated && row.toConfirm && <Tag tone="peach">À confirmer</Tag>}
                                </div>
                              </td>
                              <td style={{ minWidth: 150 }}><Steps value={row.step} steps={data.steps} P={P} showLabel={false} /></td>
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
        )}
      </div>
    </div>
  );
}
