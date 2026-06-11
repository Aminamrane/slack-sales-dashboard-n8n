import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

/**
 * Pilotage interne du split de contrats Owner / Opti'Lex.
 *
 * Le mode global vit dans contract_split_settings.split_mode :
 *   - off       : tout le monde sur le système actuel (Owner + Opti'Lex groupés, 1 signature)
 *   - per_sales : split uniquement pour les sales cochés (users.contract_split_optilex_enabled)
 *   - all       : split pour tout le monde (nouveaux sales inclus)
 *
 * Endpoints (require_admin) :
 *   GET   /api/v1/admin/contract-split
 *   PUT   /api/v1/admin/contract-split/mode          { mode }
 *   PATCH /api/v1/admin/contract-split/sales/{id}    { enabled }
 *
 * Page interne, admin only. À basculer côté nav plus tard.
 */

const MODES = [
  {
    key: "off",
    label: "Système actuel",
    tag: "Fallback",
    icon: "🛡️",
    tone: "#10b981",
    desc: "Tout le monde signe en une fois — contrat Owner + convention Opti'Lex groupés dans une seule signature. Le système actuel, éprouvé en production.",
  },
  {
    key: "per_sales",
    label: "Par sale",
    tag: "Granulaire",
    icon: "🎯",
    tone: "#6366f1",
    desc: "Seuls les sales que tu actives ci-dessous passent en split (deux signatures séparées). Tous les autres restent sur le système actuel.",
  },
  {
    key: "all",
    label: "Tous en split",
    tag: "Global",
    icon: "🔀",
    tone: "#fb923c",
    desc: "Tout le monde envoie deux signatures séparées : Owner sur le compte Owner, convention sur le compte Opti'Lex. Les nouveaux sales sont inclus automatiquement.",
  },
];

const ROLE_LABEL = {
  sales: "Sales",
  head_of_sales: "Head of Sales",
  head_of_sales_manager: "Head of Sales Mgr",
  admin: "Admin",
};

export default function ContractSplitMonitoring() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = useMemo(() => ({
    bg: darkMode ? "#1e1f28" : "#ffffff",
    page: darkMode ? "#14151c" : "#f6f7f9",
    border: darkMode ? "#2a2b36" : "#e2e6ef",
    surface: darkMode ? "#13141b" : "#f6f7f9",
    text: darkMode ? "#eef0f6" : "#1e2330",
    muted: darkMode ? "#7c8090" : "#9ca3af",
    secondary: darkMode ? "#9aa0b2" : "#6b7280",
    subtle: darkMode ? "#252636" : "#f4f6fb",
    shadow: darkMode
      ? "0 1px 3px rgba(0,0,0,0.25), 0 8px 28px rgba(0,0,0,0.22)"
      : "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
  }), [darkMode]);

  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [savingMode, setSavingMode] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  // Accès : admin uniquement
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate("/login"); return; }
    if (user.role !== "admin") { navigate("/"); return; }
    setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });
    setHasAccess(true);
  }, [navigate]);

  // Chargement
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await apiClient.get("/api/v1/admin/contract-split");
        if (!cancelled) setState(d);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasAccess]);

  const flash = (msg, isErr = false) => {
    setToast({ msg, isErr, id: `${msg}-${isErr}` });
    setTimeout(() => setToast((t) => (t && t.id === `${msg}-${isErr}` ? null : t)), 2600);
  };

  const setMode = async (mode) => {
    if (!state || state.split_mode === mode || savingMode) return;
    const prev = state;
    setSavingMode(true);
    setState((s) => ({ ...s, split_mode: mode })); // optimistic
    try {
      const d = await apiClient.put("/api/v1/admin/contract-split/mode", { mode });
      setState(d);
      flash("Mode mis à jour");
    } catch {
      setState(prev);
      flash("Échec — réessaie", true);
    } finally {
      setSavingMode(false);
    }
  };

  const toggleSale = async (sale) => {
    if (savingId || state?.split_mode !== "per_sales") return;
    const next = !sale.split_enabled;
    setSavingId(sale.id);
    setState((s) => ({ ...s, sales: s.sales.map((x) => (x.id === sale.id ? { ...x, split_enabled: next } : x)) }));
    try {
      const d = await apiClient.patch(`/api/v1/admin/contract-split/sales/${sale.id}`, { enabled: next });
      setState(d);
    } catch {
      setState((s) => ({ ...s, sales: s.sales.map((x) => (x.id === sale.id ? { ...x, split_enabled: !next } : x)) }));
      flash("Échec — réessaie", true);
    } finally {
      setSavingId(null);
    }
  };

  const mode = state?.split_mode || "off";
  const sales = state?.sales || [];
  const activeCount = mode === "all" ? sales.length : mode === "off" ? 0 : sales.filter((s) => s.split_enabled).length;

  const pageWrap = {
    minHeight: "100vh",
    background: C.page,
    color: C.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 80,
  };
  const container = { maxWidth: 980, margin: "0 auto", padding: "28px 20px 0" };

  if (loading) {
    return (
      <div style={pageWrap}>
        <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
        <div style={container}>
          <div style={{ height: 38, width: 320, borderRadius: 10, background: C.subtle, marginBottom: 24 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 150, borderRadius: 16, background: C.subtle, animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <div style={{ height: 280, borderRadius: 16, background: C.subtle }} />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:.9} }`}</style>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <motion.div
        style={container}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
              Interne · Admin
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.4 }}>
              Split contrats — Owner / Opti'Lex
            </h1>
            <p style={{ margin: "8px 0 0", color: C.secondary, fontSize: 14.5, lineHeight: 1.5, maxWidth: 640 }}>
              Choisis qui envoie le contrat en <strong>deux signatures séparées</strong> (Owner + convention Opti'Lex)
              plutôt qu'en une seule. Réversible à tout instant : repasse sur « Système actuel » et tout le monde
              revient au fonctionnement éprouvé.
            </p>
          </div>
          <ModeBadge mode={mode} />
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: darkMode ? "#3a1d1d" : "#fef2f2", color: darkMode ? "#fca5a5" : "#b91c1c", border: `1px solid ${darkMode ? "#5b2a2a" : "#fecaca"}`, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Warning */}
        <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: darkMode ? "#2e2614" : "#fffbeb", border: `1px solid ${darkMode ? "#4d3f1a" : "#fde68a"}` }}>
          <span style={{ fontSize: 16, lineHeight: 1.2 }}>⚠️</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: darkMode ? "#e6cf8f" : "#92700e" }}>
            Avant d'activer le split en production, fais un <strong>envoi de test réel</strong> sur un sale test et
            vérifie que la convention arrive bien sur le compte Yousign Opti'Lex. L'envoi Opti'Lex part
            <strong> dans la foulée</strong> de l'envoi Owner.
          </span>
        </div>

        {/* Mode selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 24 }}>
          {MODES.map((m) => {
            const selected = mode === m.key;
            return (
              <motion.button
                key={m.key}
                onClick={() => setMode(m.key)}
                disabled={savingMode}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                style={{
                  position: "relative",
                  textAlign: "left",
                  cursor: savingMode ? "wait" : "pointer",
                  background: C.bg,
                  border: `1.5px solid ${selected ? m.tone : C.border}`,
                  borderRadius: 16,
                  padding: "16px 16px 18px",
                  boxShadow: selected ? `0 0 0 3px ${m.tone}22, ${C.shadow}` : C.shadow,
                  transition: "border-color .2s, box-shadow .2s",
                  overflow: "hidden",
                }}
              >
                {selected && (
                  <motion.div
                    layoutId="modeGlow"
                    style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${m.tone}14, transparent 60%)`, pointerEvents: "none" }}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  />
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, position: "relative" }}>
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: m.tone, background: `${m.tone}1a`, padding: "3px 8px", borderRadius: 20 }}>
                    {m.tag}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 750, marginBottom: 6, position: "relative" }}>{m.label}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.secondary, position: "relative" }}>{m.desc}</div>
                <AnimatePresence>
                  {selected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      style={{ position: "absolute", top: 14, right: 14, display: "none" }}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* Body : sales list (per_sales) or info panel */}
        <div style={{ marginTop: 26 }}>
          <AnimatePresence mode="wait">
            {mode === "per_sales" ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>Sales</h2>
                  <span style={{ fontSize: 13, color: C.secondary }}>
                    <strong style={{ color: C.text }}>{activeCount}</strong> / {sales.length} en split
                  </span>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow, overflow: "hidden" }}>
                  {sales.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        padding: "13px 16px",
                        borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                        background: s.split_enabled ? (darkMode ? "#1a2030" : "#fafbff") : "transparent",
                        transition: "background .2s",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.full_name || s.email}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {ROLE_LABEL[s.role] || s.role} · {s.contracts_sent} contrat{s.contracts_sent > 1 ? "s" : ""} envoyé{s.contracts_sent > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <EffectivePill enabled={s.split_enabled} C={C} />
                        <Toggle on={s.split_enabled} busy={savingId === s.id} onClick={() => toggleSale(s)} tone="#6366f1" />
                      </div>
                    </motion.div>
                  ))}
                  {sales.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 14 }}>Aucun sale trouvé.</div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow, padding: "26px 22px", textAlign: "center" }}
              >
                <div style={{ fontSize: 30, marginBottom: 10 }}>{mode === "all" ? "🔀" : "🛡️"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                  {mode === "all" ? "Tous les sales sont en split" : "Tous les sales sont sur le système actuel"}
                </div>
                <div style={{ fontSize: 13.5, color: C.secondary, maxWidth: 460, margin: "0 auto", lineHeight: 1.55 }}>
                  {mode === "all"
                    ? "Chaque contrat part en deux signatures séparées (Owner + Opti'Lex). Pour choisir au cas par cas, passe en mode « Par sale »."
                    : "Chaque contrat part comme aujourd'hui : une seule signature groupée. Pour activer le split sur certains sales, passe en mode « Par sale »."}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ marginTop: 22, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Owner reste strictement inchangé dans tous les cas — l'envoi Opti'Lex est additionnel et ne peut
          jamais bloquer l'envoi du contrat Owner.
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)",
              background: toast.isErr ? "#dc2626" : "#111827",
              color: "#fff", padding: "11px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600,
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 1000,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Sous-composants ---------- */

function ModeBadge({ mode }) {
  const m = MODES.find((x) => x.key === mode) || MODES[0];
  return (
    <motion.div
      key={mode}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
        background: `${m.tone}1a`, color: m.tone, border: `1px solid ${m.tone}44`,
        padding: "7px 13px", borderRadius: 30, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.tone, boxShadow: `0 0 0 3px ${m.tone}33` }} />
      {m.label}
    </motion.div>
  );
}

function EffectivePill({ enabled, C }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      padding: "3px 9px", borderRadius: 20,
      color: enabled ? "#fb923c" : C.muted,
      background: enabled ? "#fb923c1a" : C.subtle,
      border: `1px solid ${enabled ? "#fb923c44" : C.border}`,
    }}>
      {enabled ? "Split" : "Actuel"}
    </span>
  );
}

function Toggle({ on, busy, onClick, tone = "#6366f1" }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      style={{
        position: "relative", width: 46, height: 27, borderRadius: 20, border: "none",
        cursor: busy ? "wait" : "pointer", padding: 0,
        background: on ? tone : "#cbd0db",
        opacity: busy ? 0.6 : 1, transition: "background .25s",
        flexShrink: 0,
      }}
    >
      <motion.span
        animate={{ x: on ? 21 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        style={{
          position: "absolute", top: 2, left: 0, width: 23, height: 23, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}
