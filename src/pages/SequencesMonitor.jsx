// src/pages/SequencesMonitor.jsx
//
// Monitoring des séquences d'emails de réengagement (Broad / BTP / Restaurant).
// Vue lecture seule : état on/off par séquence, funnel par email, leads dans la
// séquence (à qui c'est envoyé, à quel sales), récupérés (rebookés/présentés/
// signés) et RDV pris. Consomme GET /api/v1/tracking/broad-sequence/monitoring.

import { useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";
import { getColors } from "./CeoDashboard.jsx";

const SEGMENT_LABEL = { injoignable: "Injoignable", refus_r1: "Refus R1", no_show: "No-show" };
const SEGMENT_COLOR = { injoignable: "#8b5cf6", refus_r1: "#f59e0b", no_show: "#ef4444" };

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

export default function SequencesMonitor({ embed }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const t = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((p) => (p !== isDark ? isDark : p));
    }, 500);
    return () => clearInterval(t);
  }, []);
  const C = useMemo(() => getColors(darkMode), [darkMode]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // clé de séquence sélectionnée
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState(null); // null=auto | "in_seq" | "eligible"

  const load = () => {
    setLoading(true);
    apiClient.get("/api/v1/tracking/broad-sequence/monitoring")
      .then((r) => {
        setData(r);
        setActive((prev) => prev || (r.sequences[0] && r.sequences[0].key));
        setLoading(false);
      })
      .catch((e) => { setError(e.message || "Erreur"); setLoading(false); });
  };
  useEffect(load, []);

  const seq = useMemo(() => (data ? data.sequences.find((s) => s.key === active) : null), [data, active]);

  // Au changement de séquence, on revient en mode auto (le défaut dépend de l'état on/off).
  useEffect(() => { setViewMode(null); }, [active]);

  // Deux vues : les leads réellement DANS la séquence (contactés) et le POOL éligible
  // (prospects qui seront ciblés). Défaut auto : séquence ON -> "dans la séquence",
  // OFF -> "éligibles" (ce qu'on veut voir tant que ça n'a pas tourné).
  const effView = viewMode || (seq && seq.enabled ? "in_seq" : "eligible");

  const rows = useMemo(() => {
    if (!seq) return { list: [], eligible: false, total: 0, truncated: false };
    const eligible = effView === "eligible";
    const base = eligible ? seq.eligible_sample : seq.contacted;
    const total = eligible ? seq.stats.eligible : seq.contacted.length;
    const ql = q.trim().toLowerCase();
    const list = !ql ? base : base.filter((r) =>
      `${r.full_name || ""} ${r.email || ""} ${r.sales || ""}`.toLowerCase().includes(ql));
    return { list, eligible, total, truncated: eligible && total > base.length };
  }, [seq, q, effView]);

  const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow };
  const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", position: "sticky", top: 0, background: C.subtle, borderBottom: `1px solid ${C.border}` };
  const td = { padding: "10px 12px", fontSize: 13, color: C.text, borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  const Kpi = ({ label, value, color, hint }) => (
    <div style={{ ...card, padding: "14px 16px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || C.text, marginTop: 4, lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );

  const Badge = ({ children, bg, fg }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>
  );

  const font = { fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" };

  if (loading) return <div style={{ ...font, padding: 40, color: C.muted }}>Chargement du monitoring…</div>;
  if (error) return <div style={{ ...font, padding: 40, color: "#ef4444" }}>Erreur : {error}</div>;
  if (!data || !seq) return <div style={{ ...font, padding: 40, color: C.muted }}>Aucune séquence.</div>;

  const st = seq.stats;

  return (
    <div style={{ ...font, minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : C.surface, padding: embed ? "8px 20px 28px" : "24px 28px", color: C.text }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Monitoring des séquences email</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Réengagement des prospects Meta non convertis en R1.</div>
        </div>
        <button onClick={load} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...font }}>Rafraîchir</button>
      </div>

      {/* Sélecteur de séquence + état on/off */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {data.sequences.map((s) => {
          const on = s.key === active;
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : C.bg, color: on ? "#fff" : C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, ...font }}>
              {s.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8, background: s.enabled ? "#dcfce7" : (on ? "rgba(255,255,255,0.2)" : C.subtle), color: s.enabled ? "#15803d" : (on ? "#fff" : C.muted) }}>
                {s.enabled ? "ACTIVE" : "OFF"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bandeau état */}
      {!seq.enabled && (
        <div style={{ ...card, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.secondary }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Séquence <strong style={{ margin: "0 3px", color: C.text }}>{seq.label}</strong> désactivée : aucun email n'est envoyé. Le tableau ci-dessous montre les <strong style={{ margin: "0 3px", color: C.text }}>{st.eligible}</strong> leads qui seront ciblés à l'activation.
        </div>
      )}

      {/* KPI */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Kpi label="Éligibles" value={st.eligible} hint="ciblés / à cibler" />
        <Kpi label="Emails envoyés" value={st.sent} color={C.accent} />
        <Kpi label="Clics" value={st.clicked} color="#0891b2" />
        <Kpi label="RDV repris" value={st.rebooked} color="#16a34a" hint="via la séquence" />
        <Kpi label="Présentés" value={st.presented} color="#16a34a" />
        <Kpi label="Signés" value={st.signed} color="#15803d" />
      </div>

      {/* Répartition par segment */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {Object.entries(seq.segments).map(([s, n]) => (
          <Badge key={s} bg={`${SEGMENT_COLOR[s]}22`} fg={SEGMENT_COLOR[s]}>{SEGMENT_LABEL[s] || s} · {n}</Badge>
        ))}
      </div>

      {/* Funnel par email (si la séquence a tourné) */}
      {seq.per_email.length > 0 && (
        <div style={{ ...card, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Funnel par email</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const e = seq.per_email.find((x) => x.email_num === i + 1) || { sent: 0, clicked: 0, booked: 0 };
              return (
                <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 8, background: C.subtle }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>#{i + 1}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{e.sent}</div>
                  <div style={{ fontSize: 10, color: "#0891b2" }}>{e.clicked} clics</div>
                  <div style={{ fontSize: 10, color: "#16a34a" }}>{e.booked} rdv</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table des leads : bascule "dans la séquence" (contactés) / "prospects éligibles" (pool) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "inline-flex", background: C.subtle, borderRadius: 10, padding: 3, gap: 3 }}>
          {[
            { key: "in_seq", label: "Dans la séquence", n: seq.contacted.length },
            { key: "eligible", label: "Prospects éligibles", n: seq.stats.eligible },
          ].map((t) => {
            const on = effView === t.key;
            return (
              <button key={t.key} onClick={() => setViewMode(t.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: on ? C.bg : "transparent", color: on ? C.text : C.muted, boxShadow: on ? C.shadow : "none", ...font }}>
                {t.label}
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 8, background: on ? C.subtle : "transparent", color: on ? C.text : C.muted }}>{t.n}</span>
              </button>
            );
          })}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, email, sales)…"
          style={{ width: 280, padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", ...font }} />
      </div>

      {rows.truncated && (
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
          Aperçu des {seq.eligible_sample.length} premiers sur {rows.total} prospects éligibles — la recherche ne porte que sur cet aperçu.
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Prospect</th>
                <th style={th}>Sales</th>
                <th style={th}>Segment</th>
                {!rows.eligible && <><th style={th}>Dernier email</th><th style={th}>Statut</th><th style={th}>RDV repris</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.list.length === 0 ? (
                <tr><td colSpan={rows.eligible ? 3 : 6} style={{ ...td, textAlign: "center", padding: 30, color: C.muted }}>{rows.eligible ? "Aucun prospect éligible." : "Aucun lead dans la séquence."}</td></tr>
              ) : rows.list.map((r, i) => (
                <tr key={r.lead_id || i}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.full_name || "—"}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.email}</div>
                  </td>
                  <td style={td}>{r.sales || <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={td}><Badge bg={`${SEGMENT_COLOR[r.segment]}22`} fg={SEGMENT_COLOR[r.segment]}>{SEGMENT_LABEL[r.segment] || r.segment}</Badge></td>
                  {!rows.eligible && (
                    <>
                      <td style={td}>{r.last_email_num ? <>#{r.last_email_num} · {fmtDate(r.last_sent_at)}</> : "—"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {r.signed ? <Badge bg="#dcfce7" fg="#15803d">Signé</Badge>
                            : r.presented ? <Badge bg="#dcfce7" fg="#16a34a">Présenté</Badge>
                            : r.rebooked ? <Badge bg="#dcfce7" fg="#16a34a">RDV repris</Badge>
                            : r.clicked ? <Badge bg="#e0f2fe" fg="#0891b2">A cliqué</Badge>
                            : <Badge bg={C.subtle} fg={C.muted}>Envoyé</Badge>}
                        </div>
                      </td>
                      <td style={td}>{r.rdv_at ? fmtDate(r.rdv_at) : <span style={{ color: C.muted }}>—</span>}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
