import { Link, useLocation, useParams } from "react-router-dom";
import "./EmployeeSales.css";

export default function EmployeeSales() {
  const { name } = useParams();
  const location = useLocation();
  const avatar = location.state?.avatar || ""; // URL passée depuis le leaderboard

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
            <div className="emp-id">ID : —</div>
          </div>
        </div>

        {/* Sélecteur non interactif comme sur ton screen */}
        <div className="emp-right">
          <select className="emp-fake-select" disabled>
            <option>Tous les challenges</option>
          </select>
        </div>
      </div>

      <div className="emp-panel-placeholder">
        Zone stats & historique (prochain step)
      </div>
    </div>
  );
}
