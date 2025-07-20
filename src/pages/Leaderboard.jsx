// src/pages/Leaderboard.jsx
import { useEffect, useState } from "react";
import { useNavigate }          from "react-router-dom";
import { createClient }         from "@supabase/supabase-js";
import * as XLSX                from "xlsx";
import { saveAs }               from "file-saver";
import myLogo                   from "../assets/my_image.png";

// Chart.js + plugins
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Pie, Bar } from "react-chartjs-2";

// Register plugin
Chart.register(ChartDataLabels);

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Leaderboard() {
  const navigate            = useNavigate();
  const [rows, setRows]     = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [tunnelStats, setTunnelStats] = useState({});
  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState("table");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("Info").select("*");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const cleaned = data.filter(r =>
        Number.isFinite(r.amount) &&
        Number.isFinite(r.mensualite) &&
        !(r.amount === 0 && r.mensualite === 0)
      );

      // Totaux globaux
      const totalCash = cleaned.reduce((sum, r) => sum + Number(r.mensualite), 0);
      const totalRev  = cleaned.reduce((sum, r) => sum + Number(r.amount),      0);
      setTotals({ cash: totalCash, revenu: totalRev, ventes: cleaned.length });

      // Stats par employé
      const stats = {};
      cleaned.forEach(r => {
        const name = r.employee_name?.trim() || "Unknown";
        stats[name] ??= { name, sales: 0, cash: 0, revenu: 0, avatar: r.avatar_url || "" };
        stats[name].sales  += 1;
        stats[name].cash   += Number(r.mensualite);
        stats[name].revenu += Number(r.amount);
      });
      setRows(
        Object.values(stats).sort(
          (a, b) => b.sales - a.sales || b.cash - a.cash
        )
      );

      // Tunnel d’acquisition
      const tunnel = {};
      cleaned.forEach(r => {
        tunnel[r.tunnel] ??= 0;
        tunnel[r.tunnel] += 1;
      });
      setTunnelStats(tunnel);

      // 6 jours ouvrés
      const byDay = {};
      cleaned.forEach(r => {
        const d = new Date(r.created_at);
        const day = d.getDay();
        if (day === 0 || day === 6) return;
        const key = d.toLocaleDateString("fr-FR");
        byDay[key] ??= { date: key, ventes: 0, cash: 0, revenu: 0 };
        byDay[key].ventes += 1;
        byDay[key].cash   += Number(r.mensualite);
        byDay[key].revenu += Number(r.amount);
      });
      const dates = Object.keys(byDay)
        .sort((a,b) => new Date(a.split("/").reverse().join("-")) - new Date(b.split("/").reverse().join("-")))
        .slice(-6);
      setDailyData(dates.map(d => byDay[d]));

      setLoading(false);
    })();
  }, []);

  const exportToExcel = () => {
    const wsData = rows.map((r,i) => ({
      Position:    ["🥇","🥈","🥉"][i] || i+1,
      Nom:         r.name,
      Ventes:      r.sales,
      "Cash €/mois": r.cash,
      "Revenu €":   r.revenu
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData, {
      header: ["Position","Nom","Ventes","Cash €/mois","Revenu €"]
    });
    XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
    const wbout = XLSX.write(wb, { bookType:"xlsx", type:"array" });
    saveAs(new Blob([wbout]), "leaderboard.xlsx");
  };

  // Doughnut data & options
  const doughnutData = {
    labels: Object.keys(tunnelStats),
    datasets: [{
      data: Object.values(tunnelStats),
      backgroundColor: ["#ff6384", "#36a2eb", "#ffcd56", "#4bc0c0"]
        .slice(0, Object.keys(tunnelStats).length)
    }]
  };
  const doughnutOptions = {
    maintainAspectRatio: false,
    responsive: true,
    layout: {
      padding: { top: 20, bottom: 20, left: 20, right: 20 }
    },
    plugins: {
      title: {
        display: true,
        text: "Répartition tunnel d'acquisition",
        color: "#000",
        font: { size: 16 }
      },
      legend: {
        display: true,
        position: "left",
        align: "start",
        labels: {
          boxWidth: 12,
          padding: 8,
          font: { size: 12, weight: "500" }
        }
      },
      datalabels: {
        display: true,
        formatter: (val, ctx) => {
          const data = ctx.chart.data.datasets[0].data;
          const sum  = data.reduce((a,b) => a + b, 0);
          return Math.round((val/sum)*100) + "%";
        },
        color: "#fff",
        font: { weight: "600", size: 12 },
        anchor: "center"
      }
    }
  };

  // Bar chart data & options
 const barData = {
    labels: dailyData.map(d => d.date),
    datasets: [
      {
        label: "Cash €/mois",
        data: dailyData.map(d => d.cash),
        backgroundColor: "rgba(76,175,80,0.8)"
      },
      {
        label: "Revenu €",
        data: dailyData.map(d => d.revenu),
        backgroundColor: "rgba(54,162,235,0.8)"
      }
    ]
  };
 
  const barOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Cash & Revenu sur les 6 derniers jours ouvrés",
        color: "#000",
        font: { size: 16 }
      },
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: ctx =>
            `${ctx.dataset.label} : ${ctx.parsed.y.toLocaleString("fr-FR")} €`
        }
      }
    },
    scales: { y: { beginAtZero: true } },
    interaction: { mode: "index", intersect: false }
  };

// Pie % of sales per employee
  const pieUnderData = {
    labels: rows.map(r => r.name),
    datasets: [{
      data:    rows.map(r => r.sales),
      backgroundColor: [
        "#9966ff","#ff9f40","#2ecc71","#e74c3c",
        "#3498db","#f1c40f","#9b59b6","#1abc9c"
      ].slice(0, rows.length)
    }]
  };

  const pieUnderOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "% de ventes par commercial",
        align: "center",
        font: { size: 16, weight: "600" }
      },
      legend: {
        display: true,
        position: "left",
        align: "start",
        labels: { boxWidth:12, padding:8 }
      },
      datalabels: {
        color: "#fff",
        font: { size: 12, weight: "600" },
        textStrokeColor: "#000",
        textStrokeWidth: 2,
        formatter: (v,ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
          return Math.round(v/total*100) + "%";
        }
      }
    }
  };

  return (
    <div style={{ padding:0, fontFamily:"sans-serif" }}>
      <div className="board-frame">

        {/* Excel */}

        <button className="export-btn" title="Exporter au format Excel" onClick={exportToExcel}>
          📥 Excel
        </button>

        {/* Toggle Tableaux / Charts */}

        <div className="view-toggle">
          <button
            className={`toggle-btn ${view==="table"?"active":""}`}
            onClick={()=>setView("table")}
          >
            Tableaux
          </button>
          <button
            className={`toggle-btn ${view==="charts"?"active":""}`}
            onClick={()=>setView("charts")}
          >
            Charts
          </button>
        </div>

        {/* Header + Totaux */}
        <div className="title-bar">
          <img src={myLogo} className="title-logo" alt="logo"/>
          <h1 className="leaderboard-title">Leaderboard</h1>
        </div>
        <div className="totals-block">
          <div className="totals-row">
            <div>
              <span className="totals-label">Total Cash</span><br/>
              <span className="totals-value cash">{totals.cash.toLocaleString("fr-FR")} €</span>
            </div>
            <div>
              <span className="totals-label">Total Revenu</span><br/>
              <span className="totals-value revenu">{totals.revenu.toLocaleString("fr-FR")} €</span>
            </div>
          </div>
          <div className="totals-sales">Total ventes : {totals.ventes}</div>
        </div>

        {loading && <p>Loading…</p>}
        {!loading && rows.length===0 && <p>No sales yet.</p>}

        {/* Table View */}
        {view==="table" && !loading && rows.length>0 && (
          <div className="leaderboard-wrapper">
            <table className="leaderboard">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th align="right">Sales</th>
                  <th align="right">Cash €/mois</th><th align="right">Revenu €</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(

                  <tr key={r.name} style={{cursor:"pointer"}} onClick={()=>navigate(`/employee/${encodeURIComponent(r.name)}`)}>
                    <td>{["🥇","🥈","🥉"][i]||i+1}</td>
                    <td className="name-cell"><img src={r.avatar} className="avatar" alt=""/> {r.name}</td>
                    <td align="right">{r.sales}</td>
                    <td align="right">{r.cash.toLocaleString("fr-FR")} €</td>
                    <td align="right">{r.revenu.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charts View */}
        {view==="charts" && !loading && (
          <div className="charts-wrapper">
            <div className="chart pie-container">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="chart bar-container">
              <Bar data={barData} options={barOptions} />
            </div>
            <div className="chart pie-under">
              <Pie data={pieUnderData} options={pieUnderOptions} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
