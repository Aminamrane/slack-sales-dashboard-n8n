import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { ReassignPanel, stopBadge } from "../components/AutoAssignControls.jsx";
import AutoAssignFlow from "../components/AutoAssignFlow.jsx";
import SalesDrawer from "../components/SalesDrawer.jsx";
import OriginIcon, { originMeta } from "../components/OriginIcon.jsx";
import { makeCharte, CHARTE_CAT } from "../styles/charte.js";
import "../index.css";

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const CAT = CHARTE_CAT;

const ago = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "il y a " + Math.floor(s) + " s";
  if (s < 3600) return "il y a " + Math.floor(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.floor(s / 3600) + " h";
  return "il y a " + Math.floor(s / 86400) + " j";
};

export default function LeadAssignmentLive({ embed = false }) {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = makeCharte(darkMode);

  const [session, setSession] = useState(null);
  const [ok, setOk] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // controles stop/reassign reserves admin
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate("/login"); return; }
    setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });
    setIsAdmin(user.role === "admin");
    if (["admin", "head_of_sales", "head_of_sales_manager", "ceo", "acquisition_director", "head_of_acquisition", "finance_director"].includes(user.role)) setOk(true);
    else if (!embed) navigate("/");  // en embed, l'acces est garanti par le parent (CRM)
  }, [navigate]);

  const [data, setData] = useState(null);
  const [drawerEmail, setDrawerEmail] = useState(null); // profil ouvert (email du sales)
  const seenRef = useRef(null);
  const [delays, setDelays] = useState({});
  const STAGGER = 0.3;
  const [anim, setAnim] = useState(null);     // rejeu des dernieres affectations au chargement ; null = mode normal
  const replayedRef = useRef(false);
  const replayingRef = useRef(false);
  const timersRef = useRef([]);

  const countsOf = (pool) => Object.fromEntries((pool || []).map((p) => [p.email, { ...p.cats }]));

  const applyData = (d) => {
    const ids = (d?.feed || []).map((f) => f.lead_id);
    if (seenRef.current) {
      const fresh = ids.filter((id) => !seenRef.current.has(id));
      if (fresh.length) { const m = {}; fresh.forEach((id, i) => { m[id] = (fresh.length - 1 - i) * STAGGER; }); setDelays(m); }
    }
    seenRef.current = new Set(ids);
    setData(d);
  };

  // REJEU : on rembobine les compteurs des 50 dernieres, puis on les rejoue une par une (le score
  // du destinataire monte, on voit la categorie exacte) -> rassure : "le robot repartit, c'est juste".
  const STEP_MS = 420;
  const startReplay = (d) => {
    setData(d);
    const feed = d.feed || [];
    const last = feed.slice(0, 50).reverse();
    if (!last.length) { seenRef.current = new Set(feed.map((x) => x.lead_id)); return; }
    replayingRef.current = true;
    const real = countsOf(d.pool);
    let cur = Object.fromEntries(Object.entries(real).map(([e, c]) => [e, { ...c }]));
    last.forEach((f) => { const c = String(f.category); if (cur[f.email]) cur[f.email][c] = Math.max(0, (Number(cur[f.email][c]) || 0) - 1); });
    let shown = feed.slice(50);
    setAnim({ counts: cur, feed: shown.slice(), pulseEmail: null, pulseCat: null, newId: null });
    last.forEach((f, i) => {
      const t = setTimeout(() => {
        cur = Object.fromEntries(Object.entries(cur).map(([e, c]) => [e, { ...c }]));
        const c = String(f.category);
        if (cur[f.email]) cur[f.email][c] = (Number(cur[f.email][c]) || 0) + 1;
        shown = [f, ...shown];
        setAnim({ counts: cur, feed: shown.slice(0, 50), pulseEmail: f.email, pulseCat: Number(f.category), newId: f.lead_id });
        if (i === last.length - 1) {
          const tEnd = setTimeout(() => { seenRef.current = new Set(feed.map((x) => x.lead_id)); replayingRef.current = false; setAnim(null); }, 1000);
          timersRef.current.push(tEnd);
        }
      }, 500 + i * STEP_MS);
      timersRef.current.push(t);
    });
  };

  const load = async () => {
    try {
      const d = await apiClient.get("/api/v1/admin/lead-assignment/monitor");
      if (!replayedRef.current) { replayedRef.current = true; startReplay(d); }  // rejeu animé aussi en embed (à chaque ouverture de l'onglet)
      else if (!replayingRef.current) { applyData(d); }
      else { setData(d); }
    } catch { /* garde l'ancien etat, anti-flicker */ }
  };
  useEffect(() => {
    if (!ok) return;
    load();
    const id = setInterval(load, 5000);
    return () => { clearInterval(id); timersRef.current.forEach(clearTimeout); };
  }, [ok]);

  if (!ok) return <div style={{ minHeight: embed ? 240 : "100vh", background: embed ? "transparent" : C.surface }} />;

  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadow };
  const mode = data?.mode || "off";
  const counts = data?.counts || {};
  const pool = data?.pool || [];
  const feed = anim ? anim.feed : (data?.feed || []);
  const avById = {};
  pool.forEach((p) => { avById[p.email] = { av: p.avatar_url, name: p.full_name }; });
  const ranked = [...pool].sort((a, b) => b.total - a.total);
  const cntOf = (p) => (anim ? (anim.counts[p.email] || p.cats) : p.cats);
  const totOf = (p) => Object.values(cntOf(p)).reduce((a, b) => a + Number(b || 0), 0);
  const pulseEmail = anim?.pulseEmail;
  const pulseCat = anim?.pulseCat;
  const feedAnimDelay = (id) => (anim ? (id === anim.newId ? 0 : null) : (delays[id] != null ? delays[id] : null));
  const eqStat = (c) => {
    const e = pool.filter((p) => p.elig.includes(c) && p.active_today !== false).map((p) => p.cats[String(c)] || 0);
    return e.length ? Math.max(...e) - Math.min(...e) : 0;
  };
  const maxSpread = Math.max(0, ...CAT.map((cat) => eqStat(cat.c)));
  const drawerSales = drawerEmail ? (pool.find((p) => p.email === drawerEmail) || null) : null;

  const fullUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : apiClient.baseUrl + u) : null);
  const fmtJM = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const dayBadge = (p) => {
    const sb = stopBadge(p, darkMode);
    if (sb) return sb;
    if (p.active_today !== false) return null;
    if (p.absent_until) {
      const txt = p.absent_from && p.absent_from !== p.absent_until
        ? "Absent du " + fmtJM(p.absent_from) + " au " + fmtJM(p.absent_until)
        : "Absent → " + fmtJM(p.absent_until);
      return { txt, color: C.warn };
    }
    return { txt: "Repos auj.", color: C.muted };
  };

  const hoverBg = darkMode ? "rgba(255,255,255,0.035)" : "rgba(37,99,235,0.035)";

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : C.surface, fontFamily: FONT }}>
      {!embed && <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />}
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes feedIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
        @keyframes liveDot{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes scorePulse{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}
        @keyframes rowGlow{0%{background:${C.accentSoft}}100%{background:transparent}}
        @keyframes catPop{0%{transform:scale(1)}45%{transform:scale(1.5)}100%{transform:scale(1)}}
        @keyframes flowDot{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:38px;opacity:0}}
        @keyframes drawerFade{from{opacity:0}to{opacity:1}}
        @keyframes drawerIn{from{transform:translateX(40px);opacity:0.4}to{transform:none;opacity:1}}
        .aa-tbl{width:100%;border-collapse:collapse}
        .aa-tbl th{padding:6px 8px;font-weight:600}
        .aa-tbl td{padding:12px 8px}
        .aa-live-row{cursor:pointer;transition:background .12s ease}
        .aa-live-row:hover{background:${hoverBg}}
        .aa-live-row td{border-top:1px solid ${C.border}}
        .aa-bonus-col{background:${darkMode ? "rgba(191,148,95,0.07)" : "rgba(191,148,95,0.05)"}}
      `}</style>

      <div style={{ maxWidth: embed ? "100%" : 1320, margin: "0 auto", padding: embed ? "4px 6px 32px" : "26px 24px 60px", animation: "fadeUp 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            {!embed && <h1 style={{ fontSize: 25, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>Auto-affectation des leads</h1>}
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6, display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
              <span>Dernier passage {data?.last_run_at ? ago(data.last_run_at) : "jamais"}</span>
            </div>
          </div>
          {mode !== "off" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, background: C.ok + "14", color: C.ok, fontWeight: 700, fontSize: 12.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.ok, animation: "liveDot 1.4s infinite" }} />
              En direct
            </span>
          )}
        </div>

        {/* Schéma de l'automatisation */}
        <AutoAssignFlow pool={pool} C={C} counts={counts} darkMode={darkMode} />

        {/* KPIs (2 : auto-affectés + exclus) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 360px))", gap: 12, margin: "16px 0 20px" }}>
          {[
            {
              l: "Auto-affectés", v: counts.auto_assigned, s: "répartis aux commerciaux", color: C.ok,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ok} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>,
            },
            {
              l: "Exclus → email", v: counts.excluded, s: "trop petits (1-2 sal & <100k)", color: C.warn,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
            },
          ].map((k) => (
            <div key={k.l} style={{ ...card, padding: "15px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: k.color + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted }}>{k.l}</div>
                <div style={{ fontSize: 26, fontWeight: 750, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 2 }}>{k.v ?? "-"}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.s}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Distribution + flux */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px 13px", borderBottom: "1px solid " + C.border, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Répartition par commercial</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Leads reçus ce cycle · clique un commercial pour son profil</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: (maxSpread <= 1 ? C.ok : C.warn) + "16", color: maxSpread <= 1 ? C.ok : C.warn, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {maxSpread <= 1 ? "Équilibré" : "Écart " + maxSpread + " lead" + (maxSpread > 1 ? "s" : "")}
              </span>
            </div>

            <div style={{ overflowX: "auto", padding: "0 8px 8px" }}>
              <table className="aa-tbl" style={{ minWidth: 540 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid " + C.border, paddingBottom: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted }}>Standard · pour tous</span>
                    </th>
                    <th colSpan={2} className="aa-bonus-col" style={{ textAlign: "center", borderBottom: "1px solid " + C.warn + "55", paddingBottom: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.warn }}>Bonus · top sellers</span>
                    </th>
                    <th></th>
                  </tr>
                  <tr>
                    <th style={{ textAlign: "left" }}><span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted }}>Commercial</span></th>
                    {CAT.map((cat) => (
                      <th key={cat.c} className={cat.c >= 4 ? "aa-bonus-col" : undefined} style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2 }}>{cat.label}</span>
                      </th>
                    ))}
                    <th style={{ textAlign: "center" }}><span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted }}>Total</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p) => {
                    const av = fullUrl(p.avatar_url);
                    const badge = dayBadge(p);
                    return (
                      <tr key={p.email} className="aa-live-row" onClick={() => setDrawerEmail(p.email)}
                        style={{ opacity: p.active_today === false ? 0.55 : 1, animation: pulseEmail === p.email ? "rowGlow 0.9s ease both" : undefined }}>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            {av ? <img src={av} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid " + C.border }} />
                                : <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.slate, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{(p.full_name || "?").charAt(0).toUpperCase()}</div>}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 650, fontSize: 13.5, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{p.full_name}</span>
                                {p.microcreche && <span title="Reçoit en exclusivité les leads Micro-crèche" style={{ display: "inline-flex", alignItems: "center" }}><OriginIcon origin="micro-crèche" size={15} /></span>}
                                {badge && <span title={badge.reason || undefined} style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: badge.color + "1c", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{badge.txt}</span>}
                                {!p.elig.includes(3) && <span title="Nouveau sales — reçoit uniquement les catégories 1 à 2" style={{ fontSize: 9.5, fontWeight: 700, color: C.accent, background: C.accentSoft, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>Starter</span>}
                              </div>
                              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>
                                {`Catégories 1 à ${Math.max(...p.elig)}`}
                                {p.credit_total > 0 && <span title="Leads d'écart neutralisés pendant une absence, pour éviter le rattrapage au retour." style={{ color: C.warn, fontWeight: 600 }}> · ≈{p.credit_total} non rattrapés</span>}
                              </div>
                            </div>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.55 }}><polyline points="9 18 15 12 9 6" /></svg>
                          </div>
                        </td>
                        {CAT.map((cat) => {
                          const v = cntOf(p)[String(cat.c)] || 0;
                          const elig = p.elig.includes(cat.c);
                          const hot = pulseEmail === p.email && pulseCat === cat.c;
                          return (
                            <td key={cat.c} className={cat.c >= 4 ? "aa-bonus-col" : undefined} style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                              {!elig ? <span style={{ color: C.muted, opacity: 0.35 }}>·</span>
                                : v > 0 ? <span style={{ display: "inline-block", minWidth: 27, padding: "3px 9px", borderRadius: 7, fontSize: 12.5, fontWeight: hot ? 800 : 600, color: cat.color, background: cat.color + (hot ? "44" : "16"), boxShadow: hot ? `0 0 0 2px ${cat.color}` : "none", animation: hot ? "catPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" : "none" }}>{v}</span>
                                  : <span style={{ color: C.muted, opacity: 0.7 }}>0</span>}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ display: "inline-block", fontWeight: 800, fontSize: 15, color: pulseEmail === p.email ? C.accent : C.text, animation: pulseEmail === p.email ? "scorePulse 0.5s ease both" : "none" }}>{totOf(p)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {ranked.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: C.muted, padding: 30 }}>Aucun commercial dans le pool.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flux des affectations reelles */}
          <div style={{ ...card, padding: "14px 16px", minHeight: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Dernières affectations</span>
              {mode !== "off" && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: C.ok }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: C.ok, animation: "liveDot 1.4s infinite" }} />en direct</span>}
            </div>
            {feed.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "60px 10px" }}>Aucune affectation pour l'instant.</div>}
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 440, overflowY: "auto", marginRight: -8, paddingRight: 8 }}>
              {feed.map((f, fi) => {
                const cat = CAT[(f.category || 1) - 1] || CAT[0];
                const om = originMeta(f.origin);
                const meta = avById[f.email] || {};
                const av = fullUrl(meta.av);
                return (
                  <div key={f.lead_id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 8px", borderRadius: 9, borderBottom: fi < feed.length - 1 ? "1px solid " + C.border : "none", background: f.lead_id === anim?.newId ? om.color + "14" : "transparent", transition: "background 0.4s ease", animation: feedAnimDelay(f.lead_id) != null ? "feedIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none", animationDelay: (feedAnimDelay(f.lead_id) || 0) + "s" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: om.color + "16", border: "1px solid " + om.color + "26", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <OriginIcon origin={f.origin} color={om.color} size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.company}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}><span style={{ color: cat.color, fontWeight: 600 }}>Cat {f.category}</span>{f.headcount ? " · " + f.headcount + " sal." : ""}{f.origin ? " · " + f.origin : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        {av ? <img src={av} alt="" style={{ width: 21, height: 21, borderRadius: "50%", objectFit: "cover", border: "1px solid " + C.border, flexShrink: 0 }} />
                            : <div style={{ width: 21, height: 21, borderRadius: "50%", background: C.slate, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 9, flexShrink: 0 }}>{(meta.name || f.email || "?").charAt(0).toUpperCase()}</div>}
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

        {/* Réassignation manuelle (admin uniquement) */}
        {isAdmin && <ReassignPanel pool={pool} C={C} darkMode={darkMode} card={card} onChanged={setData} />}

        {/* Rappel des catégories */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, margin: "26px 0 10px" }}>Les catégories</div>
        <div style={{ ...card, padding: "4px 18px" }}>
          {CAT.map((cat, i) => (
            <div key={cat.c} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 0", borderBottom: i < CAT.length - 1 ? "1px solid " + C.border : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: cat.color + "18", color: cat.color, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cat.c}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Catégorie {cat.c}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{cat.label} salariés</div>
              </div>
              {cat.c >= 4 && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.warn, background: C.warn + "16", padding: "4px 11px", borderRadius: 8 }}>Bonus, meilleurs closers</span>}
            </div>
          ))}
        </div>
      </div>

      <SalesDrawer sales={drawerSales} C={C} darkMode={darkMode} isAdmin={isAdmin} onClose={() => setDrawerEmail(null)} onChanged={setData} />
    </div>
  );
}
