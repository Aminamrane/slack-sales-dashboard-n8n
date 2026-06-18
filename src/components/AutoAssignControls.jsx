// Contrôles admin de l'auto-affectation, partagés par LeadAssignmentMonitor + LeadAssignmentLive.
// - StopButton : stopper / réactiver un commercial (raison obligatoire au stop).
// - stopBadge  : badge "Stoppé depuis JJ/MM" (navy, pas de violet).
// - ReassignPanel : réassigner les nouveaux leads non traités d'un sales vers d'autres
//   (cases à cocher + répartition multi-sales + raison). Tout hors équité côté backend.
// Visibles admin seulement (les pages gardent le rendu derrière isAdmin).
import { useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";

const C0 = { ok: "#10b981", warn: "#fb923c" };
const navyOf = (dark) => (dark ? "#c3c9d8" : "#1e2330");
// stopped_since = timestamp complet (created_at du stop) -> on affiche date + heure.
const fmtStopped = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return " depuis le " + date + " à " + time;
};

// Badge "Stoppé depuis le JJ/MM à HHhMM". Renvoyé null si le sales n'est pas stoppé.
export function stopBadge(p, darkMode) {
  if (!p.stopped) return null;
  return { txt: "Stoppé" + fmtStopped(p.stopped_since), color: navyOf(darkMode), reason: p.stop_reason };
}

function IconPause({ c }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" /></svg>;
}
function IconPlay({ c }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1.5" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg>;
}

// ── Bouton Stopper / Réactiver (+ modale raison) pour une ligne de sales ──
export function StopButton({ p, C, darkMode, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const navy = navyOf(darkMode);

  const doStop = async () => {
    const r = reason.trim();
    if (!r || busy) return;
    setBusy(true);
    try {
      const d = await apiClient.post(`/api/v1/admin/lead-assignment/stop/${p.user_id}`, { reason: r });
      onChanged?.(d);
      setOpen(false); setReason("");
    } catch (e) { window.alert("Échec du stop : " + (e?.message || e)); }
    setBusy(false);
  };
  const doReactivate = async () => {
    if (busy) return;
    if (!window.confirm(`Réactiver ${p.full_name || "ce commercial"} ? Il recevra de nouveau des leads, sans rattrapage du temps stoppé.`)) return;
    setBusy(true);
    try {
      const d = await apiClient.post(`/api/v1/admin/lead-assignment/reactivate/${p.user_id}`, {});
      onChanged?.(d);
    } catch (e) { window.alert("Échec de la réactivation : " + (e?.message || e)); }
    setBusy(false);
  };

  const pill = (bg, fg, content, onClick, title) => (
    <button onClick={onClick} disabled={busy} title={title}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 7, border: "1px solid " + bg + "55",
               background: bg + "14", color: bg, fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer",
               whiteSpace: "nowrap", transition: "background 0.15s, transform 0.12s", opacity: busy ? 0.6 : 1 }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
      {content}
    </button>
  );

  return (
    <>
      {p.stopped
        ? pill(C0.ok, C0.ok, <><IconPlay c={C0.ok} />Réactiver</>, doReactivate, "Réactiver ce commercial")
        : pill(navy, navy, <><IconPause c={navy} />Stopper</>, () => setOpen(true), "Stopper ce commercial")}

      {open && createPortal(
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,18,28,0.55)", backdropFilter: "blur(2px)",
                   display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "inherit" }}>
          <div style={{ width: "100%", maxWidth: 440, background: C.bg, border: "1px solid " + C.border, borderRadius: 16,
                        boxShadow: "0 24px 60px rgba(0,0,0,0.28)", padding: "22px 22px 18px", animation: "fadeUp 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: navy + "16", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconPause c={navy} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Stopper {p.full_name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Il ne recevra plus de nouveaux leads.</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, margin: "10px 0 12px" }}>
              À sa réactivation, il reprend sa part normale sans rattraper les leads manqués pendant le stop.
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted }}>Raison (obligatoire)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus rows={3}
              placeholder="Ex : ne traite pas ses nouveaux leads, sous-performance cette semaine..."
              style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.border, background: C.surface,
                       color: C.text, fontFamily: "inherit", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 16 }}>
              <button onClick={() => { setOpen(false); setReason(""); }}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={doStop} disabled={!reason.trim() || busy}
                style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: reason.trim() ? navy : C.border, color: reason.trim() ? (darkMode ? "#1e2330" : "#fff") : C.muted,
                         fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: reason.trim() && !busy ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
                {busy ? "..." : "Stopper"}
              </button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}

// ── Panneau "Réassigner les nouveaux leads" (cases à cocher + multi-sales + raison) ──
export function ReassignPanel({ pool, C, darkMode, card, onChanged }) {
  const navy = navyOf(darkMode);
  const [openPanel, setOpenPanel] = useState(false);
  const [source, setSource] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({}); // lead_id -> bool
  const [dest, setDest] = useState({});        // lead_id -> to_email
  const [defaultDest, setDefaultDest] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const sales = (pool || []).map((p) => ({ email: p.email, name: p.full_name }));
  const dests = sales.filter((s) => s.email !== source);

  const loadLeads = async (email) => {
    setSource(email); setChecked({}); setDest({}); setReport(null); setLeads([]);
    if (!email) return;
    setLoading(true);
    try {
      setLeads(await apiClient.get(`/api/v1/admin/lead-assignment/reassignable?email=${encodeURIComponent(email)}`));
    } catch (e) { window.alert("Échec du chargement : " + (e?.message || e)); }
    setLoading(false);
  };

  const toggle = (id) => {
    setChecked((c) => {
      const nc = { ...c, [id]: !c[id] };
      if (nc[id] && !dest[id] && defaultDest) setDest((d) => ({ ...d, [id]: defaultDest }));
      return nc;
    });
  };
  const items = leads.filter((l) => checked[l.lead_id] && dest[l.lead_id]).map((l) => ({ lead_id: l.lead_id, to_email: dest[l.lead_id] }));
  const nbChecked = leads.filter((l) => checked[l.lead_id]).length;
  const nbReady = items.length;
  const canSubmit = reason.trim() && nbReady > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await apiClient.post(`/api/v1/admin/lead-assignment/reassign`, { reason: reason.trim(), items });
      setReport({ reassigned: res.reassigned?.length || 0, skipped: res.skipped || [] });
      if (res.monitor) onChanged?.(res.monitor);
      await loadLeads(source); // rafraîchit la liste (les réassignés disparaissent)
      setReason("");
    } catch (e) { window.alert("Échec de la réassignation : " + (e?.message || e)); }
    setBusy(false);
  };

  const selStyle = { padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.bg, color: C.text, fontFamily: "inherit", fontSize: 12.5, outline: "none" };

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, margin: "26px 0 10px" }}>Réassigner des leads</div>
      <div style={{ ...card, padding: openPanel ? "16px 18px 18px" : "4px 18px" }}>
        <button onClick={() => setOpenPanel((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "12px 0", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: navy + "16", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Réassigner les nouveaux leads d'un commercial</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Bonus hors équité, traçé. Leads jamais contactés uniquement.</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: openPanel ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {openPanel && (
          <div style={{ animation: "fadeUp 0.22s ease both", paddingTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: C.muted }}>Leads de</span>
              <select value={source} onChange={(e) => loadLeads(e.target.value)} style={selStyle}>
                <option value="">Choisir un commercial...</option>
                {sales.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}
              </select>
              {source && leads.length > 0 && (
                <>
                  <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 6 }}>Destinataire par défaut</span>
                  <select value={defaultDest} onChange={(e) => setDefaultDest(e.target.value)} style={selStyle}>
                    <option value="">Aucun</option>
                    {dests.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}
                  </select>
                </>
              )}
            </div>

            {loading && <div style={{ fontSize: 13, color: C.muted, padding: "20px 0" }}>Chargement...</div>}
            {!loading && source && leads.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "16px 0" }}>Aucun nouveau lead non traité pour ce commercial.</div>}

            {!loading && leads.length > 0 && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto", marginRight: -6, paddingRight: 6 }}>
                  {leads.map((l) => {
                    const on = !!checked[l.lead_id];
                    return (
                      <div key={l.lead_id}
                        style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10,
                                 background: on ? navy + "10" : C.surface, border: "1px solid " + (on ? navy + "40" : C.border), transition: "background 0.15s, border 0.15s" }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(l.lead_id)}
                          style={{ width: 16, height: 16, accentColor: navy, cursor: "pointer", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.company}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                            {l.category ? "Cat " + l.category : "Non classé"}{l.headcount ? " · " + l.headcount + " sal." : ""}{l.origin ? " · " + l.origin : ""}
                          </div>
                        </div>
                        <select value={dest[l.lead_id] || ""} onChange={(e) => setDest((d) => ({ ...d, [l.lead_id]: e.target.value }))}
                          disabled={!on} style={{ ...selStyle, fontSize: 12, opacity: on ? 1 : 0.4, maxWidth: 150 }}>
                          <option value="">Vers...</option>
                          {dests.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14 }}>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de la réassignation (obligatoire)"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.border, background: C.surface, color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 13, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {nbChecked} coché{nbChecked > 1 ? "s" : ""}{nbChecked !== nbReady ? " · " + (nbChecked - nbReady) + " sans destinataire" : ""}
                  </span>
                  <button onClick={submit} disabled={!canSubmit}
                    style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: canSubmit ? navy : C.border, color: canSubmit ? (darkMode ? "#1e2330" : "#fff") : C.muted,
                             fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
                    {busy ? "..." : "Réassigner " + (nbReady > 0 ? nbReady + " lead" + (nbReady > 1 ? "s" : "") : "")}
                  </button>
                </div>
              </>
            )}

            {report && (
              <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, background: C0.ok + "12", border: "1px solid " + C0.ok + "33", fontSize: 12.5, color: C.text }}>
                <b style={{ color: C0.ok }}>{report.reassigned} lead{report.reassigned > 1 ? "s" : ""} réassigné{report.reassigned > 1 ? "s" : ""}.</b>
                {report.skipped.length > 0 && (
                  <span style={{ color: C.muted }}> {report.skipped.length} ignoré{report.skipped.length > 1 ? "s" : ""} (déjà traités ou non éligibles).</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
