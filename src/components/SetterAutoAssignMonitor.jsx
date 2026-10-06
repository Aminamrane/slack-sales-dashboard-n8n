// Monitoring de l'auto-affectation des RDV setters (dev 06/10/2026), lecture seule : qui reçoit les RDV posés
// par les setters depuis l'agenda unique, pourquoi (préférence de secteur, équité, lead déjà suivi) et
// l'équilibre de la semaine. Même langage visuel que LeadAssignmentLive (charte makeCharte).
import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/apiClient";
import { makeCharte } from "../styles/charte.js";
import { sectorMeta } from "../utils/sectors";

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const REFRESH_MS = 60000;

const REASON = {
  preference: { label: "Préférence", color: "#bf945f" },
  equity: { label: "Équité", color: "#5b7fc4" },
  owner: { label: "Déjà suivi", color: "#8b94a6" },
};
const STATE = {
  upcoming: { label: "À venir", color: "#3b82f6" },
  held: { label: "Honoré", color: "#10b981" },
  no_show: { label: "No-show", color: "#dc2626" },
  cancelled: { label: "Annulé", color: "#94a3b8" },
  to_qualify: { label: "À qualifier", color: "#d97706" },
  moved: { label: "Déplacé", color: "#94a3b8" },
};

const ago = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return "il y a " + Math.floor(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.floor(s / 3600) + " h";
  return "il y a " + Math.floor(s / 86400) + " j";
};
// « jeu. 8 oct. · 10 h 30 », lu sur la chaîne (heure-mur de Paris, jamais convertie).
const slotLabel = (wall) => {
  if (!wall) return "";
  const day = new Date(`${wall.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${Number(wall.slice(11, 13))} h ${wall.slice(14, 16)}`;
};
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });

function tint(hex, a) {
  const n = parseInt((hex || "#8b94a6").replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function Pill({ color, children, strike = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      background: tint(color, 0.12), color: "inherit", border: `1px solid ${tint(color, 0.35)}`, whiteSpace: "nowrap",
      textDecoration: strike ? "line-through" : "none", textDecorationColor: tint(color, 0.8) }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />{children}
    </span>
  );
}

export default function SetterAutoAssignMonitor({ darkMode = false }) {
  const C = makeCharte(darkMode);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await apiClient.get("/api/v1/admin/lead-assignment/setter-monitor"));
      setLoadedAt(new Date().toISOString());
      setError("");
    } catch (e) {
      setError(e?.data?.detail || "Impossible de charger le monitoring des RDV setters.");
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadow };
  const label = { fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted };
  const t = data?.totals || {};
  const sales = data?.sales || [];
  const feed = data?.feed || [];
  const max = Math.max(1, ...sales.map((s) => s.week));
  const pct = (n) => (t.week ? Math.round((n / t.week) * 100) + " %" : "0 %");

  if (error) return <div style={{ ...card, padding: 24, color: C.warn, fontFamily: FONT, fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.muted, fontFamily: FONT, fontSize: 13 }}>Chargement…</div>;

  return (
    <div style={{ fontFamily: FONT, padding: "4px 6px 32px", animation: "fadeUp 0.4s ease both" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .sam-row td{border-top:1px solid ${C.border};padding:11px 8px;vertical-align:middle}
        .sam-row:hover{background:${darkMode ? "rgba(255,255,255,0.03)" : "rgba(37,99,235,0.03)"}}`}</style>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, maxWidth: 760 }}>
          Semaine du {dayLabel(data.week.start)} au {dayLabel(data.week.end)}. Quand un setter pose un R1 depuis l'agenda unique, le créneau va
          d'abord à un sales qui préfère le secteur du lead{data.mode === "exclusive" ? " (exclusivement)" : ""}, sinon au moins servi de la semaine ; un lead déjà suivi garde son commercial.
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>Mis à jour {ago(loadedAt)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, margin: "16px 0 20px" }}>
        {[
          { l: "Aujourd'hui", v: t.today, s: "RDV setters attribués", color: C.accent },
          { l: "Cette semaine", v: t.week, s: "sur les créneaux de la semaine", color: C.ok },
          { l: "Par préférence", v: t.preference, s: pct(t.preference) + " de la semaine", color: REASON.preference.color },
          { l: "Par équité", v: t.equity, s: pct(t.equity) + " de la semaine", color: REASON.equity.color },
          { l: "Déjà suivis", v: t.owner, s: "gardés par leur commercial", color: REASON.owner.color },
        ].map((k) => (
          <div key={k.l} style={{ ...card, padding: "14px 16px", borderTop: `3px solid ${k.color}` }}>
            <div style={label}>{k.l}</div>
            <div style={{ fontSize: 26, fontWeight: 750, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 4 }}>{k.v ?? 0}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{k.s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px 13px", borderBottom: "1px solid " + C.border, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>Répartition par commercial</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span>RDV setters reçus sur les créneaux de la semaine</span>
                {Object.values(REASON).map((r) => (
                  <span key={r.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />{r.label}
                  </span>
                ))}
              </div>
            </div>
            {t.week > 0 && (
              <span style={{ padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: (t.spread <= 1 ? C.ok : C.warn) + "16", color: t.spread <= 1 ? C.ok : C.warn }}>
                {t.spread <= 1 ? "Équilibré" : `Écart de ${t.spread} RDV`}
              </span>
            )}
          </div>
          <div style={{ overflowX: "auto", padding: "0 8px 6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Commercial", "Préférences", "Semaine", "Aujourd'hui", "Dernier"].map((h, i) => (
                    <th key={h} style={{ ...label, padding: "10px 8px 6px", textAlign: i < 2 ? "left" : "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.email} className="sam-row">
                    <td style={{ fontSize: 13, fontWeight: 650, color: C.text, whiteSpace: "nowrap" }}>{s.full_name || s.email}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, color: C.text2 }}>
                        {s.preferred.length === 0 && s.excluded.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>Ouvert à tout</span>}
                        {s.preferred.map((p) => <Pill key={p.key} color={sectorMeta(p.key)?.color || "#8b94a6"}>{p.label}</Pill>)}
                        {s.excluded.map((p) => <Pill key={p.key} color="#c25555" strike>{p.label}</Pill>)}
                      </div>
                    </td>
                    <td style={{ width: 150 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.06)" : "#eef0f4", overflow: "hidden", display: "flex" }}>
                          <div title="Par préférence" style={{ width: `${(s.preference / max) * 100}%`, height: "100%", background: REASON.preference.color, transition: "width .5s ease" }} />
                          <div title="Par équité" style={{ width: `${(s.equity / max) * 100}%`, height: "100%", background: REASON.equity.color, transition: "width .5s ease" }} />
                          <div title="Déjà suivis" style={{ width: `${(s.owner / max) * 100}%`, height: "100%", background: REASON.owner.color, transition: "width .5s ease" }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.week ? C.text : C.muted, fontVariantNumeric: "tabular-nums", minWidth: 16, textAlign: "right" }}>{s.week}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontSize: 13, color: s.today ? C.text : C.muted, fontVariantNumeric: "tabular-nums" }}>{s.today}</td>
                    <td style={{ textAlign: "center", fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>{s.last_at ? ago(s.last_at) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.setters.length > 0 && (
            <div style={{ borderTop: "1px solid " + C.border, padding: "12px 18px 14px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ ...label, marginRight: 4 }}>Setters</span>
              {data.setters.map((s) => (
                <span key={s.name} style={{ fontSize: 12, color: C.text2, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "4px 9px" }}>
                  <strong style={{ color: C.text }}>{s.name}</strong> · {s.week} cette semaine{s.today ? `, ${s.today} aujourd'hui` : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "15px 18px 13px", borderBottom: "1px solid " + C.border }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>Dernières attributions</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Qui a posé, qui a reçu, et pourquoi</div>
          </div>
          <div style={{ maxHeight: 620, overflowY: "auto", padding: "4px 10px 8px" }}>
            {feed.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "48px 12px", lineHeight: 1.55 }}>
                Aucun RDV setter attribué pour l'instant. Les attributions apparaîtront ici dès le premier R1 posé depuis l'agenda unique.
              </div>
            )}
            {feed.map((f, i) => {
              const reason = REASON[f.reason] || REASON.equity;
              const state = STATE[f.state] || STATE.upcoming;
              return (
                <div key={f.id} style={{ padding: "11px 8px", borderBottom: i < feed.length - 1 ? "1px solid " + C.border : "none" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.text }}>
                      <strong>{f.setter_name || "Setter"}</strong> <span style={{ color: C.muted }}>→</span> <strong>{f.sales_name}</strong>
                    </span>
                    <span style={{ fontSize: 10.5, color: C.muted, whiteSpace: "nowrap" }}>{ago(f.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text2, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.lead_label || `Lead ${f.lead_id}`} · {slotLabel(f.slot_at)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7, color: C.text2 }}>
                    <Pill color={reason.color}>{reason.label}</Pill>
                    {f.sector_label && <Pill color={sectorMeta(f.sector)?.color || "#8b94a6"}>{f.sector_label}</Pill>}
                    <Pill color={state.color}>{state.label}</Pill>
                    {f.candidates_count > 1 && <span style={{ fontSize: 11, color: C.muted, alignSelf: "center" }}>{f.candidates_count} sales libres</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
