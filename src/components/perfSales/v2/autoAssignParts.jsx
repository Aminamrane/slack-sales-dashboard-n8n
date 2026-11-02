import React, { useId, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, useDrawn, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr, initials } from './model';
import { longDay, pctOf, todayParis } from './autoAssignData';

// Briques d'affichage de l'auto-affectation (barres à traits, sucettes jour par jour, légende, pastille de visage),
// partagées par la vue « Leads ADS → sales » (Performance Sales) et la vue « RDV Setter → Sales » (Perf Setter).

export // Barres à traits (référence « Proposal Progress » du dev) : une colonne par part, filet de couleur à gauche, chiffre,
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

export // Sucettes jour par jour (référence « Income Tracker ») : une tige par jour, colorée par part, le jour survolé (ou le
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

export function Legend({ parts }) {
  return <span className="ps2-compo-legend" style={{ marginTop: 0 }}>{parts.map(([k, l, c]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</span>;
}

export function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: '0 0 28px', width: 28, height: 28, fontSize: 10.5, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}
