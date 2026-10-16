import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, Ring, reducedMotion, useDrawn, useRevealed } from '../motion';
import { CohortBars, Donut, FunnelFlow, FunnelPicker } from './charts';
import { Detail, Info, PopLayer } from './Pop';
import Studio from './Studio';
import TeamsTab from './TeamsTab';
import VerifyPanel from './VerifyPanel';
import WeeksBoard from './WeeksBoard';
import ChannelBoard from './ChannelBoard';
import AutoAssignTab from './AutoAssignTab';
import SettersTab from './SettersTab';
import VentesTab from './VentesTab';
import ChannelTable from './ChannelTable';
import ChannelFilter from './ChannelFilter';
import SalesKpis from './SalesKpis';
import ShowsByChannel from './ShowsByChannel';
import AdsFlow from './AdsFlow';
import { AffectedCard, IntakePanel, PoolReclaims } from './IntakeLeads';
import { FUNNEL, SOURCES, buildModel, byPersonForAd, dm, euro, fr, initials, scopeFigures, signedNum } from './model';
import TabIcon from './TabIcons';
import './v2.css';
import './v2-nav.css';

// Performance Sales v2 (dev 14/10/2026, maquette Claude Design validée : « let's go, meilleur SVG et cohérence ») :
// un tableau de bord dès l'arrivée (mois et actualisation dans l'en-tête, gros chiffres, frise des semaines), puis des
// onglets. La page ne montre que des chiffres et des schémas ; le détail de chaque information s'ouvre au clic (« je
// préfère le détail en pop-up plutôt que ce genre de remarque »), et chaque chiffre de l'entonnoir se vérifie jusqu'aux
// dossiers (panneau latéral).
const TABS = [
  ['overview', 'Vue d’ensemble'], ['channels', 'Canaux'], ['sales', 'Sales'], ['teams', 'Équipes'], ['rdv', 'Rendez-vous'], ['reactivity', 'Réactivité'],
  ['cohort', 'Cohorte'], ['ventes', 'Ventes'], ['setters', 'Setters'], ['auto', 'Auto-affectation'],
];
const CHECK = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
const ARROW = (up) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}</svg>;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const signedPct = (n) => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} %`);

// Mois et actualisation, dans l'en-tête (dev 14/10 : « cette partie-là, il y a une meilleure manière de l'intégrer »).
function Controls({ controls }) {
  if (!controls) return null;
  const current = controls.options.find((o) => o.value === controls.value);
  return (
    <span className="ps2-controls">
      <label className="ps2-month">
        <span>{current?.label || controls.value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        <select aria-label="Mois affiché" value={controls.value} onChange={(e) => controls.onChange(e.target.value)}>
          {controls.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <button type="button" className={`ps2-refresh${controls.loading ? ' is-loading' : ''}`} onClick={controls.onRefresh} disabled={controls.loading} aria-label="Actualiser" title="Actualiser">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
      </button>
    </span>
  );
}

function Hero({ model, onOpen, controls }) {
  const p = model.pilot;
  const sales = model.metrics.sales;
  const past = p && !p.days.remaining;
  const reach = p?.objective ? Math.round((sales.value / p.objective) * 100) : null;
  return (
    <Reveal as="section" className="ps2-hero-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-label="Résumé du mois">
      <div className="ps2-hero">
        <Motion.div variants={ITEM}>
          <div className="ps2-hero-line"><Controls controls={controls} />{p && <span className="ps2-mono">jour ouvré {p.days.elapsed} / {p.days.total}</span>}</div>
          <h1>Performance Sales</h1>
        </Motion.div>
        <Motion.div className="ps2-kpis" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.08 } } }}>
          <Kpi label="Ventes déclarées" onClick={() => onOpen('sales')}
            value={<><CountUp value={sales.value} />{p?.objective ? <small> / {p.objective}</small> : null}</>}
            note={sales.gap == null ? null : `${signedNum(sales.gap)} sur l'attendu (${fr(sales.expected)})`} tone={sales.gap == null ? '' : sales.gap >= 0 ? 'ps2-good' : 'ps2-low'} />
          <Kpi label="Signatures" onClick={() => onOpen('signed')} value={<CountUp value={model.metrics.signed.value} />}
            note={p?.signed?.undeclared ? `${p.signed.undeclared} à déclarer` : 'toutes déclarées'} tone="ps2-soft" />
          <Kpi label="CA déclaré" onClick={() => onOpen('sales')} value={<CountUp value={model.totals.total_revenue} format={euro} />}
            note={`cash ${euro(model.totals.total_cash)}`} tone="ps2-soft" />
          {past ? (
            <Kpi label="Objectif atteint" onClick={() => onOpen('sales')} value={reach == null ? '–' : <CountUp value={reach} format={(n) => `${Math.round(n)} %`} />}
              note={p?.objective ? `${sales.value} / ${p.objective}` : ''} tone="ps2-soft" />
          ) : (
            <Kpi label={p?.advance_days >= 0 ? 'Avance sur l’objectif' : 'Retard sur l’objectif'} onClick={() => onOpen('sales')}
              value={p?.advance_days == null ? '–' : <span className={p.advance_days >= 0 ? 'ps2-good' : 'ps2-low'}>
                <CountUp value={Math.abs(p.advance_days)} format={(n) => `${p.advance_days >= 0 ? '+' : '−'}${fr(n, 1)} j`} /></span>} />
          )}
        </Motion.div>
      </div>
      {p?.weeks?.length > 0 && <WeekTrack key={p.weeks[0].start} weeks={p.weeks} pace={p.objective ? p.objective / p.days.total : null} />}
    </Reveal>
  );
}

function Kpi({ label, value, note, tone, onClick }) {
  return (
    <Motion.button type="button" className="ps2-kpi" onClick={onClick} variants={ITEM} aria-label={`${label}, vérifier`}>
      <div className="ps2-kpi-label">{label}</div>
      <div className="ps2-kpi-value ps2-num">{value}</div>
      {note && <div className={`ps2-kpi-note ${tone}`}>{note}</div>}
    </Motion.button>
  );
}

// Frise des semaines (dev 14/10 : « ça, plus motion design et beau ») : le trait vert se trace jusqu'à la semaine en
// cours et chaque jalon se pose au moment où il l'atteint ; la semaine en cours porte un anneau rempli au prorata de ses
// jours ouvrés écoulés et un halo qui respire ; les chiffres défilent. Vert : au rythme de l'objectif (à 5 % près),
// orange : en dessous.
const RAIL_EASE = [0.45, 0, 0.2, 1];
const WEEK_CHECK = 'M4 12l5 5L20 6';   // tracée de gauche à droite

// Fraction de la durée à laquelle une courbe de Bézier atteint la progression f : jalons et trait restent synchrones.
function timeAt(f, [x1, y1, x2, y2]) {
  const bez = (s, a, b) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k += 1) { const s = (lo + hi) / 2; if (bez(s, y1, y2) < f) lo = s; else hi = s; }
  return bez((lo + hi) / 2, x1, x2);
}

const weekTone = (w, pace) => {
  if (w.state === 'future') return 'is-future';
  const perDay = w.per_day?.sales;
  return pace != null && perDay != null && perDay >= pace * 0.95 ? 'is-ok' : 'is-low';   // au rythme, à 5 % près
};

function WeekTrack({ weeks, pace }) {
  const on = useRevealed();
  const still = reducedMotion();
  const n = weeks.length;
  const cur = weeks.findIndex((w) => w.state === 'current');
  const reach = cur >= 0 ? cur : weeks.filter((w) => w.state !== 'future').length - 1;   // le trait s'arrête là
  const ref = weeks.find((w) => w.is_ref);
  const T0 = 0.3;
  const line = reach > 0 ? Math.min(1.7, 0.5 + 0.3 * reach) : 0;
  const arrive = (i) => (i <= reach ? T0 + (reach > 0 ? timeAt(i / reach, RAIL_EASE) * line : 0) : T0 + line + 0.1 + 0.09 * (i - reach - 1));
  const go = (delay, duration = 0.5, ease = EASE) => (still ? { duration: 0 } : { delay, duration, ease });
  const half = `${50 / n}%`;
  return (
    <Motion.div className={`ps2-wk${on ? ' is-on' : ''}`} style={{ '--n': n }} variants={ITEM}>
      <div className="ps2-wk-inner" role="list" aria-label="Semaines du mois">
        <div className="ps2-wk-rail" style={{ left: half, right: half }} aria-hidden="true">
          <Motion.i className="ps2-wk-base" initial={still ? false : { scaleX: 0 }} animate={{ scaleX: on ? 1 : 0 }} transition={go(0.1, 0.9)} />
          {reach > 0 && (
            <Motion.i className="ps2-wk-fill" style={{ width: `${(reach / Math.max(1, n - 1)) * 100}%` }}
              initial={still ? false : { scaleX: 0 }} animate={{ scaleX: on ? 1 : 0 }} transition={go(T0, line, RAIL_EASE)} />
          )}
        </div>
        {weeks.map((w, i) => {
          const tone = weekTone(w, pace);
          const at = arrive(i);
          const ms = Math.round((at + 0.12) * 1000);
          const perDay = w.per_day?.sales;
          const current = w.state === 'current';
          const body = (
            <>
              <WeekNode w={w} tone={tone} at={at} on={on} still={still} />
              <Motion.span className="ps2-wk-text" initial={still ? false : { opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={go(at + 0.06, 0.55)}>
                <span className="ps2-wk-title"><b>Semaine {i + 1}</b> · {current ? <em>en cours</em> : `${dm(w.start)} → ${dm(w.end)}`}</span>
                <span className={`ps2-wk-stat${current && tone === 'is-low' ? ' is-alert' : ''}`}>
                  {w.state === 'future' ? 'à venir' : (
                    <><b className="ps2-num"><CountUp value={w.sales} delay={ms} duration={900} /></b> vente{w.sales > 1 ? 's' : ''} · <span className="ps2-num">{perDay == null ? fr(perDay, 1) : <CountUp value={perDay} format={(x) => fr(x, 1)} delay={ms} duration={900} />}</span> / jour</>
                  )}
                </span>
              </Motion.span>
            </>
          );
          return (
            <div key={w.start} role="listitem" className="ps2-wk-col">
              {w.state === 'future' ? <div className={`ps2-wk-item ${tone}`}>{body}</div> : (
                <Info className={`ps2-wk-item ${tone}`} label={`Semaine ${i + 1}, détail`} detail={<WeekDetail w={w} i={i} pace={pace} ref_={ref} />}>{body}</Info>
              )}
            </div>
          );
        })}
      </div>
    </Motion.div>
  );
}

// Jalon d'une semaine : passée (coche verte, ou anneau orange sous le rythme), en cours (anneau de progression), à venir.
function WeekNode({ w, tone, at, on, still }) {
  const popIn = {
    initial: still ? false : { scale: 0.2, opacity: 0 },
    animate: on ? { scale: still ? 1 : [0.2, 1.14, 1], opacity: 1 } : { scale: 0.2, opacity: 0 },
    transition: still ? { duration: 0 } : { delay: at, duration: 0.55, ease: EASE, opacity: { delay: at, duration: 0.18 } },
  };
  if (w.state === 'future') {
    return (
      <Motion.span className="ps2-wk-node" initial={still ? false : { scale: 0.6, opacity: 0 }} animate={on ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        transition={still ? { duration: 0 } : { delay: at, duration: 0.5, ease: EASE }}>
        <span className="ps2-wk-dot is-future" />
      </Motion.span>
    );
  }
  if (w.state === 'current') {
    const share = w.business_days ? Math.max(0, Math.min(1, w.elapsed_days / w.business_days)) : 0;
    return (
      <Motion.span className="ps2-wk-node" {...popIn}>
        <span className={`ps2-wk-ring ${tone}`} style={{ '--halo-delay': `${(at + 1).toFixed(2)}s` }}>
          <i className="ps2-wk-halo" />
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <circle className="ps2-wk-ring-track" cx="16" cy="16" r="13" />
            <Motion.circle className="ps2-wk-ring-arc" cx="16" cy="16" r="13" transform="rotate(-90 16 16)"
              initial={still ? false : { pathLength: 0, opacity: 0 }} animate={on ? { pathLength: share, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={still ? { duration: 0 } : { delay: at + 0.2, duration: 0.95, ease: EASE, opacity: { delay: at + 0.2, duration: 0.05 } }} />
          </svg>
          <i className="ps2-wk-core" />
        </span>
      </Motion.span>
    );
  }
  return (
    <Motion.span className="ps2-wk-node" {...popIn}>
      <span className={`ps2-wk-dot ${tone}`}>
        {tone === 'is-ok' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <Motion.path d={WEEK_CHECK} initial={still ? false : { pathLength: 0, opacity: 0 }} animate={on ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={still ? { duration: 0 } : { delay: at + 0.16, duration: 0.4, ease: EASE, opacity: { delay: at + 0.16, duration: 0.05 } }} />
          </svg>
        ) : <i />}
      </span>
    </Motion.span>
  );
}

function WeekDetail({ w, i, pace, ref_ }) {
  const cmp = ref_ && ref_ !== w;
  const rows = [['leads', 'Leads'], ['r1e', 'R1 effectués'], ['r2e', 'R2 effectués'], ['signed', 'Signatures'], ['sales', 'Ventes']];
  return (
    <Detail kicker={`Semaine ${i + 1} · ${dm(w.start)} → ${dm(w.end)}`} title={`${w.elapsed_days} jour${w.elapsed_days > 1 ? 's' : ''} ouvré${w.elapsed_days > 1 ? 's' : ''}`}
      source={pace != null ? `Rythme de l’objectif : ${fr(pace, 1)} vente / jour` : null}>
      <table className="ps2-pop-table">
        <thead><tr><th /><th>Total</th><th>/ jour</th>{cmp && <th>vs {dm(ref_.start)}</th>}</tr></thead>
        <tbody>
          {rows.map(([k, l]) => (
            <tr key={k}><td>{l}</td><td>{fr(w[k])}</td><td>{fr(w.per_day?.[k], 1)}</td>
              {cmp && <td className={w.vs_ref?.[k] == null ? '' : w.vs_ref[k] >= 0 ? 'ps2-good' : 'ps2-low'}>{signedPct(w.vs_ref?.[k])}</td>}</tr>
          ))}
        </tbody>
      </table>
    </Detail>
  );
}

// Onglets (dev 14/10 : « des beaux SVG pour chaque catégorie, animation quand on clique dessus ») : un rail blanc, la
// pastille marine glisse d'un onglet à l'autre et l'icône de l'onglet choisi joue son geste. Le rail tient sur une ligne
// à 1440 px avec la barre latérale du CEO ; plus étroit, il défile horizontalement (jamais de retour à la ligne).
function Tabs({ tab, onTab }) {
  const [beat, setBeat] = useState(0);
  const still = reducedMotion();
  const pick = (key, el) => {
    setBeat((b) => b + 1);
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
    onTab(key);
  };
  return (
    <Motion.div className="ps2-tabbar" layoutScroll>
      <div className="ps2-tabs" role="tablist" aria-label="Vues de la Performance Sales">
        {TABS.map(([key, label]) => {
          const on = tab === key;
          return (
            <button type="button" key={key} role="tab" aria-selected={on} className="ps2-tab" onClick={(e) => pick(key, e.currentTarget)}>
              {on && <Motion.span layoutId="ps2-tab-pill" className="ps2-tab-pill" transition={still ? { duration: 0 } : { duration: 0.45, ease: EASE }} />}
              <span className="ps2-tab-label"><TabIcon name={key} active={on} beat={on ? beat : 0} />{label}</span>
            </button>
          );
        })}
      </div>
    </Motion.div>
  );
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────

// Vue d'ensemble (dev 14/10/2026 : « plus dashboard, là c'est le chaos ») : peu de blocs, un seul style. La trajectoire
// des ventes d'abord (objectif, cadence, Jev, simulateur), ce qui se passe, puis l'entonnoir et le podium, les équipes et
// les appels.
function Overview({ model, onOpen, onPilot }) {
  const p = model.pilot;
  const [source, setSource] = useState(null);
  return (
    <div className="ps2-grid">
      {p?.series?.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-studio-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-studio-title">Ventes cumulées et fin de mois</h2></Motion.div>
          <Motion.div variants={ITEM}><Studio model={model} /></Motion.div>
        </Reveal>
      )}

      {p?.signals?.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-pulse-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-pulse-title">Ce qui se passe</h2></Motion.div>
          <Pulse signals={p.signals} onOpen={onOpen} />
        </Reveal>
      )}

      <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-funnel-title">
        <Motion.div className="ps2-card-head" variants={ITEM}>
          <h2 id="ps2-funnel-title">Entonnoir du mois</h2>
          <span className="ps2-chip-soft">{dm(model.period.start)} → {dm(p?.days?.today || model.period.end)}</span>
        </Motion.div>
        <Motion.div variants={ITEM}><FunnelPicker model={model} value={source} onChange={setSource} /></Motion.div>
        <Motion.div variants={ITEM}><FunnelFlow model={model} onOpen={onOpen} source={source} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-top-title" style={{ display: 'flex', flexDirection: 'column' }}>
        <Motion.h2 id="ps2-top-title" variants={ITEM}>Top 3 du mois</Motion.h2>
        <Podium rows={model.podium} onOpen={onOpen} avatarFor={model.avatarFor} />
        <WeekLeader pilot={p} avatarFor={model.avatarFor} />
      </Reveal>

      {p?.teams?.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-teams-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-teams-title">Équipes</h2></Motion.div>
          <Teams teams={p.teams} onPilot={onPilot} days={p.days} />
        </Reveal>
      )}

      <Reveal as="section" className={`ps2-card ${p?.teams?.length ? 'ps2-span-4' : 'ps2-span-12'}`} aria-labelledby="ps2-calls-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-calls-title">Appels Allo</h2></Motion.div>
        <Motion.div variants={ITEM}><CallsCard calls={model.calls} /></Motion.div>
      </Reveal>
    </div>
  );
}

function CallsCard({ calls }) {
  const measured = calls?.measured;
  if (!measured) return <div className="ps2-empty">{calls?.loading ? '…' : '–'}</div>;
  return (
    <Info className="ps2-calls" label="Appels Allo, détail"
      detail={<Detail kicker="Appels Allo" value={fr(calls.total)}
        rows={[['Appels passés', fr(calls.total)], ['Répondus par une personne', `${fr(calls.rate, 0)} %`], calls.missing?.length > 0 && ['Sans Allo', calls.missing.join(', ')]]}
        source="Journal d’appels Allo, par numéro de sales" />}>
      <Ring value={calls.rate} size={112} stroke={11} track="var(--line-2)" color="#1e3a7b" label={`${fr(calls.rate, 0)} % répondus`}>
        <b>{fr(calls.rate, 0)} %</b><small>répondus</small>
      </Ring>
      <span className="ps2-calls-text">
        <b className="ps2-num"><CountUp value={calls.total} /></b>
        <span>appels passés</span>
        {calls.missing?.length > 0 && <small>{calls.missing.length} sales sans Allo</small>}
      </span>
    </Info>
  );
}

const SIGNAL_OPEN = { pace: ['sales'], leads: ['leads'], r2_no_sale: ['r2e'], no_show: ['r1e', { dossiers: 'r1p' }], unqualified: ['r1e', { dossiers: 'r1p' }], undeclared: ['signed'] };

// « Ce qui se passe » (dev 14/10/2026 : « illisible », « code couleur dégueu », puis « présentation pas bonne ») : un
// tableau comparatif, une ligne par indicateur, les mêmes colonnes partout : l'indicateur et sa période, la valeur
// maintenant, la référence à laquelle on la compare, l'écart, et deux barres (référence en clair, maintenant en marine).
// Tout vient du calcul du backend à chaque chargement (perf_pilotage.signals).
function signalRow(s) {
  const v = s.viz || {};
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  switch (s.key) {
    case 'pace': return { name: 'Ventes par jour', period: 'cette semaine', now: fr(v.now?.value, 1), ref: fr(v.before?.value, 1), refLabel: v.before?.label,
      delta: s.figure, bars: [v.before?.value, v.now?.value] };
    case 'leads': return { name: 'Leads chez les sales', period: s.period?.split(',')[0], now: fr(v.value), ref: fr(v.target), refLabel: 'attendus à date', delta: s.figure, bars: [v.target, v.value] };
    case 'no_show': return { name: 'No-show R1', period: v.now?.label, now: `${fr(v.now?.value)} %`, ref: v.before ? `${fr(v.before.value)} %` : '–', refLabel: v.before?.label,
      delta: v.before ? `${v.now.value - v.before.value > 0 ? '+' : ''}${v.now.value - v.before.value} pts` : null, bars: v.before ? [v.before.value, v.now.value] : null };
    case 'r2_no_sale': return { name: 'R2 effectués sans vente', period: s.period?.split(',')[0], now: fr(v.value), ref: fr(v.total), refLabel: 'R2 effectués du mois',
      delta: `${pct(v.value, v.total)} %`, bars: [v.total, v.value] };
    case 'unqualified': return { name: 'RDV passés sans résultat', period: s.period?.split(',')[0], now: s.figure,
      ref: (v.parts || []).map((x) => `${x.label} ${x.value}`).join(' · '), refLabel: 'à qualifier sur la fiche', delta: null, split: v.parts };
    case 'undeclared': return { name: 'Signatures à déclarer', period: s.period?.split(',')[0], now: s.figure, ref: fr(v.target), refLabel: `signées, ${fr(v.value)} déclarées`,
      delta: null, bars: [v.target, v.value] };
    default: return { name: s.title, period: s.period, now: s.figure, ref: '', refLabel: '', delta: null };
  }
}

function Pulse({ signals, onOpen }) {
  const drawn = useDrawn();
  if (!signals.length) return <Motion.div className="ps2-empty" variants={ITEM}>{CHECK}</Motion.div>;
  return (
    <div className="ps2-scoreboard" role="table" aria-label="Ce qui se passe">
      <div className="ps2-score-row is-head" role="row">
        <span role="columnheader">Indicateur</span><span role="columnheader">Maintenant</span><span role="columnheader">Référence</span>
        <span role="columnheader">Écart</span><span role="columnheader" aria-hidden="true" />
      </div>
      {signals.map((s, i) => {
        const row = signalRow(s);
        const target = SIGNAL_OPEN[s.key];
        const bad = s.tone === 'low';
        const max = row.bars ? Math.max(1e-9, ...row.bars.filter((x) => x != null)) : 1;
        return (
          <Motion.div key={s.key} variants={ITEM} role="row">
            <Info className={`ps2-score-row is-${s.tone}`} label={`${row.name} : ${row.now}, référence ${row.ref}`}
              detail={(dismiss) => (
                <Detail kicker={s.period} title={s.title} value={s.figure} lines={[s.detail]}
                  action={target && <button type="button" className="ps2-link" onClick={() => { dismiss(); onOpen(target[0], target[1] || {}); }}>Vérifier</button>} />
              )}>
              <span className="ps2-score-name" role="cell">
                <span className={`ps2-score-dot is-${s.tone}`}>{bad ? ARROW(s.key === 'no_show') : null}</span>
                <span><b>{row.name}</b><small>{row.period}</small></span>
              </span>
              <span className={`ps2-score-now ps2-num${bad ? ' is-bad' : ''}`} role="cell">{row.now}</span>
              <span className="ps2-score-ref" role="cell"><b className="ps2-num">{row.ref}</b><small>{row.refLabel}</small></span>
              <span role="cell">{row.delta && <span className={`ps2-score-delta${bad ? ' is-bad' : ''}`}>{row.delta}</span>}</span>
              <span className="ps2-score-bars" role="cell" aria-hidden="true">
                {row.split ? (
                  <span className="ps2-score-split">
                    {row.split.map((x, k) => <Motion.i key={x.label} initial={{ flexGrow: 0 }} animate={{ flexGrow: drawn ? x.value : 0 }}
                      transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.08 + k * 0.1 }} style={{ background: k ? '#9fb3df' : '#1e3a7b' }} />)}
                  </span>
                ) : row.bars ? row.bars.map((x, k) => (
                  <span key={k} className="ps2-score-bar"><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${((x || 0) / max) * 100}%` : 0 }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.08 + k * 0.12 }} style={{ background: k ? (bad ? '#c2410c' : '#1e3a7b') : '#d6deee' }} /></span>
                )) : null}
              </span>
            </Info>
          </Motion.div>
        );
      })}
    </div>
  );
}

const TEAM_COLORS = ['#1e3a7b', '#3e7d5a', '#d4834a', '#7f9ad9'];

function Teams({ teams, onPilot, days }) {
  const drawn = useDrawn();
  return (
    <Motion.div className="ps2-teams" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.08 } } }}>
      <div className="ps2-teams-head" aria-hidden="true"><span /><span>Ventes / objectif d’équipe</span><span>CA déclaré</span><span>Leads</span><span>R2E → vente</span><span>No-show R1</span></div>
      {teams.map((t, i) => {
        const noshow = pct(t.r1_noshow, (t.r1_done_due || 0) + (t.r1_noshow || 0));
        const closing = pct(t.nbr_signature, t.r2r);
        return (
          <Motion.div key={t.team} variants={ITEM}>
            <Info className="ps2-team" label={`${t.team}, détail`}
              detail={(dismiss) => <Detail kicker={t.team} title={`${t.people} sales`} value={`${t.nbr_signature}${t.objective ? ` / ${t.objective}` : ''} ventes`}
                action={onPilot && <button type="button" className="ps2-link" onClick={() => { dismiss(); onPilot(t.team); }}>Piloter l’équipe</button>}
                rows={[['CA déclaré', euro(t.total_revenue)], ['Signatures', fr(t.nbr_signed)], ['Leads chez les sales', fr(t.leads_assigned)], ['R1 effectués', fr(t.r1r)],
                  ['R2 effectués', fr(t.r2r)], ['Ventes / R2 effectué', closing == null ? '–' : `${closing} %`], ['No-show R1', noshow == null ? '–' : `${noshow} %`],
                  ['R2 effectués sans vente', fr(t.r2e_without_sale)], ['RDV passés pas qualifiés', fr((t.r1_open || 0) + (t.r2_open || 0))]]} />}>
              <span className="ps2-team-name"><i style={{ background: t.color || TEAM_COLORS[i % TEAM_COLORS.length] }} />{t.team.replace('Équipe ', '')}<small>{t.people} sales</small></span>
              <span className="ps2-team-bar">
                <span><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${Math.min(100, (t.nbr_signature / Math.max(1, t.objective || t.nbr_signature)) * 100)}%` : 0 }}
                  transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.1 }} style={{ background: t.color || TEAM_COLORS[i % TEAM_COLORS.length] }} />
                  {t.objective && days ? <em style={{ left: `${(days.elapsed / days.total) * 100}%` }} /> : null}</span>
                <b className="ps2-num">{t.nbr_signature}{t.objective ? <small> / {t.objective}</small> : null}</b>
              </span>
              <span className="ps2-num">{euro(t.total_revenue)}</span>
              <span className="ps2-num">{fr(t.leads_assigned)}</span>
              <span className="ps2-num">{closing == null ? '–' : `${closing} %`}</span>
              <span className={`ps2-num ${noshow >= 50 ? 'ps2-low' : ''}`}>{noshow == null ? '–' : `${noshow} %`}</span>
            </Info>
          </Motion.div>
        );
      })}
    </Motion.div>
  );
}

function Avatar({ name, url, size, style }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar" style={{ width: size, height: size, flex: 'none', overflow: 'hidden', fontSize: size > 50 ? 15 : 13, ...style }}>
      {url && !broken ? <img src={url} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

// Leader de la semaine en cours (dev 14/10 : « celui qui est leader dans la semaine, juste en bas du top 3 ») : le plus de
// ventes déclarées depuis lundi, départagé par les R2 effectués ; les ex æquo sont tous montrés.
function WeekLeader({ pilot, avatarFor }) {
  const weeks = pilot?.weeks || [];
  let i = weeks.findIndex((w) => w.state === 'current');
  if (i > 0 && !weeks[i].elapsed_days) i -= 1;
  const people = pilot?.person_weeks || [];
  if (i < 0 || !people.length) return null;
  const cell = (p) => p.weeks[i] || { sales: 0, r2e: 0 };
  const best = Math.max(0, ...people.map((p) => cell(p).sales));
  if (!best) return null;
  const leaders = people.filter((p) => cell(p).sales === best);
  const topR2 = Math.max(...leaders.map((p) => cell(p).r2e));
  const shown = leaders.filter((p) => cell(p).r2e === topR2).slice(0, 3);
  const w = weeks[i];
  return (
    <Motion.div variants={ITEM} style={{ marginTop: 'auto' }}>
      <Info className="ps2-leader" label="Leader de la semaine, détail"
        detail={<Detail kicker={`Semaine ${i + 1} · ${dm(w.start)} → ${dm(w.end)}`} title="Classement de la semaine"
          rows={people.filter((p) => cell(p).sales > 0).sort((a, b) => cell(b).sales - cell(a).sales || cell(b).r2e - cell(a).r2e).slice(0, 6)
            .map((p) => [p.name, `${cell(p).sales} vente${cell(p).sales > 1 ? 's' : ''} · ${cell(p).r2e} R2E`])} />}>
        <span className="ps2-leader-faces">{shown.map((p) => <Avatar key={p.name} name={p.name} url={avatarFor?.(p.name)} size={40} style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }} />)}</span>
        <span className="ps2-leader-text">
          <span className="ps2-mono">Leader {w.state === 'current' ? 'de la semaine' : `semaine ${i + 1}`}</span>
          <b>{shown.map((p) => p.name).join(', ')}</b>
          <small className="ps2-num">{best} vente{best > 1 ? 's' : ''} · {cell(shown[0]).r2e} R2E</small>
        </span>
        <svg className="ps2-leader-crown" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z" /></svg>
      </Info>
    </Motion.div>
  );
}

function Podium({ rows, onOpen, avatarFor }) {
  const on = useRevealed();
  if (!rows.length) return <Motion.div className="ps2-empty" variants={ITEM}>–</Motion.div>;
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  const heights = { 0: 118, 1: 86, 2: 64 };
  const style = { 0: { background: 'var(--ink)', color: 'var(--card)' }, 1: { background: 'var(--blue-bg)', color: 'var(--blue)' }, 2: { background: 'var(--good-bg)', color: 'var(--good)' } };
  return (
    <div className="ps2-podium" style={{ height: 250 }}>
      {order.map((r) => {
        const rank = rows.indexOf(r);
        const size = rank === 0 ? 58 : 48;
        return (
          <div key={r.name} className="ps2-podium-col">
            <Motion.span initial={{ scale: 0.6, opacity: 0, y: 10 }} animate={on ? { scale: 1, opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: EASE, delay: 0.9 + rank * 0.12 }}
              style={{ borderRadius: '50%', display: 'inline-flex', boxShadow: rank === 0 ? '0 0 0 3px var(--card), 0 0 0 5px var(--ink)' : '0 0 0 3px var(--card)' }}>
              <Avatar name={r.name} url={avatarFor?.(r.name)} size={size} style={style[rank]} />
            </Motion.span>
            <button type="button" className="ps2-link" style={{ color: 'var(--ink)' }} onClick={() => onOpen('sales', { person: r.name })}><b>{r.name}</b></button>
            <small className="ps2-num">{r.nbr_signature} ventes · {euro(r.total_revenue)}</small>
            <Motion.div className="ps2-podium-step" style={{ height: heights[rank], ...style[rank] }}
              initial={{ scaleY: 0 }} animate={{ scaleY: on ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.3 + (2 - rank) * 0.12 }}>#{rank + 1}</Motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ── Canaux ────────────────────────────────────────────────────────────────

function Channels({ model, onOpen, period, dark }) {
  const [leads, setLeads] = useState(null);
  const views = model.views?.global || {};
  const received = views.received || {};
  const cols = [['leads', 'received'], ['r1e', 'r1_done'], ['r2e', 'r2_done'], ['signed', 'signed'], ['sales', 'sales']];
  const rowsFor = (group) => SOURCES.filter((s) => s.group === group && cols.some(([, step]) => (views[step]?.[s.key] || 0) > 0));
  const lists = model.pilot?.lists;
  const channelCheck = model.checks.find((c) => c.key === 'channels');
  const Row = ({ s }) => {
    const leads = received[s.key] || 0, sold = views.sales?.[s.key] || 0;
    const rate = leads ? (sold / leads) * 100 : null;
    return (
      <Motion.tr variants={ITEM}>
        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="ps2-swatch" style={{ background: s.color }} />{s.label}</span></td>
        {cols.map(([metric, step]) => {
          const v = views[step]?.[s.key] || 0;
          return <td key={metric}>{v ? <button type="button" className="ps2-cell" onClick={() => onOpen(metric, { source: s.key })}>{fr(v)}</button> : <span className="ps2-muted">0</span>}</td>;
        })}
        <td style={{ textAlign: 'left' }}>
          {rate != null && rate <= 100 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="ps2-bar"><i style={{ width: `${rate}%`, background: s.color }} /></span>{fr(rate, 1)} %</span>
            : sold ? <Info className="ps2-cell ps2-muted" label="Ventes sur des leads d’avant"
              detail={<Detail kicker={s.label} rows={[['Ventes du mois', fr(sold)], ['Leads reçus ce mois-ci', fr(leads)]]}
                lines={['Ventes faites sur des leads reçus avant le mois : voir l’onglet Cohorte.']} />}>{sold} / {leads}</Info>
              : <span className="ps2-muted">–</span>}
        </td>
      </Motion.tr>
    );
  };
  const MONTH = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][Number(String(model.period?.start || '').slice(5, 7)) - 1] || 'ce mois';
  return (
    <div className="ps2-grid">
      {model.pilot?.intake?.links?.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-flow-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-flow-title">Fiches reçues en {MONTH}</h2>
            <span className="ps2-chip-soft">de Funnel Leads aux canaux</span></Motion.div>
          <Motion.div variants={ITEM}><AdsFlow intake={model.pilot.intake} month={MONTH} onLeads={setLeads} /></Motion.div>
        </Reveal>
      )}
      {model.pilot?.intake?.links?.length > 0 && <AffectedCard period={period} month={MONTH} intake={model.pilot.intake} onLeads={setLeads} />}
      {model.pilot?.intake?.reclaims && <PoolReclaims reclaims={model.pilot.intake.reclaims} month={MONTH} onLeads={setLeads} />}
      <IntakePanel open={leads} period={period} dark={dark} onClose={() => setLeads(null)} />
      <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-mix-title">
        <Motion.h2 id="ps2-mix-title" variants={ITEM}>D’où viennent les leads</Motion.h2>
        <Motion.div variants={ITEM} style={{ marginTop: 16 }}><Donut counts={received} total={model.value.leads} label="chez les sales" onPick={(k) => onOpen('leads', { source: k })} /></Motion.div>
        <Motion.ul variants={ITEM} style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 14px', fontSize: 12.5 }}>
          {SOURCES.filter((s) => received[s.key]).map((s) => (
            <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="ps2-swatch" style={{ background: s.color }} />{s.label}<b className="ps2-num" style={{ marginLeft: 'auto' }}>{fr(received[s.key])}</b></li>
          ))}
        </Motion.ul>
      </Reveal>
      <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-chan-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-chan-title">Chaque canal, du lead à la vente</h2>
          <Info className="ps2-chip-soft" label="Règle des canaux"
            detail={<Detail kicker="Règle des canaux" lines={['Un lead compte dans une seule ligne.',
              'Dès qu’un setter pose ou reprogramme un rendez-vous, la suite de son parcours passe dans « Initiative setter », quelle que soit son origine.',
              channelCheck?.label]} />}>
            {channelCheck?.ok ? <>{CHECK} total = entonnoir</> : 'règle des canaux'}</Info>
        </Motion.div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <Motion.table className="ps2-table" style={{ minWidth: 640 }} variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}>
            <thead><tr><th>Canal</th><th>Leads chez les sales</th><th>R1 effectués</th><th>R2 effectués</th><th>Signatures</th><th>Ventes</th><th style={{ textAlign: 'left', width: 160 }}>Ventes / leads</th></tr></thead>
            <tbody>
              <tr className="is-group"><td colSpan={7}>Origine du lead</td></tr>
              {rowsFor('origin').map((s) => <Row key={s.key} s={s} />)}
              <tr className="is-group"><td colSpan={7} style={{ color: 'var(--good)' }}>Initiative setter sur un lead déjà là</td></tr>
              {rowsFor('setter').map((s) => <Row key={s.key} s={s} />)}
              <Motion.tr className="is-total" variants={ITEM}><td>Total</td>{FUNNEL.map((k) => <td key={k}>{fr(model.value[k])}</td>)}
                <td style={{ textAlign: 'left' }}>{fr((model.value.sales / Math.max(1, model.value.leads)) * 100, 1)} %</td></Motion.tr>
            </tbody>
          </Motion.table>
        </div>
      </Reveal>
      {lists && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-lists-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-lists-title">Cold call setter : outil de scraping ou saisie à la main</h2>
            <span className="ps2-chip-soft">créés {dm(model.period.start)} → {dm(model.pilot?.days?.today || model.period.end)}</span></Motion.div>
          <div className="ps2-split" style={{ marginTop: 14 }}>
            {[['list', 'Outil de scraping', 'leads exportés'], ['manual', 'Saisie à la main', 'leads']].map(([key, title, unit]) => (
              <Motion.div key={key} variants={ITEM} className="ps2-list-box">
                <div className="ps2-mono" style={{ fontSize: 11 }}>{title}</div>
                <ListFlow data={lists[key]} unit={unit} />
              </Motion.div>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}

function ListFlow({ data, unit }) {
  const drawn = useDrawn();
  const steps = [['leads', unit], ['r1', 'R1 posés'], ['r2', 'R2 posés'], ['signed', 'signés']];
  const max = Math.max(1, data.leads || 0);
  return (
    <div className="ps2-listflow">
      {steps.map(([k, l], i) => (
        <div key={k}>
          <div className="ps2-num" style={{ fontSize: 26, fontWeight: 600 }}><CountUp value={data[k] || 0} /></div>
          <div style={{ fontSize: 12, color: 'var(--soft)' }}>{l}</div>
          <span className="ps2-bar" style={{ width: '100%', marginTop: 8 }}><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${Math.max(data[k] ? 2 : 0, ((data[k] || 0) / max) * 100)}%` : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.1 }} style={{ background: '#4f9a72' }} /></span>
        </div>
      ))}
    </div>
  );
}

// ── Cohorte ───────────────────────────────────────────────────────────────

// Cohorte (dev 14/10/2026 : « on parle bien des leads ADS uniquement ; les autres canaux, ça n'a pas de sens, à part
// LinkedIn et parrainage ; et il faut voir que ce sont les leads ADS ») : une famille d'origine à la fois, ADS par défaut
// (affectés et repris du pool), le périmètre écrit en tête.
const COHORT_FAMILIES = [['ads', 'Leads ADS'], ['linkedin', 'LinkedIn'], ['referral', 'Parrainage']];

function Cohort({ model }) {
  const c = model.cohort;
  const [fam, setFam] = useState('ads');
  if (!c) return <div className="ps2-empty">–</div>;
  const byFam = c.by_family || {};
  const families = COHORT_FAMILIES.filter(([k]) => byFam[k]?.leads);
  const f = byFam[fam] || {};
  const label = (families.find(([k]) => k === fam) || COHORT_FAMILIES[0])[1];
  const steps = [
    { key: 'leads', label: 'Leads reçus', value: f.leads || 0, color: '#1e3a7b' },
    { key: 'r1', label: 'R1 posés', value: f.r1 || 0, color: '#3d5ba8' },
    { key: 'r1_done', label: 'R1 effectués', value: f.r1_done || 0, color: '#5d79c2' },
    { key: 'r2', label: 'R2 posés', value: f.r2 || 0, color: '#7f9ad9' },
    { key: 'r2_done', label: 'R2 effectués', value: f.r2_done || 0, color: '#a5b9e6' },
    { key: 'signed', label: 'Signés', value: f.signed || 0, color: '#4f9a72' },
    { key: 'sales', label: 'Vendus', value: f.sales || 0, color: '#2c6448' },
  ];
  const span = `${dm(model.period.start)} → ${dm(model.pilot?.days?.today || model.period.end)}`;
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12 ps2-picker" role="radiogroup" aria-label="Leads de la cohorte">
        {families.map(([k, l]) => (
          <button type="button" key={k} role="radio" aria-checked={fam === k} className="ps2-pick" onClick={() => setFam(k)}>
            {fam === k && <Motion.span layoutId="ps2-cohort-pill" className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{l}<small className="ps2-num">{fr(byFam[k].leads)}</small></span>
          </button>
        ))}
      </div>
      <Reveal as="section" key={fam} className="ps2-card ps2-span-8" aria-labelledby="ps2-cohort-title">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-cohort-title">{label} reçus du {span.replace(' → ', ' au ')}, jusqu’à la vente</h2>
          <Info className="ps2-chip-soft" label="Périmètre de la cohorte"
            detail={<Detail kicker="Cohorte" title={`${label} reçus ${span}`}
              rows={[['Leads de la cohorte', fr(f.leads)], ['Ventes sur ces leads, à ce jour', fr(f.sales)], ['Ventes du mois, tous leads', fr(model.value.sales)]]}
              lines={['Chaque lead est suivi jusqu’à aujourd’hui, quelle que soit la date de son RDV ou de sa vente. Leads ADS : affectés automatiquement ou repris du pool commun, une fois par sales et par contact.']} />}>
            {fr(f.sales || 0)} vendus · {fr(((f.sales || 0) / Math.max(1, f.leads || 0)) * 100, 1)} %</Info>
        </Motion.div>
        <Motion.div variants={ITEM}><CohortBars steps={steps} /></Motion.div>
      </Reveal>
      <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-cohort-ch">
        <Motion.h2 id="ps2-cohort-ch" variants={ITEM}>Face à face</Motion.h2>
        <Motion.table className="ps2-table" style={{ marginTop: 10 }} variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }}>
          <thead><tr><th>Étape</th>{families.map(([k, l]) => <th key={k} className={fam === k ? 'is-on' : ''}>{l.replace('Leads ', '')}</th>)}</tr></thead>
          <tbody>
            {steps.map((st) => (
              <Motion.tr key={st.key} variants={ITEM}><td>{st.label}</td>{families.map(([k]) => <td key={k} className={fam === k ? 'is-on' : ''}>{fr(byFam[k]?.[st.key] || 0)}</td>)}</Motion.tr>
            ))}
            <Motion.tr className="is-total" variants={ITEM}><td>Leads → vente</td>
              {families.map(([k]) => <td key={k} className={fam === k ? 'is-on' : ''}>{fr(((byFam[k]?.sales || 0) / Math.max(1, byFam[k]?.leads || 0)) * 100, 1)} %</td>)}</Motion.tr>
          </tbody>
        </Motion.table>
      </Reveal>
      {f.r1_later != null && (
        <Reveal as="section" key={`later-${fam}`} className="ps2-card ps2-span-12" aria-labelledby="ps2-later-title">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-later-title">RDV donnés pour le mois suivant</h2></Motion.div>
          <div className="ps2-split" style={{ marginTop: 14 }}>
            {[['r1', 'R1 posés'], ['r2', 'R2 posés']].map(([k, l]) => (
              <Motion.div key={k} variants={ITEM}><LaterBar label={l} total={f[k] || 0} later={f[`${k}_later`] || 0} /></Motion.div>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}

function LaterBar({ label, total, later }) {
  const drawn = useDrawn();
  const share = total ? (later / total) * 100 : 0;
  return (
    <Info className="ps2-later" label={`${label} pour le mois suivant, détail`}
      detail={<Detail kicker={label} value={`${fr(share, 1)} %`}
        rows={[['RDV posés par la cohorte', fr(total)], ['Dans le mois', fr(total - later)], ['Le mois suivant', fr(later), 'ps2-strong']]} />}>
      <span className="ps2-later-head"><b>{label}</b><span className="ps2-num"><b>{fr(later)}</b> / {fr(total)} · {fr(share, 1)} %</span></span>
      <span className="ps2-later-track">
        <Motion.i className="is-in" initial={{ width: 0 }} animate={{ width: drawn ? `${100 - share}%` : 0 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }} />
        <Motion.i className="is-next" initial={{ width: 0 }} animate={{ width: drawn ? `${Math.max(later ? 1.5 : 0, share)}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 1 }} />
      </span>
      <span className="ps2-later-legend"><span><i className="is-in" />ce mois-ci</span><span><i className="is-next" />mois suivant</span></span>
    </Info>
  );
}

// ── Rendez-vous ───────────────────────────────────────────────────────────

// R1 et R2 du mois, filtrables par canal d'acquisition puis par pub (dev 15/10/2026 : « filtrer par canaux d'acquisition
// et voir quels canaux font le plus de nos shows » ; « parmi les ads, filtrer par pub »), et le classement des canaux.
function RdvSummary({ model: pageModel, data, front, range, onOpen, dark, delay }) {
  // Période de l'onglet (en tête) : le mois affiché réutilise le modèle de la page.
  const model = useMemo(() => (data && data !== pageModel.raw ? buildModel(data, front) : null) || pageModel, [data, front, pageModel]);
  const own = model !== pageModel;
  const [scope, setScope] = useState({ source: null, ad: null });
  const t = scopeFigures(model, scope.source, scope.ad);
  const scopeLabel = scope.source ? [SOURCES.find((x) => x.key === scope.source)?.label, model.ads?.[scope.source]?.find((a) => a.key === scope.ad)?.label].filter(Boolean).join(' · ') : null;
  const track = dark ? 'rgba(148,163,184,.18)' : '#eef1f6';
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12"><ChannelFilter model={model} value={scope} onChange={setScope} steps={['r1', 'r2']} countStep="r1" id="ps2-rdv-scope" /></div>
      {[['r1', 'R1', 'r1e'], ['r2', 'R2', 'r2e']].map(([s, name, metric]) => {
        const placed = t[`${s}p`], due = t[`${s}_due`], done = t[`${s}_done_due`], open = t[`${s}_open`], noshow = t[`${s}_noshow`] || 0;
        const cancelled = Math.max(0, due - done - open - noshow), upcoming = Math.max(0, placed - due);
        const presence = pct(done, done + noshow);
        const parts = [
          { key: 'done', label: 'effectués', value: done, color: '#2c6448' },
          { key: 'noshow', label: 'absents', value: noshow, color: '#c2410c' },
          { key: 'cancelled', label: 'annulés', value: cancelled, color: '#c9a66b' },
          { key: 'open', label: 'pas qualifiés', value: open, color: '#cfd5df' },
          { key: 'upcoming', label: 'à venir', value: upcoming, color: '#9fb3df' },
        ];
        return (
          <Reveal as="section" key={s} className="ps2-card ps2-span-6" aria-label={`Rendez-vous ${name}`}>
            <Motion.div className="ps2-card-head" variants={ITEM}><h2>{name} {own ? 'de la période' : 'du mois'}</h2>
              {scopeLabel && <span className="ps2-chip-soft" style={{ marginRight: 'auto' }}>{scopeLabel}</span>}
              <button type="button" className="ps2-link" onClick={() => onOpen(metric, { dossiers: `${s}p`, source: scope.source, ad: scope.ad, model, period: range })}>Dossiers</button></Motion.div>
            <Motion.div variants={ITEM} style={{ display: 'flex', gap: 26, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <Info className="ps2-ring-btn" label={`Présence ${name}, détail`}
                detail={<Detail kicker={`Présence ${name}`} value={presence == null ? '–' : `${presence} %`}
                  rows={[['Effectués', fr(done)], ['Absents', fr(noshow)], ['Annulés', fr(cancelled)], ['Pas encore qualifiés', fr(open)]]}
                  lines={[`${done} ÷ (${done} + ${noshow}) = ${presence ?? '–'} %`, 'Même règle que les cartes de présence par jour et heure.']} />}>
                <Ring value={presence} size={116} stroke={11} track={track} color={presence == null ? '#94a3b8' : presence >= 70 ? '#2c6448' : presence >= 50 ? '#2f4f9e' : '#c2410c'} label={`Présence ${name} ${presence ?? '–'} %`}>
                  <b>{presence == null ? '–' : `${presence} %`}</b><small>présence</small>
                </Ring>
              </Info>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div className="ps2-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.02em' }}><CountUp value={placed} /> <small style={{ fontSize: 14, color: 'var(--soft)', fontWeight: 500 }}>posés</small></div>
                <Composition parts={parts} total={placed} />
                {s === 'r2' && !scope.source && !own && delay?.length > 0 && (
                  <Info className="ps2-rdv-delay" label="Délai R1 → R2, détail"
                    detail={<Detail kicker="Délai entre R1 et R2 effectués" rows={delay.map((m) => [m.month, `${fr(m.avg_days, 1)} j en moyenne · médiane ${fr(m.median_days, 1)} j · ${m.n} RDV`])}
                      lines={['Temps écoulé entre le R1 et le R2 effectués d’un même lead, par mois du R1.']} />}>
                    <span className="ps2-mono">R1 → R2</span><b className="ps2-num">{fr(delay[delay.length - 1].avg_days, 1)} j</b>
                    <small>en moyenne · médiane {fr(delay[delay.length - 1].median_days, 1)} j · {delay[delay.length - 1].n} RDV</small>
                  </Info>
                )}
              </div>
            </Motion.div>
          </Reveal>
        );
      })}
      <div className="ps2-span-12"><ShowsByChannel model={model} scope={scope} onPick={setScope} /></div>
    </div>
  );
}

function Composition({ parts, total }) {
  const drawn = useDrawn();
  const [hover, setHover] = useState(null);
  const sum = Math.max(1, total);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="ps2-compo" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((p, i) => (
          <Motion.i key={p.key} initial={{ width: '0%' }} animate={{ width: drawn ? `${(p.value / sum) * 100}%` : '0%' }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.08 }}
            style={{ background: p.color, opacity: hover && hover !== p.key ? 0.3 : 1 }} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} />
        ))}
      </div>
      <div className="ps2-compo-legend">
        {parts.map((p) => (
          <span key={p.key} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} style={{ opacity: hover && hover !== p.key ? 0.45 : 1 }}>
            <i style={{ background: p.color }} /><b className="ps2-num">{fr(p.value)}</b> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Onglet Sales (dev 14/10/2026 : « pas les deux tableaux l'un en dessous de l'autre ; le plus détaillé en premier, puis
// une bascule animée vers l'autre ; et le détail par canaux d'acquisition » ; 15/10 : « on doit pouvoir choisir la
// période ; des KPI R1 et R2 ; filtrer par canal, et parmi les ads par pub »). En tête : la vue, la période, le canal (et
// la pub), puis les KPI de cette portée. Détail : Global = le tableau complet (appels, répondeur, RDV, ventes) ; un
// canal ou une pub = le même tableau des sales restreint à ce périmètre. La frise des semaines reste celle du mois.
const SALES_VIEWS = [['detail', 'Détail'], ['channels', 'Par canal'], ['weeks', 'Semaine par semaine']];

function SalesTab({ model, salesData, salesRange, salesPeriodBar, salesLoading, front, salesNode, onOpen }) {
  const p = model.pilot;
  const smodel = useMemo(() => (salesData && salesData !== model.raw ? buildModel(salesData, front) : null) || model, [salesData, front, model]);
  const [view, setView] = useState('detail');
  const [scope, setScope] = useState({ source: null, ad: null });
  const index = SALES_VIEWS.findIndex(([k]) => k === view);
  const [dir, setDir] = useState(1);
  const pick = (k) => { setDir(SALES_VIEWS.findIndex(([x]) => x === k) >= index ? 1 : -1); setView(k); };
  const views = SALES_VIEWS.filter(([k]) => k !== 'weeks' || p?.person_weeks?.length).filter(([k]) => k !== 'channels' || smodel.byPerson);
  // Un chiffre ouvert depuis cet onglet se vérifie sur la période de l'onglet.
  const openHere = (metric, extra = {}) => onOpen(metric, { ...extra, model: smodel, period: salesRange });
  // « Par canal » compare les canaux entre eux : la pub ne s'y applique pas (ni au tableau, ni aux KPI).
  const ad = view === 'channels' ? null : scope.ad;
  const f = scopeFigures(smodel, scope.source, ad);
  const scoped = scope.source ? (ad ? byPersonForAd(smodel, scope.source, ad) : smodel.byPerson) : null;
  return (
    <div className={`ps2-sales${salesLoading ? ' is-loading' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ps2-sales-top">
        <div className="ps2-switch" role="tablist" aria-label="Vue du tableau des sales">
          {views.map(([k, l]) => (
            <button type="button" key={k} role="tab" aria-selected={view === k} className="ps2-switch-btn" onClick={() => pick(k)}>
              {view === k && <Motion.span layoutId="ps2-sales-switch" className="ps2-switch-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span>{l}</span>
            </button>
          ))}
        </div>
        {view !== 'weeks' && salesPeriodBar}
      </div>
      {view !== 'weeks' && (
        <>
          <ChannelFilter model={smodel} value={{ ...scope, ad }} onChange={setScope} steps={['received', 'r1', 'r1_phone', 'r2']} countStep="received" id="ps2-sales-scope" withAds={view !== 'channels'} />
          <SalesKpis f={f} periodLabel={smodel.periodText} onDossiers={(metric, dossiers) => openHere(metric, { dossiers, source: scope.source, ad })} />
        </>
      )}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <Motion.div key={`${view}-${scope.source || 'global'}-${ad || ''}`} custom={dir}
            variants={{ enter: (d) => ({ opacity: 0, x: 40 * d }), center: { opacity: 1, x: 0 }, exit: (d) => ({ opacity: 0, x: -40 * d }) }}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.32, ease: EASE }}>
            {view === 'detail' && (scoped
              ? <Reveal as="section" className="ps2-card" aria-label="Tableau par canal"><ChannelTable byPerson={scoped} source={scope.source} avatarFor={smodel.avatarFor} onOpen={openHere} /></Reveal>
              : salesNode)}
            {view === 'channels' && <Reveal as="section" className="ps2-card" aria-label="Par canal"><ChannelBoard byPerson={smodel.byPerson} focus={scope.source} avatarFor={smodel.avatarFor} onOpen={openHere} /></Reveal>}
            {view === 'weeks' && <Reveal as="section" className="ps2-card" aria-label="Semaine par semaine"><WeeksBoard people={p.person_weeks} weeks={p.weeks} avatarFor={model.avatarFor} /></Reveal>}
          </Motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PerfSalesV2({ data, dark, period, tab, onTab, front, controls, loading, salesNode, rdvNode, reactivityNode, ventesData, rdvDelay,
  salesData, salesRange, salesPeriodBar, salesLoading, rdvData, rdvRange, rdvPeriodBar, rdvLoading }) {
  const model = useMemo(() => { const m = buildModel(data, front); return m && { ...m, raw: data }; }, [data, front]);
  const [verify, setVerify] = useState(null);
  const [team, setTeam] = useState(null);
  const myTeam = model?.pilot?.teams?.find((t) => front?.me && t.members?.includes(front.me))?.team;
  const pilotTeam = (name) => { setTeam(name); onTab('teams'); };
  const open = (metric, extra = {}) => setVerify({ metric, ...extra });
  if (!model) {
    return (
      <div className={`ps2${dark ? ' is-dark' : ''}`}>
        <div className="ps2-hero"><div><div className="ps2-hero-line"><Controls controls={controls} /></div><h1>Performance Sales</h1></div></div>
        {loading && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
      </div>
    );
  }
  return (
    <div className={`ps2${dark ? ' is-dark' : ''}${loading ? ' is-loading' : ''}`}>
      <PopLayer>
        <Hero model={model} onOpen={open} controls={controls} />
        <Tabs tab={tab} onTab={onTab} />
        <AnimatePresence mode="wait">
          <Motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }}>
            {tab === 'overview' && <Overview model={model} onOpen={open} onPilot={pilotTeam} />}
            {tab === 'channels' && <Channels model={model} onOpen={open} period={period} dark={dark} />}
            {tab === 'sales' && <SalesTab model={model} salesData={salesData} salesRange={salesRange || period} salesPeriodBar={salesPeriodBar} salesLoading={salesLoading} front={front} salesNode={salesNode} onOpen={open} />}
            {tab === 'teams' && <TeamsTab model={model} team={team || myTeam} onTeam={setTeam} avatarFor={model.avatarFor} period={period} />}
            {tab === 'rdv' && (
              <div className={`ps2-rdvtab${rdvLoading ? ' is-loading' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {rdvPeriodBar && <div className="ps2-sales-top" style={{ justifyContent: 'flex-end' }}>{rdvPeriodBar}</div>}
                <RdvSummary model={model} data={rdvData} front={front} range={rdvRange || period} onOpen={open} dark={dark} delay={rdvDelay} />{rdvNode}
              </div>
            )}
            {tab === 'reactivity' && reactivityNode}
            {tab === 'cohort' && <Cohort model={model} />}
            {tab === 'ventes' && <VentesTab breakdown={ventesData} model={model} onOpen={open} />}
            {tab === 'setters' && <SettersTab period={period} days={model.pilot?.days} avatarFor={model.avatarFor} />}
            {tab === 'auto' && <AutoAssignTab month={period} avatarFor={model.avatarFor} />}
          </Motion.div>
        </AnimatePresence>
      </PopLayer>
      <VerifyPanel open={verify} model={model} period={period} dark={dark} onClose={() => setVerify(null)} />
    </div>
  );
}
