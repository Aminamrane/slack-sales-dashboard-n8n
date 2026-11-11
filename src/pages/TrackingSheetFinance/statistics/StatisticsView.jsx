import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion as Motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EASE, Reveal } from '../../../components/perfSales/motion.jsx';
import { parisCurrentPeriod } from '../periodFollow.js';
import { MODES, monthChoices, monthLabel, rangeFor, rangeLabel, shiftMonth } from './period.js';
import { Segmented } from './parts.jsx';
import ReceiptsCard from './ReceiptsCard.jsx';
import { GoalCard, OriginsCard, PeopleCard, SalesTable } from './SalesSection.jsx';
import { NoShowsCard, RetractionsCard } from './RateCards.jsx';
import { useStatistic } from './useStatistics.js';
import './statistics.css';

// Statistiques de la page Finance (dev 10/11/2026) : ce que paie un client, les ventes de la période et leur paiement,
// d'où elles viennent, et deux taux par sales (rétractation, no show d'onboarding). La période se choisit en haut ;
// les deux taux ont leur propre fenêtre, calée sur le dernier mois affiché.
const NO_FILTER = { status: 'all', origin: null, group: null, person: null, query: '' };
const HISTORY = 36;

function PeriodControl({ mode, anchor, custom, current, range, onChange }) {
  const [direction, setDirection] = useState(0);
  const choices = useMemo(() => monthChoices(current, HISTORY), [current]);
  const oldest = choices[choices.length - 1];
  const step = mode === 'year' ? 12 : 1;
  const move = (way) => {
    const next = shiftMonth(mode === 'year' ? anchor : range.to, way * step);
    setDirection(way);
    onChange({ anchor: next > current ? current : next < oldest ? oldest : next });
  };
  const pickMode = (next) => onChange({ mode: next, ...(next === 'custom' ? { custom: range } : { anchor: range.to }) });
  const label = rangeLabel(range);

  return (
    <div className="fst-period">
      <Segmented options={MODES} value={mode} onChange={pickMode} label="Période" />
      {mode === 'custom' ? (
        <span className="fst-custom">
          du
          <select className="fst-select" value={range.from} onChange={(e) => onChange({ custom: { ...custom, from: e.target.value, to: range.to } })} aria-label="Premier mois">
            {choices.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
          </select>
          au
          <select className="fst-select" value={range.to} onChange={(e) => onChange({ custom: { ...custom, from: range.from, to: e.target.value } })} aria-label="Dernier mois">
            {choices.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
          </select>
        </span>
      ) : (
        <div className="fst-nav">
          <button type="button" className="fst-nav-btn" onClick={() => move(-1)} disabled={range.from <= oldest} aria-label="Période précédente"><ChevronLeft size={16} /></button>
          <div className="fst-nav-label" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <Motion.span key={label} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: EASE }}
                variants={{ enter: (way) => ({ opacity: 0, x: way * 18 }), center: { opacity: 1, x: 0 }, exit: (way) => ({ opacity: 0, x: way * -18 }) }}>
                {label}
              </Motion.span>
            </AnimatePresence>
          </div>
          <button type="button" className="fst-nav-btn" onClick={() => move(1)} disabled={range.to >= current} aria-label="Période suivante"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

export default function StatisticsView({ onOpenClient, canOpenClient }) {
  const current = parisCurrentPeriod();
  const [period, setPeriod] = useState({ mode: 'month', anchor: current, custom: null });
  const [filter, setFilter] = useState(NO_FILTER);
  const tableRef = useRef(null);
  const range = useMemo(() => rangeFor(period.mode, period.anchor, current, period.custom), [period, current]);
  const receipts = useStatistic('receipts', range);
  const sales = useStatistic('sales', range);
  const canOpen = useCallback((id) => (canOpenClient ? canOpenClient(id) : false), [canOpenClient]);

  // Changer de période remet le détail à plat : une origine ou un sales filtré n'existe pas forcément ailleurs.
  const changePeriod = useCallback((patch) => { setPeriod((previous) => ({ ...previous, ...patch })); setFilter(NO_FILTER); }, []);
  const seeSales = useCallback((patch) => {
    setFilter({ ...NO_FILTER, ...patch });
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="fst-root">
        <div className="fst-wrap">
          <header className="fst-head">
            <div>
              <h2 className="fst-title">Statistiques</h2>
              <p className="fst-sub">Ce que les clients paient, ce que les ventes rapportent, et ce qui se perd en route.</p>
            </div>
            <PeriodControl {...period} current={current} range={range} onChange={changePeriod} />
          </header>

          <Reveal className="fst-grid">
            <ReceiptsCard state={receipts} onPickMonth={(month) => changePeriod({ mode: 'month', anchor: month })} />
            <GoalCard state={sales} status={filter.status} onStatus={(status) => seeSales({ ...filter, status })} />
          </Reveal>

          <Reveal className="fst-grid">
            <OriginsCard state={sales} onSee={seeSales} />
            <PeopleCard state={sales} person={filter.person} onPerson={(person) => setFilter((previous) => ({ ...previous, person }))} />
          </Reveal>

          <Reveal amount={0.03}>
            <SalesTable state={sales} filter={filter} setFilter={setFilter} canOpen={canOpen} onOpenClient={onOpenClient} anchorRef={tableRef} />
          </Reveal>

          <Reveal className="fst-grid is-even" amount={0.05}>
            <RetractionsCard anchor={range.to} current={current} canOpen={canOpen} onOpenClient={onOpenClient} />
            <NoShowsCard anchor={range.to} current={current} canOpen={canOpen} onOpenClient={onOpenClient} />
          </Reveal>
        </div>
      </div>
    </MotionConfig>
  );
}
