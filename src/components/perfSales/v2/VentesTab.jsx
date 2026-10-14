import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, useDrawn, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { SOURCES, euro, fr, initials } from './model';
import { isPerformanceSalesPerson } from '../../../utils/performanceSales.js';

// Onglet Ventes (dev 14/10/2026 : « data ici, checker si elle est bonne » ; « motion design et propre »). Les ventes
// déclarées du mois : tranches d'effectif et mode de paiement DÉCLARÉS sur la fiche client (n°806 en annuel), canal de
// chaque vente selon la règle de la page (source du lead vendu), et le détail par commercial.
const BRACKETS = [['1-2', '1-2 salariés'], ['3-5', '3-5'], ['6-10', '6-10'], ['11-19', '11-19'], ['20+', '20 et plus'], ['autre', 'Non renseigné']];
const BRACKET_COLORS = ['#cfdaf0', '#9fb3df', '#7f9ad9', '#3d5ba8', '#1e3a7b', '#c9cfda'];

export default function VentesTab({ breakdown, model, onOpen }) {
  if (!breakdown) return <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>;
  const rows = (breakdown.by_rapporteur || []).filter((r) => isPerformanceSalesPerson(r.rapporteur));
  const total = rows.reduce((a, r) => a + r.ventes, 0);
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const brackets = BRACKETS.map(([k, l], i) => ({ key: k, label: l, value: rows.reduce((a, r) => a + (r.headcount?.[k] || 0), 0), color: BRACKET_COLORS[i] }));
  const bySource = model.views?.global?.sales || {};
  const channels = SOURCES.map((s) => ({ ...s, value: bySource[s.key] || 0 })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const revenueOf = (name) => Object.values(model.byPerson?.[name]?.revenue || {}).reduce((a, v) => a + v, 0);
  const revenue = model.totals.total_revenue;
  const monthly = sum('mensuel'), yearly = sum('annuel');
  return (
    <div className="ps2-grid">
      <Reveal as="section" className="ps2-span-12 ps2-setter-kpis" aria-label="Ventes du mois" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07 } } }}>
        {[
          ['Ventes déclarées', <CountUp value={total} />, `${rows.length} commerciaux`],
          ['CA déclaré', <CountUp value={revenue} format={euro} />, `cash ${euro(model.totals.total_cash)}`],
          ['Panier moyen', total ? <CountUp value={revenue / total} format={euro} /> : '–', 'CA déclaré par vente'],
          ['Mensuel / annuel', <>{fr(monthly)}<small> / {fr(yearly)}</small></>, 'mode déclaré sur la fiche client'],
        ].map(([l, v, n]) => (
          <Motion.div key={l} className="ps2-setter-kpi" variants={ITEM}><span>{l}</span><b className="ps2-num">{v}</b><small>{n}</small></Motion.div>
        ))}
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-6" aria-labelledby="ps2-brackets-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-brackets-title">Tranches d’effectif vendues</h2></Motion.div>
        <Motion.div variants={ITEM}><Bars items={brackets} total={total} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-6" aria-labelledby="ps2-salechan-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-salechan-title">D’où viennent les ventes</h2></Motion.div>
        <Motion.div variants={ITEM}><Bars items={channels} total={total} onPick={(k) => onOpen('sales', { source: k })} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-sellers-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-sellers-title">Par commercial</h2>
          <span className="ps2-legend">{channels.map((s) => <span key={s.key}><i style={{ borderColor: s.color, borderTopWidth: 6, borderRadius: 3, width: 10 }} />{s.label}</span>)}</span></Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable" style={{ '--c': '#1e3a7b', minWidth: 980 }}>
            <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Commercial</th><th className="is-key">Ventes</th><th style={{ textAlign: 'left', width: 200 }}>Canaux</th>
              <th style={{ textAlign: 'left', width: 200 }}>Tranches</th><th>Mensuel</th><th>Annuel</th><th>CA déclaré</th></tr></thead>
            <tbody>
              {rows.map((r, i) => <SellerRow key={r.rapporteur} r={r} i={i} max={Math.max(1, ...rows.map((x) => x.ventes))} bySource={model.byPerson?.[r.rapporteur]?.sales || {}}
                revenue={revenueOf(r.rapporteur)} avatarFor={model.avatarFor} onOpen={onOpen} />)}
              <tr className="is-total"><td /><td style={{ textAlign: 'left' }}>Total</td><td className="is-key">{fr(total)}</td><td /><td /><td>{fr(monthly)}</td><td>{fr(yearly)}</td><td>{euro(revenue)}</td></tr>
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

function Bars({ items, total, onPick }) {
  const drawn = useDrawn();
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <div className="ps2-vbars">
      {items.map((x, i) => {
        const body = (
          <>
            <span className="ps2-vbars-label"><i style={{ background: x.color }} />{x.label}</span>
            <span className="ps2-vbars-track"><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${(x.value / max) * 100}%` : 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.07 }} style={{ background: x.color }} /></span>
            <b className="ps2-num">{fr(x.value)}</b>
            <small className="ps2-num">{fr((x.value / Math.max(1, total)) * 100, 0)} %</small>
          </>
        );
        return onPick ? <button type="button" key={x.key} className="ps2-vbars-row is-click" onClick={() => onPick(x.key)}>{body}</button>
          : <div key={x.key} className="ps2-vbars-row">{body}</div>;
      })}
    </div>
  );
}

function SellerRow({ r, i, max, bySource, revenue, avatarFor, onOpen }) {
  const on = useRevealed();
  const parts = SOURCES.map((s) => ({ ...s, value: bySource[s.key] || 0 })).filter((s) => s.value > 0);
  const hc = BRACKETS.map(([k, l], j) => ({ key: k, label: l, value: r.headcount?.[k] || 0, color: BRACKET_COLORS[j] })).filter((x) => x.value > 0);
  return (
    <Motion.tr initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.04 }}>
      <td className="ps2-num ps2-muted">{i + 1}</td>
      <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={r.rapporteur} url={avatarFor?.(r.rapporteur)} /><span>{r.rapporteur}</span></span></td>
      <td className="is-key"><span className="ps2-ctable-sales"><span className="ps2-ctable-bar"><Motion.i initial={{ width: 0 }} animate={{ width: on ? `${(r.ventes / max) * 100}%` : 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.04 }} /></span>
        <button type="button" className="ps2-cell" onClick={() => onOpen('sales', { person: r.rapporteur })}>{fr(r.ventes)}</button></span></td>
      <td style={{ textAlign: 'left' }}><MiniStack parts={parts} title="Canaux" /></td>
      <td style={{ textAlign: 'left' }}><MiniStack parts={hc} title="Tranches d’effectif" /></td>
      <td>{fr(r.mensuel)}</td>
      <td className={r.annuel ? '' : 'ps2-muted'}>{fr(r.annuel)}</td>
      <td>{revenue ? euro(revenue) : '–'}</td>
    </Motion.tr>
  );
}

function MiniStack({ parts, title }) {
  const on = useRevealed();
  const total = parts.reduce((a, x) => a + x.value, 0);
  if (!total) return <span className="ps2-muted">–</span>;
  return (
    <Info className="ps2-ministack" label={title} detail={<Detail kicker={title} rows={parts.map((x) => [x.label, fr(x.value)])} />}>
      {parts.map((x, k) => <Motion.i key={x.key} style={{ background: x.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: on ? x.value : 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.25 + k * 0.05 }} title={`${x.label} : ${x.value}`} />)}
    </Info>
  );
}

function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: '0 0 28px', width: 28, height: 28, fontSize: 10.5, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

