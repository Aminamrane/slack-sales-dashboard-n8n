import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, useDrawn } from '../motion';
import { usePop, Detail } from './Pop';
import { fr } from './model';
import { flowLayout } from './flowLayout';
import { FLOW_GROUPS, flowNodes, nodeText } from './flowData';

// Schéma « Fiches reçues » : données dans flowData.js, agencement dans flowLayout.js.
const SOURCE_COLOR = 'var(--flow-src)';   // #121b35, plus clair en thème sombre (v2.css)

// Largeur réelle du conteneur : le schéma se dessine en pixels, textes et rubans dans le même repère.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const NARROW = 760;

export default function AdsFlow({ intake, month }) {
  const data = useMemo(() => flowNodes(intake), [intake]);
  const [ref, width] = useWidth();
  const layout = useMemo(() => (data && width >= NARROW ? flowLayout(data, width) : null), [data, width]);
  if (!data) return null;
  return (
    <div className="ps2-flowmap" ref={ref}>
      {layout ? <Diagram data={data} layout={layout} month={month} /> : width > 0 && <FlowList data={data} />}
    </div>
  );
}

function Diagram({ data, layout: L, month }) {
  const drawn = useDrawn();
  const open = usePop();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const groupOf = (key) => L.leaves.find((l) => l.key === key)?.group || key;
  const active = hover ? groupOf(hover) : null;
  const lit = (r) => !hover || hover === 'all' || (r.leaf ? r.leaf === hover || hover === r.group : r.group === active);
  const leafLit = (l) => !hover || hover === 'all' || hover === l.key || hover === l.group;
  const colorOf = (key) => FLOW_GROUPS[key]?.color || L.leaves.find((l) => l.key === key)?.color;
  const pct = (v) => `${fr((v / data.total) * 100, v / data.total < 0.1 ? 1 : 0)} %`;
  const openNode = (e, n, kicker) => open(e.currentTarget, <Detail kicker={kicker} title={nodeText(n)} value={fr(n.value)}
    rows={[['Part des fiches reçues', pct(n.value)]]} lines={n.lines || []} />);
  const openSource = (e) => open(e.currentTarget, <Detail kicker="Funnel Leads" title={`Fiches reçues en ${month}`} value={fr(data.total)}
    rows={[['Données à un sales', fr(data.givenTotal)], ['Jamais données', fr(data.notGivenTotal)], ['dont « 1 à 2 / moins de 100 k€ » de Funnel Leads', fr(data.small)], ['… données quand même', fr(data.smallGiven)]]}
    lines={['Mêmes filtres et mêmes bornes que Funnel Leads : fiches entrantes créées dans le mois, hors cold call et setters.']} />);
  const { src: SW, mid: MW, bar: BW } = L.widths;
  const label = `Fiches reçues en ${month} : ${L.leaves.map((n) => `${nodeText(n)} ${n.value}`).join(', ')}`;
  return (
    <div className={`ps2-flow-stage${L.wide ? '' : ' is-compact'}`} style={{ height: L.height + 12 }} onMouseLeave={() => setHover(null)}>
      <div className="ps2-flow-heads" aria-hidden="true">
        <span style={{ left: 0 }}>Reçues</span>
        <span style={{ left: L.x.mid }}>Affectation</span>
        <span style={{ left: L.x.leaf }}>Aujourd’hui</span>
      </div>
      <svg width={L.x.leaf + BW} height={L.height} viewBox={`0 0 ${L.x.leaf + BW} ${L.height}`} role="img" aria-label={label}>
        <defs>
          {L.ribbons.map((r) => (
            <linearGradient key={r.key} id={`${uid}-${r.key}`} gradientUnits="userSpaceOnUse" x1={r.leaf ? L.x.mid + MW : SW} x2={r.leaf ? L.x.leaf : L.x.mid} y1="0" y2="0">
              <stop offset="0" style={{ stopColor: r.leaf ? colorOf(r.group) : SOURCE_COLOR }} />
              <stop offset="1" stopColor={colorOf(r.leaf || r.group)} />
            </linearGradient>
          ))}
          <clipPath id={`${uid}-reveal`}>
            <Motion.rect x="0" y="0" height={L.height} initial={{ width: 0 }} animate={{ width: drawn ? L.x.leaf + BW : 0 }}
              transition={{ duration: 1.5, ease: EASE, delay: 0.15 }} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-reveal)`}>
          {L.ribbons.map((r) => (
            <path key={r.key} d={r.d} fill={`url(#${uid}-${r.key})`} opacity={lit(r) ? (hover ? 0.5 : 0.3) : 0.06}
              style={{ transition: 'opacity .3s' }} />
          ))}
        </g>
        {L.leaves.map((l, i) => (
          <Motion.rect key={l.key} x={L.x.leaf} y={l.y} width={BW} height={l.h} rx="2" fill={l.color}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scaleY: 0 }} animate={drawn ? { opacity: leafLit(l) ? 1 : 0.3, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: drawn && !hover ? 0.95 + i * 0.05 : 0 }} />
        ))}
      </svg>

      <Motion.button type="button" className="ps2-flow-block is-src" style={{ left: 0, top: L.src.y, width: SW, height: L.src.h, background: SOURCE_COLOR, color: '#fff' }}
        initial={{ opacity: 0, scaleY: 0.7 }} animate={drawn ? { opacity: 1, scaleY: 1 } : {}} transition={{ duration: 0.6, ease: EASE }}
        onMouseEnter={() => setHover('all')} onClick={openSource}>
        <b className="ps2-num"><CountUp value={data.total} format={(v) => fr(Math.round(v))} /></b><span className="ps2-flow-block-label">fiches reçues</span>
      </Motion.button>
      {L.mids.map((m, i) => {
        const g = FLOW_GROUPS[m.key];
        return (
          <Motion.button type="button" key={m.key} className={`ps2-flow-block is-${m.key}`}
            style={{ left: L.x.mid, top: m.y, width: MW, height: m.h, background: g.color, color: g.ink }}
            initial={{ opacity: 0, scaleY: 0.7 }} animate={drawn ? { opacity: hover && active !== m.key && hover !== 'all' ? 0.45 : 1, scaleY: 1 } : {}}
            transition={{ duration: 0.6, ease: EASE, delay: drawn && !hover ? 0.45 + i * 0.1 : 0 }}
            onMouseEnter={() => setHover(m.key)} onFocus={() => setHover(m.key)}
            onClick={(e) => openNode(e, { ...m, label: g.label, lines: [] }, 'Fiches reçues')}>
            <b className="ps2-num"><CountUp value={m.value} format={(v) => fr(Math.round(v))} delay={450} /></b><span className="ps2-flow-block-label">{g.label}</span>
          </Motion.button>
        );
      })}
      {L.leaves.map((l, i) => (
        <Motion.button type="button" key={l.key} className="ps2-flow-leaf" style={{ left: L.x.label, top: l.cy, width: L.x.lane }}
          initial={{ opacity: 0, x: -10 }} animate={drawn ? { opacity: leafLit(l) ? 1 : 0.4, x: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: drawn && !hover ? 1.05 + i * 0.05 : 0 }}
          onMouseEnter={() => setHover(l.key)} onFocus={() => setHover(l.key)}
          onClick={(e) => openNode(e, l, FLOW_GROUPS[l.group].label)}>
          <b className="ps2-num">{fr(l.value)}</b>
          <span className="ps2-flow-leaf-text">{l.label}{l.sub && <em>{l.sub}</em>}</span>
          <span className="ps2-flow-leaf-pct ps2-num">{pct(l.value)}</span>
        </Motion.button>
      ))}
    </div>
  );
}

// Conteneur étroit (téléphone) : la même répartition en liste, le schéma n'y est pas lisible.
function FlowList({ data }) {
  const drawn = useDrawn();
  const rows = [
    { key: 'total', label: 'Reçues', value: data.total, color: SOURCE_COLOR, strong: true },
    { key: 'given', label: FLOW_GROUPS.given.label, value: data.givenTotal, color: FLOW_GROUPS.given.color, strong: true }, ...data.given,
    { key: 'not', label: FLOW_GROUPS.not.label, value: data.notGivenTotal, color: FLOW_GROUPS.not.color, strong: true }, ...data.notGiven,
  ];
  return (
    <div className="ps2-flow-list" role="list">
      {rows.map((n, i) => (
        <div key={n.key} role="listitem" className={`ps2-flow-row${n.strong ? ' is-strong' : ''}`}>
          <span>{nodeText(n)}</span><b className="ps2-num">{fr(n.value)}</b>
          <span className="ps2-flow-bar"><Motion.i style={{ background: n.color }} initial={{ width: 0 }}
            animate={{ width: drawn ? `${(n.value / data.total) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.04 }} /></span>
        </div>
      ))}
    </div>
  );
}
