import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import myLogo from "../assets/my_image.png";

import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Pie, Bar } from "react-chartjs-2";
import "../index.css";

Chart.register(ChartDataLabels);

// Optional workspace lock (leave empty to allow any)
const REQUIRED_TEAM = import.meta.env.VITE_SLACK_TEAM_ID || "";

function getSlackTeamId(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const fromMeta =
    meta.team?.id ||
    meta.slack_team_id ||
    meta["https://slack.com/team_id"];
  if (fromMeta) return fromMeta;

  const id0 = user.identities?.[0]?.identity_data;
  const fromIdentity = id0?.team?.id || id0?.team_id || id0?.workspace?.id;
  if (fromIdentity) return fromIdentity;

  const fromAppMeta =
    user.app_metadata?.team?.id || user.app_metadata?.slack_team_id;
  return fromAppMeta || "";
}

export default function Leaderboard() {
  const navigate = useNavigate();

  // ── AUTH ────────────────────────────────────────────────────────────────────
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const ses = data?.session || null;
        setSession(ses);

        if (!REQUIRED_TEAM) {
          setAllowed(Boolean(ses));
        } else {
          const tid = getSlackTeamId(ses?.user);
          setAllowed(!tid || tid === REQUIRED_TEAM); // allow if missing to avoid loops
        }
      } catch (e) {
        console.error("getSession failed:", e);
        setAllowed(!REQUIRED_TEAM);
      } finally {
        setAuthChecking(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, ses) => {
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

  const loginWithSlack = async () => {
    try {
      setLoggingIn(true);
      await supabase.auth.signInWithOAuth({
        provider: "slack_oidc",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid profile email",
        },
      });
    } finally {
      // Supabase will redirect; this just prevents double-clicks
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("signOut error:", error);
    } finally {
      // Clear local state and hard-reload home to avoid any stale memory
      setSession(null);
      setAllowed(false);
      window.location.assign("/"); // hard navigation to reset everything
    }
  };

  // ── DATA ────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [tunnelStats, setTunnelStats] = useState({});
  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table");
  const [range, setRange] = useState("month");

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

      const cleaned = data.filter((r) =>
        Number.isFinite(r.amount) &&
        Number.isFinite(r.mensualite) &&
        !(r.amount === 0 && r.mensualite === 0)
      );

      const totalRev = cleaned.reduce((sum, r) => sum + Number(r.amount), 0);
      const totalCash = totalRev / 12;
      setTotals({ cash: totalCash, revenu: totalRev, ventes: cleaned.length });

      const stats = {};
      cleaned.forEach((r) => {
        const name = r.employee_name?.trim() || "Unknown";
        const amount = Number(r.amount) || 0;
        const mensu = Number(r.mensualite) || 0;
        const t = new Date(r.created_at).getTime() || 0;

        if (!stats[name]) {
          stats[name] = { name, sales: 0, cash: 0, revenu: 0, avatar: "", _last: 0 };
        }
        stats[name].sales += 1;
        stats[name].cash += mensu;
        stats[name].revenu += amount;

        if (t >= stats[name]._last && r.avatar_url) {
          stats[name].avatar = r.avatar_url;
          stats[name]._last = t;
        }
      });

      setRows(
        Object.values(stats)
          .map(({ _last, ...rest }) => rest)
          .sort((a, b) => (b.sales - a.sales) || (b.revenu - a.revenu) || (b.cash - a.cash))
      );

      const tunnel = {};
      cleaned.forEach((r) => { tunnel[r.tunnel] = (tunnel[r.tunnel] || 0) + 1; });
      setTunnelStats(tunnel);

      const byDay = {};
      cleaned.forEach((r) => {
        const d = new Date(r.created_at);
        if ([0, 6].includes(d.getDay())) return;
        const key = d.toLocaleDateString("fr-FR");
        byDay[key] ??= { date: key, ventes: 0, cash: 0, revenu: 0 };
        byDay[key].ventes++;
        byDay[key].cash += Number(r.mensualite);
        byDay[key].revenu += Number(r.amount);
      });
      const dates = Object.keys(byDay)
        .sort((a, b) => new Date(a.split("/").reverse().join("-")) - new Date(b.split("/").reverse().join("-")))
        .slice(-6);
      setDailyData(dates.map((d) => byDay[d]));

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

  // ── Charts (unchanged) ──────────────────────────────────────────────────────
  const commonTitle = { display: true, align: "center", fullSize: true, padding: { top: 10, bottom: 10 }, color: "#000", font: { size: 16, weight: "600" } };
  const doughnutData = { labels: Object.keys(tunnelStats), datasets: [{ data: Object.values(tunnelStats), backgroundColor: ["#4d4d4d", "#1a1a1a", "#999999", "#333333"] }] };
  const doughnutOptions = { maintainAspectRatio: false, responsive: true, plugins: { title: { ...commonTitle, text: "Répartition tunnel d'acquisition" }, legend: { display: true, position: "bottom", align: "start", labels: { boxWidth: 12, padding: 8, font: { size: 12, weight: "500" } } }, datalabels: { color: "#fff", font: { size: 12, weight: "600" }, textStrokeColor: "#000", textStrokeWidth: 2, formatter: (v, ctx) => { const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1; return Math.round((v / total) * 100) + "%"; } } } };
  const barData = { labels: dailyData.map((d) => d.date), datasets: [{ label: "Cash €/mois", data: dailyData.map((d) => d.cash), backgroundColor: "rgba(153,153,153,255)" }, { label: "Revenu €", data: dailyData.map((d) => d.revenu), backgroundColor: "rgba(26,26,26,255)" }] };
  const barOptions = { maintainAspectRatio: false, responsive: true, plugins: { title: { ...commonTitle, text: "Cash & Revenu" }, legend: { position: "bottom" }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("fr-FR")} €` } } }, scales: { y: { beginAtZero: true } }, interaction: { mode: "index", intersect: false } };
  const pieUnderData = { labels: rows.map((r) => r.name), datasets: [{ data: rows.map((r) => r.sales), backgroundColor: ["#9966ff", "#ff9f40", "#2ecc71", "#e74c3c", "#3498db", "#f1c40f", "#9b59b6", "#1abc9c"].slice(0, rows.length) }] };
  const pieUnderOptions = { maintainAspectRatio: false, responsive: true, plugins: { title: { ...commonTitle, text: "% de ventes par commercial" }, legend: { display: true, position: "bottom", align: "start", labels: { boxWidth: 12, padding: 8 } }, datalabels: { color: "#fff", font: { size: 12, weight: "600" }, textStrokeColor: "#000", textStrokeWidth: 2, formatter: (v, ctx) => { const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1; return Math.round((v / total) * 100) + "%"; } } } };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (authChecking) return <p style={{ padding: 24 }}>Checking auth…</p>;

  if (!session || !allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <img src={myLogo} alt="" style={{ width: 64, height: 64, marginBottom: 12, borderRadius: 12 }} />
          <h2>Accès sécurisé</h2>
          <p style={{ opacity: .8, marginBottom: 16 }}>Connectez-vous avec Slack pour accéder au leaderboard.</p>
          <button
            onClick={loginWithSlack}
            disabled={loggingIn}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", cursor: loggingIn ? "not-allowed" : "pointer", opacity: loggingIn ? .7 : 1 }}
          >
            {loggingIn ? "Redirecting…" : "Connectez-vous via Slack"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0, fontFamily: "sans-serif" }}>
      <div className="board-frame">
        <button className="export-btn" onClick={() => navigate("/contracts/new")}>📄 NDA</button>

        {/* moved left a bit more & ensures logout works */}
        <button
          className="export-btn"
          style={{ right: 170 }}
          onClick={logout}
          title="Sign out"
        >
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
        {!loading && rows.length === 0 && <p>Aucune vente ce mois-ci pour l’instant.</p>}

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
            <div className="chart pie-container"><Doughnut data={doughnutData} options={doughnutOptions} /></div>
            <div className="chart bar-container"><Bar data={barData} options={barOptions} /></div>
            <div className="chart pie-under"><Pie data={pieUnderData} options={pieUnderOptions} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
