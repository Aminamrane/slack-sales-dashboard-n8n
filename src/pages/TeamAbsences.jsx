import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

// Page /equipe (admin/hr). Onglet Équipe = vrais users (/users) ; onglet Absences = vraies absences
// de l'équipe (/team-unavailability). Type/description/validation des absences = plus tard (#2).

const COLORS = { primary: "#6366f1", secondary: "#fb923c", tertiary: "#10b981" };
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const WEEKDAYS = [["1", "LUN"], ["2", "MAR"], ["3", "MER"], ["4", "JEU"], ["5", "VEN"], ["6", "SAM"], ["7", "DIM"]];
const ABSENCE_TYPE_META = { conge: { label: "Congé", color: "#f59e0b" }, maladie: { label: "Maladie", color: "#ef4444" }, absence: { label: "Absence", color: "#ec4899" }, autre: { label: "Autre", color: "#6366f1" } };

const ROLE_LABELS = {
  admin: "Admin", sales: "Sales", setter: "Setter", hr: "RH", ceo: "CEO",
  head_of_sales: "Head of Sales", head_of_sales_manager: "Manager Sales",
  finance_director: "Dir. Finance", finance_team: "Finance",
  acquisition_director: "Dir. Acquisition", tech: "Tech", marketing: "Marketing",
  customer_success_manager: "CSM",
};

export default function TeamAbsences({ embed = false }) {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    if (embed) return; // en embed, la coquille (CeoCongesView) pilote la classe dark-mode du body
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode, embed]);
  // En embed, on SUIT le thème piloté par la coquille (lecture de la classe body).
  useEffect(() => {
    if (!embed) return;
    const id = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((p) => (p !== isDark ? isDark : p));
    }, 500);
    return () => clearInterval(id);
  }, [embed]);

  const C = {
    bg: darkMode ? "#1e1f28" : "#ffffff",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    surface: darkMode ? "#13141b" : "#f6f7f9",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#5e6273" : "#9ca3af",
    subtle: darkMode ? "#252636" : "#f4f6fb",
    accent: darkMode ? "#7c8adb" : "#5b6abf",
  };

  const [session, setSession] = useState(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate("/login"); return; }
    setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });
    // En embed, la coquille (CeoCongesView) a déjà filtré le rôle -> on rend le contenu.
    // En standalone (/equipe) : coin RH réservé admin + hr.
    if (embed) { setOk(true); return; }
    if (user.role === "admin" || user.role === "hr") setOk(true); else navigate("/");
  }, [navigate, embed]);

  const [tab, setTab] = useState("absences");
  const [calMonth] = useState(() => new Date());
  const [members, setMembers] = useState(null);   // onglet Équipe (null = chargement)
  const [absences, setAbsences] = useState(null);  // onglet Absences = vraies absences équipe
  const [busyId, setBusyId] = useState(null);      // absence en cours de validation/refus

  // Déclarer une absence POUR un membre (RH/CEO/admin -> tout le monde).
  const [declUsers, setDeclUsers] = useState([]);
  const [declTarget, setDeclTarget] = useState("");
  const [declStart, setDeclStart] = useState("");
  const [declEnd, setDeclEnd] = useState("");
  const [declType, setDeclType] = useState("conge");
  const [declDesc, setDeclDesc] = useState("");
  const [declError, setDeclError] = useState("");
  const [declSuccess, setDeclSuccess] = useState("");
  const [declBusy, setDeclBusy] = useState(false);

  // Onglet Équipe : vrais utilisateurs (admin only). Lazy au 1er affichage de l'onglet.
  useEffect(() => {
    if (!ok || tab !== "equipe" || members !== null) return;
    apiClient.getUsers()
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]));
  }, [ok, tab, members]);

  // Onglet Absences : vraies absences de l'équipe (en cours + à venir), via le nouvel endpoint.
  useEffect(() => {
    if (!ok) return;
    apiClient.get("/api/v1/team-unavailability")
      .then((data) => setAbsences(Array.isArray(data) ? data : []))
      .catch(() => setAbsences([]));
  }, [ok]);

  // Personnes pour qui on peut déclarer une absence (RH/CEO/admin -> tous les actifs).
  useEffect(() => {
    if (!ok) return;
    apiClient.get("/api/v1/users/manageable")
      .then((data) => setDeclUsers(Array.isArray(data) ? data : []))
      .catch(() => setDeclUsers([]));
  }, [ok]);

  if (!ok) return <div style={{ minHeight: embed ? 240 : "100vh", background: embed ? "transparent" : C.surface }} />;
  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 14, boxShadow: darkMode ? "none" : "0 1px 2px rgba(0,0,0,0.03)" };
  const declInput = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid " + C.border, background: C.subtle, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const fmtJM = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const rangeLabel = (a) => (a.start_date === a.end_date ? "le " + fmtJM(a.start_date) : "du " + fmtJM(a.start_date) + " au " + fmtJM(a.end_date));
  // Jours posés par personne (mois courant + à venir), dérivé des vraies absences.
  const daysByPerson = Object.entries((absences || []).reduce((m, a) => ((m[a.full_name] = (m[a.full_name] || 0) + (a.days || 0)), m), {}))
    .map(([name, days]) => ({ name, days })).sort((x, y) => y.days - x.days);

  // VALIDER = pose validated_at (le robot ne change rien). REFUSER = annule l'absence -> dispo + leads.
  const validateAbs = async (a) => {
    setBusyId(a.id);
    try {
      await apiClient.post(`/api/v1/users/${a.user_id}/unavailability/${a.id}/validate`, {});
      setAbsences((list) => (list || []).map((x) => (x.id === a.id ? { ...x, validated_at: new Date().toISOString() } : x)));
    } catch (e) { window.alert("Échec de la validation : " + (e?.message || e)); }
    setBusyId(null);
  };
  const refuseAbs = async (a) => {
    if (!window.confirm(`Refuser l'absence de ${a.full_name} (${rangeLabel(a)}) ?\nElle sera annulée et la personne recevra de nouveau des leads sur ces dates.`)) return;
    setBusyId(a.id);
    try {
      await apiClient.post(`/api/v1/users/${a.user_id}/unavailability/${a.id}/refuse`, {});
      setAbsences((list) => (list || []).filter((x) => x.id !== a.id));
    } catch (e) { window.alert("Échec du refus : " + (e?.message || e)); }
    setBusyId(null);
  };

  // Déclarer une absence pour la personne choisie. Le backend déclenche aussi la
  // notif RH/admin + les events agenda (cross-user POST /users/{id}/unavailability).
  const handleDeclare = async () => {
    setDeclError(""); setDeclSuccess("");
    if (!declTarget) { setDeclError("Choisis une personne."); return; }
    if (!declStart || !declEnd) { setDeclError("Renseigne les deux dates."); return; }
    if (declEnd < declStart) { setDeclError("La date de fin doit être après le début."); return; }
    setDeclBusy(true);
    try {
      await apiClient.post(`/api/v1/users/${declTarget}/unavailability`, {
        start_date: declStart, end_date: declEnd, absence_type: declType, description: declDesc.trim() || null,
      });
      const data = await apiClient.get("/api/v1/team-unavailability");
      setAbsences(Array.isArray(data) ? data : []);
      setDeclSuccess("Absence déclarée.");
      setDeclTarget(""); setDeclStart(""); setDeclEnd(""); setDeclType("conge"); setDeclDesc("");
      setTimeout(() => setDeclSuccess(""), 2500);
    } catch (e) {
      const msg = e?.message || "";
      setDeclError(/409|chevauch/i.test(msg) ? "Cette période chevauche une absence déjà déclarée." : (msg || "Échec de la déclaration."));
    } finally { setDeclBusy(false); }
  };

  // Distingue passé / à venir (date du jour locale en YYYY-MM-DD, comparaison de chaines).
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
  const isPastAbs = (a) => a.end_date < todayStr && !a.active_now;
  const upcomingAbs = (absences || []).filter((a) => !isPastAbs(a));
  const pastAbs = (absences || []).filter((a) => isPastAbs(a));

  // Une ligne d'absence. `past` = grisée + lecture seule (validable/refusable n'a plus de sens).
  const absenceRow = (a, i, arr, past) => (
    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px dashed " + C.border : "none", animation: "rowIn 0.3s ease both", opacity: past ? 0.6 : 1 }}>
      {a.avatar_url
        ? <img src={a.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: 34, height: 34, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{(a.full_name || "?").charAt(0)}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {a.full_name}
          {(() => { const m = ABSENCE_TYPE_META[a.absence_type] || ABSENCE_TYPE_META.conge; return <span style={{ fontSize: 9.5, fontWeight: 700, color: m.color, background: m.color + "1e", borderRadius: 5, padding: "1px 6px" }}>{m.label}</span>; })()}
          {!past && a.active_now && <span style={{ fontSize: 9.5, fontWeight: 700, color: COLORS.secondary, background: COLORS.secondary + "1e", borderRadius: 5, padding: "1px 6px" }}>EN COURS</span>}
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{rangeLabel(a)} · {a.days} j</div>
        {a.description && a.description.trim() && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, fontStyle: "italic", paddingLeft: 9, borderLeft: "2px solid " + C.border, lineHeight: 1.45 }}>{a.description.trim()}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {a.validated_at
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: COLORS.tertiary }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Validé</span>
          : past
            ? <span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>Passé</span>
            : <button onClick={() => validateAbs(a)} disabled={busyId === a.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "none", background: COLORS.tertiary, color: "#fff", fontSize: 12, fontWeight: 600, cursor: busyId === a.id ? "wait" : "pointer", fontFamily: "inherit", opacity: busyId === a.id ? 0.6 : 1 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Valider</button>}
        {!past && <button onClick={() => refuseAbs(a)} disabled={busyId === a.id} title="Annule l'absence : la personne reçoit de nouveau des leads à ces dates" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid " + C.border, background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: busyId === a.id ? "wait" : "pointer", fontFamily: "inherit", opacity: busyId === a.id ? 0.6 : 1 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Refuser</button>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : C.surface, fontFamily: FONT }}>
      {!embed && <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}`}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 24px 60px", animation: "fadeUp 0.4s ease both" }}>

        {/* Header + tabs */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>Équipe & Congés</h1>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Module RH · Admin</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: C.subtle, border: "1px solid " + C.border }}>
            {[["equipe", "Équipe"], ["absences", "Absences"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: tab === k ? (darkMode ? "#fff" : "#1e2330") : "transparent", color: tab === k ? (darkMode ? "#1e2330" : "#fff") : C.muted, transition: "all 0.15s" }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── ONGLET ABSENCES ── */}
        {tab === "absences" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, alignItems: "start" }}>

            {/* Colonne gauche : à venir / en cours + passés (RÉEL) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ ...card, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Absences à venir</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.secondary, background: COLORS.secondary + "18", borderRadius: 20, padding: "2px 9px" }}>{absences ? upcomingAbs.length : "…"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {absences === null && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 10px" }}>Chargement…</div>}
                  {absences && upcomingAbs.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 10px" }}>Aucune absence à venir 🎉</div>}
                  {upcomingAbs.map((a, i) => absenceRow(a, i, upcomingAbs, false))}
                </div>
              </div>

              {absences && pastAbs.length > 0 && (
                <div style={{ ...card, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>Congés passés</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>· ce mois</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, background: C.muted + "1e", borderRadius: 20, padding: "2px 9px" }}>{pastAbs.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {pastAbs.map((a, i) => absenceRow(a, i, pastAbs, true))}
                  </div>
                </div>
              )}

              {/* Déclarer une absence POUR un membre (RH/CEO/admin) */}
              <div style={{ ...card, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Déclarer une absence pour un membre</span>
                </div>
                {declError && <div style={{ padding: "8px 12px", borderRadius: 8, background: darkMode ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#ef4444", fontSize: 12, marginBottom: 10, border: "1px solid " + (darkMode ? "rgba(239,68,68,0.25)" : "#fecaca") }}>{declError}</div>}
                {declSuccess && <div style={{ padding: "8px 12px", borderRadius: 8, background: darkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4", color: "#22c55e", fontSize: 12, marginBottom: 10, border: "1px solid " + (darkMode ? "rgba(34,197,94,0.25)" : "#bbf7d0") }}>{declSuccess}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <select value={declTarget} onChange={(e) => setDeclTarget(e.target.value)} style={{ ...declInput, cursor: "pointer" }}>
                    <option value="">Choisir une personne…</option>
                    {declUsers.filter((u) => !u.is_self).map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input type="date" value={declStart} min={todayStr} onChange={(e) => setDeclStart(e.target.value)} style={declInput} />
                    <input type="date" value={declEnd} min={declStart || todayStr} onChange={(e) => setDeclEnd(e.target.value)} style={declInput} />
                  </div>
                  <select value={declType} onChange={(e) => setDeclType(e.target.value)} style={{ ...declInput, cursor: "pointer" }}>
                    {Object.entries(ABSENCE_TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                  </select>
                  <input type="text" value={declDesc} maxLength={200} placeholder="Description (optionnel)" onChange={(e) => setDeclDesc(e.target.value)} style={declInput} />
                  <button onClick={handleDeclare} disabled={declBusy} style={{ padding: "10px 0", borderRadius: 9, border: "none", background: declBusy ? C.muted : C.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: declBusy ? "wait" : "pointer", fontFamily: "inherit" }}>{declBusy ? "Déclaration…" : "Déclarer l'absence"}</button>
                </div>
              </div>
            </div>

            {/* Colonne droite : calendrier réel + jours posés */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Calendrier */}
              <div style={{ ...card, padding: "16px 18px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Suivi des absences</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{calMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · équipe</div>
                </div>
                <MonthGrid month={calMonth} absences={absences || []} C={C} darkMode={darkMode} />
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + C.border }}>
                  {Object.values(ABSENCE_TYPE_META).map((m) => (
                    <span key={m.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.muted }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color }} />{m.label}
                    </span>
                  ))}
                  <span style={{ fontSize: 11.5, color: C.muted }}>· Week-ends grisés</span>
                </div>
              </div>

              {/* Jours d'absence posés (réel) */}
              <div style={{ ...card, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, marginBottom: 12 }}>Jours d'absence posés (mois courant + à venir)</div>
                {daysByPerson.length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>Personne n'a d'absence à venir.</div>}
                {daysByPerson.map((b, i) => (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < daysByPerson.length - 1 ? "1px dashed " + C.border : "none" }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.secondary, fontVariantNumeric: "tabular-nums" }}>{b.days} j</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ONGLET ÉQUIPE ── */}
        {tab === "equipe" && (
          <div style={{ ...card, padding: "6px 16px 10px", overflowX: "auto" }}>
            {members === null ? (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "50px 10px" }}>Chargement…</div>
            ) : members.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "50px 10px" }}>Aucun utilisateur à afficher</div>
            ) : (
              <table className="perfv2" style={{ width: "100%", minWidth: 640 }}>
                <thead><tr>
                  <th style={{ textAlign: "left" }}>Membre</th><th style={{ textAlign: "left" }}>Rôle</th>
                  <th style={{ textAlign: "center" }}>Jours dispo</th><th style={{ textAlign: "center" }}>Statut</th>
                </tr></thead>
                <tbody>
                  {members.map((m) => {
                    const wd = m.working_days || [];
                    const inactive = m.is_active === false;
                    return (
                      <tr key={m.id} style={{ opacity: inactive ? 0.5 : 1 }}>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {m.avatar_url
                              ? <img src={m.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                              : <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{(m.full_name || "?").charAt(0)}</div>}
                            <div><div style={{ fontWeight: 650, fontSize: 13, color: C.text }}>{m.full_name}</div><div style={{ fontSize: 10.5, color: C.muted }}>{m.email}</div></div>
                          </div>
                        </td>
                        <td style={{ textAlign: "left", fontSize: 12.5, color: C.muted }}>{ROLE_LABELS[m.role] || m.role}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 3 }}>
                            {WEEKDAYS.map(([d, label]) => <span key={d} title={label} style={{ width: 18, height: 18, borderRadius: 5, fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", background: wd.includes(Number(d)) ? COLORS.tertiary + "22" : C.subtle, color: wd.includes(Number(d)) ? COLORS.tertiary : C.muted }}>{label[0]}</span>)}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {inactive
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, background: C.subtle, borderRadius: 6, padding: "3px 9px" }}>Inactif</span>
                            : <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.tertiary, background: COLORS.tertiary + "18", borderRadius: 6, padding: "3px 9px" }}>Actif</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function MonthGrid({ month, absences, C, darkMode }) {
  const cells = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // lundi=0
    const days = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < startDow; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(y, m, d));
    return out;
  }, [month]);
  // absences = vraies périodes [{start_date, end_date, full_name}] ; on teste la couverture jour par jour.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const covering = (d) => { const k = iso(d); return absences.filter((a) => a.start_date <= k && k <= a.end_date); };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 6 }}>
        {["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"].map((d) => <div key={d} style={{ fontSize: 9.5, fontWeight: 600, color: C.muted, textAlign: "center" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dow = (d.getDay() + 6) % 7;
          const weekend = dow >= 5;
          const cov = covering(d);
          return (
            <div key={i} title={cov.length ? cov.map((a) => a.full_name).join(", ") : undefined} style={{ minHeight: 46, borderRadius: 8, border: "1px solid " + C.border, padding: "5px 6px", background: weekend ? (darkMode ? "rgba(255,255,255,0.02)" : "#fafbfd") : C.bg, opacity: weekend ? 0.7 : 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: cov.length ? C.text : C.muted }}>{d.getDate()}</div>
              {cov.slice(0, 3).map((a, j) => <div key={j} style={{ height: 3, borderRadius: 2, marginTop: 3, background: (ABSENCE_TYPE_META[a.absence_type] || ABSENCE_TYPE_META.conge).color }} />)}
              {cov.length > 3 && <div style={{ fontSize: 8, color: C.muted, marginTop: 1, lineHeight: 1 }}>+{cov.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
