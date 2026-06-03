import React from 'react';
import Card from './Card';
import { scoreVerdict } from '../theme';

/**
 * Semi-circular SVG gauge — adapted from ref image 4 ("Customer
 * Satisfaction Score 75/100"). Draws a 180° arc made of 36 ticks,
 * each lighting up as the score progresses (0-100). Uses pure SVG +
 * stroke-dasharray for the active segment.
 *
 * Maps the global open rate to a 0-100 score (it's already a
 * percentage). Caption derives from `scoreVerdict()`.
 */
export default function SatisfactionGauge({ score, label = 'Taux d\'ouverture global', C }) {
  // Normalize input — accept null (loading or no data)
  const value = score === null || score === undefined ? null : Math.max(0, Math.min(100, score));
  const verdict = scoreVerdict(value);
  const verdictColor = verdict.tone === 'emerald' ? C.emerald.fg
    : verdict.tone === 'amber' ? C.amber.fg
    : verdict.tone === 'rose' ? C.rose.fg
    : C.muted;

  // Geometry — 36 ticks across a 180° arc
  const TICKS = 36;
  const CENTER_X = 150;
  const CENTER_Y = 130;
  const RADIUS_INNER = 78;
  const RADIUS_OUTER = 108;

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    // Map i to angle 180° → 360° (left-to-right semi-arc, top-half)
    const angle = Math.PI + (i / (TICKS - 1)) * Math.PI;
    const x1 = CENTER_X + Math.cos(angle) * RADIUS_INNER;
    const y1 = CENTER_Y + Math.sin(angle) * RADIUS_INNER;
    const x2 = CENTER_X + Math.cos(angle) * RADIUS_OUTER;
    const y2 = CENTER_Y + Math.sin(angle) * RADIUS_OUTER;
    const ratio = i / (TICKS - 1); // 0 → 1
    const active = value !== null && ratio * 100 <= value;
    return { x1, y1, x2, y2, active, ratio };
  });

  return (
    <Card title="Satisfaction email" subtitle="Taux d'ouverture toute campagne confondue" C={C}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0 4px',
      }}>
        <svg width="300" height="180" viewBox="0 0 300 180" style={{ maxWidth: '100%' }}>
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.active ? C.accent : C.hairline}
              strokeWidth={3.5}
              strokeLinecap="round"
              style={{
                transition: 'stroke 0.4s cubic-bezier(0.4,0,0.2,1)',
                transitionDelay: `${i * 0.012}s`,
                opacity: t.active ? Math.max(0.5, 0.5 + t.ratio * 0.5) : 1,
              }}
            />
          ))}

          {/* Center reading */}
          {value !== null ? (
            <>
              <text
                x={CENTER_X}
                y={CENTER_Y + 14}
                textAnchor="middle"
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  fill: C.text,
                  fontFamily: 'inherit',
                  letterSpacing: '-0.04em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(value)}
              </text>
              <text
                x={CENTER_X + 38}
                y={CENTER_Y + 14}
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  fill: C.muted,
                  fontFamily: 'inherit',
                }}
              >
                / 100
              </text>
            </>
          ) : (
            <text
              x={CENTER_X}
              y={CENTER_Y + 8}
              textAnchor="middle"
              style={{
                fontSize: 14,
                fontWeight: 600,
                fill: C.muted,
                fontFamily: 'inherit',
              }}
            >
              Données indisponibles
            </text>
          )}

          {/* End labels */}
          <text
            x={CENTER_X - RADIUS_OUTER - 8}
            y={CENTER_Y + 14}
            textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 600, fill: C.faded, fontFamily: 'inherit' }}
          >
            0
          </text>
          <text
            x={CENTER_X + RADIUS_OUTER + 8}
            y={CENTER_Y + 14}
            textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 600, fill: C.faded, fontFamily: 'inherit' }}
          >
            100
          </text>
        </svg>

        <div style={{
          marginTop: 16,
          paddingTop: 16,
          width: '100%',
          borderTop: `1px solid ${C.hairline}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Soft orb (decorative, ref image 4) */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${C.accent}, ${C.violet.strong})`,
            opacity: 0.85,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${C.accent}55`,
          }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: verdictColor, letterSpacing: '-0.01em' }}>
              {verdict.label}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: C.muted, fontWeight: 500 }}>
              {label} sur la fenêtre courante.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
