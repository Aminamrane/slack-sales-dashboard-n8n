// src/components/TeamReportView.jsx
//
// Rapport direction tous-sales, rendu comme un TABLEAU DE BORD D'INTELLIGENCE
// (modèle « analytics dashboard » fourni par Youcef) : KPI en tête, classement
// des sales de la semaine, alertes collectives, actions à imposer. Vue de pilotage
// pour la direction (≠ dossier de coaching adressé au sales).
//
// Props :
//   report = payload « OWNER SALES DIRECTOR INTELLIGENCE »
//            { synthese, alertes_r1[], alertes_r2[], ecarts_top[],
//              alertes_individuelles[], alertes_critiques[], actions[] }
//   stats  = [{ email, name, avatar, nb, nb_r1, nb_r2, avg }] (agrégé côté page)

const band = (s) => (s >= 80 ? "#22c55e" : s >= 70 ? "#3b82f6" : s >= 60 ? "#eab308" : "#ef4444");

function Kpi({ label, value, sub, accent, C, darkMode }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 160, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", background: darkMode ? "rgba(255,255,255,0.02)" : "#fff" }}>
      <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 500, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: accent || C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{sub}</div>}
    </div>
  );
}

function Avatar({ url, name, size = 28 }) {
  const ini = (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "#1e2330", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700 }}>{ini}</div>;
}

function AlertCards({ title, color, items, C, darkMode }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((a, i) => (
          <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", background: darkMode ? "rgba(255,255,255,0.02)" : "#fff" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: a.impact ? 4 : 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, transform: "translateY(-2px)" }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, flex: 1 }}>{a.pratique}</span>
              {a.freq && <span style={{ fontSize: 10.5, fontWeight: 600, color, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{a.freq}</span>}
            </div>
            {a.impact && <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginLeft: 14 }}>{a.impact}</div>}
            {a.action && <div style={{ fontSize: 12.5, color: darkMode ? "#5eead4" : "#0E4749", lineHeight: 1.5, marginLeft: 14, marginTop: 5 }}><b>→</b> {a.action}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamReportView({ report, stats, period, C, darkMode }) {
  if (!report) return null;
  const ranked = (stats || []).filter((s) => s.nb > 0 && s.avg != null).slice().sort((a, b) => b.avg - a.avg);
  const totR1 = (stats || []).reduce((n, s) => n + (s.nb_r1 || 0), 0);
  const totR2 = (stats || []).reduce((n, s) => n + (s.nb_r2 || 0), 0);
  const totNb = ranked.reduce((n, s) => n + s.nb, 0);
  const teamAvg = totNb ? Math.round(ranked.reduce((n, s) => n + s.avg * s.nb, 0) / totNb) : null;
  const nbCrit = report.alertes_critiques?.length || 0;

  const SectionTitle = ({ children, color }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: color || C.muted, marginBottom: 12 }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* KPI */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Kpi label="R1 analysés" value={totR1} sub={`semaine ${period || ""}`.trim()} C={C} darkMode={darkMode} />
        <Kpi label="R2 analysés" value={totR2} sub={`${ranked.length} sales couverts`} C={C} darkMode={darkMode} />
        <Kpi label="Score équipe" value={teamAvg != null ? teamAvg : "—"} sub={teamAvg != null ? "moyenne d'exécution /100" : "pas de scorecard"} accent={teamAvg != null ? band(teamAvg) : undefined} C={C} darkMode={darkMode} />
        <Kpi label="Alertes critiques" value={nbCrit} sub={nbCrit ? "à traiter en priorité" : "aucune cette semaine"} accent={nbCrit ? "#ef4444" : undefined} C={C} darkMode={darkMode} />
      </div>

      {/* Synthèse */}
      {report.synthese && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", background: darkMode ? "rgba(59,130,246,0.06)" : "#f8fafc" }}>
          <SectionTitle color={darkMode ? "#93c5fd" : "#2563eb"}>Synthèse direction</SectionTitle>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text, margin: 0 }}>{report.synthese}</p>
        </div>
      )}

      {/* Classement de la semaine */}
      {ranked.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", background: darkMode ? "rgba(255,255,255,0.02)" : "#fff" }}>
          <SectionTitle>Classement de la semaine · exécution</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {ranked.map((s, i) => {
              const col = band(s.avg);
              return (
                <div key={s.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < ranked.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ width: 22, fontSize: 13, fontWeight: 700, color: i === 0 ? col : C.muted, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{i + 1}</span>
                  <Avatar url={s.avatar} name={s.name} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, width: 150, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.07)" : "#eef1f4", overflow: "hidden", minWidth: 80 }}>
                    <div style={{ width: `${Math.max(4, Math.min(100, s.avg))}%`, height: "100%", background: col, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: col, width: 30, textAlign: "right", flexShrink: 0 }}>{s.avg}</span>
                  <span style={{ fontSize: 11.5, color: C.muted, width: 74, textAlign: "right", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>{s.nb} RDV</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alertes collectives R1 / R2 */}
      {(report.alertes_r1?.length || report.alertes_r2?.length) ? (
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <AlertCards title="Alertes collectives R1" color="#3b82f6" items={report.alertes_r1} C={C} darkMode={darkMode} />
          <AlertCards title="Alertes collectives R2" color="#eab308" items={report.alertes_r2} C={C} darkMode={darkMode} />
        </div>
      ) : null}

      {/* Écarts avec les top sales */}
      {report.ecarts_top?.length ? (
        <div>
          <SectionTitle color="#22c55e">Écarts avec les top sales</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {report.ecarts_top.map((e, i) => (
              <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 15px", background: darkMode ? "rgba(255,255,255,0.02)" : "#fff" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>{e.competence}</div>
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}><b style={{ color: "#22c55e" }}>Top :</b> {e.top}</div>
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}><b>Autres :</b> {e.autres}</div>
                {e.standard && <div style={{ fontSize: 12.5, color: darkMode ? "#5eead4" : "#0E4749", lineHeight: 1.5, marginTop: 5 }}><b>Standard :</b> {e.standard}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Par sales */}
      {report.alertes_individuelles?.length ? (
        <div>
          <SectionTitle>Par sales</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {report.alertes_individuelles.map((a, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.nom}</div>
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{a.alerte}{a.a_changer && <span style={{ color: darkMode ? "#5eead4" : "#0E4749" }}> → {a.a_changer}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Alertes critiques */}
      {report.alertes_critiques?.length ? (
        <div style={{ border: `1px solid ${darkMode ? "rgba(239,68,68,0.4)" : "#fecaca"}`, borderRadius: 14, padding: "16px 18px", background: darkMode ? "rgba(239,68,68,0.08)" : "#fef2f2" }}>
          <SectionTitle color="#ef4444">⚠ Alertes critiques</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.alertes_critiques.map((a, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                <b style={{ color: "#ef4444" }}>{a.pratique}</b>{a.sales ? ` · ${a.sales}` : ""}{a.risque ? ` — ${a.risque}` : ""}{a.action && <span style={{ color: darkMode ? "#5eead4" : "#0E4749" }}> → {a.action}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Actions à imposer */}
      {report.actions?.length ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", background: darkMode ? "rgba(255,255,255,0.02)" : "#fff" }}>
          <SectionTitle color={darkMode ? "#5eead4" : "#0E4749"}>Actions à imposer cette semaine</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {report.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: darkMode ? "#5eead4" : "#0E4749", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                  <b>{a.decision}</b>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {[a.cible && `Cible : ${a.cible}`, a.mise_en_oeuvre, a.controle && `Contrôle : ${a.controle}`, a.delai].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
