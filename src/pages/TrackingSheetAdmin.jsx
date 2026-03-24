import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

export default function TrackingSheetAdmin() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => { localStorage.setItem("darkMode", darkMode); document.body.classList.toggle("dark-mode", darkMode); document.documentElement.classList.toggle("dark-mode", darkMode); }, [darkMode]);

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff', border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#f6f7f9', text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af', accent: darkMode ? '#7c8adb' : '#5b6abf',
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        if (user.role !== 'admin') { navigate("/"); return; }

        const resp = await apiClient.getAssignableUsers();
        console.log('[TrackingSheetAdmin] assignable users:', resp);
        setUsers(Array.isArray(resp) ? resp : resp?.users || resp?.data || []);
      } catch { navigate("/login"); }
      finally { setLoading(false); }
    };
    init();
  }, [navigate]);

  if (loading) return <div style={{ minHeight: '100vh', background: C.surface }} />;

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#fb923c'];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: C.surface, paddingTop: 80 }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8, textAlign: 'center' }}>Tracking Sheets</h1>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 32, textAlign: 'center' }}>
          Sélectionnez un commercial pour accéder à sa feuille de suivi
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u, i) => (
            <button
              key={u.email || u.id}
              onClick={() => { window.location.href = `/tracking-sheet?sheet_id=${encodeURIComponent(u.email)}`; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                background: darkMode ? '#252636' : '#fff', border: `1px solid ${C.border}`,
                borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s ease',
                textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = C.border; }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: COLORS[i % COLORS.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff',
              }}>
                {(u.name || u.full_name || u.email).charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{u.name || u.full_name || u.email}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{u.email}</div>
              </div>

              {/* Arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Aucun commercial trouvé</div>
        )}
      </div>
    </div>
  );
}
