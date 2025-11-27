import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import myLogo from "../assets/my_image.png";

import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Pie, Line } from "react-chartjs-2";
import "../index.css";

Chart.register(ChartDataLabels);

// Optional workspace lock (leave empty to allow any)
const REQUIRED_TEAM = import.meta.env.VITE_SLACK_TEAM_ID || "";

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

// Normalize acquisition channels to canonical labels (case/accents/aliases)
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

// ISO week helpers
function startOfISOWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7; // Sun→7
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const DOW_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
  const isUp = deltaAbs > 0, isDown = deltaAbs < 0;
  const ref = useRef(null);
  useAutoFit(ref, { max: 240, minFont: 12, maxFont: 16, step: 0.5 });

  return (
    <div
      ref={ref}
      className={`trend-badge ${isUp ? "trend-up" : isDown ? "trend-down" : "trend-flat"}`}
      title="Comparaison semaine en cours vs semaine précédente"
    >
      <span className="row">
        {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(deltaAbs).toLocaleString("fr-FR")} €
      </span>
      <span className="row">({Math.abs(deltaPct).toFixed(2)}%)</span>
    </div>
  );
}

/** Static visual key for the 3 weeks (so users know which one is current). */
function WeekKey() {
  return (
    <div className="chart-key" aria-label="Légende des semaines">
      <span className="key"><i className="dot dot-w2" /> Semaine -2</span>
      <span className="key"><i className="dot dot-w1" /> Semaine -1</span>
      <span className="key current"><i className="dot dot-w0" /> Semaine en cours</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */
export default function Leaderboard() {
  const navigate = useNavigate();

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

  // Check for admin session on mount FIRST
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
      // Skip if admin is already logged in
      const adminSession = localStorage.getItem("admin_session");
      if (adminSession) {
        try {
          const parsed = JSON.parse(adminSession);
          if (parsed?.user?.user_metadata?.role === "admin") {
            return; // Admin already authenticated
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
      // Check admin session first
      const adminSession = localStorage.getItem("admin_session");
      if (adminSession) {
        try {
          const parsed = JSON.parse(adminSession);
          if (parsed?.user?.user_metadata?.role === "admin") {
            return; // Keep admin session
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
      // Create a mock session for admin
      const adminSession = {
        user: {
          id: "admin-user",
          email: "paul@company.com",
          user_metadata: { name: "Paul Faucomprez", role: "admin" },
        },
        access_token: "admin-token",
      };

      // Store in localStorage
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
      // Remove admin session
      localStorage.removeItem("admin_session");
      
      // Supabase logout
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
  const [sales, setSales] = useState([]); // cleaned rows

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

  const exportToExcel = () => {
    const wsData = rows.map((r, i) => ({
      Position: ["🥇", "🥈", "🥉"][i] || i + 1,
      Nom: r.name,
      Ventes: r.sales,
      "Cash €/mois": r.cash,
      "Revenu €": r.revenu,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout]), "leaderboard.xlsx");
  };

  /* ──────────────────────────────────────────────────────────────────────────
     CHARTS
  ─────────────────────────────────────────────────────────────────────────── */

  // ── Acquisition gauge (Screen 2) ───────────────────────────────────────────
  const gauge = useMemo(() => {
    const entries = Object.entries(tunnelStats);
    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;

    // take top 3 channels
    const top3 = entries.sort((a,b) => b[1] - a[1]).slice(0, 3);
    const display = (l) => {
      if (/^ads$/i.test(l)) return "ADS";
      if (/^cc$/i.test(l)) return "CC";
      if (/link/i.test(l)) return "LKND";
      return l;
    };
    const labels = top3.map(([l]) => display(l));
    const counts = top3.map(([,v]) => v);
    const pct = counts.map(v => (v / total) * 100);

    // palette faithful to your mock (blue → light blue → light gray)
    const colors = labels.map((lbl, i) => {
      if (lbl === "ADS") return "#3b5bff";
      if (lbl === "CC")  return "#35bdf4";
      if (lbl === "LKND") return "#E5E7EB";
      return ["#3b5bff", "#35bdf4", "#E5E7EB"][i] || "#E5E7EB";
    });

    return {
      labels,
      pct,
      tiles: labels.map((l, i) => ({ label: l, pct: pct[i], color: colors[i] })),
      data: {
        labels,
        datasets: [
          // background track
          { data: [100], backgroundColor: "#F3F4F6", borderWidth: 0, cutout: "72%", rotation: -90, circumference: 180 },
          // actual values
          { data: pct, backgroundColor: colors, borderWidth: 0, cutout: "72%", rotation: -90, circumference: 180, spacing: 2 },
        ]
      }
    };
  }, [tunnelStats]);

  const gaugeOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Tunnel d'acquisition", color: "#111", font: { size: 18, weight: "700" }, padding: { bottom: 8 } },
      datalabels: {
        // Small labels on the arc (ADS / CC / LKND) like the mock
        color: "#fff",
        font: { size: 10, weight: 700 },
        formatter: (_v, ctx) => (ctx.chart.data.labels?.[ctx.dataIndex] || "").toUpperCase(),
        display: (ctx) => (ctx.datasetIndex === 1 && ctx.dataset.data[ctx.dataIndex] > 8), // hide tiny slices
      },
    },
  }), []);

  // ── Last 3 ISO weeks lines + trend badge ──────────────────────────────────
  const threeWeeks = useMemo(() => {
    const today = new Date();
    const w0Start = startOfISOWeek(today);
    const w1Start = addDays(w0Start, -7);
    const w2Start = addDays(w0Start, -14);

    // Calculate current day of week (0=Mon, 6=Sun)
    const currentDayOfWeek = ((today.getDay() || 7) - 1);

    const weeks = [
      { key: "w0", start: w0Start },
      { key: "w1", start: w1Start },
      { key: "w2", start: w2Start },
    ];
    const makeEmpty7 = () => Array.from({ length: 7 }, () => 0);
    const series = { w0: makeEmpty7(), w1: makeEmpty7(), w2: makeEmpty7() };

    for (const r of sales) {
      const d = new Date(r.created_at);
      const amt = Number(r.amount) || 0;
      for (const w of weeks) {
        const start = w.start, end = addDays(start, 7);
        if (d >= start && d < end) {
          const dayIndex = ((d.getDay() || 7) - 1); // Mon..Sun → 0..6
          series[w.key][dayIndex] += amt;
          break;
        }
      }
    }

    // Only sum up to the current day of the week for fair comparison
    const sumUpToCurrentDay = (arr) => {
      return arr.slice(0, currentDayOfWeek + 1).reduce((a, b) => a + b, 0);
    };
    
    const sums = { 
      w0: sumUpToCurrentDay(series.w0), 
      w1: sumUpToCurrentDay(series.w1), 
      w2: sumUpToCurrentDay(series.w2) 
    };

    const data = {
      labels: DOW_FR,
      datasets: [
        { label: "Semaine -2", data: series.w2, borderWidth: 2, borderColor: "rgba(107,114,128,1)", backgroundColor: "rgba(107,114,128,0.16)", tension: 0.35, pointRadius: 2, fill: true },
        { label: "Semaine -1", data: series.w1, borderWidth: 2, borderColor: "rgba(239,68,68,1)",  backgroundColor: "rgba(239,68,68,0.14)",  tension: 0.35, pointRadius: 2, fill: true },
        { label: "Semaine en cours", data: series.w0, borderWidth: 3, borderColor: "rgba(29,78,216,1)",  backgroundColor: "rgba(29,78,216,0.12)",  tension: 0.35, pointRadius: 3, fill: true },
      ],
    };

    return { data, sums };
  }, [sales]);

  const line3Options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    animation: { duration: 200 },
    layout: { padding: { top: 4, bottom: 18 } },
    plugins: {
      title: { display: false },
      legend: { display: false }, // no clickable legend
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("fr-FR")} €` },
      },
      datalabels: { display: false },
    },
    interaction: { mode: "index", intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        grace: "3%",
        ticks: { font: { size: 11 }, callback: (v) => `${Number(v).toLocaleString("fr-FR")} €` },
        grid: { color: "rgba(0,0,0,0.06)" },
      },
      x: { ticks: { font: { size: 11 }, padding: 4 }, grid: { display: false } },
    },
    elements: { point: { radius: 2, hoverRadius: 5 } },
  }), []);

  // Trend badge (current week vs last week)
  const deltaAbs = threeWeeks.sums.w0 - threeWeeks.sums.w1;
  const deltaPct = threeWeeks.sums.w1 ? (deltaAbs / threeWeeks.sums.w1) * 100 : 0;

  // Third chart (unchanged)
  const pieUnderData = useMemo(() => ({
    labels: rows.map((r) => r.name),
    datasets: [{ data: rows.map((r) => r.sales), backgroundColor: ["#9966ff","#ff9f40","#2ecc71","#e74c3c","#3498db","#f1c40f","#9b59b6","#1abc9c"].slice(0, rows.length) }],
  }), [rows]);

  const pieUnderOptions = useMemo(() => ({
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: { display: true, text: "% de ventes par commercial", color: "#111", font: { size: 16, weight: "600" } },
      legend: { display: true, position: "bottom", align: "start", labels: { boxWidth: 12, padding: 8 } },
      datalabels: {
        color: "#fff", font: { size: 12, weight: "600" }, textStrokeColor: "#000", textStrokeWidth: 2,
        formatter: (v, ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
          return Math.round((v / total) * 100) + "%";
        },
      },
    },
  }), []);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (authChecking) return <p style={{ padding: 24 }}>Checking auth…</p>;

  if (!session || !allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", background: "#f9fafb" }}>
        <div style={{ textAlign: "center", maxWidth: 400, width: "100%", padding: "0 20px" }}>
          <img src={myLogo} alt="" style={{ width: 64, height: 64, marginBottom: 12, borderRadius: 12 }} />
          <h2 style={{ marginBottom: 8, fontSize: 24, fontWeight: 700 }}>Accès sécurisé</h2>
          <p style={{ opacity: .7, marginBottom: 24, fontSize: 14 }}>
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
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: loggingIn ? "not-allowed" : "pointer",
                  opacity: loggingIn ? .7 : 1,
                  fontSize: 15,
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => !loggingIn && (e.target.style.background = "#f9fafb")}
                onMouseOut={(e) => (e.target.style.background = "#fff")}
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
                  color: "#6b7280",
                  textDecoration: "underline",
                  transition: "color 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.color = "#111")}
                onMouseOut={(e) => (e.target.style.color = "#6b7280")}
              >
                Connexion Admin
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} style={{ textAlign: "left" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
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
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
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
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
                />
              </div>

              {adminError && (
                <div style={{
                  padding: "10px 12px",
                  marginBottom: 16,
                  borderRadius: 8,
                  background: "#fee",
                  color: "#c00",
                  fontSize: 13,
                  border: "1px solid #fcc",
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
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    transition: "background 0.2s",
                  }}
                  onMouseOver={(e) => (e.target.style.background = "#f9fafb")}
                  onMouseOut={(e) => (e.target.style.background = "#fff")}
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
                    background: "#3b82f6",
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
        <button className="export-btn" onClick={() => navigate("/contracts/new")}>📄 NDA</button>

        <button className="export-btn" style={{ right: 170 }} onClick={logout} title="Sign out">
          Déconnexion
        </button>

        <div className="view-toggle">
          <button className={`toggle-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Tableaux</button>
          <button className={`toggle-btn ${view === "charts" ? "active" : ""}`} onClick={() => setView("charts")}>Charts</button>
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ marginLeft: "1rem", padding: ".35rem .6rem", borderRadius: ".5rem", border: "1px solid #d1d5db" }}>
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
            {/* New gauge card (Screen 2) */}
            <div className="chart-card chart--gauge">
              <Doughnut data={gauge.data} options={gaugeOptions} />
              <div className="gauge-sep" />
              <div className="gauge-tiles">
                {gauge.tiles.map((t) => (
                  <div key={t.label} className="gauge-tile">
                    <span className="tile-dot" style={{ background: t.color }} />
                    <div className="tile-text">
                      <div className="tile-label">{t.label}</div>
                      <div className="tile-value">{Math.round(t.pct)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3-weeks performance */}
            <div className="chart-card chart--weeks">
              <div className="chart-header">
                <div className="chart-title">Performance des 3 dernières semaines (Revenu €/jour)</div>
                <TrendBadge deltaAbs={deltaAbs} deltaPct={deltaPct} />
              </div>
              <div className="chart-body">
                <Line data={threeWeeks.data} options={line3Options} />
              </div>
              <WeekKey />
            </div>

            {/* Bottom chart kept as-is */}
            <div className="chart-card chart--full">
              <Pie data={pieUnderData} options={pieUnderOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}