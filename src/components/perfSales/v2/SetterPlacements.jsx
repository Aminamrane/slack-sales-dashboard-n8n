import React, { useCallback, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal } from '../motion';
import { Detail, usePop } from './Pop';
import { fr, initials } from './model';
import LeadHistoryPanel from './LeadHistory';
import { monthRange, usePlacements } from './setterApi';

// RDV posés par jour par les setters (dev 16/10/2026 : « il nous faut les rendez-vous par jour, la moyenne de chacun,
// et une période : ce mois-ci, le mois dernier, 7 jours, aujourd'hui, ou un jour donné »). Datés de la pose, pas de la
// date du RDV (/monitoring/performance/v2/setters/placed) ; reprogrammations à part ; moyenne par jour ouvré écoulé.

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parisToday = () => {
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;   // « 2026-10-16 »
};
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const SOURCE = { 'setter-place': 'posés depuis le CRM', 'notification-backfill': 'posés depuis le CRM', 'barrage-traitement': 'posés au barrage', 'tunnel-webinaire': 'réservés via le lien webinaire du setter' };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dayName = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
const weekend = (s) => [0, 6].includes(new Date(`${s}T12:00:00`).getDay());
// Teinte d'une case : du bleu clair Owner au marine, selon la pose la plus forte de la grille.
const shade = (n, max) => {
  if (!n) return null;
  const t = Math.min(1, n / Math.max(1, max));
  const mix = (a, b) => Math.round(a + (b - a) * (0.25 + 0.75 * t));
  return `rgb(${mix(219, 30)}, ${mix(227, 58)}, ${mix(241, 123)})`;
};

export default function SetterPlacements({ period, dark, avatarFor, rdvMonth }) {
  const today = parisToday();
  const month = /^\d{4}-\d{2}$/.test(period || '') ? period : today.slice(0, 7);
  const PRESETS = [
    ['today', 'Aujourd’hui', [today, today]],
    ['week', '7 derniers jours', [addDays(today, -6), today]],
    ['month', `${MONTHS[Number(month.slice(5, 7)) - 1]}`, monthRange(month)],
    ['last', `${MONTHS[Number(prevMonth(month).slice(5, 7)) - 1]}`, monthRange(prevMonth(month))],
  ];
  const [preset, setPreset] = useState('month');
  const [day, setDay] = useState('');
  const range = day ? [day, day] : PRESETS.find(([k]) => k === preset)[2];
  const [data, error] = usePlacements(range[0], range[1]);
  const [hist, setHist] = useState(null);
  const closeHist = useCallback(() => setHist(null), []);
  const open = usePop();
  const single = range[0] === range[1];
  const days = useMemo(() => data?.days || [], [data]);
  const max = useMemo(() => Math.max(1, ...(data?.setters || []).flatMap((s) => Object.values(s.by_day))), [data]);
  const showToday = data && range[0] <= today && today <= range[1] && !single;

  const cellDetail = (s, d) => {
    const list = (data?.rows || []).filter((r) => r.setter_id === s.id && r.placed_at.slice(0, 10) === d && r.source !== 'patch-setter');
    return (close) => (
      <Detail kicker={`${s.name} · ${dayName(d)}`} title="RDV posés" value={fr(list.length)}>
        <ul className="ps2-place-list">
          {list.map((r) => (
            <li key={`${r.lead_id}-${r.placed_at}`}>
              <button type="button" onClick={() => { close(); setHist({ id: r.lead_id, name: r.name, company: r.company, now: r.sales }); }}>
                <span className="ps2-num">{r.placed_at.slice(11, 16).replace(':', ' h ')}</span>
                <span className={`ps2-agenda-tag is-${r.kind}`}>{r.kind.toUpperCase()}</span>
                <span className="ps2-place-who"><b>{r.name || `#${r.lead_id}`}</b><small>{[r.sales, r.source_label, r.rdv_at ? `RDV le ${r.rdv_at.slice(8, 10)}/${r.rdv_at.slice(5, 7)}` : null].filter(Boolean).join(' · ')}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </Detail>
    );
  };

  return (
    <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-place-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-place-title">RDV posés par jour</h2>
        <span className="ps2-place-periods" role="group" aria-label="Période">
          {PRESETS.map(([k, l]) => (
            <button type="button" key={k} className={!day && preset === k ? 'is-on' : ''} onClick={() => { setDay(''); setPreset(k); }}>
              {!day && preset === k && <Motion.span layoutId="ps2-place-pill" className="ps2-place-pill" transition={{ duration: 0.35, ease: EASE }} />}
              <span>{l}</span>
            </button>
          ))}
          <label className={`ps2-place-day${day ? ' is-on' : ''}`}>
            <span>Jour</span>
            <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} aria-label="Choisir un jour" />
          </label>
        </span>
      </Motion.div>
      {error && <p className="ps2-note" role="alert">Poses non chargées.</p>}
      {!data && !error && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
      {data && (
        <>
          <Motion.div variants={ITEM} className="ps2-place-kpis">
            <button type="button" className="ps2-place-kpi-btn" onClick={(e) => open(e.currentTarget, <Detail kicker="RDV posés · date de la pose" value={fr(data.team.placed)}
              rows={[['R1', fr(data.setters.reduce((a, x) => a + x.r1, 0))], ['R2', fr(data.setters.reduce((a, x) => a + x.r2, 0))],
                ...Object.entries(data.setters.reduce((m, x) => { Object.entries(x.sources).forEach(([k, v]) => { if (k !== 'patch-setter') m[SOURCE[k] || k] = (m[SOURCE[k] || k] || 0) + v; }); return m; }, {}))
                  .map(([k, v]) => [k, fr(v)]), ['Reprogrammés, à part', fr(data.team.reprog)]]}
              lines={[rdvMonth != null && preset === 'month' && !day ? `La tuile « RDV posés » du haut (${fr(rdvMonth)}) compte les RDV dont la date tombe dans le mois, posés avant ou pendant le mois.` : null]} />)}>
              <b className="ps2-num"><CountUp value={data.team.placed} duration={700} /></b>RDV posés</button>
            {!single && <span><b className="ps2-num">{data.team.avg == null ? '–' : fr(data.team.avg, 1)}</b>par jour ouvré · {fr(data.elapsed_open_days)} j</span>}
            {showToday && <span><b className="ps2-num">{fr(data.team.today)}</b>aujourd’hui</span>}
            <span><b className="ps2-num">{fr(data.team.reprog)}</b>reprogrammés</span>
          </Motion.div>
          {single ? (
            <div className="ps2-place-bars">
              {data.setters.map((s, i) => (
                <Motion.button type="button" key={s.id} className="ps2-place-bar" disabled={!s.placed} onClick={(e) => s.placed && open(e.currentTarget, cellDetail(s, range[0]))}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE, delay: i * 0.03 }}>
                  <Face name={s.name} url={avatarFor?.(s.name)} />
                  <span className="ps2-place-name">{s.name}</span>
                  <span className="ps2-place-track"><Motion.i initial={{ width: 0 }} animate={{ width: `${(s.placed / Math.max(1, ...data.setters.map((x) => x.placed))) * 100}%` }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.03 }} /></span>
                  <b className="ps2-num">{fr(s.placed)}</b>
                  <small>{s.reprog ? `+ ${fr(s.reprog)} reprog.` : ''}</small>
                </Motion.button>
              ))}
            </div>
          ) : (
            <div className="ps2-place-wrap">
              <table className="ps2-place-grid" style={{ '--n': days.length }}>
                <thead>
                  <tr>
                    <th className="is-name">Setter</th>
                    {days.map((d) => <th key={d} className={`${weekend(d) ? 'is-we' : ''}${d === today ? ' is-today' : ''}`} title={d}>{Number(d.slice(8, 10))}</th>)}
                    <th className="is-tot">Total</th><th className="is-tot">Moy. / j</th>{showToday && <th className="is-tot">Auj.</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.setters.map((s, i) => (
                    <Motion.tr key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: i * 0.03 }}>
                      <td className="is-name"><span><Face name={s.name} url={avatarFor?.(s.name)} />{s.name}</span></td>
                      {days.map((d, k) => {
                        const n = s.by_day[d] || 0;
                        const bg = shade(n, max);
                        return (
                          <td key={d} className={weekend(d) ? 'is-we' : ''}>
                            {n ? (
                              <Motion.button type="button" className="ps2-place-cell" style={{ background: bg, color: n / max > 0.45 ? '#fff' : '#1e3a7b' }}
                                onClick={(e) => open(e.currentTarget, cellDetail(s, d))} aria-label={`${s.name}, ${dayName(d)} : ${n} RDV posés`}
                                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, ease: EASE, delay: Math.min(0.6, 0.05 + i * 0.03 + k * 0.008) }}>
                                {n}</Motion.button>
                            ) : <span className="ps2-place-empty" />}
                          </td>
                        );
                      })}
                      <td className="is-tot"><b className="ps2-num">{fr(s.placed)}</b>{s.reprog ? <small> +{s.reprog}</small> : null}</td>
                      <td className="is-tot ps2-num">{s.avg == null ? '–' : fr(s.avg, 1)}</td>
                      {showToday && <td className="is-tot ps2-num">{s.today || <span className="ps2-muted">0</span>}</td>}
                    </Motion.tr>
                  ))}
                  <tr className="is-team">
                    <td className="is-name">Équipe</td>
                    {days.map((d) => <td key={d} className={`ps2-num${weekend(d) ? ' is-we' : ''}`}>{data.team.by_day[d] || ''}</td>)}
                    <td className="is-tot"><b className="ps2-num">{fr(data.team.placed)}</b></td>
                    <td className="is-tot ps2-num">{data.team.avg == null ? '–' : fr(data.team.avg, 1)}</td>
                    {showToday && <td className="is-tot ps2-num">{fr(data.team.today)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LeadHistoryPanel lead={hist} dark={dark} onClose={closeHist} />
    </Reveal>
  );
}

function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: '0 0 24px', width: 24, height: 24, fontSize: 9.5, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}
