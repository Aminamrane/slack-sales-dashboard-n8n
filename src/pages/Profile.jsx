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

// Types d'absence — alignés sur TeamAbsences / TrackingSheet (mêmes clés/couleurs
// pour que les pastilles soient cohérentes côté RH).
const ABSENCE_TYPE_META = {
  conge: { label: "Congé", color: "#f59e0b" },
  maladie: { label: "Maladie", color: "#ef4444" },
  absence: { label: "Absence", color: "#ec4899" },
  autre: { label: "Autre", color: "#6366f1" },
};

const ROLE_LABELS = {
  admin: "Admin", ceo: "CEO", sales: "Sales", setter: "Setter", hr: "RH",
  head_of_sales: "Head of Sales", head_of_sales_manager: "Manager Sales",
  finance_director: "Dir. Finance", finance_team: "Finance", finance: "Finance",
  acquisition_director: "Dir. Acquisition", head_of_acquisition: "Head of Acquisition",
  tech: "Tech", marketing: "Marketing", customer_success_manager: "CSM",
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

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

  // Absences (auto-déclaration, tous rôles) — endpoint générique /me/unavailability
  const [myUnavailability, setMyUnavailability] = useState([]);
  const [newVacStart, setNewVacStart] = useState("");
  const [newVacEnd, setNewVacEnd] = useState("");
  const [newVacType, setNewVacType] = useState("conge");
  const [newVacDesc, setNewVacDesc] = useState("");
  const [vacError, setVacError] = useState("");
  const [vacLoading, setVacLoading] = useState(false);

  // Partage des nouveaux leads PAR-SETTER : liste des setters rattachés + flag immédiat
  const [setters, setSetters] = useState([]);
  const [savingSetterId, setSavingSetterId] = useState(null);
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  // P4 : Force setter R1 → mon agenda (per-sales toggle)
  const [forceR1, setForceR1] = useState(false);
  const [forceR1Loading, setForceR1Loading] = useState(false);
  const [forceR1Error, setForceR1Error] = useState("");
  const [forceR1Success, setForceR1Success] = useState("");

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const fetchMyUnavailability = async () => {
    try {
      const data = await apiClient.get("/api/v1/users/me/unavailability");
      setMyUnavailability(Array.isArray(data) ? data : []);
    } catch {
      setMyUnavailability([]);
    }
  };

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

      // Load my absences (tous rôles)
      fetchMyUnavailability();

      // Load setters rattachés + leur flag immédiat (partage par-setter)
      try {
        const r = await apiClient.get('/api/v1/users/me/setters');
        setSetters(Array.isArray(r) ? r : []);
      } catch {
        // Backend not ready yet — keep empty
      }

      // P4 : Load force_setter_r1_to_calendar toggle
      try {
        const r = await apiClient.get('/api/v1/users/me/force-setter-r1');
        setForceR1(!!r?.force_setter_r1_to_calendar);
      } catch {
        // Backend not ready yet — keep false
      }
    };
    init();
  }, [navigate]);

  const toggleForceR1 = async () => {
    const newVal = !forceR1;
    setForceR1Loading(true);
    setForceR1Error("");
    setForceR1Success("");
    setForceR1(newVal);
    try {
      await apiClient.put('/api/v1/users/me/force-setter-r1', { force_setter_r1_to_calendar: newVal });
      setForceR1Success(newVal ? "Activé." : "Désactivé.");
      setTimeout(() => setForceR1Success(""), 2500);
    } catch (e) {
      setForceR1(!newVal);
      setForceR1Error(e?.message || "Erreur lors de la mise à jour.");
    } finally {
      setForceR1Loading(false);
    }
  };

  const toggleSetterImmediate = async (setterId, currentVal) => {
    const newVal = !currentVal;
    setSavingSetterId(setterId);
    setShareError("");
    setShareSuccess("");
    // Optimistic update for snappy UX
    setSetters((prev) => prev.map((s) => (s.setter_id === setterId ? { ...s, immediate_new_leads: newVal } : s)));
    try {
      await apiClient.put(`/api/v1/users/me/setters/${setterId}/immediate`, { value: newVal });
      setShareSuccess(newVal ? "Immédiat activé." : "Repassé en 24h.");
      setTimeout(() => setShareSuccess(""), 2500);
    } catch (e) {
      // Rollback optimistic update
      setSetters((prev) => prev.map((s) => (s.setter_id === setterId ? { ...s, immediate_new_leads: currentVal } : s)));
      setShareError(e?.message || "Erreur lors de la mise à jour.");
    } finally {
      setSavingSetterId(null);
    }
  };

  // ── Absences handlers ──
  const handleAddVacation = async () => {
    setVacError("");
    if (!newVacStart || !newVacEnd) { setVacError("Renseigne les deux dates."); return; }
    if (newVacEnd < newVacStart) { setVacError("La date de fin doit être après le début."); return; }
    setVacLoading(true);
    try {
      await apiClient.post("/api/v1/users/me/unavailability", {
        start_date: newVacStart,
        end_date: newVacEnd,
        absence_type: newVacType,
        description: newVacDesc.trim() || null,
      });
      setNewVacStart("");
      setNewVacEnd("");
      setNewVacType("conge");
      setNewVacDesc("");
      await fetchMyUnavailability();
    } catch (e) {
      const msg = e?.message || "";
      setVacError(/409|chevauch/i.test(msg) || e?.status === 409
        ? "Cette période chevauche une absence déjà déclarée."
        : (msg || "Erreur lors de l'ajout de l'absence."));
    } finally {
      setVacLoading(false);
    }
  };

  const handleDeleteVacation = async (id) => {
    try {
      await apiClient.delete(`/api/v1/users/me/unavailability/${id}`);
      setMyUnavailability((list) => list.filter((v) => v.id !== id));
    } catch (e) {
      setVacError(e?.message || "Erreur lors de la suppression.");
    }
  };

  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    surface: darkMode ? "#13141b" : "#edf0f8",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    secondary: darkMode ? "#8b8fa0" : "#6b7280",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
    subtle: darkMode ? "#252636" : "#f4f6fb",
    shadow: darkMode
      ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)"
      : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: `1px solid ${C.border}`,
    background: C.subtle,
    color: C.text,
    fontSize: "14px",
    fontFamily: "Inter, sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const cardStyle = {
    background: C.bg,
    borderRadius: "24px",
    padding: "32px 28px",
    boxShadow: C.shadow,
  };

  // Colonnes responsive : 2 côte à côte sur large écran, 1 seule sur mobile
  // (flex-wrap quand la largeur ne tient plus 2 colonnes de ~400px).
  const colStyle = { flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 };

  const errBox = {
    padding: "10px 14px", borderRadius: "10px",
    background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2",
    color: "#ef4444", fontSize: "13px", marginBottom: "16px",
    border: `1px solid ${darkMode ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
  };
  const okBox = {
    padding: "10px 14px", borderRadius: "10px",
    background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
    color: "#22c55e", fontSize: "13px", marginBottom: "16px",
    border: `1px solid ${darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0"}`,
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

  // Absences : formatage période + nb de jours
  const fmtVacRange = (a) => {
    const f = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    return a.start_date === a.end_date ? `Le ${f(a.start_date)}` : `${f(a.start_date)} → ${f(a.end_date)}`;
  };
  const vacDays = (a) => Math.round((new Date(a.end_date) - new Date(a.start_date)) / 86400000) + 1;

  const isCloser = ['sales', 'head_of_sales', 'head_of_sales_manager', 'admin'].includes(session?.role);
  const roleLabel = ROLE_LABELS[session?.role] || session?.role || "";
  const displayName = session?.name || session?.full_name || (session?.email || "").split("@")[0];

  // ── Cartes (réutilisées dans la grille 2 colonnes) ──
  const absencesCard = (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
        Absences
      </h2>
      <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 24px", lineHeight: 1.5 }}>
        Déclarez vos congés, arrêts ou indisponibilités. Votre équipe RH les voit automatiquement.
      </p>

      {/* Liste des absences déclarées */}
      {myUnavailability.length === 0 ? (
        <div style={{
          padding: "18px", borderRadius: "12px", textAlign: "center",
          background: C.subtle, border: `1px dashed ${C.border}`,
          color: C.muted, fontSize: "13px", marginBottom: "20px",
        }}>
          Aucune absence déclarée.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "22px" }}>
          {myUnavailability.map((a) => {
            const meta = ABSENCE_TYPE_META[a.absence_type] || ABSENCE_TYPE_META.absence;
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: "12px",
                border: `1px solid ${C.border}`, background: C.subtle,
              }}>
                <div style={{ width: 6, height: 36, borderRadius: 4, background: meta.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    {fmtVacRange(a)}
                    <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.color + "1e", borderRadius: 5, padding: "1px 6px" }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                    {vacDays(a)} j{a.description && a.description.trim() ? ` · ${a.description.trim()}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVacation(a.id)}
                  title="Supprimer cette absence"
                  style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                    border: `1px solid ${C.border}`, background: "transparent",
                    color: "#ef4444", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.secondary, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 14px" }}>
        Nouvelle absence
      </div>

      {vacError && <div style={errBox}>{vacError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>Du</label>
          <input type="date" value={newVacStart} min={TODAY_ISO}
            onChange={(e) => setNewVacStart(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = C.accent)}
            onBlur={(e) => (e.target.style.borderColor = C.border)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>Au</label>
          <input type="date" value={newVacEnd} min={newVacStart || TODAY_ISO}
            onChange={(e) => setNewVacEnd(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = C.accent)}
            onBlur={(e) => (e.target.style.borderColor = C.border)} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>Type</label>
        <select value={newVacType} onChange={(e) => setNewVacType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          {Object.entries(ABSENCE_TYPE_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>Description (optionnel)</label>
        <input type="text" value={newVacDesc} maxLength={200}
          placeholder="Ex : rdv médical, formation…"
          onChange={(e) => setNewVacDesc(e.target.value)}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)} />
      </div>

      <button
        onClick={handleAddVacation}
        disabled={vacLoading}
        style={{
          width: "100%", padding: "13px 0", borderRadius: "12px", border: "none",
          background: vacLoading ? C.muted : C.accent, color: "#fff", fontSize: "15px",
          fontWeight: 600, fontFamily: "Inter, sans-serif",
          cursor: vacLoading ? "not-allowed" : "pointer", transition: "background 0.2s",
        }}
        onMouseEnter={(e) => { if (!vacLoading) e.currentTarget.style.filter = "brightness(1.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
      >
        {vacLoading ? "Ajout..." : "Ajouter cette période"}
      </button>
    </div>
  );

  const workingDaysCard = (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
        Jours de travail
      </h2>
      <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 24px" }}>
        Sélectionnez les jours où vous travaillez. Cela affecte vos EOD attendus.
      </p>

      {wdError && <div style={errBox}>{wdError}</div>}
      {wdSuccess && <div style={okBox}>{wdSuccess}</div>}

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
  );

  const passwordCard = (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
        Mot de passe
      </h2>
      <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 24px" }}>
        Modifiez votre mot de passe de connexion.
      </p>

      {pwError && <div style={errBox}>{pwError}</div>}
      {pwSuccess && <div style={okBox}>{pwSuccess}</div>}

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
  );

  const prefsCard = (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: C.text }}>
        Partage avec setter
      </h2>
      <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 20px", lineHeight: 1.5 }}>
        Cochez les setters qui voient vos nouveaux leads en <strong style={{ color: C.text }}>immédiat</strong>.
        Les autres setters rattachés les reçoivent quand même, mais après <strong style={{ color: C.text }}>24h</strong>.
      </p>

      {shareError && <div style={errBox}>{shareError}</div>}
      {shareSuccess && <div style={okBox}>{shareSuccess}</div>}

      {setters.length === 0 ? (
        <div style={{
          padding: "14px 18px", borderRadius: 14, border: `1px dashed ${C.border}`,
          background: C.subtle, color: C.muted, fontSize: 13,
        }}>
          Aucun setter rattaché pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {setters.map((s) => {
            const saving = savingSetterId === s.setter_id;
            const on = !!s.immediate_new_leads;
            return (
              <div
                key={s.setter_id}
                onClick={() => { if (!saving) toggleSetterImmediate(s.setter_id, on); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px", borderRadius: "14px",
                  border: `1px solid ${C.border}`, background: C.subtle,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!saving) e.currentTarget.style.borderColor = C.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: C.text, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.full_name || s.email}
                  </span>
                  {s.target_type === "team" && (
                    <span title="Rattachement via équipe : le réglage s'applique à toute l'équipe" style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: `1px solid ${C.border}`, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>équipe</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, color: on ? C.accent : C.muted, flexShrink: 0 }}>
                    {on ? "immédiat" : "24h"}
                  </span>
                </span>
                <div style={{
                  width: "44px", height: "24px", borderRadius: "999px",
                  background: on ? C.accent : (darkMode ? "#3a3b48" : "#d1d5db"),
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: "2px",
                    left: on ? "22px" : "2px",
                    width: "20px", height: "20px", borderRadius: "50%",
                    background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* P4 : toggle force R1 setter -> mon agenda */}
      <p style={{ fontSize: "12px", color: C.muted, margin: "20px 0 8px", lineHeight: 1.5 }}>
        Si activé, tous les R1 placés par votre setter créent automatiquement un événement
        dans votre agenda Google (override le choix du setter). Désactivé par défaut.
      </p>
      {forceR1Error && (
        <div style={{ padding: "8px 12px", borderRadius: 10, background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#ef4444", fontSize: 12, marginBottom: 12, border: `1px solid ${darkMode ? "rgba(239,68,68,0.25)" : "#fecaca"}` }}>{forceR1Error}</div>
      )}
      {forceR1Success && (
        <div style={{ padding: "8px 12px", borderRadius: 10, background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4", color: "#22c55e", fontSize: 12, marginBottom: 12, border: `1px solid ${darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0"}` }}>{forceR1Success}</div>
      )}
      <div
        onClick={() => { if (!forceR1Loading) toggleForceR1(); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderRadius: "14px",
          border: `1px solid ${C.border}`, background: C.subtle,
          cursor: forceR1Loading ? "not-allowed" : "pointer",
          opacity: forceR1Loading ? 0.7 : 1, transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (!forceR1Loading) e.currentTarget.style.borderColor = C.accent; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: "Inter, sans-serif" }}>
          Forcer les R1 setter dans mon agenda
        </span>
        <div style={{
          width: 44, height: 24, borderRadius: 999,
          background: forceR1 ? C.accent : (darkMode ? "#3a3b48" : "#d1d5db"),
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", top: 2,
            left: forceR1 ? 22 : 2,
            width: 20, height: 20, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }} />
        </div>
      </div>
    </div>
  );

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

      <div style={{ maxWidth: 1040, margin: "28px auto 64px", padding: "0 20px" }}>
        {/* ─── Identité ─── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 4px 22px" }}>
          {session?.avatar_url ? (
            <img src={session.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(180deg, ${C.accent} 0%, ${darkMode ? "#4a57a0" : "#4a56a8"} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 22, fontWeight: 700,
            }}>{(displayName || "?").charAt(0).toUpperCase()}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", textTransform: "capitalize" }}>{displayName}</div>
            <div style={{ fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ wordBreak: "break-all" }}>{session?.email}</span>
              {roleLabel && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: darkMode ? "rgba(124,138,219,0.16)" : "rgba(91,106,191,0.12)", borderRadius: 6, padding: "2px 8px" }}>{roleLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Grille 2 colonnes (responsive : empile sur mobile) ─── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          {/* Colonne gauche : Absences + Préférences (closers) */}
          <div style={colStyle}>
            {absencesCard}
            {isCloser && prefsCard}
          </div>
          {/* Colonne droite : Jours de travail + Mot de passe */}
          <div style={colStyle}>
            {workingDaysCard}
            {passwordCard}
          </div>
        </div>
      </div>

      {/* ─── Confirmation Modal (jours de travail) ─── */}
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
              Vos jours de travail déterminent les jours où vous recevez des leads. Vous pouvez les modifier à tout moment.
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
