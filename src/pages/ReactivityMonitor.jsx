// src/pages/ReactivityMonitor.jsx
//
// Monitoring TOTAL du système de réactivité sales (admin uniquement).
// Tout y est : interrupteur général (avec bascule de test), état de chaque
// sales (dispo / agenda / notation / charges), leads SLA en vol avec compte à
// rebours, fenêtres de 3 jours, pools, événements récents, chiffres de
// migration. Auto-rafraîchi toutes les 10 s.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";

const NAVY = "#121b35";
const GREEN = "#3e7d5a";
const RED = "#b42318";
const AMBER = "#b45309";
const BORDER = "#e5e8ee";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const fmtAgo = (iso) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
};
const fmtHM = (iso) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const mmss = (s) => {
  if (s == null) return "—";
  const neg = s < 0;
  const a = Math.abs(Math.round(s));
  return `${neg ? "-" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

const card = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(17,24,39,0.05)" };
const th = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${BORDER}` };
const td = { fontSize: 12.5, color: TEXT, padding: "8px 10px", borderBottom: `1px solid #f1f3f7`, verticalAlign: "middle" };

// Icônes SVG (trait, couleur héritée) — jamais d'émoticônes sur cette page.
const ICO = {
  send: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  inbox: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
};

// État vide d'une carte : centré et habillé, pour que les cartes sans données
// gardent une présence au lieu de s'effondrer en laissant des vides gris.
function Empty({ icon, text }) {
  return (
    <div style={{ flex: 1, minHeight: 110, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8, color: MUTED }}>
      <span style={{ opacity: 0.5, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 12.5 }}>{text}</span>
    </div>
  );
}

function Tile({ label, value, tone, sub }) {
  return (
    <div style={{ ...card, padding: "13px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: tone || NAVY, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function ReactivityMonitor() {
  const navigate = useNavigate();
  const user = apiClient.getUser();
  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/");
  }, [user, navigate]);

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [toggling, setToggling] = useState(false);
  const [demoSending, setDemoSending] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const pollRef = useRef(null);

  const fetchAll = async () => {
    try {
      const d = await apiClient.get("/api/v1/tracking/reactivity/monitor");
      if (d && typeof d.enabled !== "undefined") { setData(d); setErr(null); setFetchedAt(Date.now()); }
    } catch (e) { setErr(e?.message || "Erreur de chargement"); }
  };
  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 10000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(pollRef.current); clearInterval(tick); };
  }, []);

  const toggle = async () => {
    if (!data) return;
    const next = !data.enabled;
    const label = next ? "ACTIVER le SLA (échéances, escalades, J+3) ?" : "COUPER le SLA (plus aucune échéance ni escalade) ?";
    if (!window.confirm(label)) return;
    setToggling(true);
    try {
      await apiClient.post("/api/v1/tracking/reactivity/toggle", { enabled: next });
      await fetchAll();
    } catch {}
    setToggling(false);
  };

  // Lead de démonstration : envoyé à soi-même par le VRAI pipeline (échéance
  // réelle, notif différée ~1 min). Non traité : indispo + autodestruction,
  // jamais réaffecté à un vrai sales.
  const sendDemo = async () => {
    if (!window.confirm("S'envoyer un lead de test ? Il suit la vraie règle : notif Slack + mail dans environ 1 min, échéance réelle. Non traité à l'échéance, vous passez indisponible et le lead s'autodétruit, il ne part jamais chez un sales.")) return;
    setDemoSending(true);
    try {
      const r = await apiClient.post("/api/v1/tracking/reactivity/demo-lead", {});
      setDemoResult(r);
      fetchAll();
    } catch (e) {
      alert(e?.message || "Échec de l'envoi du lead de test");
    }
    setDemoSending(false);
  };

  // Compte à rebours vivant : seconds_left du payload − temps écoulé depuis le fetch.
  const liveLeft = (secondsLeft) => secondsLeft == null || !fetchedAt ? null
    : Number(secondsLeft) - Math.floor((now - fetchedAt) / 1000);

  if (err) {
    return (
      <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f4f5f7" }}>
        <SharedNavbar />
        <div style={{ maxWidth: 900, margin: "60px auto", ...card, padding: 40, textAlign: "center", color: RED, fontSize: 14 }}>{err}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f4f5f7" }}>
        <SharedNavbar />
        <div style={{ maxWidth: 900, margin: "60px auto", textAlign: "center", color: MUTED, fontSize: 13.5 }}>Chargement du monitoring…</div>
      </div>
    );
  }

  const totalMissed = data.sales.reduce((a, s) => a + (s.missed_30d || 0), 0);
  const totalOnTime = data.sales.reduce((a, s) => a + (s.on_time_30d || 0), 0);

  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f4f5f7", color: TEXT }}>
      <SharedNavbar />
      <style>{`@keyframes rmPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* En-tête + interrupteur */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 750, color: NAVY, letterSpacing: "-0.02em" }}>Monitoring réactivité</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
              Agendas relevés {data.agenda_snapshot_at ? fmtAgo(data.agenda_snapshot_at) : "jamais"}
              {fetchedAt && <span> · maj {fmtAgo(new Date(fetchedAt).toISOString())}</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={sendDemo} disabled={demoSending}
              title="S'envoyer un lead de test par le vrai pipeline (notif, échéance, autodestruction)"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12,
                border: `1.5px solid ${NAVY}`, cursor: demoSending ? "wait" : "pointer", fontFamily: "inherit",
                background: "#fff", color: NAVY, fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = NAVY; }}>
              {ICO.send} {demoSending ? "Envoi…" : "M'envoyer un lead de test"}
            </button>
            <button onClick={toggle} disabled={toggling}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: data.enabled ? GREEN : "#6b7482", color: "#fff", fontSize: 13.5, fontWeight: 750 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", animation: data.enabled ? "rmPulse 2s ease-in-out infinite" : "none" }} />
              {toggling ? "…" : data.enabled ? "SLA ACTIF — couper" : "SLA COUPÉ — activer"}
            </button>
          </div>
        </div>

        {/* Confirmation du lead de démo */}
        {demoResult && (
          <div style={{ ...card, padding: "12px 16px", marginBottom: 16, borderLeft: `3px solid ${GREEN}`,
            display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            <span>
              Lead de test <b>#{demoResult.lead_id}</b> envoyé dans votre onglet Nouveaux leads.
              Notif Slack + mail dans ~1 min. Échéance <b>{fmtDT(demoResult.deadline)}</b> :
              non traité, vous passez indisponible et le lead s'autodétruit, il ne part jamais chez un sales.
            </span>
            <button onClick={() => setDemoResult(null)}
              style={{ marginLeft: "auto", border: "none", background: "transparent", color: MUTED,
                cursor: "pointer", fontSize: 15, fontFamily: "inherit", padding: 4 }}>✕</button>
          </div>
        )}

        {/* Tuiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
          <Tile label="Leads SLA en vol" value={data.sla_inflight.length} tone={data.sla_inflight.length ? AMBER : NAVY} sub="échéance 5 min / demi-journée" />
          <Tile label="Fenêtres 3 jours" value={data.treatment_windows.length} sub="traités, RDV attendu" />
          <Tile label="Pool réactivité" value={data.pools.reactivite} tone={data.pools.reactivite ? RED : NAVY} sub="jamais appelés" />
          <Tile label="Pool traitement" value={data.pools.traitement} sub="verrou RDV" />
          <Tile label="Ratés 30 j" value={totalMissed} tone={totalMissed ? RED : NAVY} sub={`${totalOnTime} traités dans les temps`} />
          <Tile label="Migration" value={data.migration.migrated} sub={`+ ${data.migration.deduped} doublons purgés`} />
        </div>

        {/* Sales */}
        <div style={{ ...card, padding: "16px 18px", marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 750, color: NAVY, marginBottom: 10 }}>Sales du pool d'auto-affectation</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Sales</th><th style={th}>Statut</th><th style={th}>Agenda</th>
                <th style={th}>SLA en vol</th><th style={th}>Fenêtres 3 j</th>
                <th style={th}>Ratés 30 j</th><th style={th}>À l'heure 30 j</th>
              </tr></thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.email}>
                    <td style={{ ...td, fontWeight: 650 }}>{s.name || s.email.split("@")[0]}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.available ? "#22c55e" : "#ef4444" }} />
                        <span style={{ fontWeight: 650, color: s.available ? GREEN : RED }}>{s.available ? "Dispo" : "Indispo"}</span>
                        {s.sales_available_updated_at && <span style={{ fontSize: 10.5, color: MUTED }}>{fmtAgo(s.sales_available_updated_at)}</span>}
                      </span>
                    </td>
                    <td style={td}>
                      {s.busy_now
                        ? <span style={{ color: AMBER, fontWeight: 650 }}>occupé → {fmtHM(s.busy_until)}</span>
                        : <span style={{ color: MUTED }}>libre</span>}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums", fontWeight: s.sla_inflight ? 750 : 400, color: s.sla_inflight ? AMBER : MUTED }}>{s.sla_inflight}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: s.windows_3j ? TEXT : MUTED }}>{s.windows_3j}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums", fontWeight: s.missed_30d ? 750 : 400, color: s.missed_30d ? RED : MUTED }}>{s.missed_30d}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: s.on_time_30d ? GREEN : MUTED, fontWeight: s.on_time_30d ? 650 : 400 }}>{s.on_time_30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cartes étirées à hauteur égale : une carte vide garde sa présence
            (état vide centré) au lieu de s'effondrer et de trouer la grille. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "stretch" }}>
          {/* SLA en vol */}
          <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: NAVY, marginBottom: 10 }}>
              SLA en vol <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>· compte à rebours vivant</span>
            </div>
            {data.sla_inflight.length === 0 ? (
              <Empty icon={ICO.clock} text="Aucun lead sous échéance : tout est traité." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Lead</th><th style={th}>Chez</th><th style={th}>Esc.</th><th style={th}>Échéance</th><th style={th}>Reste</th></tr></thead>
                <tbody>
                  {data.sla_inflight.map((l) => {
                    const left = liveLeft(l.seconds_left);
                    const late = left != null && left < 0;
                    return (
                      <tr key={l.id}>
                        <td style={{ ...td, fontWeight: 650 }}>{l.full_name || `#${l.id}`}<span style={{ color: MUTED, fontWeight: 400 }}> · {l.origin}</span></td>
                        <td style={td}>{(l.assigned_to || "").split("@")[0]}</td>
                        <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{l.sla_escalations || 0}/2</td>
                        <td style={td}>{fmtDT(l.sla_deadline_at)}</td>
                        <td style={{ ...td, fontVariantNumeric: "tabular-nums", fontWeight: 800, color: late ? RED : left != null && left < 120 ? AMBER : GREEN }}>
                          {mmss(left)}{late ? " ⏰" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Fenêtres 3 jours */}
          <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: NAVY, marginBottom: 10 }}>Fenêtres de 3 jours (RDV attendu)</div>
            {data.treatment_windows.length === 0 ? (
              <Empty icon={ICO.calendar} text="Aucune fenêtre ouverte pour l'instant." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Lead</th><th style={th}>Chez</th><th style={th}>Expire</th></tr></thead>
                <tbody>
                  {data.treatment_windows.map((l) => (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: 650 }}>{l.full_name || `#${l.id}`}</td>
                      <td style={td}>{(l.assigned_to || "").split("@")[0]}</td>
                      <td style={{ ...td, color: l.hours_left < 12 ? AMBER : TEXT, fontWeight: l.hours_left < 12 ? 700 : 400 }}>
                        dans {l.hours_left} h <span style={{ color: MUTED, fontWeight: 400 }}>({fmtDT(l.treatment_deadline_at)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Derniers arrivés aux pools */}
          <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: NAVY, marginBottom: 10 }}>Derniers arrivés aux pools</div>
            {data.pools.recent.length === 0 ? (
              <Empty icon={ICO.inbox} text="Rien pour l'instant." />
            ) : data.pools.recent.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid #f1f3f7`, fontSize: 12.5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: l.pool === "reactivite" ? "#ef4444" : "#0891b2", flexShrink: 0 }} />
                <span style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.full_name || `#${l.id}`}</span>
                <span style={{ color: MUTED, fontSize: 11 }}>{l.pool}</span>
                <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11, whiteSpace: "nowrap" }}>{l.pool_entered_at ? fmtAgo(l.pool_entered_at) : "migration"}</span>
              </div>
            ))}
          </div>

          {/* Événements récents */}
          <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: NAVY, marginBottom: 10 }}>Événements récents (notation)</div>
            {data.events.length === 0 ? (
              <Empty icon={ICO.chart} text="Aucun événement encore : le système vient d'être activé." />
            ) : data.events.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid #f1f3f7`, fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: e.event === "sla_missed" ? "#ef4444" : "#22c55e" }} />
                <span style={{ fontWeight: 650 }}>{(e.sales_email || "").split("@")[0]}</span>
                <span style={{ color: MUTED }}>{e.event === "sla_missed" ? "a raté" : "a traité à temps"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.full_name || `lead #${e.lead_id}`}</span>
                <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11, whiteSpace: "nowrap" }}>{fmtAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
