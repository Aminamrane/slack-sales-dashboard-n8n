import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";
import "../index.css";

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
};

// ── NAME NORMALIZATION (Critical for matching across tables) ─────────────────
const stripDiacritics = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeSalesKey = (name) => {
  if (!name) return "unknown";
  return stripDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")              // Multi-espaces → 1 espace
    .replace(/[^a-z\s'-]/g, "");       // Garde lettres, espaces, tirets, apostrophes
};

// Mapping de variantes de noms vers CLÉ CANONIQUE (pour matching entre tables)
// Format: "variante normalisée" → "clé canonique"
const NAME_VARIANTS_TO_CANONICAL = {
  // Kaïl variations
  "kyle dif": "kail",
  "kail": "kail",
  "kyle": "kail",

  // Yohan variations
  "yohan": "yohan debowski",
  "yohan debowski": "yohan debowski",
  "debowski": "yohan debowski",

  // Léo variations
  "leo": "leo mafrici",
  "leo mafrici": "leo mafrici",
  "mafrici": "leo mafrici",

  // Yanis variations
  "yanis": "yanis zairi",
  "yanis zairi": "yanis zairi",
  "zairi": "yanis zairi",

  // Youness variations
  "youness": "youness el boukhrissi",
  "youness el boukhrissi": "youness el boukhrissi",
  "el boukhrissi": "youness el boukhrissi",

  // Mourad variations
  "mourad": "mourad derradji",
  "mourad derradji": "mourad derradji",
  "derradji": "mourad derradji",

  // Alex variations
  "alex": "alex gaudrillet",
  "alex gaudrillet": "alex gaudrillet",
  "gaudrillet": "alex gaudrillet",

  // Sébastien variations
  "sebastien": "sebastien itema",
  "sebastien itema": "sebastien itema",
  "itema": "sebastien itema",

  // Quentin variations
  "quentin": "quentin rattez",
  "quentin rattez": "quentin rattez",
  "rattez": "quentin rattez",

  // Gwenaël variations
  "gwenael": "gwenael",
  "gwenaelle": "gwenael",

  // David
  "david": "david",

  // Eva
  "eva": "eva",

  // Aurélie variations
  "aurelie": "aurelie briquet",
  "aurelie briquet": "aurelie briquet",
  "briquet": "aurelie briquet",

  // Selim variations
  "selim": "selim kouay",
  "selim kouay": "selim kouay",
  "kouay": "selim kouay",

  // Mehdi variations
  "mehdi": "mehdi bouffessil",
  "mehdi bouffessil": "mehdi bouffessil",
  "bouffessil": "mehdi bouffessil",

  // Sarah variations
  "sarah": "sarah amroune",
  "sarah amroune": "sarah amroune",
  "amroune": "sarah amroune",

  // Sara variations (différente de Sarah)
  "sara": "sara benabid",
  "sara benabid": "sara benabid",
  "benabid": "sara benabid",

  // Mohamed variations
  "mohamed": "mohamed bouaksa",
  "mohamed bouaksa": "mohamed bouaksa",
  "bouaksa": "mohamed bouaksa",

  // Youcef variations
  "youcef": "youcef amran",
  "youcef amran": "youcef amran",
  "amran": "youcef amran"
};

// Canonical display names (clé canonique → nom d'affichage)
const CANONICAL_DISPLAY_NAMES = {
  "yohan debowski": "Yohan Debowski",
  "leo mafrici": "Léo Mafrici",
  "mourad derradji": "Mourad Derradji",
  "youness el boukhrissi": "Youness El Boukhrissi",
  "yanis zairi": "Yanis Zaïri",
  "alex gaudrillet": "Alex Gaudrillet",
  "sebastien itema": "Sébastien ITEMA",
  "selim kouay": "Selim Kouay",
  "eva": "Eva",
  "david": "David",
  "aurelie briquet": "Aurélie Briquet",
  "gwenael": "Gwenaël",
  "quentin rattez": "Quentin Rattez",
  "mehdi bouffessil": "Mehdi BOUFFESSIL",
  "sarah amroune": "Sarah Amroune",
  "sara benabid": "Sara BENABID",
  "mohamed bouaksa": "Mohamed Bouaksa",
  "kail": "Kaïl",
  "youcef amran": "Youcef Amran"
};

// Retourne la CLÉ CANONIQUE pour un nom donné (pour matching entre tables)
const getCanonicalKey = (rawName) => {
  const normalized = normalizeSalesKey(rawName);
  return NAME_VARIANTS_TO_CANONICAL[normalized] ?? normalized;
};

// Retourne le NOM D'AFFICHAGE pour un nom donné
const displaySalesName = (rawName) => {
  const canonicalKey = getCanonicalKey(rawName);
  return CANONICAL_DISPLAY_NAMES[canonicalKey] ?? rawName?.trim() ?? "Unknown";
};

// Personnes exclues (pas des sales)
const EXCLUDED_KEYS = new Set([
  "mohamed bouaksa",
  "sara benabid",
  "sarah amroune"
]);

export default function MonitoringPerf() {
  const navigate = useNavigate();

  // ── DARK MODE ───────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // ── AUTH & ACCESS CONTROL ───────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check JWT auth
        const token = apiClient.getToken();
        const user = apiClient.getUser();

        if (!token || !user) {
          navigate("/login");
          return;
        }

        // Create session object for compatibility with SharedNavbar
        setSession({ user: { email: user.email, user_metadata: { name: user.name } } });

        // Check if user has monitoring_perf permission
        if (user.role === 'admin' || apiClient.hasAccess('monitoring_perf')) {
          setHasAccess(true);
        } else {
          navigate("/");
        }
      } catch (e) {
        console.error("Access check error:", e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [navigate]);

  // ── VIEW MODE ───────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("perf_sales"); // "perf_sales" | "lead_quality"

  // ── DATA LOADING ────────────────────────────────────────────────────────────
  const [perfData, setPerfData] = useState(null); // Data from backend API
  const [dataLoading, setDataLoading] = useState(true);

  // ── LEAD QUALITY DATA ──────────────────────────────────────────────────────
  const [leadQualityData, setLeadQualityData] = useState(null);
  const [leadQualityLoading, setLeadQualityLoading] = useState(false);
  const [leadQualityRange, setLeadQualityRange] = useState(() => {
    const now = new Date();
    // If current date is before Feb 2026, default to Feb 2026
    if (now < new Date('2026-02-01')) {
      return '2026-02';
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // ── FILTERS ─────────────────────────────────────────────────────────────────
  const [range, setRange] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [canal, setCanal] = useState("global"); // "global" | "ads" | "cc"

  // ── DETAIL DRILL-DOWN (ADS/CC) ──────────────────────────────────────────
  const [detailModal, setDetailModal] = useState(null); // { personName, type, data, loading }

  const openDetail = async (personName) => {
    if (canal !== "ads" && canal !== "cc") return;
    setDetailModal({ personName, type: canal, data: null, loading: true });
    try {
      const endpoint = canal === "ads"
        ? `/api/v1/monitoring/performance/detail/ads`
        : `/api/v1/monitoring/performance/detail/cc`;
      const res = await apiClient.get(`${endpoint}?person_name=${encodeURIComponent(personName)}&period=${range}`);
      setDetailModal(prev => prev ? { ...prev, data: res, loading: false } : null);
    } catch (e) {
      console.error("Detail fetch error:", e);
      setDetailModal(prev => prev ? { ...prev, data: null, loading: false } : null);
    }
  };

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Convert range to period format for backend
      let period;
      if (range === "all") {
        period = "all";
      } else if (range.match(/^\d{4}-\d{2}$/)) {
        // Format: YYYY-MM
        period = range;
      } else {
        period = "current_month";
      }

      // Fetch performance data from backend API V2
      console.log("🔍 Fetching performance data V2 with period:", period);
      const data = await apiClient.get(`/api/v1/monitoring/performance/v2?period=${period}`);
      console.log("📊 Backend V2 response:", data);
      console.log("📊 global_view:", data?.global_view);
      console.log("📊 ads_view:", data?.ads_view);
      console.log("📊 cc_view:", data?.cc_view);
      setPerfData(data);
    } catch (err) {
      console.error("Fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      setTimeout(() => setDataLoading(false), 150);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess, range]);

  // ── FETCH LEAD QUALITY DATA ────────────────────────────────────────────────
  const fetchLeadQuality = async () => {
    setLeadQualityLoading(true);
    try {
      const period = leadQualityRange || 'current_month';
      console.log("🔍 Fetching lead quality data with period:", period);
      const data = await apiClient.get(`/api/v1/monitoring/lead-quality?period=${period}`);
      console.log("📊 Lead quality response:", data);
      setLeadQualityData(data);
    } catch (err) {
      console.error("Lead quality fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      setTimeout(() => setLeadQualityLoading(false), 150);
    }
  };

  useEffect(() => {
    if (hasAccess && viewMode === 'lead_quality') {
      fetchLeadQuality();
    }
  }, [hasAccess, viewMode, leadQualityRange]);

  // ── KPI CALCULATIONS ────────────────────────────────────────────────────────
  // Sales Funnel: Appels → Décrochés → R1p → R1r → R2p → R2r → Ventes
  const performanceData = useMemo(() => {
    if (!perfData) return [];

    // Select the appropriate view based on canal
    let viewData;
    if (canal === "ads") {
      viewData = perfData.ads_view;
    } else if (canal === "cc") {
      viewData = perfData.cc_view;
    } else {
      viewData = perfData.global_view;
    }

    if (!viewData?.by_person) return [];

    const performanceArray = viewData.by_person
      .filter(person => !EXCLUDED_KEYS.has(getCanonicalKey(person.name)))
      .filter(person => (person.leads_assigned || 0) > 0 || (person.nbr_signature || 0) > 0)
      .map(person => {
        const calls_total = person.nbr_appel || 0;
        const calls_answered = person.nbr_appel_d || 0;
        const r1_placed = person.r1p || 0;
        const r1_done = person.r1r || 0;
        const r2_placed = person.r2p || 0;
        const r2_done = person.r2r || 0;
        const signatures = person.nbr_signature || 0;
        const revenue = person.total_revenue || 0;
        const cashCollected = person.total_cash || 0;
        const leads_assigned = person.leads_assigned || 0;
        const leads_ads = person.leads_ads || 0;
        const leads_cc = person.leads_cc || 0;
        const unique_answered = person.unique_answered || 0;

        // Use API-provided conversion rates, with fallback calculations
        // Conv. global = Ventes / Leads affectés (not calls_answered anymore)
        const conv_global = person.conversion_global || (leads_assigned > 0 ? (signatures / leads_assigned) * 100 : 0);
        const conv_calls_to_answered = person.conv_calls_to_answered || (calls_total > 0 ? (calls_answered / calls_total) * 100 : 0);
        const conv_answered_to_r1p = person.conv_answered_to_r1p || (calls_answered > 0 ? (r1_placed / calls_answered) * 100 : 0);
        const conv_r1p_to_r1r = person.conv_r1p_to_r1r || (r1_placed > 0 ? (r1_done / r1_placed) * 100 : 0);
        const conv_r2p_to_r2r = person.conv_r2p_to_r2r || (r2_placed > 0 ? (r2_done / r2_placed) * 100 : 0);
        const conv_sales = person.conv_sales || (r2_done > 0 ? (signatures / r2_done) * 100 : 0);

        return {
          salesName: displaySalesName(person.name),
          salesKey: getCanonicalKey(person.name),
          calls_total,
          calls_answered,
          r1_placed,
          r1_done,
          r2_placed,
          r2_done,
          signatures,
          revenue,
          cashCollected,
          leads_assigned,
          leads_ads,
          leads_cc,
          unique_answered,
          avatar: "",
          // Conversion rates (funnel order)
          conv_global,
          conv_calls_to_answered,
          conv_answered_to_r1p,
          conv_r1p_to_r1r,
          conv_r2p_to_r2r,
          conv_sales
        };
      });

    // Deduplicate by salesKey (keep first occurrence with highest values)
    const seen = new Set();
    const dedupedArray = performanceArray.filter(person => {
      if (seen.has(person.salesKey)) {
        return false;
      }
      seen.add(person.salesKey);
      return true;
    });

    // Sort by signatures (DESC), then conv_global (DESC), then calls (DESC)
    dedupedArray.sort((a, b) => {
      if (b.signatures !== a.signatures) {
        return b.signatures - a.signatures;
      }
      if (b.conv_global !== a.conv_global) {
        return b.conv_global - a.conv_global;
      }
      return b.calls_total - a.calls_total;
    });

    return dedupedArray;
  }, [perfData, canal]);

  // ── TOTALS ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    if (!performanceData || performanceData.length === 0) {
      return {
        calls: 0, answered: 0, signatures: 0, revenue: 0, cashCollected: 0,
        r1_placed: 0, r1_done: 0, r2_placed: 0, r2_done: 0,
        leads_assigned: 0, unique_answered: 0,
        conv_global: 0, conv_calls_to_answered: 0, conv_answered_to_r1p: 0,
        conv_r1p_to_r1r: 0, conv_r2p_to_r2r: 0, conv_sales: 0,
        lead_qualifie: 0, closing_r1: 0, closing_r2: 0, closing_audit: 0
      };
    }

    const t = performanceData.reduce((acc, stat) => ({
      calls: acc.calls + stat.calls_total,
      answered: acc.answered + stat.calls_answered,
      r1_placed: acc.r1_placed + stat.r1_placed,
      r1_done: acc.r1_done + stat.r1_done,
      r2_placed: acc.r2_placed + stat.r2_placed,
      r2_done: acc.r2_done + stat.r2_done,
      signatures: acc.signatures + stat.signatures,
      revenue: acc.revenue + stat.revenue,
      cashCollected: acc.cashCollected + stat.cashCollected,
      leads_assigned: acc.leads_assigned + stat.leads_assigned,
      unique_answered: acc.unique_answered + stat.unique_answered
    }), { calls: 0, answered: 0, r1_placed: 0, r1_done: 0, r2_placed: 0, r2_done: 0, signatures: 0, revenue: 0, cashCollected: 0, leads_assigned: 0, unique_answered: 0 });

    // Calculate conversion rates from totals (funnel order)
    // All KPIs calculated on SUMS, not averages of individual rates
    return {
      ...t,
      // Funnel KPIs (calculated on global sums)
      lead_qualifie: t.leads_assigned > 0 ? (t.unique_answered / t.leads_assigned) * 100 : 0,
      closing_r1: t.unique_answered > 0 ? (t.r1_done / t.unique_answered) * 100 : 0,
      closing_r2: t.r1_done > 0 ? (t.r2_done / t.r1_done) * 100 : 0,
      closing_audit: t.r2_done > 0 ? (t.signatures / t.r2_done) * 100 : 0,
      conv_global: t.leads_assigned > 0 ? (t.signatures / t.leads_assigned) * 100 : 0,
      // Legacy rates (still used in table columns)
      conv_calls_to_answered: t.calls > 0 ? (t.answered / t.calls) * 100 : 0,
      conv_answered_to_r1p: t.answered > 0 ? (t.r1_placed / t.answered) * 100 : 0,
      conv_r1p_to_r1r: t.r1_placed > 0 ? (t.r1_done / t.r1_placed) * 100 : 0,
      conv_r2p_to_r2r: t.r2_placed > 0 ? (t.r2_done / t.r2_placed) * 100 : 0,
      conv_sales: t.r2_done > 0 ? (t.signatures / t.r2_done) * 100 : 0
    };
  }, [performanceData]);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: darkMode ? "#1a1a1e" : "#f5f5f7",
        fontFamily: "sans-serif"
      }}>
        <p style={{ color: darkMode ? "#8b8d93" : "#86868b" }}>
          Vérification des accès...
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div style={{
      padding: 0,
      fontFamily: "sans-serif",
      background: darkMode ? "#1a1a1e" : "#f5f5f7",
      minHeight: "100vh",
      paddingTop: '16px'
    }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="board-frame" style={{
        width: 'fit-content',
        maxWidth: 'none',
        margin: 'var(--space-xl) auto',
        minWidth: '1200px',
        transition: 'all 0.3s ease-out'
      }}>
        {/* Title bar */}
        <div className="title-bar">
          <img
            src={darkMode ? myLogoDark : myLogo}
            className="title-logo"
            alt="logo"
          />
          <h1 className="leaderboard-title">Monitoring Perf. Sales</h1>
        </div>

        {/* Controls (Tabs + Filters) */}
        <div style={{
          position: 'absolute',
          top: 'var(--space-xl)',
          left: 'var(--space-2xl)',
          right: 'var(--space-2xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          {/* Left: View tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <button
              className={viewMode === "perf_sales" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => setViewMode("perf_sales")}
            >
              Perf.sales
            </button>
            <button
              className={viewMode === "lead_quality" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => setViewMode("lead_quality")}
            >
              Qualité Leads
            </button>
          </div>

          {/* Right: Month selector + Canal buttons (conditional based on viewMode) */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {viewMode === "perf_sales" ? (
              <>
                {/* Month selector for Perf Sales (starts Sept 2025) */}
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="range-select"
                  style={{
                    padding: '8px 14px',
                    paddingRight: '32px',
                    borderRadius: '12px',
                    border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                    background: darkMode ? '#2a2b2e' : '#ffffff',
                    color: darkMode ? '#f5f5f7' : '#1d1d1f',
                    fontWeight: 500,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {(() => {
                    const options = [];
                    const startDate = new Date('2025-09-01');
                    const today = new Date();
                    const months = [];
                    const current = new Date(startDate);
                    const currentYearMonth = today.getFullYear() * 100 + today.getMonth();

                    while (true) {
                      const year = current.getFullYear();
                      const month = current.getMonth();
                      const iterYearMonth = year * 100 + month;
                      if (iterYearMonth > currentYearMonth) break;

                      const monthName = new Intl.DateTimeFormat('fr-FR', {
                        month: 'long',
                        year: 'numeric'
                      }).format(current);

                      const value = `${year}-${String(month + 1).padStart(2, '0')}`;
                      months.unshift({ value, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) });
                      current.setMonth(current.getMonth() + 1);
                    }

                    months.forEach(m => {
                      options.push(<option key={m.value} value={m.value}>{m.label}</option>);
                    });
                    options.push(<option key="all" value="all">All time</option>);
                    return options;
                  })()}
                </select>

                {/* Canal selector (Global/ADS/CC) */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={canal === "global" ? "toggle-btn active" : "toggle-btn"}
                    onClick={() => setCanal("global")}
                  >
                    Global
                  </button>
                  <button
                    className={canal === "ads" ? "toggle-btn active" : "toggle-btn"}
                    onClick={() => setCanal("ads")}
                  >
                    ADS
                  </button>
                  <button
                    className={canal === "cc" ? "toggle-btn active" : "toggle-btn"}
                    onClick={() => setCanal("cc")}
                  >
                    CC
                  </button>
                </div>
              </>
            ) : (
              /* Month selector for Lead Quality (starts Feb 2026) */
              <select
                value={leadQualityRange}
                onChange={(e) => setLeadQualityRange(e.target.value)}
                className="range-select"
                style={{
                  padding: '8px 14px',
                  paddingRight: '32px',
                  borderRadius: '12px',
                  border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`,
                  background: darkMode ? '#2a2b2e' : '#ffffff',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {(() => {
                  const options = [];
                  const startDate = new Date('2026-02-01'); // Lead quality starts Feb 2026
                  const today = new Date();
                  const months = [];
                  const current = new Date(startDate);
                  const currentYearMonth = today.getFullYear() * 100 + today.getMonth();

                  while (true) {
                    const year = current.getFullYear();
                    const month = current.getMonth();
                    const iterYearMonth = year * 100 + month;
                    if (iterYearMonth > currentYearMonth) break;

                    const monthName = new Intl.DateTimeFormat('fr-FR', {
                      month: 'long',
                      year: 'numeric'
                    }).format(current);

                    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
                    months.unshift({ value, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) });
                    current.setMonth(current.getMonth() + 1);
                  }

                  months.forEach(m => {
                    options.push(<option key={m.value} value={m.value}>{m.label}</option>);
                  });
                  return options;
                })()}
              </select>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PERF SALES VIEW */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "perf_sales" && (
          <>
        {/* Totals Block */}
        <div className="totals-block">
          <div className="totals-row" style={{ gap: '32px', justifyContent: 'center' }}>
            <div className="money-float-container">
              <span className="totals-label">Appels</span><br />
              <span className="totals-value perf-neutral dot-boost">
                {totals.calls?.toLocaleString("fr-FR") || 0}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">Décrochés</span><br />
              <span className="totals-value perf-neutral dot-boost">
                {totals.answered?.toLocaleString("fr-FR") || 0}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">R1 effectué</span><br />
              <span className="totals-value perf-neutral dot-boost">
                {totals.r1_done?.toLocaleString("fr-FR") || 0}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">Leads affectés</span><br />
              <span className="totals-value perf-neutral dot-boost">
                {totals.leads_assigned?.toLocaleString("fr-FR") || 0}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">Ventes</span><br />
              <span className="totals-value cash dot-boost">
                {totals.signatures?.toLocaleString("fr-FR") || 0}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">Revenue</span><br />
              <span className="totals-value revenu dot-boost">
                {totals.revenue > 0 ? `${Math.round(totals.revenue).toLocaleString("fr-FR")} €` : '0 €'}
              </span>
            </div>

            <div className="money-float-container">
              <span className="totals-label">Cash</span><br />
              <span className="totals-value cash dot-boost">
                {totals.cashCollected > 0 ? `${Math.round(totals.cashCollected).toLocaleString("fr-FR")} €` : '0 €'}
              </span>
            </div>
          </div>

          {/* ── Funnel KPIs ── */}
          <div className="totals-sales dot-boost" style={{ marginTop: '10px' }}>
            {canal !== "cc" && <>Lead Qualifié: {totals.lead_qualifie?.toFixed(1) || 0}%&nbsp;&nbsp;&nbsp;</>}Closing R1: {totals.closing_r1?.toFixed(1) || 0}%&nbsp;&nbsp;&nbsp;Closing R2: {totals.closing_r2?.toFixed(1) || 0}%&nbsp;&nbsp;&nbsp;Closing Audit: {totals.closing_audit?.toFixed(1) || 0}%&nbsp;&nbsp;&nbsp;Taux de conversion: {totals.conv_global?.toFixed(2) || 0}%
          </div>
        </div>

        {dataLoading && (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: darkMode ? '#8b8d93' : '#86868b',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <p>Chargement des données...</p>
          </div>
        )}

        {!dataLoading && performanceData.length === 0 && (
          <p style={{
            textAlign: 'center',
            padding: '60px',
            color: darkMode ? '#8b8d93' : '#86868b',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            Aucune donnée disponible
          </p>
        )}

        {!dataLoading && performanceData.length > 0 && (
          <div className="leaderboard-wrapper" style={{
            animation: 'fadeIn 0.4s ease-out'
          }}>
            {/* Sales Funnel Table: Appels → Décrochés → R1 → R2 → Ventes */}
            <table className="leaderboard" style={{ fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)', textAlign: 'center' }}>#</th>
                    <th style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)', textAlign: 'center' }}>Sales</th>
                    <th align="center" title="Leads affectés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Leads</th>
                    <th align="center" title="Ventes / Leads affectés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Conv. %</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Appels</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Décrochés</th>
                    <th align="center" title="Appels Décrochés / Appels Totaux" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Tx Décr.</th>
                    <th align="center" title="R1 Placés / Appels Décrochés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>R1/Décr</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>R1p</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>R1E</th>
                    <th align="center" title="R1 Réalisés / R1 Placés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Tx R1</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>R2p</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>R2E</th>
                    <th align="center" title="R2 Réalisés / R2 Placés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Tx R2</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Ventes</th>
                    <th align="center" title="Ventes / R2 Réalisés" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Conv. V.</th>
                    <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Revenue</th>
                    <th align="center" style={{ whiteSpace: 'nowrap' }}>Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.map((stat, i) => {
                    // Color coding helpers
                    const getConvGlobalColor = (tx) => {
                      if (tx >= 5) return COLORS.tertiary;
                      if (tx >= 2) return COLORS.secondary;
                      return darkMode ? '#f5f5f7' : '#1d1d1f';
                    };
                    const getDecrochageColor = (tx) => {
                      if (tx >= 80) return COLORS.tertiary;
                      if (tx >= 50) return COLORS.secondary;
                      return '#ff453a';
                    };
                    const getRxColor = (tx) => {
                      if (tx >= 80) return COLORS.tertiary;
                      if (tx >= 50) return COLORS.secondary;
                      return '#ff453a';
                    };
                    const getConvVenteColor = (tx) => {
                      if (tx >= 40) return COLORS.tertiary;
                      if (tx >= 20) return COLORS.secondary;
                      return darkMode ? '#f5f5f7' : '#1d1d1f';
                    };
                    const getConvToR1pColor = (tx) => {
                      if (tx >= 30) return COLORS.tertiary;
                      if (tx >= 15) return COLORS.secondary;
                      return darkMode ? '#f5f5f7' : '#1d1d1f';
                    };

                    const cellBorder = { borderRight: '1px solid rgba(128,128,128,0.15)' };

                    return (
                      <tr key={`${canal}-${i}-${stat.salesKey}`}>
                        <td style={cellBorder}>
                          {i === 0 ? (
                            <img src={firstPlace} alt="1st" style={{ width: 22, height: 22 }} />
                          ) : i === 1 ? (
                            <img src={secondPlace} alt="2nd" style={{ width: 22, height: 22 }} />
                          ) : i === 2 ? (
                            <img src={thirdPlace} alt="3rd" style={{ width: 22, height: 22 }} />
                          ) : (
                            i + 1
                          )}
                        </td>
                        <td className="name-cell" style={cellBorder}>
                          <div className="avatar-wrap">
                            {stat.avatar ? (
                              <img
                                src={stat.avatar}
                                className="avatar"
                                alt={stat.salesName}
                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: i === 0 ? COLORS.tertiary : i === 1 ? COLORS.secondary : COLORS.primary,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', color: '#fff', fontWeight: 600
                              }}>
                                {stat.salesName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              fontWeight: i < 3 ? 700 : 500,
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                              ...(canal !== "global" ? { cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(128,128,128,0.3)', textUnderlineOffset: '3px' } : {})
                            }}
                            onClick={() => canal !== "global" && openDetail(stat.salesName)}
                          >
                            {stat.salesName}
                          </span>
                        </td>
                        {/* Leads affectés */}
                        <td align="center" style={{ fontWeight: 700, ...cellBorder }}>
                          {canal === "ads" ? (stat.leads_ads?.toLocaleString("fr-FR") || 0) :
                           canal === "cc" ? (stat.leads_cc?.toLocaleString("fr-FR") || 0) :
                           (stat.leads_assigned?.toLocaleString("fr-FR") || 0)}
                        </td>
                        {/* Conv. Globale (Ventes / Leads affectés) */}
                        <td align="center" style={{ fontWeight: 700, color: getConvGlobalColor(stat.conv_global), ...cellBorder }}>
                          {stat.conv_global?.toFixed(2) || 0}%
                        </td>
                        {/* Appels Totaux */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.calls_total?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* Appels Décrochés */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.calls_answered?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* Taux Décrochage */}
                        <td align="center" style={{ fontWeight: 600, color: getDecrochageColor(stat.conv_calls_to_answered), ...cellBorder }}>
                          {stat.conv_calls_to_answered?.toFixed(1) || 0}%
                        </td>
                        {/* Conv → R1p */}
                        <td align="center" style={{ fontWeight: 600, color: getConvToR1pColor(stat.conv_answered_to_r1p), ...cellBorder }}>
                          {stat.conv_answered_to_r1p?.toFixed(1) || 0}%
                        </td>
                        {/* R1 Placés */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.r1_placed?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* R1 Réalisés */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.r1_done?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* Taux R1 */}
                        <td align="center" style={{ fontWeight: 600, color: getRxColor(stat.conv_r1p_to_r1r), ...cellBorder }}>
                          {stat.conv_r1p_to_r1r?.toFixed(0) || 0}%
                        </td>
                        {/* R2 Placés */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.r2_placed?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* R2 Réalisés */}
                        <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                          {stat.r2_done?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* Taux R2 */}
                        <td align="center" style={{ fontWeight: 600, color: getRxColor(stat.conv_r2p_to_r2r), ...cellBorder }}>
                          {stat.conv_r2p_to_r2r?.toFixed(0) || 0}%
                        </td>
                        {/* Ventes */}
                        <td align="center" style={{ fontWeight: 800, fontSize: '0.95rem', color: COLORS.tertiary, ...cellBorder }}>
                          {stat.signatures?.toLocaleString("fr-FR") || 0}
                        </td>
                        {/* Conv. Ventes */}
                        <td align="center" style={{ fontWeight: 600, color: getConvVenteColor(stat.conv_sales), ...cellBorder }}>
                          {stat.conv_sales?.toFixed(1) || 0}%
                        </td>
                        {/* Revenue */}
                        <td align="center" style={{ fontWeight: 500, color: COLORS.secondary, ...cellBorder }}>
                          {stat.revenue > 0 ? `${Math.round(stat.revenue).toLocaleString("fr-FR")}€` : '—'}
                        </td>
                        {/* Cash */}
                        <td align="center" style={{ fontWeight: 500, color: COLORS.tertiary }}>
                          {stat.cashCollected > 0 ? `${Math.round(stat.cashCollected).toLocaleString("fr-FR")}€` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* LEAD QUALITY VIEW */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === "lead_quality" && (
          <>
            {/* Lead Quality Totals Block */}
            <div className="totals-block">
              <div className="totals-row" style={{ gap: '32px', justifyContent: 'center' }}>
                <div className="money-float-container">
                  <span className="totals-label">Total Leads</span><br />
                  <span className="totals-value perf-neutral dot-boost">
                    {leadQualityData?.summary?.total_leads?.toLocaleString("fr-FR") || 0}
                  </span>
                </div>

                <div className="money-float-container">
                  <span className="totals-label">Total Clients</span><br />
                  <span className="totals-value cash dot-boost">
                    {leadQualityData?.summary?.total_clients?.toLocaleString("fr-FR") || 0}
                  </span>
                </div>

                <div className="money-float-container">
                  <span className="totals-label">Taux Conv. Global</span><br />
                  <span className="totals-value cash dot-boost">
                    {leadQualityData?.summary?.global_conversion_rate?.toFixed(1) || 0}%
                  </span>
                </div>

                <div className="money-float-container">
                  <span className="totals-label">Total Appels</span><br />
                  <span className="totals-value perf-neutral dot-boost">
                    {leadQualityData?.summary?.total_calls?.toLocaleString("fr-FR") || 0}
                  </span>
                </div>

                <div className="money-float-container">
                  <span className="totals-label">Appels Décrochés</span><br />
                  <span className="totals-value perf-neutral dot-boost">
                    {leadQualityData?.summary?.total_answered?.toLocaleString("fr-FR") || 0}
                  </span>
                </div>

                <div className="money-float-container">
                  <span className="totals-label">Taux Décr. Global</span><br />
                  <span className="totals-value revenu dot-boost">
                    {leadQualityData?.summary?.global_answer_rate?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {leadQualityLoading && (
              <div style={{
                textAlign: 'center',
                padding: '60px',
                color: darkMode ? '#8b8d93' : '#86868b',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <p>Chargement des données qualité leads...</p>
              </div>
            )}

            {/* Empty state */}
            {!leadQualityLoading && (!leadQualityData?.by_origin || leadQualityData.by_origin.length === 0) && (
              <p style={{
                textAlign: 'center',
                padding: '60px',
                color: darkMode ? '#8b8d93' : '#86868b',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                Aucune donnée disponible pour cette période
              </p>
            )}

            {/* Lead Quality Table */}
            {!leadQualityLoading && leadQualityData?.by_origin && leadQualityData.by_origin.length > 0 && (
              <div className="leaderboard-wrapper" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                <table className="leaderboard" style={{ fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)', textAlign: 'center' }}>#</th>
                      <th style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)', textAlign: 'center' }}>Origine</th>
                      <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Leads</th>
                      <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Clients</th>
                      <th align="center" title="Clients / Leads" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Conv. %</th>
                      <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Appels</th>
                      <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Décrochés</th>
                      <th align="center" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Manqués</th>
                      <th align="center" title="Décrochés / Total Appels" style={{ whiteSpace: 'nowrap', borderRight: '1px solid rgba(128,128,128,0.15)' }}>Tx Décr.</th>
                      <th align="center" title="Manqués / Total Appels" style={{ whiteSpace: 'nowrap' }}>Tx Manqués</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadQualityData.by_origin
                      .sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0))
                      .map((origin, i) => {
                        const getConvColor = (rate) => {
                          if (rate >= 10) return COLORS.tertiary;
                          if (rate >= 5) return COLORS.secondary;
                          return darkMode ? '#f5f5f7' : '#1d1d1f';
                        };
                        const getAnswerColor = (rate) => {
                          if (rate >= 80) return COLORS.tertiary;
                          if (rate >= 60) return COLORS.secondary;
                          return '#ff453a';
                        };
                        const getMissedColor = (rate) => {
                          if (rate <= 20) return COLORS.tertiary;
                          if (rate <= 40) return COLORS.secondary;
                          return '#ff453a';
                        };

                        const cellBorder = { borderRight: '1px solid rgba(128,128,128,0.15)' };

                        return (
                          <tr key={origin.origin || i}>
                            <td style={{ ...cellBorder, textAlign: 'center' }}>
                              {i === 0 ? (
                                <img src={firstPlace} alt="1st" style={{ width: 22, height: 22 }} />
                              ) : i === 1 ? (
                                <img src={secondPlace} alt="2nd" style={{ width: 22, height: 22 }} />
                              ) : i === 2 ? (
                                <img src={thirdPlace} alt="3rd" style={{ width: 22, height: 22 }} />
                              ) : (
                                i + 1
                              )}
                            </td>
                            <td style={{ ...cellBorder, fontWeight: i < 3 ? 700 : 500 }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                background: darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                color: COLORS.primary
                              }}>
                                {origin.origin || 'Inconnu'}
                              </span>
                            </td>
                            <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                              {origin.leads_count?.toLocaleString("fr-FR") || 0}
                            </td>
                            <td align="center" style={{ fontWeight: 600, color: COLORS.tertiary, ...cellBorder }}>
                              {origin.clients_count?.toLocaleString("fr-FR") || 0}
                            </td>
                            <td align="center" style={{ fontWeight: 700, color: getConvColor(origin.conversion_rate), ...cellBorder }}>
                              {origin.conversion_rate?.toFixed(1) || 0}%
                            </td>
                            <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                              {origin.calls_total?.toLocaleString("fr-FR") || 0}
                            </td>
                            <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                              {origin.calls_answered?.toLocaleString("fr-FR") || 0}
                            </td>
                            <td align="center" style={{ fontWeight: 500, ...cellBorder }}>
                              {origin.calls_missed?.toLocaleString("fr-FR") || 0}
                            </td>
                            <td align="center" style={{ fontWeight: 600, color: getAnswerColor(origin.answer_rate), ...cellBorder }}>
                              {origin.answer_rate?.toFixed(1) || 0}%
                            </td>
                            <td align="center" style={{ fontWeight: 600, color: getMissedColor(origin.missed_rate) }}>
                              {origin.missed_rate?.toFixed(1) || 0}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail Modal (ADS / CC drill-down) ── */}
      {detailModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setDetailModal(null)}
        >
          <div
            style={{
              background: darkMode ? '#242428' : '#ffffff',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
              border: `1px solid ${darkMode ? '#333338' : '#e5e5e5'}`
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: darkMode ? '#f5f5f7' : '#1d1d1f' }}>
                  {detailModal.personName}
                </h3>
                <span style={{ fontSize: '0.85rem', color: darkMode ? '#8b8d93' : '#86868b' }}>
                  {detailModal.type === 'ads' ? 'Leads ADS' : 'Cold Calls'} &middot; {detailModal.data?.period || range}
                </span>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.5rem', lineHeight: 1, padding: '4px 8px',
                  color: darkMode ? '#8b8d93' : '#86868b', borderRadius: '8px'
                }}
              >&times;</button>
            </div>

            {/* Loading */}
            {detailModal.loading && (
              <p style={{ textAlign: 'center', padding: '40px', color: darkMode ? '#8b8d93' : '#86868b' }}>
                Chargement...
              </p>
            )}

            {/* No data */}
            {!detailModal.loading && !detailModal.data && (
              <p style={{ textAlign: 'center', padding: '40px', color: darkMode ? '#8b8d93' : '#86868b' }}>
                Erreur lors du chargement
              </p>
            )}

            {/* ADS Table */}
            {!detailModal.loading && detailModal.data && detailModal.type === 'ads' && (
              <>
                <p style={{ fontSize: '0.85rem', color: darkMode ? '#8b8d93' : '#86868b', marginBottom: '12px' }}>
                  {detailModal.data.total || detailModal.data.leads?.length || 0} leads
                </p>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f'
                }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#333338' : '#e5e5e5'}` }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Nom</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Telephone</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Origine</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailModal.data.leads || []).map((lead, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${darkMode ? '#2a2b2e' : '#f0f0f0'}` }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{lead.full_name}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{lead.phone}</td>
                        <td style={{ padding: '8px 10px' }}>{lead.origin}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{lead.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* CC Table */}
            {!detailModal.loading && detailModal.data && detailModal.type === 'cc' && (
              <>
                <p style={{ fontSize: '0.85rem', color: darkMode ? '#8b8d93' : '#86868b', marginBottom: '12px' }}>
                  {detailModal.data.total_entries || detailModal.data.entries?.length || 0} jours &middot; {detailModal.data.total_appels?.toLocaleString("fr-FR") || 0} appels
                </p>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f'
                }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#333338' : '#e5e5e5'}` }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Date</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: darkMode ? '#8b8d93' : '#86868b' }}>Nombre d'appels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailModal.data.entries || []).map((entry, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${darkMode ? '#2a2b2e' : '#f0f0f0'}` }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{entry.date}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{entry.nbr_appel?.toLocaleString("fr-FR") || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
