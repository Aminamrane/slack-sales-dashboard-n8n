// src/pages/CeoAutomationView.jsx
//
// « Automatisation des missions » dans le dashboard (section Produit, sous le board Owner/Opti'Lex) :
// le suivi des process d'Opti'Lex, lu en direct dans le logiciel. Même gabarit que les autres pages du
// dashboard (menu de gauche filtré par rôle), au style Owner (12/11/2026).
// Refonte du 17/11/2026 (« on est obligé de rentrer dans la fiche pour continuer le suivi, on ne peut pas faire le suivi
// vis-à-vis du tableau ») : le tableau est l'endroit où l'on suit. Chaque ligne dit où en est la mission (l'étiquette se
// clique pour changer l'état), donne la dernière parole posée dessus (on y répond sur place), qui la porte et pour
// quand, et le geste du moment (on y travaille, version livrée, valider…), qui s'enregistre depuis la ligne. La page
// s'ouvre sur « À suivre » : les missions rangées par ce qu'elles attendent, pas par volume ; les tuiles du haut sont
// les compteurs du suivi et filtrent la liste. Un clic sur la ligne ouvre la fiche à droite (`?process=<id>`), sans
// quitter la liste. La validation par la direction du cabinet reste dans Opti'Lex.
// Accès : CEO et admin (onglet + route + API).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { PERIODS, countLabel, followGroups, followTotals, gestureCall, planPeople, rowFollow, visibleRows } from "../utils/automationBoard";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { AlarmClock, ChevronRight, FlaskConical, Gauge, Hammer, ListChecks, MessageSquareQuote, Milestone, MousePointerClick, Search, UserRound, Wrench, X } from "lucide-react";
import { Card, Empty, OpenCue, Page, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th } from "./TrackingSheetFinance/components/PageKit.jsx";
import { TONE_OF, number, palette } from "../components/automationBoard/theme";
import MissionSheet from "../components/automationBoard/MissionSheet";
import { GestureCell, NewsCell, PlanCell, StateCell } from "../components/automationBoard/RowFollow";
import DevBoard from "../components/automationBoard/DevBoard";
import { COLUMN_HINTS, Hint } from "../components/automationBoard/Hint";
import "../components/automationBoard/automation.css";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "optilex_automation";
const API = "/api/v1/optilex/automation-board";
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
  // Vue de la liste : « À suivre » (les missions rangées par ce qu'elles attendent), toutes les missions par volume, le
  // suivi des développeurs en colonnes, ou les classements à confirmer. `focus` : la tuile du suivi qui filtre.
  const [view, setView] = useState("follow");
  const [focus, setFocus] = useState("");
  // Groupes de « À suivre » ouverts ou repliés à la main ; sans choix, « validé » et « pas commencé » sont repliés.
  const [folds, setFolds] = useState({});
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
  // Le suivi de chaque ligne (à qui de jouer, dernière parole, geste, groupe, date cible), calculé une fois par relevé.
  const follows = useMemo(() => new Map((data?.rows || []).map((row) => [row.id, rowFollow(row, data.steps)])), [data]);
  const totals = useMemo(() => followTotals(data?.rows, follows), [data, follows]);
  const people = useMemo(() => planPeople(data?.rows), [data]);
  const me = useMemo(() => { const user = apiClient.getUser(); return (user?.full_name || user?.email || "").trim(); }, []);
  const filters = useMemo(() => ({ query, classification, pole, focus }), [query, classification, pole, focus]);
  const groups = useMemo(() => {
    const closedKeys = new Set(Object.entries(folds).filter(([, open]) => !open).map(([key]) => key));
    const list = followGroups(data?.rows, follows, filters);
    // Un choix fait à la main l'emporte sur le repli par défaut.
    return list.map((group) => (group.key in folds ? { ...group, open: !closedKeys.has(group.key) } : group));
  }, [data, follows, filters, folds]);
  const lines = useMemo(
    () => visibleRows(data?.rows, { ...filters, follows, toConfirm: view === "confirm", closed }),
    [data, filters, follows, view, closed],
  );
  const filtering = Boolean(query.trim() || classification || pole || focus);
  const openId = Number(params.get("process")) || null;
  const openProcess = useCallback((id) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("process", String(id)); else next.delete("process");
      return next;
    }, { replace: !id });
  }, [setParams]);
  const closeProcess = useCallback(() => openProcess(null), [openProcess]);
  const toggle = (id) => setClosed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const reset = () => { setQuery(""); setClassification(""); setPole(""); setFocus(""); };
  // Un geste du suivi fait depuis la liste (on y travaille, point d'avancement, version livrée…) : Opti'Lex l'inscrit, la liste se relit.
  const act = useCallback(async (id, action, note) => {
    await apiClient.post(`${API}/${id}/action`, { action, note });
    await load();
  }, [load]);
  // Un geste ou un changement d'état fait sur une ligne du tableau : même enregistrement que depuis la fiche. La ligne
  // s'éclaire un instant quand c'est fait : le logiciel répond.
  const [flash, setFlash] = useState(null);
  const apply = useCallback(async (row, gesture, text) => {
    const call = gestureCall(row, gesture, text);
    await apiClient.post(`${API}/${row.id}/${call.path}`, call.body);
    await load();
    setFlash(row.id);
  }, [load]);
  useEffect(() => {
    if (flash == null) return undefined;
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [flash]);
  // Une réponse au cabinet écrite depuis la ligne : un commentaire partagé, enregistré dans Opti'Lex.
  const reply = useCallback(async (row, text) => {
    await apiClient.post(`${API}/${row.id}/comments`, { text });
    await load();
    setFlash(row.id);
  }, [load]);

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
  const FOCUS_LABEL = { redo: "À reprendre", working: "En cours", lawyer: "Chez le juriste", late: "En retard" };
  const chips = [
    focus && { key: "focus", label: FOCUS_LABEL[focus], clear: () => setFocus("") },
    classification && { key: "classification", label: data?.classifications?.find((item) => item.value === classification)?.shortLabel || classification, clear: () => setClassification("") },
    pole && { key: "pole", label: data?.poleGroups?.[pole] || pole, clear: () => setPole("") },
  ].filter(Boolean);
  const pressFocus = (key) => { setFocus((current) => (current === key ? "" : key)); if (view === "devs" || view === "confirm") setView("follow"); };
  const rankOf = (value) => data?.classifications?.find((item) => item.value === value);

  // Une ligne de mission : la même dans « À suivre » et dans « Toutes ».
  const renderRow = ({ row, follow, depth = 0, children = 0, open = false, dimmed = false, parent = "" }, index) => (
    <tr key={row.id} data-open="true" tabIndex={0} aria-label={`Ouvrir la fiche de ${row.name}`} className={`${openId === row.id ? "is-current" : ""}${flash === row.id ? " is-flash" : ""}`}
      style={{ "--i": Math.min(index, 14), opacity: dimmed ? 0.6 : 1 }} onClick={() => openProcess(row.id)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openProcess(row.id); } }}>
      <td>
        <div className="ab-name" data-depth={depth}>
          {children > 0 ? (
            <button type="button" className="ab-fold" aria-expanded={open} aria-label={open ? `Replier ${row.name}` : `Déplier ${row.name}`}
              onClick={(e) => { e.stopPropagation(); toggle(row.id); }}><ChevronRight size={15} /></button>
          ) : view === "follow" ? null : <span className="ab-rank fst-num">{depth ? "" : row.rank}</span>}
          <div style={{ minWidth: 0 }}>
            <div className="ab-title">{row.name}</div>
            <div className="ab-sub" title={[`${number(row.total)} réalisées depuis le début, dont ${number(row.recent)} ces 90 derniers jours`, row.usage?.detail,
              row.messaging?.total ? `${number(row.messaging.total)} demandées depuis la messagerie (${row.messaging.share} %)` : "", rankOf(row.classification)?.help].filter(Boolean).join(" · ")}>
              {[
                parent ? `Process ${parent}` : row.isParent ? `Process · ${countLabel(row.members, "mission", "missions")}` : null,
                row.pole?.label,
                // « À valider par le juriste » ne dit rien de plus quand l'état de la ligne le dit déjà.
                row.classification === "pending_validation" && ["lawyer", "redo", "working"].includes(follow.group) ? null : rankOf(row.classification)?.shortLabel || "Non classée",
                row.usage ? `${row.usage.label} par le logiciel` : null,
              ].filter(Boolean).join(" · ")}
              {!row.validated && row.toConfirm && (
                <button type="button" className="ab-confirm" title="Classement proposé par le logiciel, que personne n’a encore revu : un clic le confirme."
                  onClick={(e) => { e.stopPropagation(); apply(row, { step: row.step }, "").catch(() => load()); }}>À confirmer</button>
              )}
            </div>
          </div>
          <OpenCue />
        </div>
      </td>
      <td><StateCell row={row} follow={follow} steps={data.steps} onApply={apply} P={P} /></td>
      <td><NewsCell row={row} follow={follow} onReply={reply} /></td>
      <td><PlanCell row={row} follow={follow} people={people} me={me} onApply={apply} /></td>
      <td><GestureCell row={row} follow={follow} onApply={apply} /></td>
    </tr>
  );

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
        <MissionSheet id={data ? openId : null} period={period} frame={data} onClose={closeProcess} onOpen={openProcess} onChanged={load} P={P} people={people} me={me} />
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
                  <Stat label="À reprendre" value={totals.redo} Icon={Wrench} tone={totals.redo ? "amber" : undefined} title="Le juriste a demandé une modification : aux développeurs de reprendre."
                    note={totals.unanswered ? `${countLabel(totals.unanswered, "message du cabinet", "messages du cabinet")} sans réponse` : "modification demandée par le juriste"}
                    onClick={() => pressFocus("redo")} pressed={focus === "redo"} />
                  <Stat label="En cours" value={totals.working} Icon={Hammer} title="Les missions sur lesquelles un développeur a dit qu’il travaille."
                    note="chez les développeurs" onClick={() => pressFocus("working")} pressed={focus === "working"} />
                  <Stat label="Chez le juriste" value={totals.lawyer} Icon={FlaskConical} title="Une version est livrée : le juriste doit la tester."
                    note={totals.lawyerLate ? `dont ${totals.lawyerLate} depuis plus de 7 jours` : "version à tester"} onClick={() => pressFocus("lawyer")} pressed={focus === "lawyer"} />
                  <Stat label="En retard" value={totals.late} Icon={AlarmClock} tone={totals.late ? "red" : undefined} title="La date cible est passée alors que les développeurs sont encore attendus."
                    note="date cible dépassée" onClick={() => pressFocus("late")} pressed={focus === "late"} />
                  <Stat label="Part automatisée" text={`${data.totals.automatedShare} %`} Icon={Gauge} tone="green"
                    note={`${countLabel(data.tiles?.automated?.count ?? 0, "mission automatisée", "missions automatisées")} sur ${number(data.totals.lines)}`} />
                </Stats>

                <Reveal>
                  <Card title="Les missions" Icon={ListChecks} state={{ data, loading, error: "" }}
                    hint="Le suivi se fait ici : l’état, la réponse au cabinet, le responsable et le geste se règlent sur la ligne. Un clic sur la ligne ouvre la fiche à droite.">
                    <div className="fst-tools">
                      <div className="fst-tabs" role="group" aria-label="Ce qui attend quelqu’un">
                        {[["follow", "À suivre", totals.redo + totals.working + totals.lawyer, "Les missions rangées par ce qu’elles attendent : à reprendre, en cours, chez le juriste"],
                          ["all", "Toutes", data.totals.lines, "Toutes les missions, des plus réalisées aux moins réalisées"],
                          ["devs", "Suivi des développeurs", data.totals.working ?? 0, "Ce sur quoi les développeurs travaillent, ce qui attend le juriste, ce qu’on leur a demandé de reprendre"],
                          ["confirm", "À confirmer", data.totals.toConfirm, "Classement proposé par le logiciel, que personne n’a encore revu"]].map(([value, label, count, title]) => (
                          <button key={label} type="button" className="fst-tab" aria-pressed={view === value} title={title} onClick={() => setView(value)}>
                            {view === value && <Motion.span layoutId="ab-confirm-tab" className="fst-tab-bg" transition={SPRING} />}
                            <span>{label}</span><span className="fst-tab-count fst-num">{number(count)}</span>
                          </button>
                        ))}
                      </div>
                      <select className="fst-select" value={pole} onChange={(e) => setPole(e.target.value)} aria-label="Pôle">
                        <option value="">Tous les pôles</option>
                        {Object.entries(data.poleGroups || {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <select className="fst-select" value={classification} onChange={(e) => setClassification(e.target.value)} aria-label="Classement">
                        <option value="">Tous les classements</option>
                        {data.classifications.map((item) => <option key={item.value} value={item.value}>{item.shortLabel} · {data.tiles?.[item.value]?.count ?? 0}</option>)}
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

                    {view === "devs" ? <DevBoard rows={data.rows} onOpen={openProcess} onAct={act} /> : (view === "follow" ? groups.length === 0 : lines.length === 0) ? (
                      <Empty boxed>{filtering ? "Aucune mission ne correspond à ces filtres." : view === "confirm" ? "Tous les classements ont été revus." : "Aucune mission à suivre."}{filtering && <> <button type="button" className="ab-textlink" onClick={reset}>Tout afficher</button></>}</Empty>
                    ) : (
                      <TableBox minWidth={1040}>
                        <thead>
                          <tr>
                            <Th Icon={ListChecks}>Mission</Th>
                            <Th Icon={Milestone}><Hint text={COLUMN_HINTS.state}>Où ça en est</Hint></Th>
                            <Th Icon={MessageSquareQuote}><Hint text={COLUMN_HINTS.news}>Dernière nouvelle</Hint></Th>
                            <Th Icon={UserRound}><Hint text={COLUMN_HINTS.plan}>Responsable</Hint></Th>
                            <Th Icon={MousePointerClick}><Hint text={COLUMN_HINTS.gesture} align="end">Geste</Hint></Th>
                          </tr>
                        </thead>
                        {view === "follow" ? groups.map((group) => (
                          <tbody key={`${group.key}-${period}-${classification}-${pole}-${focus}-${query}`} className="ab-group-body">
                            <tr className="ab-group" data-tone={group.tone}>
                              <td colSpan={5}>
                                <button type="button" className="ab-group-btn" aria-expanded={group.open} title={group.hint}
                                  onClick={() => setFolds((current) => ({ ...current, [group.key]: !group.open }))}>
                                  <ChevronRight size={15} className="ab-group-chev" />
                                  <span className="ab-group-title">{group.title}</span>
                                  <span className="ab-group-count fst-num">{number(group.items.length)}</span>
                                  <span className="ab-group-hint">{group.hint}</span>
                                </button>
                              </td>
                            </tr>
                            {group.open && group.items.map((item, index) => renderRow(item, index))}
                          </tbody>
                        )) : (
                          <tbody key={`${period}-${classification}-${pole}-${view}-${focus}-${query}`}>
                            {lines.map((line, index) => renderRow({ ...line, follow: follows.get(line.row.id) || rowFollow(line.row, data.steps) }, index))}
                          </tbody>
                        )}
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
