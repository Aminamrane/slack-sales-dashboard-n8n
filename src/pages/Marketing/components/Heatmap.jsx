import React, { useMemo, useState } from 'react';
import Card from './Card';
import { fmtInt } from '../theme';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Multi-step green heatmap inspired by ref image 2 ("Customer by Time").
 * Grid : day-of-week × hour-of-day. Each cell is a rounded square
 * coloured by intensity (5 buckets : 0 / low / med / high / max).
 *
 * Buckets are computed front-side from the leads list (we have
 * createdAt strings for every lead in the window). This keeps the
 * backend payload lean — no need for a dedicated heatmap endpoint.
 */
export default function Heatmap({ leads = [], C }) {
  // Compute counts[dayIdx][hour] from leads' Paris-local createdAt
  const { matrix, max } = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const lead of leads) {
      if (!lead?.createdAt) continue;
      const d = new Date(lead.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      // Convert to Paris time-of-week via toLocaleString trick
      const parisDay = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const dayIdx = (parisDay.getDay() + 6) % 7; // shift Sun=0 → Mon=0
      const hour = parisDay.getHours();
      m[dayIdx][hour] += 1;
    }
    let mx = 0;
    for (let i = 0; i < 7; i++) for (let h = 0; h < 24; h++) if (m[i][h] > mx) mx = m[i][h];
    return { matrix: m, max: mx };
  }, [leads]);

  const [hover, setHover] = useState(null);

  // Determine which hours to display (compact mode — only show 8h → 22h
  // since outside this range it's almost always empty).
  const HOURS_MIN = 7;
  const HOURS_MAX = 22;
  const hours = [];
  for (let h = HOURS_MIN; h <= HOURS_MAX; h++) hours.push(h);

  const bucket = (n) => {
    if (n === 0 || max === 0) return 0;
    const ratio = n / max;
    if (ratio < 0.2) return 1;
    if (ratio < 0.45) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };
  const BG = [
    C.subtle,
    C.emerald.bg,
    C.emerald.strong + '55',
    C.emerald.strong + '99',
    C.emerald.fg,
  ];

  return (
    <Card
      title="Heatmap inscriptions"
      subtitle="Jour × heure (Europe/Paris) sur la fenêtre courante"
      C={C}
    >
      {max === 0 ? (
        <p style={{ margin: 0, color: C.muted, fontSize: 13, fontWeight: 500 }}>
          Aucune inscription sur la fenêtre courante.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720, position: 'relative' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `46px repeat(${hours.length}, 1fr)`,
              gap: 6,
              alignItems: 'center',
            }}>
              {/* Header row : empty corner + hour labels */}
              <div />
              {hours.map((h) => (
                <div key={`h-${h}`} style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.faded,
                  letterSpacing: '0.04em',
                }}>
                  {h}h
                </div>
              ))}

              {DAY_LABELS.map((label, dayIdx) => (
                <React.Fragment key={label}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {label}
                  </div>
                  {hours.map((h) => {
                    const count = matrix[dayIdx][h];
                    const b = bucket(count);
                    return (
                      <div
                        key={`${dayIdx}-${h}`}
                        onMouseEnter={(e) => setHover({
                          dayIdx, hour: h, count,
                          x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2,
                          y: e.currentTarget.offsetTop,
                        })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          height: 28,
                          background: BG[b],
                          borderRadius: 7,
                          cursor: 'default',
                          transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1)',
                          border: count > 0 ? 'none' : `1px solid ${C.hairline}`,
                        }}
                        onMouseMove={(e) => {
                          // hover scale for delight
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {hover && (
              <div style={{
                position: 'absolute',
                left: hover.x,
                top: hover.y - 12,
                transform: 'translate(-50%, -100%)',
                background: C.surface,
                color: C.text,
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                boxShadow: C.shadowFloat,
                border: `1px solid ${C.hairline}`,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                animation: 'mktNumberTick 0.15s ease-out both',
              }}>
                {DAY_LABELS[hover.dayIdx]} {hover.hour}h ·{' '}
                <span style={{ color: hover.count > 0 ? C.emerald.fg : C.muted, fontWeight: 700 }}>
                  {fmtInt(hover.count)} inscription{hover.count > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            fontSize: 11,
            color: C.muted,
            fontWeight: 500,
          }}>
            <span>Moins</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {BG.map((bg, i) => (
                <div key={i} style={{
                  width: 14,
                  height: 14,
                  background: bg,
                  borderRadius: 4,
                  border: i === 0 ? `1px solid ${C.hairline}` : 'none',
                }} />
              ))}
            </div>
            <span>Plus</span>
            <span style={{ marginLeft: 6, color: C.faded }}>
              Pic : {fmtInt(max)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
