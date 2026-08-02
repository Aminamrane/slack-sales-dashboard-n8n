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

const ALLOWED_ROLES = new Set(["admin", "ceo", "acquisition_director", "head_of_sales_manager"]);

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [avatars, setAvatars] = useState({});

  // ── ANALYSES HEBDO : rapport direction + sélecteur de semaine ────────
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [teamReport, setTeamReport] = useState(null);
  const [teamOpen, setTeamOpen] = useState(true);

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
    setLoading(true); setError(null);
    apiClient.getRecordingsOverview(false)
      .then((resp) => { if (alive) setData(resp); })
      .catch((e) => { if (alive) { console.warn("[CeoSalesRecordingsView] overview failed:", e); setError(e?.message || "erreur"); } })
      .finally(() => { if (alive) setLoading(false); });
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

  const C = useMemo(() => getColors(darkMode), [darkMode]);
  const visibleSections = useMemo(() => getVisibleSections(SIDEBAR_SECTIONS, userRole), [userRole]);

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
    if (tabId === "lead_quality") { navigate("/ceo/lead-quality"); return; }
    if (tabId === "webinar") { navigate("/ceo/webinar"); return; }
    if (tabId === "campaigns") { navigate("/ceo/campaigns"); return; }
    if (tabId === "funnel_leads") { navigate("/ceo/funnel-leads"); return; }
    if (tabId === "optilex_board") { navigate("/ceo/optilex-board"); return; }
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
                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                    Enregistrement sales
                  </h1>
                  <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                    Cliquez un sales pour voir ses analyses (chaque RDV + sa scorecard). Vidéos et transcriptions en onglets.
                  </p>
                </div>

                {/* Rapport direction (tous-sales) — semaine sélectionnable */}
                {teamReport && (
                  <div style={{ marginBottom: 26 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: teamOpen ? 12 : 0, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15 }}>🧭</span>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Rapport direction</div>
                      {periods.length > 0 && (
                        <select
                          value={selectedPeriod || ""}
                          onChange={(e) => setSelectedPeriod(e.target.value)}
                          style={{ fontSize: 12.5, fontWeight: 600, color: C.text, background: darkMode ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                        </select>
                      )}
                      <button onClick={() => setTeamOpen((v) => !v)} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit" }}>
                        {teamOpen ? "Masquer" : "Afficher"}
                      </button>
                    </div>
                    {teamOpen && <TeamReportView report={teamReport} period={fmtPeriod(selectedPeriod)} C={C} darkMode={darkMode} />}
                  </div>
                )}

                <SalesRecordingsGrid
                  data={data}
                  loading={loading}
                  error={error}
                  onRefresh={() => load(true)}
                  refreshing={refreshing}
                  onSelectSales={setSelectedEmail}
                  avatars={avatars}
                  C={C}
                  darkMode={darkMode}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
