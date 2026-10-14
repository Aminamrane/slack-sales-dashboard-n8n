import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { SOURCES, fr, initials } from './model';
import { isPerformanceSalesPerson } from '../../../utils/performanceSales.js';

// Chaque sales, canal d'acquisition par canal (dev 14/10/2026 : « faut qu'on voie le détail par canaux d'acquisition »).
// Même partition que l'entonnoir et l'onglet Canaux, ventilée par sales : la ligne « Équipe » retombe sur le global.
// Une case = le volume de l'étape choisie pour ce sales et ce canal, teintée à la couleur du canal selon son poids ;
// la colonne Mois montre le mélange des canaux. Chaque case s'ouvre sur le parcours complet du sales dans ce canal.
const STEPS = [['received', 'Leads reçus'], ['r1_done', 'R1 effectués'], ['r2_done', 'R2 effectués'], ['signed', 'Signatures'], ['sales', 'Ventes']];
const METRIC_OF = { received: 'leads', r1_done: 'r1e', r2_done: 'r2e', signed: 'signed', sales: 'sales' };

export default function ChannelBoard({ byPerson, avatarFor, onOpen }) {
  const on = useRevealed();
  const [step, setStep] = useState('sales');
  const people = Object.entries(byPerson || {}).filter(([name]) => isPerformanceSalesPerson(name));
  if (!people.length) return null;
  const val = (steps, src, st = step) => steps?.[st]?.[src] || 0;
  const total = (steps, st = step) => Object.values(steps?.[st] || {}).reduce((a, n) => a + n, 0);
  const sources = SOURCES.filter((s) => people.some(([, steps]) => STEPS.some(([st]) => val(steps, s.key, st))));
  const rows = people.map(([name, steps]) => ({ name, steps, total: total(steps) }))
    .sort((a, b) => b.total - a.total || total(b.steps, 'sales') - total(a.steps, 'sales') || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.flatMap((r) => sources.map((s) => val(r.steps, s.key))));
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const colTotal = (src) => rows.reduce((a, r) => a + val(r.steps, src), 0);
  const label = STEPS.find(([k]) => k === step)[1];
  return (
    <div className="ps2-chboard">
      <div className="ps2-segment" role="group" aria-label="Étape">
        {STEPS.map(([k, l]) => <button type="button" key={k} aria-pressed={step === k} onClick={() => setStep(k)}>{l}</button>)}
      </div>
      <div className="ps2-cb" style={{ '--cols': sources.length }} role="table" aria-label={`${label} par sales et par canal`}>
        <div className="ps2-cb-row is-head" role="row">
          <span role="columnheader" />
          {sources.map((s) => (
            <span key={s.key} role="columnheader" className="ps2-cb-head"><i style={{ background: s.color }} />{s.label}</span>
          ))}
          <span role="columnheader" className="ps2-cb-head is-total">Mois</span>
        </div>
        {rows.map((r, i) => (
          <Motion.div key={r.name} role="row" className="ps2-cb-row" initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.03 }}>
            <span role="rowheader" className="ps2-wb-name"><Face name={r.name} url={avatarFor?.(r.name)} /><span>{r.name}</span></span>
            {sources.map((s, k) => {
              const v = val(r.steps, s.key);
              return (
                <span key={s.key} role="cell" className="ps2-cb-cell">
                  {v ? (
                    <Info className="ps2-cb-hit" label={`${r.name}, ${s.label} : ${v} ${label.toLowerCase()}`}
                      detail={(dismiss) => (
                        <Detail kicker={s.label} title={r.name}
                          rows={STEPS.map(([st, l]) => [l, fr(val(r.steps, s.key, st)), st === step ? 'ps2-strong' : ''])}
                          action={onOpen && <button type="button" className="ps2-link" onClick={() => { dismiss(); onOpen(METRIC_OF[step], { person: r.name, source: s.key }); }}>Dossiers</button>} />
                      )}>
                      <Motion.span className={`ps2-cb-chip${v / max > 0.45 ? ' is-strong' : ''}`} style={{ '--c': s.color, '--a': `${Math.round(16 + 74 * (v / max))}%` }}
                        initial={{ scale: 0.6, opacity: 0 }} animate={on ? { scale: 1, opacity: 1 } : {}}
                        transition={{ duration: 0.45, ease: EASE, delay: 0.15 + i * 0.03 + k * 0.03 }}>{v}</Motion.span>
                    </Info>
                  ) : <span className="ps2-cb-zero" />}
                </span>
              );
            })}
            <span role="cell" className="ps2-cb-total">
              <span className="ps2-cb-mix" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                {sources.map((s, k) => {
                  const v = val(r.steps, s.key);
                  return v ? <Motion.i key={s.key} style={{ background: s.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: on ? v : 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.03 + k * 0.02 }} /> : null;
                })}
              </span>
              <b className="ps2-num">{fr(r.total)}</b>
            </span>
          </Motion.div>
        ))}
        <div className="ps2-cb-row is-foot" role="row">
          <span role="rowheader">Équipe</span>
          {sources.map((s) => <span key={s.key} role="cell" className="ps2-num">{fr(colTotal(s.key))}</span>)}
          <span role="cell" className="ps2-num" style={{ textAlign: 'right' }}>{fr(rows.reduce((a, r) => a + r.total, 0))}</span>
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
