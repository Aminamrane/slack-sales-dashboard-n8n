import React, { useEffect, useState } from 'react';

// Canaux d'acquisition du Suivi des ventes (dev 13/10/2026) : jauge en demi-cercle dessinée en SVG et légende alignée.
// Chaque segment est un morceau du même arc (pathLength 100) : dasharray = sa part, dashoffset = son départ, ce qui
// rend l'animation d'apparition et le survol exacts sans calcul de géométrie.
const ARC = 'M 20 112 A 92 92 0 0 1 204 112';
const GAP = 1.2;              // espace entre deux segments, en % de l'arc
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export default function ChannelBreakdown({ channels, colors, partLabels = {}, activeKey = null, onSelect = null }) {
  const total = channels.reduce((sum, c) => sum + c.sales, 0);
  const signature = channels.map(c => `${c.key}:${c.sales}`).join(',');
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState(null);

  // Dessin au montage (et à chaque changement de période) : les segments partent de zéro.
  useEffect(() => {
    setDrawn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [signature]);

  const filled = channels.filter(c => c.sales > 0);
  const room = 100 - GAP * Math.max(filled.length - 1, 0);
  let cursor = 0;
  const segments = filled.map((c, i) => {
    const length = total ? (c.sales / total) * room : 0;
    const segment = { key: c.key, start: cursor, length, index: i };
    cursor += length + GAP;
    return segment;
  });

  const focus = channels.find(c => c.key === hover);
  const clickable = typeof onSelect === 'function';

  return (
    <div className="cb">
      <div className="cb-gauge">
        <svg viewBox="0 0 224 124" role="img"
          aria-label={`${total} ventes : ${channels.map(c => `${c.label} ${c.sales}`).join(', ')}`}>
          <path d={ARC} className="cb-track" pathLength="100" />
          {segments.map(s => (
            <path key={s.key} d={ARC} pathLength="100" fill="none"
              className={`cb-seg${hover && hover !== s.key ? ' is-dim' : ''}${hover === s.key ? ' is-hover' : ''}`}
              stroke={colors[s.key]}
              strokeDasharray={`${drawn ? s.length : 0} 100`}
              strokeDashoffset={-s.start}
              style={{ transition: `stroke-dasharray 950ms ${EASE} ${s.index * 80}ms, opacity 200ms ease, stroke-width 200ms ${EASE}` }}
              onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}
              onClick={clickable ? () => onSelect(s.key) : undefined} />
          ))}
          <text x="112" y="96" className="cb-total">{focus ? focus.sales : total}</text>
          <text x="112" y="116" className="cb-unit">
            {focus ? `${focus.label} · ${pct(focus.sales, total)} %` : `vente${total > 1 ? 's' : ''}`}
          </text>
        </svg>
      </div>

      <ul className="cb-legend">
        {channels.map(c => {
          const share = pct(c.sales, total);
          const parts = (c.breakdown || []).filter(p => p.sales > 0);
          const Row = clickable ? 'button' : 'div';
          return (
            <li key={c.key}>
              <Row type={clickable ? 'button' : undefined}
                className={`cb-row${c.sales === 0 ? ' is-zero' : ''}${hover === c.key ? ' is-hover' : ''}${activeKey === c.key ? ' is-active' : ''}`}
                onMouseEnter={() => setHover(c.sales > 0 ? c.key : null)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.sales > 0 ? c.key : null)} onBlur={() => setHover(null)}
                onClick={clickable ? () => onSelect(c.key) : undefined}>
                <span className="cb-dot" style={{ background: colors[c.key] }} />
                <span className="cb-label">
                  {c.label}
                  {c.sales > 0 && parts.length > 0 && (
                    <small>{parts.map((p, i) => (
                      <React.Fragment key={p.key}>
                        {i > 0 && ' · '}<span className="cb-part">{p.sales} {partLabels[p.key] || p.label}</span>
                      </React.Fragment>
                    ))}</small>
                  )}
                </span>
                <span className="cb-count">{c.sales}</span>
                <span className="cb-bar" aria-hidden="true">
                  <i style={{ width: drawn ? `${share}%` : 0, background: colors[c.key], transition: `width 950ms ${EASE}` }} />
                </span>
                <span className="cb-pct">{share} %</span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
