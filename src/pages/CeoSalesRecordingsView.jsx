// src/pages/CeoSalesRecordingsView.jsx
//
// Route /ceo/sales-recordings — page "Enregistrement sales" (niveau Acquisition).
// Tableau des sales par équipe avec nb vidéos + nb transcriptions (scan Drive via
// le service account recordings-fetcher). Shell CEO standard (sidebar + navbar),
// strictement aligné sur CeoSalesTeamView.
//
// Auth gate : admin | ceo | acquisition_director | head_of_sales_manager.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { navigateBackToDashboard } from "../utils/dashboardNavigation";
import { SIDEBAR_SECTIONS, getColors } from "./CeoDashboard.jsx";
import Sidebar from "../components/shared/Sidebar";
import { getVisibleSections } from "../utils/sidebarPermissions";
import SharedNavbar from "../components/SharedNavbar.jsx";
import SalesRecordingsGrid from "../components/SalesRecordingsGrid.jsx";
import SalesRecordingsDetail from "../components/SalesRecordingsDetail.jsx";
import TeamReportView from "../components/TeamReportView.jsx";

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_acquisition", "head_of_sales_manager"]);

// Sales dont la transcription Meet est coupée -> analysés depuis Whisper (basse
// fidélité) : à signaler dans le classement pour ne pas sur-interpréter le score.
const WHISPER_SALES = new Set(["y.debowski@ownertechnology.com", "y.zairi@ownertechnology.com"]);

// "2026-W31" -> "Semaine 31 · 2026"
const fmtPeriod = (p) => {
  if (!p) return "";
  const m = /^(\d{4})-W(\d{1,2})$/.exec(p);
  return m ? `Semaine ${parseInt(m[2], 10)} · ${m[1]}` : p;
};

export default function CeoSalesRecordingsView() {
  const navigate = useNavigate();

  // ── DARK MODE (read-only sync) ──────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const onStorage = (e) => { if (e.key === "darkMode") setDarkMode(e.newValue === "true"); };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((prev) => (prev !== isDark ? isDark : prev));
    }, 500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(interval); };
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
    if (!u || !ALLOWED_ROLES.has(u.role)) { navigate("/"); return; }
    setUserRole(u.role);
    setAuthChecked(true);
  }, [navigate]);

  // ── FETCH OVERVIEW (scan Drive, cache 30 min côté backend) ──────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false); // scan Drive (vidéos) en arrière-plan
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [avatars, setAvatars] = useState({});

  // ── ANALYSES HEBDO : rapport direction + sélecteur de semaine ────────
  const [pageTab, setPageTab] = useState("equipes"); // 'equipes' (défaut) | 'direction'
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [teamReport, setTeamReport] = useState(null);
  const [allScorecards, setAllScorecards] = useState([]);

  const load = (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    return apiClient.getRecordingsOverview(refresh)
      .then((resp) => setData(resp))
      .catch((e) => { console.warn("[CeoSalesRecordingsView] overview failed:", e); setError(e?.message || "erreur"); })
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
      .then((resp) => { if (alive) setData(resp); })
      .catch((e) => { if (alive) { console.warn("[CeoSalesRecordingsView] full overview failed:", e); } })
      .finally(() => { if (alive) setVideosLoading(false); });
    return () => { alive = false; };
  }, [authChecked]);

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
      .catch(() => {});
    return () => { alive = false; };
  }, [authChecked]);

  // Rapport direction de la semaine sélectionnée.
  useEffect(() => {
    if (!selectedPeriod) { setTeamReport(null); return; }
    let alive = true;
    apiClient.getRecordingAnalysis("TEAM", "team_weekly", selectedPeriod)
      .then((r) => { if (alive) setTeamReport(r?.payload || null); })
      .catch(() => { if (alive) setTeamReport(null); });
    return () => { alive = false; };
  }, [selectedPeriod]);

  // Toutes les scorecards (agrégées pour le classement du rapport direction).
  useEffect(() => {
    if (!authChecked) return;
    let alive = true;
    apiClient.getScorecards()
      .then((r) => { if (alive) setAllScorecards(r?.scorecards || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [authChecked]);

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
      whisper: WHISPER_SALES.has(a.email), // transcription Meet coupée -> Whisper (basse fidélité)
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
      <div style={{ minHeight: "100vh", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="ceo-page" style={{ display: "flex", minHeight: "100vh", background: darkMode ? "#13141b" : "#f6f7f9", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", textRendering: "optimizeLegibility" }}>
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
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative", paddingTop: 64 }}>
        <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <div style={{ padding: "32px 56px 64px" }}>
          <div style={{ animation: "ceoFadeIn 0.35s ease both" }}>
            {selectedEmail ? (
              <SalesRecordingsDetail
                sales={{
                  ...((data?.sales || []).find((s) => s.email === selectedEmail) || { name: selectedEmail, email: selectedEmail, recordings: [] }),
                  avatar_url: avatars[selectedEmail.toLowerCase()],
                  period: selectedPeriod,
                }}
                onBack={() => setSelectedEmail(null)}
                C={C}
                darkMode={darkMode}
              />
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                    Enregistrement sales
                  </h1>
                  <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                    Les équipes et leurs analyses. Ouvrez « Rapport direction » pour la vue de pilotage tous-sales.
                  </p>
                </div>

                {/* Onglets de page : Équipes (défaut) | Rapport direction */}
                <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
                  {[{ key: "equipes", label: "Équipes" }, { key: "direction", label: "Rapport direction" }].map((t) => {
                    const active = pageTab === t.key;
                    return (
                      <button key={t.key} onClick={() => setPageTab(t.key)} style={{
                        padding: "9px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 14, fontWeight: active ? 700 : 500, color: active ? C.text : C.muted,
                        borderBottom: `2px solid ${active ? "#3b82f6" : "transparent"}`, marginBottom: -1,
                      }}>{t.label}</button>
                    );
                  })}
                </div>

                {/* ÉQUIPES (défaut) */}
                {pageTab === "equipes" && (
                  <SalesRecordingsGrid
                    data={data}
                    loading={loading}
                    videosLoading={videosLoading}
                    error={error}
                    onRefresh={() => load(true)}
                    refreshing={refreshing}
                    onSelectSales={setSelectedEmail}
                    avatars={avatars}
                    C={C}
                    darkMode={darkMode}
                  />
                )}

                {/* RAPPORT DIRECTION — onglet à part, semaine sélectionnable */}
                {pageTab === "direction" && (
                  <div>
                    {/* Le dossier porte son propre titre (masthead) : ici on ne garde que
                        le sélecteur de semaine, aligné à droite. */}
                    {periods.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginLeft: "auto" }}>Semaine</span>
                        <select
                          value={selectedPeriod || ""}
                          onChange={(e) => setSelectedPeriod(e.target.value)}
                          style={{ fontSize: 12.5, fontWeight: 600, color: C.text, background: darkMode ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                        </select>
                      </div>
                    )}
                    {teamReport ? (
                      <TeamReportView report={teamReport} stats={teamStats} period={selectedPeriod} C={C} darkMode={darkMode} />
                    ) : (
                      <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: 36, textAlign: "center", color: C.muted, fontSize: 14 }}>
                        Pas encore de rapport direction pour cette semaine. Il sera généré au prochain passage d'analyse.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
