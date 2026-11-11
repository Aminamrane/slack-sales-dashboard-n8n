// Météo client : les primitives partagées (bandes de couleur, sens de chaque note, icônes).
// Extraites du board le 25/09/2026 pour que la météo d'onboarding (fiche d'intégration, parcours
// « Faire l'onboarding ») utilise exactement les mêmes visuels que la météo client : c'est la même météo.
// 1-2 rouge (critique, risque résiliation), 3 orange (mécontent), 4-5 vert (satisfait).
// Bandes et seuils définis dans utils/meteoBands.js (module sans JSX, lisible par les tests).
import { useId } from "react";
import { METEO_BANDS, meteoBandOf } from "../utils/meteoBands.js";
import "./meteo.css";
export { METEO_BANDS, meteoBandOf };
export const meteoStyle = (score) => { const b = meteoBandOf(score); return b ? METEO_BANDS[b] : null; };
// Sens de chaque note (affiché dans le sélecteur) + action implicite (automatisable via CSV).
export const METEO_MEANING = {
  1: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  2: { txt: "Situation critique, fort risque de résiliation", action: "Plan de rétention (Owner)" },
  3: { txt: "Client mécontent", action: "Axes d'optimisation (Opti'Lex)" },
  4: { txt: "Client satisfait", action: null },
  5: { txt: "Client satisfait", action: "Programme ambassadeur (Owner)" },
};
// Icône météo par note (progression orage -> grand soleil), redessinée le 29/10/2026 (« plus beau, plus de motion
// design ») : deux tons, le trait dans la couleur de la bande et les volumes dans la même couleur en aplat léger.
// Au survol de son bouton ou de sa ligne, chacune a son geste (meteo.css) : le soleil rayonne, l'éclaircie se
// dévoile, le nuage dérive, la pluie tombe, l'éclair claque.
const CLOUD_BIG = "M6.6 19h10.1a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 5.75 12.1 3.45 3.45 0 0 0 6.6 19Z";
const CLOUD_LOW = "M6.4 20.2h8.9a3.7 3.7 0 0 0 .5-7.35 5.3 5.3 0 0 0-10.2 1.15 3.1 3.1 0 0 0 .8 6.2Z";
const CLOUD_HIGH = "M6.6 15.6h10.1a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 5.75 8.7a3.45 3.45 0 0 0 .85 6.9Z";
const METEO_ICONS = {
  5: (c) => <>
    <circle cx="12" cy="12" r="4.4" fill={c} fillOpacity=".2" />
    <g className="mi-rays"><path d="M12 2.6v2M12 19.4v2M4.65 4.65l1.4 1.4M17.95 17.95l1.4 1.4M2.6 12h2M19.4 12h2M4.65 19.35l1.4-1.4M17.95 6.05l1.4-1.4" /></g>
  </>,
  4: (c, id) => <>
    <defs><mask id={id}><rect width="24" height="24" fill="#fff" /><path d={CLOUD_LOW} fill="#000" stroke="#000" strokeWidth="3.2" /></mask></defs>
    <g mask={`url(#${id})`}><g className="mi-sun">
      <circle cx="15.4" cy="8.6" r="3.5" fill={c} fillOpacity=".22" />
      <path d="M15.4 2.6v1.4M21.4 8.6H20M19.65 4.35l-1 1M11.15 4.35l1 1M20.2 12.9l-1-1" />
    </g></g>
    <g className="mi-drift"><path d={CLOUD_LOW} fill={c} fillOpacity=".14" /></g>
  </>,
  3: (c, id) => <>
    <defs><mask id={id}><rect width="24" height="24" fill="#fff" /><path d={CLOUD_BIG} fill="#000" stroke="#000" strokeWidth="3.2" /></mask></defs>
    <g mask={`url(#${id})`}><g className="mi-back"><path d="M15.4 12.6h4.9a2.45 2.45 0 0 0 .35-4.85 3.6 3.6 0 0 0-6.85.75 2.05 2.05 0 0 0 1.6 4.1Z" fill={c} fillOpacity=".1" strokeOpacity=".55" /></g></g>
    <g className="mi-drift"><path d={CLOUD_BIG} fill={c} fillOpacity=".16" /></g>
  </>,
  2: (c) => <>
    <g className="mi-drift"><path d={CLOUD_HIGH} fill={c} fillOpacity=".2" /></g>
    {[[8.3, 0], [12.4, 1], [16.5, 2]].map(([x, i]) => (
      <path key={x} className={`mi-drop mi-drop-${i}`} d={`M${x} 17.3c.95 1.35 1.4 2.1 1.4 2.75a1.4 1.4 0 0 1-2.8 0c0-.65.45-1.4 1.4-2.75Z`} fill={c} stroke="none" />
    ))}
  </>,
  1: (c, id) => <>
    <defs><mask id={id}><rect width="24" height="24" fill="#fff" /><path d="M12.9 13.6 9.9 18.3h3l-1.5 3.9 4.3-5.6h-3.05l1.55-3Z" fill="#000" stroke="#000" strokeWidth="3" strokeLinejoin="round" /></mask></defs>
    <g mask={`url(#${id})`}><g className="mi-shake"><path d={CLOUD_HIGH} fill={c} fillOpacity=".3" /></g></g>
    <path className="mi-bolt" d="M12.9 13.6 9.9 18.3h3l-1.5 3.9 4.3-5.6h-3.05l1.55-3Z" fill={c} stroke={c} strokeWidth="1" strokeLinejoin="round" />
  </>,
};
// `strokeWidth` réglable : à 16 px un trait de 2 est juste, à 54 px (carte
// météo du dashboard CEO) il faut l'affiner pour que le dessin respire.
export function MeteoIcon({ score, size = 16, color = "currentColor", strokeWidth = 2 }) {
  const id = `mi-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const draw = METEO_ICONS[score];
  if (!draw) return null;
  return <svg className={`mi mi-${score}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, overflow: "visible" }} aria-hidden="true">{draw(color, id)}</svg>;
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
            style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: on ? `2px solid ${st.color}` : "1px solid #ece9e4", background: on ? st.bg : "#ffffff", color: on ? st.color : "#1c1b19", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <MeteoIcon score={n} size={size} color={on ? st.color : "#a8a39b"} />{n}
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
    <div style={{ fontSize: 11.5, color: "#8b867e", lineHeight: 1.45 }}>
      <span style={{ fontWeight: 500, color: st.color }}>{METEO_MEANING[value].txt}.</span>
      {METEO_MEANING[value].action ? ` → ${METEO_MEANING[value].action}` : ""}
    </div>
  );
}
