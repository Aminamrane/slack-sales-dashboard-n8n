// Schema de l'auto-assignation, facon canvas n8n : fond pointille plein, nodes DEPLACABLES qui
// reviennent a leur place avec un bounce elastique (la connexion suit pendant le drag ET le retour).
// Montre la logique : tri par taille -> cat 1-3 (standard, tous) vs cat 4-5 (bonus, top sellers).
import { useState, useRef, useCallback, useEffect } from "react";
import apiClient from "../services/apiClient";
import { CHARTE_CAT } from "../styles/charte";

const fullUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : apiClient.baseUrl + u) : null);
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

const CW = 900, CH = 338;
const NODE = {
  n1: { x: 10, y: 106, w: 182, h: 84 },
  n2: { x: 292, y: 66, w: 234, h: 168 },
  n3: { x: 642, y: 16, w: 248, h: 148 },
  n4: { x: 642, y: 176, w: 248, h: 148 },
};
const OUT1 = { x: 192, y: 148 }, IN2 = { x: 292, y: 148 };
const R1 = { x: 526, y: 126 }, R2 = { x: 526, y: 196 };
const IN3 = { x: 642, y: 74 }, IN4 = { x: 642, y: 234 };

export default function AutoAssignFlow({ pool, C, counts, darkMode }) {
  const all = pool || [];
  const bonus = all.filter((p) => p.elig?.includes(4));
  const micro = all.filter((p) => p.microcreche);   // exclusif origine Micro-creche (Yohan/Leo)
  const MC = "#c08497";
  const microNames = micro.map((p) => (p.full_name || "").split(" ")[0]).filter(Boolean).join(" + ");

  const [off, setOff] = useState({});
  const offRef = useRef({});
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const [grab, setGrab] = useState(null);
  const setOffset = (k, v) => { offRef.current = { ...offRef.current, [k]: v }; setOff(offRef.current); };

  const onMove = useCallback((e) => {
    const d = dragRef.current; if (!d) return;
    setOffset(d.key, { dx: d.base.dx + (e.clientX - d.sx), dy: d.base.dy + (e.clientY - d.sy) });
  }, []);
  const onUp = useCallback(() => {
    const d = dragRef.current; if (!d) return;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    const from = offRef.current[d.key] || { dx: 0, dy: 0 };
    dragRef.current = null;
    const t0 = performance.now(), dur = 580;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const f = 1 - easeOutBack(p);               // 1 -> 0 avec overshoot (bounce)
      setOffset(d.key, { dx: from.dx * f, dy: from.dy * f });
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else { setOffset(d.key, { dx: 0, dy: 0 }); setGrab(null); }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [onMove]);
  const onDown = (key) => (e) => {
    e.preventDefault();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    dragRef.current = { key, sx: e.clientX, sy: e.clientY, base: offRef.current[key] || { dx: 0, dy: 0 } };
    setGrab(key);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  useEffect(() => () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [onMove, onUp]);

  const o = (k) => off[k] || { dx: 0, dy: 0 };
  const pt = (p, k) => ({ x: p.x + o(k).dx, y: p.y + o(k).dy });
  const conn = (a, ka, b, kb) => { const A = pt(a, ka), B = pt(b, kb); return `M${A.x} ${A.y} C${A.x + 64} ${A.y}, ${B.x - 64} ${B.y}, ${B.x} ${B.y}`; };
  const C1 = conn(OUT1, "n1", IN2, "n2"), C2 = conn(R1, "n2", IN3, "n3"), C3 = conn(R2, "n2", IN4, "n4");
  const dotColor = darkMode ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.10)";

  const avatarStack = (list, max) => {
    const shown = list.slice(0, max), extra = Math.max(0, list.length - shown.length);
    return (
      <div style={{ display: "flex", alignItems: "center", marginTop: 9 }}>
        {shown.map((p, i) => {
          const av = fullUrl(p.avatar_url);
          return av
            ? <img key={p.email} src={av} alt="" title={p.full_name} draggable="false" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "2px solid " + C.bg, marginLeft: i ? -7 : 0 }} />
            : <div key={p.email} title={p.full_name} style={{ width: 26, height: 26, borderRadius: "50%", background: C.slate, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, border: "2px solid " + C.bg, marginLeft: i ? -7 : 0 }}>{(p.full_name || "?").charAt(0).toUpperCase()}</div>;
        })}
        {extra > 0 && <span style={{ marginLeft: 7, fontSize: 11, color: C.muted, fontWeight: 600 }}>+{extra}</span>}
      </div>
    );
  };
  const tag = (txt, color) => <span style={{ fontSize: 9.5, fontWeight: 700, color, background: color + "1c", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>{txt}</span>;
  const chips = (cats) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
      {cats.map((c) => <span key={c.c} style={{ fontSize: 10.5, fontWeight: 600, color: c.color, background: c.color + "1c", padding: "2px 6px", borderRadius: 5 }}>{c.label}</span>)}
    </div>
  );
  const head = (icon, title, sub) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.muted }}>{sub}</div>}
      </div>
    </div>
  );
  const branchRow = (label, cats, sub, sublabelColor) => (
    <div style={{ padding: "9px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{label}</span>
        {sub && tag(sub, sublabelColor)}
      </div>
      {chips(cats)}
    </div>
  );
  // Mention micro-creche A L'INTERIEUR d'un pool : exclusivite Yohan/Leo, mais EN EQUILIBRE (remplace, pas en plus).
  const mcFooter = (note) => micro.length ? (
    <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px dashed " + C.border, display: "flex", alignItems: "flex-start", gap: 7 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5S15.1 8 14 8c-.8 0-1.5-.4-1.5-1" /></svg>
      <div style={{ fontSize: 9.8, color: C.muted, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 700, color: MC }}>Micro-crèche</span> · exclusive à {microNames || "Léo + Yohan"}, sans changer l'<span style={{ fontWeight: 600, color: C.text2 }}>équilibre {note}</span>.
      </div>
    </div>
  ) : null;
  const nodeBox = (key, n, children) => (
    <div onMouseDown={onDown(key)} style={{ position: "absolute", left: n.x, top: n.y, width: n.w, minHeight: n.h, transform: `translate(${o(key).dx}px, ${o(key).dy}px)`, background: C.bg, border: "1px solid " + (grab === key ? C.accent : C.border), borderRadius: 12, boxShadow: grab === key ? C.shadowLg : C.shadow, padding: "11px 13px", boxSizing: "border-box", cursor: grab === key ? "grabbing" : "grab", userSelect: "none", zIndex: grab === key ? 6 : 2 }}>{children}</div>
  );

  return (
    <div style={{ border: "1px solid " + C.border, borderRadius: 14, marginTop: 20, overflow: "hidden", background: C.surfaceAlt, backgroundImage: `radial-gradient(circle at 1px 1px, ${dotColor} 1.4px, transparent 0)`, backgroundSize: "19px 19px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px 2px" }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="8" x="3" y="3" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /><rect width="8" height="8" x="13" y="13" rx="2" /></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 650, color: C.text, letterSpacing: "-0.01em" }}>Répartition des leads, automatiquement</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, background: C.surface, border: "1px solid " + C.border, padding: "3px 8px", borderRadius: 6 }}>Workflow</span>
      </div>

      <div style={{ overflowX: "auto", padding: "10px 18px 18px" }}>
        <div style={{ position: "relative", width: CW, height: CH }}>
          <svg width={CW} height={CH} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
            {[C1, C2, C3].map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke={C.borderStrong} strokeWidth="1.6" />
                {grab === null && <>
                  {/* lueur (halo) qui respire */}
                  <circle r="6" fill={C.accent} opacity="0.2">
                    <animateMotion dur="2.6s" repeatCount="indefinite" path={d} begin={`${i * 0.5}s`} />
                    <animate attributeName="r" values="5;8.5;5" dur="1.3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                    <animate attributeName="opacity" values="0.22;0.06;0.22" dur="1.3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                  </circle>
                  {/* point qui clignote (jamais invisible) */}
                  <circle r="3.2" fill={C.accent}>
                    <animateMotion dur="2.6s" repeatCount="indefinite" path={d} begin={`${i * 0.5}s`} />
                    <animate attributeName="opacity" values="1;0.5;1" dur="1.3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                  </circle>
                </>}
              </g>
            ))}
            {[[OUT1, "n1"], [IN2, "n2"], [R1, "n2"], [R2, "n2"], [IN3, "n3"], [IN4, "n4"]].map(([p, k], i) => {
              const P = pt(p, k);
              return <circle key={i} cx={P.x} cy={P.y} r="3.6" fill={C.bg} stroke={C.muted} strokeWidth="1.6" />;
            })}
          </svg>

          {nodeBox("n1", NODE.n1, <>
            {head(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>, "Nouveaux leads")}
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
              <span style={{ fontSize: 21, fontWeight: 750, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{counts?.auto_assigned ?? "-"}</span>
              <span style={{ fontSize: 11, color: C.muted }}>auto-affectés</span>
            </div>
          </>)}

          {nodeBox("n2", NODE.n2, <>
            {head(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 3 16 3 16 9" /><polyline points="2 21 8 21 8 15" /><line x1="16" y1="3" x2="3" y2="16" /><line x1="21" y1="8" x2="8" y2="21" /></svg>, "Tri par taille", "salariés de l'entreprise")}
            <div style={{ height: 1, background: C.border, margin: "9px 0 2px" }} />
            {branchRow("Catégories 1-3", CHARTE_CAT.slice(0, 3), "Standard", C.slate)}
            <div style={{ height: 1, background: C.border }} />
            {branchRow("Catégories 4-5", CHARTE_CAT.slice(3), "Bonus", C.warn)}
          </>)}

          {nodeBox("n3", NODE.n3, <>
            {head(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, "Tous les commerciaux", all.length + " actifs · équité")}
            {avatarStack(all, 9)}
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8 }}>Chacun reçoit sa juste part des cat. 1 à 3.</div>
            {mcFooter("du pool")}
          </>)}

          {nodeBox("n4", NODE.n4, <>
            {head(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>, "Pool bonus · top sellers", bonus.length + " éligibles · équité")}
            {bonus.length ? avatarStack(bonus, 9) : <div style={{ fontSize: 11, color: C.muted, marginTop: 9 }}>Aucun pour l'instant.</div>}
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8 }}>Cat. 4-5 réparties équitablement, entre eux seulement.</div>
            {mcFooter("du pool bonus")}
          </>)}
        </div>
      </div>
    </div>
  );
}
