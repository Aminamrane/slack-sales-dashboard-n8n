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

  // Dark mode detection - IMMEDIATE
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-mode') || 
           document.body.classList.contains('dark-mode');
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark-mode') || 
                   document.body.classList.contains('dark-mode');
    setDarkMode(isDark);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark-mode') || 
                     document.body.classList.contains('dark-mode');
      setDarkMode(isDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Data from leaderboard
  const avatar = location.state?.avatar || "";
  const ventes = location.state?.ventes ?? 0;
  const cash   = location.state?.cash   ?? 0;
  const revenu = location.state?.revenu ?? 0;

  const [rows, setRows] = useState([]);
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
    <div className={`employee-page ${darkMode ? 'dark-mode' : ''}`}>
      <div className="emp-container">
        <Link to="/" className="emp-back">← Retour au leaderboard</Link>

        {/* Header Card */}
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
              <div className="emp-subtitle">{ventes} ventes réalisées</div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="emp-stats">
          <div className="stat-card ventes">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{ventes}</div>
            <div className="stat-label">Total Ventes</div>
          </div>

          <div className="stat-card cash">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{cash.toLocaleString("fr-FR")} €</div>
            <div className="stat-label">Cash Collecté</div>
          </div>

          <div className="stat-card revenu">
            <div className="stat-icon">💸</div>
            <div className="stat-value">{revenu.toLocaleString("fr-FR")} €</div>
            <div className="stat-label">Revenu Total</div>
          </div>
        </div>

        {/* History Table */}
        <div className="emp-history-card">
          <div className="emp-history-head">
            <div>
              <h2>Historique des ventes</h2>
              {!loading && (
                <div className="emp-history-count">
                  {rows.length} vente{rows.length > 1 ? 's' : ''} trouvée{rows.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="emp-history-empty">
              <div className="emp-loader"></div>
              <p>Chargement des données...</p>
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="emp-history-empty">
              <div className="emp-empty-icon">📭</div>
              <p>Aucune vente enregistrée pour le moment</p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="emp-history-table-wrap">
              <table className="emp-history">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th align="right">Revenu</th>
                    <th align="right">Cash €/mois</th>
                    <th>Modalité</th>
                    <th>Tunnel</th>
                    <th>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const date = new Date(r.created_at);
                    const formattedDate = date.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <tr key={idx}>
                        <td className="emp-date">{formattedDate}</td>
                        <td className="emp-client">{r.client_name || "—"}</td>
                        <td align="right" className="emp-amount">
                          {(Number(r.amount) || 0).toLocaleString("fr-FR")} €
                        </td>
                        <td align="right" className="emp-mensualite">
                          {(Number(r.mensualite) || 0).toLocaleString("fr-FR")} €
                        </td>
                        <td>
                          <span
                            className={`emp-chip ${
                              r.payment_mode === "M"
                                ? "mode-m"
                                : r.payment_mode === "A"
                                ? "mode-a"
                                : "mode-default"
                            }`}
                          >
                            {r.payment_mode === "M" ? "Mensuel" : r.payment_mode === "A" ? "Annuel" : r.payment_mode || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="emp-chip tunnel">{r.tunnel || "—"}</span>
                        </td>
                        <td className="emp-history-comment">{r.comment || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
