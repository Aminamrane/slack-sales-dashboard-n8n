import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE_CSS, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr } from './model';

// Ventes cumulées et simulateur de fin de mois (dev 14/10/2026 : « un outil avec lequel ils peuvent faire des projections
// eux-mêmes, si le volume de leads augmente avec le taux de transfo actuel ; flexible ; le design doit expliquer par
// lui-même » puis « plus grand ; l'objectif, mathématiquement ce que ça donne si on continue sur cette cadence, et l'avis
// de Jev »). Trois lignes nommées à leur extrémité : l'objectif, la cadence actuelle (qui devient la simulation dès qu'on
// touche un curseur, l'ancienne cadence restant en filigrane) et Jev.
// Ventes par jour = leads par jour × R1 effectués par lead × R2 effectués par R1 × ventes par R2 effectué. Les curseurs
// partent des taux réels du mois ; à ces valeurs, la simulation retombe exactement sur la cadence du mois.
// Taux de transfo (dev 14/10/2026 : « pouvoir jouer au taux de transfo, car le problème ce n'est pas toujours le volume
// de leads ») : ventes par lead = produit des trois étapes. Le bouger répartit le changement sur les trois étapes, à
// proportions égales (racine cubique), chacune dans ses bornes ; bouger une étape le met à jour.
const PCT = { mult: 100, decimals: 0, suffix: '%' };
const LEVERS = [
  { key: 'leads', label: 'Leads', min: 5, max: 120, step: 1 },
  { key: 'r1', label: 'R1 effectués / lead', min: 0.05, max: 0.7, step: 0.005, ...PCT },
  { key: 'r2', label: 'R2 effectués / R1', min: 0.1, max: 1.2, step: 0.01, ...PCT },
  { key: 'close', label: 'Ventes / R2', min: 0.05, max: 0.9, step: 0.01, ...PCT },
];
const TRANSFO = { key: 'transfo', label: 'Taux de transfo · ventes / lead', min: 0.01, max: 0.3, step: 0.001, mult: 100, decimals: 1, suffix: '%' };
const SPRING = { type: 'spring', stiffness: 170, damping: 24 };
const clampTo = (l, v) => Math.min(l.max, Math.max(l.min, v));

// Valeur affichée d'un curseur, modifiable au clavier (Entrée ou sortie du champ pour valider).
function Value({ value, mult, decimals, suffix, onCommit, label }) {
  const shown = fr(value * mult, decimals);
  const [draft, setDraft] = useState(null);
  const commit = () => {
    const n = Number(String(draft).replace(/\s/g, '').replace(',', '.'));
    if (draft != null && Number.isFinite(n) && n > 0) onCommit(n / mult);
    setDraft(null);
  };
  return (
    <span className="ps2-lever-value">
      <input aria-label={label} inputMode="decimal" value={draft ?? shown} onFocus={(e) => { setDraft(shown); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); } }}
        style={{ width: `${Math.max(2, String(draft ?? shown).length) + 0.6}ch` }} />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

function Lever({ lever, value, base, goal, onChange, unit, onUnit, days }) {
  const mult = lever.key === 'leads' ? (unit === 'month' ? days : 1) : lever.mult;
  const pos = (v) => ((Math.min(lever.max, Math.max(lever.min, v)) - lever.min) / (lever.max - lever.min)) * 100;
  const changed = Math.abs(value - base) > lever.step / 2;
  const goalIn = goal != null && goal >= lever.min && goal <= lever.max;
  const fmt = (v) => `${fr(v * mult, lever.decimals ?? 0)}${lever.suffix ? ` ${lever.suffix}` : ''}`;
  return (
    <div className={`ps2-lever${changed ? ' is-changed' : ''}`}>
      <span className="ps2-lever-head">
        <span>{lever.label}{lever.key === 'leads' && (
          <span className="ps2-unit" role="group" aria-label="Unité">
            {[['day', '/ jour'], ['month', '/ mois']].map(([k, l]) => <button type="button" key={k} aria-pressed={unit === k} onClick={() => onUnit(k)}>{l}</button>)}
          </span>
        )}</span>
        <Value value={value} mult={mult} decimals={lever.decimals ?? 0} suffix={lever.suffix} onCommit={onChange} label={lever.label} />
      </span>
      <span className="ps2-lever-track" style={{ '--p': `${pos(value)}%`, '--b': `${pos(base)}%` }}>
        <span className="ps2-lever-fill" />
        <span className="ps2-lever-base" title={`Cadence actuelle : ${fmt(base)}`} />
        {goalIn && <Motion.span className="ps2-lever-goal" initial={false} animate={{ left: `${pos(goal)}%` }} transition={SPRING}
          title={`Pour l’objectif : ${fmt(goal)}`}><i /></Motion.span>}
        <input type="range" min={lever.min} max={lever.max} step={lever.step} value={Math.min(lever.max, Math.max(lever.min, value))} aria-label={lever.label}
          aria-valuetext={fmt(value)} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </div>
  );
}

// Étiquettes de fin de ligne, écartées pour ne jamais se chevaucher et gardées dans le graphe.
function spread(items, gap, lo, hi) {
  const out = [...items].sort((p, q) => p.y - q.y).map((it) => ({ ...it, ly: it.y }));
  for (let i = 1; i < out.length; i++) out[i].ly = Math.max(out[i].y, out[i - 1].ly + gap);
  const over = out.length ? out[out.length - 1].ly - hi : 0;
  if (over > 0) out.forEach((it) => { it.ly -= over; });
  for (let i = out.length - 2; i >= 0; i--) out[i].ly = Math.min(out[i].ly, out[i + 1].ly - gap);
  out.forEach((it) => { it.ly = Math.max(lo, it.ly); });
  return out;
}

// Hauteur du tracé (dev 15/10/2026 : « il pourrait prendre plus de place en gardant les proportions, il y a beaucoup
// d'espace blanc en bas ») : la largeur reste à 960 unités (mêmes textes, mêmes traits), la hauteur suit la place que
// laisse le simulateur à droite ; jamais moins que l'ancien format 960 × 322.
const PLOT_W = 960, PLOT_MIN_H = 322, PLOT_MAX_H = 620;   // au-delà, le tracé reste calé en haut
// La largeur du bloc vient TOUJOURS de sa colonne ; seule sa hauteur s'étire. La hauteur minimale (format 960 × 322)
// est posée en pixels depuis la largeur mesurée : pas d'aspect-ratio CSS, qui laisse certains navigateurs (Safari)
// recalculer la largeur à partir de la hauteur étirée et faire déborder le graphique sur le simulateur.
function usePlotHeight() {
  const ref = useRef(null);
  const [size, setSize] = useState({ units: PLOT_MIN_H, minPx: null });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      if (width <= 0) return;
      const units = Math.min(PLOT_MAX_H, Math.max(PLOT_MIN_H, Math.round((PLOT_W * h) / width)));
      const minPx = Math.round((width * PLOT_MIN_H) / PLOT_W);
      setSize((prev) => (prev.units === units && prev.minPx === minPx ? prev : { units, minPx }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size.units, size.minPx];
}

export default function Studio({ model }) {
  const drawn = useDrawn();
  const pilot = model.pilot;
  const days = pilot?.days;
  const elapsed = Math.max(1, days?.elapsed || 1);
  const v = model.value;
  const base = useMemo(() => ({
    leads: Math.max(1, v.leads / elapsed),
    r1: v.leads ? v.r1e / v.leads : 0.3,
    r2: v.r1e ? v.r2e / v.r1e : 0.7,
    close: v.r2e ? v.sales / v.r2e : 0.4,
  }), [v.leads, v.r1e, v.r2e, v.sales, elapsed]);
  const [edited, setEdited] = useState(null);
  const [unit, setUnit] = useState('day');
  const [hoverDay, setHoverDay] = useState(null);
  // Les étiquettes n'apparaissent avec retard qu'au premier dessin ; ensuite elles suivent les curseurs sans délai.
  const [settled, setSettled] = useState(false);
  const [plotRef, plotH, plotMinPx] = usePlotHeight();
  useEffect(() => {
    if (!drawn || settled) return undefined;
    const t = setTimeout(() => setSettled(true), 2000);
    return () => clearTimeout(t);
  }, [drawn, settled]);
  if (!pilot?.series?.length || !days) return null;

  const lv = edited || base;
  const N = days.total, remaining = days.remaining, obj = pilot.objective || 0;
  const sold = v.sales;
  const rate = lv.leads * lv.r1 * lv.r2 * lv.close;
  const cadenceRate = base.leads * base.r1 * base.r2 * base.close;
  const projected = Math.round(sold + remaining * rate);
  const cadence = Math.round(sold + remaining * cadenceRate);
  const simulating = !!edited && projected !== cadence;
  const gap = obj ? projected - obj : null;
  const reached = gap != null && gap >= 0;
  const neededRate = remaining && obj ? Math.max(0, (obj - sold) / remaining) : null;
  const goalFor = (key) => {
    if (neededRate == null) return null;
    const others = LEVERS.filter((l) => l.key !== key).reduce((a, l) => a * lv[l.key], 1);
    return others ? neededRate / others : null;
  };
  const jev = pilot.jev;
  const jevValue = jev?.final_sales?.expected;
  const open = remaining > 0;

  const top = Math.max(obj, projected, cadence, jevValue || 0, sold) * 1.12 || 10;
  const X0 = 44, X1 = 760, Y0 = plotH - 32, Y1 = 16;
  const x = (i) => X0 + (i * (X1 - X0)) / Math.max(1, N - 1);
  const y = (val) => Y0 - (Math.max(0, Math.min(val, top)) / top) * (Y0 - Y1);
  const pts = pilot.series.map((p, i) => [x(i), y(p.sales)]);
  const li = pts.length - 1;
  const [lx, ly] = pts[li];
  const line = pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  let before = 0;
  const ticks = (pilot.weeks || []).map((w) => { const t = { label: dm(w.start), i: w.business_days ? before : null }; before += w.business_days; return t; });
  const tone = gap == null ? 'var(--navy)' : reached ? 'var(--good-strong)' : 'var(--low-strong)';
  const set = (k) => (val) => setEdited({ ...lv, [k]: val });
  const transfo = lv.r1 * lv.r2 * lv.close;
  const baseTransfo = base.r1 * base.r2 * base.close;
  const setTransfo = (t) => {
    const [l1, l2, l3] = LEVERS.slice(1);
    const k = Math.cbrt(t / Math.max(1e-6, transfo));
    const r1 = clampTo(l1, lv.r1 * k), r2 = clampTo(l2, lv.r2 * k);
    setEdited({ ...lv, r1, r2, close: clampTo(l3, t / (r1 * r2)) });
  };
  const hovered = hoverDay != null ? pilot.series[hoverDay] : null;
  const labels = spread([
    obj > 0 && { key: 'objective', y: y(obj), value: obj, label: 'Objectif', color: 'var(--ink)', solid: true },
    open && { key: 'cadence', y: y(simulating ? projected : cadence), value: simulating ? projected : cadence, label: simulating ? 'Simulation' : 'Cadence actuelle', color: tone },
    open && simulating && { key: 'cadence-ghost', y: y(cadence), value: cadence, label: 'Cadence actuelle', color: 'var(--muted)' },
    open && jevValue != null && { key: 'jev', y: y(jevValue), value: jevValue, label: 'Jev', color: '#b7860b' },
  ].filter(Boolean), 30, Y1, Y0 - 6);

  return (
    <div className="ps2-studio">
      <div className="ps2-studio-chart">
        <div className="ps2-studio-plot" ref={plotRef} style={plotMinPx ? { minHeight: plotMinPx } : undefined}>
        <svg viewBox={`0 0 ${PLOT_W} ${plotH}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`Ventes cumulées : ${sold} au ${dm(pilot.series[li].date)} ; cadence actuelle ${cadence}${jevValue != null ? `, Jev ${jevValue}` : ''}${obj ? `, objectif ${obj}` : ''}`}
          onMouseLeave={() => setHoverDay(null)}>
          <defs>
            <linearGradient id="ps2-studio-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--navy)" stopOpacity="0.16" /><stop offset="1" stopColor="var(--navy)" stopOpacity="0" /></linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const val = Math.round((top / 1.12) * f);
            return <g key={f}><line x1={X0} x2={X1} y1={y(val)} y2={y(val)} stroke={f ? 'var(--line-2)' : 'var(--line)'} /><text x={X0 - 10} y={y(val) + 4} textAnchor="end" className="ps2-axis">{val}</text></g>;
          })}
          {ticks.map((t) => t.i != null && <text key={t.label} x={x(t.i)} y={Y0 + 22} textAnchor="middle" className="ps2-axis">{t.label}</text>)}
          <text x={X1} y={Y0 + 22} textAnchor="end" className="ps2-axis">{dm(pilot.period_end)}</text>
          {open && <rect x={lx} y={Y1} width={X1 - lx} height={Y0 - Y1} fill="var(--bg)" />}
          {obj > 0 && <line x1={x(0)} y1={y(obj / N)} x2={X1} y2={y(obj)} stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="6 6" strokeLinecap="round" />}
          <polygon points={`${X0},${Y0} ${line} ${lx},${Y0}`} fill="url(#ps2-studio-area)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 900ms ease 500ms' }} />
          <polyline points={line} fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
            pathLength="1" strokeDasharray="1" style={{ strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset 1300ms ${EASE_CSS} 150ms` }} />
          {open && jevValue != null && <line x1={lx} y1={ly} x2={X1} y2={y(jevValue)} stroke="#d4a017" strokeWidth="2.4" strokeDasharray="2 6" strokeLinecap="round"
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity .6s ease 1.4s' }} />}
          {open && simulating && <line x1={lx} y1={ly} x2={X1} y2={y(cadence)} stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 5" />}
          {open && drawn && <>
            <Motion.line x1={lx} y1={ly} x2={X1} initial={{ y2: ly }} animate={{ y2: y(projected) }} transition={SPRING} stroke={tone} strokeWidth="3" strokeLinecap="round" />
            <Motion.circle cx={X1} r="6" initial={{ cy: ly }} animate={{ cy: y(projected) }} transition={SPRING} fill="var(--card)" stroke={tone} strokeWidth="3" />
          </>}
          {pilot.series.map((p, i) => <rect key={p.date} x={x(i) - (X1 - X0) / (2 * Math.max(1, N - 1))} y={Y1} width={(X1 - X0) / Math.max(1, N - 1)} height={Y0 - Y1}
            fill="transparent" onMouseEnter={() => setHoverDay(i)} />)}
          {hovered && <g pointerEvents="none">
            <line x1={pts[hoverDay][0]} x2={pts[hoverDay][0]} y1={Y1} y2={Y0} stroke="var(--ink)" strokeOpacity="0.12" />
            <circle cx={pts[hoverDay][0]} cy={pts[hoverDay][1]} r="5" fill="var(--navy)" />
            <g transform={`translate(${Math.min(pts[hoverDay][0], X1 - 70)}, ${Math.max(Y1 + 4, pts[hoverDay][1] - 42)})`}>
              <rect x="-44" width="104" height="28" rx="14" fill="var(--ink)" />
              <text x="8" y="18.5" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--card)">{hovered.sales} au {dm(hovered.date)}</text>
            </g>
          </g>}
          <circle cx={lx} cy={ly} r="5.5" fill="var(--card)" stroke="var(--navy)" strokeWidth="2.8" style={{ opacity: drawn ? 1 : 0, transition: 'opacity .4s ease 1.3s' }} />
          <text x={lx - 10} y={ly - 12} textAnchor="end" fontSize="14" fontWeight="700" fill="var(--ink)" style={{ opacity: drawn && !hovered ? 1 : 0, transition: 'opacity .3s ease' }}>{sold}</text>
          {labels.map((l) => (
            <g key={l.key} style={{ opacity: drawn ? 1 : 0, transition: settled ? 'opacity .25s ease' : 'opacity .5s ease 1.5s' }}>
              {Math.abs(l.ly - l.y) > 2 && <path d={`M${X1 + 8},${l.y} L${X1 + 14},${l.ly}`} stroke={l.color} strokeOpacity="0.5" fill="none" />}
              <Motion.g initial={false} animate={{ y: l.ly }} transition={SPRING}>
                <rect x={X1 + 14} y={-12} width={l.key === 'objective' ? 124 : 168} height="24" rx="12" fill={l.solid ? 'var(--ink)' : 'var(--card)'} stroke={l.solid ? 'none' : l.color} strokeWidth="1.5" />
                <text x={X1 + 26} y={4.5} fontSize="12" fontWeight="600" fill={l.solid ? 'var(--card)' : l.color}>{l.label}</text>
                <text x={X1 + (l.key === 'objective' ? 128 : 172)} y={4.5} textAnchor="end" fontSize="13" fontWeight="800" fill={l.solid ? 'var(--card)' : 'var(--ink)'} dx="-10">{l.value}</text>
              </Motion.g>
            </g>
          ))}
        </svg>
        </div>
        <div className="ps2-scenarios" role="list">
          {open && <Info role="listitem" className="ps2-scenario" label="Cadence actuelle, détail"
            detail={<Detail kicker="Cadence actuelle" title="Si le mois continue à ce rythme" value={cadence}
              rows={[['Ventes à date', fr(sold)], ['Cadence du mois', `${fr(cadenceRate, 2)} / jour`], ['Jours ouvrés restants', fr(remaining)],
                pilot.forecast?.math && [pilot.forecast.math.recent_basis === 'current_week' ? 'Au rythme de la semaine en cours' : 'Au rythme des 5 derniers jours', `${pilot.forecast.math.recent_pace}`],
                pilot.forecast && ['Plancher : RDV déjà planifiés', `${pilot.forecast.projection.sales}`]]}
              lines={[`${sold} + ${fr(cadenceRate, 2)} × ${remaining} = ${cadence}`]} />}>
            <i style={{ background: 'var(--navy)' }} /><span>Cadence actuelle</span><b className="ps2-num">{cadence}</b>
          </Info>}
          {open && jevValue != null && <Info role="listitem" className="ps2-scenario is-jev" label="Jev, détail" detail={<JevDetail jev={jev} objective={obj} />}>
            <i /><span>Jev, l’IA</span><b className="ps2-num">{jevValue}</b>
          </Info>}
        </div>
      </div>

      <div className="ps2-studio-side">
        <div className="ps2-studio-result" style={{ '--tone': tone }}>
          <div>
            <span className="ps2-mono">{simulating ? 'Simulation' : 'Fin de mois'}</span>
            <b className="ps2-num"><CountUp value={projected} duration={450} /></b>
          </div>
          {gap != null && <Motion.span key={reached ? 'up' : 'down'} className={`ps2-studio-gap ${reached ? 'is-good' : 'is-low'}`}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
            {gap > 0 ? '+' : gap < 0 ? '−' : ''}{fr(Math.abs(gap))}</Motion.span>}
        </div>
        {neededRate != null && (
          <div className="ps2-studio-pace">
            <span><small>Cadence {simulating ? 'simulée' : 'actuelle'}</small><b className="ps2-num">{fr(rate, 1)}<em> / j</em></b></span>
            <span className={rate >= neededRate ? 'is-good' : 'is-low'}><small>Nécessaire pour {obj}</small><b className="ps2-num">{fr(neededRate, 1)}<em> / j</em></b></span>
          </div>
        )}
        <div className="ps2-chain" aria-label={`${fr(rate, 2)} ventes par jour ouvré`}>
          <span>{fr(lv.leads, 0)}</span><i>×</i><span>{fr(transfo * 100, 1)} %</span>
          <i>=</i><b className="ps2-num">{fr(rate, 1)}<small> ventes / j</small></b>
        </div>
        <div className="ps2-lever-legend" aria-hidden="true"><span><i className="is-base" />cadence actuelle</span>{obj > 0 && <span><i className="is-goal" />pour finir à {obj}</span>}</div>
        <Lever lever={LEVERS[0]} value={lv.leads} base={base.leads} goal={goalFor('leads')} onChange={set('leads')} unit={unit} onUnit={setUnit} days={N} />
        <Lever lever={TRANSFO} value={transfo} base={baseTransfo} goal={neededRate != null && lv.leads ? neededRate / lv.leads : null} onChange={setTransfo} />
        <div className="ps2-lever-sub" role="group" aria-label="Détail du taux de transfo">
          <span className="ps2-lever-sub-head"><span>{fr(lv.r1 * 100, 0)} %</span><i>×</i><span>{fr(lv.r2 * 100, 0)} %</span><i>×</i><span>{fr(lv.close * 100, 0)} %</span><i>=</i><b>{fr(transfo * 100, 1)} %</b></span>
          {LEVERS.slice(1).map((l) => <Lever key={l.key} lever={l} value={lv[l.key]} base={base[l.key]} goal={goalFor(l.key)} onChange={set(l.key)} />)}
        </div>
        <button type="button" className="ps2-reset" onClick={() => setEdited(null)} disabled={!edited}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          Revenir à la cadence actuelle
        </button>
      </div>
    </div>
  );
}

// Lecture de Jev : la répartition des fins de mois probables, en barres, et ce qu'il a lu pour la donner.
export function JevDetail({ jev, objective }) {
  const buckets = jev.final_sales?.buckets || [];
  const max = Math.max(0.01, ...buckets.map((b) => b.probability));
  return (
    <Detail kicker="Jev, l’IA de Meta Ads, une lecture par jour" title="Fin de mois la plus probable" value={jev.final_sales?.expected}
      rows={[objective && ['Chance d’atteindre ' + objective, `${Math.round((jev.reach_objective || 0) * 100)} %`, 'ps2-strong'],
        jev.main_risk?.fr && ['Risque principal', jev.main_risk.fr], jev.momentum?.fr && ['Dynamique', jev.momentum.fr]]}
      source={`Lu le ${dm(jev.date)}${jev.age_hours != null ? `, il y a ${fr(jev.age_hours, 0)} h` : ''}`}>
      <div className="ps2-jev-bars">
        {buckets.map((b) => (
          <div key={b.key} className={b.low != null && objective && b.low >= objective ? 'is-goal' : ''}>
            <span className="ps2-jev-bar"><Motion.i initial={{ height: 0 }} animate={{ height: `${(b.probability / max) * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} /></span>
            <b className="ps2-num">{Math.round(b.probability * 100)} %</b>
            <small>{b.fr}</small>
          </div>
        ))}
      </div>
      <div className="ps2-pop-calc">Jev lit le mois comme un analyste : la cadence récente (plus lente que la moyenne), la présence aux R1, les RDV planifiés et les mois passés. Il ne prolonge pas une moyenne : il pondère ce qui freine.</div>
      {jev.facts_fr?.length > 0 && <details className="ps2-pop-more"><summary>Ce que Jev a lu</summary><ul>{jev.facts_fr.map((f) => <li key={f}>{f}</li>)}</ul></details>}
    </Detail>
  );
}
