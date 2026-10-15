import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { CountUp, EASE, ITEM, Reveal, useDrawn, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import EngineCards from './EngineCards';
import { PeriodBar } from './Reactivity';
import { dm, fr, initials } from './model';

// Onglet Auto-affectation (dev 14/10/2026 : « l'auto-affectation setter et l'auto-affectation sales, deux types, qu'on
// puisse sélectionner une période ; propre, clean, dans le même style »). Deux vues : le moteur qui distribue les leads
// ADS aux sales (catégories d'effectif, équité, écartés, ratés des 6 minutes) et l'attribution des RDV posés par les
// setters (raison : prioritaire, préférence, équité, déjà suivi ; ce que le RDV est devenu).
const SALES_PARTS = [['assigned', 'Affectés', '#1e3a7b'], ['excluded_small', '< 100 k€', '#9fb3df'], ['duplicate_skipped', 'Doublons', '#b8c0cf'], ['non_classifiable', 'Sans effectif', '#64748b']];
const VIEWS = [['sales', 'Leads ADS → sales'], ['setters', 'RDV setters → sales']];
const CAT_COLORS = ['#cfdaf0', '#9fb3df', '#7f9ad9', '#3d5ba8', '#1e3a7b'];
const REASONS = [['owner', 'Déjà suivi', '#1e3a7b'], ['priority', 'Prioritaire', '#3e7d5a'], ['preference', 'Préférence', '#d4834a'], ['equity', 'Équité', '#9fb3df']];
const STATES = [['held', 'Honorés', '#2c6448'], ['no_show', 'No-show', '#c2410c'], ['cancelled', 'Annulés', '#8a93a6'], ['moved', 'Déplacés', '#b8c0cf'], ['to_qualify', 'À qualifier', '#6b7a99'], ['upcoming', 'À venir', '#9fb3df']];

function periodQuery(period, month) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const back = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const base = /^\d{4}-\d{2}$/.test(month || '') ? month : today.slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  if (period.key === 'month') return `period=${base}`;
  if (period.key === '7d') return `start=${back(6)}&end=${today}`;
  if (period.key === '30d') return `start=${back(29)}&end=${today}`;
  if (period.key === 'prev') return `period=${prev}`;
  return period.start && period.end && period.start <= period.end ? `start=${period.start}&end=${period.end}` : null;
}

export default function AutoAssignTab({ month, avatarFor }) {
  const [view, setView] = useState('sales');
  const [period, setPeriod] = useState({ key: 'month' });
  const [state, setState] = useState({ data: null, loading: true, error: false });
  useEffect(() => {
    const q = periodQuery(period, month);
    if (!q) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    apiClient.get(`/api/v1/monitoring/performance/v2/auto-assign?${q}`)
      .then((data) => alive && setState({ data, loading: false, error: false }))
      .catch(() => alive && setState({ data: null, loading: false, error: true }));
    return () => { alive = false; };
  }, [period, month]);
  const data = state.data;
  const analytics = data ? { period: { start: data.start, end: shiftDay(data.end, 1) } } : null;
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12 ps2-autobar">
        <div className="ps2-switch" role="tablist" aria-label="Auto-affectation">
          {VIEWS.map(([k, l]) => (
            <button type="button" key={k} role="tab" aria-selected={view === k} className="ps2-switch-btn" onClick={() => setView(k)}>
              {view === k && <Motion.span layoutId="ps2-auto-switch" className="ps2-switch-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span>{l}</span>
            </button>
          ))}
        </div>
        <PeriodBar period={period} onPeriod={setPeriod} analytics={analytics} loading={state.loading} />
      </div>
      {state.error && <div className="ps2-span-12 ps2-empty" role="alert">Période non chargée</div>}
      {data && (
        <div className="ps2-span-12">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={`${view}-${data.start}-${data.end}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
              {view === 'sales' ? <SalesEngine d={{ ...data.sales, engine: data.engine }} avatarFor={avatarFor} /> : <SetterEngine d={data.setters} avatarFor={avatarFor} />}
            </Motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function shiftDay(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const todayParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const longDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const pctOf = (v, t) => (t ? `${fr((v / t) * 100, 0)} %` : '');

// Barres à traits (référence « Proposal Progress » du dev) : une colonne par part, filet de couleur à gauche, chiffre,
// part du total, puis une bande de traits qui se dessine. Chaque colonne ouvre son détail.
function TickBreakdown({ items, minCol = 112 }) {
  const on = useRevealed();
  const sum = items.reduce((a, x) => a + (x.value || 0), 0);
  const cols = items.map((x) => `minmax(${minCol}px, ${Math.max(x.value || 0, sum * 0.1, 1)}fr)`).join(' ');
  return (
    <div className="ps2-ticks" style={{ gridTemplateColumns: cols }}>
      {items.map((x, i) => (
        <Info key={x.key} className="ps2-ticks-col" style={{ '--c': x.color }} label={`${x.label} : ${x.value || 0}, détail`} detail={x.detail}>
          <span className="ps2-ticks-label">{x.label}</span>
          <b className="ps2-num"><CountUp value={x.value || 0} /></b>
          <small className="ps2-num">{pctOf(x.value || 0, sum)}</small>
          <span className="ps2-ticks-strip"><Motion.i initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={on ? { clipPath: 'inset(0 0% 0 0)' } : {}}
            transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.12 }} /></span>
        </Info>
      ))}
    </div>
  );
}

// Sucettes jour par jour (référence « Income Tracker ») : une tige par jour, colorée par part, le jour survolé (ou le
// plus chargé) mis en avant ; au clic, le détail du jour. Au-delà de 45 jours, une sucette par semaine.
function Lollipops({ days, parts, title }) {
  const drawn = useDrawn();
  const uid = useId();
  const [hover, setHover] = useState(null);
  const today = todayParis();
  const shown = days.filter((d) => d.day <= today);
  const series = shown.length > 45 ? byWeek(shown, parts) : shown.map((d) => ({ ...d, label: String(Number(d.day.slice(8))), name: longDay(d.day) }));
  const totals = series.map((d) => parts.reduce((a, [k]) => a + (d[k] || 0), 0));
  const max = Math.max(1, ...totals);
  const active = hover ?? totals.indexOf(Math.max(...totals));
  return (
    <div className="ps2-lolli" role="group" aria-label={title}>
      {series.map((d, i) => {
        const t = totals[i];
        const wd = new Date(`${d.day}T12:00:00Z`).getUTCDay();
        return (
          <Info key={d.day} className={`ps2-lolli-col${i === active ? ' is-on' : ''}${!d.week && (wd === 0 || wd === 6) ? ' is-we' : ''}`} label={`${d.name} : ${t}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            detail={<Detail kicker={d.name} title={title} value={fr(t)} rows={parts.map(([k, l]) => [l, d[k] ? `${fr(d[k])} · ${pctOf(d[k], t)}` : '0'])} />}>
            {i === active && <Motion.span layoutId={`${uid}-cap`} className="ps2-lolli-cap" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
            <span className="ps2-lolli-plot">
              <span className="ps2-lolli-stem" style={{ height: drawn ? `${(t / max) * 100}%` : 0, transitionDelay: `${Math.min(i * 22, 600)}ms` }}>
                {parts.map(([k, , c]) => (d[k] ? <i key={k} style={{ flexGrow: d[k], background: c }} /> : null))}
                {t > 0 && <b className="ps2-lolli-dot" />}
                {i === active && t > 0 && <span className="ps2-lolli-tipwrap"><Motion.em layoutId={`${uid}-tip`} className="ps2-lolli-tip ps2-num"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}>{t}</Motion.em></span>}
              </span>
            </span>
            <span className={`ps2-lolli-day${d.week ? ' is-week' : ''}`}>{d.label}</span>
          </Info>
        );
      })}
    </div>
  );
}

function byWeek(days, parts) {
  const weeks = [];
  for (const d of days) {
    const wd = (new Date(`${d.day}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (!weeks.length || wd === 0) weeks.push({ day: d.day, week: true, label: dm(d.day), name: `Semaine du ${longDay(d.day)}` });
    const w = weeks[weeks.length - 1];
    for (const [k] of parts) w[k] = (w[k] || 0) + (d[k] || 0);
  }
  return weeks;
}

function Legend({ parts }) {
  return <span className="ps2-compo-legend" style={{ marginTop: 0 }}>{parts.map(([k, l, c]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</span>;
}

function SalesEngine({ d, avatarFor }) {
  const on = useRevealed();
  const t = d.totals;
  const cats = Object.entries(d.categories || {});
  const max = Math.max(1, ...d.people.flatMap((p) => cats.map(([c]) => p.cats[c] || 0)));
  const maxTotal = Math.max(1, ...d.people.map((p) => p.total));
  const L = d.leads;
  const fates = d.fates || {};
  if (!t.seen) return <div className="ps2-empty">Aucun lead ADS passé par le moteur sur la période</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-auto-seen">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-seen">Leads ADS vus par le moteur</h2><b className="ps2-auto-total ps2-num"><CountUp value={t.seen} /></b></Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown items={[
            { key: 'assigned', label: 'Affectés', value: t.assigned, color: '#1e3a7b', detail: <Detail kicker="Affectés par le moteur" value={fr(t.assigned)}
              rows={L ? [['Leads distincts', fr(L.leads)], ['Clean · tél FR, 100 k€ et +', fr(L.clean)], ['Tél non FR', fr(L.non_fr)], ['Moins de 100 k€ sur la fiche', fr(L.u100)], ['Reçus avant la période', fr(L.before)]] : []}
              source="Funnel Leads ne compte que les leads clean reçus sur la période" /> },
            { key: 'small', label: '< 100 k€', value: t.excluded_small, color: '#9fb3df', detail: <Detail kicker="Écartés" title="Moins de 100 k€ déclaré" value={fr(t.excluded_small)} rows={[['Distribués', '0']]} /> },
            { key: 'dup', label: 'Doublons', value: t.duplicate_skipped, color: '#b8c0cf', detail: <Detail kicker="Écartés" title="Contact déjà reçu" value={fr(t.duplicate_skipped)} rows={[['Distribués', '0']]} /> },
            { key: 'nc', label: 'Sans effectif', value: t.non_classifiable, color: '#64748b', detail: <Detail kicker="Écartés" title="Effectif inconnu" value={fr(t.non_classifiable)} rows={[['Distribués', '0']]} /> },
          ]} /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-auto-fate">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-fate">Où sont-ils aujourd’hui</h2>
            <Info className="ps2-auto-missed" label="Ratés des 6 minutes, détail"
              detail={<Detail kicker="Règle des 6 minutes" title="Ratés sur la période" value={fr(t.missed)} rows={d.people.filter((p) => p.missed).map((p) => [p.name, fr(p.missed)])} />}>
              <span>Ratés 6 min</span><b className="ps2-num">{fr(t.missed)}</b></Info></Motion.div>
          {L && <Motion.div variants={ITEM}><TickBreakdown minCol={96} items={[
            { key: 'kept', label: 'Chez le même sales', value: L.kept, color: '#2c6448', detail: <Detail kicker="Toujours chez le sales affecté" value={fr(L.kept)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
            { key: 'moved', label: 'Chez un autre', value: L.moved, color: '#3d5ba8', detail: <Detail kicker="Repris ou réaffectés" value={fr(L.moved)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
            { key: 'pool', label: 'Au pool', value: L.pool, color: '#c2410c', detail: <Detail kicker="Sans sales aujourd’hui" value={fr(L.pool)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
          ]} /></Motion.div>}
        </Reveal>
      </div>
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-sales">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-sales">Par sales et par effectif</h2></Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable" style={{ '--c': '#1e3a7b', minWidth: 900 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Sales</th>{cats.map(([c, l]) => <th key={c}>{l} sal.</th>)}<th className="is-key" style={{ textAlign: 'left', width: 200 }}>Donnés</th><th>Gardés</th></tr></thead>
            <tbody>
              {d.people.map((p, i) => (
                <Motion.tr key={p.name} initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.03 }}>
                  <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={p.name} url={avatarFor?.(p.name)} /><span>{p.name}</span>
                    {fates[p.name]?.missed > 0 && <span className="ps2-lost is-missed" title="Leads repartis après un raté des 6 minutes">−{fates[p.name].missed} raté{fates[p.name].missed > 1 ? 's' : ''}</span>}
                    {fates[p.name]?.pool > 0 && <span className="ps2-lost" title="Leads partis au pool">−{fates[p.name].pool} pool</span>}</span></td>
                  {cats.map(([c]) => {
                    const v = p.cats[c] || 0;
                    return <td key={c}>{v ? <span className={`ps2-cb-chip${v / max > 0.5 ? ' is-strong' : ''}`} style={{ '--c': '#1e3a7b', '--a': `${Math.round(10 + 80 * (v / max))}%` }}>{v}</span>
                      : <span className="ps2-muted">·</span>}</td>;
                  })}
                  <td className="is-key" style={{ textAlign: 'left' }}><span className="ps2-ctable-sales"><span className="ps2-ctable-bar" style={{ width: 110 }}><Motion.i initial={{ width: 0 }}
                    animate={{ width: on ? `${(p.total / maxTotal) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.03 }} /></span><b className="ps2-num">{fr(p.total)}</b></span></td>
                  <td><Kept name={p.name} f={fates[p.name]} events={p.missed} /></td>
                </Motion.tr>
              ))}
              <tr className="is-total">
                <td style={{ textAlign: 'left' }}>
                  <Info className="ps2-link" label="Écart d’équité, détail" style={{ color: 'var(--ink)' }}
                    detail={<Detail kicker="Écart d’équité" lines={['Écart entre le sales qui a reçu le plus et celui qui a reçu le moins de leads de la catégorie sur la période, parmi ceux qui en ont reçu.', 'Le moteur rattrape les écarts au fil des affectations (crédits).']} />}>Écart max - min</Info>
                </td>
                {cats.map(([c]) => <td key={c} className={d.spread[c] >= 5 ? 'ps2-low' : ''}>{fr(d.spread[c])}</td>)}
                <td className="is-key" style={{ textAlign: 'left' }}>{fr(t.assigned)}</td><td>{fr(Object.values(fates).reduce((a, f) => a + f.kept, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>
      {d.engine && <div className="ps2-grid"><EngineCards e={d.engine} avatarFor={avatarFor} /></div>}
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-days">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-days">Jour par jour</h2><Legend parts={SALES_PARTS} /></Motion.div>
        <Motion.div variants={ITEM}><Lollipops days={d.days} parts={SALES_PARTS} title="Leads ADS vus par le moteur" /></Motion.div>
      </Reveal>
    </div>
  );
}

// Gardés = colonne « Leads » de l'onglet Réactivité (même population). Le pont, au clic, part des leads donnés par le
// moteur (dev 14/10/2026 : « Gary, 42 ici et 32 en réactivité : il faut qu'on comprenne pourquoi, à côté du nom »).
function Kept({ name, f, events }) {
  if (!f) return <span className="ps2-muted">–</span>;
  const others = Math.max(0, (events || 0) - f.missed);
  return (
    <Info className="ps2-link" label={`${name}, leads gardés, détail`} style={{ fontWeight: 650 }}
      detail={<Detail kicker={name} title="Leads gardés" value={fr(f.kept)}
        rows={[['Donnés par le moteur', fr(f.engine)], ['Repartis après un raté des 6 min', f.missed ? `−${fr(f.missed)}` : '0', f.missed ? 'ps2-low' : ''],
          ['Partis au pool (3 jours sans RDV, rappel)', f.pool ? `−${fr(f.pool)}` : '0'], f.other ? ['Autres (réaffectés, reçus avant la période)', `−${fr(f.other)}`] : null,
          f.from_peers ? ['Reçus après le raté d’un collègue', `+${fr(f.from_peers)}`, 'ps2-good'] : null, f.manual ? ['Affectés à la main', `+${fr(f.manual)}`] : null,
          ['Gardés (Réactivité, colonne Leads)', fr(f.kept)]]}
        lines={others ? [`${fr(events)} ratés des 6 min sur la période, dont ${fr(others)} sur des leads reçus d’un collègue.`] : []} />}>
      {fr(f.kept)}
    </Info>
  );
}

function SetterEngine({ d, avatarFor }) {
  const on = useRevealed();
  const t = d.totals;
  const maxTotal = Math.max(1, ...d.people.map((p) => p.total));
  const maxSetter = Math.max(1, ...d.setters.map((s) => s.total));
  const presence = t.held + t.no_show ? (t.held / (t.held + t.no_show)) * 100 : null;
  const elig = new Map((d.eligibility?.people || []).map((p) => [p.name, p]));
  if (!t.total) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {d.eligibility && <Eligibility e={d.eligibility} avatarFor={avatarFor} />}
      <div className="ps2-empty">Aucun RDV setter attribué sur la période</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {d.eligibility && <Eligibility e={d.eligibility} avatarFor={avatarFor} />}
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-auto-why">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-why">RDV setters attribués</h2><b className="ps2-auto-total ps2-num"><CountUp value={t.total} /></b></Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown minCol={92} items={REASONS.map(([k, l, c]) => ({ key: k, label: l, value: t[k], color: c,
            detail: <Detail kicker="Raison de l’attribution" title={l} value={fr(t[k])} rows={d.people.filter((p) => p[k]).map((p) => [p.name, fr(p[k])])} /> }))} /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-auto-became">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-became">Ce que les RDV sont devenus</h2>
            {presence != null && <Info className="ps2-auto-missed is-good" label="Présence, détail"
              detail={<Detail kicker="Présence" value={`${fr(presence, 0)} %`} lines={[`${fr(t.held)} honorés ÷ (${fr(t.held)} honorés + ${fr(t.no_show)} no-show)`]} />}>
              <span>Présence</span><b className="ps2-num">{fr(presence, 0)} %</b></Info>}</Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown minCol={88} items={STATES.map(([k, l, c]) => ({ key: k, label: l, value: t[k], color: c,
            detail: <Detail kicker="RDV" title={l} value={fr(t[k])} rows={d.people.filter((p) => p[k]).map((p) => [p.name, fr(p[k])])} /> }))} /></Motion.div>
        </Reveal>
      </div>
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-auto-sdays">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-sdays">Jour par jour</h2><Legend parts={REASONS} /></Motion.div>
          <Motion.div variants={ITEM}><Lollipops days={d.days} parts={REASONS} title="RDV setters attribués" /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-auto-setters">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-setters">Setters</h2></Motion.div>
          <div className="ps2-vbars">
            {d.setters.map((s, i) => (
              <div key={s.name} className="ps2-vbars-row" style={{ gridTemplateColumns: '180px minmax(0, 1fr) 36px' }}>
                <span className="ps2-vbars-label"><Face name={s.name} url={avatarFor?.(s.name)} /><span>{s.name}</span></span>
                <span className="ps2-vbars-track"><Motion.i initial={{ width: 0 }} animate={{ width: on ? `${(s.total / maxSetter) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.06 }} style={{ background: '#2c6448' }} /></span>
                <b className="ps2-num">{fr(s.total)}</b>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-ssales">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-ssales">Par sales</h2>
          <Legend parts={REASONS} /></Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable" style={{ '--c': '#2c6448', minWidth: 900 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Sales</th><th style={{ textAlign: 'left', width: 220 }}>Raison de l’attribution</th><th className="is-key">RDV</th>
              <th style={{ textAlign: 'left', width: 200 }}>Devenus</th><th>Honorés</th><th>No-show</th><th>À venir</th></tr></thead>
            <tbody>
              {d.people.map((p, i) => (
                <Motion.tr key={p.name} initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.03 }}>
                  <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={p.name} url={avatarFor?.(p.name)} /><span>{p.name}</span>
                    {elig.get(p.name) && !elig.get(p.name).eligible && <span className="ps2-tag">non éligible</span>}</span></td>
                  <td style={{ textAlign: 'left' }}><Stack parts={REASONS.map(([k, l, c]) => ({ key: k, label: l, color: c, value: p[k] }))} width={(p.total / maxTotal) * 200} /></td>
                  <td className="is-key"><b>{fr(p.total)}</b></td>
                  <td style={{ textAlign: 'left' }}><Stack parts={STATES.map(([k, l, c]) => ({ key: k, label: l, color: c, value: p[k] }))} width={160} /></td>
                  <td>{fr(p.held)}</td><td className={p.no_show ? 'ps2-low' : 'ps2-muted'}>{fr(p.no_show)}</td><td>{fr(p.upcoming)}</td>
                </Motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

// Éligibles aux RDV setters (dev 15/10/2026 : « au moins 5 ventes sur un mois, peu importe le mois » ; « mettre à jour la
// page Perf Sales avec les sales qui sont éligibles, automatiquement ») : la règle du moteur, lue par le serveur.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthText = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : null);

function Eligibility({ e, avatarFor }) {
  const on = useRevealed();
  const rule = (
    <Detail kicker="RDV setters" title="Qui peut en recevoir" lines={[
      `Au moins un mois calendaire avec ${e.min} ventes déclarées, n’importe quel mois (mois de la déclaration), recalculé à chaque RDV.`,
      'Depuis le 15 octobre : un lead déjà suivi reste à son sales ; une seconde chance passe par l’auto-affectation, jamais chez son propriétaire historique.',
      'Un agenda non synchronisé empêche de recevoir, même éligible.']} />
  );
  return (
    <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-elig">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-auto-elig">Éligibles aux RDV setters</h2>
        <Info className="ps2-elig-count" label="Règle d’éligibilité" detail={rule}>
          <b className="ps2-auto-total ps2-num"><CountUp value={e.eligible} /></b><span className="ps2-num">/ {fr(e.people.length)}</span>
        </Info>
      </Motion.div>
      <div className="ps2-elig-grid">
        {e.people.map((p, i) => {
          const blocked = p.eligible && !p.calendar;
          const detail = (
            <Detail kicker="RDV setters" title={p.name} value={p.eligible ? (blocked ? 'Éligible, agenda à synchroniser' : 'Éligible') : 'Pas encore'}
              rows={[['Meilleur mois', p.best_month ? `${monthText(p.best_month)} · ${fr(p.best)} vente${p.best > 1 ? 's' : ''}` : 'aucune vente'],
                ['Mois à ' + e.min + ' ventes ou plus', fr(p.proven_months.length)],
                ...(p.proven_months.length ? [['Dernier', monthText(p.proven_months[p.proven_months.length - 1])]] : []),
                ['Ventes déclarées au total', fr(p.total)], ['Agenda synchronisé', p.calendar ? 'oui' : 'non']]} />
          );
          return (
            <Info key={p.name} as="motion" className={`ps2-elig${p.eligible ? ' is-in' : ''}${blocked ? ' is-blocked' : ''}`} label={`${p.name}, détail`} detail={detail}
              initial={{ opacity: 0, y: 8 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, ease: EASE, delay: 0.05 + i * 0.035 }}>
              <Face name={p.name} url={avatarFor?.(p.name)} />
              <span className="ps2-elig-name">{p.name}</span>
              <span className="ps2-elig-pips" aria-hidden="true">
                {Array.from({ length: e.min }, (_, k) => (
                  <Motion.i key={k} initial={{ scale: 0.4, opacity: 0 }} animate={on ? { scale: 1, opacity: 1 } : {}}
                    transition={{ duration: 0.35, ease: EASE, delay: 0.25 + i * 0.035 + k * 0.05 }} className={k < Math.min(p.best, e.min) ? 'is-on' : ''} />
                ))}
              </span>
              <span className={`ps2-elig-state ps2-num${p.eligible ? '' : ' is-out'}`}>{p.eligible ? (blocked ? 'sans agenda' : 'éligible') : `${fr(p.best)} / ${e.min}`}</span>
            </Info>
          );
        })}
      </div>
    </Reveal>
  );
}

function Stack({ parts, width }) {
  const on = useRevealed();
  const total = parts.reduce((a, x) => a + (x.value || 0), 0);
  if (!total) return <span className="ps2-muted">–</span>;
  return (
    <Info className="ps2-ministack" style={{ width: Math.max(24, width) }} label="Détail" detail={<Detail rows={parts.filter((x) => x.value).map((x) => [x.label, fr(x.value)])} />}>
      {parts.map((x, k) => (x.value ? <Motion.i key={x.key} style={{ background: x.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: on ? x.value : 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.2 + k * 0.05 }} title={`${x.label} : ${x.value}`} /> : null))}
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
