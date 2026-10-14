import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useRevealed } from '../motion';
import { fr } from './model';

// Présence par jour et heure (dev 14/10/2026 : « tu peux faire mieux, même le code couleur »). Un rond par créneau :
// sa surface dit combien de RDV y sont passés, sa couleur leur présence, sur une seule échelle aux couleurs Owner
// (rouille = absents, bleu clair = moitié, vert = présents). En bord de grille, la présence de chaque jour et de chaque
// heure. Présence = présents ÷ (présents + absents), la même règle que l'anneau.
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const STOPS = [[0, [194, 65, 12]], [0.5, [214, 222, 236]], [1, [44, 100, 72]]];

export function presenceColor(rate) {
  if (rate == null) return 'var(--line)';
  const t = Math.max(0, Math.min(1, rate));
  const i = t <= 0.5 ? 0 : 1;
  const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
  const k = (t - a) / (b - a);
  const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
  return `rgb(${c.join(',')})`;
}

// Couleur du texte d'une case : clair sur les teintes foncées.
function inkFor(rate) {
  return rate != null && (rate < 0.25 || rate > 0.72) ? '#fff' : 'var(--ink)';
}

export default function PresenceGrid({ cells = [], title }) {
  const on = useRevealed();
  const [hover, setHover] = useState(null);
  const grid = useMemo(() => {
    const m = new Map();
    let lo = 23, hi = 0;
    for (const c of cells) {
      const n = (c.showed || 0) + (c.noshow || 0);
      if (!n || c.dow < 1 || c.dow > 7) continue;
      m.set(`${c.dow}-${c.hour}`, { showed: c.showed, noshow: c.noshow, n });
      lo = Math.min(lo, c.hour); hi = Math.max(hi, c.hour);
    }
    if (lo > hi) { lo = 9; hi = 18; }
    const hours = [];
    for (let h = Math.max(7, lo); h <= Math.min(21, hi); h++) hours.push(h);
    const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || hours.some((h) => m.has(`${d}-${h}`)));
    const sum = (pred) => [...m.entries()].filter(([k]) => pred(k)).reduce((a, [, v]) => ({ s: a.s + v.showed, n: a.n + v.n }), { s: 0, n: 0 });
    return { m, hours, days, byDay: Object.fromEntries(days.map((d) => [d, sum((k) => k.startsWith(`${d}-`))])),
      byHour: Object.fromEntries(hours.map((h) => [h, sum((k) => k.endsWith(`-${h}`))])), all: sum(() => true) };
  }, [cells]);
  const { m, hours, days, byDay, byHour, all } = grid;
  const S = 38, G = 4, L = 42, T = 24, R = 56, B = 30;
  const W = L + hours.length * S + R, H = T + days.length * S + B;
  const rate = (v) => (v.n ? v.s / v.n : null);
  const shown = hover ? m.get(`${hover.d}-${hover.h}`) : null;
  return (
    <div className="ps2-pgrid">
      <div className="ps2-pgrid-head">
        <b>{title}</b>
        <span className="ps2-num">{all.n ? `${fr((all.s / all.n) * 100, 0)} %` : '–'} <small>de présence sur {fr(all.n)} RDV</small></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} : présence par jour et heure sur ${fr(all.n)} RDV`} onMouseLeave={() => setHover(null)}>
        {hours.map((h, j) => <text key={h} x={L + j * S + S / 2} y={T - 9} textAnchor="middle" className="ps2-axis">{h} h</text>)}
        <text x={L + hours.length * S + 12} y={T - 9} className="ps2-axis">jour</text>
        {days.map((d, i) => (
          <g key={d}>
            <text x={L - 10} y={T + i * S + S / 2 + 4} textAnchor="end" className="ps2-axis">{DAYS[d - 1]}</text>
            {hours.map((h, j) => {
              const v = m.get(`${d}-${h}`);
              const r = v ? v.showed / v.n : null;
              const x = L + j * S + G / 2, y = T + i * S + G / 2;
              return (
                <g key={h} onMouseEnter={() => setHover({ d, h })}>
                  <Motion.rect x={x} y={y} width={S - G} height={S - G} rx="8" fill={v ? presenceColor(r) : 'var(--line-2)'}
                    stroke={hover?.d === d && hover?.h === h ? 'var(--ink)' : 'none'} strokeWidth="2"
                    initial={{ opacity: 0, scale: 0.6 }} animate={on ? { opacity: 1, scale: 1 } : {}} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    transition={{ duration: 0.45, ease: EASE, delay: on ? 0.05 + (i + j) * 0.03 : 0 }} />
                  {v && <Motion.text x={x + (S - G) / 2} y={y + (S - G) / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={inkFor(r)}
                    initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0 }} transition={{ delay: on ? 0.35 + (i + j) * 0.03 : 0 }} pointerEvents="none">{Math.round(r * 100)}</Motion.text>}
                </g>
              );
            })}
            {byDay[d]?.n > 0 && <text x={L + hours.length * S + 12} y={T + i * S + S / 2 + 4} fontSize="12" fontWeight="700" fill="var(--ink)">{fr(rate(byDay[d]) * 100, 0)} %</text>}
          </g>
        ))}
        {hours.map((h, j) => byHour[h]?.n > 0 && (
          <text key={h} x={L + j * S + S / 2} y={T + days.length * S + 18} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--soft)">{fr(rate(byHour[h]) * 100, 0)}</text>
        ))}
        {shown && (
          <g pointerEvents="none" transform={`translate(${Math.min(W - 96, Math.max(96, L + hours.indexOf(hover.h) * S + S / 2))}, ${Math.max(16, T + days.indexOf(hover.d) * S - 10)})`}>
            <rect x="-92" y="-20" width="184" height="28" rx="14" fill="var(--ink)" />
            <text y="-1.5" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--card)">
              {DAYS[hover.d - 1]} {hover.h} h · {shown.showed} présents sur {shown.n}
            </text>
          </g>
        )}
      </svg>
      <div className="ps2-pgrid-legend">
        <span className="ps2-pgrid-scale"><small>0 % absents</small><i /><small>100 % présents</small></span>
        <small>chiffre dans la case = % de présence · en bas, par heure · à droite, par jour</small>
      </div>
    </div>
  );
}
