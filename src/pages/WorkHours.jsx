// src/pages/WorkHours.jsx
//
// Heures de travail (menu Humain). Accès : admin, ceo, hr.
// Source : agendas Google de l'équipe, servis depuis un snapshot en base
// rafraîchi par cron toutes les 15 min ; calcul backend : semaine de 7 JOURS
// (le week-end compte dans le réalisé), vacances déclarées neutralisées,
// événements non-travail exclus, chevauchements fusionnés.
//
// Nouvelle page (2026-09-04, brief dev) : « moyenne d'heures par jour et par
// semaine, en haut, par pôle et par personne ; cocher des gens fait un total
// ET une moyenne équipe ; l'attendu part d'une base de 40 h et s'adapte aux
// absences, mi-temps, vacances ; filtrer, trier, cocher en masse par domaine ;
// et un vrai changement de front, une meilleure page. »
//
// Structure :
//   ┌ en-tête : titre + période (Semaine | Mois, ‹ ›, Aujourd'hui) ────────┐
//   │ RAIL (gauche)                    │ CLASSEMENT (droite)                │
//   │  · Équipe cochée : réalisé,      │  · tri par colonne                 │
//   │    attendu + barre, moy/j, moy/s │  · une ligne par personne :        │
//   │  · Un pôle par ligne : case de   │    cellules (jours ou semaines),   │
//   │    coche en masse, icône, total, │    moy/j, moy/sem, attendu (jours  │
//   │    attendu + barre, moy/j, moy/s │    travaillés au crayon), total    │
//   │    — cliquer le nom filtre.      │    + barre, évolution              │
//   └──────────────────────────────────┴────────────────────────────────────┘
// La logique (agrégation, attendu, moyennes) vit dans utils/workHoursPeriod.js,
// testée. Rien ne s'anime hors une entrée de page ; l'écran reste pendant les
// chargements.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";
import {
  ClockIcon, TargetIcon, GaugeIcon, PencilIcon, ChevronLeftIcon, ChevronRightIcon,
  DevsIcon, SalesIcon, SettersIcon, FinanceIcon, MarketingIcon, DirectionIcon,
  RhIcon, ClientSuccessIcon, OtherIcon,
} from "../components/icons/PoleIcons.jsx";
import {
  DAY_LABELS, MONTHS_FR, DEFAULT_WORKING_DAYS,
  mondayOf, iso, addDays, fmtDay, monthKey, fmtH, statusFor, buildPeriod, aggregate, mondaysCovering,
} from "../utils/workHoursPeriod.js";
import crownIcon from "../assets/crown.png";
import firstPlace from "../assets/1st-place.png";
import secondPlace from "../assets/2st-place.png";
import thirdPlace from "../assets/3st-place.png";

const NAVY = "#121b35";
const GREEN = "#3e7d5a";
const VIOLET = "#7c3aed";
const BORDER = "#e6e9ef";
const MUTED = "#8a93a4";
const FAINT = "#b9c2d2";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const POLE_COLORS = {
  Devs: "#6366f1", Sales: "#2563eb", Setters: "#0ea5e9", Finance: "#d97706",
  Marketing: "#db2777", Direction: NAVY, RH: VIOLET, "Client Success": GREEN, Autre: MUTED,
};
const POLE_ICONS = {
  Devs: DevsIcon, Sales: SalesIcon, Setters: SettersIcon, Finance: FinanceIcon,
  Marketing: MarketingIcon, Direction: DirectionIcon, RH: RhIcon,
  "Client Success": ClientSuccessIcon, Autre: OtherIcon,
};
const poleIcon = (pole) => POLE_ICONS[pole] || OtherIcon;
const poleColor = (pole) => POLE_COLORS[pole] || MUTED;
// Les agendas ne sont tenus que depuis mai 2026 : pas de période avant.
const FIRST_MONTH = { y: 2026, m: 4 };
const FIRST_WEEK = "2026-05-04";
const minsAgo = (ts) => Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

const SORTS = [
  { key: "total", label: "Total" },
  { key: "gap", label: "Écart" },
  { key: "avgDay", label: "Moy./jour" },
  { key: "name", label: "Nom" },
];

/* ───────────────────────────── Pièces ───────────────────────────── */

function Avatar({ p, size = 34 }) {
  const [err, setErr] = useState(false);
  const pc = poleColor(p.pole);
  const initials = (p.name || p.email).split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", boxShadow: `0 0 0 2px ${CARD}, 0 0 0 3.5px ${pc}55` };
  if (p.avatar_url && !err) {
    return <img src={p.avatar_url} alt="" onError={() => setErr(true)} style={{ ...base, objectFit: "cover", display: "block" }} />;
  }
  return (
    <span style={{ ...base, background: pc + "1a", color: pc, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 800, letterSpacing: "0.02em" }}>
      {initials}
    </span>
  );
}

// Barre réalisé / attendu : une transition CSS, rien d'autre.
function Bar({ value, max, color, height = 6, track = "#eef1f6" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span style={{ display: "block", height, borderRadius: height, background: track, overflow: "hidden" }}>
      <span style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: height, background: color, transition: "width 0.45s cubic-bezier(0.16,1,0.3,1)" }} />
    </span>
  );
}

function Check({ on, partial = false, color = GREEN, size = 17 }) {
  const active = on || partial;
  return (
    <span style={{ width: size, height: size, borderRadius: 5, border: `1.5px solid ${active ? color : "#cbd2e0"}`, background: on ? color : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.12s, border-color 0.12s" }}>
      {on && <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      {!on && partial && <span style={{ width: size * 0.45, height: 2, borderRadius: 1, background: color }} />}
    </span>
  );
}

// Éditeur des jours travaillés (RH) : sept cases, une par jour.
function WorkingDaysEditor({ initial, onSave, onCancel, saving }) {
  const [days, setDays] = useState(() => new Set(initial));
  const toggle = (d) => setDays((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  return (
    <div onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(17,24,39,0.14)", padding: "10px 12px", width: 236 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: MUTED, marginBottom: 8 }}>Jours travaillés</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {DAY_SHORT.map((l, i) => {
          const d = i + 1;
          const on = days.has(d);
          return (
            <button key={d} type="button" onClick={() => toggle(d)} title={DAY_LABELS[i]}
              style={{ flex: 1, height: 28, borderRadius: 7, border: `1px solid ${on ? VIOLET : BORDER}`, background: on ? VIOLET : CARD, color: on ? "#fff" : i >= 5 ? FAINT : TEXT, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {l}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: MUTED, flex: 1 }}>{days.size} j × 8 h = {fmtH(days.size * 8)}/sem</span>
        <button type="button" onClick={onCancel} style={{ border: "none", background: "transparent", color: MUTED, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
        <button type="button" disabled={saving || days.size === 0} onClick={() => onSave([...days].sort())}
          style={{ border: "none", background: VIOLET, color: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: days.size === 0 ? 0.5 : 1 }}>
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────── Page ─────────────────────────────────── */

export default function WorkHours({ embed = false }) {
  const navigate = useNavigate();
  const user = apiClient.getUser();
  useEffect(() => {
    if (!user || !["admin", "ceo", "hr"].includes(user.role)) navigate("/");
  }, [user, navigate]);

  // Période : Semaine (lundi ISO) ou Mois (année, mois 0-11).
  const [mode, setMode] = useState("week");
  const [week, setWeek] = useState(() => iso(mondayOf(new Date())));
  const [month, setMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });

  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [unchecked, setUnchecked] = useState(() => new Set());
  const [poleFilter, setPoleFilter] = useState(null);
  const [sortBy, setSortBy] = useState("total");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Chargement : l'écran reste tel quel pendant qu'on va chercher la période.
  useEffect(() => {
    let alive = true;
    setRefreshing(true);
    setError(null);
    const get = (w) => apiClient.get(`/api/v1/hr/work-hours?week=${w}`);
    const job = mode === "week"
      ? Promise.all([get(week), get(addDays(week, -7)).catch(() => null)])
        .then(([w, prev]) => buildPeriod({ mode: "week", weeks: [w], prevWeek: prev }))
      : Promise.all(mondaysCovering(month.y, month.m).map(get))
        .then((weeks) => buildPeriod({ mode: "month", weeks, y: month.y, m: month.m }));
    job
      .then((p) => { if (alive) setPeriod(p); })
      .catch((e) => { if (alive) setError(e?.data?.detail || e?.message || "Erreur de chargement"); })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [mode, week, month.y, month.m, reloadTick]);

  const today = iso(new Date());
  const isCurrent = mode === "week" ? week === iso(mondayOf(new Date())) : monthKey(month.y, month.m) === today.slice(0, 7);
  const canGoBack = mode === "week" ? week > FIRST_WEEK : monthKey(month.y, month.m) > monthKey(FIRST_MONTH.y, FIRST_MONTH.m);
  const shift = (dir) => {
    if (mode === "week") setWeek((w) => addDays(w, dir * 7));
    else setMonth(({ y, m }) => { const d = new Date(y, m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const goToday = () => { const n = new Date(); setWeek(iso(mondayOf(n))); setMonth({ y: n.getFullYear(), m: n.getMonth() }); };
  const periodLabel = mode === "week"
    ? (period?.cells?.length === 7 ? `${fmtDay(period.cells[0].day)} – ${fmtDay(period.cells[6].day)}` : `Semaine du ${fmtDay(week)}`)
    : `${MONTHS_FR[month.m][0].toUpperCase()}${MONTHS_FR[month.m].slice(1)} ${month.y}`;

  /* Lignes, classement, agrégats. */
  const rows = useMemo(() => (period?.rows || []).filter((r) => r.accessible), [period]);
  const checked = useMemo(() => rows.filter((r) => !unchecked.has(r.email)), [rows, unchecked]);
  const team = useMemo(() => aggregate(checked), [checked]);
  const teamStatus = statusFor(team.total, team.expectedNow);

  const rankByEmail = useMemo(() => {
    const m = {};
    [...rows].sort((a, b) => b.total - a.total).forEach((r, i) => { m[r.email] = i; });
    return m;
  }, [rows]);

  const visible = useMemo(() => {
    const arr = poleFilter ? rows.filter((r) => r.pole === poleFilter) : [...rows];
    if (sortBy === "avgDay") arr.sort((a, b) => (b.avgDay ?? -1) - (a.avgDay ?? -1));
    else if (sortBy === "gap") arr.sort((a, b) => (b.total - b.expectedNow) - (a.total - a.expectedNow));
    else if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [rows, poleFilter, sortBy]);

  // Un pôle par ligne du rail, toujours présent, dans un ordre stable.
  const poles = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const cur = m.get(r.pole) || { pole: r.pole, members: [], on: [] };
      cur.members.push(r);
      if (!unchecked.has(r.email)) cur.on.push(r);
      m.set(r.pole, cur);
    }
    return [...m.values()]
      .map((v) => ({ ...v, agg: aggregate(v.on) }))
      .sort((a, b) => b.members.length - a.members.length || a.pole.localeCompare(b.pole));
  }, [rows, unchecked]);

  const toggle = (email) => setUnchecked((prev) => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email); else next.add(email);
    return next;
  });
  const togglePole = (pole) => setUnchecked((prev) => {
    const members = rows.filter((r) => r.pole === pole).map((r) => r.email);
    const allOn = members.every((e) => !prev.has(e));
    const next = new Set(prev);
    members.forEach((e) => { if (allOn) next.add(e); else next.delete(e); });
    return next;
  });
  const toggleAll = () => setUnchecked((prev) => (prev.size ? new Set() : new Set(rows.map((r) => r.email))));

  const saveWorkingDays = async (email, days) => {
    setSaving(true);
    setEditError(null);
    try {
      await apiClient.put("/api/v1/hr/work-hours/working-days", { email, days });
      setEditing(null);
      setReloadTick((t) => t + 1);
    } catch (e) {
      setEditError(e?.data?.detail || "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const cells = period?.cells || [];
  // Tout tient dans la largeur, sans défilement : colonnes de chiffres
  // compactes, la place restante va à la personne (retour dev 2026-09-04).
  const cellsWidth = mode === "week" ? 258 : Math.max(180, cells.length * 46);
  const GRID = `26px minmax(170px, 1.6fr) ${cellsWidth}px 62px 62px 70px 100px`;
  const card = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: "0 1px 2px rgba(17,24,39,0.04)" };

  return (
    <div style={{ fontFamily: FONT, minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : "#f4f5f7", color: TEXT }}>
      {!embed && <SharedNavbar />}
      <style>{`
        @keyframes whIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes whShimmer{from{background-position:-400px 0}to{background-position:400px 0}}
        .wh-page{animation:whIn 0.35s cubic-bezier(0.16,1,0.3,1) both}
        .wh-layout{display:grid;grid-template-columns:284px minmax(0,1fr);gap:14px;align-items:start}
        @media (max-width:1100px){.wh-layout{grid-template-columns:1fr}}
        .wh-row{transition:background 0.12s ease, opacity 0.15s ease}
        .wh-row:hover{background:#f3f5f9 !important}
        .wh-edit{opacity:0;transition:opacity .15s ease}
        .wh-row:hover .wh-edit{opacity:1}
        .wh-btn{transition:background 0.12s, border-color 0.12s, color 0.12s}
        .wh-btn:hover:not(:disabled){background:#f2f4f8}
        .wh-pole{transition:background 0.12s}
        .wh-pole:hover{background:#f6f7fa}
      `}</style>

      <div className="wh-page" style={{ maxWidth: 1400, margin: "0 auto", padding: "26px 22px 60px" }}>

        {/* ── En-tête ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>Heures de travail</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
              Agendas Google, semaine de 7 jours · attendu = jours travaillés × 8 h, absences déduites
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {period && isCurrent && mode === "week" && period.refreshedAt && (
              <span title={`Dernier relevé : ${new Date(period.refreshedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                style={{ padding: "6px 11px", borderRadius: 10, background: GREEN + "12", color: GREEN, fontSize: 11.5, fontWeight: 650 }}>
                {minsAgo(period.refreshedAt) === 0 ? "relevé à l'instant" : `relevé il y a ${minsAgo(period.refreshedAt)} min`}
              </span>
            )}
            {period?.closed && (
              <span style={{ padding: "6px 11px", borderRadius: 10, background: "#f0f2f5", color: MUTED, fontSize: 11.5, fontWeight: 650 }}>
                {mode === "week" ? "Semaine figée" : "Mois clos"}
              </span>
            )}
            {refreshing && !loading && (
              <span style={{ padding: "6px 11px", borderRadius: 10, background: "#f0f2f5", color: MUTED, fontSize: 11.5, fontWeight: 650 }}>chargement…</span>
            )}
            <span style={{ display: "inline-flex", background: "#eceff4", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 2, gap: 2 }}>
              {[["week", "Semaine"], ["month", "Mois"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: mode === k ? CARD : "transparent", color: mode === k ? NAVY : MUTED, fontSize: 12.5, fontWeight: mode === k ? 700 : 600, cursor: "pointer", fontFamily: "inherit", boxShadow: mode === k ? "0 1px 2px rgba(17,24,39,0.10)" : "none", transition: "background 0.12s" }}>
                  {l}
                </button>
              ))}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${BORDER}`, background: CARD, borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} className="wh-btn" title="Période précédente"
                style={{ padding: "7px 8px", border: "none", background: "transparent", color: canGoBack ? NAVY : FAINT, cursor: canGoBack ? "pointer" : "default", display: "inline-flex" }}>
                <ChevronLeftIcon size={16} />
              </button>
              <span style={{ padding: "0 8px", fontSize: 13, fontWeight: 700, color: NAVY, minWidth: 168, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {periodLabel}
              </span>
              <button type="button" onClick={() => shift(1)} disabled={isCurrent} className="wh-btn" title="Période suivante"
                style={{ padding: "7px 8px", border: "none", background: "transparent", color: isCurrent ? FAINT : NAVY, cursor: isCurrent ? "default" : "pointer", display: "inline-flex" }}>
                <ChevronRightIcon size={16} />
              </button>
            </span>
            {!isCurrent && (
              <button type="button" onClick={goToday} className="wh-btn"
                style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>
                Aujourd'hui
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="wh-layout">
            <div style={{ ...card, height: 420, border: "none", background: "linear-gradient(90deg, #eceef2 0%, #f5f6f8 40%, #eceef2 80%)", backgroundSize: "800px 100%", animation: "whShimmer 1.3s linear infinite" }} />
            <div style={{ ...card, height: 420, border: "none", background: "linear-gradient(90deg, #eceef2 0%, #f5f6f8 40%, #eceef2 80%)", backgroundSize: "800px 100%", animation: "whShimmer 1.3s linear infinite" }} />
          </div>
        ) : error && !period ? (
          <div style={{ ...card, padding: 48, textAlign: "center", color: "#b42318", fontSize: 13.5 }}>{error}</div>
        ) : (
          <div className="wh-layout" style={{ opacity: refreshing ? 0.7 : 1, transition: "opacity 0.2s ease" }}>

            {/* ══ RAIL : équipe cochée + pôles ══ */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Équipe */}
              <div style={{ ...card, padding: "16px 16px 14px", background: NAVY, border: "none", color: "#fff" }}>
                <button type="button" onClick={toggleAll} title={unchecked.size ? "Tout cocher" : "Tout décocher"}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "#fff", textAlign: "left" }}>
                  <Check on={unchecked.size === 0} partial={unchecked.size > 0 && checked.length > 0} color="#7dd3a0" />
                  <span style={{ fontSize: 13.5, fontWeight: 750 }}>Équipe</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{checked.length}/{rows.length} cochés</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "rgba(255,255,255,0.7)" }}>
                  <ClockIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Réalisé</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", marginTop: 4 }}>{fmtH(team.total)}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "rgba(255,255,255,0.7)" }}>
                  <TargetIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Attendu</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 750, color: teamStatus.color === GREEN ? "#7dd3a0" : teamStatus.color === VIOLET ? "#c4b5fd" : "#fca5a5", fontVariantNumeric: "tabular-nums" }}>
                    {team.total - team.expectedNow >= 0 ? "+" : ""}{fmtH(team.total - team.expectedNow)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtH(team.expected)}</span>
                  {!period?.closed && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>dont {fmtH(team.expectedNow)} à ce stade</span>}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Bar value={team.total} max={team.expectedNow} color={teamStatus.color === GREEN ? "#7dd3a0" : teamStatus.color === VIOLET ? "#c4b5fd" : "#fca5a5"} track="rgba(255,255,255,0.14)" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.6)" }}>
                      <GaugeIcon size={12} /><span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Moy. / jour</span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{team.avgDay != null ? fmtH(team.avgDay) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.6)" }}>
                      <GaugeIcon size={12} /><span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Moy. / sem</span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{team.avgWeek != null ? fmtH(team.avgWeek) : "—"}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>moyennes par personne, sur les jours qui comptaient</div>
              </div>

              {/* Pôles */}
              <div style={{ ...card, padding: "6px 6px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 6px" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED }}>Pôles</span>
                  {poleFilter && (
                    <button type="button" onClick={() => setPoleFilter(null)}
                      style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>
                      Tout afficher
                    </button>
                  )}
                </div>
                {poles.map((v) => {
                  const pc = poleColor(v.pole);
                  const Icon = poleIcon(v.pole);
                  const st = statusFor(v.agg.total, v.agg.expectedNow);
                  const allOn = v.on.length === v.members.length;
                  const someOn = v.on.length > 0 && !allOn;
                  const filtered = poleFilter === v.pole;
                  return (
                    <div key={v.pole} className="wh-pole"
                      style={{ display: "grid", gridTemplateColumns: "17px 30px minmax(0,1fr)", gap: 10, alignItems: "start", padding: "9px 10px", borderRadius: 11, background: filtered ? pc + "0d" : "transparent", boxShadow: filtered ? `inset 3px 0 0 ${pc}` : "none", opacity: v.on.length === 0 ? 0.6 : 1 }}>
                      <button type="button" onClick={() => togglePole(v.pole)} title={allOn ? `Décocher tout le pôle ${v.pole}` : `Cocher tout le pôle ${v.pole}`}
                        style={{ border: "none", background: "transparent", padding: 0, marginTop: 6, cursor: "pointer", display: "inline-flex" }}>
                        <Check on={allOn} partial={someOn} color={pc} />
                      </button>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: pc + "16", color: pc, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Icon size={16} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <button type="button" onClick={() => setPoleFilter(filtered ? null : v.pole)} title={filtered ? "Afficher tout le monde" : `N'afficher que ${v.pole}`}
                          style={{ display: "flex", alignItems: "baseline", gap: 6, width: "100%", border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 750, color: filtered ? pc : TEXT }}>{v.pole}</span>
                          <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>{v.on.length}/{v.members.length}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: st.color, fontVariantNumeric: "tabular-nums" }}>{fmtH(v.agg.total)}</span>
                        </button>
                        <div style={{ marginTop: 6 }}><Bar value={v.agg.total} max={v.agg.expectedNow} color={st.color} height={5} /></div>
                        <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 10.5, color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          <span>attendu <b style={{ color: TEXT, fontWeight: 700 }}>{fmtH(v.agg.expected)}</b></span>
                          <span>·</span>
                          <span>{v.agg.avgDay != null ? `${fmtH(v.agg.avgDay)}/j` : "—"}</span>
                          <span>·</span>
                          <span>{v.agg.avgWeek != null ? `${fmtH(v.agg.avgWeek)}/sem` : "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* ══ CLASSEMENT ══ */}
            <div style={{ ...card, padding: "16px 18px 12px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, letterSpacing: "-0.01em" }}>
                    Classement{poleFilter ? ` · ${poleFilter}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                    {visible.length} personne{visible.length > 1 ? "s" : ""} · rang sur la période, tous pôles confondus · vert ≥ attendu, violet ≥ 87,5 %, rouge en dessous
                  </div>
                </div>
                <span style={{ marginLeft: "auto", display: "inline-flex", background: "#eceff4", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 2, gap: 2 }}>
                  {SORTS.map((s) => (
                    <button key={s.key} type="button" onClick={() => setSortBy(s.key)}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: sortBy === s.key ? CARD : "transparent", color: sortBy === s.key ? NAVY : MUTED, fontSize: 11.5, fontWeight: sortBy === s.key ? 700 : 600, cursor: "pointer", fontFamily: "inherit", boxShadow: sortBy === s.key ? "0 1px 2px rgba(17,24,39,0.10)" : "none", transition: "background 0.12s" }}>
                      {s.label}
                    </button>
                  ))}
                </span>
              </div>

              {editError && (
                <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 9, background: "#fdecec", color: "#b42318", fontSize: 12 }}>{editError}</div>
              )}

              {/* En-têtes */}
              <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "0 10px 8px", alignItems: "end", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                <span /><span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>Personne</span>
                <span style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length || 1}, 1fr)`, gap: 3 }}>
                  {cells.map((c) => (
                    <span key={c.key} title={mode === "month" ? `Semaine du ${fmtDay(c.key)}` : undefined}
                      style={{ fontSize: 9.5, fontWeight: 700, color: c.weekend ? FAINT : MUTED, textAlign: "center", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.label}
                    </span>
                  ))}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>Moy./jour</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>Moy./sem</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>Attendu</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>Total</span>
              </div>

              {visible.length === 0 && (
                <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Personne sur cette période.</div>
              )}

              {visible.map((r) => {
                const off = unchecked.has(r.email);
                const pc = poleColor(r.pole);
                const rank = rankByEmail[r.email] ?? 0;
                const first = rank === 0;
                const st = statusFor(r.total, r.expectedNow);
                const isEditing = editing === r.email;
                const partTime = r.workingDays.length !== DEFAULT_WORKING_DAYS.length || r.workingDays.some((d) => d > 5);
                const denom = mode === "week" ? r.perDay * 1.3 : r.perDay * r.workingDays.length * 1.3;
                return (
                  <div key={r.email} className="wh-row" onClick={() => !isEditing && toggle(r.email)}
                    style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "10px 10px", borderRadius: 12, cursor: "pointer", opacity: off ? 0.45 : 1, background: first ? "#fdf8ea" : "transparent" }}>
                    <Check on={!off} />

                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {rank < 3 ? (
                        <img src={[firstPlace, secondPlace, thirdPlace][rank]} alt={`${rank + 1}e`} style={{ width: 26, height: 26, flexShrink: 0, objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 800, color: MUTED, width: 26, textAlign: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{rank + 1}</span>
                      )}
                      <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                        <Avatar p={r} size={34} />
                        {first && (
                          <img src={crownIcon} alt="" title={`En tête · ${periodLabel}`}
                            style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-6deg)", width: 16, height: 16, filter: "drop-shadow(0 1px 3px rgba(17,24,39,0.25))" }} />
                        )}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1, fontSize: 10.5, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: pc, fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc }} />{r.pole}
                          </span>
                          {partTime && <span style={{ color: VIOLET, fontWeight: 700 }}>· {r.workingDays.length} j/sem</span>}
                          {r.vacCount > 0 && <span style={{ color: "#b45309", fontWeight: 600 }}>· {r.vacCount} j. d'absence</span>}
                        </span>
                      </span>
                    </span>

                    <span style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length || 1}, 1fr)`, gap: 3 }}>
                      {r.cells.map((c) => {
                        if (c.vacAll) {
                          return (
                            <span key={c.key} title={`${c.label} : absence validée, neutralisée`}
                              style={{ textAlign: "center", fontSize: 10, fontWeight: 700, padding: "5px 0", borderRadius: 7, background: "repeating-linear-gradient(45deg, #fef3e2, #fef3e2 3px, #fde9cc 3px, #fde9cc 6px)", color: "#b45309" }}>
                              abs
                            </span>
                          );
                        }
                        const h = c.hours;
                        const tone = c.weekend ? VIOLET : GREEN;
                        const alpha = Math.min(Math.round((h / denom) * 46) + 10, 56).toString(16).padStart(2, "0");
                        return (
                          <span key={c.key} title={c.future ? `${c.label} : à venir` : `${c.label} : ${fmtH(h)}${c.vac ? " · absence partielle déduite" : ""}`}
                            style={{ textAlign: "center", fontSize: 10.5, fontWeight: 650, fontVariantNumeric: "tabular-nums", padding: "5px 0", borderRadius: 7, letterSpacing: "-0.01em",
                              background: c.future ? "transparent" : h > 0 ? tone + alpha : c.weekend ? "#f6f7fa" : "#f3f4f6",
                              border: c.future ? "1px dashed #e0e4ec" : "none",
                              color: c.future ? FAINT : h > 0 ? (c.weekend ? "#4c1d95" : "#1d4a33") : "#c3cad6" }}>
                            {c.future ? "—" : h > 0 ? fmtH(h) : "·"}
                          </span>
                        );
                      })}
                    </span>

                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 650, color: r.avgDay != null ? TEXT : FAINT }}>
                      {r.avgDay != null ? fmtH(r.avgDay) : "·"}
                    </span>
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 650, color: r.avgWeek != null ? TEXT : FAINT }}>
                      {r.avgWeek != null ? fmtH(r.avgWeek) : "·"}
                    </span>

                    {/* Attendu sur la période + jours travaillés (crayon) */}
                    <span style={{ textAlign: "right", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <span title={`${r.workingDays.length} jour${r.workingDays.length > 1 ? "s" : ""} travaillé${r.workingDays.length > 1 ? "s" : ""} par semaine (${r.workingDays.map((d) => DAY_LABELS[d - 1]).join(", ")}) × ${fmtH(r.perDay)} · absences déduites${!period?.closed ? ` · ${fmtH(r.expectedNow)} à ce stade` : ""}`}
                          style={{ fontSize: 12.5, fontWeight: 700, color: TEXT, fontVariantNumeric: "tabular-nums" }}>
                          {fmtH(r.expectedFull)}
                        </span>
                        <button type="button" className="wh-edit" title="Jours travaillés par semaine (temps partiel…)"
                          onClick={() => { setEditError(null); setEditing(isEditing ? null : r.email); }}
                          style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: MUTED, display: "inline-flex" }}>
                          <PencilIcon size={12} />
                        </button>
                      </span>
                      {isEditing && (
                        <WorkingDaysEditor initial={r.workingDays} saving={saving}
                          onSave={(days) => saveWorkingDays(r.email, days)} onCancel={() => setEditing(null)} />
                      )}
                    </span>

                    <span style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        {mode === "week" && r.delta != null && Math.abs(r.delta) >= 0.25 && (
                          <span title="vs la même portion de la semaine précédente"
                            style={{ fontSize: 10.5, fontWeight: 750, color: r.delta > 0 ? GREEN : "#b45309", fontVariantNumeric: "tabular-nums" }}>
                            {r.delta > 0 ? "+" : "−"}{fmtH(Math.abs(r.delta))}
                          </span>
                        )}
                        <span title={`${st.label} · attendu à ce stade ${fmtH(r.expectedNow)}`}
                          style={{ fontSize: 15, fontWeight: 800, color: st.color, background: st.bg, padding: "3px 8px", borderRadius: 8, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                          {fmtH(r.total)}
                        </span>
                      </span>
                      <span style={{ display: "block", marginTop: 6 }}><Bar value={r.total} max={r.expectedNow} color={st.color} height={5} /></span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
