import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, useRevealed } from '../perfSales/motion';
import { Detail, Info } from '../perfSales/v2/Pop';
import { PeriodBar } from '../perfSales/v2/Reactivity';
import { fr } from '../perfSales/v2/model';
import { Face, Legend, Lollipops, TickBreakdown } from '../perfSales/v2/autoAssignParts';
import { useAutoAssignData } from '../perfSales/v2/autoAssignData';

// Onglet « RDV Setter → Sales » de Perf Setter (/ceo/setters) : l'attribution des RDV posés par les setters aux sales (raison :
// déjà suivi, prioritaire, préférence, équité ; ce que le RDV est devenu), les sales éligibles et le jour par jour. Vue déplacée
// de l'onglet Auto-affectation de la Performance Sales (30/10/2026) : mêmes données (/monitoring/performance/v2/auto-assign),
// mêmes calculs, mêmes composants (briques partagées dans perfSales/v2/autoAssignParts.jsx) ; la vue « Leads ADS → sales » reste dans Perf Sales.

const REASONS = [['owner', 'Déjà suivi', '#1e3a7b'], ['priority', 'Prioritaire', '#3e7d5a'], ['preference', 'Préférence', '#d4834a'], ['equity', 'Équité', '#9fb3df']];
const STATES = [['held', 'Honorés', '#2c6448'], ['no_show', 'No-show', '#c2410c'], ['cancelled', 'Annulés', '#8a93a6'], ['moved', 'Déplacés', '#b8c0cf'], ['to_qualify', 'À qualifier', '#6b7a99'], ['upcoming', 'À venir', '#9fb3df']];

export default function RdvSetterSales({ month, avatarFor, refreshKey = 0 }) {
  const { period, setPeriod, state, analytics } = useAutoAssignData(month, refreshKey);
  const data = state.data;
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12 ps2-autobar pst-autobar">
        <PeriodBar period={period} onPeriod={setPeriod} analytics={analytics} loading={state.loading} />
      </div>
      {state.error && <div className="ps2-span-12 ps2-empty" role="alert">Période non chargée</div>}
      {!data && !state.error && <div className="ps2-span-12 ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
      {data && (
        <div className="ps2-span-12">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={`setters-${data.start}-${data.end}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
              {data.setters ? <SetterEngine d={data.setters} avatarFor={avatarFor} /> : <div className="ps2-empty" role="alert">Période non chargée</div>}
            </Motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SetterEngine({ d, avatarFor }) {
  const on = useRevealed();
  const t = d.totals;
  const maxTotal = Math.max(1, ...d.people.map((p) => p.total));
  const maxSetter = Math.max(1, ...d.setters.map((s) => s.total));
  const presence = t.held + t.no_show ? (t.held / (t.held + t.no_show)) * 100 : null;
  const elig = new Map((d.eligibility?.people || []).map((p) => [p.name, p]));
  if (!t.total) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {d.eligibility && <Eligibility e={d.eligibility} avatarFor={avatarFor} />}
      <div className="ps2-empty">Aucun RDV setter attribué sur la période</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {d.eligibility && <Eligibility e={d.eligibility} avatarFor={avatarFor} />}
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-auto-why">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-why">RDV setters attribués</h2><b className="ps2-auto-total ps2-num"><CountUp value={t.total} /></b></Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown minCol={92} items={REASONS.map(([k, l, c]) => ({ key: k, label: l, value: t[k], color: c,
            detail: <Detail kicker="Raison de l’attribution" title={l} value={fr(t[k])} rows={d.people.filter((p) => p[k]).map((p) => [p.name, fr(p[k])])} /> }))} /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-auto-became">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-became">Ce que les RDV sont devenus</h2>
            {presence != null && <Info className="ps2-auto-missed is-good" label="Présence, détail"
              detail={<Detail kicker="Présence" value={`${fr(presence, 0)} %`} lines={[`${fr(t.held)} honorés ÷ (${fr(t.held)} honorés + ${fr(t.no_show)} no-show)`]} />}>
              <span>Présence</span><b className="ps2-num">{fr(presence, 0)} %</b></Info>}</Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown minCol={88} items={STATES.map(([k, l, c]) => ({ key: k, label: l, value: t[k], color: c,
            detail: <Detail kicker="RDV" title={l} value={fr(t[k])} rows={d.people.filter((p) => p[k]).map((p) => [p.name, fr(p[k])])} /> }))} /></Motion.div>
        </Reveal>
      </div>
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-auto-sdays">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-sdays">Jour par jour</h2><Legend parts={REASONS} /></Motion.div>
          <Motion.div variants={ITEM}><Lollipops days={d.days} parts={REASONS} title="RDV setters attribués" /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-auto-setters">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-setters">Setters</h2></Motion.div>
          <div className="ps2-vbars">
            {d.setters.map((s, i) => (
              <div key={s.name} className="ps2-vbars-row" style={{ gridTemplateColumns: '180px minmax(0, 1fr) 36px' }}>
                <span className="ps2-vbars-label"><Face name={s.name} url={avatarFor?.(s.name)} /><span>{s.name}</span></span>
                <span className="ps2-vbars-track"><Motion.i initial={{ width: 0 }} animate={{ width: on ? `${(s.total / maxSetter) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.06 }} style={{ background: '#2c6448' }} /></span>
                <b className="ps2-num">{fr(s.total)}</b>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-ssales">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-ssales">Par sales</h2>
          <Legend parts={REASONS} /></Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable" style={{ '--c': '#2c6448', minWidth: 900 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Sales</th><th style={{ textAlign: 'left', width: 220 }}>Raison de l’attribution</th><th className="is-key">RDV</th>
              <th style={{ textAlign: 'left', width: 200 }}>Devenus</th><th>Honorés</th><th>No-show</th><th>À venir</th></tr></thead>
            <tbody>
              {d.people.map((p, i) => (
                <Motion.tr key={p.name} initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.03 }}>
                  <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={p.name} url={avatarFor?.(p.name)} /><span>{p.name}</span>
                    {elig.get(p.name) && !elig.get(p.name).eligible && <span className="ps2-tag">non éligible</span>}</span></td>
                  <td style={{ textAlign: 'left' }}><Stack parts={REASONS.map(([k, l, c]) => ({ key: k, label: l, color: c, value: p[k] }))} width={(p.total / maxTotal) * 200} /></td>
                  <td className="is-key"><b>{fr(p.total)}</b></td>
                  <td style={{ textAlign: 'left' }}><Stack parts={STATES.map(([k, l, c]) => ({ key: k, label: l, color: c, value: p[k] }))} width={160} /></td>
                  <td>{fr(p.held)}</td><td className={p.no_show ? 'ps2-low' : 'ps2-muted'}>{fr(p.no_show)}</td><td>{fr(p.upcoming)}</td>
                </Motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

// Éligibles aux RDV setters (dev 15/10/2026 : « au moins 5 ventes sur un mois, peu importe le mois » ; « mettre à jour la
// page Perf Sales avec les sales qui sont éligibles, automatiquement ») : la règle du moteur, lue par le serveur.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthText = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : null);

function Eligibility({ e, avatarFor }) {
  const on = useRevealed();
  const rule = (
    <Detail kicker="RDV setters" title="Qui peut en recevoir" lines={[
      `Au moins un mois calendaire avec ${e.min} ventes déclarées, n’importe quel mois (mois de la déclaration), recalculé à chaque RDV.`,
      'Depuis le 15 octobre : un lead déjà suivi reste à son sales ; une seconde chance passe par l’auto-affectation, jamais chez son propriétaire historique.',
      'Le RDV posé par un setter va toujours dans l’agenda Google du sales, même s’il a coupé sa synchronisation.']} />
  );
  return (
    <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-elig">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-auto-elig">Éligibles aux RDV setters</h2>
        <Info className="ps2-elig-count" label={`${fr(e.eligible)} / ${fr(e.people.length)} éligibles, règle d’éligibilité`} detail={rule}>
          <b className="ps2-auto-total ps2-num"><CountUp value={e.eligible} /></b><span className="ps2-num">/ {fr(e.people.length)}</span>
        </Info>
      </Motion.div>
      <div className="ps2-elig-grid">
        {e.people.map((p, i) => {
          const detail = (
            <Detail kicker="RDV setters" title={p.name} value={p.eligible ? 'Éligible' : 'Pas encore'}
              rows={[['Meilleur mois', p.best_month ? `${monthText(p.best_month)} · ${fr(p.best)} vente${p.best > 1 ? 's' : ''}` : 'aucune vente'],
                ['Mois à ' + e.min + ' ventes ou plus', fr(p.proven_months.length)],
                ...(p.proven_months.length ? [['Dernier', monthText(p.proven_months[p.proven_months.length - 1])]] : []),
                ['Ventes déclarées au total', fr(p.total)], ['Agenda synchronisé', p.calendar ? 'oui' : 'non']]} />
          );
          return (
            <Info key={p.name} as="motion" className={`ps2-elig${p.eligible ? ' is-in' : ''}`} detail={detail}
              initial={{ opacity: 0, y: 8 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, ease: EASE, delay: 0.05 + i * 0.035 }}>
              <Face name={p.name} url={avatarFor?.(p.name)} />
              <span className="ps2-elig-name">{p.name}</span>
              <span className="ps2-elig-pips" aria-hidden="true">
                {Array.from({ length: e.min }, (_, k) => (
                  <Motion.i key={k} initial={{ scale: 0.4, opacity: 0 }} animate={on ? { scale: 1, opacity: 1 } : {}}
                    transition={{ duration: 0.35, ease: EASE, delay: 0.25 + i * 0.035 + k * 0.05 }} className={k < Math.min(p.best, e.min) ? 'is-on' : ''} />
                ))}
              </span>
              <span className={`ps2-elig-state ps2-num${p.eligible ? '' : ' is-out'}`}>{p.eligible ? 'éligible' : `${fr(p.best)} / ${e.min}`}</span>
            </Info>
          );
        })}
      </div>
    </Reveal>
  );
}

function Stack({ parts, width }) {
  const on = useRevealed();
  const total = parts.reduce((a, x) => a + (x.value || 0), 0);
  if (!total) return <span className="ps2-muted">–</span>;
  return (
    <Info className="ps2-ministack" style={{ width: Math.max(24, width) }} label="Détail" detail={<Detail rows={parts.filter((x) => x.value).map((x) => [x.label, fr(x.value)])} />}>
      {parts.map((x, k) => (x.value ? <Motion.i key={x.key} style={{ background: x.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: on ? x.value : 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.2 + k * 0.05 }} title={`${x.label} : ${x.value}`} /> : null))}
    </Info>
  );
}
