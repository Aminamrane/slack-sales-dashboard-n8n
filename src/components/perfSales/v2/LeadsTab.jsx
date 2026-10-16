import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal } from '../motion';
import { dm, fr } from './model';
import { AFFECTED_FATES, reasonOf } from './intakeData';
import { loadIntake } from './intakeApi';
import { CHANNELS } from './flowData';
import LeadHistoryPanel from './LeadHistory';
import { ReasonIcon } from './IntakeLeads';

// Onglet « Leads » (dev 16/10/2026 : « un endroit où on peut vraiment checker cet historique : pour chaque lead arrivé
// dans le pipe, son historique ; les leads d'octobre par défaut, puis l'antériorité »). Les fiches du mois, classées
// par le même calcul que le schéma de l'onglet Canaux, et les leads plus anciens repris du pool dans le mois. Une ligne
// ouvre l'historique du lead.

const STAGE = { none: 'Aucun RDV', r1_set: 'R1 posé', r1_done: 'R1 effectué', r2_set: 'R2 posé', r2_done: 'R2 effectué', signed: 'Signé' };
const PAGE = 40;
const shift = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => new Date().toISOString().slice(0, 7);
const FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthName = (ym) => FULL[Number(ym.slice(5, 7)) - 1];
const of = (name) => (/^[aeiouéè]/.test(name) ? `d’${name}` : `de ${name}`);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Les vues : chaque tuile filtre la liste.
const VIEWS = [
  ['all', 'Fiches reçues', (r) => r.fate !== 'older_pool'],
  ['affected', 'Affectées', (r) => r.channel === 'ads' && AFFECTED_FATES.includes(r.fate)],
  ['kept', 'Gardées', (r) => r.channel === 'ads' && AFFECTED_FATES.includes(r.fate) && r.departure === 'kept'],
  ['sla', '6 min ratées', (r) => r.channel === 'ads' && AFFECTED_FATES.includes(r.fate) && (r.departure === 'sla_given' || r.departure === 'sla_pool')],
  ['barrier', '3 jours sans RDV', (r) => r.channel === 'ads' && AFFECTED_FATES.includes(r.fate) && r.departure === 'barrier'],
  ['never', 'Jamais données', (r) => String(r.fate).startsWith('not_given')],
  ['older', 'Anciens repris', (r) => r.fate === 'older_pool'],
];

function Select({ label, value, options, onChange }) {
  return (
    <label className="ps2-leads-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Tous</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function LeadsTab({ period, dark }) {
  const start = /^\d{4}-\d{2}$/.test(period || '') ? period : thisMonth();
  const [ym, setYm] = useState(start);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState('affected');
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [engine, setEngine] = useState('');
  const [now, setNow] = useState('');
  const [stage, setStage] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(null);
  useEffect(() => { setYm(start); }, [start]);
  useEffect(() => {
    let alive = true;
    setData(null); setError(false); setLimit(PAGE);
    loadIntake(ym).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [ym]);
  const close = useCallback(() => setOpen(null), []);

  const rows = useMemo(() => (data ? [...data.leads, ...data.older] : []), [data]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map(([k, , f]) => [k, rows.filter(f).length])), [rows]);
  const pick = VIEWS.find(([k]) => k === view)?.[2] || (() => true);
  const words = norm(q).split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => pick(r) && (!channel || r.channel === channel) && (!engine || r.engine === engine)
    && (!now || (r.now || 'au pool') === now) && (!stage || r.stage === stage)
    && (!words.length || words.every((w) => norm(`${r.id} ${r.name} ${r.company} ${r.origin}`).includes(w))))
    .sort((a, b) => (b.received || '').localeCompare(a.received || '') || b.id - a.id);
  const options = (key) => [...new Set(rows.filter(pick).map(key).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => [v, v]);
  const label = monthName(ym);
  const isLast = ym >= thisMonth();

  return (
    <div className="ps2-grid">
      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-leads-title">
        <Motion.div className="ps2-card-head" variants={ITEM}>
          <h2 id="ps2-leads-title">Leads {of(label)} {ym.slice(0, 4)}</h2>
          <span className="ps2-leads-month" role="group" aria-label="Mois">
            <button type="button" onClick={() => setYm((v) => shift(v, -1))} aria-label="Mois précédent">‹</button>
            <AnimatePresence mode="popLayout" initial={false}>
              <Motion.b key={ym} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
                {label} {ym.slice(0, 4)}</Motion.b>
            </AnimatePresence>
            <button type="button" onClick={() => setYm((v) => shift(v, 1))} disabled={isLast} aria-label="Mois suivant">›</button>
          </span>
        </Motion.div>

        <Motion.div variants={ITEM} className="ps2-leads-views" role="tablist" aria-label="Vues">
          {VIEWS.map(([k, l]) => (
            <button type="button" key={k} role="tab" aria-selected={view === k} className={`ps2-leads-view${view === k ? ' is-on' : ''}`}
              onClick={() => { setView(k); setLimit(PAGE); setEngine(''); setNow(''); }}>
              {view === k && <Motion.span layoutId="ps2-leads-view-pill" className="ps2-leads-view-pill" transition={{ duration: 0.4, ease: EASE }} />}
              <b className="ps2-num">{data ? <CountUp value={counts[k]} duration={700} /> : '…'}</b>
              <span>{l}</span>
            </button>
          ))}
        </Motion.div>

        <Motion.div variants={ITEM} className="ps2-leads-filters">
          <label className="ps2-leads-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Nom, entreprise, n° de lead" aria-label="Rechercher un lead" />
          </label>
          <Select label="Canal" value={channel} onChange={setChannel} options={[...new Set(rows.map((r) => r.channel))].map((c) => [c, CHANNELS[c]?.label || c])} />
          <Select label="Affecté à" value={engine} onChange={setEngine} options={options((r) => r.engine)} />
          <Select label="Aujourd’hui" value={now} onChange={setNow} options={options((r) => r.now || 'au pool')} />
          <Select label="Étape" value={stage} onChange={setStage} options={Object.entries(STAGE)} />
        </Motion.div>

        {error && <p className="ps2-note" role="alert">Leads non chargés.</p>}
        {!data && !error && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
        {data && (
          <div className="ps2-leads-wrap">
            <table className="ps2-dossiers ps2-intake-table ps2-leads-table">
              <thead><tr><th>Lead</th><th>Reçu</th><th>Canal</th><th>Affecté à</th><th>Pourquoi parti</th><th>Aujourd’hui</th><th>Étape</th></tr></thead>
              <tbody>
                {shown.slice(0, limit).map((r, i) => {
                  const why = reasonOf(r);
                  const ch = CHANNELS[r.channel] || CHANNELS.other;
                  return (
                    <Motion.tr key={r.id} className="ps2-intake-row" tabIndex={0} onClick={() => setOpen(r)} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 20) * 0.015 }}>
                      <td><span className="ps2-intake-ref">#{r.id}{r.fate === 'older_pool' ? ' · ancien' : ''}</span><span className="ps2-intake-name">{r.name || '–'}</span>
                        {r.company && <span className="ps2-soft ps2-intake-co">{r.company}</span>}</td>
                      <td className="ps2-num">{r.received ? dm(r.received) : '–'}</td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="ps2-swatch" style={{ background: ch.color }} />{ch.label}</span></td>
                      <td>{r.engine || <span className="ps2-muted">{String(r.fate).startsWith('not_given') ? 'jamais donnée' : '–'}</span>}</td>
                      <td>{r.engine ? (
                        <div className="ps2-intake-why"><span className="ps2-intake-why-tag" style={{ '--c': why.color }}><ReasonIcon kind={why.icon} />{why.label}</span>
                          {why.notes.map((n) => <span key={n} className="ps2-intake-why-note">{n}</span>)}</div>
                      ) : <span className="ps2-muted">–</span>}</td>
                      <td>{r.now ? <b style={{ fontWeight: 600 }}>{r.now}</b>
                        : <span className="ps2-tag is-warn" style={{ marginLeft: 0 }}>{r.opt_out ? 'retiré du pool' : r.engine || r.previous ? 'au pool' : 'personne'}</span>}</td>
                      <td><span className={`ps2-intake-stage is-${r.stage}`}>{STAGE[r.stage] || r.stage}</span></td>
                    </Motion.tr>
                  );
                })}
              </tbody>
            </table>
            {!shown.length && <p className="ps2-note">Aucun lead.</p>}
            {shown.length > limit && (
              <button type="button" className="ps2-ghost-btn ps2-leads-more" onClick={() => setLimit((n) => n + PAGE * 2)}>
                Afficher {fr(Math.min(PAGE * 2, shown.length - limit))} de plus · {fr(shown.length)} au total</button>
            )}
          </div>
        )}
      </Reveal>
      <LeadHistoryPanel lead={open} dark={dark} onClose={close} />
    </div>
  );
}

