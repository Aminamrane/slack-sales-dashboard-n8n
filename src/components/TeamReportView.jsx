// src/components/TeamReportView.jsx
//
// Rapport direction tous-sales (agrège les bilans hebdo). Affiché en bandeau/onglet
// en haut de la page Enregistrement sales. Rendu depuis le payload
// « OWNER SALES DIRECTOR INTELLIGENCE ».

const BLUE = "#3b82f6", AMBER = "#B4740B", RED = "#A4262C", GREEN = "#2F6B4F", DEEP = "#0E4749";

function AlertBlock({ title, color, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((a, i) => (
          <div key={i} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 11 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "inherit" }}>{a.pratique}{a.freq ? <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}> — {a.freq}</span> : null}</div>
            {a.impact && <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.45, marginTop: 2 }}>{a.impact}</div>}
            {a.action && <div style={{ fontSize: 12, color: DEEP, marginTop: 4 }}><b>Action :</b> {a.action}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamReportView({ report, period, C, darkMode }) {
  if (!report) return null;
  const box = { color: C.text };

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", padding: "18px 20px", ...box }}>
      {/* Synthèse direction */}
      {report.synthese && (
        <div style={{ background: darkMode ? "rgba(14,71,73,0.16)" : "#E6EEEC", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: DEEP, marginBottom: 6 }}>Synthèse direction{period ? ` · ${period}` : ""}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text, margin: 0 }}>{report.synthese}</p>
        </div>
      )}

      {/* Alertes collectives R1 / R2 */}
      {(report.alertes_r1?.length || report.alertes_r2?.length) ? (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
          <AlertBlock title="Alertes collectives R1" color={BLUE} items={report.alertes_r1} />
          <AlertBlock title="Alertes collectives R2" color={AMBER} items={report.alertes_r2} />
        </div>
      ) : null}

      {/* Écarts avec les top sales */}
      {report.ecarts_top?.length ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: GREEN, marginBottom: 8 }}>Écarts avec les top sales</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {report.ecarts_top.map((e, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${GREEN}`, paddingLeft: 11 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.competence}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}><b style={{ color: GREEN }}>Top :</b> {e.top} · <b>Autres :</b> {e.autres}</div>
                {e.standard && <div style={{ fontSize: 12, color: DEEP, marginTop: 2 }}><b>Standard à imposer :</b> {e.standard}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Alertes individuelles par sales */}
      {report.alertes_individuelles?.length ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Par sales</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.alertes_individuelles.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                <b>{a.nom}</b> — {a.alerte} {a.a_changer && <span style={{ color: DEEP }}>→ {a.a_changer}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Alertes critiques */}
      {report.alertes_critiques?.length ? (
        <div style={{ marginBottom: 20, background: darkMode ? "rgba(164,38,44,0.12)" : "#fdf0f0", borderRadius: 12, padding: "12px 15px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: RED, marginBottom: 8 }}>⚠ Alertes critiques</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.alertes_critiques.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                <b style={{ color: RED }}>{a.pratique}</b>{a.sales ? ` · ${a.sales}` : ""}{a.risque ? ` — ${a.risque}` : ""} {a.action && <span style={{ color: DEEP }}>→ {a.action}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Actions à imposer */}
      {report.actions?.length ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: DEEP, marginBottom: 8 }}>Actions à imposer</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {report.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: DEEP, flexShrink: 0 }}>{i + 1}.</span>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                  <b>{a.decision}</b>{a.cible ? ` · Cible : ${a.cible}` : ""}{a.mise_en_oeuvre ? ` · ${a.mise_en_oeuvre}` : ""}{a.controle ? ` · Contrôle : ${a.controle}` : ""}{a.delai ? ` · ${a.delai}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
