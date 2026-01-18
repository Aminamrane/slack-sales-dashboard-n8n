import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Line, Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import myLogo from "../assets/my_image.png";
import myLogoDark from "../assets/my_image2.png";
import "../index.css";

Chart.register(ChartDataLabels);

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
  gray: "#94a3b8",
  purple: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#f472b6",
  yellow: "#fbbf24",
};

export default function AdminLeads() {
  const navigate = useNavigate();

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

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        if (session) {
          // Allow any authenticated user (admins and Slack users)
          // You can add role check here if needed: session.user?.user_metadata?.role === "admin"
          setIsAdmin(true);
        } else {
          navigate("/");
        }
      } catch (e) {
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [navigate]);

  const [leads, setLeads] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchLeads = async () => {
    setDataLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data, error } = await supabase
        .from("leads_realtime")
        .select("*")
        .gte("created_at", startOfMonth.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching leads:", error);
      } else {
        setLeads(data || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLeads();
    }
  }, [isAdmin]);

  const todayStats = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayLeads = leads.filter((l) => {
      const d = new Date(l.created_at);
      return d >= startOfToday && d < endOfToday;
    });

    const byOrigin = {};
    todayLeads.forEach((l) => {
      const origin = l.origin || "Unknown";
      byOrigin[origin] = (byOrigin[origin] || 0) + 1;
    });

    const sorted = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);
    const top = sorted[0] || ["Aucun", 0];

    return {
      total: todayLeads.length,
      byOrigin,
      top: { origin: top[0], count: top[1] },
    };
  }, [leads]);

  const monthStats = useMemo(() => {
    const byOrigin = {};
    leads.forEach((l) => {
      const origin = l.origin || "Unknown";
      byOrigin[origin] = (byOrigin[origin] || 0) + 1;
    });

    const total = leads.length;
    const entries = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);

    // Calcul moyenne par jour DEPUIS LE 24/12/2025
    const now = new Date();
    const startDate = new Date('2025-12-24'); // Date de début du tracking
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.max(1, Math.ceil((now - startDate) / msPerDay));
    const avgPerDay = (total / daysElapsed).toFixed(1);

    return { total, byOrigin, entries, avgPerDay };
  }, [leads]);

  // Bar chart (horizontal) - Leads par origine
  const barChartData = useMemo(() => {
    const entries = monthStats.entries;
    const labels = entries.map(([origin]) => origin);
    const data = entries.map(([, count]) => count);
    
    const colors = [
      COLORS.primary, COLORS.secondary, COLORS.tertiary, 
      COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.yellow, COLORS.gray
    ];

    return {
      labels,
      datasets: [{
        label: 'Nombre de leads',
        data,
        backgroundColor: colors.slice(0, entries.length),
        borderWidth: 0,
        borderRadius: 6,
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
        titleColor: darkMode ? "#e5e7eb" : "#000000",
        bodyColor: darkMode ? "#f9fafb" : "#000000",
        borderColor: darkMode ? "#1f2937" : "#e5e7eb",
        borderWidth: 1,
        padding: 12,
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        color: darkMode ? "#e5e7eb" : "#374151",
        font: { size: 12, weight: 600 },
        formatter: (value, ctx) => {
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
          color: darkMode ? "#9ba3af" : "#4b5563",
          font: { size: 11 },
        },
        grid: {
          color: darkMode ? "rgba(148, 163, 184, 0.15)" : "rgba(209, 213, 219, 0.5)",
        },
      },
      y: {
        ticks: {
          color: darkMode ? "#9ba3af" : "#4b5563",
          font: { size: 12, weight: 500 },
        },
        grid: { display: false },
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

      const colors = [COLORS.primary, COLORS.secondary, COLORS.tertiary];
      const color = colors[idx];

      return {
        label: origin,
        data: cumulative,
        borderColor: color,
        backgroundColor: "transparent",
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [leads, monthStats]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true,
        position: "bottom",
        labels: {
          color: darkMode ? "#e5e7eb" : "#374151",
          font: { size: 14, weight: 600 },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'line',
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} leads cumulés`,
        },
        backgroundColor: darkMode ? "#020617" : "#ffffff",
        titleColor: darkMode ? "#e5e7eb" : "#000000",
        bodyColor: darkMode ? "#f9fafb" : "#000000",
        borderColor: darkMode ? "#1f2937" : "#e5e7eb",
        borderWidth: 1,
        padding: 12,
      },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: darkMode ? "#9ba3af" : "#4b5563",
          font: { size: 12 },
        },
        grid: {
          color: darkMode ? "rgba(148, 163, 184, 0.15)" : "rgba(209, 213, 219, 0.5)",
        },
      },
      x: {
        ticks: {
          color: darkMode ? "#9ba3af" : "#4b5563",
          font: { size: 11 },
        },
        grid: { display: false },
      },
    },
  }), [darkMode]);

  if (loading || !isAdmin) {
    return <p style={{ padding: 24 }}>Loading...</p>;
  }

  return (
    <div style={{ padding: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>
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
              onClick={() => fetchLeads()}
              title="Refresh data"
            >
              🔄 Refresh
            </button>
            <button 
              className="export-btn" 
              onClick={() => navigate("/")}
            >
              ← Retour
            </button>
          </div>
        </div>

        <div style={{ height: '80px' }} /> {/* Spacer pour éviter chevauchement */}

        {dataLoading && <p>Chargement des données...</p>}

        {!dataLoading && (
          <>
            {/* Stats du jour */}
            <div className="totals-block">
              <div className="totals-row">
                <div>
                  <span className="totals-label">📅 Aujourd'hui</span>
                  <br />
                  <span className="totals-value cash dot-boost">
                    {todayStats.total} leads
                  </span>
                </div>
                <div>
                  <span className="totals-label">🏆 Top origine</span>
                  <br />
                  <span className="totals-value revenu dot-boost">
                    {todayStats.top.origin} ({todayStats.top.count})
                  </span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '100%', margin: "0 auto", padding: '0 20px' }}>
              
              {/* KPI Cards - 3 cards horizontales */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                marginBottom: '30px'
              }}>
                
                {/* Card 1: Meilleure source */}
                <div className="chart-card kpi-card" style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>
                    🏆 Meilleure source
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.primary, marginBottom: '4px' }}>
                    {monthStats.entries[0]?.[0] || 'N/A'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {monthStats.entries[0]?.[1] || 0} leads ({monthStats.entries[0] ? ((monthStats.entries[0][1] / monthStats.total) * 100).toFixed(0) : 0}%)
                  </div>
                </div>

                {/* Card 2: Total ce mois */}
                <div className="chart-card kpi-card" style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📊 Total ce mois
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.secondary, marginBottom: '4px' }}>
                    {monthStats.total}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {monthStats.entries.length} sources actives
                  </div>
                </div>

                {/* Card 3: Moyenne par jour */}
                <div className="chart-card kpi-card" style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📈 Moyenne / jour
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.tertiary, marginBottom: '4px' }}>
                    {monthStats.avgPerDay}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    leads par jour
                  </div>
                </div>

              </div>

              {/* Charts côte à côte */}
              <div className="charts-side-by-side">
                
                {/* GAUCHE: Bar chart horizontal */}
                <div className="chart-card kpi-card">
                  <div className="gauge-header">
                    <div className="gauge-title">📊 Leads par origine - Ce mois</div>
                    <div className="gauge-subtitle">
                      Répartition des {monthStats.total} leads reçus
                    </div>
                  </div>

                  <div style={{ height: 450, marginTop: 20 }}>
                    <Bar data={barChartData} options={barOptions} />
                  </div>
                </div>

                {/* DROITE: Line chart (TOP 3) */}
                <div className="chart-card kpi-card chart--weeks">
                  <div className="chart-header kpi-header">
                    <div>
                      <div className="kpi-label">📈 Évolution TOP 3 sources</div>
                      <div className="kpi-sub">
                        Leads cumulés des 3 meilleures sources
                      </div>
                    </div>
                  </div>

                  <div className="chart-body chart-body--glass" style={{ height: 450 }}>
                    <Line data={lineChartData} options={lineOptions} />
                  </div>
                </div>

              </div>

              {/* Tableau des leads du jour */}
              {todayStats.total > 0 && (
                <div className="chart-card kpi-card" style={{ marginTop: 30 }}>
                  <div className="gauge-header">
                    <div className="gauge-title">📋 Détail des leads d'aujourd'hui</div>
                    <div className="gauge-subtitle">
                      {todayStats.total} lead{todayStats.total > 1 ? 's' : ''} reçu{todayStats.total > 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="leaderboard-wrapper" style={{ marginTop: 20 }}>
                    <table className="leaderboard">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Heure</th>
                          <th>Nom complet</th>
                          <th>Email</th>
                          <th>Téléphone</th>
                          <th>Origine</th>
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
                              <tr key={lead.id}>
                                <td>{idx + 1}</td>
                                <td>{time}</td>
                                <td className="name-cell">{lead.full_name || '-'}</td>
                                <td>{lead.email || '-'}</td>
                                <td>{lead.phone || '-'}</td>
                                <td>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    background: darkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
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
