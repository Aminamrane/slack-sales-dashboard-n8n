import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, ITEM, Reveal, useRevealed } from '../perfSales/motion';
import { Detail, Info } from '../perfSales/v2/Pop';
import { euro, fr, initials } from '../perfSales/v2/model';
import SetterPlacements from './SetterPlacements';
import { monthRange, usePlacements } from './setterApi';

// Onglet « Setters » de Perf Setter (dev 14/10/2026 : « prends exemple sur la page Setters du dashboard : plus de détails, de vraies stats ;
// par rapport à leur taux de transfo, voir combien de volume il doit faire chacun »), déplacé de la Performance Sales dans Perf Setter le
// 30/10/2026. Même calcul que l'ancien onglet (RDV posés au mois du RDV, honorés, no-show, ventes au mois de signature, appels Allo du mois,
// voir ./figures.js) ; les cinq chiffres du mois sont passés dans le bandeau de la page (SetterKpis). Ici : les RDV posés par jour et, pour
// chaque setter, son parcours appels → répondus → RDV → honorés → ventes, ses taux, et le volume d'appels par jour qu'il lui faut, à ses propres
// taux, pour atteindre l'objectif de ventes choisi d'ici la fin du mois.
export default function SettersTab({ month, figures, calls, error, avatarFor, dark, refreshKey = 0 }) {
  const [placed] = usePlacements(...(/^\d{4}-\d{2}$/.test(month || '') ? monthRange(month) : [null, null]), refreshKey);
  const [target, setTarget] = useState(3);
  // Affichage progressif : « RDV posés par jour » (lecture légère, à elle) apparaît dès qu'elle arrive, sans attendre le calcul des setters du mois ;
  // le tableau « Chaque setter » prend sa place (fond de chargement, ou message d'erreur) en dessous. Une erreur des setters n'efface plus les poses.
  const { rows, team, callsPerSaleTeam, remaining, elapsed } = figures || {};

  return (
    <div className="ps2-grid">
      <SetterPlacements period={month} dark={dark} avatarFor={avatarFor} rdvMonth={team?.rdv?.total} refreshKey={refreshKey} />
      {error && <div className="ps2-span-12 ps2-empty" role="alert">Setters non chargés</div>}
      {!error && !figures && <div className="ps2-span-12 ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
      {!error && figures && <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-setters-title">
        <Motion.div className="ps2-card-head" variants={ITEM}>
          <h2 id="ps2-setters-title">Chaque setter, des appels aux ventes</h2>
          <span className="ps2-target">
            <span>Objectif par setter</span>
            <button type="button" onClick={() => setTarget((t) => Math.max(1, t - 1))} aria-label="Moins">−</button>
            <b className="ps2-num">{target}</b>
            <button type="button" onClick={() => setTarget((t) => t + 1)} aria-label="Plus">+</button>
            <span>ventes ce mois</span>
          </span>
        </Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable ps2-setters-table" style={{ '--c': '#2c6448' }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Setter</th><th>Appels</th><th>Appels / j</th><th>Répondus</th><th>RDV posés</th><th title="RDV posés dans le mois (date de la pose) ÷ jours ouvrés écoulés">RDV / j</th><th>Honorés</th><th>No-show</th><th>Ventes</th><th>CA</th>
                <th style={{ textAlign: 'left', width: 220 }}>Parcours</th><th className="is-key">Appels / vente</th><th className="is-key">Pour l’objectif</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <SetterRow key={r.id} r={r} i={i} target={target} remaining={remaining} elapsed={elapsed} teamCallsPerSale={callsPerSaleTeam} avatarFor={avatarFor} callsLoaded={!!calls}
                placed={placed?.setters?.find((x) => x.id === r.id)} placedDays={placed?.elapsed_open_days} />)}
            </tbody>
          </table>
        </div>
      </Reveal>}
    </div>
  );
}

// Appels par jour (dev 15/10/2026 : « quand l'objectif est atteint, on ne sait pas combien d'appels ils ont faits par jour ») :
// les appels Allo du mois ÷ les jours ouvrés écoulés, la même moyenne que celle des RDV en haut de l'onglet.
function SetterRow({ r, i, target, remaining, elapsed, teamCallsPerSale, avatarFor, callsLoaded, placed, placedDays }) {
  const on = useRevealed();
  const c = r.calls;
  const held = r.rdv.held || 0, noshow = r.rdv.no_show || 0, sold = r.sales.count || 0;
  const presence = held + noshow ? held / (held + noshow) : null;
  const callsPerSale = c && sold ? c.calls / sold : null;
  const basis = callsPerSale ?? teamCallsPerSale;
  const missing = Math.max(0, target - sold);
  const perDay = basis && remaining ? (missing * basis) / remaining : null;
  const callsPerDay = c && elapsed ? c.calls / elapsed : null;
  const steps = [['Appels', c?.calls], ['Répondus', c?.answered], ['RDV', r.rdv.total], ['Honorés', held], ['Ventes', sold]];
  const max = Math.max(1, ...steps.map(([, v]) => v || 0));
  const height = (v) => (v ? Math.max(10, (Math.log10(v + 1) / Math.log10(max + 1)) * 100) : 0);   // échelle log : 700 appels et 2 ventes restent lisibles
  return (
    <Motion.tr initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.04 }}>
      <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={r.name} url={avatarFor?.(r.name)} /><span>{r.name}</span></span></td>
      <td>{c ? fr(c.calls) : <span className="ps2-muted">{callsLoaded ? (r.callsStatus === 'missing' ? 'sans Allo' : '–') : '…'}</span>}</td>
      <td>{callsPerDay != null ? <span title={`${fr(c.calls)} appels ÷ ${elapsed} jours ouvrés écoulés`}>{fr(callsPerDay, 0)}</span> : <span className="ps2-muted">–</span>}</td>
      <td>{c ? <>{fr(c.answered)} <small className="ps2-muted">{fr((c.answered / Math.max(1, c.calls)) * 100, 0)} %</small></> : <span className="ps2-muted">–</span>}</td>
      <td>{fr(r.rdv.total)}</td>
      <td>{placed?.avg != null ? <span title={`${fr(placed.placed)} RDV posés ÷ ${placedDays} jours ouvrés écoulés`}>{fr(placed.avg, 1)}</span> : <span className="ps2-muted">–</span>}</td>
      <td>{fr(held)} {presence != null && <small className="ps2-muted">{fr(presence * 100, 0)} %</small>}</td>
      <td className={noshow ? 'ps2-low' : 'ps2-muted'}>{fr(noshow)}</td>
      <td><b>{fr(sold)}</b></td>
      <td>{r.sales.amount ? euro(r.sales.amount) : <span className="ps2-muted">–</span>}</td>
      <td style={{ textAlign: 'left' }}>
        <Info className="ps2-setter-flow" label={`Parcours de ${r.name}`}
          detail={<Detail kicker={r.name} title="Parcours du mois"
            rows={steps.map(([l, v], k) => [l, v == null ? '–' : `${fr(v)}${k && steps[k - 1][1] ? ` · ${fr((v / steps[k - 1][1]) * 100, 0)} %` : ''}`])}
            lines={[callsPerDay != null ? `${fr(c.calls)} appels ÷ ${elapsed} jours ouvrés écoulés = ${fr(callsPerDay, 0)} appels par jour` : null,
              c && sold ? `${fr(c.calls)} appels ÷ ${sold} ventes = ${fr(callsPerSale, 0)} appels par vente` : 'Pas encore de vente ce mois : taux de l’équipe setters.',
              perDay != null ? `${missing} vente${missing > 1 ? 's' : ''} à faire × ${fr(basis, 0)} appels ÷ ${remaining} jours ouvrés = ${fr(perDay, 0)} appels / jour` : null]} />}>
          {steps.map(([l, v], k) => (
            <span key={l} title={`${l} : ${v ?? '–'}`}><Motion.i initial={{ height: 0 }} animate={{ height: on ? `${height(v || 0)}%` : 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.04 + k * 0.06 }} /></span>
          ))}
        </Info>
      </td>
      <td className="is-key">{callsPerSale ? fr(callsPerSale, 0) : <span className="ps2-muted">{teamCallsPerSale ? `≈ ${fr(teamCallsPerSale, 0)}` : '–'}</span>}</td>
      <td className="is-key">{missing === 0 ? <span className="ps2-good">atteint</span> : perDay != null ? <b className={callsPerSale ? '' : 'ps2-muted'}>{callsPerSale ? '' : '≈ '}{fr(perDay, 0)} <small className="ps2-muted">appels / j</small></b> : <span className="ps2-muted">–</span>}</td>
    </Motion.tr>
  );
}

function Face({ name, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: '0 0 28px', width: 28, height: 28, fontSize: 10.5, overflow: 'hidden' }}>
      {url && !broken ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}
