import React from 'react';

/**
 * Source filter (all / landing / meta / broad) — controls leads list.
 * Compact pill group, dark/light aware, brand-coloured active pill.
 */
export default function SourceFilter({ value, onChange, C }) {
  const SOURCES = [
    { key: 'all', label: 'Toutes', color: C.muted },
    { key: 'landing', label: 'Landing', color: C.blue.fg },
    { key: 'meta', label: 'Meta', color: C.fuchsia.fg },
    { key: 'broad', label: 'Broad', color: C.amber.fg },
  ];

  return (
    <div style={{
      display: 'inline-flex',
      gap: 4,
      padding: 4,
      background: C.subtle,
      borderRadius: 12,
      border: `1px solid ${C.hairline}`,
    }}>
      {SOURCES.map((s) => {
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: active ? C.surface : 'transparent',
              color: active ? s.color : C.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? C.shadow : 'none',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
