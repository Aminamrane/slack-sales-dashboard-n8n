import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";

/**
 * Monitoring interne (côté Owner, ADMIN only) de l'auto-affectation RDV Opti'Lex.
 *
 * Même principe que le monitoring de l'auto-affectation Owner, mais pour les RDV
 * fiscaux/sociaux pris par le dev externe via l'API. On visualise l'équité : combien
 * de RDV actifs chaque juriste a reçus, par équipe, + les derniers RDV pris.
 *
 * Endpoint (require_admin) : GET /api/v1/optilex-rdv/monitoring
 */

const TEAM_TONE = {
  fiscal: { fg: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  social: { fg: "#0d9488", bg: "rgba(13,148,136,0.12)" },
};

const STATUS = {
  booked: { label: "Actif", color: "#10b981" },
  cancelled: { label: "Annulé", color: "#9ca3af" },
};
const statusInfo = (s) => STATUS[s] || { label: s || "—", color: "#9ca3af" };

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

export default function OptilexRdvMonitoring() {
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
  const [data, setData] = useState(null);
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

  // Chargement + poll léger (20s)
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    const load = async () => {
      try {
        const d = await apiClient.get("/api/v1/optilex-rdv/monitoring");
        if (!cancelled) { setData(d); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hasAccess]);

  if (!hasAccess) return null;

  const teams = data?.teams || {};
  const recent = data?.recent || [];

  return (
    <div style={{ minHeight: "100vh", background: C.page, color: C.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} session={session} />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 20px 60px" }}>
        {/* En-tête */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Auto-affectation RDV Opti'Lex
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.12)", padding: "3px 9px", borderRadius: 50 }}>
              ADMIN
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.secondary }}>
            Répartition des RDV pris par les clients (via l'API partenaire) : priorité à la disponibilité, puis équité stricte par juriste.
          </p>
        </motion.div>

        {loading && !data && (
          <div style={{ padding: 60, textAlign: "center", color: C.muted }}>Chargement…</div>
        )}
        {error && !data && (
          <div style={{ padding: 24, borderRadius: 14, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Équipes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16, marginBottom: 20 }}>
          {["fiscal", "social"].map((tid) => {
            const t = teams[tid];
            if (!t) return null;
            const maxA = Math.max(1, ...t.juristes.map((j) => j.active));
            const tone = TEAM_TONE[tid];
            const balanced = (t.equity_gap ?? 0) <= 1;
            return (
              <motion.div key={tid} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: tone.fg }}>Équipe {t.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{t.juristes.length} juristes</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 50,
                    color: balanced ? "#10b981" : "#f59e0b",
                    background: balanced ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }}>
                    {balanced ? "Équilibré" : `Écart ${t.equity_gap}`}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 18, marginBottom: 16, fontSize: 12, color: C.secondary }}>
                  <span><b style={{ color: C.text, fontSize: 18 }}>{t.totals.active}</b> RDV actifs</span>
                  <span><b style={{ color: C.text, fontSize: 18 }}>{t.totals.cancelled}</b> annulés</span>
                </div>

                {/* Barres d'équité par juriste */}
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {t.juristes.map((j, i) => (
                    <div key={j.email} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 120, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        title={j.email}>
                        {j.name}
                      </span>
                      <div style={{ flex: 1, height: 9, borderRadius: 50, background: C.subtle, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(j.active / maxA) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.05 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", borderRadius: 50, background: tone.fg, minWidth: j.active > 0 ? 6 : 0 }} />
                      </div>
                      <span style={{ width: 26, textAlign: "right", flexShrink: 0, fontSize: 13, fontWeight: 700, color: j.active > 0 ? C.text : C.muted, fontVariantNumeric: "tabular-nums" }}>
                        {j.active}
                      </span>
                    </div>
                  ))}
                </div>
                {t.totals.total === 0 && (
                  <p style={{ margin: "14px 0 0", fontSize: 12, color: C.muted }}>En attente des premiers RDV.</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Derniers RDV */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadow, padding: "20px 22px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Derniers RDV pris</h2>
          {recent.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Aucun RDV pour le moment.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Pris le</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Équipe</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Juriste</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Client</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>RDV le</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Statut</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Meet</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {recent.map((r) => {
                      const tone = TEAM_TONE[r.team] || TEAM_TONE.fiscal;
                      const st = statusInfo(r.status);
                      return (
                        <motion.tr key={r.booking_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px", color: C.secondary, whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</td>
                          <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, padding: "2px 8px", borderRadius: 50 }}>
                              {r.team}
                            </span>
                            {r.mode === "targeted" && (
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.muted }}>ciblé</span>
                            )}
                          </td>
                          <td style={{ padding: "8px", fontWeight: 600 }} title={r.juriste_email}>{r.juriste}</td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ fontWeight: 500 }}>{r.client_name || "—"}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{r.client_email}</div>
                          </td>
                          <td style={{ padding: "8px", color: C.secondary, whiteSpace: "nowrap" }}>{fmtDateTime(r.slot_start)}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                          </td>
                          <td style={{ padding: "8px" }}>
                            {r.meet_link ? (
                              <a href={r.meet_link} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12, fontWeight: 600 }}>ouvrir</a>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
