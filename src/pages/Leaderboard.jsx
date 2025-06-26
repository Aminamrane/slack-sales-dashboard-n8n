// ─────────────────────────────────────────────
// src/pages/Leaderboard.jsx   (entièrement remplacer)
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useNavigate }          from "react-router-dom";
import { createClient }         from "@supabase/supabase-js";
import myLogo                   from "../assets/my_image.png";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Leaderboard() {
  const navigate          = useNavigate();
  const [rows, setRows]   = useState([]);
  const [totals, setTotals] = useState({ cash: 0, revenu: 0, ventes: 0 });
  const [loading, setLoading] = useState(true);

  /* ───── one shot fetch & aggregate ───── */
  useEffect(() => {
   (async ()=> {
  setLoading(true);

  /* ── récup data ── */
  const { data, error } = await supabase.from("Info").select("*");
  if (error) { console.error(error); setLoading(false); return; }

  /* ── filtrage ── */
  const cleaned = data.filter(r =>
    Number.isFinite(r.amount) &&
    Number.isFinite(r.mensualite) &&
    !(r.amount === 0 && r.mensualite === 0)
  );

  /* ── totaux globaux ── */
  const totalCash  = cleaned.reduce((s, r) => s + Number(r.mensualite), 0);
  const totalRev   = cleaned.reduce((s, r) => s + Number(r.amount), 0);
  const totalSales = cleaned.length;
  setTotals({ cash: totalCash, revenu: totalRev, ventes: totalSales });

  /* ── agrégation par vendeur·euse ── */
  const stats = {};
  cleaned.forEach(r => {
    const key = r.employee_name?.trim() || "Unknown";
    stats[key] ??= { name:key, sales:0, cash:0, revenu:0, avatar:r.avatar_url||"" };
    if (r.avatar_url) stats[key].avatar = r.avatar_url;
    stats[key].sales  += 1;
    stats[key].cash   += Number(r.mensualite);
    stats[key].revenu += Number(r.amount);
  });

  setRows(
    Object.values(stats).sort((a,b) => b.sales - a.sales || b.cash - a.cash)
  );
  setLoading(false);
})();
}, []); 


  /* ───── UI ───── */
  return (
  <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
    {/*  ▼  CADRE  ▼  */}
    <div className="board-frame">
      {/* ─────────  NOUVEAU BOUTON CONTRAT  ───────── */}
      <div className="floating-btn-wrapper">
        <button
          className="floating-btn"
          
          onClick={() => navigate("/contrat")}   // ou "/contrat/new" selon la route ci-dessus

        >
          Contrat
        </button>
      </div>
      {/* ────────  FIN BOUTON  ──────── */}

      <div className="title-bar">
        
        <img src={myLogo} className="title-logo" alt="logo" />
        <h1 className="leaderboard-title">Leaderboard</h1>
      </div>
{/* ─── Totaux globaux ─── */}
<div className="totals-block">
  <div className="totals-row">
    <div>
      <span className="totals-label">Total Cash</span><br/>
      <span className="totals-value cash">
        {totals.cash.toLocaleString("fr-FR")} €
      </span>
    </div>

    <div>
      <span className="totals-label">Total Revenu</span><br/>
      <span className="totals-value revenu">
        {totals.revenu.toLocaleString("fr-FR")} €
      </span>
    </div>
  </div>

  <div className="totals-sales">
    Total ventes : {totals.ventes}
  </div>
</div>
      {loading && <p>Loading…</p>}
      {!loading && rows.length === 0 && <p>No sales yet.</p>}

      {!loading && rows.length > 0 && (
        <div className="leaderboard-wrapper">
          
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th align="right">Sales</th>
                <th align="right">Cash €/mois</th>
                <th align="right">Revenu €</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => {
                const rank = ["🥇", "🥈", "🥉"][i] ?? i + 1;
                return (
                  <tr
                    key={r.name}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate(`/employee/${encodeURIComponent(r.name)}`)
                    }
                  >
                    <td>{rank}</td>
                    <td className="name-cell">
                      <img src={r.avatar} className="avatar" alt="" />
                      {r.name}
                    </td>
                    <td align="right">{r.sales}</td>
                    <td align="right">
                      {r.cash.toLocaleString("fr-FR")} €
                    </td>
                    <td align="right">
                      {r.revenu.toLocaleString("fr-FR")} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
    {/*  ▲  FIN CADRE  ▲  */}
  </div>
);
}
