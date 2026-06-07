import React, { useMemo, useState } from 'react';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Heatmap jour × heure du taux de présence (show-up) aux RDV.
// Props :
//   cells : [{ dow: 1-7 (ISO, 1=Lun), hour: 0-23, showed, noshow }]
//   C     : thème MonitoringPerf (bg/border/text/muted/subtle/shadow)
// Couleur = taux de présence (rouge faible → vert élevé). Cases à faible
// volume (<3 RDV) atténuées (peu fiables). Case vide = neutre.
export default function RdvHeatmap({ cells = [], C, title, subtitle }) {
  const { matrix, hours, totalShow, totalNoshow } = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(null));
    let minH = 23, maxH = 8, tShow = 0, tNs = 0;
    for (const c of cells) {
      const d = c.dow - 1; // 1=Lun → 0
      if (d < 0 || d > 6) continue;
      m[d][c.hour] = { showed: c.showed, noshow: c.noshow };
      tShow += c.showed; tNs += c.noshow;
      if (c.showed + c.noshow > 0) {
        if (c.hour < minH) minH = c.hour;
        if (c.hour > maxH) maxH = c.hour;
      }
    }
    if (minH > maxH) { minH = 9; maxH = 18; }
    minH = Math.max(7, minH); maxH = Math.min(21, maxH);
    const hrs = [];
    for (let h = minH; h <= maxH; h++) hrs.push(h);
    return { matrix: m, hours: hrs, totalShow: tShow, totalNoshow: tNs };
  }, [cells]);

  const [hover, setHover] = useState(null);

  const colorFor = (cell) => {
    if (!cell) return { bg: C.subtle, empty: true };
    const tot = cell.showed + cell.noshow;
    if (tot === 0) return { bg: C.subtle, empty: true };
    const rate = cell.showed / tot;
    let bg;
    if (rate < 0.45) bg = '#ef4444';
    else if (rate < 0.60) bg = '#fb923c';
    else if (rate < 0.78) bg = '#fbbf24';
    else bg = '#10b981';
    return { bg, empty: false, faint: tot < 3 };
  };

  const denom = totalShow + totalNoshow;
  const globalRate = denom > 0 ? Math.round((totalShow / denom) * 100) : 0;

  return (
    <div style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 18px', boxShadow: C.shadow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, maxWidth: 360 }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
          Présence globale <b style={{ color: C.text }}>{globalRate}%</b>
        </div>
      </div>

      {denom === 0 ? (
        <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Aucun RDV sur la période.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 520, position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(${hours.length}, 1fr)`, gap: 5, alignItems: 'center' }}>
              <div />
              {hours.map((h) => (
                <div key={'h' + h} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 600, color: C.muted }}>{h}h</div>
              ))}
              {DAY_LABELS.map((label, dayIdx) => (
                <React.Fragment key={label}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{label}</div>
                  {hours.map((h) => {
                    const cell = matrix[dayIdx][h];
                    const col = colorFor(cell);
                    return (
                      <div
                        key={dayIdx + '-' + h}
                        onMouseEnter={(e) => setHover({ dayIdx, hour: h, cell, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2, y: e.currentTarget.offsetTop })}
                        onMouseLeave={() => setHover(null)}
                        onMouseMove={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        style={{ height: 26, background: col.bg, borderRadius: 6, border: col.empty ? '1px solid ' + C.border : 'none', opacity: col.faint ? 0.45 : 1, cursor: 'default', transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1)' }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {hover && hover.cell && (hover.cell.showed + hover.cell.noshow) > 0 && (
              <div style={{ position: 'absolute', left: hover.x, top: hover.y - 10, transform: 'translate(-50%, -100%)', background: C.bg, color: C.text, padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, boxShadow: C.shadow, border: '1px solid ' + C.border, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5 }}>
                {DAY_LABELS[hover.dayIdx]} {hover.hour}h · {hover.cell.showed} présents / {hover.cell.noshow} no-show ({Math.round((hover.cell.showed / (hover.cell.showed + hover.cell.noshow)) * 100)}%)
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 10.5, color: C.muted, fontWeight: 500, flexWrap: 'wrap' }}>
            <span style={{ marginRight: 'auto', fontStyle: 'italic' }}>Cases pâles = &lt;3 RDV (peu fiable)</span>
            <span>No-show</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['#ef4444', '#fb923c', '#fbbf24', '#10b981'].map((bg, i) => (
                <div key={i} style={{ width: 13, height: 13, background: bg, borderRadius: 3 }} />
              ))}
            </div>
            <span>Présence</span>
          </div>
        </div>
      )}
    </div>
  );
}
