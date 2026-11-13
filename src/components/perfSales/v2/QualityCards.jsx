// Rétractations et no show d'onboarding par sales, dans l'onglet Ventes de la Performance Sales (dev 13/11/2026 :
// « tu les gardes dans finances, mais tu les mets aussi dans le perf sales »). Ce sont les cartes de la page Finance,
// telles quelles : mêmes chiffres, même lecture (`/finance-statistics/retractions` et `/onboarding-no-shows`), une
// seule source. Ici les clients ne s'ouvrent pas : la fiche client vit dans la page Finance.
import React from 'react';
import { MotionConfig } from 'framer-motion';
import { Reveal } from '../motion';
import { parisCurrentPeriod } from '../../../pages/TrackingSheetFinance/periodFollow.js';
import { NoShowsCard, RetractionsCard } from '../../../pages/TrackingSheetFinance/statistics/RateCards.jsx';
import '../../../pages/TrackingSheetFinance/statistics/statistics.css';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const never = () => false;

export default function QualityCards({ period }) {
  const current = parisCurrentPeriod();
  // Le mois affiché par la page sert d'ancre ; jamais après le mois en cours.
  const anchor = MONTH.test(period || '') && period <= current ? period : current;
  return (
    <MotionConfig reducedMotion="user">
      <div className="fst-root fst-embed" style={{ marginTop: 20 }}>
        <Reveal className="fst-grid is-even" amount={0.05}>
          <RetractionsCard anchor={anchor} current={current} canOpen={never} />
          <NoShowsCard anchor={anchor} current={current} canOpen={never} />
        </Reveal>
      </div>
    </MotionConfig>
  );
}
