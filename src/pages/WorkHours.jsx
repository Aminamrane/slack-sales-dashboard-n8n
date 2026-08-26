// src/pages/WorkHours.jsx
//
// Heures de travail hebdomadaires (menu Humain). Accès : admin, ceo, hr.
// Source : agendas Google de l'équipe (compte de service), calcul backend :
// jours ouvrés uniquement, vacances déclarées exclues, événements non-travail
// (pause, sport, déjeuner...) exclus, chevauchements fusionnés.
// Interactif : classement, filtre par semaine, totaux par pôle recalculés en
// direct quand on coche/décoche des personnes.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";

const NAVY = "#121b35";
const GREEN = "#3e7d5a";
const BORDER = "#e5e8ee";
const MUTED = "#8a93a4";
const TEXT = "#1e2330";
const CARD = "#ffffff";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const POLE_COLORS = {
  Devs: "#6366f1", Sales: "#2563eb", Setters: "#0ea5e9", Finance: "#d97706",
  Marketing: "#db2777", Direction: NAVY, RH: "#7c3aed", "Client Success": GREEN, Autre: MUTED,
};
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
// Moyennes : plancher mai 2026 (agendas peu tenus avant). La plage est
// sélectionnable par MOIS (raccourcis) ou par semaines (deux dates).
const AVG_FLOOR = "2026-05-04";
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// Lundis couvrant un mois : du 1er lundi >= 1er du mois au dernier lundi <= fin du mois.
const monthRange = (y, m) => {
  const first = new Date(y, m, 1);
  const start = mondayOf(first);
  const startIso = iso(start) < iso(first) ? iso(new Date(start.getTime() + 7 * 864e5)) : iso(start);
  const last = new Date(y, m + 1, 0);
  const endIso = iso(mondayOf(last));
  return { from: startIso < AVG_FLOOR ? AVG_FLOOR : startIso, to: endIso };
};

const mondayOf = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const iso = (d) => d.toLocaleDateString("fr-CA");
const fmtDay = (isoStr) => new Date(isoStr + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fmtH = (h) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
};

export default function WorkHours({ embed = false }) {
  const navigate = useNavigate();
  const user = apiClient.getUser();
  useEffect(() => {
    if (!user || !["admin", "ceo", "hr"].includes(user.role)) navigate("/");
  }, [user, navigate]);

  const [week, setWeek] = useState(() => iso(mondayOf(new Date())));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unchecked, setUnchecked] = useState(() => new Set());
  // Période de moyenne : par défaut le mois courant (août au lancement).
  const [avgRange, setAvgRange] = useState(() => {
    const now = new Date();
    return monthRange(now.getFullYear(), now.getMonth());
  });
  const [avgData, setAvgData] = useState(null);
  const [avgLoading, setAvgLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setAvgLoading(true);
    apiClient.get(`/api/v1/hr/work-hours/averages?from=${avgRange.from}&to=${avgRange.to}`)
      .then((r) => { if (alive) { setAvgData(r); setAvgLoading(false); } })
      .catch(() => { if (alive) { setAvgData(null); setAvgLoading(false); } });
    return () => { alive = false; };
  }, [avgRange.from, avgRange.to]);

  const avgByEmail = useMemo(() => {
    const m = {};
    for (const p of (avgData?.people || [])) m[p.email] = p;
    return m;
  }, [avgData]);

  // Mois proposés : de mai 2026 au mois courant.
  const monthOptions = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let y = 2026, m = 4; y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()); m++) {
      if (m > 11) { m = -1; y++; continue; }
      out.push({ y, m, label: MONTHS_FR[m], ...monthRange(y, m) });
    }
    return out;
  }, []);
  const activeMonth = monthOptions.find((o) => o.from === avgRange.from && o.to === avgRange.to);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    apiClient.get(`/api/v1/hr/work-hours?week=${week}`)
      .then((r) => { if (alive) { setData(r); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e.message || "Erreur"); setLoading(false); } });
    return () => { alive = false; };
  }, [week]);

  const shiftWeek = (dir) => {
    const d = new Date(week + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeek(iso(d));
  };

  const people = data?.people || [];
  const accessible = useMemo(() => people.filter((p) => p.accessible), [people]);
  const checked = useMemo(() => accessible.filter((p) => !unchecked.has(p.email)), [accessible, unchecked]);
  const maxTotal = useMemo(() => Math.max(1, ...checked.map((p) => p.total)), [checked]);

  const globalTotal = useMemo(() => checked.reduce((a, p) => a + p.total, 0), [checked]);
  const poles = useMemo(() => {
    const m = new Map();
    for (const p of checked) {
      const cur = m.get(p.pole) || { total: 0, count: 0 };
      cur.total += p.total; cur.count += 1;
      m.set(p.pole, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [checked]);

  const toggle = (email) => setUnchecked((prev) => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email); else next.add(email);
    return next;
  });

  const weekLabel = data
    ? `${fmtDay(data.days[0])} au ${fmtDay(data.days[4])}`
    : "";
  const isCurrentWeek = week === iso(mondayOf(new Date()));

  const card = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(17,24,39,0.05)" };

  return (
    <div style={{ fontFamily: FONT, minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : "#f4f5f7", color: TEXT }}>
      {!embed && <SharedNavbar />}
      <style>{`@keyframes whUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 60px", animation: "whUp 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* En-tête + navigation semaine */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 750, color: NAVY, letterSpacing: "-0.02em" }}>Heures de travail</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
              Agendas Google · jours ouvrés (lun-ven) jusqu'au jour courant · vacances et événements non-travail exclus
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => shiftWeek(-1)}
              style={{ padding: "8px 13px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>←</motion.button>
            <div style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, fontSize: 13, fontWeight: 700, color: NAVY, minWidth: 170, textAlign: "center" }}>
              Semaine du {weekLabel}{isCurrentWeek ? " · en cours" : ""}
            </div>
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => shiftWeek(1)}
              style={{ padding: "8px 13px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>→</motion.button>
          </div>
        </div>

        {loading ? (
          <div style={{ ...card, padding: 48, textAlign: "center", color: MUTED, fontSize: 13.5 }}>
            Lecture des agendas de l'équipe…
          </div>
        ) : error ? (
          <div style={{ ...card, padding: 48, textAlign: "center", color: "#b42318", fontSize: 13.5 }}>{error}</div>
        ) : (
          <>
            {/* Totaux : global + par pôle (recalculés selon les personnes cochées) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 11, marginBottom: 22 }}>
              <div style={{ ...card, padding: "14px 16px", background: NAVY, border: "none" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>Total équipe</div>
                <div style={{ fontSize: 26, fontWeight: 780, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtH(globalTotal)}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{checked.length} personne{checked.length > 1 ? "s" : ""} comptée{checked.length > 1 ? "s" : ""}</div>
              </div>
              {poles.map(([pole, v]) => (
                <div key={pole} style={{ ...card, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: POLE_COLORS[pole] || MUTED }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED }}>{pole}</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 780, color: NAVY, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtH(v.total)}</div>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{v.count} pers. · {fmtH(v.count ? v.total / v.count : 0)}/pers.</div>
                </div>
              ))}
            </div>

            {/* Classement */}
            <div style={{ ...card, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 14.5, fontWeight: 750, color: NAVY }}>Classement de la semaine</div>
                <button type="button" onClick={() => setUnchecked(new Set())}
                  style={{ border: "none", background: "transparent", color: unchecked.size ? "#2563eb" : MUTED, fontSize: 12, fontWeight: 600, cursor: unchecked.size ? "pointer" : "default", fontFamily: "inherit" }}>
                  Tout recocher{unchecked.size ? ` (${unchecked.size} masqué${unchecked.size > 1 ? "s" : ""})` : ""}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
                Décoche une personne pour voir son impact sur les totaux.
              </div>

              {/* Période de la colonne « Moyenne » : mois entiers ou plage libre de semaines. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, background: "#f7f8fa", border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: MUTED }}>Moyenne</span>
                {monthOptions.map((o) => {
                  const on = activeMonth && activeMonth.from === o.from && activeMonth.to === o.to;
                  return (
                    <button key={`${o.y}-${o.m}`} type="button" onClick={() => setAvgRange({ from: o.from, to: o.to })}
                      style={{ padding: "4px 11px", borderRadius: 16, border: `1px solid ${on ? NAVY : BORDER}`, background: on ? NAVY : CARD, color: on ? "#fff" : TEXT, fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                      {o.label}
                    </button>
                  );
                })}
                <button type="button"
                  onClick={() => setAvgRange({ from: AVG_FLOOR, to: iso(mondayOf(new Date())) })}
                  style={{ padding: "4px 11px", borderRadius: 16, border: `1px solid ${!activeMonth ? NAVY : BORDER}`, background: !activeMonth ? NAVY : CARD, color: !activeMonth ? "#fff" : TEXT, fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>
                  Depuis mai
                </button>
                <span style={{ width: 1, height: 18, background: BORDER, margin: "0 2px" }} />
                <input type="date" value={avgRange.from} min={AVG_FLOOR}
                  onChange={(e) => e.target.value && setAvgRange((r) => ({ ...r, from: iso(mondayOf(new Date(e.target.value + "T00:00:00"))) }))}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", fontSize: 11.5, fontFamily: "inherit", color: TEXT, background: CARD }} />
                <span style={{ fontSize: 11.5, color: MUTED }}>au</span>
                <input type="date" value={avgRange.to} min={avgRange.from}
                  onChange={(e) => e.target.value && setAvgRange((r) => ({ ...r, to: iso(mondayOf(new Date(e.target.value + "T00:00:00"))) }))}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", fontSize: 11.5, fontFamily: "inherit", color: TEXT, background: CARD }} />
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: MUTED }}>
                  {avgLoading ? "calcul…" : "semaines avec absence exclues"}
                </span>
              </div>

              {/* En-têtes jours */}
              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 250px 64px 70px", gap: 10, padding: "0 10px 8px", alignItems: "center" }}>
                <span /><span />
                <span />
                <span style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {DAY_LABELS.map((d) => <span key={d} style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "center", textTransform: "uppercase" }}>{d}</span>)}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>
                  Moy. {activeMonth ? activeMonth.label.slice(0, 4) : "période"}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textAlign: "right", textTransform: "uppercase" }}>Total</span>
              </div>

              <AnimatePresence initial={false}>
                {accessible.map((p, i) => {
                  const off = unchecked.has(p.email);
                  const pc = POLE_COLORS[p.pole] || MUTED;
                  return (
                    <motion.div key={p.email} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: Math.min(i, 12) * 0.02 }}
                      onClick={() => toggle(p.email)}
                      style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 250px 64px 70px", gap: 10, alignItems: "center",
                        padding: "9px 10px", borderRadius: 10, cursor: "pointer", opacity: off ? 0.38 : 1,
                        background: "transparent", transition: "opacity 0.18s ease" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f8fa"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${off ? "#cbd2e0" : GREEN}`, background: off ? "transparent" : GREEN, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s, border-color 0.15s" }}>
                        {!off && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, width: 18, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 650, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          {p.vacation_days.length > 0 && (
                            <span style={{ fontSize: 10, color: "#b45309", fontWeight: 600 }}>{p.vacation_days.length} j. de vacances cette semaine</span>
                          )}
                        </span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifySelf: "start", padding: "2px 9px", borderRadius: 10, background: pc + "14", color: pc, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc }} />{p.pole}
                      </span>
                      <span style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                        {p.daily.map((h, di) => {
                          const future = data.counted_until && data.days[di] > data.counted_until;
                          return (
                            <span key={di} title={future ? `${DAY_LABELS[di]} : à venir (non compté)` : `${DAY_LABELS[di]} : ${fmtH(h)}`}
                              style={{ textAlign: "center", fontSize: 11, fontWeight: 650, fontVariantNumeric: "tabular-nums",
                                padding: "3px 0", borderRadius: 6,
                                background: future ? "transparent" : h > 0 ? GREEN + Math.min(Math.round((h / 10) * 40) + 10, 50).toString(16).padStart(2, "0") : "#f3f4f6",
                                border: future ? "1px dashed #e0e4ec" : "none",
                                color: future ? "#d5dae4" : h > 0 ? "#1d4a33" : "#c3cad6" }}>
                              {future ? "—" : h > 0 ? fmtH(h) : "·"}
                            </span>
                          );
                        })}
                      </span>
                      {(() => {
                        const a = avgByEmail[p.email];
                        return (
                          <span title={a ? `Moyenne hebdomadaire sur ${a.weeks} semaine(s) pleine(s) de la période` : "Aucune semaine pleine sur la période"}
                            style={{ textAlign: "right", fontSize: 12, fontWeight: 650, color: a ? MUTED : "#d5dae4", fontVariantNumeric: "tabular-nums" }}>
                            {a ? fmtH(a.avg) : "·"}
                          </span>
                        );
                      })()}
                      <span style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 14.5, fontWeight: 780, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{fmtH(p.total)}</span>
                        <span style={{ display: "block", height: 3, borderRadius: 2, background: "#eef1f6", marginTop: 4, overflow: "hidden" }}>
                          <motion.span layout style={{ display: "block", height: "100%", borderRadius: 2, background: GREEN, width: `${Math.round((p.total / maxTotal) * 100)}%`, transition: "width 0.35s cubic-bezier(0.16,1,0.3,1)" }} />
                        </span>
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
