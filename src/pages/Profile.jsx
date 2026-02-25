import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";

const DAY_LABELS = [
  { key: 1, short: "Lun", long: "Lundi" },
  { key: 2, short: "Mar", long: "Mardi" },
  { key: 3, short: "Mer", long: "Mercredi" },
  { key: 4, short: "Jeu", long: "Jeudi" },
  { key: 5, short: "Ven", long: "Vendredi" },
  { key: 6, short: "Sam", long: "Samedi" },
  { key: 7, short: "Dim", long: "Dimanche" },
];

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

export default function Profile() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [session, setSession] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Working days state
  const [workingDays, setWorkingDays] = useState(DEFAULT_WORKING_DAYS);
  const [serverDays, setServerDays] = useState(DEFAULT_WORKING_DAYS);
  const [canChange, setCanChange] = useState(true);
  const [nextChangeDate, setNextChangeDate] = useState(null);
  const [wdLoading, setWdLoading] = useState(false);
  const [wdError, setWdError] = useState("");
  const [wdSuccess, setWdSuccess] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await apiClient.getMe();
        setSession(data?.user ?? data);
      } catch {
        navigate("/login");
        return;
      }

      // Load working days
      try {
        const wd = await apiClient.getWorkingDays();
        const days = wd.working_days || DEFAULT_WORKING_DAYS;
        setWorkingDays(days);
        setServerDays(days);
        setCanChange(wd.can_change !== false);
        setNextChangeDate(wd.next_change_allowed_at || null);
      } catch {
        // Backend not ready yet — keep defaults
      }
    };
    init();
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

  // ── Password handlers ──
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword.length < 8) {
      setPwError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Les mots de passe ne correspondent pas.");
      return;
    }
    setPwLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setPwSuccess("Mot de passe modifié avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err.message || "Erreur lors du changement de mot de passe.");
    } finally {
      setPwLoading(false);
    }
  };

  // ── Working days handlers ──
  const toggleDay = (dayKey) => {
    if (!canChange) return;
    setWorkingDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey].sort()
    );
  };

  const daysChanged = JSON.stringify([...workingDays].sort()) !== JSON.stringify([...serverDays].sort());

  const handleSaveDays = async () => {
    setShowConfirmModal(false);
    setWdError("");
    setWdSuccess("");
    if (workingDays.length === 0) {
      setWdError("Vous devez sélectionner au moins un jour de travail.");
      return;
    }
    setWdLoading(true);
    try {
      const resp = await apiClient.updateWorkingDays(workingDays);
      const days = resp.working_days || workingDays;
      setServerDays(days);
      setWorkingDays(days);
      setCanChange(resp.can_change !== false);
      setNextChangeDate(resp.next_change_allowed_at || null);
      setWdSuccess("Jours de travail mis à jour avec succès.");
    } catch (err) {
      setWdError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setWdLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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
          maxWidth: 540,
          margin: "32px auto 64px",
          padding: "18px",
          background: darkMode ? "rgba(0,0,0,0.10)" : "rgba(190,197,215,0.20)",
          borderRadius: "32px",
        }}
      >
        {/* ─── Section 1: Password ─── */}
        <div
          style={{
            background: C.bg,
            borderRadius: "24px",
            padding: "36px 32px",
            boxShadow: C.shadow,
            marginBottom: "18px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
            Mot de passe
          </h2>
          <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 24px" }}>
            Modifiez votre mot de passe de connexion.
          </p>

          {pwError && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2",
              color: "#ef4444", fontSize: "13px", marginBottom: "16px",
              border: `1px solid ${darkMode ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
            }}>{pwError}</div>
          )}
          {pwSuccess && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
              color: "#22c55e", fontSize: "13px", marginBottom: "16px",
              border: `1px solid ${darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0"}`,
            }}>{pwSuccess}</div>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.secondary, marginBottom: "6px" }}>
                Mot de passe actuel
              </label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                required maxLength={128} style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.secondary, marginBottom: "6px" }}>
                Nouveau mot de passe
              </label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required minLength={8} maxLength={128} style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)} />
              <span style={{ fontSize: "11px", color: C.muted, marginTop: "4px", display: "block" }}>Minimum 8 caractères</span>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.secondary, marginBottom: "6px" }}>
                Confirmer le nouveau mot de passe
              </label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required minLength={8} maxLength={128} style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)} />
            </div>
            <button type="submit" disabled={pwLoading} style={{
              marginTop: "8px", padding: "13px 0", borderRadius: "12px", border: "none",
              background: pwLoading ? C.muted : C.accent, color: "#fff", fontSize: "15px",
              fontWeight: 600, fontFamily: "Inter, sans-serif",
              cursor: pwLoading ? "not-allowed" : "pointer", transition: "background 0.2s, transform 0.1s",
            }}
              onMouseEnter={(e) => { if (!pwLoading) e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              {pwLoading ? "Modification..." : "Modifier le mot de passe"}
            </button>
          </form>
        </div>

        {/* ─── Section 2: Working Days ─── */}
        <div
          style={{
            background: C.bg,
            borderRadius: "24px",
            padding: "36px 32px",
            boxShadow: C.shadow,
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
            Jours de travail
          </h2>
          <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 24px" }}>
            Sélectionnez les jours où vous travaillez. Cela affecte vos EOD attendus.
          </p>

          {wdError && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2",
              color: "#ef4444", fontSize: "13px", marginBottom: "16px",
              border: `1px solid ${darkMode ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
            }}>{wdError}</div>
          )}
          {wdSuccess && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
              color: "#22c55e", fontSize: "13px", marginBottom: "16px",
              border: `1px solid ${darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0"}`,
            }}>{wdSuccess}</div>
          )}

          {/* Day pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {DAY_LABELS.map((day) => {
              const active = workingDays.includes(day.key);
              const disabled = !canChange;
              return (
                <button
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  disabled={disabled}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "50px",
                    border: active
                      ? (darkMode ? "1px solid rgba(124,138,219,0.35)" : "1px solid rgba(91,106,191,0.25)")
                      : `1px solid ${C.border}`,
                    borderBottom: active
                      ? (darkMode ? "2px solid rgba(60,70,140,0.6)" : "2px solid rgba(70,80,150,0.4)")
                      : `1px solid ${C.border}`,
                    background: active
                      ? (darkMode
                          ? "linear-gradient(180deg, #8b96e0 0%, #5b6abf 50%, #4a57a0 100%)"
                          : "linear-gradient(180deg, #7b8ad4 0%, #5b6abf 50%, #4a56a8 100%)")
                      : (darkMode ? "#252636" : "#f4f6fb"),
                    color: active ? "#fff" : C.muted,
                    fontSize: "13px",
                    fontWeight: 600,
                    fontFamily: "Inter, sans-serif",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    transition: "all 0.15s",
                    boxShadow: active
                      ? (darkMode
                          ? "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.3)"
                          : "inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 3px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.12)")
                      : "none",
                    textShadow: active ? "0 1px 1px rgba(0,0,0,0.15)" : "none",
                  }}
                >
                  {day.short}
                </button>
              );
            })}
          </div>

          {/* Lock message */}
          {!canChange && nextChangeDate && (
            <div style={{
              padding: "12px 16px", borderRadius: "12px",
              background: darkMode ? "rgba(251,146,60,0.10)" : "#fffbeb",
              border: `1px solid ${darkMode ? "rgba(251,146,60,0.25)" : "#fed7aa"}`,
              color: darkMode ? "#fbbf24" : "#d97706",
              fontSize: "13px", lineHeight: 1.5, marginBottom: "16px",
            }}>
              Vous pourrez modifier vos jours de travail le <strong>{formatDate(nextChangeDate)}</strong>.
              Contactez le support en cas de besoin.
            </div>
          )}

          {/* Save button — only if days changed and not locked */}
          {canChange && daysChanged && (
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={wdLoading}
              style={{
                width: "100%", padding: "13px 0", borderRadius: "12px", border: "none",
                background: wdLoading ? C.muted : C.accent, color: "#fff", fontSize: "15px",
                fontWeight: 600, fontFamily: "Inter, sans-serif",
                cursor: wdLoading ? "not-allowed" : "pointer", transition: "background 0.2s",
              }}
              onMouseEnter={(e) => { if (!wdLoading) e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              {wdLoading ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          )}
        </div>
      </div>

      {/* ─── Confirmation Modal ─── */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "modalFadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={() => setShowConfirmModal(false)}
          />
          <div style={{
            position: "relative",
            background: darkMode
              ? "linear-gradient(180deg, #2d3059 0%, #1e1f28 80%)"
              : "linear-gradient(180deg, #d6daf0 0%, #ffffff 80%)",
            borderRadius: "20px", padding: "32px", maxWidth: "440px", width: "90%",
            border: `1px solid ${C.border}`,
            boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.15)",
            textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%", margin: "0 auto 16px",
              background: darkMode ? "rgba(251,146,60,0.22)" : "rgba(251,146,60,0.12)",
              border: `1px solid ${darkMode ? "rgba(251,146,60,0.30)" : "rgba(251,146,60,0.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", fontWeight: 800, color: "#f59e0b",
            }}>
              !
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: C.text, margin: "0 0 8px", fontFamily: "inherit" }}>
              Confirmer vos jours de travail ?
            </h3>
            <p style={{ fontSize: "14px", color: C.secondary, margin: "0 0 24px", lineHeight: 1.5, fontFamily: "inherit" }}>
              Une fois confirmé, vous ne pourrez pas les modifier pendant 2 semaines. Contactez le support en cas de besoin.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={handleSaveDays}
                style={{
                  padding: "10px 24px", borderRadius: "12px",
                  border: darkMode ? "1px solid rgba(124,138,219,0.35)" : "1px solid rgba(91,106,191,0.25)",
                  borderBottom: darkMode ? "2px solid rgba(60,70,140,0.6)" : "2px solid rgba(70,80,150,0.4)",
                  background: darkMode
                    ? "linear-gradient(180deg, #8b96e0 0%, #5b6abf 50%, #4a57a0 100%)"
                    : "linear-gradient(180deg, #7b8ad4 0%, #5b6abf 50%, #4a56a8 100%)",
                  color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s", fontFamily: "inherit",
                  boxShadow: darkMode
                    ? "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.3)"
                    : "inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 3px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.12)",
                  textShadow: "0 1px 1px rgba(0,0,0,0.15)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Confirmer
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: "10px 24px", borderRadius: "12px",
                  border: `1px solid ${darkMode ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.2)"}`,
                  background: darkMode ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.06)",
                  color: C.secondary, fontSize: "14px", fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.06)"; }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
