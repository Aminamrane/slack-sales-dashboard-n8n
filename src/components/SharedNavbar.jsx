import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import apiClient from "../services/apiClient";
import lightIcon from "../assets/light.png";
import darkIcon from "../assets/dark.png";

const COLORS = {
  primary: "#6366f1",
  secondary: "#fb923c",
  tertiary: "#10b981",
};

// Role display names
const ROLE_LABELS = {
  admin: "Admin",
  sales: "Sales",
  head_of_sales: "Head of Sales",
  head_of_sales_manager: "Head of Sales Manager",
  ceo: "CEO",
  tech: "Tech",
  marketing: "Marketing",
  hr: "HR",
  finance_director: "Finance Director",
};

export default function SharedNavbar({ session, darkMode, setDarkMode }) {
  const navigate = useNavigate();

  // ── USER STATE ──────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('Utilisateur');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      let user = apiClient.getUser();

      // If stored user is missing first_name, refresh from backend
      if (!user?.first_name && apiClient.getToken()) {
        try {
          const fresh = await apiClient.getMe();
          user = apiClient.getUser(); // Re-read after getMe updates localStorage
        } catch (e) {
          // Ignore - use whatever we have
        }
      }

      const firstName = user?.first_name || user?.name?.split(' ')[0] || null;
      const name = firstName ||
                   user?.name ||
                   session?.name ||
                   session?.user?.user_metadata?.name ||
                   session?.user?.user_metadata?.full_name ||
                   'Utilisateur';

      setDisplayName(name);
      setUserRole(user?.role);
    };

    checkUser();
  }, [session]);

  // ── LOGOUT ──────────────────────────────────────────────────────────────────
  const logout = () => {
    apiClient.logout();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: 0,
      right: 0,
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      padding: '12px 24px',
      pointerEvents: 'none',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        borderRadius: '16px',
        background: darkMode ? 'rgba(30,31,40,0.45)' : 'rgba(255,255,255,0.40)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${darkMode ? 'rgba(42,43,54,0.6)' : 'rgba(226,230,239,0.6)'}`,
        boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
        fontFamily: 'sans-serif'
      }}>
        {/* User Profile — clickable → /profile */}
        <div
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingRight: '12px',
            borderRight: `1px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`,
            cursor: 'pointer',
            borderRadius: '10px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {session?.user?.user_metadata?.avatar_url ? (
            <img
              src={session.user.user_metadata.avatar_url}
              alt=""
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `2px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`
              }}
            />
          ) : (
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: userRole === 'admin' ? COLORS.primary : COLORS.tertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#fff',
              fontWeight: 600
            }}>
              {userRole === 'admin' ? '👑' : '👤'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: darkMode ? '#f5f5f7' : '#1d1d1f',
              lineHeight: 1.2
            }}>
              {displayName}
            </span>
            <span style={{
              fontSize: '11px',
              color: darkMode ? '#8b8d93' : '#86868b',
              lineHeight: 1.2
            }}>
              {ROLE_LABELS[userRole] || userRole || 'Membre'}
            </span>
          </div>
        </div>

        {/* Mes pages - Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="tools-btn"
            onClick={(e) => {
              const dropdown = e.currentTarget.nextElementSibling;
              dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
            }}
          >
            <span style={{ marginLeft: '10px' }}>Mes pages</span>
            <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '6px' }}>▼</span>
          </button>
          {/* Dropdown menu */}
          <div
            style={{
              display: 'none',
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px',
              borderRadius: '12px',
              background: darkMode ? '#242428' : '#ffffff',
              border: `1px solid ${darkMode ? '#2a2b36' : '#e2e6ef'}`,
              boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: '160px',
              zIndex: 1000
            }}
            onMouseLeave={(e) => e.currentTarget.style.display = 'none'}
          >
            {/* Navigation items - dynamically shown based on backend permissions */}
            {apiClient.hasAccess('leaderboard') && (
              <button
                onClick={() => navigate("/")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Suivi des ventes
              </button>
            )}

            {apiClient.hasAccess('admin_leads') && (
              <button
                onClick={() => navigate("/admin/leads")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Monitoring Lead
              </button>
            )}

            {apiClient.hasAccess('leads_management') && (
              <button
                onClick={() => navigate("/leads-management")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Gestion des Leads
              </button>
            )}

            {apiClient.hasAccess('monitoring_perf') && (
              <button
                onClick={() => navigate("/monitoring-perf")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Monitoring Sales
              </button>
            )}

            {apiClient.hasAccess('tracking_sheet') && (
              <button
                onClick={() => navigate("/tracking-sheet")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Tracking Sheet
              </button>
            )}

            {apiClient.hasAccess('eod_reports') && (
              <button
                onClick={() => navigate("/eod-report")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                End of Day
              </button>
            )}

            {apiClient.hasAccess('eod_dashboard') && (
              <button
                onClick={() => navigate("/eod-dashboard")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#f5f5f7' : '#1d1d1f',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Dashboard EOD
              </button>
            )}

          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div style={{
          width: '80px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible'
        }}>
          <img
            src={darkMode ? darkIcon : lightIcon}
            alt={darkMode ? "Dark mode" : "Light mode"}
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Mode clair" : "Mode sombre"}
            style={{
              width: '80px',
              height: 'auto',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Déconnexion"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            border: 'none',
            background: darkMode ? '#2a2b2e' : '#f5f5f7',
            color: darkMode ? '#8b8d93' : '#86868b',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkMode ? '#ff453a' : '#ff3b30';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = darkMode ? '#2a2b2e' : '#f5f5f7';
            e.currentTarget.style.color = darkMode ? '#8b8d93' : '#86868b';
          }}
        >
          ⏻
        </button>
      </div>
    </div>
  );
}
