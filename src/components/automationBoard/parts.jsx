// Pièces communes au tableau et à la fiche d'un process (suivi de l'automatisation d'Opti'Lex).
import { classificationOf, stepOf } from "../../utils/automationBoard";
import { tone } from "./theme";

export function Pill({ classification, classifications, dark, long = false }) {
  const t = tone(classification, dark);
  const item = classificationOf(classifications, classification);
  return (
    <span title={item.help || undefined} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999,
      background: t.bg, color: t.fg, fontSize: 12, fontWeight: 600, lineHeight: 1.35, whiteSpace: long ? "normal" : "nowrap",
    }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: t.fg, flexShrink: 0 }} />
      {long ? item.label : item.shortLabel}
    </span>
  );
}

// Avancement de l'automatisation : une case par étape après « non commencé ».
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
          <span style={{ color: P.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{step.value}/{step.last}</span>
          {step.label ? ` · ${step.label}` : ""}
        </div>
      )}
    </div>
  );
}

export function Bar({ value, color, P, height = 5 }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ height, borderRadius: height, background: P.track, overflow: "hidden" }}>
      <div style={{ width: `${width}%`, height: "100%", borderRadius: height, background: color || P.accent, minWidth: width > 0 ? 3 : 0 }} />
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
        <span style={{ fontSize: large ? 26 : 14, fontWeight: 650, color: P.text, fontVariantNumeric: "tabular-nums", letterSpacing: large ? "-0.02em" : 0 }}>{usage.label}</span>
        <span style={{ fontSize: 12, color: P.faint, fontVariantNumeric: "tabular-nums" }}>{usage.short}</span>
      </div>
      <div style={{ marginTop: large ? 8 : 5 }}><Bar value={usage.bar} color={color} P={P} height={large ? 6 : 5} /></div>
    </div>
  );
}

export function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
