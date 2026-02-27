import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { Line, Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import metaLogo from "../assets/meta.png";
import sysLogo from "../assets/sys.png";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

Chart.register(ChartDataLabels);

// Color constants kept outside component for chart useMemo deps
const LIGHT_ACCENT_RGB = [91, 106, 191];
const DARK_ACCENT_RGB = [124, 138, 219];

const formatPhone = (raw) => {
  if (!raw) return '-';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('33')) {
    const rest = digits.slice(2);
    return `+33 ${rest[0]} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return raw;
};

export default function AdminLeads() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const CARD = {
    bg: darkMode ? '#1e1f28' : '#ffffff',
    border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#edf0f8',
    text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af',
    subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode
      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    success: '#10b981',
    danger: '#ef4444',
  };

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
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

        // Check if user has admin or admin_leads permission
        if (user.role === 'admin' || apiClient.hasAccess('admin_leads')) {
          setIsAdmin(true);
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

    checkAdmin();
  }, [navigate]);

  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── CHALLENGE VIEW ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState("monitoring"); // "monitoring" | "challenge"
  const [challengeData, setChallengeData] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeRange, setChallengeRange] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchStats = async () => {
    setDataLoading(true);
    try {
      // Fetch stats and leads in parallel
      const [statsData, leadsData] = await Promise.all([
        apiClient.get('/api/v1/admin/leads/stats').catch(err => {
          console.error("Error fetching stats:", err);
          return null;
        }),
        apiClient.get('/api/v1/leads?page=1&limit=500').catch(err => {
          console.error("Error fetching leads:", err);
          return { leads: [], items: [], data: [] };
        })
      ]);

      console.log("📊 Stats response:", statsData);
      console.log("📊 Stats by_source keys:", statsData?.by_source ? Object.keys(statsData.by_source) : "NO by_source");
      console.log("📊 Leads response:", leadsData);

      setStats(statsData);

      // Handle different response formats for leads
      const leadsArray = leadsData?.leads || leadsData?.items || leadsData?.data || (Array.isArray(leadsData) ? leadsData : []);
      setLeads(leadsArray);
      console.log("📊 Leads set:", leadsArray.length, "items");
    } catch (err) {
      console.error("Fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  // ── CHALLENGE FETCH ─────────────────────────────────────────
  const fetchChallenge = async () => {
    setChallengeLoading(true);
    try {
      const period = challengeRange || 'current_month';
      const data = await apiClient.get(`/api/v1/monitoring/challenge?period=${period}`);
      setChallengeData(data);
    } catch (err) {
      console.error("Challenge fetch error:", err);
      if (err.message?.includes('401')) {
        navigate("/login");
      }
    } finally {
      setChallengeLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && viewMode === 'challenge') {
      fetchChallenge();
    }
  }, [isAdmin, viewMode, challengeRange]);

  // Stats from backend API (already calculated)
  const monthStats = useMemo(() => {
    if (!stats) return { total: 0, byOrigin: {}, entries: [], avgPerDay: '0.0' };

    const byOrigin = stats.by_source || {};
    const total = stats.total_leads || 0;
    const entries = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);

    // Use average per day calculated by backend (for current month)
    const avgPerDay = stats.avg_per_day?.toFixed(1) || '0.0';

    return { total, byOrigin, entries, avgPerDay };
  }, [stats]);

  const todayStats = useMemo(() => {
    // Count today's leads client-side (uses browser's local timezone, not server UTC)
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayLeads = leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= startOfToday && d < endOfToday;
    });

    const total = todayLeads.length;

    // Count by origin for today's leads
    const byOrigin = {};
    todayLeads.forEach(l => {
      const origin = l.origin || "Unknown";
      byOrigin[origin] = (byOrigin[origin] || 0) + 1;
    });

    const sorted = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);
    const top = sorted[0] || ["Aucun", 0];

    return {
      total,
      byOrigin,
      top: { origin: top[0], count: top[1] },
    };
  }, [leads]);

  // Bar chart (horizontal) - Leads par origine
  const barChartData = useMemo(() => {
    const entries = monthStats.entries;
    const labels = entries.map(([origin]) => origin);
    const data = entries.map(([, count]) => count);

    // Use gradient of accent shades for cleaner look
    const accentRGB = darkMode ? DARK_ACCENT_RGB : LIGHT_ACCENT_RGB;
    const accentGradient = (index) => {
      const opacity = 1 - (index * 0.15);
      return `rgba(${accentRGB.join(',')}, ${Math.max(opacity, 0.4)})`;
    };

    return {
      labels,
      datasets: [{
        label: 'Nombre de leads',
        data,
        backgroundColor: entries.map((_, idx) => accentGradient(idx)),
        borderWidth: 0,
        borderRadius: 8,
      }],
    };
  }, [monthStats]);

  const barOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: 90 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = monthStats.total || 1;
            const pct = ((ctx.parsed.x / total) * 100).toFixed(1);
            return `${ctx.parsed.x} leads (${pct}%)`;
          },
        },
        backgroundColor: CARD.bg,
        titleColor: CARD.text,
        bodyColor: CARD.text,
        borderColor: CARD.border,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        color: CARD.secondary,
        font: { size: 12, weight: 600 },
        formatter: (value) => {
          const total = monthStats.total || 1;
          const pct = ((value / total) * 100).toFixed(0);
          return `${value} (${pct}%)`;
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: CARD.secondary,
          font: { size: 11 },
        },
        grid: {
          color: darkMode ? 'rgba(255,255,255,0.06)' : CARD.border,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        ticks: {
          color: CARD.text,
          font: { size: 12, weight: 500 },
        },
        grid: { display: false },
        border: {
          display: false,
        },
      },
    },
  }), [darkMode, monthStats.total]);

  // Line chart - TOP 3 SEULEMENT
  const lineChartData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    // Prendre seulement le TOP 3
    const top3Origins = monthStats.entries.slice(0, 3).map(([origin]) => origin);

    const originData = {};
    leads.forEach((l) => {
      const origin = l.origin || "Unknown";
      if (!top3Origins.includes(origin)) return; // Skip si pas dans top 3

      const day = new Date(l.created_at).getDate();

      if (!originData[origin]) {
        originData[origin] = Array(daysInMonth).fill(0);
      }
      originData[origin][day - 1] += 1;
    });

    const datasets = Object.entries(originData).map(([origin, daily], idx) => {
      const cumulative = daily.reduce((acc, val, i) => {
        acc[i] = (i === 0 ? 0 : acc[i - 1]) + val;
        return acc;
      }, []);

      // Modern color palette - accent indigo + complements
      const colors = [
        CARD.accent, // Indigo accent
        '#06b6d4',   // Cyan
        '#8b5cf6',   // Purple
      ];
      const color = colors[idx];

      return {
        label: origin,
        data: cumulative,
        borderColor: color,
        backgroundColor: `${color}15`, // Very transparent fill
        borderWidth: 2.5,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
      };
    });

    return { labels, datasets };
  }, [leads, monthStats]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: CARD.text,
          font: { size: 13, weight: 600 },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} leads cumulés`,
        },
        backgroundColor: CARD.bg,
        titleColor: CARD.text,
        bodyColor: CARD.text,
        borderColor: CARD.border,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: CARD.secondary,
          font: { size: 11 },
          callback: (value) => value.toLocaleString(),
        },
        grid: {
          color: darkMode ? 'rgba(255,255,255,0.06)' : CARD.border,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      x: {
        ticks: {
          color: CARD.secondary,
          font: { size: 11 },
          maxTicksLimit: 15,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
  }), [darkMode]);

  // ── CHALLENGE: Bar chart vertical - Leads par jour (stacked Meta + Systeme.io) ──
  const challengeBarData = useMemo(() => {
    if (!challengeData?.summary?.leads_par_jour) return { labels: [], datasets: [] };
    const days = challengeData.summary.leads_par_jour;
    const leads = challengeData.leads || [];

    // Count per day per origin
    const metaByDay = {};
    const sysByDay = {};
    leads.forEach(l => {
      const d = l.date;
      if (!d) return;
      if (l.origin === 'Meta') metaByDay[d] = (metaByDay[d] || 0) + 1;
      else sysByDay[d] = (sysByDay[d] || 0) + 1;
    });

    const labels = days.map(d => d.date);
    return {
      labels,
      datasets: [
        {
          label: 'Meta',
          data: labels.map(d => metaByDay[d] || 0),
          backgroundColor: '#1877F2',
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: 'Systeme.io',
          data: labels.map(d => sysByDay[d] || 0),
          backgroundColor: '#06b6d4',
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    };
  }, [challengeData]);

  const challengeBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: CARD.text,
          font: { size: 12, weight: 600 },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} leads`,
        },
        backgroundColor: CARD.bg,
        titleColor: CARD.text,
        bodyColor: CARD.text,
        borderColor: CARD.border,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
      datalabels: {
        display: (ctx) => ctx.datasetIndex === ctx.chart.data.datasets.length - 1,
        anchor: 'end',
        align: 'top',
        color: CARD.secondary,
        font: { size: 11, weight: 600 },
        formatter: (value, ctx) => {
          // Show stacked total
          const total = ctx.chart.data.datasets.reduce((sum, ds) => sum + (ds.data[ctx.dataIndex] || 0), 0);
          return total > 0 ? total : '';
        },
      },
    },
    scales: {
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: CARD.secondary,
          font: { size: 11 },
          stepSize: 1,
        },
        grid: {
          color: darkMode ? 'rgba(255,255,255,0.06)' : CARD.border,
          drawBorder: false,
        },
        border: { display: false },
      },
      x: {
        stacked: true,
        ticks: {
          color: CARD.secondary,
          font: { size: 11 },
          maxRotation: 45,
          minRotation: 0,
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  }), [darkMode]);

  if (loading || !isAdmin) {
    return <p style={{ padding: 24 }}>Loading...</p>;
  }

  return (
    <div style={{
      padding: 0,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      background: CARD.surface,
      minHeight: "100vh",
      paddingTop: '80px',
      color: CARD.text,
    }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{
        maxWidth: 1400,
        margin: '32px auto 64px',
        padding: '18px',
        background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)',
        borderRadius: '32px',
      }}>
      <div className="board-frame" style={{ margin: 0 }}>
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
          {/* Gauche: Logo + Titre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <img
              src={darkMode ? myLogoDark : myLogo}
              alt="OWNER"
              style={{ width: 48, height: 48, borderRadius: 12 }}
            />
            <h1 className="leaderboard-title" style={{ margin: 0 }}>
              {viewMode === "challenge" ? "Challenge" : "Monitoring des Leads"}
            </h1>
          </div>

          {/* Droite: Toggle + Refresh */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex',
              background: darkMode ? '#252636' : '#eef1f6',
              borderRadius: '10px',
              padding: '3px',
              border: `1px solid ${darkMode ? '#2a2b36' : '#dfe3ed'}`,
            }}>
              {[{ key: 'monitoring', label: 'Lead' }, { key: 'challenge', label: 'Challenge' }].map(t => (
                <button
                  key={t.key}
                  onClick={() => setViewMode(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: viewMode === t.key ? (darkMode ? '#1e1f28' : '#ffffff') : 'transparent',
                    color: viewMode === t.key ? CARD.text : CARD.muted,
                    fontSize: '13px',
                    fontWeight: viewMode === t.key ? 600 : 500,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: viewMode === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => viewMode === "monitoring" ? fetchStats() : fetchChallenge()}
              title="Refresh data"
              style={{
                display: 'inline-flex', alignItems: 'center',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
                color: darkMode ? '#9ca3b8' : '#464b65',
                padding: '8px 18px',
                background: darkMode ? '#2a2b36' : '#dfdfe5',
                borderRadius: '10px',
                border: darkMode ? '1px solid #353647' : '1px solid #c3c3c3',
                borderBottom: darkMode ? '1px solid #252636' : '1px solid #a5a5a5',
                boxShadow: darkMode
                  ? 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 4px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)'
                  : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 4px #d0d1d8, 0 3px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ height: '80px' }} /> {/* Spacer pour éviter chevauchement */}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MONITORING VIEW */}
        {/* ══════════════════════════════════════════════════════════ */}
        {viewMode === "monitoring" && (
          <>
        {dataLoading && <p>Chargement des données...</p>}

        {!dataLoading && (
          <>
            {/* Stats du jour */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
              marginBottom: '32px',
              padding: '0 20px'
            }}>
              <div style={{
                background: CARD.bg,
                border: `1px solid ${CARD.border}`,
                borderRadius: '16px',
                padding: '24px',
                boxShadow: CARD.shadow
              }}>
                <div style={{
                  fontSize: '11px',
                  color: CARD.muted,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  Aujourd'hui
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: CARD.text,
                  lineHeight: 1
                }}>
                  {todayStats.total}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: CARD.secondary,
                  marginTop: '8px'
                }}>
                  leads reçus
                </div>
              </div>

              <div style={{
                background: CARD.bg,
                border: `1px solid ${CARD.border}`,
                borderRadius: '16px',
                padding: '24px',
                boxShadow: CARD.shadow
              }}>
                <div style={{
                  fontSize: '11px',
                  color: CARD.muted,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  Top origine
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: CARD.text,
                  lineHeight: 1,
                  marginBottom: '8px'
                }}>
                  {todayStats.top.origin}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: CARD.secondary
                }}>
                  {todayStats.top.count.toLocaleString()} leads
                </div>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '100%', margin: "0 auto", padding: '0 20px' }}>
              
              {/* KPI Cards - 3 cards horizontales */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                marginBottom: '32px'
              }}>

                {/* Card 1: Meilleure source */}
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: CARD.muted,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}>
                    Meilleure source
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: CARD.text,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.entries[0]?.[0] || 'N/A'}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: CARD.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontWeight: 600 }}>{monthStats.entries[0]?.[1] || 0}</span>
                    <span>leads</span>
                    <span style={{
                      color: CARD.success,
                      fontSize: '13px',
                      fontWeight: 600
                    }}>
                      ({monthStats.entries[0] ? ((monthStats.entries[0][1] / monthStats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>

                {/* Card 2: Total ce mois */}
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: CARD.muted,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}>
                    Total ce mois
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: CARD.text,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.total.toLocaleString()}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: CARD.secondary
                  }}>
                    {monthStats.entries.length} sources actives
                  </div>
                </div>

                {/* Card 3: Moyenne par jour */}
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: CARD.muted,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}>
                    Moyenne / jour
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: CARD.text,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.avgPerDay}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: CARD.secondary
                  }}>
                    leads par jour
                  </div>
                </div>

              </div>

              {/* Charts côte à côte */}
              <div className="charts-side-by-side">

                {/* GAUCHE: Bar chart horizontal */}
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: CARD.text,
                      marginBottom: '4px'
                    }}>
                      Leads par origine
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: CARD.secondary
                    }}>
                      Répartition des {monthStats.total.toLocaleString()} leads reçus ce mois
                    </div>
                  </div>

                  <div style={{ height: 450 }}>
                    <Bar data={barChartData} options={barOptions} />
                  </div>
                </div>

                {/* DROITE: Line chart (TOP 3) */}
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: CARD.text,
                      marginBottom: '4px'
                    }}>
                      Évolution TOP 3 sources
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: CARD.secondary
                    }}>
                      Leads cumulés des 3 meilleures sources
                    </div>
                  </div>

                  <div style={{ height: 450 }}>
                    <Line data={lineChartData} options={lineOptions} />
                  </div>
                </div>

              </div>

              {/* Tableau des leads du jour */}
              {todayStats.total > 0 && (
                <div style={{
                  background: CARD.bg,
                  border: `1px solid ${CARD.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  marginTop: '32px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: CARD.text,
                      marginBottom: '4px'
                    }}>
                      Détail des leads d'aujourd'hui
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: CARD.secondary
                    }}>
                      {todayStats.total} lead{todayStats.total > 1 ? 's' : ''} reçu{todayStats.total > 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="leaderboard-wrapper">
                    <table className="leaderboard" style={{ width: '100%', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{
                            width: '60px',
                            textAlign: 'center',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>#</th>
                          <th style={{
                            width: '80px',
                            textAlign: 'center',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Heure</th>
                          <th style={{
                            width: '200px',
                            textAlign: 'left',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Nom complet</th>
                          <th style={{
                            width: '250px',
                            textAlign: 'left',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Email</th>
                          <th style={{
                            width: '140px',
                            textAlign: 'center',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Téléphone</th>
                          <th style={{
                            width: '140px',
                            textAlign: 'center',
                            color: CARD.muted,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Origine</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads
                          .filter((l) => {
                            const d = new Date(l.created_at);
                            const today = new Date();
                            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                            return d >= startOfToday && d < endOfToday;
                          })
                          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                          .map((lead, idx) => {
                            const time = new Date(lead.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            });

                            return (
                              <tr key={lead.id} style={{
                                borderTop: `1px solid ${CARD.border}`
                              }}>
                                <td style={{
                                  textAlign: 'center',
                                  color: CARD.secondary,
                                  fontSize: '13px'
                                }}>{idx + 1}</td>
                                <td style={{
                                  textAlign: 'center',
                                  color: CARD.secondary,
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}>{time}</td>
                                <td style={{
                                  textAlign: 'left',
                                  fontWeight: 600,
                                  color: CARD.text,
                                  fontSize: '14px'
                                }}>{lead.full_name || '-'}</td>
                                <td style={{
                                  textAlign: 'left',
                                  color: CARD.secondary,
                                  fontSize: '13px'
                                }}>{lead.email || '-'}</td>
                                <td style={{
                                  textAlign: 'center',
                                  color: CARD.secondary,
                                  fontSize: '13px'
                                }}>{lead.phone || '-'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    background: darkMode ? `rgba(${DARK_ACCENT_RGB.join(',')}, 0.2)` : `rgba(${LIGHT_ACCENT_RGB.join(',')}, 0.08)`,
                                    color: CARD.accent,
                                  }}>
                                    {lead.origin}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </>
        )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* CHALLENGE VIEW */}
        {/* ══════════════════════════════════════════════════════════ */}
        {viewMode === "challenge" && (
          <>
            {/* Month Selector */}
            <div style={{ padding: '0 20px', marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <select
                value={challengeRange}
                onChange={(e) => setChallengeRange(e.target.value)}
                className="range-select"
                style={{
                  padding: '8px 14px',
                  paddingRight: '32px',
                  borderRadius: '12px',
                  border: `1px solid ${CARD.border}`,
                  background: CARD.bg,
                  color: CARD.text,
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {(() => {
                  const options = [];
                  const startDate = new Date('2026-02-01');
                  const today = new Date();
                  const months = [];
                  const current = new Date(startDate);
                  const currentYearMonth = today.getFullYear() * 100 + today.getMonth();
                  while (true) {
                    const year = current.getFullYear();
                    const month = current.getMonth();
                    if (year * 100 + month > currentYearMonth) break;
                    const monthName = new Intl.DateTimeFormat('fr-FR', {
                      month: 'long', year: 'numeric'
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
            </div>

            {challengeLoading && (
              <p style={{ textAlign: 'center', padding: '60px', color: CARD.secondary }}>
                Chargement des données...
              </p>
            )}

            {!challengeLoading && challengeData && (
              <>
                {/* KPI Cards - 2 columns */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '24px',
                  marginBottom: '32px',
                  padding: '0 20px'
                }}>
                  <div style={{
                    background: CARD.bg,
                    border: `1px solid ${CARD.border}`,
                    borderRadius: '12px',
                    padding: '24px'
                  }}>
                    <div style={{
                      fontSize: '11px', color: CARD.muted,
                      textTransform: 'uppercase', fontWeight: 600,
                      letterSpacing: '0.5px', marginBottom: '12px'
                    }}>Total Leads</div>
                    <div style={{
                      fontSize: '36px', fontWeight: 700,
                      color: CARD.text, lineHeight: 1
                    }}>{challengeData.summary?.total_leads ?? 0}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src={metaLogo} alt="Meta" style={{ width: 52, height: 52, objectFit: 'contain', margin: '-13px -10px -13px 0' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: CARD.secondary }}>
                          {challengeData.leads?.filter(l => l.origin === 'Meta').length ?? 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src={sysLogo} alt="Systeme.io" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: CARD.secondary }}>
                          {challengeData.leads?.filter(l => l.origin === 'Systeme.io').length ?? 0}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '13px', color: CARD.muted, marginTop: '6px'
                    }}>
                      {challengeData.start_date} — {challengeData.end_date}
                    </div>
                  </div>

                  <div style={{
                    background: CARD.bg,
                    border: `1px solid ${CARD.border}`,
                    borderRadius: '12px',
                    padding: '24px'
                  }}>
                    <div style={{
                      fontSize: '11px', color: CARD.muted,
                      textTransform: 'uppercase', fontWeight: 600,
                      letterSpacing: '0.5px', marginBottom: '12px'
                    }}>Aujourd'hui</div>
                    <div style={{
                      fontSize: '36px', fontWeight: 700,
                      color: CARD.accent, lineHeight: 1
                    }}>{challengeData.summary?.total_today ?? 0}</div>
                    <div style={{
                      fontSize: '14px', color: CARD.secondary, marginTop: '8px'
                    }}>leads reçus</div>
                  </div>
                </div>

                {/* Bar Chart - Leads par jour */}
                {challengeData.summary?.leads_par_jour?.length > 0 && (
                  <div style={{ padding: '0 20px', marginBottom: '32px' }}>
                    <div style={{
                      background: CARD.bg,
                      border: `1px solid ${CARD.border}`,
                      borderRadius: '12px',
                      padding: '24px'
                    }}>
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{
                          fontSize: '16px', fontWeight: 700,
                          color: CARD.text, marginBottom: '4px'
                        }}>Leads par jour</div>
                        <div style={{
                          fontSize: '13px', color: CARD.secondary
                        }}>
                          Distribution des {challengeData.summary?.total_leads ?? 0} leads sur la période
                        </div>
                      </div>
                      <div style={{ height: 300 }}>
                        <Bar data={challengeBarData} options={challengeBarOptions} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Leads Table */}
                {challengeData.leads && challengeData.leads.length > 0 && (
                  <div style={{
                    background: CARD.bg,
                    border: `1px solid ${CARD.border}`,
                    borderRadius: '12px',
                    padding: '24px',
                    margin: '0 20px'
                  }}>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        fontSize: '16px', fontWeight: 700,
                        color: CARD.text, marginBottom: '8px'
                      }}>Détail des leads</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', color: CARD.secondary }}>
                          {challengeData.leads.length} lead{challengeData.leads.length > 1 ? 's' : ''}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={metaLogo} alt="Meta" style={{ width: 44, height: 44, objectFit: 'contain', margin: '-14px 0' }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: CARD.secondary }}>
                            {challengeData.leads.filter(l => l.origin === 'Meta').length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={sysLogo} alt="Systeme.io" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: CARD.secondary }}>
                            {challengeData.leads.filter(l => l.origin === 'Systeme.io').length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="leaderboard-wrapper">
                      <table className="leaderboard" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                            <th style={{ width: '70px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</th>
                            <th style={{ width: '100px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                            <th style={{ textAlign: 'left', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</th>
                            <th style={{ textAlign: 'left', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                            <th style={{ width: '160px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Téléphone</th>
                            <th style={{ width: '90px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Effectif</th>
                            <th style={{ width: '100px', textAlign: 'center', color: CARD.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Places</th>
                          </tr>
                        </thead>
                        <tbody>
                          {challengeData.leads.map((lead, idx) => (
                            <tr key={lead.id || idx} style={{ borderTop: `1px solid ${CARD.border}` }}>
                              <td style={{ textAlign: 'center', color: CARD.secondary, fontSize: '13px' }}>{idx + 1}</td>
                              <td style={{ textAlign: 'center' }}>
                                <img
                                  src={lead.origin === 'Meta' ? metaLogo : sysLogo}
                                  alt={lead.origin}
                                  title={lead.origin}
                                  style={lead.origin === 'Meta'
                                    ? { width: 60, height: 60, objectFit: 'contain', verticalAlign: 'middle', margin: '-18px 0' }
                                    : { width: 26, height: 26, objectFit: 'contain', verticalAlign: 'middle' }
                                  }
                                />
                              </td>
                              <td style={{ textAlign: 'center', color: CARD.secondary, fontSize: '13px', fontWeight: 500 }}>{lead.date || '-'}</td>
                              <td style={{ textAlign: 'left', fontWeight: 600, color: CARD.text, fontSize: '14px' }}>{lead.client || '-'}</td>
                              <td style={{ textAlign: 'left', color: CARD.secondary, fontSize: '13px' }}>{lead.email || '-'}</td>
                              <td style={{ textAlign: 'center', color: CARD.secondary, fontSize: '13px', fontFamily: 'monospace' }}>{formatPhone(lead.phone)}</td>
                              <td style={{ textAlign: 'center', color: CARD.text, fontSize: '13px', fontWeight: 600 }}>{lead.nbr_headcount || '-'}</td>
                              <td style={{ textAlign: 'center', color: CARD.text, fontSize: '13px' }}>{lead.nbr_places || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {(!challengeData.leads || challengeData.leads.length === 0) && (
                  <p style={{ textAlign: 'center', padding: '60px', color: CARD.secondary }}>
                    Aucun lead pour cette période
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      </div>{/* /outer wrapper */}
    </div>
  );
}