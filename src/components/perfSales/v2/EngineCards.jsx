import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, ITEM, Reveal, reducedMotion, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr, initials } from './model';
import apiClient from '../../../services/apiClient';

// Équité et prévision du moteur d'auto-affectation (dev 14/10/2026 : « montrer que l'auto-affectation converge vers
// quelque chose d'équitable » ; puis : « la prévision ne prend pas en compte la règle des 6 minutes ni les indispos, elle
// est là à titre indicatif : montrer, avec le moteur d'auto-affectation ADS, que si le volume augmente ou si, à partir
// de maintenant, c'est le moteur pur, on sera à l'équilibre ; Yohan, Léo, Yanis et Gary doivent avoir plus que les
// autres ; prendre la moyenne des leads qu'on reçoit au moment de la prévision »).
// À gauche, ce que le moteur voit : par sales, leads reçus + tours passés en Indispo ou en absence = compteur, le même
// pour tous. À droite, la prévision calculée par le serveur avec le CODE DE PRODUCTION du moteur, seul, sans écriture
// (`auto_assign_forecast.py`) : ni Indispo, ni absence, ni règle des 6 minutes (« les indispos font partie des règles,
// avant l'auto-affectation faisait sans »).
const SCOPES = [
  ['all', 'Tous', [1, 2, 3, 4, 5]], ['base', '1 à 10 sal.', [1, 2, 3]], ['bonus', '11 sal. et +', [4, 5]],
  ['1', '1-2', [1]], ['2', '3-5', [2]], ['3', '6-10', [3]], ['4', '11-19', [4]], ['5', '20+', [5]],
];
const HORIZONS = [[0, 'Fin du mois'], [1, '+1 mois'], [2, '+2 mois'], [3, '+3 mois']];
const CATS = [1, 2, 3, 4, 5];
const GROUPS = { big: ['11 sal. et +', '#1e3a7b'], base: ['Autres sales', '#3e7d5a'] };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const at = (obj, c) => obj?.[c] ?? obj?.[String(c)] ?? 0;
const pct = (v, d = 0) => `${fr(v * 100, d)} %`;
const dayName = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthEnd = (iso, plus) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) + plus, 0, 12)).toISOString().slice(0, 10);
const span = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const groupOf = (p) => (p.elig.map(Number).some((c) => c >= 4) ? 'big' : 'base');
const catLabel = (c) => SCOPES.find(([k]) => k === String(c))[1];

export default function EngineCards({ e, avatarFor }) {
  const [scope, setScope] = useState('all');
  const [hover, setHover] = useState(null);
  const [horizon, setHorizon] = useState(0);
  // Prévision du serveur (code du moteur de production) : chargée une fois, rechargée quand le flux change.
  const [flow, setFlow] = useState(null);           // null = moyenne des 28 derniers jours
  const [fc, setFc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true); setFailed(false);
    const t = setTimeout(() => {
      apiClient.get(`/api/v1/monitoring/performance/v2/auto-assign/forecast${flow == null ? '' : `?flow=${flow}`}`)
        .then((d) => { if (alive) { setFc(d); setLoading(false); } })
        .catch(() => { if (alive) { setFailed(true); setLoading(false); } });
    }, flow == null ? 0 : 220);
    return () => { alive = false; clearTimeout(t); };
  }, [flow]);
  const cats = SCOPES.find(([k]) => k === scope)[2];
  // Sales concernés par le périmètre : leurs catégories éligibles qui en font partie, sommées.
  const rows = useMemo(() => e.people.map((p) => {
    const mine = cats.filter((c) => p.elig.map(Number).includes(c));
    if (!mine.length) return null;
    const sum = (obj) => mine.reduce((a, c) => a + at(obj, c), 0);
    return { ...p, mine, group: groupOf(p), real: sum(p.real), credit: sum(p.credit), counter: sum(p.counter),
      availability: at(p.availability, mine[0]) || null };
  }).filter(Boolean), [e, cats]);
  const grouped = new Set(rows.map((r) => r.mine.join())).size > 1;
  return (
    <>
      <div className="ps2-span-12 ps2-picker" role="radiogroup" aria-label="Catégorie d’effectif" style={{ marginTop: 0 }}>
        <span className="ps2-picker-label">Effectif</span>
        {SCOPES.map(([k, l]) => (
          <button type="button" key={k} role="radio" aria-checked={scope === k} className="ps2-pick" onClick={() => setScope(k)}>
            {scope === k && <Motion.span layoutId="ps2-engine-scope" className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{l}</span>
          </button>
        ))}
      </div>
      <Counters e={e} cats={cats} rows={rows} grouped={grouped} hover={hover} onHover={setHover} avatarFor={avatarFor} key={`c-${scope}`} />
      <Simulator e={e} cats={cats} rows={rows} grouped={grouped} hover={hover} onHover={setHover} avatarFor={avatarFor}
        horizon={horizon} onHorizon={setHorizon} forecast={{ fc, flow, setFlow, loading, failed }} key={`s-${scope}`} />
    </>
  );
}

function Face({ name, url, size = 26 }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: `0 0 ${size}px`, width: size, height: size, fontSize: 10, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

// Compteur du moteur : reçus + tours en Indispo ou en absence = compteur, le même pour tous à 1 ou 2 près (par groupe
// quand le périmètre mêle les sales qui reçoivent les 11 sal. et + et les autres).
function Counters({ e, cats, rows, grouped, hover, onHover, avatarFor }) {
  const on = useRevealed();
  const keys = grouped ? ['big', 'base'] : [rows[0]?.group || 'base'];
  const blocks = keys.map((g) => {
    const list = rows.filter((r) => !grouped || r.group === g).sort((a, b) => b.real - a.real || a.name.localeCompare(b.name));
    const level = Math.max(0, ...list.map((r) => r.counter));
    return { g, list, level, spread: list.length ? level - Math.min(...list.map((r) => r.counter)) : 0 };
  });
  const spread = Math.max(0, ...blocks.map((b) => b.spread));
  const fair = blocks.every((b) => b.spread <= Math.max(2, b.level * 0.01));
  const since = dm(e.engine_start);
  const label = (r) => (r.entrant ? 'Démarrage au niveau et Indispo' : 'Tours en Indispo ou absence');
  let i = 0;
  return (
    <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-engine-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-engine-title">Tours donnés par le moteur</h2>
        <Info className={`ps2-auto-missed${fair ? ' is-good' : ''}`} label="Écart du moteur, détail"
          detail={<Detail kicker={`Compteur du moteur · depuis le ${since}`} title={fair ? 'Même nombre de tours pour tous' : 'Écart entre compteurs'}
            value={`${spread} tour${spread > 1 ? 's' : ''}`}
            rows={cats.map((c) => [`Catégorie ${catLabel(c)}`, `niveau ${fr(at(e.level, c))} · écart ${at(e.spread, c)}`])}
            lines={['Le moteur sert toujours le compteur le plus bas de la catégorie.', 'Compteur = leads reçus + tours passés en Indispo, en absence ou un jour non travaillé. Ces tours ne sont jamais rattrapés.']} />}>
          <span>Écart</span><b className="ps2-num">{spread} tour{spread > 1 ? 's' : ''}</b>
        </Info>
      </Motion.div>
      <Motion.div variants={ITEM} className="ps2-eng-legend">
        <span><i className="is-real" />Reçus</span><span><i className="is-off" />En Indispo ou absence</span><span><i className="is-entry" />Démarrage (arrivés après le {since})</span>
      </Motion.div>
      {blocks.map((b) => (
        <div className="ps2-eng-rows" key={b.g}>
          {grouped && <div className="ps2-eng-group"><i style={{ background: GROUPS[b.g][1] }} />{GROUPS[b.g][0]}<span>catégories {b.g === 'big' ? '1 à 5' : '1 à 3'}</span></div>}
          {b.list.map((r) => {
            i += 1;
            return (
              <Info key={r.name} className={`ps2-eng-row${hover === r.name ? ' is-on' : ''}`} label={`${r.name}, détail`}
                onMouseEnter={() => onHover(r.name)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(r.name)} onBlur={() => onHover(null)}
                detail={<Detail kicker={r.entrant ? `${r.name} · arrivé le ${dm(r.first)}` : `${r.name} · depuis le ${since}`} title="Compteur du moteur" value={fr(r.counter)}
                  rows={[['Leads reçus', fr(r.real)], [label(r), fr(r.credit)], ['Part des tours prise', pct(r.real / Math.max(1, r.counter))],
                    ['Ratés des 6 min ce mois', fr(r.missed_sla)], r.availability != null ? ['Tours pris sur 28 jours', pct(r.availability)] : null]} />}>
                <span className="ps2-eng-name"><Face name={r.name} url={avatarFor?.(r.name)} /><span>{r.name}</span></span>
                <span className="ps2-eng-bar" style={{ width: `${(r.counter / Math.max(1, b.level)) * 100}%` }}>
                  <Motion.i className="is-real" initial={{ width: 0 }} animate={{ width: on ? `${(r.real / Math.max(1, r.counter)) * 100}%` : 0 }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.04 }} />
                  <Motion.i className={r.entrant ? 'is-entry' : 'is-off'} initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.04 }} style={{ flex: 1 }} />
                </span>
                <b className="ps2-num">{fr(r.counter)}</b>
              </Info>
            );
          })}
        </div>
      ))}
    </Reveal>
  );
}

// Prévision du moteur de production, seul, rejoué par le serveur à partir de ses compteurs d'aujourd'hui, au flux moyen
// des 28 derniers jours (réglable). Courbe : part de chacun dans les leads cumulés depuis le 1er du mois, par groupe ;
// chaque groupe converge vers sa part attendue (les sales qui reçoivent aussi les 11 sal. et + en ont plus).
function Simulator({ e, cats, rows, grouped, hover, onHover, avatarFor, horizon, onHorizon, forecast }) {
  const { fc, flow, setFlow, loading, failed } = forecast;
  const on = useRevealed();
  const uid = useId().replace(/:/g, '');
  const average = fc?.average ?? CATS.reduce((a, c) => a + at(e.rates, c), 0);
  const current = flow ?? Math.max(1, Math.round(average));
  const rates = fc ? Object.fromEntries(CATS.map((c) => [c, at(fc.rates, c)])) : Object.fromEntries(CATS.map((c) => [c, at(e.rates, c)]));
  const sim = useMemo(() => fc?.adds || {}, [fc]);
  const stepDown = () => setFlow(Math.max(5, current % 5 ? Math.floor(current / 5) * 5 : current - 5));
  const stepUp = () => setFlow(Math.min(150, current % 5 ? Math.ceil(current / 5) * 5 : current + 5));

  const end = monthEnd(e.month_start, horizon);
  const days = useMemo(() => Array.from({ length: span(e.month_start, end) + 1 }, (_, k) => addDays(e.month_start, k)), [e.month_start, end]);
  const todayIdx = days.indexOf(e.today);
  const last = days.length - 1;
  const [cursor, setCursor] = useState(todayIdx);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const play = (to = last) => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion()) { setCursor(to); return; }
    const from = todayIdx, dur = Math.min(4200, 900 + (to - from) * 28);
    const t0 = performance.now();
    setPlaying(true);
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      setCursor(Math.round(from + (to - from) * eased));
      if (k < 1) raf.current = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => { if (on && fc) play(last); return () => cancelAnimationFrame(raf.current); }, [on, last, fc]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Cumul depuis le 1er du mois, par sales : réel jusqu'à aujourd'hui, simulé ensuite.
  const series = useMemo(() => {
    const perDay = {};
    for (const [day, name, c, n] of e.daily) if (cats.includes(Number(c))) (perDay[name] ||= {})[day] = (perDay[name][day] || 0) + n;
    return rows.map((p) => {
      let run = 0;
      const real = days.slice(0, todayIdx + 1).map((d) => (run += perDay[p.name]?.[d] || 0));
      const s = sim[p.name] || {};
      const fut = days.slice(todayIdx + 1).map((_, k) => run + p.mine.reduce((a, c) => a + (at(s, c)?.[k] || 0), 0));
      return { ...p, month: run, values: [...real, ...fut], veteran: p.first < e.month_start };
    });
  }, [e, rows, days, todayIdx, sim, cats]);
  const vets = series.filter((r) => r.veteran);
  const totals = days.map((_, k) => vets.reduce((a, r) => a + r.values[k], 0));
  const shown = (k) => totals[k] >= Math.max(4, vets.length * 2);
  // Part attendue du moteur pur : chacun reçoit, dans chaque catégorie, flux ÷ nombre d'éligibles.
  const eligCount = Object.fromEntries(CATS.map((c) => [c, e.people.filter((p) => p.elig.map(Number).includes(c)).length]));
  const perDayOf = (r) => r.mine.reduce((a, c) => a + (eligCount[c] ? rates[c] / eligCount[c] : 0), 0);
  const expectedTotal = vets.reduce((a, r) => a + perDayOf(r), 0);
  const groups = (grouped ? ['big', 'base'] : [vets[0]?.group || 'base']).map((g) => {
    const members = vets.filter((r) => !grouped || r.group === g);
    const band = days.map((_, k) => {
      if (!members.length || !shown(k)) return null;
      const shares = members.map((r) => r.values[k] / totals[k]);
      return [Math.min(...shares), Math.max(...shares)];
    });
    return { g, members, band, target: members.length && expectedTotal ? perDayOf(members[0]) / expectedTotal : null };
  });
  const cur = Math.max(todayIdx, Math.min(cursor, last));

  const W = 640, H = 230, L = 40, R = 14, T = 22, B = 26;
  const x = (k) => L + (k / Math.max(1, last)) * (W - L - R);
  const top = Math.max(0.05, ...groups.flatMap((gr) => [gr.target || 0, ...gr.band.slice(0, todayIdx + 1).filter(Boolean).map((b) => b[1])])) * 1.15;
  const step = [0.01, 0.02, 0.05, 0.1, 0.2].find((st) => top / st <= 4) || 0.25;
  const yMax = Math.min(1, Math.ceil(top / step) * step);
  const y = (v) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const area = (band, from, to) => {
    const idx = []; for (let k = from; k <= to; k += 1) if (band[k]) idx.push(k);
    if (idx.length < 2) return '';
    return `M${idx.map((k) => `${x(k)},${y(band[k][1])}`).join('L')}L${[...idx].reverse().map((k) => `${x(k)},${y(band[k][0])}`).join('L')}Z`;
  };
  const line = (r, from, to) => {
    const idx = []; for (let k = from; k <= to; k += 1) if (shown(k)) idx.push(k);
    return idx.length > 1 ? `M${idx.map((k) => `${x(k)},${y(r.values[k] / totals[k])}`).join('L')}` : '';
  };
  const hovered = series.find((r) => r.name === hover && r.veteran);
  const ticks = days.map((d, k) => (d.endsWith('-01') || d.endsWith('-15') || k === last ? k : null)).filter((k) => k != null);
  const order = grouped ? { big: 0, base: 1 } : {};
  const sorted = [...series].sort((a, b) => (order[a.group] ?? 0) - (order[b.group] ?? 0) || b.values[last] - a.values[last] || a.name.localeCompare(b.name));
  const barMax = Math.max(1, ...series.map((r) => r.values[last]));
  const changed = flow != null;
  return (
    <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-forecast-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-forecast-title">Prévision au <span className="ps2-num">{dayName(days[cur])}</span></h2>
        <span className="ps2-forecast-tools">
          <span className="ps2-target ps2-flow" role="group" aria-label="Leads par jour">
            <button type="button" onClick={stepDown} aria-label="Moins de leads par jour">−</button>
            <Info as="span" label="Leads par jour, détail" style={{ cursor: 'pointer' }}
              detail={<Detail kicker="Flux simulé · leads ADS distribués par le moteur" title="Par jour" value={fr(current)}
                rows={[['Moyenne des 28 derniers jours', fr(average, 1)], ...CATS.map((c) => [`Catégorie ${catLabel(c)}`, fr(rates[c], 1)])]} />}>
              <b className="ps2-num">{fr(current)}</b>
            </Info>
            <button type="button" onClick={stepUp} aria-label="Plus de leads par jour">+</button>
            <span>leads / jour</span>
          </span>
          {changed && <button type="button" className="ps2-sim-reset" onClick={() => setFlow(null)}>moyenne {fr(average, 0)}</button>}
          {loading && <span className="ps2-spinner" aria-label="Calcul" />}
          <Info className="ps2-chip-soft" label="Calcul de la prévision, détail"
            detail={<Detail kicker="Prévision indicative · aucune écriture" title="Moteur d’auto-affectation ADS seul"
              rows={[['Pool et compteurs', '_load_pool, _seed_counts'], ['Choix de chaque lead', '_choose'],
                ['Indispo, absences, règle des 6 min', 'non prises en compte'], ['Flux', `${fr(current)} leads ADS par jour`]]}
              lines={['Les sales qui reçoivent aussi les 11 sal. et + ont une part attendue plus haute que les autres.']} />}>Moteur seul</Info>
        </span>
      </Motion.div>
      <Motion.div variants={ITEM} className="ps2-conv">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Part de chaque sales dans les leads cumulés depuis le 1er du mois">
          <defs>
            {groups.map((gr) => (
              <pattern key={gr.g} id={`${uid}-hatch-${gr.g}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={GROUPS[gr.g][1]} fillOpacity=".07" /><line x1="0" y1="0" x2="0" y2="6" stroke={GROUPS[gr.g][1]} strokeOpacity=".35" strokeWidth="2" />
              </pattern>
            ))}
            <clipPath id={`${uid}-past`}><Motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: on ? W : 0 }} transition={{ duration: 1, ease: EASE }} /></clipPath>
          </defs>
          {Array.from({ length: Math.round(yMax / step) + 1 }, (_, k) => Math.round(k * step * 100) / 100).map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="ps2-conv-grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="ps2-axis">{fr(v * 100)} %</text></g>
          ))}
          {ticks.map((k) => <text key={days[k]} x={x(k)} y={H - 6} textAnchor="middle" className="ps2-axis">{dm(days[k])}</text>)}
          {groups.map((gr) => (
            <g key={gr.g}>
              <g clipPath={`url(#${uid}-past)`}><path d={area(gr.band, 0, todayIdx)} fill={GROUPS[gr.g][1]} fillOpacity=".16" stroke={GROUPS[gr.g][1]} strokeOpacity=".4" /></g>
              <path d={area(gr.band, todayIdx, cur)} fill={`url(#${uid}-hatch-${gr.g})`} stroke={GROUPS[gr.g][1]} strokeOpacity=".35" strokeDasharray="3 3" />
              {gr.target != null && <line x1={L} x2={W - R} y1={y(gr.target)} y2={y(gr.target)} stroke={GROUPS[gr.g][1]} strokeWidth="1.5" strokeDasharray="5 4" />}
              {gr.target != null && <text x={W - R} y={y(gr.target) - 6} textAnchor="end" className="ps2-conv-equal-label" style={{ fill: GROUPS[gr.g][1] }}>
                {grouped ? `${GROUPS[gr.g][0]} · ` : ''}part attendue {pct(gr.target, 1)}</text>}
            </g>
          ))}
          {hovered && <><path d={line(hovered, 0, todayIdx)} className="ps2-conv-line" style={{ stroke: GROUPS[hovered.group][1] }} />
            <path d={line(hovered, todayIdx, cur)} className="ps2-conv-line is-future" style={{ stroke: GROUPS[hovered.group][1] }} /></>}
          <line x1={x(todayIdx)} x2={x(todayIdx)} y1={T} y2={H - B} className="ps2-conv-today" />
          {cur > todayIdx && <line x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} className="ps2-conv-cursor" />}
          {cur > todayIdx && groups.map((gr) => gr.band[cur] && (
            <g key={gr.g}>
              <circle cx={x(cur)} cy={y(gr.band[cur][1])} r="3.5" className="ps2-conv-dot" style={{ stroke: GROUPS[gr.g][1] }} />
              <circle cx={x(cur)} cy={y(gr.band[cur][0])} r="3.5" className="ps2-conv-dot" style={{ stroke: GROUPS[gr.g][1] }} />
            </g>
          ))}
        </svg>
        <div className="ps2-sim-bar">
          <button type="button" className={`ps2-sim-play${playing ? ' is-playing' : ''}`} onClick={() => (playing ? (cancelAnimationFrame(raf.current), setPlaying(false)) : play(last))}
            aria-label={playing ? 'Pause' : 'Avancer dans le temps'}>
            {playing ? <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>}
          </button>
          <span className="ps2-segment" role="group" aria-label="Horizon">
            {HORIZONS.map(([k, l]) => <button type="button" key={k} aria-pressed={horizon === k} onClick={() => { if (k === horizon) play(last); else { setCursor(todayIdx); onHorizon(k); } }}>{l}</button>)}
          </span>
          <input type="range" className="ps2-sim-range" min={todayIdx} max={last} value={cur} aria-label="Date simulée"
            onChange={(ev) => { cancelAnimationFrame(raf.current); setPlaying(false); setCursor(Number(ev.target.value)); }}
            style={{ '--p': `${((cur - todayIdx) / Math.max(1, last - todayIdx)) * 100}%` }} />
        </div>
        {failed && <div className="ps2-empty" role="alert">Prévision non calculée</div>}
        <div className="ps2-conv-keys">
          {groups.map((gr) => {
            const now = gr.band[todayIdx], then = gr.band[cur];
            if (!now) return null;
            return (
              <Info key={gr.g} className="ps2-conv-key" label={`${GROUPS[gr.g][0]}, écart`} style={{ '--g': GROUPS[gr.g][1] }}
                detail={<Detail kicker={`${grouped ? `${GROUPS[gr.g][0]} · ` : ''}${gr.members.length} sales présents depuis le 1er`} title="Part des leads cumulés"
                  rows={[['Aujourd’hui', `${pct(now[0])} à ${pct(now[1])}`], cur > todayIdx && then ? [`Au ${dm(days[cur])}`, `${pct(then[0], 1)} à ${pct(then[1], 1)}`] : null,
                    ['Part attendue', pct(gr.target, 1)]]} />}>
                {grouped && <i />}<span>{pct(now[0])} à {pct(now[1])}</span>
                {cur > todayIdx && then && <>
                  <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <b className="ps2-num">{pct(then[0], 1)} à {pct(then[1], 1)}</b></>}
              </Info>
            );
          })}
        </div>
      </Motion.div>
      <div className="ps2-fc-rows">
        <div className="ps2-fc-head"><span /><span>Depuis le 1er, réel puis moteur seul</span><span>Réel + moteur</span><span>→ {dm(days[cur])}</span><span>Part</span><span>Attendue</span></div>
        {sorted.map((r, k) => {
          const v = r.values[cur], share = r.veteran && totals[cur] ? v / totals[cur] : null;
          const target = r.veteran && expectedTotal ? perDayOf(r) / expectedTotal : null;
          const color = GROUPS[r.group][1];
          return (
            <Info key={r.name} className={`ps2-fc-row${hover === r.name ? ' is-on' : ''}`} label={`${r.name}, simulation`}
              onMouseEnter={() => onHover(r.name)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(r.name)} onBlur={() => onHover(null)}
              detail={<Detail kicker={r.name} title={`Leads cumulés au ${dm(days[cur])}, moteur seul`} value={fr(v)}
                rows={[[`Reçus du 1er au ${dm(e.today)} (réel)`, fr(r.month)], [`Donnés par le moteur seul d’ici le ${dm(days[cur])}`, `+${fr(v - r.month)}`],
                  share != null ? ['Part des leads cumulés', pct(share, 1)] : ['Arrivé le', dm(r.first)], target != null ? ['Part attendue', pct(target, 1)] : null,
                  ['Catégories reçues', r.mine.map(catLabel).join(', ')]]} />}>
              <span className="ps2-eng-name"><Face name={r.name} url={avatarFor?.(r.name)} size={24} /><span>{r.name}</span></span>
              <span className="ps2-fc-bar">
                <Motion.i className="is-real" initial={{ width: 0 }} animate={{ width: on ? `${(r.month / barMax) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 + k * 0.02 }} style={{ background: color }} />
                <i className="is-future" style={{ width: `${(Math.max(0, v - r.month) / barMax) * 100}%`, '--g': color }} />
              </span>
              <span className="ps2-fc-val ps2-num"><small>{fr(r.month)}</small><em style={{ color }}>+{fr(v - r.month)}</em></span>
              <b className="ps2-fc-total ps2-num">{fr(v)}</b>
              <span className="ps2-fc-share ps2-num">{share == null ? <span className="ps2-fc-tag is-new">arrivé le {dm(r.first)}</span> : pct(share, 1)}</span>
              <span className="ps2-fc-share ps2-num ps2-muted">{target == null ? '' : pct(target, 1)}</span>
            </Info>
          );
        })}
      </div>
    </Reveal>
  );
}
