import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { CountUp, EASE, ITEM, Reveal, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { euro, fr, initials } from './model';

// Onglet Setters (dev 14/10/2026 : « prends exemple sur la page Setters du dashboard : plus de détails, de vraies stats ;
// par rapport à leur taux de transfo, voir combien de volume il doit faire chacun »). Même calcul que la page Setters
// (RDV posés au mois du RDV, honorés, no-show, ventes au mois de signature) et les appels Allo du mois. Pour chaque
// setter : son parcours appels → répondus → RDV → honorés → ventes, ses taux, et le volume d'appels par jour qu'il lui
// faut, à ses propres taux, pour atteindre l'objectif de ventes choisi d'ici la fin du mois.
export default function SettersTab({ period, days, avatarFor }) {
  const [data, setData] = useState(null);
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState(3);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return undefined;
    let alive = true;
    setData(null); setCalls(null); setError(false);
    apiClient.get(`/api/v1/monitoring/performance/v2/setters?period=${period}`).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    apiClient.get(`/api/v1/monitoring/performance/v2/setters/calls?period=${period}`).then((d) => alive && setCalls(d)).catch(() => alive && setCalls({ status: 'error', setters: {} }));
    return () => { alive = false; };
  }, [period]);
  if (error) return <div className="ps2-empty" role="alert">Setters non chargés</div>;
  if (!data) return <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>;

  const month = data.month;
  const rows = data.setters.map((s) => {
    const m = s.months?.[month] || {};
    const rdv = m.rdv || {}, sales = m.sales || {};
    const c = calls?.setters?.[s.id];
    return { id: s.id, name: s.name, active: s.active, rdv, sales, calls: c?.status === 'linked' ? c : null, callsStatus: c?.status };
  }).filter((r) => r.active || r.sales.count)
    .sort((a, b) => (b.sales.count || 0) - (a.sales.count || 0) || (b.rdv.total || 0) - (a.rdv.total || 0) || (a.name || '').localeCompare(b.name || ''));
  const team = data.team?.months?.[month] || {};
  const callsTotal = rows.reduce((a, r) => a + (r.calls?.calls || 0), 0);
  const answeredTotal = rows.reduce((a, r) => a + (r.calls?.answered || 0), 0);
  const teamSales = team.sales?.count || 0;
  const callsPerSaleTeam = teamSales ? callsTotal / teamSales : null;
  const remaining = days?.remaining ?? null;
  const presenceTeam = (team.rdv?.held || 0) + (team.rdv?.no_show || 0) ? team.rdv.held / (team.rdv.held + team.rdv.no_show) : null;
  // Moyenne par jour ouvré des RDV (demande du 15/10/2026 : « le chiffre suivi de / et la moyenne par jour ») : le chiffre
  // du mois ÷ les jours ouvrés écoulés, ceux de « jour ouvré 11 / 22 » de l'en-tête. Aucun jour écoulé : le chiffre seul.
  const elapsed = days?.elapsed > 0 ? days.elapsed : null;
  const withPerDay = (n) => (
    <>
      <CountUp value={n} />
      {elapsed && <small title={`Moyenne par jour ouvré : ${fr(n)} ÷ ${elapsed} j ouvrés écoulés`}> / {fr(n / elapsed, 1)} par&nbsp;jour</small>}
    </>
  );

  return (
    <div className="ps2-grid">
      <Reveal as="section" className="ps2-span-12 ps2-setter-kpis" aria-label="Setters, le mois" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07 } } }}>
        {[
          ['Appels', callsTotal ? <CountUp value={callsTotal} /> : (calls ? '–' : '…'), callsTotal ? `${fr((answeredTotal / callsTotal) * 100, 0)} % répondus` : 'Allo'],
          ['RDV posés', withPerDay(team.rdv?.total || 0), `${fr(team.rdv?.upcoming || 0)} à venir · ${fr(team.rdv?.to_qualify || 0)} à qualifier`],
          ['RDV honorés', withPerDay(team.rdv?.held || 0), presenceTeam == null ? '' : `${fr(presenceTeam * 100, 0)} % de présence`],
          ['Ventes', <CountUp value={teamSales} />, euro(team.sales?.amount || 0)],
          ['Appels pour 1 vente', callsPerSaleTeam ? <CountUp value={callsPerSaleTeam} /> : '–', 'équipe setters, ce mois'],
        ].map(([l, v, n]) => (
          <Motion.div key={l} className="ps2-setter-kpi" variants={ITEM}><span>{l}</span><b className="ps2-num">{v}</b><small>{n}</small></Motion.div>
        ))}
      </Reveal>

      <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-setters-title">
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
              <tr><th style={{ textAlign: 'left' }}>Setter</th><th>Appels</th><th>Répondus</th><th>RDV posés</th><th>Honorés</th><th>No-show</th><th>Ventes</th><th>CA</th>
                <th style={{ textAlign: 'left', width: 220 }}>Parcours</th><th className="is-key">Appels / vente</th><th className="is-key">Pour l’objectif</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <SetterRow key={r.id} r={r} i={i} target={target} remaining={remaining} teamCallsPerSale={callsPerSaleTeam} avatarFor={avatarFor} callsLoaded={!!calls} />)}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

function SetterRow({ r, i, target, remaining, teamCallsPerSale, avatarFor, callsLoaded }) {
  const on = useRevealed();
  const c = r.calls;
  const held = r.rdv.held || 0, noshow = r.rdv.no_show || 0, sold = r.sales.count || 0;
  const presence = held + noshow ? held / (held + noshow) : null;
  const callsPerSale = c && sold ? c.calls / sold : null;
  const basis = callsPerSale ?? teamCallsPerSale;
  const missing = Math.max(0, target - sold);
  const perDay = basis && remaining ? (missing * basis) / remaining : null;
  const steps = [['Appels', c?.calls], ['Répondus', c?.answered], ['RDV', r.rdv.total], ['Honorés', held], ['Ventes', sold]];
  const max = Math.max(1, ...steps.map(([, v]) => v || 0));
  const height = (v) => (v ? Math.max(10, (Math.log10(v + 1) / Math.log10(max + 1)) * 100) : 0);   // échelle log : 700 appels et 2 ventes restent lisibles
  return (
    <Motion.tr initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.04 }}>
      <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={r.name} url={avatarFor?.(r.name)} /><span>{r.name}</span></span></td>
      <td>{c ? fr(c.calls) : <span className="ps2-muted">{callsLoaded ? (r.callsStatus === 'missing' ? 'sans Allo' : '–') : '…'}</span>}</td>
      <td>{c ? <>{fr(c.answered)} <small className="ps2-muted">{fr((c.answered / Math.max(1, c.calls)) * 100, 0)} %</small></> : <span className="ps2-muted">–</span>}</td>
      <td>{fr(r.rdv.total)}</td>
      <td>{fr(held)} {presence != null && <small className="ps2-muted">{fr(presence * 100, 0)} %</small>}</td>
      <td className={noshow ? 'ps2-low' : 'ps2-muted'}>{fr(noshow)}</td>
      <td><b>{fr(sold)}</b></td>
      <td>{r.sales.amount ? euro(r.sales.amount) : <span className="ps2-muted">–</span>}</td>
      <td style={{ textAlign: 'left' }}>
        <Info className="ps2-setter-flow" label={`Parcours de ${r.name}`}
          detail={<Detail kicker={r.name} title="Parcours du mois"
            rows={steps.map(([l, v], k) => [l, v == null ? '–' : `${fr(v)}${k && steps[k - 1][1] ? ` · ${fr((v / steps[k - 1][1]) * 100, 0)} %` : ''}`])}
            lines={[c && sold ? `${fr(c.calls)} appels ÷ ${sold} ventes = ${fr(callsPerSale, 0)} appels par vente` : 'Pas encore de vente ce mois : taux de l’équipe setters.',
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
