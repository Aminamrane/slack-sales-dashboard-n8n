import React from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, ITEM, Reveal } from '../perfSales/motion';
import { euro, fr } from '../perfSales/v2/model';

// Les cinq chiffres du mois des setters, dans le bandeau de Perf Setter : ce sont les tuiles de l'ancien onglet « Setters » de la
// Performance Sales, avec les mêmes valeurs et les mêmes mentions (moyenne par jour ouvré, présence, appels pour 1 vente), montées d'un cran
// pour rester visibles quel que soit l'onglet. `figures` : voir ./figures.js (null tant que les setters du mois se chargent) ;
// `error` : les setters du mois n'ont pas pu être lus (« – », « Indisponible », jamais un 0) ; `callsState` : null = Allo en cours de lecture ; sans appel, « – » (Allo indisponible ou aucun setter relié), jamais un 0 inventé.
const PLACEHOLDER = ['Appels', 'RDV posés', 'RDV honorés', 'Ventes', 'Appels pour 1 vente'];

export default function SetterKpis({ figures, callsState, error = false }) {
  if (!figures) {
    return (
      <div className="pst-kpis" aria-label="Setters, le mois" aria-busy={!error}>
        {PLACEHOLDER.map((l) => <div key={l} className="pst-kpi"><span>{l}</span><b className="ps2-num">{error ? '–' : '…'}</b><small>{error ? 'Indisponible' : '\u00a0'}</small></div>)}
      </div>
    );
  }
  const { team, callsTotal, answeredTotal, teamSales, callsPerSaleTeam, presenceTeam, elapsed } = figures;
  // Moyenne par jour ouvré (demande du 15/10/2026 : « le chiffre suivi de / et la moyenne par jour ») : le chiffre du mois ÷ les jours ouvrés
  // écoulés, ceux de « jour ouvré 11 / 22 » de l'en-tête. Aucun jour écoulé : le chiffre seul.
  const withPerDay = (n) => (
    <>
      <CountUp value={n} />
      {elapsed && <small title={`Moyenne par jour ouvré : ${fr(n)} ÷ ${elapsed} j ouvrés écoulés`}> / {fr(n / elapsed, 1)} par&nbsp;jour</small>}
    </>
  );
  const tiles = [
    ['Appels', callsTotal ? withPerDay(callsTotal) : (callsState ? '–' : '…'), callsTotal ? `${fr((answeredTotal / callsTotal) * 100, 0)} % répondus` : 'Allo'],
    ['RDV posés', withPerDay(team.rdv?.total || 0), `${fr(team.rdv?.upcoming || 0)} à venir · ${fr(team.rdv?.to_qualify || 0)} à qualifier`],
    ['RDV honorés', withPerDay(team.rdv?.held || 0), presenceTeam == null ? '' : `${fr(presenceTeam * 100, 0)} % de présence`],
    ['Ventes', <CountUp value={teamSales} />, euro(team.sales?.amount || 0)],
    ['Appels pour 1 vente', callsPerSaleTeam ? <CountUp value={callsPerSaleTeam} /> : '–', 'équipe setters, ce mois'],
  ];
  return (
    <Reveal as="div" className="pst-kpis" aria-label="Setters, le mois" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07 } } }}>
      {tiles.map(([l, v, n]) => (
        <Motion.div key={l} className="pst-kpi" variants={ITEM}><span>{l}</span><b className="ps2-num">{v}</b><small>{n || ' '}</small></Motion.div>
      ))}
    </Reveal>
  );
}
