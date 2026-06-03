import React from 'react';

/**
 * Date range picker — preset chips (day / 7d / 30d / month / 12mo / custom)
 * + two date inputs when "custom" is active. Controlled by parent state.
 *
 * Refs visual cue : pill-style toggles, hairline border, dark/light aware.
 */
export default function DateRangePicker({ preset, customFrom, customTo, onChange, C }) {
  // Presets restreints à la fenêtre d'analyse d'un webinaire post-événement.
  // On retire `12mo` (pas pertinent : il y a 12 mois le webinaire n'existait
  // pas). Le preset par défaut "Webinaire complet" couvre toute la période
  // d'activité (ouverture inscriptions → aujourd'hui).
  const PRESETS = [
    { key: 'all', label: 'Webinaire complet' },
    { key: 'day', label: 'Jour' },
    { key: '7d', label: '7 jours' },
    { key: '30d', label: '30 jours' },
    { key: 'month', label: 'Ce mois' },
    { key: 'custom', label: 'Personnalisé' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: C.subtle,
        borderRadius: 12,
        border: `1px solid ${C.hairline}`,
      }}>
        {PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ preset: p.key, customFrom, customTo })}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: active ? C.surface : 'transparent',
                color: active ? C.text : C.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? C.shadow : 'none',
                transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {preset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => onChange({ preset, customFrom: e.target.value, customTo })}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <span style={{ color: C.faded, fontSize: 12 }}>→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => onChange({ preset, customFrom, customTo: e.target.value })}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
