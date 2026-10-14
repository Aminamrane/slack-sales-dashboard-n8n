import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr, initials } from './model';

// Chaque sales, semaine par semaine (dev 14/10/2026 : « les performances sales de semaine 1, semaine 2, semaine 3…, vues
// d'une manière différente, pour vraiment faire dashboard ») : une bulle par semaine, sa surface proportionnelle au volume
// de l'indicateur choisi ; la colonne de droite fait le total du mois. Les bulles changent de taille quand on change
// d'indicateur ; une semaine à venir reste un point vide. Chaque bulle s'ouvre sur la semaine de ce sales.
const METRICS = [['sales', 'Ventes', '#2c6448'], ['r2e', 'R2 effectués', '#1e3a7b'], ['r1e', 'R1 effectués', '#5d79c2'], ['leads', 'Leads', '#8b95a7']];
const R = 17;

export default function WeeksBoard({ people, weeks, avatarFor }) {
  const on = useRevealed();
  const [metric, setMetric] = useState('sales');
  const [hover, setHover] = useState(null);
  if (!people?.length || !weeks?.length) return null;
  const color = METRICS.find((m) => m[0] === metric)[2];
  const max = Math.max(1, ...people.flatMap((p) => p.weeks.map((c) => c?.[metric] || 0)));
  const maxTotal = Math.max(1, ...people.map((p) => p.total[metric] || 0));
  const radius = (v) => (v ? 4 + (R - 4) * Math.sqrt(v / max) : 0);
  const colTotals = weeks.map((w, i) => (w.state === 'future' ? null : people.reduce((a, p) => a + (p.weeks[i]?.[metric] || 0), 0)));
  return (
    <div className="ps2-weeksboard">
      <div className="ps2-card-head">
        <h2>Semaine par semaine</h2>
        <div className="ps2-segment" role="group" aria-label="Indicateur">
          {METRICS.map(([k, l]) => <button type="button" key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}>{l}</button>)}
        </div>
      </div>
      <div className="ps2-wb" style={{ '--cols': weeks.length }} role="table" aria-label={`${METRICS.find((m) => m[0] === metric)[1]} par sales et par semaine`}>
        <div className="ps2-wb-row is-head" role="row">
          <span role="columnheader" />
          {weeks.map((w, i) => (
            <span key={w.start} role="columnheader" className={`ps2-wb-week${w.state === 'current' ? ' is-current' : ''}${hover?.col === i ? ' is-hover' : ''}`}>
              <b>S{i + 1}</b><small>{dm(w.start)}</small>
            </span>
          ))}
          <span role="columnheader" className="ps2-wb-week"><b>Mois</b></span>
        </div>
        {people.map((p, r) => (
          <Motion.div key={p.name} role="row" className={`ps2-wb-row${hover?.row === r ? ' is-hover' : ''}`}
            initial={{ opacity: 0, x: -10 }} animate={on ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.45, ease: EASE, delay: 0.1 + r * 0.035 }}>
            <span role="rowheader" className="ps2-wb-name">
              <Face name={p.name} url={avatarFor?.(p.name)} />
              <span>{p.name}</span>
            </span>
            {weeks.map((w, i) => {
              const cell = p.weeks[i];
              const v = cell?.[metric] || 0;
              if (!cell) return <span key={w.start} role="cell" className="ps2-wb-cell is-future"><i /></span>;
              return (
                <span key={w.start} role="cell" className="ps2-wb-cell" onMouseEnter={() => setHover({ row: r, col: i })} onMouseLeave={() => setHover(null)}>
                  <Info className="ps2-wb-hit" label={`${p.name}, semaine ${i + 1} : ${v}`}
                    detail={<Detail kicker={`${p.name} · semaine ${i + 1}`} title={`${dm(w.start)} → ${dm(w.end)}`}
                      rows={METRICS.map(([k, l]) => [l, fr(cell[k]), k === metric ? 'ps2-strong' : ''])} />}>
                    <svg viewBox={`0 0 ${R * 2 + 4} ${R * 2 + 4}`} width={R * 2 + 4} height={R * 2 + 4} aria-hidden="true">
                      {v === 0 && <circle cx={R + 2} cy={R + 2} r="2.5" fill="var(--line)" />}
                      <Motion.circle cx={R + 2} cy={R + 2} fill={color} initial={{ r: 0 }} animate={{ r: on ? radius(v) : 0, fill: color }}
                        transition={{ duration: 0.7, ease: EASE, delay: on ? 0.15 + r * 0.03 + i * 0.06 : 0 }} style={{ opacity: 0.9 }} />
                      {v > 0 && <Motion.text x={R + 2} y={R + 6} textAnchor="middle" fontSize="11.5" fontWeight="700"
                        fill={radius(v) > 9 ? '#fff' : 'var(--ink)'} initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0 }}
                        transition={{ duration: 0.3, delay: 0.5 + r * 0.03 + i * 0.06 }}>{v}</Motion.text>}
                    </svg>
                  </Info>
                </span>
              );
            })}
            <span role="cell" className="ps2-wb-total">
              <span className="ps2-wb-bar"><Motion.i initial={{ width: 0 }} animate={{ width: on ? `${((p.total[metric] || 0) / maxTotal) * 100}%` : 0, background: color }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.3 + r * 0.03 }} /></span>
              <b className="ps2-num">{fr(p.total[metric])}</b>
            </span>
          </Motion.div>
        ))}
        <div className="ps2-wb-row is-foot" role="row">
          <span role="rowheader">Équipe</span>
          {colTotals.map((v, i) => <span key={weeks[i].start} role="cell" className="ps2-num">{v == null ? '' : fr(v)}</span>)}
          <span role="cell" className="ps2-num" style={{ textAlign: 'right' }}>{fr(colTotals.reduce((a, v) => a + (v || 0), 0))}</span>
        </div>
      </div>
    </div>
  );
}

function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: '0 0 26px', width: 26, height: 26, fontSize: 10, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

