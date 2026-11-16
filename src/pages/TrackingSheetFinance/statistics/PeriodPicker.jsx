import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { parisToday } from '../../../utils/parisDates.js';
import { DAY_PRESETS, addDays, dayRangeLabel, dayRangeShort, daysProblem, isDay, monthGrid, monthHalves, monthLabel, orderDays, presetDays, shiftMonth, weekStart } from './period.js';

// Bouton de période en JOURS d'une carte (les deux taux par sales de la Performance Sales, dev 13/11/2026) : présélections, calendrier et dates saisies.
// Un bouton = une carte = sa propre période. `value` : null (les mois de la carte) ou { from, to, preset } en jours de Paris, bornes incluses.
// Le menu s'ouvre dans le <body> : la carte coupe ce qui dépasse et ses animations déplacent tout `position: fixed` qu'elle contient.
const PROBLEMS = { order: 'Le début est après la fin.', future: 'Pas de jour à venir.', span: '24 mois au plus.' };
const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const HISTORY = 36;   // mois proposés vers le passé, comme le sélecteur de mois des Statistiques
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function PeriodPicker({ value, onChange, label }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(() => parisToday());
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [view, setView] = useState(() => parisToday().slice(0, 7));
  const [hover, setHover] = useState('');
  const [place, setPlace] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPlace(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const gap = 8;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.max(gap, Math.min(t.right - width, window.innerWidth - width - gap));
    const below = t.bottom + gap;
    const wanted = below + height > window.innerHeight - gap && t.top - gap - height > gap ? t.top - gap - height : below;
    const top = Math.max(gap, Math.min(wanted, window.innerHeight - height - gap));   // jamais coupé en bas, même quand ni dessous ni dessus ne suffisent
    setPlace((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
  }, []);

  useLayoutEffect(() => { if (open) reposition(); }, [open, view, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    };
    const escape = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, close, reposition]);

  const placed = Boolean(place);
  useEffect(() => {
    if (open && placed) panelRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open, placed]);

  const toggle = () => {
    if (open) { close(false); return; }
    const now = parisToday();   // « aujourd'hui » au moment où on ouvre : un onglet resté ouvert la veille ne se trompe pas de jour
    setToday(now);
    setDraft(value ? { from: value.from, to: value.to } : { from: '', to: '' });
    setView((value ? value.to : now).slice(0, 7));
    setHover('');
    setOpen(true);
  };
  const choose = (next) => { onChange(next); close(); };

  // Un seul jour cliqué = ce jour-là ; la période se valide avec « Appliquer ».
  const effective = draft.from && !draft.to ? { from: draft.from, to: draft.from } : draft;
  const problem = effective.from && effective.to ? daysProblem(effective, today) : 'format';
  const pickDay = (day) => {
    setHover('');
    if (!draft.from || draft.to) setDraft({ from: day, to: '' });          // début d'une nouvelle sélection
    else setDraft(orderDays(draft.from, day));                              // fin : remise dans l'ordre
  };
  const typed = (field, text) => {
    setDraft((previous) => ({ ...previous, [field]: text }));
    if (isDay(text)) setView(text.slice(0, 7));
  };
  // La plage dessinée dans le calendrier : choisie, ou en cours de choix (le survol montre où elle finirait).
  const shown = draft.from && draft.to ? orderDays(draft.from, draft.to)
    : draft.from ? orderDays(draft.from, hover || draft.from) : null;
  const oldest = shiftMonth(today.slice(0, 7), -(HISTORY - 1));
  const halves = monthHalves(view, today);
  const grid = monthGrid(view);

  // Flèches du clavier dans le calendrier : jour, semaine, mois (le jour reste un jour d'une période déjà arrivée).
  const move = (event, day) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target = null;
    if (event.key in steps) target = addDays(day, steps[event.key]);
    else if (event.key === 'Home') target = weekStart(day);
    else if (event.key === 'End') target = addDays(weekStart(day), 6);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const month = shiftMonth(day.slice(0, 7), event.key === 'PageUp' ? -1 : 1);
      target = `${month}-${day.slice(8)}`;
      if (!isDay(target)) target = addDays(`${shiftMonth(month, 1)}-01`, -1);
    }
    if (!target) return;
    event.preventDefault();
    if (target > today || target.slice(0, 7) < oldest) return;
    const focusTarget = () => panelRef.current?.querySelector(`[data-day="${target}"]`)?.focus();
    if (target.slice(0, 7) === view) { focusTarget(); return; }
    setView(target.slice(0, 7));              // un autre mois : le jour n'existe dans la page qu'après l'affichage
    requestAnimationFrame(focusTarget);
  };

  const preset = value && value.preset !== 'custom' ? DAY_PRESETS.find((p) => p.key === value.preset) : null;
  // Sur le bouton, les dates sans l'année tant que la période est de cette année ; l'année entière sous le titre de la carte.
  const thisYear = today.slice(0, 4);
  const buttonDates = value && (value.from.slice(0, 4) === thisYear && value.to.slice(0, 4) === thisYear ? dayRangeShort(value) : dayRangeLabel(value));
  const tabbable = (shown && shown.from >= `${view}-01` && shown.from.slice(0, 7) === view ? shown.from : null) || (today.slice(0, 7) === view ? today : `${view}-01`);

  return (
    <>
      <button ref={triggerRef} type="button" className="fst-pp-btn" data-active={value ? 'true' : undefined} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-label={value ? `${label} : ${dayRangeLabel(value)}` : `${label} : choisir des jours`}
        title={value ? dayRangeLabel(value) : 'Choisir des jours'} onClick={toggle}>
        <CalendarRange size={14} strokeWidth={2.1} aria-hidden="true" />
        {value && <span className="fst-pp-label">{preset ? preset.short : buttonDates}</span>}
      </button>
      {open && createPortal(
        <div className="fst-root fst-embed">
          <div ref={panelRef} id={id} role="dialog" aria-label={label} className="fst-pp-panel"
            style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: 'hidden' }}>
            <div className="fst-pp-body">
              <div className="fst-pp-side" role="group" aria-label="Périodes proposées">
                {DAY_PRESETS.map((item) => {
                  const days = presetDays(item.key, today);
                  const on = value?.preset === item.key;
                  return (
                    <button key={item.key} type="button" className="fst-pp-item" aria-pressed={on} title={on ? dayRangeLabel(value) : undefined} onClick={() => choose({ ...days, preset: item.key })}>
                      <span className="fst-pp-item-name">{item.label}</span>
                      {on && <small>{dayRangeShort(value)}</small>}
                      {on && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <div className="fst-pp-cal">
                <div className="fst-pp-custom-title">Période personnalisée{value?.preset === 'custom' && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}</div>
                <div className="fst-pp-dates">
                  <label>Du
                    <input type="date" className="fst-pp-date" value={draft.from} max={today} aria-label="Premier jour" onChange={(e) => typed('from', e.target.value)} />
                  </label>
                  <label>Au
                    <input type="date" className="fst-pp-date" value={draft.to} max={today} aria-label="Dernier jour" onChange={(e) => typed('to', e.target.value)} />
                  </label>
                </div>
                <div className="fst-pp-month">
                  <button type="button" className="fst-pp-nav" aria-label="Mois précédent" disabled={view <= oldest} onClick={() => setView(shiftMonth(view, -1))}><ChevronLeft size={15} /></button>
                  <span aria-live="polite">{capital(monthLabel(view))}</span>
                  <button type="button" className="fst-pp-nav" aria-label="Mois suivant" disabled={view >= today.slice(0, 7)} onClick={() => setView(shiftMonth(view, 1))}><ChevronRight size={15} /></button>
                </div>
                <div className="fst-pp-grid" role="grid" aria-label={capital(monthLabel(view))} onMouseLeave={() => setHover('')}>
                  <div className="fst-pp-weekdays" role="row">{WEEKDAYS.map((name) => <span key={name} role="columnheader">{name}</span>)}</div>
                  {grid.map((week, row) => (
                    <div key={row} className="fst-pp-week" role="row">
                      {week.map((day, col) => {
                        if (!day) return <span key={col} className="fst-pp-gap" role="gridcell" />;
                        const inside = shown && day >= shown.from && day <= shown.to;
                        const edge = shown && (day === shown.from || day === shown.to);
                        return (
                          <span key={day} role="gridcell" aria-selected={Boolean(inside)} className="fst-pp-cell">
                            <button type="button" className={`fst-pp-day${inside ? ' is-in' : ''}${edge ? ' is-edge' : ''}${shown && day === shown.from ? ' is-start' : ''}${shown && day === shown.to ? ' is-end' : ''}${day === today ? ' is-today' : ''}`} data-day={day}
                              tabIndex={day === tabbable ? 0 : -1} disabled={day > today} aria-current={day === today ? 'date' : undefined} aria-label={dayRangeLabel({ from: day, to: day })}
                              onClick={() => pickDay(day)} onMouseEnter={() => draft.from && !draft.to && setHover(day)} onKeyDown={(e) => move(e, day)}>
                              {Number(day.slice(8))}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="fst-pp-halves" role="group" aria-label={`Raccourcis de ${monthLabel(view)}`}>
                  {[['first', '1re moitié'], ['second', '2e moitié'], ['whole', 'Mois entier']].map(([key, name]) => (
                    <button key={key} type="button" className="fst-pp-half" disabled={!halves[key]} title={halves[key] ? dayRangeLabel(halves[key]) : 'Pas encore arrivé'}
                      onClick={() => choose({ ...halves[key], preset: 'custom' })}>
                      <span>{name}</span>{halves[key] && <small>{dayRangeShort(halves[key])}</small>}
                    </button>
                  ))}
                </div>
                <div className="fst-pp-foot">
                  <div className="fst-pp-note" role="status">{PROBLEMS[problem] || ''}</div>
                  <button type="button" className="fst-pp-apply" disabled={Boolean(problem)} onClick={() => choose({ ...effective, preset: 'custom' })}>Appliquer</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
