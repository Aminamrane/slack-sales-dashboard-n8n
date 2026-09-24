// Météo client : les primitives partagées (bandes de couleur, sens de chaque note, icônes).
// Extraites du board le 25/09/2026 pour que la météo d'onboarding (fiche d'intégration, parcours
// « Faire l'onboarding ») utilise exactement les mêmes visuels que la météo client : c'est la même météo.
// 1-2 rouge (critique, risque résiliation), 3 orange (mécontent), 4-5 vert (satisfait).
export const METEO_BANDS = {
  rouge:  { label: "Critique",  color: "#dc2626", bg: "#fdecec", dot: "#dc2626" },
  orange: { label: "Mécontent", color: "#d97706", bg: "#fff3e3", dot: "#d97706" },
  vert:   { label: "Satisfait", color: "#15a34a", bg: "#e9f9ef", dot: "#15a34a" },
};
export const meteoBandOf = (score) => (score == null ? null : score <= 2 ? "rouge" : score === 3 ? "orange" : "vert");
export const meteoStyle = (score) => { const b = meteoBandOf(score); return b ? METEO_BANDS[b] : null; };
// Sens de chaque note (affiché dans le sélecteur) + action implicite (automatisable via CSV).
export const METEO_MEANING = {
  1: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  2: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  3: { txt: "Client mécontent", action: "Axes d'optimisation (Opti'Lex)" },
  4: { txt: "Client satisfait", action: null },
  5: { txt: "Client satisfait", action: "Programme ambassadeur (Owner)" },
};
// Icône météo par note (progression orage -> grand soleil, style lucide, colorée par la bande).
const METEO_ICONS = {
  1: <><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" /><path d="m13 12-3 5h4l-3 5" /></>,      // orage
  2: <><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14v5M8 14v5M12 16v5" /></>, // pluie
  3: <><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></>,                                          // nuageux
  4: <><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" /><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /></>, // éclaircie
  5: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>, // grand soleil
};
// `strokeWidth` réglable : à 16 px un trait de 2 est juste, à 54 px (carte
// météo du dashboard CEO) il faut l'affiner pour que le dessin respire.
export function MeteoIcon({ score, size = 16, color = "currentColor", strokeWidth = 2 }) {
  const paths = METEO_ICONS[score];
  if (!paths) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{paths}</svg>;
}

// Sélecteur 1 à 5, identique à celui de la section « Météo client » du board.
export function MeteoPicker({ value, onChange, size = 19 }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const st = METEO_BANDS[meteoBandOf(n)];
        const on = value === n;
        return (
          <button key={n} type="button" aria-label={`Météo ${n} : ${METEO_MEANING[n].txt}`} aria-pressed={on} onClick={() => onChange(n)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: on ? `2px solid ${st.color}` : "1px solid #e9ebf0", background: on ? st.bg : "#ffffff", color: on ? st.color : "#1e2330", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <MeteoIcon score={n} size={size} color={on ? st.color : "#9aa0ab"} />{n}
          </button>
        );
      })}
    </div>
  );
}

// Phrase de sens sous le sélecteur, comme sur le board.
export function MeteoMeaning({ value }) {
  if (!value) return null;
  const st = METEO_BANDS[meteoBandOf(value)];
  return (
    <div style={{ fontSize: 11.5, color: "#8a93a4", lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color: st.color }}>{METEO_MEANING[value].txt}.</span>
      {METEO_MEANING[value].action ? ` → ${METEO_MEANING[value].action}` : ""}
    </div>
  );
}
