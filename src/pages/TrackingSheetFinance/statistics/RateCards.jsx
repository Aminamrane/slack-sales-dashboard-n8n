import React, { useState } from 'react';
import { CalendarX2, ChevronRight, Undo2 } from 'lucide-react';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { parisToday } from '../../../utils/parisDates.js';
import {
  LEVEL, ONBOARDING_STATUS, ONBOARDING_VIEWS, REPORT_WHEN, byPerson, count, dayFR, eur, outcomeMeta, pct, peopleOf, plural, weatherTone,
} from './model.js';

const since = (iso) => (iso ? ` Les reports laissent une trace depuis le ${dayFR(iso)} : avant, ils ne sont pas comptés.` : '');
import { dayRange, daysOf, monthLabel, monthShort, rangeFor, rangeLabel } from './period.js';
import { Avatar, Card, Collapse, Fill, Num, Pill, Segmented } from './parts.jsx';
import { useStatistic } from './useStatistics.js';

const SPANS = [{ key: 'month', label: 'Mois' }, { key: 'quarter', label: '3 mois' }, { key: 'year', label: 'Année' }, { key: 'custom', label: 'Période' }];

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
function People({ people, top, cases, render, numerator, denominator, extra, tone = 'red' }) {
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
              <Fill value={top ? (person.rate || 0) / top : 0} tone={person.rate ? tone : 'zero'} />
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

// Fenêtre d'une carte : un mois, trois mois, l'année, ou deux jours choisis (dev 13/11/2026 : « une période définie,
// choisie »). Les jours tapés (`draft`) ne deviennent la période lue (`days`) qu'une fois valides : un champ vidé
// laisse les chiffres en place.
function useSpan(anchor, current) {
  const [span, setSpan] = useState('quarter');
  const [draft, setDraft] = useState(null);
  const [days, setDays] = useState(null);
  const today = parisToday();
  const months = rangeFor(span === 'custom' ? 'quarter' : span, anchor, current);
  const range = span === 'custom' && days ? days : months;
  const pick = (next) => {
    if (next === 'custom') {
      const start = daysOf(range, today);
      setDraft(start);
      setDays(start);
    }
    setSpan(next);
  };
  const type = (edge, value) => {
    const next = { ...draft, [edge]: value };
    setDraft(next);
    const valid = dayRange(next, today);
    if (valid) setDays(valid);
  };
  return { span, pick, range, draft, type, today };
}

function Days({ win: w, label }) {
  if (w.span !== 'custom' || !w.draft) return null;
  return (
    <div className="fst-days" role="group" aria-label={label}>
      du
      <input type="date" className="fst-select" value={w.draft.from} max={w.today} onChange={(e) => w.type('from', e.target.value)} aria-label="Premier jour" />
      au
      <input type="date" className="fst-select" value={w.draft.to} max={w.today} onChange={(e) => w.type('to', e.target.value)} aria-label="Dernier jour" />
    </div>
  );
}

// Texte long du board : quatre lignes, le reste au clic.
function Long({ text }) {
  const [open, setOpen] = useState(false);
  const long = String(text || '').length > 280;
  return (
    <p className="fst-long" data-clamped={long && !open ? 'true' : undefined}>
      {text}
      {long && <button type="button" className="fst-more-link" onClick={() => setOpen(!open)}>{open ? 'Réduire' : 'Lire la suite'}</button>}
    </p>
  );
}

// Ce que le board disait du client : sa météo au moment de la rétractation (avec le motif quand elle le porte) et
// le dernier message posé sur son dossier.
function BoardNotes({ item }) {
  const { weather, last_message: message } = item;
  return (
    <div className="fst-notes">
      <div className="fst-noteblock">
        <div className="fst-noteblock-head">
          <span className="fst-micro">Météo à la rétractation</span>
          {weather ? (
            <>
              <Pill tone={weatherTone(weather.score)} plain>{weather.score}/5 · {weather.label}</Pill>
              <span>{[weather.author, weather.on ? `le ${dayFR(weather.on)}` : null].filter(Boolean).join(' · ')}{weather.after ? ' (notée après la rétractation)' : ''}</span>
            </>
          ) : <span>Aucune météo notée sur ce client.</span>}
        </div>
        {weather?.reason && <p><span>Motif</span> {weather.reason}</p>}
        {weather?.expectation && <p><span>Attente du client</span> {weather.expectation}</p>}
        {weather?.actions && <p><span>Action envisagée</span> {weather.actions}</p>}
        {weather?.note && <Long text={weather.note} />}
      </div>
      {message && (
        <div className="fst-noteblock">
          <div className="fst-noteblock-head">
            <span className="fst-micro">Dernier message</span>
            <span>{[message.author, message.role, message.on ? `le ${dayFR(message.on)}` : null].filter(Boolean).join(' · ')}</span>
          </div>
          <Long text={message.body} />
        </div>
      )}
    </div>
  );
}

// ── Rétractations ───────────────────────────────────────────────────────────────────────────────────
export function RetractionsCard({ anchor, current, canOpen, onOpenClient }) {
  const win = useSpan(anchor, current);
  const { span, range } = win;
  const state = useStatistic('retractions', range);
  const data = state.data;
  const totals = data?.totals || {};
  const people = (data?.by_sales_person || []).filter((p) => p.sales > 0);
  const top = Math.max(0, ...people.map((p) => p.rate || 0));

  return (
    <Card title="Taux de rétractation par sales" Icon={Undo2} state={state} skeleton={340} hint={`Ventes signées sur la période · ${rangeLabel(range)}`}
      actions={<Segmented small options={SPANS} value={span} onChange={win.pick} label="Période des rétractations" />}>
      <Days win={win} label="Jours des rétractations" />
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
                {item.source === 'crm' && <div><span>État lu sur</span> la fiche CRM (client absent du board)</div>}
              </div>
              {data.notes && <BoardNotes item={item} />}
            </div>
          )} />
      )}
      <p className="fst-note">
        Taux = ventes rétractées ÷ ventes signées sur la période. Une vente est rétractée quand son client est à l’état « Rétractation » sur le board.
        Une rétractation en cours est listée mais n’entre dans le taux qu’une fois confirmée.
        {totals.from_crm ? ` ${plural(totals.from_crm, 'client absent', 'clients absents')} du board : état lu sur la fiche CRM.` : ''}
      </p>
    </Card>
  );
}

// ── No show et reports d'onboarding ─────────────────────────────────────────────────────────────────
function Onboarding({ row, canOpen, onOpenClient }) {
  const status = ONBOARDING_STATUS[row.status] || ONBOARDING_STATUS.none;
  return (
    <div className="fst-case">
      <div className="fst-case-head">
        <Client row={row} canOpen={canOpen} onOpenClient={onOpenClient} />
        <Pill tone={status.tone}>{status.label}</Pill>
        {row.status === 'no_show' && row.level && <Pill tone="ghost" plain title="Certain : le Client Success l’a signalé. Probable : le rappel était parti, le rendez-vous tenait.">{LEVEL[row.level]}</Pill>}
        {row.reports > 0 && <Pill tone="ghost" plain>{plural(row.reports, 'report')}</Pill>}
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
                {step.outcome === 'postponed' && REPORT_WHEN[step.when] && <span className="fst-case-num">{REPORT_WHEN[step.when]}</span>}
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
  const win = useSpan(anchor, current);
  const { span, range } = win;
  const [view, setView] = useState('no_show');
  const state = useStatistic('onboarding-no-shows', range);
  const data = state.data;
  const totals = data?.totals || {};
  const reading = ONBOARDING_VIEWS[view];
  const people = peopleOf(data?.by_sales_person, view);
  const top = Math.max(0, ...people.map((p) => p.rate || 0));
  const listed = (name) => byPerson(data.clients, name).filter(reading.listed);
  // Les deux taux côte à côte, jamais mélangés : on bascule de l'un à l'autre, le détail suit.
  const views = Object.entries(ONBOARDING_VIEWS).map(([key, v]) => ({ key, label: <>{v.label} <b className="fst-num">{pct(totals[v.rate])}</b></> }));

  return (
    <Card title="No show d’onboarding par sales" Icon={CalendarX2} state={state} skeleton={340} hint={`Ventes signées sur la période · ${rangeLabel(range)}`}
      actions={<Segmented small options={SPANS} value={span} onChange={win.pick} label="Période des onboardings" />}>
      <Days win={win} label="Jours des onboardings" />
      <div className="fst-views"><Segmented small options={views} value={view} onChange={setView} label="No show ou reports" /></div>
      <div className="fst-rate-top">
        <div>
          <Num className="fst-rate-big" value={totals[reading.rate]} format={(n) => pct(n)} />
          {view === 'no_show' ? (
            <div className="fst-rate-note">
              {plural(totals.no_show || 0, 'client')} en no show sur {count(totals.due || 0)} au rendez-vous passé (tenu ou no show)
              {totals.to_confirm ? ` · ${count(totals.to_confirm)} à confirmer, non compté${totals.to_confirm > 1 ? 's' : ''}` : ''}
            </div>
          ) : (
            <div className="fst-rate-note">
              {plural(totals.reported || 0, 'client reporté', 'clients reportés')} sur {count(totals.followed || 0)} suivis
              {totals.reports ? ` · ${plural(totals.reports, 'report')} en tout` : ''}
              {totals.reported_late ? ` · ${count(totals.reported_late)} le jour même ou après` : ''}
            </div>
          )}
        </div>
        <Spark months={data?.by_month} rateOf={(m) => m[reading.rate]} />
      </div>
      {people.length === 0 ? <div className="fst-empty">Aucune vente signée sur cette période.</div> : (
        <People key={view} people={people} top={top} numerator={reading.numerator} denominator={reading.denominator} cases={listed} tone={view === 'reports' ? 'amber' : 'red'}
          extra={(person) => (view === 'no_show' && person.to_confirm ? <small className="fst-extra">+ {person.to_confirm} à confirmer</small> : null)}
          render={(row) => <Onboarding key={row.sale_id} row={row} canOpen={canOpen} onOpenClient={onOpenClient} />} />
      )}
      <p className="fst-note">
        No show = le dernier rendez-vous du client est passé, sans onboarding tenu ni nouvelle date. Un onboarding finalement tenu n’est jamais un no show ;
        un rendez-vous déplacé est un report, compté à part. Un cas « à confirmer » (rendez-vous passé sans aucune trace) n’entre dans aucun taux.
        {since(data?.traced_since)}
      </p>
    </Card>
  );
}
