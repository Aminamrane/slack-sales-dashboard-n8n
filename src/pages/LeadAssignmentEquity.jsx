import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
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

// Pool de 10 commerciaux + éligibilité (défaut validé : tous 1-3, Yohan & Léo aussi 4-5).
const POOL = [
  { name: "Gwenaël Derouet", role: "Sales", elig: [1, 2, 3] },
  { name: "Yohan Debowski", role: "Manager", elig: [1, 2, 3, 4, 5] },
  { name: "Yanis Zaïri", role: "Sales", elig: [1, 2, 3, 4, 5] },
  { name: "Léo Mafrici", role: "Head of Sales", elig: [1, 2, 3, 4, 5] },
  { name: "David Dubois", role: "Head of Sales", elig: [1, 2, 3] },
  { name: "Jean-Christophe Limbourg", role: "Sales", elig: [1, 2, 3] },
  { name: "Mehdi Mestiri", role: "Sales", elig: [1, 2, 3] },
  { name: "Alexandre VORATOVIC", role: "Sales", elig: [1, 2, 3] },
  { name: "Michael STREICHER", role: "Sales", elig: [1, 2, 3] },
  { name: "Gary Meynier", role: "Sales", elig: [1, 2, 3] },
].map((p, i) => ({ ...p, order: i }));

// Poids issus du réel (volumes 30 j), pour générer un flux représentatif, anonymisé.
const CAT_W = [623, 299, 186, 83, 120];
const SECTORS = [
  { tag: "Général", w: 530 },
  { tag: "BTP", w: 465 },
  { tag: "Resto", w: 332 },
  { tag: "Web", w: 40 },
];

// Noms d'entreprises FICTIFS (générés) : réalisme pour la démo, aucune donnée client réelle.
const FIRST = {
  "Général": ["Cabinet", "Groupe", "Atelier", "Maison", "Studio", "Bureau", "Conseil", "Espace"],
  "BTP": ["Bâtiment", "Maçonnerie", "Toiture", "Charpente", "Rénovation", "Constructions", "Travaux"],
  "Resto": ["Le Bistrot", "Brasserie", "Pizzeria", "Le Café", "Trattoria", "La Table", "Le Comptoir"],
  "Web": ["Studio", "Agence", "Web", "Digital", "Pixel"],
};
const LAST = ["Lefèvre", "Garnier", "Moreau", "Durand", "Lambert", "Petit", "Rousseau", "Mercier", "Girard", "Dupont", "Bonnet", "Néo", "Astéria", "Lumen", "Central", "du Coin", "Méditerranée", "Atlantique", "Bellevue", "Saint-Marc"];
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function weightedIndex(weights) {
  const tot = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}
function genStream(n) {
  const sw = SECTORS.map((s) => s.w);
  const out = [];
  for (let i = 0; i < n; i++) {
    const cat = weightedIndex(CAT_W) + 1;
    const sector = SECTORS[weightedIndex(sw)].tag;
    out.push({ id: i + 1, cat, sector, size: CAT[cat - 1].label, name: pickOne(FIRST[sector]) + " " + pickOne(LAST) });
  }
  return out;
}
const blankCounts = () => Object.fromEntries(POOL.map((p) => [p.name, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }]));
const totalOf = (name, counts) => [1, 2, 3, 4, 5].reduce((s, c) => s + counts[name][c], 0);

export default function LeadAssignmentEquity() {
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

  const [avatarMap, setAvatarMap] = useState({});
  useEffect(() => {
    if (!ok) return;
    let on = true;
    apiClient.get("/api/v1/users/assignable").then((d) => {
      if (!on) return;
      const m = {};
      (d?.users || []).forEach((u) => {
        const url = u.avatar_url ? (/^https?:\/\//i.test(u.avatar_url) ? u.avatar_url : apiClient.baseUrl + u.avatar_url) : null;
        if (url) m[u.full_name] = url;
      });
      setAvatarMap(m);
    }).catch(() => {});
    return () => { on = false; };
  }, [ok]);

  // ── État de la démo ──────────────────────────────────────────────
  const [stream, setStream] = useState(() => genStream(120));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(350);
  const [snap, setSnap] = useState({ counts: blankCounts(), idx: 0, feed: [], flash: null });
  const countsRef = useRef(blankCounts());
  const idxRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const lead = stream[idxRef.current];
      if (!lead) { setRunning(false); return; }
      const elig = POOL.filter((p) => p.elig.includes(lead.cat));
      let pick = elig[0];
      for (const p of elig) {
        const pc = countsRef.current[p.name][lead.cat], bc = countsRef.current[pick.name][lead.cat];
        if (pc !== bc) { if (pc < bc) pick = p; continue; }
        const pt = totalOf(p.name, countsRef.current), bt = totalOf(pick.name, countsRef.current);
        if (pt !== bt) { if (pt < bt) pick = p; continue; }
        if (p.order < pick.order) pick = p;
      }
      countsRef.current[pick.name][lead.cat] += 1;
      idxRef.current += 1;
      const item = { ...lead, sales: pick.name, key: lead.id };
      const clone = Object.fromEntries(Object.entries(countsRef.current).map(([k, v]) => [k, { ...v }]));
      setSnap((s) => ({ counts: clone, idx: idxRef.current, feed: [item, ...s.feed].slice(0, 14), flash: { sales: pick.name, cat: lead.cat } }));
    };
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [running, speed, stream]);

  const reset = () => {
    setRunning(false);
    countsRef.current = blankCounts();
    idxRef.current = 0;
    setStream(genStream(120));
    setSnap({ counts: blankCounts(), idx: 0, feed: [], flash: null });
  };

  if (!ok) return <div style={{ minHeight: "100vh", background: C.surface }} />;

  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 14, boxShadow: darkMode ? "none" : "0 1px 2px rgba(0,0,0,0.03)" };
  const { counts, idx, feed, flash } = snap;
  const done = idx >= stream.length;
  const volSeen = (c) => POOL.reduce((s, p) => s + counts[p.name][c], 0);
  const eqStat = (c) => {
    const e = POOL.filter((p) => p.elig.includes(c)).map((p) => counts[p.name][c]);
    return { min: Math.min(...e), max: Math.max(...e), n: e.length };
  };
  const maxSpread = Math.max(...CAT.map((cat) => { const s = eqStat(cat.c); return s.max - s.min; }));
  const rankedPool = [...POOL].sort((a, b) => totalOf(b.name, counts) - totalOf(a.name, counts) || a.order - b.order);

  const btn = (bg, fg) => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: bg, color: fg, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

  return (
    <div style={{ minHeight: "100vh", background: C.surface, fontFamily: FONT }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes feedIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
        @keyframes cellPulse{0%{background:rgba(99,102,241,0.30)}100%{background:transparent}}
      `}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 24px 60px", animation: "fadeUp 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>Affectation automatique</h1>
            <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4 }}>Les leads arrivent en direct et sont répartis par catégorie, à l'équilibre. Simulation pure.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, background: COLORS.secondary + "18", color: COLORS.secondary, fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.secondary }} /> Simulation (dry-run)
            </span>
            <div title="Réservé admin, activation après le go CEO" style={{ display: "flex", alignItems: "center", gap: 9, opacity: 0.55, cursor: "not-allowed" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Auto</span>
              <div style={{ width: 40, height: 23, borderRadius: 12, background: C.subtle, border: "1px solid " + C.border, position: "relative" }}>
                <div style={{ position: "absolute", top: 2, left: 2, width: 17, height: 17, borderRadius: "50%", background: C.muted }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>OFF</span>
            </div>
          </div>
        </div>

        {/* Barre de contrôle */}
        <div style={{ ...card, padding: "14px 18px", margin: "22px 0 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {!running
            ? <button onClick={() => { if (done) reset(); setRunning(true); }} style={btn(COLORS.tertiary, "#fff")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20" /></svg>
                {done ? "Relancer" : idx > 0 ? "Reprendre" : "Lancer la démo"}
              </button>
            : <button onClick={() => setRunning(false)} style={btn(C.subtle, C.text)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                Pause
              </button>}
          <button onClick={reset} style={{ ...btn("transparent", C.muted), border: "1px solid " + C.border }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            Reset
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Vitesse</span>
            {[{ l: "Lent", v: 700 }, { l: "Normal", v: 350 }, { l: "Rapide", v: 120 }].map((s) => (
              <button key={s.v} onClick={() => setSpeed(s.v)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid " + (speed === s.v ? C.accent : C.border), background: speed === s.v ? C.accent + "18" : "transparent", color: speed === s.v ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s.l}</button>
            ))}
          </div>

          {/* Progression */}
          <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 7, borderRadius: 5, background: C.subtle, overflow: "hidden" }}>
              <div style={{ height: "100%", width: (100 * idx / stream.length) + "%", background: COLORS.tertiary, borderRadius: 5, transition: "width 0.25s ease" }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{idx} / {stream.length} leads</span>
          </div>
        </div>

        {/* Grille : tableau live + flux */}
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "start" }}>

          {/* Tableau distribution live */}
          <div style={{ ...card, padding: "6px 16px 10px", overflowX: "auto" }}>
            <table className="perfv2" style={{ width: "100%", minWidth: 540 }}>
              <thead><tr>
                <th style={{ textAlign: "left" }}>Commercial</th>
                {CAT.map((cat) => <th key={cat.c} style={{ textAlign: "center" }}>Cat {cat.c}</th>)}
                <th style={{ textAlign: "center" }}>Total</th>
              </tr></thead>
              <tbody>
                {rankedPool.map((p) => {
                  const av = avatarMap[p.name];
                  const tot = totalOf(p.name, counts);
                  return (
                    <tr key={p.name}>
                      <td style={{ textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {av ? <img src={av} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid " + C.border }} />
                              : <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</div>}
                          <div>
                            <div style={{ fontWeight: 650, fontSize: 13, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{p.name}</div>
                            <div style={{ fontSize: 10.5, color: C.muted }}>{p.role}</div>
                          </div>
                        </div>
                      </td>
                      {CAT.map((cat) => {
                        const v = counts[p.name][cat.c];
                        const elig = p.elig.includes(cat.c);
                        const isFlash = flash && flash.sales === p.name && flash.cat === cat.c;
                        return (
                          <td key={cat.c} style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", animation: isFlash ? "cellPulse 0.6s ease" : "none", borderRadius: 6 }}>
                            {!elig ? <span style={{ color: C.muted, opacity: 0.4 }}>·</span>
                              : v > 0 ? <span style={{ display: "inline-block", minWidth: 26, padding: "2px 8px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: cat.color, background: cat.color + "18" }}>{v}</span>
                                : <span style={{ color: C.muted }}>0</span>}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center", fontWeight: 800, fontSize: 14.5, color: C.text, fontVariantNumeric: "tabular-nums" }}>{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Preuve d'équité live */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px 6px", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: (maxSpread <= 1 ? COLORS.tertiary : COLORS.secondary) + "18", color: maxSpread <= 1 ? COLORS.tertiary : COLORS.secondary, fontSize: 12.5, fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {maxSpread <= 1 ? "Équilibré" : "Écart " + maxSpread}
              </span>
              <span style={{ fontSize: 12.5, color: C.muted }}>Écart maximal entre commerciaux, toutes catégories : <b style={{ color: C.text }}>{maxSpread} lead{maxSpread > 1 ? "s" : ""}</b>.</span>
            </div>
          </div>

          {/* Flux de leads entrants */}
          <div style={{ ...card, padding: "14px 16px", minHeight: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Flux de leads entrants</span>
              </div>
              {running && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: COLORS.tertiary }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.tertiary, animation: "cellPulse 1s infinite" }} />en direct</span>}
            </div>
            {feed.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "60px 10px" }}>
                Appuie sur <b style={{ color: C.text }}>Lancer la démo</b> pour voir les leads arriver et se répartir.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {feed.map((f, fi) => {
                const cat = CAT[f.cat - 1];
                const av = avatarMap[f.sales];
                const isNew = fi === 0;
                return (
                  <div key={f.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 2px", borderBottom: fi < feed.length - 1 ? "1px dashed " + C.border : "none", animation: "feedIn 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: cat.color + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}><span style={{ color: cat.color, fontWeight: 600 }}>Cat {f.cat}</span> · {f.sector} · {f.size} sal.</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        {av ? <img src={av} alt="" style={{ width: 21, height: 21, borderRadius: "50%", objectFit: "cover", border: "1px solid " + C.border, flexShrink: 0 }} />
                            : <div style={{ width: 21, height: 21, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 9, flexShrink: 0 }}>{f.sales.charAt(0).toUpperCase()}</div>}
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>assigné à {f.sales}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                      {isNew && <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.tertiary }} />}
                      <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{isNew ? "à l'instant" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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
