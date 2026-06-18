import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { StopButton, stopBadge, ReassignPanel } from "../components/AutoAssignControls.jsx";
import "../index.css";

const COLORS = { primary: "#6366f1", secondary: "#fb923c", tertiary: "#10b981" };
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const CAT = [
  { c: 1, label: "1-2", color: "#6366f1" },
  { c: 2, label: "3-5", color: "#8b5cf6" },
  { c: 3, label: "6-10", color: "#0ea5e9" },
  { c: 4, label: "11-19", color: "#fb923c" },
  { c: 5, label: "20+", color: "#10b981" },
];
const MODES = {
  off: { label: "Désactivé", color: "#9ca3af" },
  shadow: { label: "Test (shadow)", color: COLORS.secondary },
  on: { label: "Actif", color: COLORS.tertiary },
};

const ago = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "il y a " + Math.floor(s) + " s";
  if (s < 3600) return "il y a " + Math.floor(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.floor(s / 3600) + " h";
  return "il y a " + Math.floor(s / 86400) + " j";
};

export default function LeadAssignmentMonitor() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

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
    if (user.role === "admin") setOk(true); else navigate("/");
  }, [navigate]);

  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const firstLoad = useRef(true);
  const seenRef = useRef(null);
  const [delays, setDelays] = useState({});
  const STAGGER = 0.3;

  // Applique les donnees + REJOUE en cascade les nouvelles affectations (l'animation = representation,
  // pas forcement synchro a la seconde ; on rejoue ce qui vient de se passer, facon simulation).
  const applyData = (d) => {
    const ids = (d?.feed || []).map((f) => f.lead_id);
    if (seenRef.current) {
      const fresh = ids.filter((id) => !seenRef.current.has(id));
      if (fresh.length) {
        const m = {};
        fresh.forEach((id, i) => { m[id] = (fresh.length - 1 - i) * STAGGER; });
        setDelays(m);
      }
    }
    seenRef.current = new Set(ids);
    setData(d);
  };
  const load = async () => {
    try {
      applyData(await apiClient.get("/api/v1/admin/lead-assignment/monitor"));
    } catch { /* garde l'ancien etat, anti-flicker */ }
    firstLoad.current = false;
  };
  useEffect(() => {
    if (!ok) return;
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [ok]);

  const changeMode = async (m) => {
    if (m === data?.mode || busy) return;
    setBusy(true);
    try {
      const d = await apiClient.put("/api/v1/admin/lead-assignment/mode", { mode: m });
      applyData(d);
    } catch (e) { window.alert("Échec du changement de mode : " + (e?.message || e)); }
    setBusy(false);
  };

  if (!ok) return <div style={{ minHeight: "100vh", background: C.surface }} />;

  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 14, boxShadow: darkMode ? "none" : "0 1px 2px rgba(0,0,0,0.03)" };
  const mode = data?.mode || "off";
  const mInfo = MODES[mode] || MODES.off;
  const counts = data?.counts || {};
  const pool = data?.pool || [];
  const feed = data?.feed || [];
  const avById = {};
  pool.forEach((p) => { avById[p.email] = { av: p.avatar_url, name: p.full_name }; });
  const ranked = [...pool].sort((a, b) => b.total - a.total);
  const eqStat = (c) => {
    // Ecart calcule sur les ACTIFS du jour : un absent (compteur gele) ne doit pas faire croire a un desequilibre.
    const e = pool.filter((p) => p.elig.includes(c) && p.active_today !== false).map((p) => p.cats[String(c)] || 0);
    return e.length ? Math.max(...e) - Math.min(...e) : 0;
  };
  const maxSpread = Math.max(0, ...CAT.map((cat) => eqStat(cat.c)));

  const fullUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : apiClient.baseUrl + u) : null);

  // Badge d'eligibilite du jour : absence (dates du.. au..) ou simple jour de repos. null si actif.
  const fmtJM = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const dayBadge = (p) => {
    const sb = stopBadge(p, darkMode);
    if (sb) return sb;
    if (p.active_today !== false) return null;
    if (p.absent_until) {
      const txt = p.absent_from && p.absent_from !== p.absent_until
        ? "Absent du " + fmtJM(p.absent_from) + " au " + fmtJM(p.absent_until)
        : "Absent → " + fmtJM(p.absent_until);
      return { txt, color: COLORS.secondary };
    }
    return { txt: "Repos auj.", color: C.muted };
  };

  return (
    <div style={{ minHeight: "100vh", background: C.surface, fontFamily: FONT }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes feedIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}@keyframes liveDot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 24px 60px", animation: "fadeUp 0.4s ease both" }}>

        {/* Header + toggle */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>Auto-affectation en direct</h1>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 8, background: mInfo.color + "1e", color: mInfo.color, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: mInfo.color, animation: mode !== "off" ? "liveDot 1.4s infinite" : "none" }} />
                {mInfo.label}
              </span>
              <span>Cutoff : à partir du lead #{data?.cutoff_lead_id ?? "-"}</span>
              <span>Dernier passage : {data?.last_run_at ? ago(data.last_run_at) : "jamais"}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mode (admin)</span>
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: C.subtle, border: "1px solid " + C.border }}>
              {["off", "shadow", "on"].map((m) => {
                const active = mode === m;
                const mi = MODES[m];
                return (
                  <button key={m} onClick={() => changeMode(m)} disabled={busy}
                    style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: active ? mi.color : "transparent", color: active ? "#fff" : C.muted, transition: "all 0.15s" }}>
                    {mi.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, margin: "22px 0 8px" }}>
          {[
            { l: "Leads vus", v: counts.seen, s: "depuis le cutoff" },
            { l: mode === "on" ? "Auto-affectés" : "Affecterait", v: counts.auto_assigned, s: "par le moteur", a: COLORS.tertiary },
            { l: "Exclus → email", v: counts.excluded, s: "1-2 sal & <100k", a: COLORS.secondary },
            { l: "En attente", v: counts.pending, s: "pas encore traités", a: counts.pending > 0 ? COLORS.secondary : undefined },
            { l: "Non classifiables", v: counts.non_classifiable, s: "→ manuel" },
          ].map((k) => (
            <div key={k.l} style={{ ...card, padding: "15px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, marginBottom: 8 }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.a || C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{k.v ?? "-"}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{k.s}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 22 }}>
          Affectés manuellement depuis le cutoff : <b style={{ color: C.text }}>{counts.manual ?? 0}</b>
          {" · "}Affectés avec CA non renseigné : <b style={{ color: counts.revenue_null > 0 ? COLORS.secondary : C.text }}>{counts.revenue_null ?? 0}</b> (à trancher)
        </div>

        {/* Légende pédagogique (pour les décideurs non-techs) */}
        <div style={{ ...card, padding: "13px 16px", margin: "0 0 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.primary + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
            <b style={{ color: C.text }}>Comment lire cette page.</b> Le robot répartit les nouveaux leads à parts égales entre les commerciaux.
            Une personne <b style={{ color: C.text }}>en vacances ou en repos</b> est grisée : elle ne reçoit pas de leads ces jours-là.
            À son retour, elle reprend sa part normale. Les leads manqués <b style={{ color: C.text }}>ne sont pas rattrapés</b>, pour ne pas pénaliser ceux qui ont assuré pendant son absence.
            La mention <b style={{ color: COLORS.secondary }}>« ≈ N non rattrapés »</b> indique l'écart de leads gelé pendant l'absence. Tous les chiffres affichés sont réels.
          </div>
        </div>

        {/* Distribution + flux */}
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...card, padding: "6px 16px 10px", overflowX: "auto" }}>
            <table className="perfv2" style={{ width: "100%", minWidth: 540 }}>
              <thead><tr>
                <th style={{ textAlign: "left" }}>Commercial</th>
                {CAT.map((cat) => <th key={cat.c} style={{ textAlign: "center" }}>Cat {cat.c}</th>)}
                <th style={{ textAlign: "center" }}>Total</th>
              </tr></thead>
              <tbody>
                {ranked.map((p) => {
                  const av = fullUrl(p.avatar_url);
                  const badge = dayBadge(p);
                  return (
                    <tr key={p.email} style={{ opacity: p.active_today === false ? 0.5 : 1 }}>
                      <td style={{ textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {av ? <img src={av} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid " + C.border }} />
                              : <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{(p.full_name || "?").charAt(0).toUpperCase()}</div>}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={{ fontWeight: 650, fontSize: 13, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{p.full_name}</span>
                              {badge && <span title={badge.reason || undefined} style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: badge.color + "1e", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{badge.txt}</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: C.muted }}>
                              {p.elig.includes(4) ? "Cat 1-5 (bonus)" : "Cat 1-3"}
                              {p.credit_total > 0 && <span title="Leads d'écart accumulés pendant une absence, neutralisés pour éviter le rattrapage au retour." style={{ color: COLORS.secondary, fontWeight: 600 }}> · ≈{p.credit_total} non rattrapés</span>}
                            </div>
                            {p.user_id && <div style={{ marginTop: 7 }}><StopButton p={p} C={C} darkMode={darkMode} onChanged={applyData} /></div>}
                          </div>
                        </div>
                      </td>
                      {CAT.map((cat) => {
                        const v = p.cats[String(cat.c)] || 0;
                        const elig = p.elig.includes(cat.c);
                        return (
                          <td key={cat.c} style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                            {!elig ? <span style={{ color: C.muted, opacity: 0.4 }}>·</span>
                              : v > 0 ? <span style={{ display: "inline-block", minWidth: 26, padding: "2px 8px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: cat.color, background: cat.color + "18" }}>{v}</span>
                                : <span style={{ color: C.muted }}>0</span>}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center", fontWeight: 800, fontSize: 14.5, color: C.text, fontVariantNumeric: "tabular-nums" }}>{p.total}</td>
                    </tr>
                  );
                })}
                {ranked.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: C.muted, padding: 30 }}>Aucun commercial dans le pool (seed éligibilité à appliquer).</td></tr>}
              </tbody>
            </table>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px 6px", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: (maxSpread <= 1 ? COLORS.tertiary : COLORS.secondary) + "18", color: maxSpread <= 1 ? COLORS.tertiary : COLORS.secondary, fontSize: 12.5, fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {maxSpread <= 1 ? "Équilibré" : "Écart " + maxSpread}
              </span>
              <span style={{ fontSize: 12.5, color: C.muted }}>Écart maximal entre commerciaux, toutes catégories : <b style={{ color: C.text }}>{maxSpread} lead{maxSpread > 1 ? "s" : ""}</b>.</span>
            </div>
          </div>

          {/* Flux des affectations reelles */}
          <div style={{ ...card, padding: "14px 16px", minHeight: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Dernières affectations</span>
              </div>
              {mode !== "off" && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: mInfo.color }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: mInfo.color, animation: "liveDot 1.4s infinite" }} />en direct</span>}
            </div>
            {feed.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "60px 10px" }}>Aucune affectation pour l'instant.{mode === "off" ? " Active le mode Test ou Actif." : ""}</div>}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {feed.map((f, fi) => {
                const cat = CAT[(f.category || 1) - 1] || CAT[0];
                const meta = avById[f.email] || {};
                const av = fullUrl(meta.av);
                return (
                  <div key={f.lead_id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 2px", borderBottom: fi < feed.length - 1 ? "1px dashed " + C.border : "none", animation: delays[f.lead_id] != null ? "feedIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none", animationDelay: (delays[f.lead_id] || 0) + "s" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: cat.color + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.company}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}><span style={{ color: cat.color, fontWeight: 600 }}>Cat {f.category}</span>{f.headcount ? " · " + f.headcount + " sal." : ""}{f.origin ? " · " + f.origin : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        {av ? <img src={av} alt="" style={{ width: 21, height: 21, borderRadius: "50%", objectFit: "cover", border: "1px solid " + C.border, flexShrink: 0 }} />
                            : <div style={{ width: 21, height: 21, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 9, flexShrink: 0 }}>{(meta.name || f.email || "?").charAt(0).toUpperCase()}</div>}
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{meta.name || f.email}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{ago(f.at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Réassignation manuelle (admin) */}
        <ReassignPanel pool={pool} C={C} darkMode={darkMode} card={card} onChanged={applyData} />

        {/* Rappel des catégories */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, margin: "26px 0 10px" }}>Les catégories</div>
        <div style={{ ...card, padding: "4px 18px" }}>
          {CAT.map((cat, i) => (
            <div key={cat.c} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 0", borderBottom: i < CAT.length - 1 ? "1px dashed " + C.border : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: cat.color + "1a", color: cat.color, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cat.c}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Catégorie {cat.c}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{cat.label} salariés</div>
              </div>
              {cat.c >= 4 && <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.secondary, background: COLORS.secondary + "18", padding: "4px 11px", borderRadius: 8 }}>Bonus, meilleurs closers</span>}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
