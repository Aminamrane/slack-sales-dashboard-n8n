// src/pages/SequencesMonitor.jsx
//
// Monitoring des séquences d'emails de réengagement (Broad / BTP / Restaurant).
// Vue lecture seule inspirée de la page auto-affectation (charte graphique, KPI
// en cartes, parcours entonnoir, sensation "en direct"). Consomme
// GET /api/v1/tracking/broad-sequence/monitoring.

import { useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../services/apiClient";
import { makeCharte } from "../styles/charte.js";

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

// Segments = qualifications qui entrent en séquence. Couleurs sobres (charte).
const SEG = {
  refus_r1:    { label: "Refus R1",    color: "#b5675f", desc: "Répondu, pas intéressé" },
  injoignable: { label: "Injoignable", color: "#6b7c99", desc: "Tombé sur répondeur" },
  no_show:     { label: "No-show",     color: "#bf945f", desc: "R1 manqué" },
};
const SEG_ORDER = ["refus_r1", "injoignable", "no_show"];

const fmtDate = (iso) => {
  if (!iso) return "·";
  const d = new Date(iso);
  if (isNaN(d)) return "·";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const ago = (iso) => {
  if (!iso) return "jamais";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "il y a " + Math.floor(s) + " s";
  if (s < 3600) return "il y a " + Math.floor(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.floor(s / 3600) + " h";
  return "il y a " + Math.floor(s / 86400) + " j";
};
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

export default function SequencesMonitor({ embed }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    const t = setInterval(() => {
      const isDark = document.body.classList.contains("dark-mode");
      setDarkMode((p) => (p !== isDark ? isDark : p));
    }, 500);
    return () => clearInterval(t);
  }, []);
  const C = useMemo(() => makeCharte(darkMode), [darkMode]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);        // clé de séquence sélectionnée
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState(null);    // null=auto | "in_seq" | "eligible"
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [confData, setConfData] = useState(null);
  const firstLoad = useRef(true);

  const load = () => {
    apiClient.get("/api/v1/tracking/broad-sequence/monitoring")
      .then((r) => {
        setData(r);
        setActive((prev) => prev || (r.sequences[0] && r.sequences[0].key));
        setRefreshedAt(new Date().toISOString());
        setLoading(false);
        firstLoad.current = false;
      })
      .catch((e) => { if (firstLoad.current) { setError(e.message || "Erreur"); setLoading(false); } });
    apiClient.get("/api/v1/tracking/confirmation-email/monitoring").then(setConfData).catch(() => {});
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // sensation "en direct" (le tick cron tourne à la minute)
    return () => clearInterval(id);
  }, []);

  const CONF_KEY = "__confirmation__";
  const isConf = active === CONF_KEY;
  const seq = useMemo(() => (data ? data.sequences.find((s) => s.key === active) : null), [data, active]);
  useEffect(() => { setViewMode(null); }, [active]);
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

  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadow };

  if (loading) return <div style={{ fontFamily: FONT, padding: 48, color: C.muted, textAlign: "center" }}>Chargement du monitoring…</div>;
  if (error) return <div style={{ fontFamily: FONT, padding: 48, color: "#b5675f", textAlign: "center" }}>Erreur : {error}</div>;
  if (!data || (!seq && !isConf)) return <div style={{ fontFamily: FONT, padding: 48, color: C.muted, textAlign: "center" }}>Aucune séquence.</div>;

  const st = seq ? seq.stats : null;
  const anyEnabled = data.sequences.some((s) => s.enabled);
  const contactedCount = seq ? seq.contacted.length : 0;
  const clickedLeads = seq ? seq.contacted.filter((c) => c.clicked).length : 0;
  const totalSeg = seq ? SEG_ORDER.reduce((a, k) => a + (seq.segments[k] || 0), 0) : 0;

  // Parcours lead par lead (entonnoir). Réf = éligibles ; conversion vs étape précédente.
  // Chaque étape convertit depuis un dénominateur sémantique (pas juste l'étape
  // précédente) : contactés/éligibles, clics & RDV rapportés aux contactés,
  // présentés/RDV, signés/présentés -> toujours des sous-ensembles, taux ≤ 100%.
  const funnel = seq ? [
    { key: "elig",  label: "Éligibles",   value: st.eligible,    ref: null,           color: C.slate,   hint: "dans la qualif" },
    { key: "cont",  label: "Contactés",   value: contactedCount, ref: st.eligible,    color: C.accent,  hint: "≥ 1 email reçu" },
    { key: "click", label: "Ont cliqué",  value: clickedLeads,   ref: contactedCount, color: "#4b8fb0", hint: "lien ouvert" },
    { key: "rdv",   label: "RDV repris",  value: st.rebooked,    ref: contactedCount, color: C.ok,      hint: "via la séquence" },
    { key: "prez",  label: "Présentés",   value: st.presented,   ref: st.rebooked,    color: C.ok,      hint: "R1 tenu" },
    { key: "sign",  label: "Signés",      value: st.signed,      ref: st.presented,   color: C.ok,      hint: "clients" },
  ] : [];

  // KPI (volume). Icônes SVG inline (charte : carré teinté + chiffre tabular).
  const ic = (p) => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
  const kpis = seq ? [
    { l: "Éligibles",      v: st.eligible,  color: C.slate,   s: "prospects ciblables", icon: ic(<><circle cx="9" cy="7" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>) },
    { l: "Emails envoyés", v: st.sent,      color: C.accent,  s: "cumul séquence",      icon: ic(<><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>) },
    { l: "Clics",          v: st.clicked,   color: "#4b8fb0", s: "liens ouverts",       icon: ic(<><path d="M9 9l5 12 1.8-5.2L21 14 9 9z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 7.2-2.9-.8"/></>) },
    { l: "RDV repris",     v: st.rebooked,  color: C.ok,      s: "via la séquence",     icon: ic(<><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></>) },
    { l: "Présentés",      v: st.presented, color: C.ok,      s: "R1 tenu",             icon: ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></>) },
    { l: "Signés",         v: st.signed,    color: C.ok,      s: "clients",             icon: ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></>) },
  ] : [];

  const segBg = darkMode ? "rgba(255,255,255,0.04)" : "#f4f5f7";

  return (
    <div style={{ fontFamily: FONT, minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : C.surface, color: C.text, padding: embed ? "6px 20px 40px" : "24px 28px" }}>
      <style>{`
        @keyframes seqFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes seqLiveDot{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes seqBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes seqRowIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .seq-row{transition:background .12s ease}
        .seq-row:hover{background:${darkMode ? "rgba(255,255,255,0.035)" : "rgba(37,99,235,0.035)"}}
        .seq-row td{border-top:1px solid ${C.border}}
        .seq-pill{transition:all .14s ease}
        .seq-scroll::-webkit-scrollbar{width:9px;height:9px}
        .seq-scroll::-webkit-scrollbar-thumb{background:${darkMode ? "rgba(255,255,255,0.14)" : "rgba(55,53,47,0.14)"};border-radius:5px}
      `}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", animation: "seqFadeUp 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: "-0.02em" }}>Monitoring des séquences email</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
              Réengagement des prospects Meta non convertis en R1 · à jour {ago(refreshedAt)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: (anyEnabled ? C.ok : C.muted) + "18", color: anyEnabled ? C.ok : C.muted }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: anyEnabled ? C.ok : C.muted, animation: anyEnabled ? "seqLiveDot 1.4s infinite" : "none" }} />
              {anyEnabled ? "En direct" : "Toutes en pause"}
            </span>
            <button onClick={load} style={{ padding: "7px 13px", borderRadius: 9, border: "1px solid " + C.border, background: C.bg, color: C.text2, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Rafraîchir</button>
          </div>
        </div>

        {/* Sélecteur de séquence */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {data.sequences.map((s) => {
            const on = s.key === active;
            return (
              <button key={s.key} className="seq-pill" onClick={() => setActive(s.key)}
                style={{ padding: "8px 15px", borderRadius: 10, border: "1px solid " + (on ? C.text : C.border), background: on ? C.text : C.bg, color: on ? C.bg : C.text2, fontSize: 13, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, fontFamily: FONT }}>
                {s.label}
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 6, textTransform: "uppercase", background: s.enabled ? C.ok + "22" : (on ? "rgba(255,255,255,0.16)" : segBg), color: s.enabled ? C.ok : (on ? C.bg : C.muted) }}>
                  {s.enabled ? "Active" : "Pause"}
                </span>
              </button>
            );
          })}
          <button className="seq-pill" onClick={() => setActive(CONF_KEY)}
            style={{ padding: "8px 15px", borderRadius: 10, border: "1px solid " + (isConf ? C.text : C.border), background: isConf ? C.text : C.bg, color: isConf ? C.bg : C.text2, fontSize: 13, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, fontFamily: FONT }}>
            Mail de confirmation
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 6, textTransform: "uppercase", background: C.ok + "22", color: C.ok }}>Actif</span>
          </button>
        </div>

        {isConf ? (
          !confData ? (
            <div style={{ ...card, padding: 40, textAlign: "center", color: C.muted }}>Chargement…</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 11, marginBottom: 16 }}>
                {[
                  { l: "Confirmations envoyées", v: confData.total.sent, s: "leads ADS auto-affectés", color: C.accent },
                  { l: "RDV pris via le lien", v: confData.total.rdv, s: "réservé via le mail", color: C.ok },
                  { l: "Taux de prise de RDV", v: confData.total.rate + "%", s: "RDV / envoyés", color: C.slate },
                ].map((k) => (
                  <div key={k.l} style={{ ...card, padding: "13px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.muted, marginBottom: 8 }}>{k.l}</div>
                    <div style={{ fontSize: 25, fontWeight: 780, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: k.color }}>{k.v ?? 0}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{k.s}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.01em" }}>Ventilation par niche</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Confirmations envoyées et RDV R1 pris, selon la niche du lead (origine).</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Niche", "Envoyés", "RDV pris", "Taux"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "9px 12px", fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid " + C.border }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {confData.niches.map((n) => (
                      <tr key={n.key} className="seq-row">
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: C.text, borderTop: "1px solid " + C.border }}>{n.label}</td>
                        <td style={{ padding: "11px 12px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", borderTop: "1px solid " + C.border }}>{n.sent}</td>
                        <td style={{ padding: "11px 12px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.ok, borderTop: "1px solid " + C.border }}>{n.rdv}</td>
                        <td style={{ padding: "11px 12px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.muted, borderTop: "1px solid " + C.border }}>{n.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 12 }}>« RDV pris » = leads ayant réservé leur R1 via le lien du mail de confirmation (attribution stricte).</div>
              </div>
            </>
          )
        ) : (<>

        {/* Bandeau OFF */}
        {!seq.enabled && (
          <div style={{ ...card, padding: "11px 15px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.text2, background: C.surfaceAlt }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: C.warn + "18", color: C.warn, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <span>
              Séquence <strong style={{ color: C.text }}>{seq.label}</strong> en pause : aucun email envoyé. Le tableau montre les <strong style={{ color: C.text }}>{st.eligible}</strong> prospects qui seront ciblés à l'activation.
            </span>
          </div>
        )}

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 11, marginBottom: 16 }}>
          {kpis.map((k) => (
            <div key={k.l} style={{ ...card, padding: "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: k.color + "18", color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.muted, lineHeight: 1.2 }}>{k.l}</div>
              </div>
              <div style={{ fontSize: 25, fontWeight: 780, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{k.v ?? 0}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Parcours (entonnoir lead par lead) */}
        <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 14, letterSpacing: "-0.01em" }}>Parcours des prospects</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {funnel.map((f, i) => {
              const conv = f.ref == null ? null : (f.ref > 0 ? Math.min(100, pct(f.value, f.ref)) : 0);
              const w = f.value === 0 ? 0 : Math.max(3, conv == null ? 100 : conv);
              return (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 92, flexShrink: 0, fontSize: 12, fontWeight: 600, color: C.text2, textAlign: "right" }}>{f.label}</div>
                  <div style={{ flex: 1, height: 26, background: segBg, borderRadius: 7, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: w + "%", background: f.color + (darkMode ? "44" : "26"), borderRight: w > 0 ? "2px solid " + f.color : "none", borderRadius: 7, transformOrigin: "left", animation: "seqBar 0.6s cubic-bezier(0.16,1,0.3,1) both", animationDelay: i * 0.06 + "s" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 11, gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 750, color: C.text, fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
                      <span style={{ fontSize: 10.5, color: C.muted }}>{f.hint}</span>
                    </div>
                  </div>
                  <div style={{ width: 54, flexShrink: 0, fontSize: 11, fontWeight: 600, color: conv == null ? "transparent" : C.muted, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
                    {conv == null ? "" : conv + "%"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2 colonnes : segments + funnel par email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 16, marginBottom: 16, alignItems: "start" }}>

          {/* Répartition par qualification */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.01em" }}>Qualifications entrantes</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Répartition des {totalSeg} prospects par motif d'entrée.</div>
            <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: segBg, marginBottom: 16 }}>
              {SEG_ORDER.map((k) => {
                const n = seq.segments[k] || 0;
                if (!n) return null;
                return <div key={k} title={`${SEG[k].label} · ${n}`} style={{ width: pct(n, totalSeg) + "%", background: SEG[k].color, transition: "width .4s ease" }} />;
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {SEG_ORDER.map((k) => {
                const n = seq.segments[k] || 0;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: SEG[k].color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{SEG[k].label}</div>
                      <div style={{ fontSize: 10.5, color: C.muted }}>{SEG[k].desc}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                    <span style={{ fontSize: 11, color: C.muted, width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(n, totalSeg)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Funnel par email 1 à 10 */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.01em" }}>Funnel par email</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Envoyés, clics et RDV pour chacun des 10 emails.</div>
            {st.sent === 0 ? (
              <div style={{ padding: "34px 10px", textAlign: "center", color: C.muted, fontSize: 12.5 }}>Aucun envoi pour l'instant.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5, alignItems: "end" }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const e = seq.per_email.find((x) => x.email_num === i + 1) || { sent: 0, clicked: 0, booked: 0 };
                  const maxSent = Math.max(1, ...seq.per_email.map((x) => x.sent));
                  const h = Math.max(3, (e.sent / maxSent) * 70);
                  return (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ height: 74, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginBottom: 5 }}>
                        <div style={{ height: h, background: C.accent + (darkMode ? "40" : "22"), borderTop: "2px solid " + C.accent, borderRadius: "4px 4px 0 0", position: "relative" }}>
                          {e.clicked > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.max(2, (e.clicked / Math.max(1, e.sent)) * h), background: "#4b8fb0" }} />}
                        </div>
                      </div>
                      <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700 }}>#{i + 1}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{e.sent}</div>
                      <div style={{ fontSize: 9.5, color: "#4b8fb0" }}>{e.clicked} clic{e.clicked > 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 9.5, color: C.ok }}>{e.booked} rdv</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Table : bascule dans la séquence / prospects éligibles */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "inline-flex", background: segBg, borderRadius: 10, padding: 3, gap: 3 }}>
            {[
              { key: "in_seq", label: "Dans la séquence", n: contactedCount },
              { key: "eligible", label: "Prospects éligibles", n: st.eligible },
            ].map((t) => {
              const on = effView === t.key;
              return (
                <button key={t.key} onClick={() => setViewMode(t.key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 650, background: on ? C.bg : "transparent", color: on ? C.text : C.muted, boxShadow: on ? C.shadow : "none", fontFamily: FONT }}>
                  {t.label}
                  <span style={{ fontSize: 11, fontWeight: 750, padding: "1px 7px", borderRadius: 7, background: on ? segBg : "transparent", color: on ? C.text2 : C.muted, fontVariantNumeric: "tabular-nums" }}>{t.n}</span>
                </button>
              );
            })}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, email, sales)…"
            style={{ width: 280, padding: "8px 13px", borderRadius: 9, border: "1px solid " + C.border, background: C.bg, color: C.text, fontSize: 13, outline: "none", fontFamily: FONT }} />
        </div>

        {rows.truncated && (
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
            Aperçu des {seq.eligible_sample.length} premiers sur {rows.total} prospects éligibles · la recherche ne porte que sur cet aperçu.
          </div>
        )}

        <div style={{ ...card, overflow: "hidden" }}>
          <div className="seq-scroll" style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Prospect", "Sales", "Qualification", ...(rows.eligible ? [] : ["Dernier email", "Statut", "RDV repris"])].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", position: "sticky", top: 0, background: C.surfaceAlt, borderBottom: "1px solid " + C.border, zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.list.length === 0 ? (
                  <tr><td colSpan={rows.eligible ? 3 : 6} style={{ textAlign: "center", padding: 34, color: C.muted, fontSize: 13 }}>{rows.eligible ? "Aucun prospect éligible." : "Aucun lead dans la séquence."}</td></tr>
                ) : rows.list.map((r, i) => {
                  const sm = SEG[r.segment] || { label: r.segment, color: C.muted };
                  const sales = r.sales || "";
                  return (
                    <tr key={r.lead_id || i} className="seq-row">
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: C.text }}>{r.full_name || "·"}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.email}</div>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>
                        {sales ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.slate, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sales.charAt(0).toUpperCase()}</span>
                            <span style={{ color: C.text, whiteSpace: "nowrap" }}>{sales}</span>
                          </span>
                        ) : <span style={{ color: C.muted }}>·</span>}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: sm.color + "1c", color: sm.color, whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}
                        </span>
                      </td>
                      {!rows.eligible && (
                        <>
                          <td style={{ padding: "11px 14px", fontSize: 12.5, color: C.text2, whiteSpace: "nowrap" }}>{r.last_email_num ? `#${r.last_email_num} · ${fmtDate(r.last_sent_at)}` : "·"}</td>
                          <td style={{ padding: "11px 14px" }}>
                            {r.signed ? <Tag c="#15a34a">Signé</Tag>
                              : r.presented ? <Tag c={C.ok}>Présenté</Tag>
                              : r.rebooked ? <Tag c={C.ok}>RDV repris</Tag>
                              : r.clicked ? <Tag c="#4b8fb0">A cliqué</Tag>
                              : <Tag c={C.muted} soft={segBg}>Envoyé</Tag>}
                          </td>
                          <td style={{ padding: "11px 14px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                            {r.rebooked ? <span style={{ color: C.ok, fontWeight: 600 }}>{fmtDate(r.rdv_at)}</span>
                              : <span style={{ color: C.muted }}>·</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}

function Tag({ children, c, soft }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: soft || (c + "1c"), color: c, whiteSpace: "nowrap" }}>{children}</span>
  );
}
