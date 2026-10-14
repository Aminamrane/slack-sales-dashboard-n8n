import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../services/apiClient';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, Ring, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import Studio from './Studio';
import GeoCards from './GeoCards';
import WeeksBoard from './WeeksBoard';
import { SOURCES, euro, fr } from './model';
import { rates } from './teamMath.js';

// Onglet Équipes (dev 14/10/2026 : « chaque head of sales doit pouvoir gérer son équipe : voir l'objectif de son équipe,
// les ventes, la projection, pour définir un plan d'action, quel taux de transfo on a besoin ; comparer à volume égal ;
// voir pourquoi ils sont en baisse par rapport aux autres »). Une équipe à la fois (celle du head of sales connecté par
// défaut) : son mois, son simulateur réglé sur ses taux et son objectif, ses ratios face aux autres équipes, et l'écart
// de ventes décomposé étape par étape face aux taux des autres équipes.
const pct = (a, b) => (b ? (a / b) * 100 : null);

export default function TeamsTab({ model, team: selected, onTeam, avatarFor, period }) {
  const teams = model.pilot?.teams || [];
  const team = teams.find((t) => t.team === selected) || teams[0];
  const teamModel = useMemo(() => team && ({
    ...model,
    value: team.values,
    pilot: { ...model.pilot, series: team.series, weeks: team.weeks, objective: team.objective, forecast: team.forecast, jev: null },
  }), [model, team]);
  const [src, setSrc] = useState(null);
  if (!team) return <div className="ps2-empty">–</div>;
  const color = team.color || '#1e3a7b';
  const sources = SOURCES.filter((x) => teams.some((t) => channelValues(t, model.byPerson, x.key).leads + channelValues(t, model.byPerson, x.key).sales > 0));
  const cmpTeams = src ? teams.map((t) => ({ ...t, ...channelTeam(t, model.byPerson, src) })) : teams;
  const cmpTeam = cmpTeams.find((t) => t.team === team.team);
  const people = (model.pilot?.person_weeks || []).filter((p) => team.members?.includes(p.name));
  return (
    <div className="ps2-grid" style={{ '--team': color }}>
      <div className="ps2-span-12 ps2-team-picker" role="radiogroup" aria-label="Équipe">
        {teams.map((t) => {
          const on = t.team === team.team;
          return (
            <button type="button" key={t.team} role="radio" aria-checked={on} className="ps2-pick" onClick={() => onTeam(t.team)}>
              {on && <Motion.span layoutId="ps2-team-pill" className="ps2-pick-pill" style={{ background: t.color || 'var(--ink)' }} transition={{ duration: 0.4, ease: EASE }} />}
              <span className="ps2-pick-label"><i style={{ background: on ? '#fff' : t.color }} />{t.team}</span>
            </button>
          );
        })}
      </div>

      <TeamHead team={team} model={model} avatarFor={avatarFor} key={`head-${team.team}`} />

      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-team-studio" key={`studio-${team.team}`}>
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-team-studio">Plan d’action</h2></Motion.div>
        <Motion.div variants={ITEM}><Studio model={teamModel} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-team-react" key={`react-${team.team}`}>
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-team-react">Réactivité des équipes</h2></Motion.div>
        <Motion.div variants={ITEM}><TeamReactivity period={period} team={team} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-team-mix" key={`mix-${team.team}`}>
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-team-mix">D’où viennent les leads de chaque équipe</h2></Motion.div>
        <Motion.div variants={ITEM}><ChannelMix teams={teams} team={team} byPerson={model.byPerson} /></Motion.div>
      </Reveal>

      <div className="ps2-span-12 ps2-picker" role="radiogroup" aria-label="Comparer sur">
        <span className="ps2-picker-label">Comparer sur</span>
        {[{ key: null, label: 'Tous les canaux' }, ...sources].map((x) => (
          <button type="button" key={x.key || 'all'} role="radio" aria-checked={src === x.key} className="ps2-pick" onClick={() => setSrc(x.key)}>
            {src === x.key && <Motion.span layoutId="ps2-team-src-pill" className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{x.color && <i style={{ background: x.color }} />}{x.label}</span>
          </button>
        ))}
      </div>

      <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-team-gap" key={`gap-${team.team}-${src}`}>
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-team-gap">Par sales, face aux autres équipes</h2></Motion.div>
        <Motion.div variants={ITEM}><PerSales team={cmpTeam} teams={cmpTeams} /></Motion.div>
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-team-cmp" key={`cmp-${team.team}-${src}`}>
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-team-cmp">À volume égal</h2></Motion.div>
        <Motion.div variants={ITEM}><Compare teams={cmpTeams} team={cmpTeam} /></Motion.div>
      </Reveal>

      {people.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-label="Semaine par semaine" key={`weeks-${team.team}`}>
          <WeeksBoard people={people} weeks={model.pilot.weeks} avatarFor={avatarFor} />
        </Reveal>
      )}

      <GeoCards period={period} teams={teams} />
    </div>
  );
}

// Valeurs d'une équipe sur UN canal (dev 14/10/2026 : « comparer par canal : voir si cette équipe performe mieux parce
// qu'elle prend plus du pool commun ») : la partition par source, ventilée par sales, sommée sur les membres.
function channelValues(team, byPerson, source) {
  const entry = source === 'second_chance' ? 'leads' : 'received';
  const sum = (step) => (team.members || []).reduce((a, m) => a + Number(byPerson?.[m]?.[step]?.[source] || 0), 0);
  return { leads: sum(entry), r1e: sum('r1_done'), r2e: sum('r2_done'), sales: sum('sales'), signed: sum('signed'), revenue: sum('revenue') };
}

function channelTeam(team, byPerson, source) {
  const v = channelValues(team, byPerson, source);
  return { values: { leads: v.leads, r1e: v.r1e, r2e: v.r2e, sales: v.sales, signed: v.signed }, total_revenue: v.revenue, r1_noshow: undefined, r1_done_due: undefined };
}

function ChannelMix({ teams, team, byPerson }) {
  const drawn = useDrawn();
  const mix = teams.map((t) => {
    const parts = SOURCES.map((x) => ({ ...x, value: channelValues(t, byPerson, x.key).leads })).filter((x) => x.value > 0);
    return { t, parts, total: parts.reduce((a, x) => a + x.value, 0) };
  });
  const used = SOURCES.filter((x) => mix.some((m) => m.parts.some((p) => p.key === x.key)));
  return (
    <div className="ps2-mix">
      {mix.map(({ t, parts, total }, i) => (
        <div key={t.team} className={`ps2-mix-row${t.team === team.team ? ' is-me' : ''}`}>
          <span className="ps2-mix-name"><i style={{ background: t.color || '#1e3a7b' }} />{t.team.replace('Équipe ', '')}<small className="ps2-num">{fr(total)} leads · {t.people} sales</small></span>
          <span className="ps2-mix-bar">
            {parts.map((x, k) => {
              const share = total ? (x.value / total) * 100 : 0;
              return (
                <Info key={x.key} className="ps2-mix-seg" label={`${x.label} : ${x.value}`} style={{ width: `${share}%` }}
                  detail={<Detail kicker={t.team} title={x.label} value={fr(x.value)}
                    rows={[['Part des leads de l’équipe', `${fr(share, 0)} %`], ['Ventes sur ce canal', fr(channelValues(t, byPerson, x.key).sales)]]} />}>
                  <Motion.i initial={{ scaleX: 0 }} animate={{ scaleX: drawn ? 1 : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.1 + k * 0.05 }}
                    style={{ background: x.color }}>{share >= 8 && <span>{fr(share, 0)} %</span>}</Motion.i>
                </Info>
              );
            })}
          </span>
        </div>
      ))}
      <div className="ps2-mix-legend">{used.map((x) => <span key={x.key}><i style={{ background: x.color }} />{x.label}</span>)}</div>
    </div>
  );
}

// Réactivité des équipes (dev 14/10/2026 : « quelle équipe rate le plus les leads des 6 minutes, perd le plus de leads
// après 3 jours sans RDV, est la plus réactive pour récupérer les leads du pool réactivité ») : trois comparaisons
// côte à côte, la plus forte valeur repérée ; le détail par sales et les sources s'ouvrent au clic.
function TeamReactivity({ period, team }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return undefined;
    let alive = true;
    setData(null); setError(false);
    apiClient.get(`/api/v1/monitoring/performance/v2/teams/reactivity?period=${period}`).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [period]);
  if (error) return <div className="ps2-empty" role="alert">Réactivité non chargée</div>;
  if (!data) return <div className="ps2-empty">…</div>;
  const teams = data.teams || [];
  const fmtMin = (m) => (m == null ? '–' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);
  const panels = [
    { key: 'sla', title: 'Règle des 6 minutes ratée', value: (t) => t.sla_missed, text: (t) => fr(t.sla_missed),
      sub: (t) => (t.sla_rate == null ? '' : `${fr(t.sla_rate, 0)} % à l’heure`), flag: (t) => (t.sla_rate == null ? -1 : 100 - t.sla_rate), flagText: 'rate le plus', tone: 'is-worst',
      detail: (t) => <Detail kicker={t.team} title="Règle des 6 minutes" value={`${fr(t.sla_missed)} ratés`}
        rows={[['À l’heure', fr(t.sla_on_time)], ['Ratés', fr(t.sla_missed)], ['Taux à l’heure', t.sla_rate == null ? '–' : `${fr(t.sla_rate, 1)} %`],
          ...t.people.filter((p) => p.sla_missed || p.sla_on_time).map((p) => [p.name, `${fr(p.sla_missed)} ratés · ${p.sla_rate == null ? '–' : `${fr(p.sla_rate, 0)} %`}`])]}
        source="Journal de réactivité : chaque lead ADS affecté, pris à l’heure ou raté" /> },
    { key: 'lost', title: 'Perdus après 3 jours sans RDV', value: (t) => t.lost, text: (t) => fr(t.lost),
      sub: (t) => `${fr(t.lost / Math.max(1, t.people.length), 1)} par sales`, flag: (t) => t.lost / Math.max(1, t.people.length), flagText: 'perd le plus', tone: 'is-worst',
      detail: (t) => <Detail kicker={t.team} title="Partis au pool après 3 jours sans RDV" value={fr(t.lost)}
        rows={[...t.people.filter((p) => p.lost).map((p) => [p.name, fr(p.lost)]), ['Total du mois, toutes équipes', fr(data.lost_total)], ['Rattachés à un sales', fr(data.lost_attributed)]]}
        lines={['Le CRM ne garde que le dernier sales qui a perdu un lead : un lead perdu deux fois compte pour le dernier.']}
        source="Leads encore au pool ou repris depuis le pool dans la période" /> },
    { key: 'claims', title: 'Leads repris au pool réactivité', value: (t) => t.claims, text: (t) => fr(t.claims),
      sub: (t) => (t.claim_median_biz_min == null ? '' : `médiane ${fmtMin(t.claim_median_biz_min)} ouvrées`), flag: (t) => t.claims, flagText: 'la plus réactive', tone: 'is-best',
      detail: (t) => <Detail kicker={t.team} title="Reprises au pool réactivité" value={fr(t.claims)}
        rows={[['Délai médian (heures ouvrées)', fmtMin(t.claim_median_biz_min)], ['Délai médian (brut)', fmtMin(t.claim_median_min)],
          ...t.people.filter((p) => p.claims).map((p) => [p.name, `${fr(p.claims)} · ${fmtMin(p.claim_median_biz_min)}`])]}
        source="Entrée au pool = dernier raté du lead ; reprise = « Je le prends »" /> },
  ];
  return (
    <div className="ps2-treact">
      {panels.map((pnl) => {
        const max = Math.max(1, ...teams.map(pnl.value));
        const top = Math.max(...teams.map(pnl.flag));
        return (
          <div key={pnl.key} className="ps2-treact-panel">
            <span className="ps2-mono">{pnl.title}</span>
            {teams.map((t, i) => {
              const v = pnl.value(t);
              const flag = pnl.flag(t) === top && top > 0;
              return (
                <Info key={t.team} className={`ps2-treact-row${t.team === team.team ? ' is-me' : ''}`} label={`${t.team} : ${pnl.text(t)}`} detail={pnl.detail(t)}>
                  <span className="ps2-treact-name"><i style={{ background: t.color || '#1e3a7b' }} />{t.team.replace('Équipe ', '')}
                    </span>
                  <span className="ps2-treact-bar"><Motion.i initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.08 }}
                    style={{ background: t.color || '#1e3a7b' }} /></span>
                  <b className="ps2-num">{pnl.text(t)}</b>
                  <small>{pnl.sub(t)}{flag && <em className={pnl.tone}>{pnl.flagText}</em>}</small>
                </Info>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function TeamHead({ team, model, avatarFor }) {
  const p = model.pilot, days = p.days;
  const sold = team.values.sales, obj = team.objective;
  const fc = team.forecast, math = fc?.math;
  const needed = obj && days.remaining ? Math.max(0, obj - sold) / days.remaining : null;
  const reach = obj ? pct(sold, obj) : null;
  const expected = obj ? (obj * days.elapsed) / days.total : null;
  const basis = team.objective_basis;
  return (
    <Reveal as="section" className="ps2-span-12 ps2-team-head" aria-label={team.team} variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.08 } } }}>
      <Motion.div className="ps2-team-id" variants={ITEM}>
        <Info className="ps2-ring-btn" label="Objectif de l’équipe, détail"
          detail={<Detail kicker={team.team} title="Objectif d’équipe" value={obj ?? '–'}
            rows={basis ? [['Objectif du mois', fr(basis.month)], ['Sales de l’équipe', fr(basis.people)], ['Sales des équipes', fr(basis.headcount)]] : []}
            lines={basis ? [`${basis.month} × ${basis.people} ÷ ${basis.headcount} = ${obj}`] : []}
            source="Part de l’objectif du mois au prorata des sales" />}>
          <Ring value={reach} size={104} stroke={10} track="var(--line-2)" color={team.color || '#1e3a7b'} label={`${sold} ventes sur ${obj}`}>
            <b className="ps2-num" style={{ fontSize: 22 }}>{sold}</b><small>/ {obj ?? '–'}</small>
          </Ring>
        </Info>
        <div>
          <div className="ps2-mono">{team.people} sales</div>
          <div className="ps2-team-title">{team.team}</div>
          <div className="ps2-faces">
            {(team.members || []).map((m, i) => (
              <Motion.span key={m} title={m} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.4, ease: EASE }}>
                <Face name={m} url={avatarFor?.(m)} />
              </Motion.span>
            ))}
          </div>
        </div>
      </Motion.div>
      <TeamKpi label="Ventes" value={<><CountUp value={sold} />{obj ? <small> / {obj}</small> : null}</>}
        note={expected != null ? `${sold - Math.round(expected) >= 0 ? '+' : '−'}${Math.abs(sold - Math.round(expected))} sur l’attendu (${Math.round(expected)})` : null}
        tone={expected != null && sold >= expected ? 'ps2-good' : 'ps2-low'}
        detail={<Detail kicker="Ventes de l’équipe" value={sold} rows={[['Signatures', fr(team.values.signed)], ['CA déclaré', euro(team.total_revenue)], ['Attendu à date', expected != null ? fr(expected, 1) : '–']]}
          lines={expected != null ? [`${obj} × ${days.elapsed} ÷ ${days.total} jours ouvrés = ${fr(expected, 1)}`] : []} />} />
      <TeamKpi label="Rythme nécessaire" value={needed == null ? '–' : <>{fr(needed, 1)}<small> / jour</small></>}
        note={math ? `rythme actuel ${fr(math.recent_rate, 1)}` : null} tone={math && needed != null && math.recent_rate >= needed ? 'ps2-good' : 'ps2-low'}
        detail={<Detail kicker="Rythme nécessaire" value={needed == null ? '–' : `${fr(needed, 2)} / jour`}
          lines={needed == null ? [] : [`(${obj} − ${sold}) ÷ ${days.remaining} jours ouvrés = ${fr(needed, 2)}`, math && `semaine en cours : ${fr(math.recent_rate, 2)} / jour, mois : ${fr(math.month_rate, 2)} / jour`]} />} />
      <TeamKpi label="Projection" value={math ? <>{math.recent_pace}<small> → {math.month_pace}</small></> : '–'}
        note={fc ? `plancher RDV ${fc.projection.sales}` : null} tone="ps2-soft"
        detail={fc ? <Detail kicker="Projection de l’équipe" rows={[['Rythme récent', `${math.recent_pace}`], ['Rythme du mois', `${math.month_pace}`], ['Plancher : RDV planifiés', `${fc.projection.sales} (${fc.low.sales} à ${fc.high.sales})`],
          ['R1 à venir', fr(fc.upcoming.r1)], ['R2 à venir', fr(fc.upcoming.r2)]]} /> : <Detail kicker="Projection" title="Mois terminé" />} />
      <TeamKpi label="CA déclaré" value={<CountUp value={team.total_revenue} format={euro} />} note={`${fr(team.values.leads)} leads`} tone="ps2-soft"
        detail={<Detail kicker="CA déclaré" value={euro(team.total_revenue)} rows={[['Ventes', fr(sold)], ['CA par vente', sold ? euro(team.total_revenue / sold) : '–'], ['CA par sales', euro(team.total_revenue / Math.max(1, team.people))]]} />} />
    </Reveal>
  );
}

function TeamKpi({ label, value, note, tone, detail }) {
  return (
    <Info as="motion" className="ps2-kpi ps2-team-kpi" variants={ITEM} label={`${label}, détail`} detail={detail}>
      <span className="ps2-kpi-label">{label}</span>
      <span className="ps2-kpi-value ps2-num">{value}</span>
      {note && <span className={`ps2-kpi-note ${tone}`}>{note}</span>}
    </Info>
  );
}

function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  const initials = String(name || '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className="ps2-avatar is-soft ps2-face">
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : initials}
    </span>
  );
}

// Par sales, face aux autres équipes (dev 14/10/2026 : la décomposition « D'où vient l'écart » : « on comprend rien ») :
// pour chaque étape, ce que fait un sales de l'équipe en moyenne ce mois-ci, à côté d'un sales des autres équipes.
const PER_SALES = [['leads', 'Leads', 1], ['r1e', 'R1 effectués', 1], ['r2e', 'R2 effectués', 1], ['sales', 'Ventes', 1], ['revenue', 'CA déclaré', 0]];

function PerSales({ team, teams }) {
  const drawn = useDrawn();
  const others = teams.filter((t) => t.team !== team.team);
  const people = others.reduce((a, t) => a + (t.people || 0), 0) || 1;
  const value = (t, k) => (k === 'revenue' ? t.total_revenue || 0 : t.values?.[k] || 0);
  const color = team.color || 'var(--navy)';
  return (
    <div className="ps2-persales">
      <div className="ps2-persales-legend"><span><i style={{ background: color }} />{team.team.replace('Équipe ', 'Éq. ')}</span><span><i />autres équipes</span></div>
      {PER_SALES.map(([k, label, digits], i) => {
        const mine = value(team, k) / Math.max(1, team.people || 0);
        const theirs = others.reduce((a, t) => a + value(t, k), 0) / people;
        const max = Math.max(mine, theirs, 1e-9);
        const delta = theirs ? Math.round(((mine - theirs) / theirs) * 100) : null;
        const fmt = (n) => (k === 'revenue' ? euro(n) : fr(n, digits));
        return (
          <Info key={k} className="ps2-persales-row" label={`${label} par sales, détail`}
            detail={<Detail kicker={`${label} par sales`} rows={[[team.team, fmt(mine), 'ps2-strong'], ['Autres équipes', fmt(theirs)],
              [`${team.team} au total`, k === 'revenue' ? euro(value(team, k)) : fr(value(team, k))], ['Sales de l’équipe', fr(team.people)], ['Sales des autres équipes', fr(people)]]} />}>
            <span className="ps2-persales-label">{label}</span>
            <span className="ps2-persales-bars">
              <span><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${(mine / max) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.1 }} style={{ background: color }} /><b className="ps2-num">{fmt(mine)}</b></span>
              <span><Motion.i initial={{ width: 0 }} animate={{ width: drawn ? `${(theirs / max) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.1 }} style={{ background: '#cfd6e3' }} /><b className="ps2-num ps2-soft">{fmt(theirs)}</b></span>
            </span>
            {delta != null && <span className={`ps2-score-delta${delta < 0 ? ' is-bad' : ''}`}>{delta > 0 ? '+' : ''}{delta} %</span>}
          </Info>
        );
      })}
    </div>
  );
}

const COMPARE = [
  { key: 'leadsPerSales', label: 'Leads par sales', format: (v) => fr(v, 1), better: 'high' },
  { key: 'r1PerLead', label: 'R1 effectués / lead', format: (v) => `${fr(v * 100, 1)} %`, better: 'high' },
  { key: 'noshow', label: 'No-show R1', format: (v) => (v == null ? '–' : `${fr(v * 100, 0)} %`), better: 'low' },
  { key: 'r2PerR1', label: 'R2 effectués / R1', format: (v) => `${fr(v * 100, 0)} %`, better: 'high' },
  { key: 'salesPerR2', label: 'Ventes / R2', format: (v) => `${fr(v * 100, 0)} %`, better: 'high' },
  { key: 'salesPer100', label: 'Ventes pour 100 leads', format: (v) => fr(v, 1), better: 'high' },
];

function Compare({ teams, team }) {
  const drawn = useDrawn();
  const all = teams.map((t) => ({ t, r: rates(t) }));
  return (
    <div className="ps2-compare">
      {COMPARE.map((c, row) => {
        const values = all.map((a) => a.r[c.key]).filter((v) => v != null);
        if (!values.length) return null;
        const lo = Math.min(...values), hi = Math.max(...values);
        const pad = (hi - lo) * 0.25 || hi * 0.2 || 1;
        const x = (v) => `${((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`;
        const mine = all.find((a) => a.t.team === team.team)?.r[c.key];
        const rank = [...values].sort((a, b) => (c.better === 'high' ? b - a : a - b)).indexOf(mine) + 1;
        return (
          <div key={c.key} className="ps2-compare-row">
            <span className="ps2-compare-label">{c.label}</span>
            <span className="ps2-compare-track">
              <span className="ps2-compare-line" />
              {all.map(({ t, r }, i) => {
                const v = r[c.key];
                if (v == null) return null;
                const me = t.team === team.team;
                return (
                  <Motion.span key={t.team} className={`ps2-compare-dot${me ? ' is-me' : ''}`} style={{ '--c': t.color || '#1e3a7b', zIndex: me ? 2 : 1 }}
                    initial={{ left: '50%', opacity: 0 }} animate={drawn ? { left: x(v), opacity: 1 } : {}} transition={{ duration: 0.9, ease: EASE, delay: 0.15 + row * 0.06 + i * 0.05 }}
                    title={`${t.team} : ${c.format(v)}`}>
                    <i />{me && <em className="ps2-num">{c.format(v)}</em>}
                  </Motion.span>
                );
              })}
            </span>
            <span className={`ps2-compare-rank ${rank === 1 ? 'is-good' : rank === values.length ? 'is-low' : ''}`}>{rank} / {values.length}</span>
          </div>
        );
      })}
      <div className="ps2-compare-legend">
        {teams.map((t) => <span key={t.team}><i style={{ background: t.color || '#1e3a7b' }} />{t.team.replace('Équipe ', '')}</span>)}
      </div>
    </div>
  );
}

