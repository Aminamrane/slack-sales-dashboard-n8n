import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import EngineCards from './EngineCards';
import { PeriodBar } from './Reactivity';
import { fr } from './model';
import { Face, Legend, Lollipops, TickBreakdown } from './autoAssignParts';
import { useAutoAssignData } from './autoAssignData';

// Onglet Auto-affectation (dev 14/10/2026 : « l'auto-affectation setter et l'auto-affectation sales, deux types, qu'on
// puisse sélectionner une période ; propre, clean, dans le même style »). Il garde le moteur qui distribue les leads ADS aux
// sales (catégories d'effectif, équité, écartés, ratés des 6 minutes). L'autre vue, l'attribution des RDV posés par les setters
// aux sales, est passée dans Perf Setter le 30/10/2026 (onglet « RDV Setter → Sales », components/perfSetter/RdvSetterSales.jsx).
const SALES_PARTS = [['assigned', 'Affectés', '#1e3a7b'], ['excluded_small', '< 100 k€', '#9fb3df'], ['duplicate_skipped', 'Doublons', '#b8c0cf'], ['non_classifiable', 'Sans effectif', '#64748b']];
const CAT_COLORS = ['#cfdaf0', '#9fb3df', '#7f9ad9', '#3d5ba8', '#1e3a7b'];

export default function AutoAssignTab({ month, avatarFor }) {
  const { period, setPeriod, state, analytics } = useAutoAssignData(month);
  const data = state.data;
  return (
    <div className="ps2-grid">
      <div className="ps2-span-12 ps2-autobar" style={{ justifyContent: 'flex-end' }}>
        <PeriodBar period={period} onPeriod={setPeriod} analytics={analytics} loading={state.loading} />
      </div>
      {state.error && <div className="ps2-span-12 ps2-empty" role="alert">Période non chargée</div>}
      {data && (
        <div className="ps2-span-12">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={`sales-${data.start}-${data.end}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
              <SalesEngine d={{ ...data.sales, engine: data.engine }} avatarFor={avatarFor} />
            </Motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SalesEngine({ d, avatarFor }) {
  const on = useRevealed();
  const t = d.totals;
  const cats = Object.entries(d.categories || {});
  const max = Math.max(1, ...d.people.flatMap((p) => cats.map(([c]) => p.cats[c] || 0)));
  const maxTotal = Math.max(1, ...d.people.map((p) => p.total));
  const L = d.leads;
  const fates = d.fates || {};
  if (!t.seen) return <div className="ps2-empty">Aucun lead ADS passé par le moteur sur la période</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="ps2-grid">
        <Reveal as="section" className="ps2-card ps2-span-7" aria-labelledby="ps2-auto-seen">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-seen">Leads ADS vus par le moteur</h2><b className="ps2-auto-total ps2-num"><CountUp value={t.seen} /></b></Motion.div>
          <Motion.div variants={ITEM}><TickBreakdown items={[
            { key: 'assigned', label: 'Affectés', value: t.assigned, color: '#1e3a7b', detail: <Detail kicker="Affectés par le moteur" value={fr(t.assigned)}
              rows={L ? [['Leads distincts', fr(L.leads)], ['Clean · tél FR, 100 k€ et +', fr(L.clean)], ['Tél non FR', fr(L.non_fr)], ['Moins de 100 k€ sur la fiche', fr(L.u100)], ['Reçus avant la période', fr(L.before)]] : []}
              source="Funnel Leads ne compte que les leads clean reçus sur la période" /> },
            { key: 'small', label: '< 100 k€', value: t.excluded_small, color: '#9fb3df', detail: <Detail kicker="Écartés" title="Moins de 100 k€ déclaré" value={fr(t.excluded_small)} rows={[['Distribués', '0']]} /> },
            { key: 'dup', label: 'Doublons', value: t.duplicate_skipped, color: '#b8c0cf', detail: <Detail kicker="Écartés" title="Contact déjà reçu" value={fr(t.duplicate_skipped)} rows={[['Distribués', '0']]} /> },
            { key: 'nc', label: 'Sans effectif', value: t.non_classifiable, color: '#64748b', detail: <Detail kicker="Écartés" title="Effectif inconnu" value={fr(t.non_classifiable)} rows={[['Distribués', '0']]} /> },
          ]} /></Motion.div>
        </Reveal>
        <Reveal as="section" className="ps2-card ps2-span-5" aria-labelledby="ps2-auto-fate">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-fate">Où sont-ils aujourd’hui</h2>
            <Info className="ps2-auto-missed" label="Ratés des 6 minutes, détail"
              detail={<Detail kicker="Règle des 6 minutes" title="Ratés sur la période" value={fr(t.missed)} rows={d.people.filter((p) => p.missed).map((p) => [p.name, fr(p.missed)])} />}>
              <span>Ratés 6 min</span><b className="ps2-num">{fr(t.missed)}</b></Info></Motion.div>
          {L && <Motion.div variants={ITEM}><TickBreakdown minCol={96} items={[
            { key: 'kept', label: 'Chez le même sales', value: L.kept, color: '#2c6448', detail: <Detail kicker="Toujours chez le sales affecté" value={fr(L.kept)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
            { key: 'moved', label: 'Chez un autre', value: L.moved, color: '#3d5ba8', detail: <Detail kicker="Repris ou réaffectés" value={fr(L.moved)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
            { key: 'pool', label: 'Au pool', value: L.pool, color: '#c2410c', detail: <Detail kicker="Sans sales aujourd’hui" value={fr(L.pool)} rows={[['Sur', `${fr(L.leads)} leads`]]} /> },
          ]} /></Motion.div>}
        </Reveal>
      </div>
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-sales">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-sales">Par sales et par effectif</h2></Motion.div>
        <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
          <table className="ps2-ctable" style={{ '--c': '#1e3a7b', minWidth: 900 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Sales</th>{cats.map(([c, l]) => <th key={c}>{l} sal.</th>)}<th className="is-key" style={{ textAlign: 'left', width: 200 }}>Donnés</th><th>Gardés</th></tr></thead>
            <tbody>
              {d.people.map((p, i) => (
                <Motion.tr key={p.name} initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.03 }}>
                  <td style={{ textAlign: 'left' }}><span className="ps2-wb-name"><Face name={p.name} url={avatarFor?.(p.name)} /><span>{p.name}</span>
                    {fates[p.name]?.missed > 0 && <span className="ps2-lost is-missed" title="Leads repartis après un raté des 6 minutes">−{fates[p.name].missed} raté{fates[p.name].missed > 1 ? 's' : ''}</span>}
                    {fates[p.name]?.pool > 0 && <span className="ps2-lost" title="Leads partis au pool">−{fates[p.name].pool} pool</span>}</span></td>
                  {cats.map(([c]) => {
                    const v = p.cats[c] || 0;
                    return <td key={c}>{v ? <span className={`ps2-cb-chip${v / max > 0.5 ? ' is-strong' : ''}`} style={{ '--c': '#1e3a7b', '--a': `${Math.round(10 + 80 * (v / max))}%` }}>{v}</span>
                      : <span className="ps2-muted">·</span>}</td>;
                  })}
                  <td className="is-key" style={{ textAlign: 'left' }}><span className="ps2-ctable-sales"><span className="ps2-ctable-bar" style={{ width: 110 }}><Motion.i initial={{ width: 0 }}
                    animate={{ width: on ? `${(p.total / maxTotal) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.03 }} /></span><b className="ps2-num">{fr(p.total)}</b></span></td>
                  <td><Kept name={p.name} f={fates[p.name]} events={p.missed} /></td>
                </Motion.tr>
              ))}
              <tr className="is-total">
                <td style={{ textAlign: 'left' }}>
                  <Info className="ps2-link" label="Écart d’équité, détail" style={{ color: 'var(--ink)' }}
                    detail={<Detail kicker="Écart d’équité" lines={['Écart entre le sales qui a reçu le plus et celui qui a reçu le moins de leads de la catégorie sur la période, parmi ceux qui en ont reçu.', 'Le moteur rattrape les écarts au fil des affectations (crédits).']} />}>Écart max - min</Info>
                </td>
                {cats.map(([c]) => <td key={c} className={d.spread[c] >= 5 ? 'ps2-low' : ''}>{fr(d.spread[c])}</td>)}
                <td className="is-key" style={{ textAlign: 'left' }}>{fr(t.assigned)}</td><td>{fr(Object.values(fates).reduce((a, f) => a + f.kept, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>
      {d.engine && <div className="ps2-grid"><EngineCards e={d.engine} avatarFor={avatarFor} /></div>}
      <Reveal as="section" className="ps2-card" aria-labelledby="ps2-auto-days">
        <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="ps2-auto-days">Jour par jour</h2><Legend parts={SALES_PARTS} /></Motion.div>
        <Motion.div variants={ITEM}><Lollipops days={d.days} parts={SALES_PARTS} title="Leads ADS vus par le moteur" /></Motion.div>
      </Reveal>
    </div>
  );
}

// Gardés = colonne « Leads » de l'onglet Réactivité (même population). Le pont, au clic, part des leads donnés par le
// moteur (dev 14/10/2026 : « Gary, 42 ici et 32 en réactivité : il faut qu'on comprenne pourquoi, à côté du nom »).
function Kept({ name, f, events }) {
  if (!f) return <span className="ps2-muted">–</span>;
  const others = Math.max(0, (events || 0) - f.missed);
  return (
    <Info className="ps2-link" label={`${name}, leads gardés, détail`} style={{ fontWeight: 650 }}
      detail={<Detail kicker={name} title="Leads gardés" value={fr(f.kept)}
        rows={[['Donnés par le moteur', fr(f.engine)], ['Repartis après un raté des 6 min', f.missed ? `−${fr(f.missed)}` : '0', f.missed ? 'ps2-low' : ''],
          ['Partis au pool (3 jours sans RDV, rappel)', f.pool ? `−${fr(f.pool)}` : '0'], f.other ? ['Autres (réaffectés, reçus avant la période)', `−${fr(f.other)}`] : null,
          f.from_peers ? ['Reçus après le raté d’un collègue', `+${fr(f.from_peers)}`, 'ps2-good'] : null, f.manual ? ['Affectés à la main', `+${fr(f.manual)}`] : null,
          ['Gardés (Réactivité, colonne Leads)', fr(f.kept)]]}
        lines={others ? [`${fr(events)} ratés des 6 min sur la période, dont ${fr(others)} sur des leads reçus d’un collègue.`] : []} />}>
      {fr(f.kept)}
    </Info>
  );
}
