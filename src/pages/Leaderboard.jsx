import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";
import lightIcon from "../assets/light.png";
import darkIcon from "../assets/dark.png";
import trophyIcon from "../assets/trophy.png";

import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Line } from "react-chartjs-2";
import "../index.css";

Chart.register(ChartDataLabels);

const REQUIRED_TEAM = import.meta.env.VITE_SLACK_TEAM_ID || "";

// Unified color palette
const COLORS = {
  primary: "#6366f1",   // Indigo
  secondary: "#fb923c", // Orange  
  tertiary: "#10b981",  // Green
  gray: "#94a3b8",      // Gray
  purple: "#a78bfa",    // Purple
  cyan: "#22d3ee",      // Cyan
  pink: "#f472b6",      // Pink
  yellow: "#fbbf24",    // Yellow
};

// Équipes commerciales
const TEAMS = [
  {
    id: "team1",
    label: "Équipe 1",
    captain: "Yohan Debowski",
    members: [
      "Yanis Zaïri",
      "Mourad Derradji",
      "Youness El Boukhrissi",
      "Alex Gaudrillet",
      "Kaïl"
    ],
    color: COLORS.secondary, // orange
  },
  {
    id: "team2",
    label: "Équipe 2",
    captain: "Léo Mafrici",
    members: [
      "Eva",
      "Mehdi BOUFFESSIL",
      "Sarah Amroune",
      "Sébastien ITEMA",
      "Selim Kouay"
    ],
    color: COLORS.primary, // indigo
  },
  {
    id: "team3",
    label: "Équipe 3",
    captain: "David",
    members: [
      "Aurélie Briquet",
      "Gwenaël",
      "Quentin Rattez"
    ],
    color: COLORS.tertiary, // vert
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────────────────── */
function getSlackTeamId(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const fromMeta = meta.team?.id || meta.slack_team_id || meta["https://slack.com/team_id"];
  if (fromMeta) return fromMeta;

  const id0 = user.identities?.[0]?.identity_data;
  const fromIdentity = id0?.team?.id || id0?.team_id || id0?.workspace?.id;
  if (fromIdentity) return fromIdentity;

  const fromAppMeta = user.app_metadata?.team?.id || user.app_metadata?.slack_team_id;
  return fromAppMeta || "";
}

const ALIAS_MAP = new Map([
  ["ads", "ADS"], ["ad", "ADS"], ["publicite", "ADS"],
  ["facebook ads", "ADS"], ["meta ads", "ADS"], ["google ads", "ADS"], ["gg ads", "ADS"],
  ["linkedin", "LinkedIn"], ["lnkd", "LinkedIn"], ["lkd", "LinkedIn"],
  ["cc", "CC"], ["cold call", "CC"], ["call", "CC"],
  ["ref", "Referral"], ["referral", "Referral"], ["parrainage", "Referral"],
  ["site", "Site Web"], ["web", "Site Web"], ["seo", "Site Web"],
]);

const stripDiacritics = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function normalizeTunnelLabel(raw) {
  if (!raw) return "Autre";
  const base = stripDiacritics(String(raw).trim().toLowerCase());
  if (ALIAS_MAP.has(base)) return ALIAS_MAP.get(base);
  return base.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
}

/* ────────────────────────────────────────────────────────────────────────────
   Tiny hooks / chips
──────────────────────────────────────────────────────────────────────────── */
function useAutoFit(ref, { max = 240, minFont = 12, maxFont = 16, step = 0.5 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.fontSize = `${maxFont}px`;
    const originalMaxWidth = el.style.maxWidth;
    el.style.maxWidth = `${max}px`;

    const fits = () => el.scrollWidth <= max;
    let size = maxFont;
    while (!fits() && size > minFont) {
      size -= step;
      el.style.fontSize = `${size}px`;
    }
    return () => { el.style.maxWidth = originalMaxWidth; };
  }, [ref, max, minFont, maxFont, step]);
}

function TrendBadge({ deltaAbs, deltaPct }) {
  const isUp = deltaAbs > 0;
  const isDown = deltaAbs < 0;
  const ref = useRef(null);
  useAutoFit(ref, { max: 240, minFont: 12, maxFont: 16, step: 0.5 });

  const pctText = deltaPct === null ? "N-1 = 0 €" : `${Math.abs(deltaPct).toFixed(2)}%`;

  return (
    <div
      ref={ref}
      className={`trend-badge ${isUp ? "trend-up" : isDown ? "trend-down" : "trend-flat"}`}
      title="Comparaison mois en cours vs mois précédent (même période)"
    >
      <span className="row">
        {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(deltaAbs).toLocaleString("fr-FR")} €
      </span>
      <span className="row">({pctText})</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Counter Animation Hook
──────────────────────────────────────────────────────────────────────────── */
function useCountUp(end, duration = 1500) {
  const [count, setCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    setIsComplete(false);
    
    if (end === 0) {
      setCount(0);
      return;
    }
    
    let startTime = null;
    const startValue = 0;
    
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(startValue + (end - startValue) * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation terminée!
        setIsComplete(true);
        setTimeout(() => setIsComplete(false), 2000); // Reset après 2s
      }
    };
    
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return { count, isComplete };
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */
export default function Leaderboard() {
  const navigate = useNavigate();

  // ── DARK MODE ───────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    
    // Appliquer dark-mode à body ET html
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // ── AUTH ────────────────────────────────────────────────────────────────────
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const PULL_THRESHOLD = 50; // Distance minimum pour trigger le refresh (RÉDUIT)

  // ── ADMIN LOGIN STATE ─────────────────────────────────────────────────────
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const storedAdminSession = localStorage.getItem("admin_session");
    if (storedAdminSession) {
      try {
        const adminSession = JSON.parse(storedAdminSession);
        if (adminSession?.user?.user_metadata?.role === "admin") {
          setSession(adminSession);
          setAllowed(true);
          setAuthChecking(false);
          setIsAdminUser(true);
          return;
        }
      } catch (e) {
        localStorage.removeItem("admin_session");
      }
    }
  }, []);

  useEffect(() => {
    const syncSession = async () => {
      const adminSession = localStorage.getItem("admin_session");
      if (adminSession) {
        try {
          const parsed = JSON.parse(adminSession);
          if (parsed?.user?.user_metadata?.role === "admin") {
            setIsAdminUser(true);
            return;
          }
        } catch (e) {
          localStorage.removeItem("admin_session");
        }
      }
      setIsAdminUser(false);

      try {
        const { data } = await supabase.auth.getSession();
        const ses = data?.session || null;
        setSession(ses);

        if (!REQUIRED_TEAM) {
          setAllowed(Boolean(ses));
        } else {
          const tid = getSlackTeamId(ses?.user);
          setAllowed(!tid || tid === REQUIRED_TEAM);
        }
      } catch (e) {
        console.error("getSession failed:", e);
        setAllowed(!REQUIRED_TEAM);
      } finally {
        setAuthChecking(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, ses) => {
      const adminSession = localStorage.getItem("admin_session");
      if (adminSession) {
        try {
          const parsed = JSON.parse(adminSession);
          if (parsed?.user?.user_metadata?.role === "admin") {
            setIsAdminUser(true);
            return;
          }
        } catch (e) {
          localStorage.removeItem("admin_session");
        }
      }
      setIsAdminUser(false);

      setSession(ses);
      if (!REQUIRED_TEAM) {
        setAllowed(Boolean(ses));
      } else {
        const tid = getSlackTeamId(ses?.user);
        setAllowed(!tid || tid === REQUIRED_TEAM);
      }
      setAuthChecking(false);
    });

    syncSession();
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);

    const validUsername = import.meta.env.VITE_ADMIN_USERNAME;
    const validPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (adminUsername === validUsername && adminPassword === validPassword) {
      const adminSession = {
        user: {
          id: "admin-user",
          email: "paul@company.com",
          user_metadata: { name: "Paul Faucomprez", role: "admin" },
        },
        access_token: "admin-token",
      };

      localStorage.setItem("admin_session", JSON.stringify(adminSession));
      
      setSession(adminSession);
      setAllowed(true);
      setIsAdminUser(true);
      setAdminLoading(false);
    } else {
      setAdminError("Identifiants incorrects");
      setAdminLoading(false);
    }
  };

  const loginWithSlack = async () => {
    try {
      setLoggingIn(true);
      await supabase.auth.signInWithOAuth({
        provider: "slack_oidc",
        options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "openid profile email" },
      });
    } finally { setLoggingIn(false); }
  };

  const logout = async () => {
    try {
      localStorage.removeItem("admin_session");
      const { error } = await supabase.auth.signOut();
      if (error) console.error("signOut error:", error);
    } finally {
      setSession(null); 
      setAllowed(false);
      setIsAdminUser(false);
      window.location.assign("/");
    }
  };

  // ── DATA ────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [tunnelStats, setTunnelStats] = useState({});
  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });
  const [loading, setLoading] = useState(true);

  // ── ANIMATED COUNTERS ───────────────────────────────────────────────────────
  const { count: animatedCash, isComplete: cashComplete } = useCountUp(totals.cash, 1500);
  const { count: animatedRevenu, isComplete: revenuComplete } = useCountUp(totals.revenu, 1500);
  const { count: animatedVentes, isComplete: ventesComplete } = useCountUp(totals.ventes, 1200);
  const [view, setView] = useState("table");
  const [range, setRange] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sales, setSales] = useState([]);
  const [chartSales, setChartSales] = useState([]); // For 3-month chart

  // Load chart data (since September 2025 for trophies)
  useEffect(() => {
    if (!session || !allowed) return;

    (async () => {
      const septemberStart = new Date('2025-09-01');

      const { data, error } = await supabase
        .from("Info")
        .select("*")
        .gte("created_at", septemberStart.toISOString());

      if (error) {
        console.error("chartSales error:", error);
        return;
      }

      const cleaned = (data || []).filter(
        (r) =>
          Number.isFinite(r.amount) &&
          Number.isFinite(r.mensualite) &&
          !(r.amount === 0 && r.mensualite === 0)
      );

      console.log('📊 chartSales loaded:', cleaned.length, 'sales');
      console.log('📅 Date range:', 
        cleaned.length > 0 ? new Date(cleaned[0].created_at).toLocaleDateString('fr-FR') : 'none',
        'to',
        cleaned.length > 0 ? new Date(cleaned[cleaned.length - 1].created_at).toLocaleDateString('fr-FR') : 'none'
      );

      setChartSales(cleaned);
    })();
  }, [session, allowed]);

  useEffect(() => {
    if (!session || !allowed) return;

    (async () => {
      setLoading(true);

      let query = supabase.from("Info").select("*");

      if (range !== "all" && range.match(/^\d{4}-\d{2}$/)) {
        // Specific month (format: "2025-09")
        const [year, month] = range.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      // else: "all" = no filter (all time)

      const { data, error } = await query;
      if (error) { console.error(error); setLoading(false); return; }

      const cleaned = (data || []).filter(
        (r) =>
          Number.isFinite(r.amount) &&
          Number.isFinite(r.mensualite) &&
          !(r.amount === 0 && r.mensualite === 0)
      );
      setSales(cleaned);

      const totalRev = cleaned.reduce((sum, r) => sum + Number(r.amount), 0);
      const totalCash = totalRev / 12;
      setTotals({ cash: totalCash, revenu: totalRev, ventes: cleaned.length });

      const stats = {};
      cleaned.forEach((r) => {
        const name = r.employee_name?.trim() || "Unknown";
        const amount = Number(r.amount) || 0;
        const mensu = Number(r.mensualite) || 0;
        const t = new Date(r.created_at).getTime() || 0;

        if (!stats[name]) stats[name] = { name, sales: 0, cash: 0, revenu: 0, avatar: "", _last: 0 };
        stats[name].sales += 1;
        stats[name].cash += mensu;
        stats[name].revenu += amount;

        if (t >= stats[name]._last && r.avatar_url) {
          stats[name].avatar = r.avatar_url;
          stats[name]._last = t;
        }
      });

      setRows(Object.values(stats).map(({ _last, ...rest }) => rest)
        .sort((a, b) => b.sales - a.sales || b.revenu - a.revenu || b.cash - a.cash));

      const tunnel = {};
      cleaned.forEach((r) => { const label = normalizeTunnelLabel(r.tunnel); tunnel[label] = (tunnel[label] || 0) + 1; });
      setTunnelStats(tunnel);

      setLoading(false);
    })();
  }, [range, session, allowed]);

  /* ──────────────────────────────────────────────────────────────────────────
     CHARTS
  ─────────────────────────────────────────────────────────────────────────── */

  // ── Acquisition gauge ───────────────────────────────────────────────────────
  const gauge = useMemo(() => {
    const entries = Object.entries(tunnelStats);
    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;

    const top3 = entries.sort((a,b) => b[1] - a[1]).slice(0, 3);
    
    const display = (l) => {
      if (/^ads$/i.test(l)) return "ADS";
      if (/^cc$/i.test(l)) return "CC";
      if (/link/i.test(l)) return "LinkedIn";
      return l;
    };
    
    const labels = top3.map(([l]) => display(l));
    const counts = top3.map(([,v]) => v);
    const pct = counts.map(v => (v / total) * 100);

    const colors = labels.map((lbl, i) => {
      if (lbl === "ADS") return COLORS.primary;
      if (lbl === "CC")  return COLORS.secondary;
      if (lbl === "LinkedIn") return COLORS.tertiary;
      return [COLORS.primary, COLORS.secondary, COLORS.tertiary][i] || COLORS.gray;
    });

    const tiles = labels.map((l, i) => ({
      label: l,
      pct: pct[i],
      count: counts[i],
      color: colors[i],
    }));

    const main = tiles[0] || null;

    // FIX: Créer un tableau de fond avec la même longueur que les labels
    const backgroundData = new Array(labels.length).fill(0);
    backgroundData[0] = 100; // Seulement pour créer l'arc de fond

    return {
      total,
      main,
      labels,
      pct,
      tiles,
      data: {
        labels,
        datasets: [
          { 
            label: "", // Pas de label pour éviter la pollution
            data: backgroundData, 
            backgroundColor: darkMode ? "#e5e7eb1a" : "#EEF2FF", 
            borderWidth: 0, 
            cutout: "72%", 
            rotation: -90, 
            circumference: 180 
          },
          { 
            data: pct, 
            backgroundColor: colors, 
            borderWidth: 0, 
            cutout: "72%", 
            rotation: -90, 
            circumference: 180, 
            spacing: 2 
          },
        ]
      }
    };
  }, [tunnelStats, darkMode]);

  const gaugeOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        // FIX: Ignorer le dataset de fond (index 0)
        filter: (ctx) => ctx.datasetIndex === 1,
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const value = ctx.parsed || 0;
            return `${label} : ${value.toFixed(0)}%`;
          },
        },
        backgroundColor: darkMode ? "#020617" : "#ffffff",
        titleColor: darkMode ? "#e5e7eb" : "#000000",
        bodyColor: darkMode ? "#f9fafb" : "#000000",
        borderColor: darkMode ? "#1f2937" : "#e5e7eb",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
      },
      datalabels: {
        color: "#fff",
        font: { size: 10, weight: 700 },
        formatter: (_v, ctx) => (ctx.chart.data.labels?.[ctx.dataIndex] || "").toUpperCase(),
        // FIX: N'afficher les labels que pour le dataset principal (index 1)
        display: (ctx) => (ctx.datasetIndex === 1 && ctx.dataset.data[ctx.dataIndex] > 8),
      },
    },
  }), [darkMode]);

  // ── Last 3 months comparison (CUMULATIVE) ──────────────────────────────────
  const threeMonths = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();

    const m0Start = new Date(today.getFullYear(), today.getMonth(), 1);
    const m1Start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const m2Start = new Date(today.getFullYear(), today.getMonth() - 2, 1);

    const months = [
      { key: "m0", start: m0Start },
      { key: "m1", start: m1Start },
      { key: "m2", start: m2Start },
    ];

    const makeEmpty31 = () => Array.from({ length: 31 }, () => 0);
    const series = { m0: makeEmpty31(), m1: makeEmpty31(), m2: makeEmpty31() };

    for (const r of chartSales) {
      const d = new Date(r.created_at);
      const amt = Number(r.amount) || 0;

      for (const m of months) {
        const start = m.start;
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

        if (d >= start && d <= end) {
          const dayIndex = d.getDate() - 1;
          series[m.key][dayIndex] += amt;
          break;
        }
      }
    }

    // Convert to cumulative
    const toCumulative = (arr) =>
      arr.reduce((acc, value, idx) => {
        acc[idx] = (idx === 0 ? 0 : acc[idx - 1]) + value;
        return acc;
      }, []);

    const m0Cum = toCumulative(series.m0);
    const m1Cum = toCumulative(series.m1);
    const m2Cum = toCumulative(series.m2);

    const todayIndex = currentDay - 1;

    const sumUpTo = (arr) => arr.slice(0, currentDay).reduce((a, b) => a + b, 0);

    const sums = {
      m0: sumUpTo(series.m0),
      m1: sumUpTo(series.m1),
      m2: sumUpTo(series.m2),
    };

    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
    const monthNames = {
      m0: monthFormatter.format(m0Start),
      m1: monthFormatter.format(m1Start),
      m2: monthFormatter.format(m2Start),
    };

    const data = {
      labels,
      datasets: [
        {
          label: `${monthNames.m2.toUpperCase()} (N-2)`,
          data: m2Cum.slice(0, daysInMonth),
          borderColor: COLORS.gray,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `${monthNames.m1.toUpperCase()} (N-1)`,
          data: m1Cum.slice(0, daysInMonth),
          borderColor: COLORS.secondary,
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `${monthNames.m0.toUpperCase()} (N)`,
          data: m0Cum.slice(0, daysInMonth),
          borderColor: COLORS.primary,
          backgroundColor: "transparent",
          borderWidth: 3,
          tension: 0.45,
          pointRadius: labels.map((_, i) => (i === todayIndex ? 4 : 0)),
          pointHoverRadius: 6,
          fill: false,
        },
      ],
    };

    return { data, sums, monthNames, currentDay };
  }, [chartSales, darkMode]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    animation: { duration: 250 },
    layout: { padding: { top: 8, bottom: 12, left: 8, right: 8 } },
    plugins: {
      title: { display: false },
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed.y || 0;
            return `${ctx.dataset.label} : ${value.toLocaleString("fr-FR")} € cumulés`;
          },
        },
        backgroundColor: darkMode ? "#020617" : "#ffffff",
        titleColor: darkMode ? "#e5e7eb" : "#000000",
        bodyColor: darkMode ? "#f9fafb" : "#000000",
        borderColor: darkMode ? "#1f2937" : "#e5e7eb",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
      },
      datalabels: { display: false },
    },
    interaction: { mode: "index", intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        grace: "5%",
        ticks: {
          font: { size: 11 },
          callback: (v) => `${Number(v).toLocaleString("fr-FR")} €`,
          color: darkMode ? "#9ba3af" : "#4b5563",
        },
        grid: {
          color: darkMode ? "rgba(148, 163, 184, 0.15)" : "rgba(209, 213, 219, 0.5)",
        },
      },
      x: {
        ticks: {
          font: { size: 10 },
          padding: 6,
          color: darkMode ? "#9ba3af" : "#4b5563",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
        },
        grid: { display: false },
      },
    },
    elements: {
      line: {
        borderCapStyle: "round",
        borderJoinStyle: "round",
      },
      point: {
        radius: 0,
        hoverRadius: 5,
        hitRadius: 10,
      },
    },
  }), [darkMode]);

  const prev = threeMonths.sums.m1;
  const deltaAbs = threeMonths.sums.m0 - prev;
  const deltaPct = prev ? (deltaAbs / prev) * 100 : null;

  // Trophy system - Monthly winners since September 2025
  const calculateTrophies = useMemo(() => {
    console.log('🏆 calculateTrophies called with chartSales length:', chartSales?.length);
    
    if (!chartSales || chartSales.length === 0) {
      console.log('⚠️ No chartSales data!');
      return {};
    }

    const trophyCount = {};
    const startDate = new Date('2025-09-01'); // September 2025
    const today = new Date();

    // Get all COMPLETE months from September 2025 to last month
    const months = [];
    let current = new Date(startDate);
    
    // Get the first day of current month
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    while (current < currentMonthStart) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    console.log('📅 Months to check for trophies:', months.map(m => 
      m.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ));

    // For each complete month, find the winner
    months.forEach(monthStart => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const monthName = monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      console.log(`\n🔍 Checking ${monthName}`);
      console.log(`   Date range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
      
      // Filter sales for this specific month
      const monthSales = chartSales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        const isInRange = saleDate >= monthStart && saleDate <= monthEnd;
        return isInRange;
      });

      console.log(`   Found ${monthSales.length} sales`);

      // Log first few sales for debugging
      if (monthSales.length > 0) {
        console.log(`   Sample sales:`, monthSales.slice(0, 3).map(s => ({
          name: s.employee_name,
          date: new Date(s.created_at).toLocaleDateString('fr-FR')
        })));
      }

      // Count sales per person
      const salesByPerson = {};
      monthSales.forEach(sale => {
        const name = sale.employee_name?.trim() || "Unknown";
        salesByPerson[name] = (salesByPerson[name] || 0) + 1;
      });

      console.log('   Sales by person:', salesByPerson);

      // Find winner (most sales)
      let maxSales = 0;
      let winner = null;
      Object.entries(salesByPerson).forEach(([name, count]) => {
        if (count > maxSales) {
          maxSales = count;
          winner = name;
        }
      });

      // Award trophy to winner
      if (winner && maxSales > 0) {
        trophyCount[winner] = (trophyCount[winner] || 0) + 1;
        console.log(`   🏆 Winner: ${winner} with ${maxSales} sales`);
      }
    });

    // Check for name variations
    const allNames = [...new Set(chartSales.map(s => s.employee_name?.trim()))];
    console.log('👥 All employee names in chartSales:', allNames);

    console.log('🏆 Final trophy count:', trophyCount);
    return trophyCount;
  }, [chartSales]);

  // ── Team stats ──────────────────────────────────────────────────────────────
  const teamStats = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const byName = new Map(rows.map((r) => [r.name, r]));

    const teams = TEAMS.map((t) => {
      const people = [t.captain, ...t.members];
      let ventes = 0;
      let revenu = 0;

      people.forEach((p) => {
        const r = byName.get(p);
        if (r) {
          ventes += r.sales;
          revenu += r.revenu;
        }
      });

      return { ...t, ventes, revenu };
    });

    const totalRevenu = teams.reduce((s, t) => s + t.revenu, 0) || 1;
    const bestRevenu = Math.max(...teams.map((t) => t.revenu), 0) || 1;
    const MAX_DOTS = 24;

    return teams
      .map((t) => ({
        ...t,
        share: (t.revenu / totalRevenu) * 100,
        dots: Math.max(1, Math.round((t.revenu / bestRevenu) * MAX_DOTS)),
      }))
      .sort((a, b) => b.revenu - a.revenu) // classement
      .map((t, index) => ({ ...t, rank: index + 1 }));
  }, [rows]);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (authChecking) return <p style={{ padding: 24 }}>Checking auth…</p>;

  if (!session || !allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", background: darkMode ? "#0f1419" : "#f9fafb" }}>
        <div style={{ textAlign: "center", maxWidth: 400, width: "100%", padding: "0 20px" }}>
          <img src={myLogo} alt="" style={{ width: 64, height: 64, marginBottom: 12, borderRadius: 12 }} />
          <h2 style={{ marginBottom: 8, fontSize: 24, fontWeight: 700, color: darkMode ? "#f1f3f5" : "#000" }}>Accès sécurisé</h2>
          <p style={{ opacity: .7, marginBottom: 24, fontSize: 14, color: darkMode ? "#9ba3af" : "#666" }}>
            Connectez-vous pour accéder au dashboard
          </p>

          {!showAdminLogin ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={loginWithSlack}
                disabled={loggingIn}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: `1px solid ${darkMode ? "#3f4451" : "#d1d5db"}`,
                  background: darkMode ? "#252932" : "#fff",
                  color: darkMode ? "#e7e9ea" : "#000",
                  cursor: loggingIn ? "not-allowed" : "pointer",
                  opacity: loggingIn ? .7 : 1,
                  fontSize: 15,
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => !loggingIn && (e.target.style.background = darkMode ? "#2d323d" : "#f9fafb")}
                onMouseOut={(e) => (e.target.style.background = darkMode ? "#252932" : "#fff")}
              >
                {loggingIn ? "Redirection…" : "🔐 Connectez-vous via Slack"}
              </button>

              <button
                onClick={() => setShowAdminLogin(true)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: darkMode ? "#9ba3af" : "#6b7280",
                  textDecoration: "underline",
                  transition: "color 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.color = darkMode ? "#e7e9ea" : "#111")}
                onMouseOut={(e) => (e.target.style.color = darkMode ? "#9ba3af" : "#6b7280")}
              >
                Connexion Admin
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} style={{ textAlign: "left" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: darkMode ? "#f1f3f5" : "#374151" }}>
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? "#3f4451" : "#d1d5db"}`,
                    background: darkMode ? "#252932" : "#fff",
                    color: darkMode ? "#e7e9ea" : "#000",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                  onBlur={(e) => (e.target.style.borderColor = darkMode ? "#3f4451" : "#d1d5db")}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: darkMode ? "#f1f3f5" : "#374151" }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? "#3f4451" : "#d1d5db"}`,
                    background: darkMode ? "#252932" : "#fff",
                    color: darkMode ? "#e7e9ea" : "#000",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                  onBlur={(e) => (e.target.style.borderColor = darkMode ? "#3f4451" : "#d1d5db")}
                />
              </div>

              {adminError && (
                <div style={{
                  padding: "10px 12px",
                  marginBottom: 16,
                  borderRadius: 8,
                  background: darkMode ? "rgba(239, 68, 68, 0.15)" : "#fee",
                  color: darkMode ? "#f87171" : "#c00",
                  fontSize: 13,
                  border: `1px solid ${darkMode ? "rgba(239, 68, 68, 0.3)" : "#fcc"}`,
                }}>
                  {adminError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminError("");
                    setAdminUsername("");
                    setAdminPassword("");
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? "#3f4451" : "#d1d5db"}`,
                    background: darkMode ? "#252932" : "#fff",
                    color: darkMode ? "#e7e9ea" : "#000",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    transition: "background 0.2s",
                  }}
                  onMouseOver={(e) => (e.target.style.background = darkMode ? "#2d323d" : "#f9fafb")}
                  onMouseOut={(e) => (e.target.style.background = darkMode ? "#252932" : "#fff")}
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: COLORS.primary,
                    color: "#fff",
                    cursor: adminLoading ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: adminLoading ? 0.7 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {adminLoading ? "Connexion…" : "Se connecter"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Pull-to-refresh handlers
  const handlePullStart = (e) => {
    // Only allow pull from top of totals area
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    pullStartY.current = clientY;
    setIsPulling(true);
  };

  const handlePullMove = (e) => {
    if (!isPulling || isRefreshing) return;

    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const distance = clientY - pullStartY.current;

    // Only pull down (positive distance)
    if (distance > 0) {
      e.preventDefault();
      // RÉDUIT: Moins de résistance, distance max 70px au lieu de 120px
      const resistance = Math.min(distance * 0.4, 70);
      setPullDistance(resistance);
    }
  };

  const handlePullEnd = async () => {
    if (!isPulling) return;

    setIsPulling(false);

    // If pulled far enough, trigger refresh
    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      
      // Refresh the page data
      try {
        // Reload the current data by re-running the effect
        window.location.reload();
      } catch (error) {
        console.error('Refresh error:', error);
      }
    }

    // Reset pull distance with animation
    setPullDistance(0);
  };

  return (
    <div style={{ 
      padding: 0, 
      fontFamily: "sans-serif",
      background: darkMode ? "#000000" : "#f5f5f7",
      minHeight: "100vh"
    }}>
      <div className="board-frame">
        {/* Boutons en haut à droite - NOUVEL ORDRE */}

        {/* Navigation principale - LIGNE DU HAUT */}
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
          {/* Gauche: Tableaux + Charts + Select */}
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-md)',
            alignItems: 'center' 
          }}>
            <button 
              className={`toggle-btn ${view === "table" ? "active" : ""}`} 
              onClick={() => setView("table")}
            >
              Tableaux
            </button>
            <button 
              className={`toggle-btn ${view === "charts" ? "active" : ""}`} 
              onClick={() => setView("charts")}
            >
              Charts
            </button>
            <select 
              value={range} 
              onChange={(e) => setRange(e.target.value)} 
              className="range-select"
              style={{ 
                padding: "8px 14px",
                paddingRight: "32px",
                borderRadius: "12px",
                border: `1px solid ${darkMode ? "#3a3a3c" : "#e5e5e5"}`, 
                background: darkMode ? "#2c2c2e" : "#ffffff", 
                color: darkMode ? "#f5f5f7" : "#1d1d1f",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              {(() => {
                const options = [];
                const startDate = new Date('2025-09-01');
                const today = new Date();
                
                // Generate months in REVERSE order (newest first)
                const months = [];
                const current = new Date(startDate);
                
                // FIX: Comparer uniquement année + mois (ignorer le jour)
                const currentYearMonth = today.getFullYear() * 100 + today.getMonth();
                
                while (true) {
                  const year = current.getFullYear();
                  const month = current.getMonth();
                  const iterYearMonth = year * 100 + month;
                  
                  // Stop si on dépasse le mois actuel
                  if (iterYearMonth > currentYearMonth) break;
                  
                  const monthName = new Intl.DateTimeFormat('fr-FR', { 
                    month: 'long', 
                    year: 'numeric' 
                  }).format(current);
                  
                  const value = `${year}-${String(month + 1).padStart(2, '0')}`;
                  
                  months.unshift({
                    value,
                    label: monthName.charAt(0).toUpperCase() + monthName.slice(1)
                  });
                  
                  current.setMonth(current.getMonth() + 1);
                }
                
                // Add month options
                months.forEach(m => {
                  options.push(
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  );
                });
                
                // Add "All time" at the end
                options.push(
                  <option key="all" value="all">
                    All time
                  </option>
                );
                
                return options;
              })()}
            </select>
          </div>

          {/* Droite: Dark Mode + Monitoring + Déconnexion + NDA */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 'var(--space-md)',
            alignItems: 'flex-end'
          }}>
            {/* Ligne 1: Dark Mode + Monitoring + Déconnexion */}
            <div style={{ 
              display: 'flex', 
              gap: 'var(--space-md)',
              alignItems: 'center' 
            }}>
              {/* Dark Mode Toggle */}
              <img
                src={darkMode ? darkIcon : lightIcon}
                alt={darkMode ? "Dark mode" : "Light mode"}
                onClick={() => setDarkMode(!darkMode)}
                title={darkMode ? "Mode clair" : "Mode sombre"}
                style={{
                  width: '80px',
                  height: 'auto',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              />

              {isAdminUser && (
                <button 
                  className="export-btn" 
                  onClick={() => navigate("/admin/leads")}
                >
                  📊 Monitoring
                </button>
              )}
              
              <button 
                className="export-btn" 
                onClick={logout} 
                title="Sign out"
              >
                Déconnexion
              </button>
            </div>

            {/* Ligne 2: NDA Button */}
            <button 
              className="export-btn nda-btn-primary"
              onClick={() => navigate("/contracts/new")}
              style={{
                marginTop: '-25px'  // Negative value moves it UP (closer to Déconnexion)
              }}
            >
              📄 NDA
            </button>
          </div>
        </div>


        {/* Title bar - FIXE (pas de pull-to-refresh) */}
        <div className="title-bar">
          <img 
            src={darkMode ? myLogoDark : myLogo} 
            className="title-logo" 
            alt="logo" 
          />
          <h1 className="leaderboard-title">Suivi des ventes</h1>
        </div>

        {/* Pull-to-refresh area: SEULEMENT TOTAUX */}
        <div 
          className="pull-refresh-area"
          onMouseDown={handlePullStart}
          onMouseMove={handlePullMove}
          onMouseUp={handlePullEnd}
          onMouseLeave={handlePullEnd}
          onTouchStart={handlePullStart}
          onTouchMove={handlePullMove}
          onTouchEnd={handlePullEnd}
          style={{
            transform: `translateY(${pullDistance}px)`,
            transition: isPulling ? 'none' : 'transform 0.3s ease-out',
            cursor: isPulling ? 'grabbing' : 'grab',
            userSelect: 'none',
            position: 'relative',
            paddingTop: pullDistance > 0 ? '30px' : '0', // Espace pour l'indicateur
          }}
        >
          {/* Refresh indicator - PLUS PETIT */}
          {pullDistance > 0 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 20,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
              transition: 'opacity 0.2s'
            }}>
              {pullDistance >= PULL_THRESHOLD ? '🔄' : '⬇️'}
            </div>
          )}

          <div className="totals-block">
            <div className="totals-row">
              <div className="money-float-container">
                <span className="totals-label">Total Cash</span><br />
                <span className="totals-value cash dot-boost">
                  {animatedCash.toLocaleString("fr-FR")} €
                </span>
                {cashComplete && <span className="money-emoji">💸</span>}
              </div>
              
              <div className="money-float-container">
                <span className="totals-label">Total Revenu</span><br />
                <span className="totals-value revenu dot-boost">
                  {animatedRevenu.toLocaleString("fr-FR")} €
                </span>
                {revenuComplete && <span className="money-emoji">💰</span>}
              </div>
            </div>
            
            <div className="money-float-container" style={{ display: 'inline-block' }}>
              <div className="totals-sales dot-boost">Total ventes: {animatedVentes}</div>
              {ventesComplete && <span className="money-emoji">🎉</span>}
            </div>
          </div>
        </div>

        {loading && <p>Loading…</p>}
        {!loading && rows.length === 0 && <p>Aucune vente ce mois-ci pour l'instant.</p>}

        {view === "table" && !loading && rows.length > 0 && (
          <div className="leaderboard-wrapper">
            <table className="leaderboard">
              <thead><tr><th>#</th><th>Name</th><th align="center">Sales</th><th align="right">Revenu €</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr 
                    key={r.name}
                    onClick={() => navigate(`/employee/${encodeURIComponent(r.name)}`, { state: { avatar: r.avatar, ventes: r.sales, cash: r.cash, revenu: r.revenu }})}
                  >
                    <td>
                      {i === 0 ? (
                        <img src={firstPlace} alt="1st" style={{ width: 28, height: 28 }} />
                      ) : i === 1 ? (
                        <img src={secondPlace} alt="2nd" style={{ width: 28, height: 28 }} />
                      ) : i === 2 ? (
                        <img src={thirdPlace} alt="3rd" style={{ width: 28, height: 28 }} />
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="name-cell">
                      <img src={r.avatar} className="avatar" alt="" /> 
                      <span>{r.name}</span>
                      {calculateTrophies[r.name] > 0 && (
                        <div className="trophy-container">
                          <img 
                            src={trophyIcon} 
                            alt="Trophy" 
                            className="trophy-icon"
                          />
                          {calculateTrophies[r.name] > 1 && (
                            <span className="trophy-count">×{calculateTrophies[r.name]}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td align="center">{r.sales}</td>
                    <td align="right">{r.revenu.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "charts" && !loading && (
          <div className="charts-wrapper">
            {/* FIX: Utiliser les mêmes classes que la carte KPI */}
            <div className="chart-card kpi-card chart--gauge">
              <div className="gauge-header">
                <div className="gauge-title">Tunnel d'acquisition</div>
                <div className="gauge-subtitle">
                  Top 3 canaux – {gauge.total} dossiers
                </div>
              </div>

              <Doughnut data={gauge.data} options={gaugeOptions} />

              <div className="gauge-sep" />
              <div className="gauge-tiles">
                {gauge.tiles.map((t) => (
                  <div key={t.label} className="gauge-tile">
                    <span className="tile-dot" style={{ background: t.color }} />
                    <div className="tile-text">
                      <div className="tile-label">{t.label}</div>
                      <div className="tile-value">
                        {Math.round(t.pct)}% <span className="tile-count">({t.count} dossiers)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card chart--weeks kpi-card">
              <div className="chart-header kpi-header">
                <div>
                  <div className="kpi-label">
                    Revenu cumulé&nbsp;({threeMonths.monthNames.m0.toUpperCase()} – N)
                  </div>
                  <div className="kpi-value">
                    {threeMonths.sums.m0.toLocaleString("fr-FR")} €
                  </div>
                  <div className="kpi-sub">
                    Comparé aux {threeMonths.currentDay} premiers jours de{" "}
                    {threeMonths.monthNames.m1.toUpperCase()} (N-1)
                  </div>
                </div>
                <TrendBadge deltaAbs={deltaAbs} deltaPct={deltaPct} />
              </div>

              <div className="chart-title-small">
                Performance des 3 derniers mois (revenu cumulé €/jour)
              </div>

              <div className="chart-body chart-body--glass">
                <Line data={threeMonths.data} options={lineOptions} />
              </div>

              <div className="chart-key">
                <span className="key">
                  <i className="dot" style={{ background: COLORS.gray }} />{" "}
                  {threeMonths.monthNames.m2.toUpperCase()} (N-2)
                </span>
                <span className="key">
                  <i className="dot" style={{ background: COLORS.secondary }} />{" "}
                  {threeMonths.monthNames.m1.toUpperCase()} (N-1)
                </span>
                <span className="key current">
                  <i className="dot" style={{ background: COLORS.primary }} />{" "}
                  {threeMonths.monthNames.m0.toUpperCase()} (N)
                </span>
              </div>

              <div className="chart-footnote">
                Lecture : chaque courbe représente le <strong>CA cumulé</strong> jour par jour.
                On compare les {threeMonths.currentDay} premiers jours de chaque mois
                (N, N-1, N-2).
              </div>
            </div>

            {teamStats.length > 0 && (
              <div className="chart-card kpi-card team-card">
                <div className="team-header">
                  <div className="team-title">Performance par équipe commerciale</div>
                  <div className="team-subtitle">
                    Classement par CA {range === "all" ? "toutes périodes confondues" : "du mois sélectionné"}
                  </div>
                </div>

                <div className="team-grid">
                  {teamStats.map((team) => (
                    <div className="team-col" key={team.id}>
                      <div className="team-rank">#{team.rank}</div>
                      <div className="team-captain">Équipe {team.captain}</div>

                      <div className="team-meta">
                        {team.revenu.toLocaleString("fr-FR")} € · {Math.round(team.share)} %
                      </div>

                      <div className="team-dots">
                        {(() => {
                          const totalDots = 24;
                          const cols = 6;
                          const rows = 4;
                          const filledDots = team.dots;
                          
                          // Créer le pattern de silhouette organique
                          // Les colonnes du bas sont toujours pleines, on "coupe" le haut
                          const getDotsForRow = (rowIndex) => {
                            const bottomRows = Math.floor(filledDots / cols);
                            
                            if (rowIndex >= rows - bottomRows) {
                              // Rangées du bas : toutes les colonnes remplies
                              return cols;
                            } else if (rowIndex === rows - bottomRows - 1) {
                              // Rangée de transition : nombre partiel
                              return filledDots % cols;
                            }
                            // Rangées du haut : vides
                            return 0;
                          };

                          const dots = [];
                          for (let row = 0; row < rows; row++) {
                            const dotsInRow = getDotsForRow(row);
                            for (let col = 0; col < cols; col++) {
                              const isFilled = col < dotsInRow;
                              dots.push(
                                <span
                                  key={`${row}-${col}`}
                                  className={`team-dot ${isFilled ? 'team-dot--filled' : ''}`}
                                  style={isFilled ? { background: team.color } : undefined}
                                />
                              );
                            }
                          }
                          return dots;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}