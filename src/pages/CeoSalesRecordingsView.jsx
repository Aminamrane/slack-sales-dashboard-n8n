// src/pages/CeoSalesRecordingsView.jsx
//
// Route /ceo/sales-recordings — page "Enregistrement sales" (niveau Acquisition).
// Tableau des sales par équipe avec nb vidéos + nb transcriptions (scan Drive via
// le service account recordings-fetcher). Shell CEO standard (sidebar + navbar),
// strictement aligné sur CeoSalesTeamView.
// Refonte du 19/11/2026 : l'affichage vit dans components/recordings/ (même langage visuel que la page Équipe) ; ici restent les données, l'accès et la barre latérale.
//
// Auth gate : admin | ceo | acquisition_director | head_of_sales_manager | head_of_sales.

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import { monthRange } from "../utils/callsPeriod.js";
import { Frame, Empty, Skeleton } from "../components/recordings/parts.jsx";
import RecordingsBoard from "../components/recordings/RecordingsBoard.jsx";
import { captainKeys, fmtPeriod } from "../components/recordings/recordingsData.js";
import { READ_ONLY_DIRECTION_ROLES } from "../utils/readOnlyRoles";

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_acquisition", "head_of_sales_manager", "head_of_sales", ...READ_ONLY_DIRECTION_ROLES]);

// La fiche d'un sales et le rapport direction ne se chargent qu'à leur ouverture (la liste s'affiche sans eux).
const RecordingsDetail = lazy(() => import("../components/recordings/RecordingsDetail.jsx"));
const TeamReportView = lazy(() => import("../components/TeamReportView.jsx"));

// `embed` : rendu SANS le shell CEO (sidebar + navbar + fond de page), pour être
// inséré tel quel dans un onglet de la tracking sheet, exactement comme
// LeadAssignmentLive l'est pour l'auto-affectation.
export default function CeoSalesRecordingsView({ embed = false }) {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync) ──────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => { if (e.key === "darkMode") setDarkMode(e.newValue === "true"); };
    // La classe `dark-mode` du body est posée par le bouton de thème de la barre latérale : on la suit à chaque changement (plus de sondage toutes les 500 ms) et une fois à l'ouverture.
    const sync = () => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((prev) => (prev !== isDark ? isDark : prev));
    };
    window.addEventListener("storage", onStorage);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => { window.removeEventListener("storage", onStorage); observer.disconnect(); };
  }, []);

  // ── SIDEBAR COLLAPSE ────────────────────────────────────────────────
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    const stored = localStorage.getItem("ceoSideCollapsed_v2");
    return stored === null ? true : stored === "true";
  });
  useEffect(() => { localStorage.setItem("ceoSideCollapsed_v2", String(sideCollapsed)); }, [sideCollapsed]);

  // ── AUTH GATE ───────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    const u = apiClient.getUser();
    // En embed, le parent (onglet de la tracking sheet) a déjà filtré le rôle :
    // on ne redirige pas, sinon un rôle non autorisé serait éjecté de sa sheet.
    if (!u || !ALLOWED_ROLES.has(u.role)) { if (!embed) navigate("/"); return; }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate, embed]);

  // ── FETCH OVERVIEW (scan Drive, cache 30 min côté backend) ──────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false); // scan Drive (vidéos) en arrière-plan
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedTab, setSelectedTab] = useState("analyses");
  const [avatars, setAvatars] = useState({});
  // Appels Allo du mois en cours, par sales (périmètre du serveur). Indisponible = tuiles à « — ».
  const [calls, setCalls] = useState({ byEmail: {}, total: null, loading: true });
  useEffect(() => {
    let live = true;
    const { start, end } = monthRange();
    apiClient.get(`/api/v1/sales-calls/overview?start=${start}&end=${end}`)
      .then((d) => { if (!live) return; const byEmail = {}; (d?.sales || []).forEach((s) => { byEmail[(s.email || "").toLowerCase()] = s; }); setCalls({ byEmail, total: d?.total_calls ?? null, loading: false }); })
      .catch(() => { if (live) setCalls({ byEmail: {}, total: null, loading: false }); });
    return () => { live = false; };
  }, []);

  // Capitaines d'équipe (étoile, en tête de leur équipe). Lecture facultative : si elle échoue, l'ordre et l'affichage restent ceux d'avant.
  const [captains, setCaptains] = useState(null);
  useEffect(() => {
    let live = true;
    apiClient.getTeams().then((t) => { if (live) setCaptains(captainKeys(t)); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // ── ANALYSES HEBDO : rapport direction + sélecteur de semaine ────────
  const [pageTab, setPageTab] = useState("equipes"); // 'equipes' (défaut) | 'direction'
  const [periods, setPeriods] = useState([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [teamReport, setTeamReport] = useState(undefined); // undefined = en cours de lecture, null = pas de rapport
  const [allScorecards, setAllScorecards] = useState([]);
  const [scLoaded, setScLoaded] = useState(false);
  // Le rapport direction et ses classements ne sont lus que si l'onglet est ouvert, ou survolé / pris au clavier juste avant.
  const [wantDirection, setWantDirection] = useState(false);
  const needDirection = pageTab === "direction" || wantDirection;

  const load = (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    return apiClient.getRecordingsOverview(refresh)
      .then((resp) => { setData(resp); setVideosLoading(!!resp.refreshing); })
      .catch((e) => { console.warn("[CeoSalesRecordingsView] overview failed:", e); setError(e?.message || "erreur"); setVideosLoading(false); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  };
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    setLoading(true); setError(null); setVideosLoading(true);
    // 1) LIGHT : structure + analyses (DB, immédiat) -> la grille s'affiche tout de suite.
    apiClient.getRecordingsOverview(false, true)
      .then((resp) => { if (alive) setData((prev) => (prev && !prev.light ? prev : resp)); }) // ne pas écraser un complet déjà arrivé
      .catch((e) => { if (alive && !data) { console.warn("[CeoSalesRecordingsView] light overview failed:", e); } })
      .finally(() => { if (alive) setLoading(false); });
    // 2) COMPLET : scan Drive (vidéos + transcriptions) en arrière-plan -> complète les compteurs.
    apiClient.getRecordingsOverview(false)
      .then((resp) => { if (alive) { setData(resp); setVideosLoading(!!resp.refreshing); } })
      .catch((e) => { if (alive) { console.warn("[CeoSalesRecordingsView] full overview failed:", e); setError("Les fichiers n’ont pas pu être actualisés."); setVideosLoading(false); } });
    return () => { alive = false; };
  }, [authChecked]);

  // During a refresh, read the shared index only; polling never starts a new Drive scan.
  useEffect(() => {
    if (!authChecked || !data?.refreshing) return;
    let alive = true;
    const timer = setTimeout(() => {
      apiClient.getRecordingsOverview(false)
        .then((resp) => { if (alive) { setData(resp); setVideosLoading(!!resp.refreshing); if (resp.sync_error) setError("Les fichiers n’ont pas tous pu être actualisés."); } })
        .catch(() => { if (alive) { setVideosLoading(false); setError("L’actualisation a été interrompue. Vous pouvez réessayer."); } });
    }, 2000);
    return () => { alive = false; clearTimeout(timer); };
  }, [authChecked, data]);

  // Photos de profil (map email -> avatar_url) via /assignable, comme la page Équipe.
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    apiClient.getAssignableUsers()
      .then((resp) => {
        if (!alive) return;
        const list = Array.isArray(resp) ? resp : (resp?.users || resp?.data || []);
        const m = {};
        for (const u of list) if (u?.email) m[u.email.toLowerCase()] = u.avatar_url || null;
        setAvatars(m);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [authChecked]);

  // Semaines disponibles (historique). La plus récente = sélectionnée par défaut.
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    apiClient.getAnalysisPeriods("team_weekly")
      .then((resp) => {
        if (!alive) return;
        const list = resp?.periods || [];
        setPeriods(list);
        setSelectedPeriod((prev) => prev || list[0] || null);
      })
      .catch(() => {})
      .finally(() => { if (alive) setPeriodsLoaded(true); });
    return () => { alive = false; };
  }, [authChecked]);

  // Rapport direction de la semaine sélectionnée.
  useEffect(() => {
    if (!needDirection || !periodsLoaded) return undefined;
    if (!selectedPeriod) { setTeamReport(null); return undefined; }
    let alive = true;
    setTeamReport(undefined);
    apiClient.getRecordingAnalysis("TEAM", "team_weekly", selectedPeriod)
      .then((r) => { if (alive) setTeamReport(r?.payload || null); })
      .catch(() => { if (alive) setTeamReport(null); });
    return () => { alive = false; };
  }, [needDirection, periodsLoaded, selectedPeriod]);

  // Toutes les scorecards (agrégées pour le classement du rapport direction).
  useEffect(() => {
    if (!authChecked || !needDirection || scLoaded) return undefined;
    let alive = true;
    apiClient.getScorecards()
      .then((r) => { if (alive) setAllScorecards(r?.scorecards || []); })
      .catch(() => {})
      .finally(() => { if (alive) setScLoaded(true); });
    return () => { alive = false; };
  }, [authChecked, needDirection, scLoaded]);

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

  // Agrégat par sales, SÉPARÉ closing (R2) / pré-audit (R1) : on ne classe pas
  // tout le monde sur un chiffre unique (Yohan sans R2 finissait 7e à tort).
  // rdv_type reflète le type FONCTIONNEL après re-score (close-au-R1 -> R2).
  const teamStats = useMemo(() => {
    const nameByEmail = {};
    for (const s of (data?.sales || [])) if (s.email) nameByEmail[s.email.toLowerCase()] = s.name;
    const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const acc = {};
    for (const sc of allScorecards) {
      const em = (sc.owner_email || "").toLowerCase();
      if (!em) continue;
      const a = acc[em] || (acc[em] = { email: em, r1: [], r2: [] });
      if (typeof sc.score === "number") {
        if (sc.rdv_type === "R2") a.r2.push(sc.score); else a.r1.push(sc.score);
      }
    }
    return Object.values(acc).map((a) => ({
      email: a.email,
      name: nameByEmail[a.email] || a.email.split("@")[0],
      avatar: avatars[a.email] || null,
      nb_r1: a.r1.length,
      nb_r2: a.r2.length,
      avg_r1: mean(a.r1),
      avg_r2: mean(a.r2),
    }));
  }, [allScorecards, data, avatars]);

  // ── SIDEBAR NAVIGATION HANDLER ──────────────────────────────────────
  const handleSidebarTabClick = (tabId) => {
    if (tabId === "sales_recordings") return;
    if (tabId === "sales_team") { navigate("/ceo/sales-team"); return; }
    if (tabId === "sequences") { navigate("/ceo/sequences"); return; }
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
    if (tabId === "optilex_board") { navigate("/ceo/optilex-board"); return; }
    if (tabId === "leads_management") { navigate("/ceo/leads-management"); return; }
    navigateBackToDashboard(navigate, userRole, tabId);
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: embed ? 220 : "100vh", background: embed ? "transparent" : C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="ceo-page" style={embed
      ? { minWidth: 0, background: "transparent", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", textRendering: "optimizeLegibility" }
      : { display: "flex", minHeight: "100vh", background: darkMode ? "#13141b" : "#f6f7f9", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", textRendering: "optimizeLegibility" }}>
      <style>{`
        @keyframes ceoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
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

      {!embed && (
        <div style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", display: "flex" }}>
          <Sidebar
            width={sideCollapsed ? 56 : 260}
            collapsed={sideCollapsed}
            onToggle={() => setSideCollapsed((v) => !v)}
            sections={visibleSections}
            activeTab="sales_recordings"
            setActiveTab={handleSidebarTabClick}
            C={C}
            darkMode={darkMode}
          setDarkMode={setDarkMode}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: embed ? 0 : 16 }}>
        <Frame darkMode={darkMode} embed={embed}>
          {selectedEmail ? (
            <Suspense fallback={<Skeleton kind="block" />}>
              <RecordingsDetail
                sales={{
                  ...((data?.sales || []).find((s) => s.email === selectedEmail) || { name: selectedEmail, email: selectedEmail, recordings: [] }),
                  avatar_url: avatars[selectedEmail.toLowerCase()],
                  period: selectedPeriod,
                  nb_calls: calls.byEmail[selectedEmail.toLowerCase()]?.calls ?? undefined,
                  allo_linked: calls.loading ? undefined : !!calls.byEmail[selectedEmail.toLowerCase()]?.allo_user_id,
                }}
                initialTab={selectedTab}
                loadingFiles={videosLoading || refreshing}
                onBack={() => setSelectedEmail(null)}
                C={C}
                darkMode={darkMode}
              />
            </Suspense>
          ) : (
            <>
              <div className="rc-head">
                <h1><span>Enregistrements sales</span></h1>
                {/* Onglets de page : Équipes (défaut) | Rapport direction */}
                <div className="rc-tabs" role="group" aria-label="Vue de la page" onPointerEnter={() => setWantDirection(true)} onFocus={() => setWantDirection(true)} onTouchStart={() => setWantDirection(true)}>
                  <button type="button" className="rc-tab is-blue" aria-pressed={pageTab === "equipes"} onClick={() => setPageTab("equipes")}>Équipes</button>
                  <button type="button" className="rc-tab is-green" aria-pressed={pageTab === "direction"} onClick={() => setPageTab("direction")}>Rapport direction</button>
                </div>
              </div>

              {/* ÉQUIPES (défaut) */}
              {pageTab === "equipes" && (
                <RecordingsBoard
                  data={data}
                  loading={loading}
                  videosLoading={videosLoading}
                  error={error}
                  onRefresh={() => load(true)}
                  refreshing={refreshing}
                  onSelectSales={(email, tab) => { setSelectedTab(tab || "analyses"); setSelectedEmail(email); }}
                  avatars={avatars}
                  calls={calls}
                  captains={captains}
                />
              )}

              {/* RAPPORT DIRECTION — onglet à part, semaine sélectionnable */}
              {pageTab === "direction" && (
                <>
                  {/* Le dossier porte son propre titre (masthead) : ici on ne garde que le sélecteur de semaine. */}
                  {periods.length > 0 && (
                    <div className="rc-weekbar">
                      <label htmlFor="rc-week">Semaine</label>
                      <select id="rc-week" className="rc-select" value={selectedPeriod || ""} onChange={(e) => setSelectedPeriod(e.target.value)}>
                        {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                      </select>
                    </div>
                  )}
                  {!(scLoaded && periodsLoaded && teamReport !== undefined) ? (
                    <Skeleton kind="block" />
                  ) : teamReport ? (
                    <div className="rc-doc">
                      <Suspense fallback={<Skeleton kind="block" />}>
                        <TeamReportView report={teamReport} stats={teamStats} period={selectedPeriod} C={C} darkMode={darkMode} />
                      </Suspense>
                    </div>
                  ) : (
                    <Empty>Pas encore de rapport direction pour cette semaine. Il sera généré au prochain passage d'analyse.</Empty>
                  )}
                </>
              )}
            </>
          )}
        </Frame>
      </div>
    </div>
  );
}
