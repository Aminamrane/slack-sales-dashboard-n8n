import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useRevealed } from '../motion';
import { SOURCES, euro, fr, initials } from './model';
import { isPerformanceSalesPerson } from '../../../utils/performanceSales.js';

// Tableau des sales pour UN canal d'acquisition (dev 14/10/2026 : « quand c'est ADS, on parle d'ADS uniquement, pas des
// reprises du pool commun » ; « il faut tous les canaux dans le tableau : CCS, seconde chance, parrainage, LinkedIn… »).
// Même règle que l'entonnoir et l'onglet Canaux (partition par source, ventilée par sales) : la ligne Total d'un canal
// est la colonne de ce canal dans l'onglet Canaux. Les appels ne se rattachent pas à un canal : ils restent dans Global.
const COLS = [
  ['leads', 'Leads reçus'], ['r1', 'R1 posés'], ['r1_phone', 'R1 tél.'], ['r1_done', 'R1 effectués'], ['tx_r1', 'Tx R1'],
  ['r2', 'R2 posés'], ['r2_done', 'R2 effectués'], ['tx_r2', 'Tx R2'], ['signed', 'Signatures'], ['sales', 'Ventes'], ['revenue', 'CA déclaré'], ['conv', 'Ventes / leads'],
];
const METRIC_OF = { leads: 'leads', r1_done: 'r1e', r2_done: 'r2e', signed: 'signed', sales: 'sales' };

export function channelRows(byPerson, source) {
  // Une seconde chance n'est pas un lead reçu : son entrée est la réattribution au setter.
  const entry = source === 'second_chance' ? 'leads' : 'received';
  return Object.entries(byPerson || {}).filter(([name]) => isPerformanceSalesPerson(name)).map(([name, steps]) => {
    const g = (step) => Number(steps?.[step]?.[source] || 0);
    const row = { name, leads: g(entry), r1: g('r1'), r1_phone: g('r1_phone'), r1_done: g('r1_done'), r2: g('r2'), r2_done: g('r2_done'),
      signed: g('signed'), sales: g('sales'), revenue: g('revenue') };
    return { ...row, tx_r1: row.r1 ? row.r1_done / row.r1 : null, tx_r2: row.r2 ? row.r2_done / row.r2 : null, conv: row.leads ? row.sales / row.leads : null };
  }).filter((r) => r.leads || r.r1 || r.r1_phone || r.r2 || r.signed || r.sales)
    .sort((a, b) => b.sales - a.sales || b.revenue - a.revenue || b.leads - a.leads || a.name.localeCompare(b.name));
}

export function channelSources(byPerson) {
  return SOURCES.filter((s) => channelRows(byPerson, s.key).length);
}

const pctText = (v) => (v == null ? '–' : `${fr(v * 100, 0)} %`);

export default function ChannelTable({ byPerson, source, avatarFor, onOpen }) {
  const on = useRevealed();
  const rows = channelRows(byPerson, source);
  if (!rows.length) return <div className="ps2-empty">–</div>;
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const total = { leads: sum('leads'), r1: sum('r1'), r1_phone: sum('r1_phone'), r1_done: sum('r1_done'), r2: sum('r2'), r2_done: sum('r2_done'),
    signed: sum('signed'), sales: sum('sales'), revenue: sum('revenue') };
  total.tx_r1 = total.r1 ? total.r1_done / total.r1 : null;
  total.tx_r2 = total.r2 ? total.r2_done / total.r2 : null;
  total.conv = total.leads ? total.sales / total.leads : null;
  const maxSales = Math.max(1, ...rows.map((r) => r.sales));
  const color = SOURCES.find((s) => s.key === source)?.color || '#1e3a7b';
  const cell = (r, k) => {
    if (k === 'tx_r1' || k === 'tx_r2' || k === 'conv') return pctText(r[k]);
    if (k === 'revenue') return r.revenue ? euro(r.revenue) : '–';
    return fr(r[k]);
  };
  return (
    <div className="ps2-ctable-wrap">
      <table className="ps2-ctable" style={{ '--c': color }}>
        <thead>
          <tr><th>#</th><th style={{ textAlign: 'left' }}>Sales</th>
            {COLS.map(([k, l]) => <th key={k} className={k === 'sales' ? 'is-key' : ''}>{source === 'second_chance' && k === 'leads' ? 'Leads repris' : l}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Motion.tr key={r.name} initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.03 }}>
              <td className="ps2-num ps2-muted">{i + 1}</td>
              <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={r.name} url={avatarFor?.(r.name)} /><span>{r.name}</span></span></td>
              {COLS.map(([k]) => {
                const v = r[k];
                const clickable = METRIC_OF[k] && v > 0 && onOpen;
                return (
                  <td key={k} className={k === 'sales' ? 'is-key' : ''}>
                    {k === 'sales' ? (
                      <span className="ps2-ctable-sales">
                        <span className="ps2-ctable-bar"><Motion.i initial={{ width: 0 }} animate={{ width: on ? `${(v / maxSales) * 100}%` : 0 }}
                          transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.03 }} /></span>
                        {clickable ? <button type="button" className="ps2-cell" onClick={() => onOpen('sales', { person: r.name, source })}>{fr(v)}</button> : <b className="ps2-num">{fr(v)}</b>}
                      </span>
                    ) : clickable ? <button type="button" className="ps2-cell" onClick={() => onOpen(METRIC_OF[k], { person: r.name, source })}>{cell(r, k)}</button>
                      : <span className={v ? '' : 'ps2-muted'}>{cell(r, k)}</span>}
                  </td>
                );
              })}
            </Motion.tr>
          ))}
          <tr className="is-total"><td /><td style={{ textAlign: 'left' }}>Total · {rows.length} sales</td>
            {COLS.map(([k]) => <td key={k} className={k === 'sales' ? 'is-key' : ''}>{cell(total, k)}</td>)}</tr>
        </tbody>
      </table>
    </div>
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
