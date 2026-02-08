import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { Line, Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

Chart.register(ChartDataLabels);

const LIGHT_COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  danger: "#ef4444",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textTertiary: "#94a3b8",
  border: "#e2e8f0",
  background: "#f8fafc",
  cardBg: "#ffffff",
};

const DARK_COLORS = {
  primary: "#3b82f6",
  success: "#34d399",
  danger: "#f87171",
  textPrimary: "#f5f5f7",
  textSecondary: "#9ba3af",
  textTertiary: "#6b7280",
  border: "#333338",
  background: "#1a1a1e",
  cardBg: "#242428",
};

export default function AdminLeads() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const COLORS = darkMode ? DARK_COLORS : LIGHT_COLORS;

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
    if (!stats) {
      return { total: 0, byOrigin: {}, top: { origin: "Aucun", count: 0 } };
    }

    // Get today's leads count from backend
    const total = stats.today_leads || 0;

    // For today stats, we'll use the overall source breakdown as an approximation
    const byOrigin = stats.by_source || {};
    const sorted = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);
    const top = sorted[0] || ["Aucun", 0];

    return {
      total,
      byOrigin,
      top: { origin: top[0], count: top[1] },
    };
  }, [stats]);

  // Bar chart (horizontal) - Leads par origine
  const barChartData = useMemo(() => {
    const entries = monthStats.entries;
    const labels = entries.map(([origin]) => origin);
    const data = entries.map(([, count]) => count);

    // Use gradient of blue shades for cleaner look
    const blueGradient = (index, total) => {
      const opacity = 1 - (index * 0.15); // Fade from 1 to lighter
      return `rgba(59, 130, 246, ${Math.max(opacity, 0.4)})`;
    };

    return {
      labels,
      datasets: [{
        label: 'Nombre de leads',
        data,
        backgroundColor: entries.map((_, idx) => blueGradient(idx, entries.length)),
        borderWidth: 0,
        borderRadius: 8,
      }],
    };
  }, [monthStats]);

  const barOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
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
        backgroundColor: darkMode ? "#020617" : "#ffffff",
        titleColor: darkMode ? "#e5e7eb" : COLORS.textPrimary,
        bodyColor: darkMode ? "#f9fafb" : COLORS.textPrimary,
        borderColor: darkMode ? "#1f2937" : COLORS.border,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        color: darkMode ? "#e5e7eb" : COLORS.textSecondary,
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
          color: darkMode ? "#9ba3af" : COLORS.textSecondary,
          font: { size: 11 },
        },
        grid: {
          color: darkMode ? "rgba(148, 163, 184, 0.1)" : COLORS.border,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        ticks: {
          color: darkMode ? "#9ba3af" : COLORS.textPrimary,
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

      // Modern color palette - shades of blue
      const colors = [
        '#3b82f6', // Bright blue
        '#06b6d4', // Cyan
        '#8b5cf6', // Purple
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
          color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
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
        backgroundColor: darkMode ? "#020617" : "#ffffff",
        titleColor: darkMode ? "#e5e7eb" : COLORS.textPrimary,
        bodyColor: darkMode ? "#f9fafb" : COLORS.textPrimary,
        borderColor: darkMode ? "#1f2937" : COLORS.border,
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
          color: darkMode ? "#9ba3af" : COLORS.textSecondary,
          font: { size: 11 },
          callback: (value) => value.toLocaleString(),
        },
        grid: {
          color: darkMode ? "rgba(148, 163, 184, 0.1)" : COLORS.border,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      x: {
        ticks: {
          color: darkMode ? "#9ba3af" : COLORS.textSecondary,
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

  if (loading || !isAdmin) {
    return <p style={{ padding: 24 }}>Loading...</p>;
  }

  return (
    <div style={{
      padding: 0,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      background: darkMode ? "#1a1a1e" : COLORS.background,
      minHeight: "100vh",
      paddingTop: '16px'
    }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="board-frame">
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
            <h1 className="leaderboard-title" style={{ margin: 0 }}>Monitoring des Leads</h1>
          </div>

          {/* Droite: Boutons */}
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <button
              className="export-btn"
              onClick={() => fetchStats()}
              title="Refresh data"
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ height: '80px' }} /> {/* Spacer pour éviter chevauchement */}

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
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: COLORS.textTertiary,
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
                  color: COLORS.textPrimary,
                  lineHeight: 1
                }}>
                  {todayStats.total}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: COLORS.textSecondary,
                  marginTop: '8px'
                }}>
                  leads reçus
                </div>
              </div>

              <div style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: COLORS.textTertiary,
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
                  color: COLORS.textPrimary,
                  lineHeight: 1,
                  marginBottom: '8px'
                }}>
                  {todayStats.top.origin}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: COLORS.textSecondary
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
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: COLORS.textTertiary,
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
                    color: COLORS.textPrimary,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.entries[0]?.[0] || 'N/A'}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: COLORS.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontWeight: 600 }}>{monthStats.entries[0]?.[1] || 0}</span>
                    <span>leads</span>
                    <span style={{
                      color: COLORS.success,
                      fontSize: '13px',
                      fontWeight: 600
                    }}>
                      ({monthStats.entries[0] ? ((monthStats.entries[0][1] / monthStats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>

                {/* Card 2: Total ce mois */}
                <div style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: COLORS.textTertiary,
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
                    color: COLORS.textPrimary,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.total.toLocaleString()}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: COLORS.textSecondary
                  }}>
                    {monthStats.entries.length} sources actives
                  </div>
                </div>

                {/* Card 3: Moyenne par jour */}
                <div style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: COLORS.textTertiary,
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
                    color: COLORS.textPrimary,
                    marginBottom: '8px',
                    lineHeight: 1
                  }}>
                    {monthStats.avgPerDay}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: COLORS.textSecondary
                  }}>
                    leads par jour
                  </div>
                </div>

              </div>

              {/* Charts côte à côte */}
              <div className="charts-side-by-side">

                {/* GAUCHE: Bar chart horizontal */}
                <div style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                      marginBottom: '4px'
                    }}>
                      Leads par origine
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: COLORS.textSecondary
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
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                      marginBottom: '4px'
                    }}>
                      Évolution TOP 3 sources
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: COLORS.textSecondary
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
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  marginTop: '32px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                      marginBottom: '4px'
                    }}>
                      Détail des leads d'aujourd'hui
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: COLORS.textSecondary
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
                            color: COLORS.textTertiary,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>#</th>
                          <th style={{
                            width: '80px',
                            textAlign: 'center',
                            color: COLORS.textTertiary,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Heure</th>
                          <th style={{
                            width: '200px',
                            textAlign: 'left',
                            color: COLORS.textTertiary,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Nom complet</th>
                          <th style={{
                            width: '250px',
                            textAlign: 'left',
                            color: COLORS.textTertiary,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Email</th>
                          <th style={{
                            width: '140px',
                            textAlign: 'center',
                            color: COLORS.textTertiary,
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Téléphone</th>
                          <th style={{
                            width: '140px',
                            textAlign: 'center',
                            color: COLORS.textTertiary,
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
                                borderTop: `1px solid ${COLORS.border}`
                              }}>
                                <td style={{
                                  textAlign: 'center',
                                  color: COLORS.textSecondary,
                                  fontSize: '13px'
                                }}>{idx + 1}</td>
                                <td style={{
                                  textAlign: 'center',
                                  color: COLORS.textSecondary,
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}>{time}</td>
                                <td style={{
                                  textAlign: 'left',
                                  fontWeight: 600,
                                  color: COLORS.textPrimary,
                                  fontSize: '14px'
                                }}>{lead.full_name || '-'}</td>
                                <td style={{
                                  textAlign: 'left',
                                  color: COLORS.textSecondary,
                                  fontSize: '13px'
                                }}>{lead.email || '-'}</td>
                                <td style={{
                                  textAlign: 'center',
                                  color: COLORS.textSecondary,
                                  fontSize: '13px'
                                }}>{lead.phone || '-'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    background: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.08)',
                                    color: COLORS.primary,
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
      </div>
    </div>
  );
}