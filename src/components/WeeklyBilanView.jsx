// src/components/WeeklyBilanView.jsx
//
// Bilan hebdomadaire d'un sales (agrège ses scorecards R1/R2). Affiché en tête
// de la fiche sales. Rendu depuis le payload « OWNER WEEKLY SALES COACH ».

import { useState } from "react";

const GREEN = "#2F6B4F", BLUE = "#3b82f6", AMBER = "#B4740B", DEEP = "#0E4749";

function List({ title, color, items, keyMap, darkMode, C }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
              {it[keyMap.title]}{it.statut ? <span style={{ fontSize: 10.5, fontWeight: 700, color, opacity: 0.85 }}> · {it.statut}</span> : null}
            </div>
            {it.detail && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>{it.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyBilanView({ bilan, C, darkMode }) {
  const [open, setOpen] = useState(true);
  if (!bilan) return null;

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", overflow: "hidden", marginBottom: 22 }}>
      {/* En-tête */}
      <div onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: "pointer", borderBottom: open ? `1px solid ${C.border}` : "none" }}>
        <span style={{ fontSize: 15 }}>🧭</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Bilan de la semaine</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>
            {bilan.periode ? `${bilan.periode} · ` : ""}{bilan.nb_r1 != null ? `${bilan.nb_r1} R1` : ""}{bilan.nb_r2 != null ? ` · ${bilan.nb_r2} R2` : ""}{bilan.resultats ? ` · ${bilan.resultats}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 12, color: C.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px 18px" }}>
          {bilan.bilan && <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text, margin: "0 0 16px" }}>{bilan.bilan}</p>}

          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 16 }}>
            <List title="Ce qu'il fait bien" color={GREEN} items={bilan.bien_fait} keyMap={{ title: "competence" }} darkMode={darkMode} C={C} />
            <List title="Progression" color={BLUE} items={bilan.progression} keyMap={{ title: "competence" }} darkMode={darkMode} C={C} />
            <List title="Ce qui lui fait perdre" color={AMBER} items={bilan.perd_opportunites} keyMap={{ title: "faiblesse" }} darkMode={darkMode} C={C} />
          </div>

          {(bilan.r1_semaine || bilan.r2_semaine) && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {bilan.r1_semaine && <div style={{ flex: 1, minWidth: 240, background: darkMode ? "rgba(59,130,246,0.08)" : "#eff6ff", borderRadius: 10, padding: "10px 13px" }}><div style={{ fontSize: 10.5, fontWeight: 700, color: BLUE, marginBottom: 3 }}>SES R1</div><div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{bilan.r1_semaine}</div></div>}
              {bilan.r2_semaine && <div style={{ flex: 1, minWidth: 240, background: darkMode ? "rgba(251,146,60,0.08)" : "#fff7ed", borderRadius: 10, padding: "10px 13px" }}><div style={{ fontSize: 10.5, fontWeight: 700, color: "#fb923c", marginBottom: 3 }}>SES R2</div><div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{bilan.r2_semaine}</div></div>}
            </div>
          )}

          {bilan.comportemental && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Analyse comportementale</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.55, color: C.text, margin: 0, fontStyle: "italic" }}>{bilan.comportemental}</p>
            </div>
          )}

          {bilan.action && (
            <div style={{ background: darkMode ? "rgba(14,71,73,0.14)" : "#E6EEEC", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: DEEP, marginBottom: 6 }}>🎯 Action à mettre en place</div>
              {bilan.action.objectif && <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 4 }}>{bilan.action.objectif}</div>}
              {bilan.action.pourquoi && <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>{bilan.action.pourquoi}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: C.text }}>
                {bilan.action.avant && <div><b>Avant :</b> {bilan.action.avant}</div>}
                {bilan.action.pendant && <div><b>Pendant :</b> {bilan.action.pendant}</div>}
                {bilan.action.formulation && <div style={{ fontStyle: "italic", color: DEEP }}>« {bilan.action.formulation} »</div>}
                {bilan.action.apres && <div><b>Après :</b> {bilan.action.apres}</div>}
                {bilan.action.mesure && <div style={{ marginTop: 4, color: C.muted }}><b>Mesure :</b> {bilan.action.mesure}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
