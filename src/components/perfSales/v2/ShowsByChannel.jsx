import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import { AD_SOURCES, SOURCES, fr } from './model';

// Qui fait nos shows (dev 15/10/2026 : « voir quels canaux d'acquisition font le plus de nos shows ») : chaque canal, ou
// chaque pub du canal ADS choisi, avec ses RDV posés du mois découpés en effectués, absents, annulés, pas qualifiés et
// à venir (mêmes couleurs que les cartes), et sa présence. Classés par RDV effectués ; un clic filtre les cartes.
const PARTS = [['done', '#2c6448'], ['noshow', '#c2410c'], ['cancelled', '#c9a66b'], ['open', '#cfd5df'], ['upcoming', '#9fb3df']];
const LABEL = { done: 'effectués', noshow: 'absents', cancelled: 'annulés', open: 'pas qualifiés', upcoming: 'à venir' };

function split(steps, s) {
  const g = (k) => Number(steps?.[k] || 0);
  const placed = g(s), due = g(`${s}_due`), done = g(`${s}_done_due`), open = g(`${s}_open`), noshow = g(`${s}_noshow`);
  return { placed, done, noshow, open, cancelled: Math.max(0, due - done - open - noshow), upcoming: Math.max(0, placed - due),
    presence: done + noshow ? Math.round((done / (done + noshow)) * 100) : null };
}

export default function ShowsByChannel({ model, scope, onPick }) {
  const drawn = useDrawn();
  const [stage, setStage] = useState('r1');
  const g = model?.views?.global || {};
  const byAd = AD_SOURCES.includes(scope.source) && (model?.ads?.[scope.source]?.length || 0) > 1;
  const items = byAd
    ? model.ads[scope.source].map((a) => ({ key: a.key, label: a.label, color: SOURCES.find((x) => x.key === scope.source)?.color, steps: a.steps, pick: { source: scope.source, ad: a.key } }))
    : SOURCES.map((x) => ({ key: x.key, label: x.label, color: x.color, steps: Object.fromEntries(Object.entries(g).map(([st, c]) => [st, c?.[x.key] || 0])), pick: { source: x.key, ad: null } }));
  const rows = items.map((it) => ({ ...it, r: split(it.steps, stage) })).filter((it) => it.r.placed > 0)
    .sort((a, b) => b.r.done - a.r.done || b.r.placed - a.r.placed);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((x) => x.r.placed));
  const active = (it) => (byAd ? scope.ad === it.key : scope.source === it.key);
  return (
    <section className="ps2-card ps2-shows" aria-labelledby="ps2-shows-title">
      <div className="ps2-card-head">
        <h2 id="ps2-shows-title">{byAd ? 'Shows par pub' : 'Shows par canal'}</h2>
        <div className="ps2-segment" role="group" aria-label="Rendez-vous">
          {[['r1', 'R1'], ['r2', 'R2']].map(([k, l]) => <button type="button" key={k} aria-pressed={stage === k} onClick={() => setStage(k)}>{l}</button>)}
        </div>
      </div>
      <div className="ps2-shows-rows" role="list">
        {rows.map((it, i) => (
          <Motion.div key={`${stage}-${it.key}`} role="listitem" className={`ps2-shows-row${active(it) ? ' is-on' : ''}`}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.04 }}>
            <button type="button" className="ps2-shows-name" onClick={() => onPick(active(it) ? { source: byAd ? scope.source : null, ad: null } : it.pick)}
              aria-pressed={active(it)}>
              <i style={{ background: it.color }} />{it.label}
            </button>
            <Info className="ps2-shows-bar" label={`${it.label}, ${stage.toUpperCase()}, détail`}
              detail={<Detail kicker={`${stage.toUpperCase()} · ${it.label}`} value={`${fr(it.r.placed)} posés`}
                rows={PARTS.map(([k]) => [LABEL[k], fr(it.r[k]), k === 'done' ? 'ps2-strong' : ''])}
                lines={[`Présence : ${fr(it.r.done)} ÷ (${fr(it.r.done)} + ${fr(it.r.noshow)}) = ${it.r.presence ?? '–'} %`]} />}>
              <span className="ps2-shows-track" style={{ width: `${(it.r.placed / max) * 100}%` }}>
                {PARTS.map(([k, color], j) => (
                  <Motion.i key={k} style={{ background: color }} initial={{ width: 0 }}
                    animate={{ width: drawn ? `${(it.r[k] / Math.max(1, it.r.placed)) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.04 + j * 0.06 }} />
                ))}
              </span>
            </Info>
            <span className="ps2-shows-done ps2-num"><b>{fr(it.r.done)}</b><small>/ {fr(it.r.placed)}</small></span>
            <span className={`ps2-shows-pres ps2-num${it.r.presence == null ? '' : it.r.presence >= 70 ? ' is-good' : it.r.presence >= 50 ? ' is-mid' : ' is-low'}`}>
              {it.r.presence == null ? '–' : `${it.r.presence} %`}
            </span>
          </Motion.div>
        ))}
      </div>
      <div className="ps2-compo-legend" style={{ marginTop: 14 }}>
        {PARTS.map(([k, color]) => <span key={k}><i style={{ background: color }} />{LABEL[k]}</span>)}
        <span className="ps2-soft" style={{ marginLeft: 'auto' }}>effectués / posés · présence</span>
      </div>
    </section>
  );
}
