// Bas du menu de gauche (dev 09/11/2026 : « on est sur la photo de profil et on accède à notre profil depuis le
// menu de gauche ») : la photo, le prénom et le rôle mènent au profil ; à côté, le mode sombre et la déconnexion
// qui prenaient place dans la navbar. Déconnexion en deux temps comme dans la navbar (un clic arme, le second
// confirme, 4 s pour se raviser).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import apiClient from "../../../services/apiClient";
import { roleLabel } from "../../../utils/roleLabels.js";

const firstNameOf = (u) => u?.first_name || u?.full_name?.split(" ")[0] || u?.name?.split(" ")[0] || "Mon profil";
const initialsOf = (u) => {
  const full = (u?.full_name || u?.name || [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "").trim();
  return (full.split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase();
};

export default function SidebarProfile({ collapsed, darkMode, onToggleDark }) {
  const navigate = useNavigate();
  const user = apiClient.getUser();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const logout = () => { if (armed) apiClient.logout(); else setArmed(true); };
  return (
    <div className={`sb-profile${collapsed ? " is-collapsed" : ""}`}>
      <button type="button" className="sb-profile-me" onClick={() => navigate("/profile")} title={collapsed ? "Mon profil" : undefined} aria-label="Mon profil">
        {user?.avatar_url
          ? <img className="sb-avatar" src={user.avatar_url} alt="" draggable={false} />
          : <span className="sb-avatar" aria-hidden="true">{initialsOf(user)}</span>}
        {!collapsed && (
          <span className="sb-profile-id">
            <strong>{firstNameOf(user)}</strong>
            <small>{roleLabel(user?.role)}</small>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="sb-profile-tools">
          <button type="button" className="ceo-icon-btn sb-tool" onClick={onToggleDark} aria-label={darkMode ? "Passer en mode clair" : "Passer en mode sombre"} title={darkMode ? "Mode clair" : "Mode sombre"}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button type="button" className={`ceo-icon-btn sb-tool${armed ? " is-armed" : ""}`} onClick={logout} onBlur={() => setArmed(false)}
            aria-label={armed ? "Confirmer la déconnexion" : "Se déconnecter"} title={armed ? "Cliquer encore pour se déconnecter" : "Se déconnecter"}>
            <LogOut size={15} />{armed && <span>Confirmer</span>}
          </button>
        </div>
      )}
    </div>
  );
}
