import React, { useState } from 'react';
import { CalendarX2, ChevronRight, Undo2 } from 'lucide-react';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { LEVEL, ONBOARDING_STATUS, byPerson, count, dayFR, eur, outcomeMeta, pct, plural } from './model.js';
import { monthLabel, monthShort, rangeFor, rangeLabel } from './period.js';
import { Avatar, Card, Collapse, Fill, Num, Pill, Segmented } from './parts.jsx';
import { useStatistic } from './useStatistics.js';

const SPANS = [{ key: 'month', label: 'Mois' }, { key: 'quarter', label: '3 mois' }, { key: 'year', label: 'Année' }];

// Taux mois par mois : la dernière barre est le mois le plus récent.
function Spark({ months, rateOf }) {
  const drawn = useDrawn();
  if (!months || months.length < 2) return null;
  const top = Math.max(0.0001, ...months.map((m) => rateOf(m) || 0));
  return (
    <div className="fst-spark" aria-hidden="true">
      {months.map((month) => (
        <div key={month.month} title={`${monthLabel(month.month)} : ${pct(rateOf(month))}`}>
          <i style={{ height: `${drawn ? Math.max(4, ((rateOf(month) || 0) / top) * 100) : 0}%` }} />
          <small>{monthShort(month.month).slice(0, 3)}</small>
        </div>
      ))}
    </div>
  );
}

function Client({ row, canOpen, onOpenClient }) {
  const openable = Boolean(row.client_id) && canOpen(row.client_id);
  return (
    <>
      {openable
        ? <button type="button" className="fst-case-name" onClick={() => onOpenClient(row.client_id)} title="Ouvrir la fiche du client">{row.client || 'Sans nom'}</button>
        : <span className="fst-case-name">{row.client || 'Sans nom'}</span>}
      {row.numero_client && <span className="fst-case-num">n° {row.numero_client}</span>}
    </>
  );
}

// Une ligne par sales : le taux, la fraction qui l'explique, et le détail des cas au clic.
function People({ people, top, cases, render, numerator, denominator, extra }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      {people.map((person) => {
        const own = cases(person.name);
        return (
          <div key={person.name}>
            <button type="button" className="fst-person" aria-expanded={open === person.name} disabled={own.length === 0}
              onClick={() => setOpen(open === person.name ? null : person.name)}>
              <Avatar name={person.name} />
              <span className="fst-person-name">{person.name}{extra?.(person)}</span>
              <Fill value={top ? (person.rate || 0) / top : 0} tone={person.rate ? 'red' : 'zero'} />
              <span className="fst-person-frac fst-num">{count(person[numerator])} / {count(person[denominator])}</span>
              <span className="fst-person-rate fst-num">{pct(person.rate)}</span>
              <ChevronRight size={14} className="fst-chev" />
            </button>
            <Collapse open={open === person.name}>
              <div className="fst-cases">{own.map(render)}</div>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}

function useSpan(anchor, current) {
  const [span, setSpan] = useState('quarter');
  return { span, setSpan, range: rangeFor(span, anchor, current) };
}

// ── Rétractations ───────────────────────────────────────────────────────────────────────────────────
export function RetractionsCard({ anchor, current, canOpen, onOpenClient }) {
  const { span, setSpan, range } = useSpan(anchor, current);
  const state = useStatistic('retractions', range);
  const data = state.data;
  const totals = data?.totals || {};
  const people = (data?.by_sales_person || []).filter((p) => p.sales > 0);
  const top = Math.max(0, ...people.map((p) => p.rate || 0));

  return (
    <Card title="Taux de rétractation par sales" Icon={Undo2} state={state} skeleton={340} hint={`Ventes signées sur la période · ${rangeLabel(range)}`}
      actions={<Segmented small options={SPANS} value={span} onChange={setSpan} label="Période des rétractations" />}>
      <div className="fst-rate-top">
        <div>
          <Num className="fst-rate-big" value={totals.rate} format={(n) => pct(n)} />
          <div className="fst-rate-note">
            {plural(totals.retracted || 0, 'rétractation')} sur {plural(totals.sales || 0, 'vente')}
            {totals.pending ? ` · ${count(totals.pending)} en cours (${pct(totals.rate_with_pending)} en les comptant)` : ''}
          </div>
        </div>
        <Spark months={data?.by_month} rateOf={(m) => m.rate} />
      </div>
      {people.length === 0 ? <div className="fst-empty">Aucune vente signée sur cette période.</div> : (
        <People people={people} top={top} numerator="retracted" denominator="sales" cases={(name) => byPerson(data.cases, name)}
          extra={(person) => (person.pending ? <small className="fst-extra">+ {person.pending} en cours</small> : null)}
          render={(item) => (
            <div key={item.sale_id} className="fst-case">
              <div className="fst-case-head">
                <Client row={item} canOpen={canOpen} onOpenClient={onOpenClient} />
                <Pill tone={item.status === 'retracted' ? 'red' : 'amber'}>{item.status === 'retracted' ? 'Rétractée' : 'Rétractation en cours'}</Pill>
              </div>
              <div className="fst-case-facts">
                <div><span>Signée le</span> {dayFR(item.signed_on)}</div>
                {item.effective_on && <div><span>Rétractation le</span> {dayFR(item.effective_on)}{item.days_after_signature != null ? ` (J+${item.days_after_signature})` : ''}</div>}
                {item.declared_by && <div><span>Déclarée par</span> {item.declared_by}{item.declared_on ? ` le ${dayFR(item.declared_on)}` : ''}</div>}
                {item.amount_eur ? <div><span>Contrat</span> {eur(item.amount_eur)} par an HT</div> : null}
              </div>
            </div>
          )} />
      )}
      <p className="fst-note">Taux = ventes rétractées ÷ ventes signées sur la période. Une rétractation en cours est listée mais n’entre dans le taux qu’une fois confirmée.</p>
    </Card>
  );
}

// ── No show d'onboarding ────────────────────────────────────────────────────────────────────────────
function Onboarding({ row, canOpen, onOpenClient }) {
  const status = ONBOARDING_STATUS[row.status] || ONBOARDING_STATUS.none;
  return (
    <div className="fst-case">
      <div className="fst-case-head">
        <Client row={row} canOpen={canOpen} onOpenClient={onOpenClient} />
        <Pill tone={status.tone}>{row.status === 'no_show' && row.no_shows > 1 ? `${row.no_shows} no show` : status.label}</Pill>
        {row.status === 'no_show' && row.level && <Pill tone="ghost" plain title="Certain : une trace écrite le dit. Probable : les traces le laissent penser.">{LEVEL[row.level]}</Pill>}
      </div>
      <div className="fst-case-facts">
        <div><span>Vente signée le</span> {dayFR(row.signed_on)}</div>
        {row.sale_slot && <div><span>Date prise par le sales</span> {dayFR(row.sale_slot)}</div>}
        {row.held_on && <div><span>Onboarding fait le</span> {dayFR(row.held_on)}</div>}
      </div>
      <ol className="fst-rail">
        {row.timeline.map((step, i) => {
          const meta = outcomeMeta(step);
          return (
            <li key={`${step.day}-${i}`} className="fst-step" data-tone={meta.tone} data-old={i < row.timeline.length - 1 && step.outcome !== 'held' ? 'true' : undefined} style={{ '--i': i }}>
              <div className="fst-step-head">
                <span className="fst-step-day fst-num">{dayFR(step.day)}</span>
                <Pill tone={meta.tone} plain>{meta.label}</Pill>
                {step.outcome === 'no_show' && step.level && step.level !== 'to_confirm' && <span className="fst-case-num">{LEVEL[step.level]}</span>}
              </div>
              {step.proofs?.length > 0 && <ul className="fst-proofs">{step.proofs.map((proof, n) => <li key={n}>{proof}</li>)}</ul>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function NoShowsCard({ anchor, current, canOpen, onOpenClient }) {
  const { span, setSpan, range } = useSpan(anchor, current);
  const state = useStatistic('onboarding-no-shows', range);
  const data = state.data;
  const totals = data?.totals || {};
  const people = (data?.by_sales_person || []).filter((p) => p.clients > 0);
  const top = Math.max(0, ...people.map((p) => p.rate || 0));
  const listed = (name) => byPerson(data.clients, name).filter((c) => c.status === 'no_show' || c.status === 'to_confirm');

  return (
    <Card title="No show d’onboarding par sales" Icon={CalendarX2} state={state} skeleton={340} hint={`Ventes signées sur la période · ${rangeLabel(range)}`}
      actions={<Segmented small options={SPANS} value={span} onChange={setSpan} label="Période des no show" />}>
      <div className="fst-rate-top">
        <div>
          <Num className="fst-rate-big" value={totals.rate} format={(n) => pct(n)} />
          <div className="fst-rate-note">
            {plural(totals.no_show || 0, 'client')} en no show sur {count(totals.due || 0)} dont le rendez-vous est passé
            {totals.to_confirm ? ` · ${count(totals.to_confirm)} à confirmer, non compté${totals.to_confirm > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <Spark months={data?.by_month} rateOf={(m) => m.rate} />
      </div>
      {people.length === 0 ? <div className="fst-empty">Aucune vente signée sur cette période.</div> : (
        <People people={people} top={top} numerator="no_show" denominator="due" cases={listed}
          extra={(person) => (person.to_confirm ? <small className="fst-extra">+ {person.to_confirm} à confirmer</small> : null)}
          render={(row) => <Onboarding key={row.sale_id} row={row} canOpen={canOpen} onOpenClient={onOpenClient} />} />
      )}
    </Card>
  );
}
