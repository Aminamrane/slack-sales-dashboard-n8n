import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, Ring, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr } from './model';

// Réactivité (dev 14/10/2026 : « pourquoi tu ne mets pas toutes les arrivées des leads qu'on a eues ? Il faut qu'on puisse
// choisir la période, une période donnée qu'on veut »). Période au choix en tête ; la prise en main porte sur les leads
// ADS affectés (l'horloge de la règle des 6 minutes) ; l'arrivée couvre tous les leads de la période.
const PRESETS = [['month', 'Mois affiché'], ['7d', '7 jours'], ['30d', '30 jours'], ['prev', 'Mois précédent'], ['custom', 'Dates']];
const BUCKETS = [['d0', 'Jour même', '#3e7d5a'], ['d1', 'J+1', '#e6b45a'], ['d2', 'J+2', '#d4834a'], ['d3plus', 'J+3 et +', '#c2410c']];
const FAMILIES = { ads: 'ADS', setters: 'Setters', cold_call: 'Cold call sales', linkedin: 'LinkedIn', webinar: 'Webinaire', referral: 'Parrainage', other: 'Autres' };
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const fmtMin = (m) => (m == null ? '–' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`);
const pctTone = (v, good, mid) => (v == null ? '#94a3b8' : v >= good ? '#3e7d5a' : v >= mid ? '#d4a017' : '#c2410c');

// Choix de la période (mois affiché, 7 ou 30 jours, mois précédent, dates libres) ; repris par la présence par jour et heure.
export function PeriodBar({ period, onPeriod, analytics, warning, loading }) {
  const range = analytics?.period ? `${dm(analytics.period.start)} → ${dm(shift(analytics.period.end, -1))}` : '';
  return (
    <div className="ps2-react-bar">
      <div className="ps2-segment" role="group" aria-label="Période">
        {PRESETS.map(([k, l]) => <button type="button" key={k} aria-pressed={period.key === k} onClick={() => onPeriod({ ...period, key: k })}>{l}</button>)}
      </div>
      {period.key === 'custom' && (
        <span className="ps2-dates">
          <input type="date" aria-label="Début" value={period.start || ''} max={period.end || undefined} onChange={(e) => onPeriod({ ...period, start: e.target.value })} />
          <span>→</span>
          <input type="date" aria-label="Fin" value={period.end || ''} min={period.start || undefined} onChange={(e) => onPeriod({ ...period, end: e.target.value })} />
        </span>
      )}
      {range && <span className="ps2-chip-soft">{range}</span>}
      {warning && <span className="ps2-chip-soft is-warn">{warning}</span>}
      {loading && <span className="ps2-spinner" aria-label="Chargement" />}
    </div>
  );
}

export default function Reactivity({ analytics, period, onPeriod, loading, error, warning, dark, salesFilter = () => true }) {
  const track = dark ? 'rgba(148,163,184,.18)' : '#eef1f6';
  const td = analytics?.treatment_delay;
  const g = td?.global;
  const all = analytics?.arrival_all;
  const sales = (td?.by_sales || []).filter((s) => salesFilter(s.sales));
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12"><PeriodBar period={period} onPeriod={onPeriod} analytics={analytics} warning={warning} loading={loading} /></div>
      {error && <div className="ps2-span-12 ps2-empty" role="alert">Période non chargée</div>}

      {g && (
        <>
          <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-sla">
            <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-sla">Règle des 6 minutes</h2><ScopeChip g={g} /></Motion.div>
            <Motion.div variants={ITEM} style={{ display: 'flex', gap: 22, alignItems: 'center', marginTop: 16 }}>
              <Info className="ps2-ring-btn" label="Règle des 6 minutes, détail"
                detail={<Detail kicker="Règle des 6 minutes" value={`${fr(g.sla_rate, 1)} %`} rows={[['Pris à temps', fr(g.sla_on_time)], ['Ratés', fr(g.sla_missed)]]}
                  lines={[`${g.sla_on_time} ÷ (${g.sla_on_time} + ${g.sla_missed}) = ${fr(g.sla_rate, 1)} %`, 'Arrivé hors heures : à prendre avant 13 h le jour ouvré suivant (un lead du samedi : lundi 13 h). Heures ouvrées : lun-ven 9 h-19 h, heure de Paris.']} />}>
                <Ring value={g.sla_rate} size={112} stroke={11} track={track} color={pctTone(g.sla_rate, 80, 60)} label={`À l’heure ${fr(g.sla_rate, 0)} %`}>
                  <b>{fr(g.sla_rate, 0)} %</b><small>à l’heure</small>
                </Ring>
              </Info>
              <div className="ps2-stat-stack">
                <div><b className="ps2-num"><CountUp value={g.sla_on_time} /></b><span>à temps</span></div>
                <div><b className="ps2-num ps2-low"><CountUp value={g.sla_missed} /></b><span>ratés</span></div>
              </div>
            </Motion.div>
          </Reveal>

          <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-take">
            <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-take">Prise en main</h2>
              <Info className="ps2-chip-soft" label="Médiane, détail"
                detail={<Detail kicker="Délai affectation → ouverture" rows={[['Médiane ouvrée', fmtMin(g.median_biz_minutes)], ['Moyenne ouvrée', fmtMin(g.mean_biz_minutes)],
                  ['Médiane brute', fmtMin(g.median_minutes)], ['Moyenne brute', fmtMin(g.mean_minutes)], ['Leads pris en main', `${fr(g.n_treated)} / ${fr(g.n_assigned)}`]]}
                  lines={['Ouvrée : seules comptent les heures 9 h-19 h en semaine.']} />}>
                médiane {fmtMin(g.median_biz_minutes)}</Info></Motion.div>
            <Motion.div variants={ITEM}><Buckets g={g} /></Motion.div>
          </Reveal>

          <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-same">
            <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-same">Jour même</h2></Motion.div>
            <Motion.div variants={ITEM} style={{ display: 'flex', gap: 22, alignItems: 'center', marginTop: 16 }}>
              <Ring value={g.same_day_pct} size={112} stroke={11} track={track} color={pctTone(g.same_day_pct, 70, 50)} label={`Jour même ${fr(g.same_day_pct, 0)} %`}>
                <b>{fr(g.same_day_pct, 0)} %</b><small>jour même</small>
              </Ring>
              <div className="ps2-stat-stack">
                <div><b className="ps2-num"><CountUp value={g.d0} /></b><span>sur {fr(g.n_treated)}</span></div>
                <div><b className="ps2-num">{fmtMin(g.median_minutes)}</b><span>médiane brute</span></div>
              </div>
            </Motion.div>
          </Reveal>
        </>
      )}

      {all && <Arrivals all={all} />}

      {sales.length > 0 && (
        <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-react-sales">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-react-sales">Par sales</h2>
            <span className="ps2-legend">{BUCKETS.map(([k, l, c]) => <span key={k}><i style={{ borderColor: c, borderTopWidth: 6, borderRadius: 3, width: 10 }} />{l}</span>)}</span></Motion.div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <Motion.table className="ps2-table" style={{ minWidth: 680 }} variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } } }}>
              <thead><tr><th>Sales</th><th>Leads</th><th>Jour même</th><th style={{ textAlign: 'left', width: '30%' }}>Répartition</th><th>Médiane ouvrée</th><th>À l’heure</th></tr></thead>
              <tbody>
                {sales.map((s, i) => (
                  <Motion.tr key={s.sales} variants={ITEM}>
                    <td style={{ fontWeight: 600 }}>{s.sales}</td>
                    <td>{fr(s.n)}</td>
                    <td style={{ fontWeight: 650, color: pctTone(s.same_day_pct, 70, 50) }}>{fr(s.same_day_pct, 0)} %</td>
                    <td style={{ textAlign: 'left' }}><Split row={s} index={i} /></td>
                    <td>{fmtMin(s.median_biz_minutes)}</td>
                    <td style={{ fontWeight: 650, color: pctTone(s.sla_rate, 80, 60) }}>{s.sla_rate == null ? '–' : `${fr(s.sla_rate, 0)} %`}
                      {s.sla_missed > 0 && <span className="ps2-muted" style={{ fontWeight: 500, fontSize: 11.5 }}> · {s.sla_missed} raté{s.sla_missed > 1 ? 's' : ''}</span>}</td>
                  </Motion.tr>
                ))}
              </tbody>
            </Motion.table>
          </div>
        </Reveal>
      )}
    </div>
  );
}

function shift(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ScopeChip({ g }) {
  return (
    <Info className="ps2-chip-soft" label="Périmètre, détail"
      detail={<Detail kicker="Périmètre" rows={[['Leads ADS affectés', fr(g.n_assigned)], ['Pris en main', fr(g.n_treated)]]}
        lines={['Leads ADS reçus dans la période et affectés, jusqu’à leur ouverture par le sales.', 'Sans les reprises du pool, le cold call, les setters, LinkedIn, le parrainage et le webinaire.']} />}>
      ADS affectés · {fr(g.n_assigned)}</Info>
  );
}

function Buckets({ g }) {
  const drawn = useDrawn();
  const total = Math.max(1, g.n_treated);
  const max = Math.max(1, ...BUCKETS.map(([k]) => g[k] || 0));
  return (
    <div className="ps2-buckets">
      {BUCKETS.map(([k, l, c], i) => {
        const v = g[k] || 0;
        return (
          <div key={k} className="ps2-bucket">
            <span className="ps2-num"><b>{fr(v)}</b> <small>{Math.round((v / total) * 100)} %</small></span>
            <span className="ps2-bucket-col"><Motion.i style={{ background: c }} initial={{ height: 0 }} animate={{ height: drawn ? `${Math.max(3, (v / max) * 100)}%` : 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.1 }} /></span>
            <small>{l}</small>
          </div>
        );
      })}
    </div>
  );
}

function Split({ row, index }) {
  const drawn = useDrawn();
  const total = Math.max(1, row.n_treated);
  return (
    <span className="ps2-split-bar" role="img" aria-label={BUCKETS.map(([k, l]) => `${l} ${row[k] || 0}`).join(', ')}>
      {BUCKETS.map(([k, , c], i) => (
        <Motion.i key={k} style={{ background: c }} initial={{ width: 0 }} animate={{ width: drawn ? `${((row[k] || 0) / total) * 100}%` : 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 + index * 0.03 + i * 0.05 }} />
      ))}
    </span>
  );
}

// Quand arrivent les leads (dev 14/10/2026 : « normalement la plupart arrivent hors heures, la majorité le week-end ;
// check » ; vérifié : les leads ADS d'octobre arrivent à 74 % hors heures ; le graphique mélangeait les imports de
// l'outil de scraping des setters, créés en masse aux heures de bureau). Par défaut les leads ENTRANTS (ADS, webinaire,
// LinkedIn, parrainage) ; le cold call et les imports setters à part. Une grille jour × heure (la surface d'un rond =
// le nombre de leads arrivés sur ce créneau), la plage 9 h-19 h en semaine encadrée, et la répartition hors heures.
const FAMILY_GROUPS = [
  { key: 'inbound', label: 'Leads entrants', members: ['ads', 'webinar', 'linkedin', 'referral'] },
  { key: 'ads', label: 'ADS', members: ['ads'] },
  { key: 'webinar', label: 'Webinaire', members: ['webinar'] },
  { key: 'linkedin', label: 'LinkedIn', members: ['linkedin'] },
  { key: 'referral', label: 'Parrainage', members: ['referral'] },
  { key: 'cold_call', label: 'Cold call sales', members: ['cold_call'], staff: true },
  { key: 'setters', label: 'Setters (outil de scraping)', members: ['setters'], staff: true },
];
const PARTS = [['weekend', 'Week-end', '#1e3a7b'], ['after_close', 'Soir', '#3d5ba8'], ['before_open', 'Matin', '#7f9ad9'], ['in_hours', 'En heures', '#d6deee']];

function merge(fams, members) {
  const out = { n: 0, in_hours: 0, weekend: 0, after_close: 0, before_open: 0, grid: Array.from({ length: 7 }, () => Array(24).fill(0)) };
  for (const m of members) {
    const f = fams[m];
    if (!f) continue;
    for (const k of ['n', 'in_hours', 'weekend', 'after_close', 'before_open']) out[k] += f[k] || 0;
    (f.grid || []).forEach((row, d) => row.forEach((v, h) => { out.grid[d][h] += v; }));
  }
  return out;
}

function Arrivals({ all }) {
  const drawn = useDrawn();
  const fams = all.families || {};
  const groups = FAMILY_GROUPS.filter((g) => g.members.some((m) => fams[m]?.n));
  const [pick, setPick] = useState('inbound');
  const [hover, setHover] = useState(null);
  const group = groups.find((g) => g.key === pick) || groups[0];
  if (!group) return null;
  const data = merge(fams, group.members);
  const ws = all.work_start ?? 9, we = all.work_end ?? 19;
  const out = data.n - data.in_hours;
  const max = Math.max(1, ...data.grid.flat());
  const S = 30, G = 3, L = 40, T = 22, R = 52, B = 26;
  const W = L + 24 * S + R, H = T + 7 * S + B;
  const rowSum = data.grid.map((r) => r.reduce((a, v) => a + v, 0));
  const colSum = Array.from({ length: 24 }, (_, h) => data.grid.reduce((a, r) => a + r[h], 0));
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const shown = hover ? data.grid[hover.d][hover.h] : null;
  // Teinte d'une case : du bleu très clair (1 lead) au bleu marine (le créneau le plus chargé).
  const tint = (v) => `color-mix(in srgb, #1e3a7b ${Math.round(14 + 86 * Math.sqrt(v / max))}%, #eef2f9)`;
  return (
    <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-arrivals">
      <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-arrivals">Quand arrivent les leads</h2></Motion.div>
      <Motion.div variants={ITEM} className="ps2-picker" role="radiogroup" aria-label="Leads">
        {groups.map((g) => (
          <button type="button" key={g.key} role="radio" aria-checked={group.key === g.key} className={`ps2-pick${g.staff ? ' is-staff' : ''}`} onClick={() => setPick(g.key)}>
            {group.key === g.key && <Motion.span layoutId="ps2-arrival-pill" className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{g.label}<small className="ps2-num">{fr(merge(fams, g.members).n)}</small></span>
          </button>
        ))}
      </Motion.div>
      <div className="ps2-arrivals">
        <Motion.div variants={ITEM} className="ps2-arrivals-grid">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${group.label} : ${fr(data.n)} leads, ${fr(out)} hors heures`} onMouseLeave={() => setHover(null)}>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <text key={h} x={L + h * S + S / 2} y={T - 8} textAnchor="middle" className="ps2-axis">{h} h</text>)}
            <text x={L + 24 * S + 10} y={T - 8} className="ps2-axis">total</text>
            {DAYS.map((d, i) => (
              <g key={d}>
                <text x={L - 8} y={T + i * S + S / 2 + 4} textAnchor="end" className="ps2-axis">{d}</text>
                {data.grid[i].map((v, h) => {
                  const x = L + h * S + G / 2, y = T + i * S + G / 2;
                  return (
                    <g key={h} onMouseEnter={() => setHover({ d: i, h })}>
                      <Motion.rect x={x} y={y} width={S - G} height={S - G} rx="6" fill={v ? tint(v) : 'var(--line-2)'}
                        stroke={hover?.d === i && hover?.h === h ? 'var(--ink)' : 'none'} strokeWidth="1.5"
                        initial={{ opacity: 0 }} animate={{ opacity: drawn ? 1 : 0 }} transition={{ duration: 0.4, ease: EASE, delay: drawn ? 0.05 + (i + h) * 0.015 : 0 }} />
                      {v > 0 && <text x={x + (S - G) / 2} y={y + (S - G) / 2 + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" pointerEvents="none"
                        fill={Math.sqrt(v / max) > 0.45 ? '#fff' : '#1e3a7b'} style={{ opacity: drawn ? 1 : 0, transition: 'opacity .4s ease .6s' }}>{v}</text>}
                    </g>
                  );
                })}
                <text x={L + 24 * S + 10} y={T + i * S + S / 2 + 4} fontSize="12" fontWeight="700" fill={i >= 5 ? '#1e3a7b' : 'var(--soft)'}>{rowSum[i]}</text>
              </g>
            ))}
            {/* Heures ouvrées, lundi-vendredi : un cadre sur la grille (la légende est sous la grille). */}
            <rect x={L + ws * S} y={T} width={(we - ws) * S} height={5 * S} rx="8" fill="none" stroke="#c2410c" strokeWidth="2" strokeDasharray="5 4" pointerEvents="none" />
            {colSum.map((v, h) => <text key={h} x={L + h * S + S / 2} y={T + 7 * S + 17} textAnchor="middle" fontSize="10" fontWeight="650" fill="var(--soft)">{v || ''}</text>)}
            {shown != null && (
              <g pointerEvents="none" transform={`translate(${Math.min(W - 70, Math.max(70, L + hover.h * S + S / 2))}, ${Math.max(14, T + hover.d * S - 8)})`}>
                <rect x="-66" y="-20" width="132" height="26" rx="13" fill="var(--ink)" />
                <text y="-2.5" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--card)">{DAYS[hover.d]} {hover.h} h · {shown} lead{shown > 1 ? 's' : ''}</text>
              </g>
            )}
          </svg>
          <div className="ps2-arr-legend">
            <span><i className="is-band" />heures ouvrées · lun-ven {ws} h-{we} h</span>
            <span className="ps2-arr-scale"><small>1 lead</small><i /><small>{max} leads</small></span>
          </div>
        </Motion.div>
        <Motion.div variants={ITEM} className="ps2-arrivals-side">
          <div className="ps2-arr-big">
            <b className="ps2-num"><CountUp value={data.n ? (out / data.n) * 100 : 0} format={(n) => `${Math.round(n)} %`} /></b>
            <span>hors heures ouvrées</span>
            <small className="ps2-num">{fr(out)} sur {fr(data.n)} {group.staff ? 'fiches créées' : 'leads arrivés'}</small>
          </div>
          <div className="ps2-arr-parts">
            {PARTS.map(([k, l, c], i) => (
              <div key={k} className="ps2-arr-part">
                <span className="ps2-arr-part-label"><i style={{ background: c }} />{l}</span>
                <span className="ps2-arr-part-track"><Motion.i style={{ background: c }} initial={{ width: 0 }}
                  animate={{ width: drawn ? `${(data[k] / Math.max(1, data.n)) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.08 }} /></span>
                <b className="ps2-num">{fr(data[k])}</b>
              </div>
            ))}
          </div>
        </Motion.div>
      </div>
    </Reveal>
  );
}
