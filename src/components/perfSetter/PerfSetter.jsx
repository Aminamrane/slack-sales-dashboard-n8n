import React, { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { EASE, ITEM, Reveal } from '../perfSales/motion';
import ErrorBoundary from '../ErrorBoundary.jsx';
import { PopLayer } from '../perfSales/v2/Pop';
import Tabs from '../perfSales/v2/Tabs';
import Controls from '../perfSales/v2/Controls';
import useAvatarMap from '../perfSales/v2/useAvatarMap';
import { getCanonicalKey } from '../../utils/salesNames';
import SettersTab from './SettersTab';
import SetterKpis from './SetterKpis';
import { monthFigures } from './figures';
import { monthOptions, parisMonth } from './months';
import { useMonthDays, useSetterMonth } from './usePerfSetterData';
import '../perfSales/v2/v2.css';
import '../perfSales/v2/v2-nav.css';
import './perfSetter.css';

// PERF SETTER (/ceo/setters, 30/10/2026) : la page de pilotage des setters. Elle réunit
//   · « Setters »            : l'ancien onglet Setters de la Performance Sales (chiffres du mois, RDV posés par jour, chaque setter des appels aux ventes) ;
//   · « Classement »         : l'ancienne page Setters du dashboard (classement, clients signés par mois, fiche d'un setter, appels Allo) ;
//   · « RDV Setter → Sales » : l'ancienne vue « RDV setters → sales » de l'onglet Auto-affectation de la Performance Sales.
// Mêmes routes, mêmes calculs, mêmes composants qu'avant : seule l'organisation change. Lecture seule. La Performance Sales ne garde que ce qui
// concerne les sales. Le mois du bandeau pilote « Setters » et « RDV Setter → Sales » ; « Classement » garde sa propre période (« Depuis mai » ou un mois).
const TABS = [['setters', 'Setters'], ['ranking', 'Classement', 'cohort'], ['rdv', 'RDV Setter → Sales', 'auto']];

// Un lien direct vers la fiche d'un setter (?setter=<id>) ouvre « Classement », où vit la fiche.
const firstTab = () => {
  try { return new URLSearchParams(window.location.search).get('setter') ? 'ranking' : 'setters'; } catch { return 'setters'; }
};

// « Classement » et « RDV Setter → Sales » ne se chargent qu'à l'ouverture de leur onglet : le premier affichage (onglet « Setters ») n'embarque plus leur code
// (classement, fiche d'un setter, appels Allo, attribution des RDV) ; un fond de chargement identique à celui des données prend le relais le temps du téléchargement.
const SettersStats = lazy(() => import('../../pages/SettersStats/index.jsx'));
const RdvSetterSales = lazy(() => import('./RdvSetterSales'));
const TabLoading = <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>;

// Couleurs de la fiche et du classement : les jetons de la charte Owner (même vocabulaire que la Performance Sales), qui suivent le mode sombre.
const PS2_COLORS = { bg: 'var(--card)', surface: 'var(--bg)', border: 'var(--line)', text: 'var(--ink)', muted: 'var(--muted)', subtle: 'var(--grey-bg)', secondary: 'var(--soft)', accent: 'var(--navy)', shadow: 'none' };

function Orbits() {
  return (
    <svg className="pst-orbits" viewBox="0 0 520 520" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" focusable="false">
      <circle cx="260" cy="260" r="250" /><circle cx="260" cy="260" r="196" /><circle cx="260" cy="260" r="138" />
      <path d="M260 10a250 250 0 0 1 216 125" strokeWidth="2.4" />
    </svg>
  );
}

export default function PerfSetter({ darkMode = false }) {
  const [month, setMonth] = useState(parisMonth);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState(firstTab);
  const rankingCache = useRef({ overview: new Map(), calls: new Map() });   // lectures du classement, gardées 60 s au plus (changer d'onglet ne relit pas Allo à chaque fois, mais rien de plus ancien n'est montré comme à jour)
  const options = useMemo(() => monthOptions(), []);
  const avatarMap = useAvatarMap(true);
  const avatarFor = useMemo(() => (name) => avatarMap[getCanonicalKey(name)]?.av || null, [avatarMap]);
  const { data, calls, error } = useSetterMonth(month, refreshKey);
  const days = useMonthDays(month, refreshKey, data);
  const figures = useMemo(() => (data ? monthFigures(data, calls, days) : null), [data, calls, days]);
  const controls = { value: month, options, onChange: setMonth, onRefresh: () => setRefreshKey((k) => k + 1), loading: !data && !error };

  return (
    <div className="pst-page">
      <div className={`ps2 pst${darkMode ? ' is-dark' : ''}`}>
        <PopLayer>
          <Reveal as="section" className="pst-hero" aria-label="Résumé du mois">
            <Orbits />
            <div className="pst-hero-top">
              <Motion.div variants={ITEM}>
                <p className="pst-kicker">Acquisition · Setters</p>
                <h1>Perf Setters</h1>
                <p className="pst-sub">Appels, rendez-vous posés et clients amenés par chaque setter, du premier appel à la vente.</p>
              </Motion.div>
              <Motion.div className="pst-hero-tools" variants={ITEM}>
                <Controls controls={controls} />
                {days && <span className="ps2-mono">jour ouvré {days.elapsed} / {days.total}</span>}
              </Motion.div>
            </div>
            <SetterKpis figures={figures} callsState={calls} error={error} />
          </Reveal>
          <Tabs tabs={TABS} tab={tab} onTab={setTab} label="Vues de Perf Setters" />
          <AnimatePresence mode="wait">
            <Motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }}>
              {/* Une charge utile inattendue n'efface pas la page : la vue concernée le dit, le bandeau et les autres onglets restent. « Actualiser » (refreshKey) relance la vue. */}
              <ErrorBoundary key={tab} resetKey={refreshKey} fallback={<div className="ps2-empty" role="alert">Cette vue n’a pas pu être chargée. Utilisez « Actualiser » pour réessayer.</div>}>
                {tab === 'setters' && <SettersTab month={month} figures={figures} calls={calls} error={error} avatarFor={avatarFor} dark={darkMode} refreshKey={refreshKey} />}
                {tab === 'ranking' && <Suspense fallback={TabLoading}><SettersStats C={PS2_COLORS} darkMode={darkMode} refreshKey={refreshKey} cache={rankingCache.current} avatarFor={avatarFor} /></Suspense>}
                {tab === 'rdv' && <Suspense fallback={TabLoading}><RdvSetterSales month={month} avatarFor={avatarFor} refreshKey={refreshKey} /></Suspense>}
              </ErrorBoundary>
            </Motion.div>
          </AnimatePresence>
        </PopLayer>
      </div>
    </div>
  );
}
