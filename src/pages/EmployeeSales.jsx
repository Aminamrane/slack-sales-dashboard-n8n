// src/pages/EmployeeSales.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import "./EmployeeSales.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function EmployeeSales() {
  const { name } = useParams();
  const location = useLocation();

  // reçus depuis le leaderboard
  const avatar = location.state?.avatar || "";
  const ventes = location.state?.ventes ?? 0;
  const cash   = location.state?.cash   ?? 0;
  const revenu = location.state?.revenu ?? 0;

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("Info")
        .select("created_at, client_name, tunnel, amount, mensualite, comment, payment_mode")
        .ilike("employee_name", `%${name}%`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      const filtered = (data || []).filter(
        (r) => (Number(r.amount) || 0) > 0 || (Number(r.mensualite) || 0) > 0
      );

      setRows(filtered);
      setLoading(false);
    })();
  }, [name]);

  return (
    <div className="employee-page">
      <Link to="/" className="emp-back">← Retour au leaderboard</Link>

      <div className="emp-header-card">
        <div className="emp-left">
          <div className="emp-avatar-wrap">
            {avatar ? (
              <img className="emp-avatar" src={avatar} alt={name} />
            ) : (
              <div className="emp-avatar emp-placeholder" aria-label="placeholder" />
            )}
          </div>

          <div className="emp-id-block">
            <h1 className="emp-name">{name}</h1>
            <div className="emp-id">ID : </div>
          </div>
        </div>

        <div className="emp-right">
          <select className="emp-fake-select" disabled>
            <option>Tous les challenges</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="emp-stats">
        <div className="stat-card ventes">
          <div className="stat-value">{ventes}</div>
          <div className="stat-label">Total Ventes</div>
        </div>

        <div className="stat-card cash">
          <div className="stat-value">{cash.toLocaleString("fr-FR")} €</div>
          <div className="stat-label">Cash Collecté</div>
        </div>

        <div className="stat-card revenu">
          <div className="stat-value">{revenu.toLocaleString("fr-FR")} €</div>
          <div className="stat-label">Revenu Total</div>
        </div>
      </div>

      {/* Historique */}
      <div className="emp-history-card">
        <div className="emp-history-head">
          <h2>Historique des ventes</h2>
          {!loading && (
            <div className="emp-history-count">{rows.length} ventes trouvées</div>
          )}
        </div>

        {loading && <div className="emp-history-empty">Chargement…</div>}

        {!loading && rows.length === 0 && (
          <div className="emp-history-empty">Aucune vente encore.</div>
        )}

        {!loading && rows.length > 0 && (
          <div className="emp-history-table-wrap">
            <table className="emp-history">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Email</th>
                  <th align="right">Revenu</th>
                  <th align="right">Cash €/mois</th>
                  <th>Modalité</th>
                  <th>Funnel</th>
                  <th>Partage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.client_name || "—"}</td>
                    <td className="muted">—</td>
                    <td align="right">
                      {(Number(r.amount) || 0).toLocaleString("fr-FR")} €
                    </td>
                    <td align="right">
                      {(Number(r.mensualite) || 0).toLocaleString("fr-FR")} €
                    </td>
                 <td>
  <span
    className={`emp-chip ${
      r.payment_mode === "M"
        ? "mode-m"
        : r.payment_mode === "A"
        ? "mode-a"
        : ""
    }`}
  >
    {r.payment_mode || "—"}
  </span>
</td>

                    <td>
                      <span className="emp-chip light">{r.tunnel || "—"}</span>
                    </td>
                    <td className="emp-history-comment">{r.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
