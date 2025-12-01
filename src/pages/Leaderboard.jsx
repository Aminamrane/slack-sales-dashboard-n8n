import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import myLogo from "../assets/my_image.png";

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
    members: ["Yanis Zaïri", "Yanis Soul", "Mourad Derradji", "Alex Gaudrillet"],
    color: COLORS.secondary, // orange
  },
  {
    id: "team2",
    label: "Équipe 2",
    captain: "Léo Mafrici",
    members: ["Mehdi BOUFFESSIL"],
    color: COLORS.primary, // indigo
  },
  {
    id: "team3",
    label: "Équipe 3",
    captain: "David",
    members: ["Aurélie Briquet"],
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
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // ── AUTH ────────────────────────────────────────────────────────────────────
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // ── ADMIN LOGIN STATE ─────────────────────────────────────────────────────
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    const storedAdminSession = localStorage.getItem("admin_session");
    if (storedAdminSession) {
      try {
        const adminSession = JSON.parse(storedAdminSession);
        if (adminSession?.user?.user_metadata?.role === "admin") {
          setSession(adminSession);
          setAllowed(true);
          setAuthChecking(false);
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
            return;
          }
        } catch (e) {
          localStorage.removeItem("admin_session");
        }
      }

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
            return;
          }
        } catch (e) {
          localStorage.removeItem("admin_session");
        }
      }

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
      window.location.assign("/");
    }
  };

  // ── DATA ────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [tunnelStats, setTunnelStats] = useState({});
  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table");
  const [range, setRange] = useState("month");
  const [sales, setSales] = useState([]);
  const [chartSales, setChartSales] = useState([]); // For 3-month chart

  // Load chart data (last 3 months minimum)
  useEffect(() => {
    if (!session || !allowed) return;

    (async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      const { data, error } = await supabase
        .from("Info")
        .select("*")
        .gte("created_at", threeMonthsAgo.toISOString());

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

      setChartSales(cleaned);
    })();
  }, [session, allowed]);

  useEffect(() => {
    if (!session || !allowed) return;

    (async () => {
      setLoading(true);

      let query = supabase.from("Info").select("*");
      if (range === "month") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        query = query.gte("created_at", start.toISOString()).lt("created_at", next.toISOString());
      }

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

  return (
    <div style={{ padding: 0, fontFamily: "sans-serif" }}>
      <div className="board-frame">
        <button 
          className="export-btn" 
          onClick={() => setDarkMode(!darkMode)}
          style={{ right: 360, display: 'none' }}
          title={darkMode ? "Mode clair" : "Mode sombre"}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        <button className="export-btn" onClick={() => navigate("/contracts/new")}>📄 NDA</button>

        <button className="export-btn" style={{ right: 170 }} onClick={logout} title="Sign out">
          Déconnexion
        </button>

        <div className="view-toggle">
          <button className={`toggle-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Tableaux</button>
          <button className={`toggle-btn ${view === "charts" ? "active" : ""}`} onClick={() => setView("charts")}>Charts</button>
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ marginLeft: "1rem", padding: ".35rem .6rem", borderRadius: ".5rem", border: `1px solid ${darkMode ? "#3f4451" : "#d1d5db"}`, background: darkMode ? "#252932" : "#fff", color: darkMode ? "#e7e9ea" : "#000" }}>
            <option value="month">Ce mois-ci</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className="title-bar">
          <img src={myLogo} className="title-logo" alt="logo" />
          <h1 className="leaderboard-title">Suivi des ventes</h1>
        </div>

        <div className="totals-block">
          <div className="totals-row">
            <div><span className="totals-label">Total Cash</span><br /><span className="totals-value cash dot-boost">{totals.cash.toLocaleString("fr-FR")} €</span></div>
            <div><span className="totals-label">Total Revenu</span><br /><span className="totals-value revenu dot-boost">{totals.revenu.toLocaleString("fr-FR")} €</span></div>
          </div>
          <div className="totals-sales dot-boost">Total ventes: {totals.ventes}</div>
        </div>

        {loading && <p>Loading…</p>}
        {!loading && rows.length === 0 && <p>Aucune vente ce mois-ci pour l'instant.</p>}

        {view === "table" && !loading && rows.length > 0 && (
          <div className="leaderboard-wrapper">
            <table className="leaderboard">
              <thead><tr><th>#</th><th>Name</th><th align="right">Sales</th><th align="right">Revenu €</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name}
                      onClick={() => navigate(`/employee/${encodeURIComponent(r.name)}`, { state: { avatar: r.avatar, ventes: r.sales, cash: r.cash, revenu: r.revenu }})}>
                    <td>{["🥇","🥈","🥉"][i] || i + 1}</td>
                    <td className="name-cell"><img src={r.avatar} className="avatar" alt="" /> {r.name}</td>
                    <td align="right">{r.sales}</td>
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
                    Classement par CA {range === "month" ? "du mois en cours" : "sur la période sélectionnée"}
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