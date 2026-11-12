// Pièces propres au suivi de l'automatisation d'Opti'Lex, en plus du kit de la page Finance : barres, avancement, frise.
import { stepOf } from "../../utils/automationBoard";

// Avancement de l'automatisation, en petit : une case par étape après « non commencé ».
export function Steps({ value, steps, P, showLabel = true }) {
  const step = stepOf(steps, value);
  return (
    <div title={step.label || undefined}>
      <div style={{ display: "flex", gap: 3 }} role="img" aria-label={`Étape ${step.value} sur ${step.last} : ${step.label}`}>
        {Array.from({ length: step.last }, (_, i) => (
          <span key={i} style={{ height: 5, flex: 1, maxWidth: 34, borderRadius: 3, background: i < step.value ? P.accent : P.track }} />
        ))}
      </div>
      {showLabel && (
        <div style={{ marginTop: 5, fontSize: 11.5, color: P.faint, lineHeight: 1.35 }}>
          <span style={{ color: P.text, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{step.value}/{step.last}</span>
          {step.label ? ` · ${step.label}` : ""}
        </div>
      )}
    </div>
  );
}

// Avancement en grand, sur la page d'un process : un fil, un point par étape, l'étape en cours en point plein et en toutes
// lettres. Les étapes passées sont cochées par le trait plein qui les relie.
// `compact` : dans une carte étroite, seule l'étape en cours est écrite ; les autres se lisent au survol de leur point.
export function StepTrack({ value, steps, P, compact = false }) {
  const list = Array.isArray(steps) ? steps : [];
  const last = Math.max(1, list.length - 1);
  return (
    <ol className={`ab-track${compact ? " is-compact" : ""}`} aria-label={`Étape ${value} sur ${last}`} style={{ "--ab-done-ratio": Math.min(value, last) / last }}>
      {list.map((step, index) => {
        const state = step.value < value ? "done" : step.value === value ? "now" : "next";
        return (
          <li key={step.value} className={`is-${state}`} aria-current={state === "now" ? "step" : undefined} title={step.label} style={{ "--i": index }}>
            <span className="ab-track-dot" aria-hidden="true" />
            <span className="ab-track-label" style={{ color: state === "next" ? P.faint : P.text }}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Bar({ value, color, P, height = 5 }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ height, borderRadius: height, background: P.track, overflow: "hidden" }}>
      <div className="ab-bar" style={{ width: `${width}%`, height: "100%", borderRadius: height, background: color || P.accent, minWidth: width > 0 ? 3 : 0 }} />
    </div>
  );
}

// Taux d'utilisation : jamais au-dessus de 100 %, le logiciel le calcule sur les missions de la période.
export function Usage({ usage, P, large = false }) {
  if (!usage) {
    return <span style={{ fontSize: 12.5, color: P.faint }}>Pas dans le logiciel</span>;
  }
  const color = usage.bar >= 50 ? P.good : usage.bar > 0 ? P.warn : P.faint;
  return (
    <div title={usage.detail || undefined}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: large ? 30 : 13.5, fontWeight: 500, color: P.text, fontVariantNumeric: "tabular-nums", letterSpacing: large ? "-0.03em" : 0 }}>{usage.label}</span>
        <span style={{ fontSize: 12, color: P.faint, fontVariantNumeric: "tabular-nums" }}>{usage.short}</span>
      </div>
      <div style={{ marginTop: large ? 10 : 5 }}><Bar value={usage.bar} color={color} P={P} height={large ? 6 : 5} /></div>
    </div>
  );
}

// Une personne du fil : rond pastel à l'initiale, comme dans le fil d'échanges de la page Finance.
const FACES = [["#e2f6ea", "#0b7a4b"], ["#e4f0fd", "#1b6fd0"], ["#fbf1c2", "#7a5a05"], ["#fde9da", "#c2500e"], ["#eae9fb", "#4a3fc4"], ["#d9f3f7", "#0f7286"]];
export function Face({ name, size = 30 }) {
  const label = String(name || "?").trim() || "?";
  const [bg, fg] = FACES[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % FACES.length];
  return <span aria-hidden="true" className="fx-av" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.42) }}>{label[0].toUpperCase()}</span>;
}

export function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
