import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [session, setSession] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await apiClient.getMe();
        setSession(data?.user ?? data);
      } catch {
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    surface: darkMode ? "#13141b" : "#edf0f8",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    secondary: darkMode ? "#8b8fa0" : "#6b7280",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
    shadow: darkMode
      ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)"
      : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setSuccess("Mot de passe modifié avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Erreur lors du changement de mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: `1px solid ${C.border}`,
    background: darkMode ? "#252636" : "#f4f6fb",
    color: C.text,
    fontSize: "14px",
    fontFamily: "Inter, sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.surface,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: C.text,
        paddingTop: "80px",
      }}
    >
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div
        style={{
          maxWidth: 480,
          margin: "32px auto 64px",
          padding: "18px",
          background: darkMode ? "rgba(0,0,0,0.10)" : "rgba(190,197,215,0.20)",
          borderRadius: "32px",
        }}
      >
        <div
          style={{
            background: C.bg,
            borderRadius: "24px",
            padding: "40px 32px",
            boxShadow: C.shadow,
          }}
        >
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              margin: "0 0 8px",
              color: C.text,
            }}
          >
            Changer le mot de passe
          </h1>
          <p style={{ fontSize: "14px", color: C.muted, margin: "0 0 28px" }}>
            Modifiez votre mot de passe de connexion.
          </p>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2",
                color: "#ef4444",
                fontSize: "13px",
                marginBottom: "16px",
                border: `1px solid ${darkMode ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
                color: "#22c55e",
                fontSize: "13px",
                marginBottom: "16px",
                border: `1px solid ${darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0"}`,
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: "6px",
                }}
              >
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                maxLength={128}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: "6px",
                }}
              >
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
              <span style={{ fontSize: "11px", color: C.muted, marginTop: "4px", display: "block" }}>
                Minimum 8 caractères
              </span>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: C.secondary,
                  marginBottom: "6px",
                }}
              >
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                padding: "13px 0",
                borderRadius: "12px",
                border: "none",
                background: loading ? C.muted : C.accent,
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s, transform 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.filter = "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none";
              }}
            >
              {loading ? "Modification..." : "Modifier le mot de passe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
