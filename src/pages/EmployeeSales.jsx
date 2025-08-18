import { Link, useLocation, useParams } from "react-router-dom";
import "./EmployeeSales.css";

export default function EmployeeSales() {
  const { name } = useParams();
  const location = useLocation();

  // reçus depuis le leaderboard (avec navigate(..., { state: { ... } }))
  const avatar = location.state?.avatar || "";
  const ventes = location.state?.ventes ?? 0;
  const cash   = location.state?.cash   ?? 0;
  const revenu = location.state?.revenu ?? 0;

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

        {/* Sélecteur non interactif comme sur ton screen */}
        <div className="emp-right">
          <select className="emp-fake-select" disabled>
            <option>Tous les challenges</option>
          </select>
        </div>
      </div>

      {/* — Stats alignées sous la carte — */}
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

      {/* placeholder pour l'historique qu'on fera après */}
      <div className="emp-panel-placeholder">
        Zone stats & historique 
      </div>
    </div>
  );
}
