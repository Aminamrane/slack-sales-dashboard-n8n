import React from 'react';
import { monthClock, salesPace } from '../../utils/salesPace';

// Bandeau de pilotage du mois en cours pour le CEO et les admins (dev 13/10/2026), avec les mots que Yohan envoie au
// CEO : ventes / objectif, TR (taux de réalisation), on pace (ventes en fin de mois au rythme actuel) et le jour où
// l'objectif tombe à ce rythme.
const MONTH = (offset = 0) => new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1)
  .toLocaleDateString('fr-FR', { month: 'long' });

export default function PacePanel({ sales, objective }) {
  const clock = monthClock();
  const pace = salesPace({ sales, objective, clock });
  const perDay = clock.elapsed > 0 ? sales / clock.elapsed : 0;
  // 80 est un objectif, pas un plafond (dev 13/10/2026) : au-delà, on affiche l'avance ; en dessous, ce qui manque.
  const ahead = pace.onPace != null ? pace.onPace - objective : null;
  const reach = {
    reached: { label: `Objectif atteint${sales > objective ? ` (+${sales - objective})` : ''}`, tone: 'is-up' },
    on_track: { label: `Objectif vers le ${pace.reachDay} ${MONTH()}${ahead > 0 ? ` · +${ahead} à ce rythme` : ''}`, tone: 'is-up' },
    behind: { label: `À ce rythme : ${pace.onPace} ventes, il en manquerait ${Math.max(0, objective - (pace.onPace ?? 0))}`, tone: 'is-down' },
    too_early: { label: 'Projection dès midi le 1er', tone: '' },
  }[pace.status];

  return (
    <div className="pace" role="group" aria-label="Pilotage du mois en cours">
      <div className="pace-kpi">
        <span>Ventes</span>
        <strong>{sales}<em>/{objective}</em></strong>
      </div>
      <div className="pace-kpi">
        <span title="Taux de réalisation de l'objectif">TR</span>
        <strong>{pace.tr} %</strong>
      </div>
      <div className="pace-kpi">
        <span title="Ventes attendues en fin de mois au rythme actuel">On pace</span>
        <strong>{pace.onPace ?? '—'}</strong>
      </div>
      {reach && (
        <div className={`pace-reach ${reach.tone}`}
          title={`${perDay.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ventes par jour depuis le 1er (heure de Paris)`}>
          {reach.label}
        </div>
      )}
    </div>
  );
}
