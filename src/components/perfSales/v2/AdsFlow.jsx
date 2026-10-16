import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, useDrawn } from '../motion';
import { usePop, Detail } from './Pop';
import { fr } from './model';
import { flowLayout } from './flowLayout';
import { COLUMNS, flowGraph, nodeDetail, nodeText } from './flowData';
import { nodeLeads } from './intakeData';

// Schéma « Fiches reçues » : données dans flowData.js, agencement dans flowLayout.js.

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
// Blocs clairs : texte foncé ; les autres en blanc.
const LIGHT = new Set(['#8b95a7', '#a3abbb', '#b9c0cc', '#c9cfda', '#e6b45a', '#d9b25f']);

export default function AdsFlow({ intake, month, onLeads }) {
  const graph = useMemo(() => flowGraph(intake), [intake]);
  const [ref, width] = useWidth();
  const layout = useMemo(() => (graph && width >= NARROW ? flowLayout(graph, width) : null), [graph, width]);
  if (!graph) return null;
  return (
    <div className="ps2-flowmap" ref={ref}>
      {layout ? <Diagram graph={graph} layout={layout} month={month} onLeads={onLeads} /> : width > 0 && <FlowList graph={graph} />}
    </div>
  );
}

// Tout ce qui passe par un nœud : ses liens en amont et en aval, de proche en proche.
function pathOf(graph, id) {
  const nodes = new Set([id]);
  const links = new Set();
  const walk = (dir) => {
    const stack = [id];
    const seen = new Set([id]);
    while (stack.length) {
      const cur = stack.pop();
      for (const l of graph.links) {
        if ((dir === 'up' ? l.target : l.source) !== cur) continue;
        links.add(`${l.source}>${l.target}`);
        const next = dir === 'up' ? l.source : l.target;
        nodes.add(next);
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
  };
  walk('up');
  walk('down');
  return { nodes, links };
}

const safeId = (key) => key.replace(/[^a-z0-9]/gi, '_');

function Diagram({ graph, layout: L, month, onLeads }) {
  const drawn = useDrawn();
  const open = usePop();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const lit = useMemo(() => (hover ? pathOf(graph, hover) : null), [graph, hover]);
  const byId = useMemo(() => new Map(L.nodes.map((n) => [n.id, n])), [L]);
  const BW = L.widths.bar;
  const full = L.x.leaf + BW;
  const openNode = (e, id) => {
    const { node, rows } = nodeDetail(graph, id);
    const f = graph.funnel;
    const extra = node.id === 'root'
      ? [['Leads reçus de Funnel Leads', fr(f.received)], ['1 à 2 / moins de 100 k€', fr(f.small)], ['Sans 1 à 2 / moins de 100 k€', fr(f.without)],
        ['Clean (tél FR)', fr(f.clean)], ['… dont ADS traitables', fr(f.cleanAds)], ['… dont autres canaux', fr(f.clean - f.cleanAds)]]
      : node.funnel === 'fr' ? [['Clean (tél FR) de Funnel Leads, tous canaux', fr(f.clean)], ['… dont ADS', fr(f.cleanAds)]] : [];
    const lines = node.id === 'root' ? ['Mêmes filtres et mêmes bornes que Funnel Leads : fiches entrantes créées dans le mois, hors cold call et setters.'] : node.lines || [];
    // Le détail fiche par fiche (dev 16/10/2026 : « le détail des leads affectés, même s'ils ne sont plus dans les tracking sheets »).
    const action = onLeads && node.value > 0 ? (close) => (
      <button type="button" className="ps2-link" onClick={() => { close(); onLeads(nodeLeads(node, month)); }}>{node.value > 1 ? `Voir les ${fr(node.value)} fiches` : 'Voir la fiche'}</button>) : null;
    open(e.currentTarget, (close) => <Detail kicker={COLUMNS[node.col]} title={node.id === 'root' ? `Fiches reçues en ${month}` : nodeText(node)} value={fr(node.value)}
      rows={[...extra, ...rows]} lines={lines} action={action?.(close)} />);
  };
  const dim = (id) => Boolean(lit) && !lit.nodes.has(id);
  const label = `Fiches reçues en ${month} : ${L.leaves.map((n) => `${nodeText(n)} ${n.value}`).join(', ')}`;
  const pct = (v) => `${fr((v / graph.total) * 100, v / graph.total < 0.1 ? 1 : 0)} %`;
  const delayOf = (col) => 0.1 + col * 0.32;
  return (
    <div className={`ps2-flow-stage${L.wide ? '' : ' is-compact'}`} style={{ height: L.height + 12 }} onMouseLeave={() => setHover(null)}>
      <div className="ps2-flow-heads" aria-hidden="true">
        {COLUMNS.map((c, i) => <span key={c} style={{ left: L.x.cols[i] }}>{c}</span>)}
      </div>
      <svg width={full} height={L.height} viewBox={`0 0 ${full} ${L.height}`} role="img" aria-label={label}>
        <defs>
          {L.ribbons.map((r) => (
            <linearGradient key={r.key} id={`${uid}-${safeId(r.key)}`} gradientUnits="userSpaceOnUse" x1={r.x0} x2={r.x1} y1="0" y2="0">
              <stop offset="0" style={{ stopColor: byId.get(r.source).color }} />
              <stop offset="1" style={{ stopColor: byId.get(r.target).color }} />
            </linearGradient>
          ))}
          <clipPath id={`${uid}-reveal`}>
            <Motion.rect x="0" y="0" height={L.height} initial={{ width: 0 }} animate={{ width: drawn ? full : 0 }} transition={{ duration: 1.7, ease: EASE, delay: 0.15 }} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-reveal)`}>
          {L.ribbons.map((r) => (
            <path key={r.key} d={r.d} fill={`url(#${uid}-${safeId(r.key)})`}
              opacity={!lit ? 0.3 : lit.links.has(r.key) ? 0.55 : 0.05} style={{ transition: 'opacity .3s' }} />
          ))}
        </g>
        {L.leaves.map((l, i) => (
          <Motion.rect key={l.id} x={L.x.leaf} y={l.y} width={BW} height={l.h} rx="2" fill={l.color}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scaleY: 0 }} animate={drawn ? { opacity: dim(l.id) ? 0.3 : 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: drawn && !hover ? delayOf(3) + i * 0.04 : 0 }} />
        ))}
      </svg>

      {L.nodes.filter((n) => n.col < 3).map((n) => (
        <Motion.button type="button" key={n.id} className={`ps2-flow-block${n.twoLines ? '' : ' is-line'}${n.kind === 'root' ? ' is-src' : ''}`}
          style={{ left: L.x.cols[n.col], top: n.y, width: L.blockW[n.col], height: n.h, background: n.color, color: LIGHT.has(n.color) ? '#121b35' : '#ffffff' }}
          initial={{ opacity: 0, scaleY: 0.7 }} animate={drawn ? { opacity: dim(n.id) ? 0.4 : 1, scaleY: 1 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: drawn && !hover ? delayOf(n.col) : 0 }}
          onMouseEnter={() => setHover(n.id)} onFocus={() => setHover(n.id)} onClick={(e) => openNode(e, n.id)}>
          <b className="ps2-num"><CountUp value={n.value} format={(v) => fr(Math.round(v))} delay={Math.round(delayOf(n.col) * 1000)} /></b>
          <span className="ps2-flow-block-label">{n.label}</span>
        </Motion.button>
      ))}
      {L.leaves.map((l, i) => (
        <Motion.button type="button" key={l.id} className="ps2-flow-leaf" style={{ left: L.x.label, top: l.cy, width: L.x.lane }}
          initial={{ opacity: 0, x: -10 }} animate={drawn ? { opacity: dim(l.id) ? 0.4 : 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: drawn && !hover ? delayOf(3) + 0.1 + i * 0.04 : 0 }}
          onMouseEnter={() => setHover(l.id)} onFocus={() => setHover(l.id)} onClick={(e) => openNode(e, l.id)}>
          <b className="ps2-num">{fr(l.value)}</b>
          <span className="ps2-flow-leaf-text">{l.label}</span>
          <span className="ps2-flow-leaf-pct ps2-num">{pct(l.value)}</span>
        </Motion.button>
      ))}
    </div>
  );
}

// Conteneur étroit (téléphone) : la même répartition en liste, colonne par colonne.
function FlowList({ graph }) {
  const drawn = useDrawn();
  const rows = [];
  COLUMNS.forEach((title, col) => {
    const nodes = graph.nodes.filter((n) => n.col === col);
    if (!nodes.length) return;
    rows.push({ head: true, key: `h-${col}`, label: title });
    nodes.forEach((n) => rows.push({ key: n.id, label: n.id === 'root' ? 'Fiches reçues' : nodeText(n), value: n.value, color: n.color }));
  });
  return (
    <div className="ps2-flow-list" role="list">
      {rows.map((n, i) => (n.head ? <div key={n.key} className="ps2-flow-list-head">{n.label}</div> : (
        <div key={n.key} role="listitem" className="ps2-flow-row">
          <span>{n.label}</span><b className="ps2-num">{fr(n.value)}</b>
          <span className="ps2-flow-bar"><Motion.i style={{ background: n.color }} initial={{ width: 0 }}
            animate={{ width: drawn ? `${(n.value / graph.total) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.03 }} /></span>
        </div>
      )))}
    </div>
  );
}
