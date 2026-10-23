import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import { AD_SOURCES, SOURCES, fr } from './model';

// Qui fait nos shows (dev 15/10/2026 : « voir quels canaux d'acquisition font le plus de nos shows ») : chaque canal, ou
// chaque pub du canal ADS choisi, avec ses RDV posés du mois découpés en effectués, absents, annulés, pas qualifiés et
// à venir (mêmes couleurs que les cartes), et son taux de show. Classés par RDV effectués ; un clic filtre les cartes.
// Taux de show (dev 23/10/2026 : « les stats doivent parler d'elles-mêmes » ; l’acquisition lisait 47 / 113 à côté de 56 %) :
// effectués ÷ (effectués + absents + annulés), les RDV passés dont l'issue est connue, un annulé comptant contre la pub.
// La fraction affichée est celle du pourcentage. Pas qualifiés et à venir restent dans la barre, hors calcul ; la
// présence des anneaux R1/R2 (effectués ÷ (effectués + absents)) est rappelée dans le détail au clic.
const PARTS = [['done', '#2c6448'], ['noshow', '#c2410c'], ['cancelled', '#c9a66b'], ['open', '#cfd5df'], ['upcoming', '#9fb3df']];
const LABEL = { done: 'effectués', noshow: 'absents', cancelled: 'annulés', open: 'pas qualifiés', upcoming: 'à venir' };
const NB = '\u00a0';   // insécable : un calcul ne se coupe qu'entre ses termes, jamais entre un nombre et son libellé
const rate = (a, b) => (b ? Math.round((a / b) * 100) : null);
const pctText = (v) => (v == null ? '–' : `${v}${NB}%`);
const tone = (v) => (v == null ? ' is-none' : v >= 70 ? ' is-good' : v >= 50 ? ' is-mid' : ' is-low');

function split(steps, s) {
  const g = (k) => Number(steps?.[k] || 0);
  const placed = g(s), due = g(`${s}_due`), done = g(`${s}_done_due`), open = g(`${s}_open`), noshow = g(`${s}_noshow`);
  const cancelled = Math.max(0, due - done - open - noshow);
  // Somme des trois issues plutôt que due − open : le dénominateur est toujours celui que le détail additionne.
  const decided = done + noshow + cancelled;
  return { placed, done, noshow, open, cancelled, upcoming: Math.max(0, placed - due), decided,
    show: rate(done, decided), presence: rate(done, done + noshow) };
}

function RowDetail({ it, stage }) {
  const { r } = it;
  const name = stage.toUpperCase();
  const done = fr(r.done);
  return (
    <Detail kicker={`${name} · ${it.label}`} value={`${fr(r.placed)} posés`}
      rows={PARTS.map(([k]) => [LABEL[k], fr(r[k]), k === 'done' ? 'ps2-strong' : ''])}
      lines={[
        `Show : ${done} ÷ (${done} + ${fr(r.noshow)}${NB}absents + ${fr(r.cancelled)}${NB}annulés) =${NB}${pctText(r.show)}`,
        r.open || r.upcoming ? `Hors calcul : ${fr(r.open)}${NB}pas${NB}qualifiés, ${fr(r.upcoming)}${NB}à${NB}venir` : null,
        `Présence (règle de l'anneau ${name}) : ${[done, '÷', `(${done}`, '+', `${fr(r.noshow)})`, '=', pctText(r.presence)].join(NB)}`,
      ]} />
  );
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
            <Info className="ps2-shows-bar" label={`${it.label}, ${stage.toUpperCase()}, détail`} detail={<RowDetail it={it} stage={stage} />}>
              <span className="ps2-shows-track" style={{ width: `${(it.r.placed / max) * 100}%` }}>
                {PARTS.map(([k, color], j) => (
                  <Motion.i key={k} style={{ background: color }} initial={{ width: 0 }}
                    animate={{ width: drawn ? `${(it.r[k] / Math.max(1, it.r.placed)) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.04 + j * 0.06 }} />
                ))}
              </span>
            </Info>
            <span className="ps2-shows-done ps2-num"><b>{fr(it.r.done)}</b><small>/ {fr(it.r.decided)}</small></span>
            <Info className={`ps2-shows-pres ps2-num${tone(it.r.show)}`} label={`${it.label}, ${stage.toUpperCase()}, taux de show ${pctText(it.r.show)}, détail`}
              detail={<RowDetail it={it} stage={stage} />}>
              {pctText(it.r.show)}
            </Info>
          </Motion.div>
        ))}
      </div>
      <div className="ps2-compo-legend" style={{ marginTop: 14 }}>
        {PARTS.map(([k, color]) => <span key={k}><i style={{ background: color }} />{LABEL[k]}</span>)}
        <span className="ps2-soft" style={{ marginLeft: 'auto' }}>effectués / RDV passés qualifiés · taux de show</span>
      </div>
    </section>
  );
}
