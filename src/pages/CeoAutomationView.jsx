// src/pages/CeoAutomationView.jsx
//
// « Automatisation des missions » dans le dashboard (section Produit, sous le board Owner/Opti'Lex) :
// le suivi des process d'Opti'Lex, lu en direct dans le logiciel. Même gabarit que les autres pages du
// dashboard (menu de gauche filtré par rôle). On peut y poser une note et régler le classement et l'étape
// d'un process ; les documents et la validation par la direction du cabinet restent dans Opti'Lex.
// Accès : CEO et admin (onglet + route + API).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { PERIODS, countLabel, visibleRows } from "../utils/automationBoard";
import { Bar, ExternalIcon, Pill, Steps, Usage } from "../components/automationBoard/parts";
import { number, palette, tone } from "../components/automationBoard/theme";
import ProcessPanel from "../components/automationBoard/ProcessPanel";

const ALLOWED_ROLES = new Set(["admin", "ceo"]);
const TAB_ID = "optilex_automation";
const API = "/api/v1/optilex/automation-board";
const GRID = "34px minmax(220px, 2.2fr) 150px 190px 104px 168px 150px";

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
        .ab-link { background: none; border: none; padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .ab-link:hover { text-decoration: underline; }
        .ab-icon { background: none; border: none; padding: 6px; border-radius: 8px; cursor: pointer; display: inline-flex; }
        .ab-icon:hover, .ab-row:hover { background: ${darkMode ? "rgba(255,255,255,0.05)" : "#f5f6f8"}; }
        .ab-line { cursor: pointer; transition: background 0.1s ease; }
        .ab-line:hover { background: ${darkMode ? "rgba(255,255,255,0.035)" : "#f8f9fb"}; }
        .ab-tile { transition: border-color 0.12s ease, background 0.12s ease; }
        .ab-page :focus-visible, .ab-panel :focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        .ab-panel { animation: ab-in 0.18s ease-out; }
        @keyframes ab-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .ab-panel { animation: none; } }
        @media (max-width: 1180px) { .ab-table { overflow-x: auto; } .ab-table > div { min-width: 1040px; } }
      `}</style>

      <div style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", display: "flex" }}>
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

      <div className="ab-page" style={{ flex: 1, minWidth: 0, position: "relative", padding: "28px 36px 64px", color: P.text }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 650, letterSpacing: "0.08em", color: P.faint }}>PRODUIT · OPTI&apos;LEX</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 680, letterSpacing: "-0.02em" }}>Automatisation des missions</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {data && <span style={{ fontSize: 12.5, color: P.faint }}>{loading ? "Mise à jour…" : `Relevé à ${data.at}`}</span>}
            <button type="button" onClick={load} disabled={loading} style={{
              padding: "7px 12px", borderRadius: 8, border: `1px solid ${P.line}`, background: P.card, color: P.text,
              fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "default" : "pointer",
            }}>Actualiser</button>
            {data?.url && (
              <a href={data.url} target="_blank" rel="noopener noreferrer" style={{
                padding: "7px 12px", borderRadius: 8, background: P.accent, color: "#fff", fontSize: 13, fontWeight: 600,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
              }}>Ouvrir dans Opti&apos;Lex <ExternalIcon /></a>
            )}
          </div>
        </header>

        {error && data && (
          <p role="status" style={{ margin: "18px 0 0", padding: "10px 12px", borderRadius: 8, background: P.soft, color: P.warn, fontSize: 13 }}>
            Opti&apos;Lex ne répond pas pour l&apos;instant : les chiffres affichés sont ceux de {data.at}.
          </p>
        )}
        {data?.stale && !error && (
          <p role="status" style={{ margin: "18px 0 0", padding: "10px 12px", borderRadius: 8, background: P.soft, color: P.warn, fontSize: 13 }}>
            Opti&apos;Lex ne répond pas pour l&apos;instant : les chiffres affichés sont les derniers reçus ({data.at}).
          </p>
        )}

        {!data && (
          <div style={{ marginTop: 56, textAlign: "center", color: P.faint, fontSize: 14 }}>
            {error ? (
              <>
                <p role="alert" style={{ margin: "0 0 14px", color: P.text, fontWeight: 600 }}>{error}</p>
                <button type="button" onClick={load} style={{
                  padding: "8px 14px", borderRadius: 8, border: "none", background: P.accent, color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                }}>Réessayer</button>
              </>
            ) : "Lecture du board dans Opti'Lex…"}
          </div>
        )}

        {data && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "minmax(250px, 1.1fr) repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 24 }}>
              <div style={{ padding: "16px 18px", borderRadius: 12, border: `1px solid ${P.line}`, background: P.card }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 34, fontWeight: 680, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{data.totals.automatedShare} %</span>
                </div>
                <div style={{ fontSize: 13, color: P.faint, lineHeight: 1.45, marginTop: 2 }}>des missions classées passent par un process automatisé</div>
                <div style={{ marginTop: 10 }}><Bar value={data.totals.automatedShare} color={P.good} P={P} height={6} /></div>
              </div>
              {data.classifications.map((item) => {
                const t = tone(item.value, darkMode);
                const tile = data.tiles?.[item.value] || { count: 0, volume: 0 };
                const active = classification === item.value;
                return (
                  <button key={item.value} type="button" className="ab-tile" aria-pressed={active} title={item.help || undefined}
                    onClick={() => setClassification(active ? "" : item.value)} style={{
                      textAlign: "left", padding: "16px 18px", borderRadius: 12, fontFamily: "inherit", cursor: "pointer", color: P.text,
                      border: `1px solid ${active ? t.fg : P.line}`, background: active ? t.bg : P.card,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: t.fg }}>
                      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: t.fg }} />{item.shortLabel}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 680, letterSpacing: "-0.02em", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{number(tile.count)}</div>
                    <div style={{ fontSize: 12, color: P.faint, marginTop: 2 }}>{countLabel(tile.volume, "mission", "missions")}</div>
                  </button>
                );
              })}
            </section>

            <p style={{ margin: "14px 2px 0", fontSize: 12.5, color: P.faint, lineHeight: 1.6 }}>
              {countLabel(data.totals.lines, "ligne", "lignes")} · {countLabel(data.totals.missions, "mission réalisée", "missions réalisées")}
              {" · "}{countLabel(data.totals.toConfirm, "classement à confirmer", "classements à confirmer")}
              {" · "}{countLabel(data.totals.validated, "process validé par la direction", "process validés par la direction")}
              {" · "}{countLabel(data.messaging.total, "demande venue de la messagerie client", "demandes venues de la messagerie client")}
              {data.totals.uncategorized > 0 && ` · ${countLabel(data.totals.uncategorized, "mission sans type reconnu, non comptée", "missions sans type reconnu, non comptées")}`}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
              <div role="group" aria-label="Période de l'utilisation du logiciel" style={{ display: "inline-flex", padding: 3, borderRadius: 9, background: P.soft, border: `1px solid ${P.line}` }}>
                {PERIODS.map((value) => {
                  const active = period === value;
                  return (
                    <button key={value ?? 0} type="button" aria-pressed={active} onClick={() => setPeriod(value)} style={{
                      padding: "5px 11px", borderRadius: 6, border: "none", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                      background: active ? P.card : "transparent", color: active ? P.text : P.faint, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}>{value ? `${value} jours` : "Depuis la mise en place"}</button>
                  );
                })}
              </div>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher une mission" aria-label="Chercher une mission" style={{
                flex: "1 1 200px", maxWidth: 300, padding: "7px 11px", borderRadius: 8, border: `1px solid ${P.line}`, background: P.card, color: P.text, fontSize: 13, fontFamily: "inherit", outline: "none",
              }} />
              <select value={pole} onChange={(e) => setPole(e.target.value)} aria-label="Pôle" style={{
                padding: "7px 10px", borderRadius: 8, border: `1px solid ${P.line}`, background: P.card, color: P.text, fontSize: 13, fontFamily: "inherit",
              }}>
                <option value="">Tous les pôles</option>
                {Object.entries(data.poleGroups || {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: P.text, cursor: "pointer" }}>
                <input type="checkbox" checked={toConfirm} onChange={(e) => setToConfirm(e.target.checked)} style={{ accentColor: P.accent }} />
                À confirmer seulement
              </label>
              {filtering && <button type="button" className="ab-link" onClick={reset} style={{ color: P.accent }}>Tout afficher</button>}
            </div>

            <div className="ab-table" style={{ marginTop: 14, border: `1px solid ${P.line}`, borderRadius: 12, background: P.card }}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 16, padding: "10px 18px", borderBottom: `1px solid ${P.line}`, fontSize: 11, fontWeight: 650, letterSpacing: "0.05em", textTransform: "uppercase", color: P.faint }}>
                  <span />
                  <span>Mission</span>
                  <span>Missions réalisées</span>
                  <span>Utilisation du logiciel</span>
                  <span>Messagerie</span>
                  <span>Classement</span>
                  <span>Avancement</span>
                </div>
                {lines.length === 0 && (
                  <p style={{ margin: 0, padding: "28px 18px", fontSize: 13, color: P.faint, textAlign: "center" }}>Aucune mission ne correspond à ces filtres.</p>
                )}
                {lines.map(({ row, depth, children, open, dimmed }, index) => (
                  <div key={row.id} className="ab-line" role="button" tabIndex={0} aria-label={`Ouvrir la fiche de ${row.name}`}
                    onClick={() => openProcess(row.id)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openProcess(row.id); } }}
                    style={{
                      display: "grid", gridTemplateColumns: GRID, gap: 16, alignItems: "center", padding: depth ? "10px 18px" : "13px 18px",
                      borderTop: index ? `1px solid ${P.line}` : "none", background: depth ? P.soft : undefined, opacity: dimmed ? 0.6 : 1,
                    }}>
                    {children > 0 ? (
                      <button type="button" className="ab-icon" aria-expanded={open} aria-label={open ? `Replier ${row.name}` : `Déplier ${row.name}`}
                        onClick={(e) => { e.stopPropagation(); toggle(row.id); }} style={{ color: P.faint, justifySelf: "start", marginLeft: -6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.12s" }}><path d="m9 6 6 6-6 6" /></svg>
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: P.faint, fontVariantNumeric: "tabular-nums" }}>{depth ? "" : row.rank}</span>
                    )}
                    <div style={{ minWidth: 0, paddingLeft: depth ? 14 : 0 }}>
                      <div style={{ fontSize: depth ? 13 : 14, fontWeight: depth ? 550 : 620, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
                      <div style={{ fontSize: 12, color: P.faint, marginTop: 2 }}>
                        {[
                          row.isParent ? `Process · ${countLabel(row.members, "mission", "missions")}` : null,
                          row.pole?.label,
                          row.comments ? countLabel(row.comments, "note", "notes") : null,
                          row.files ? countLabel(row.files, "document", "documents") : null,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                        <span style={{ fontSize: 14, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{number(row.total)}</span>
                        <span style={{ fontSize: 12, color: P.faint, fontVariantNumeric: "tabular-nums" }}>{number(row.recent)} sur 90 j</span>
                      </div>
                      <div style={{ marginTop: 5 }}><Bar value={row.bar} color={P.faint} P={P} /></div>
                    </div>
                    <Usage usage={row.usage} P={P} />
                    <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {row.messaging?.total ? (
                        <><span style={{ fontWeight: 650 }}>{number(row.messaging.total)}</span><span style={{ color: P.faint, fontSize: 12 }}> · {row.messaging.share} %</span></>
                      ) : <span style={{ color: P.faint }}>-</span>}
                    </div>
                    <div>
                      <Pill classification={row.classification} classifications={data.classifications} dark={darkMode} />
                      {row.validated && <div style={{ fontSize: 11.5, fontWeight: 600, color: P.good, marginTop: 4 }}>Validé par la direction</div>}
                      {!row.validated && row.toConfirm && <div style={{ fontSize: 11.5, color: P.warn, marginTop: 4 }}>À confirmer</div>}
                    </div>
                    <Steps value={row.step} steps={data.steps} P={P} showLabel={false} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {openId && data && (
          <ProcessPanel id={openId} period={period} frame={data} onClose={closeProcess} onOpen={openProcess} onChanged={load} P={P} dark={darkMode} />
        )}
      </div>
    </div>
  );
}
