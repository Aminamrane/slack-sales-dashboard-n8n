import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Wallet, RotateCcw, TrendingUp, CalendarCheck, Building2, Users, Sparkles, Clock, Banknote, ChevronDown, CalendarDays, Scale, CalendarClock } from 'lucide-react';
import apiClient from '../services/apiClient';
import { computeKpis } from '../pages/TrackingSheetFinance/constants.js';
import { isCurrentProductClient } from '../utils/boardClientState.js';
import { displayEtat } from '../pages/OptilexBoard.jsx';
import './CeoDashboardMetrics.css';

const euro = (v) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(v));
const todayMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date());
function useDashboardData(path, refreshMs = 30000) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false, busy = false;
    setState({ data: null, loading: true, error: false });
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await apiClient.get(path);
        if (!stopped) setState({ data, loading: false, error: false });
      } catch {
        if (!stopped) setState({ data: null, loading: false, error: true });
      } finally { busy = false; }
    };
    load();
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, refreshMs);
    document.addEventListener('visibilitychange', tick);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [path, retry, refreshMs]);
  return { ...state, retry: () => setRetry((n) => n + 1) };
}

function PeriodSelect({ value, onChange, all = false, label }) {
  const options = useMemo(() => {
    const [year, month] = todayMonth().split('-').map(Number);
    const out = [];
    for (let y = year; y >= 2023; y--) for (let m = y === year ? month : 12; m >= 1; m--) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      out.push({ key, label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)) });
    }
    return out;
  }, []);
  return <div className="ceo-metrics-period-wrap"><CalendarDays size={18} aria-hidden="true" />
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="ceo-metrics-period">
      {all && <option value="all">Tout l’historique</option>}
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select><ChevronDown size={16} aria-hidden="true" />
  </div>;
}

function Card({ title, Icon, color, children, footer, loading, error, retry, onClick }) {
  const reduceMotion = useReducedMotion();
  return <motion.article className="ceo-card ceo-metric" initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .4, ease: [.22, 1, .36, 1] }} style={{ '--metric-accent': color }} aria-busy={loading}>
    <div className="ceo-metric-heading"><h3>{title}</h3><span className="ceo-metric-icon"><Icon size={24} strokeWidth={1.9} aria-hidden="true" /></span></div>
    <div className="ceo-metric-body">
      {error ? <div className="ceo-metric-error">Données indisponibles <button onClick={retry}>Réessayer</button></div> : loading ? <div className="ceo-metric-placeholder" aria-label="Chargement">—</div> : children}
    </div>
    <div className="ceo-metric-footer">{footer}
      {onClick && <button className="ceo-metric-link" onClick={onClick}>Voir dans Finance <ArrowUpRight size={17} aria-hidden="true" /></button>}
    </div>
  </motion.article>;
}

function Ratio({ received, expected }) {
  const reduceMotion = useReducedMotion();
  const pct = expected > 0 ? received / expected * 100 : null;
  return <><div className="ceo-metric-value">{euro(received)}</div>
    <div className="ceo-metric-expected">sur <strong>{euro(expected)}</strong> attendus</div>
    <div className="ceo-metric-ratio"><div className="ceo-metric-track" aria-hidden="true"><motion.div initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: Math.min(1, Math.max(0, (pct || 0) / 100)) }} viewport={{ once: true }} transition={{ duration: reduceMotion ? 0 : .65, ease: [.22, 1, .36, 1] }} /></div>
    <span>{pct == null ? 'Taux non calculable' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(pct)} % récupérés`}</span></div></>;
}

export function CeoFinanceMetrics({ onOpenFinance, darkMode }) {
  const [period, setPeriod] = useState(todayMonth);
  const finance = useDashboardData(`/api/v1/finance-periods?period=${period}`);
  const sales = useDashboardData(`/api/v1/ceo-dashboard/sales?period=${period}`);
  const k = useMemo(() => finance.data ? computeKpis(finance.data.periods, 'owner') : null, [finance.data]);
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Finance Owner">
    <div className="ceo-metrics-title"><h2>Finance <small>Owner uniquement</small></h2><PeriodSelect value={period} onChange={setPeriod} label="Mois des indicateurs finance" /></div>
    <div className="ceo-metrics-grid">
      <Card title="Récupération du mois" Icon={Wallet} color="#087f5b" {...finance} footer="Reçu affecté au mois / attendu du mois" onClick={() => onOpenFinance(period)}>
        <Ratio received={k?.receivedTotal} expected={k?.expectedGlobal} />
      </Card>
      <Card title="Récupération des antérieurs" Icon={RotateCcw} color="#a75b09" {...finance} footer="Recouvré / créances dues au début du mois" onClick={() => onOpenFinance(period)}>
        <Ratio received={k?.recoveredPrior} expected={k?.openingDebt} />
      </Card>
      <Card title="Nouveau cash mensuel" Icon={Banknote} color="#4f5fba" {...sales} footer={<>{sales.data?.count ?? '—'} ventes valorisées · signatures du mois{sales.data?.missing_amount_or_plan > 0 && <span className="ceo-metric-warning">{sales.data.missing_amount_or_plan} à compléter (montant ou modalité)</span>}</>}>
        <div className="ceo-metric-value">{euro(sales.data?.monthly)}<span> / mois</span></div>
        <div className="ceo-metric-secondary"><span>Contrats annuels</span><strong>{euro(sales.data?.annual)} / an</strong></div>
      </Card>
      <Card title="Nouvel ARR du mois" Icon={TrendingUp} color="#7544ce" {...sales} footer="Mensualités × 12 + contrats annuels signés">
        <div className="ceo-metric-value">{euro(sales.data?.annualized)}<span> / an</span></div>
        <div className="ceo-metric-note">Engagement signé, même avant encaissement</div>
      </Card>
    </div>
  </section>;
}

export function CeoProductMetrics({ boardRows, darkMode }) {
  const product = useDashboardData('/api/v1/ceo-dashboard/product', 15 * 60 * 1000);
  const identities = useDashboardData('/api/v1/ceo-dashboard/portfolio', 15 * 60 * 1000);
  const onboarding = useMemo(() => {
    if (!Array.isArray(boardRows)) return null;
    const clients = boardRows.filter((r) => !r.is_pending_contract);
    return {
      done: clients.filter((r) => r.rdv_onboarding_done).length,
      remaining: clients.filter((r) => isCurrentProductClient(r, displayEtat(r)) && !r.rdv_onboarding_done).length,
    };
  }, [boardRows]);
  const directors = useMemo(() => {
    if (!Array.isArray(boardRows) || !identities.data) return null;
    const clients = boardRows.filter((r) => isCurrentProductClient(r, displayEtat(r)));
    return clients.reduce((totals, row) => {
      const identity = identities.data.clients?.[row.numero_client];
      totals.count += identity?.directors ?? 0;
      if (!identity?.directors_documented) totals.missing++;
      return totals;
    }, { count: 0, missing: 0 });
  }, [boardRows, identities.data]);
  const d = product.data;
  const formatDate = (v) => v ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(new Date(v)) : 'non renseignée';
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Produit">
    <div className="ceo-metrics-title"><h2>Produit <small>Parc client à date</small></h2></div>
    <div className="ceo-metrics-grid">
      <Card title="Onboarding Owner" Icon={CalendarCheck} color="#087f5b" loading={!onboarding} footer="Effectués par le suivi client · à faire parmi les clients en cours">
        <div className="ceo-metric-value">{onboarding?.done}<span> effectués</span></div><div className="ceo-metric-secondary"><strong>{onboarding?.remaining}</strong><span>restent à onboarder</span></div>
      </Card>
      <Card title="Sociétés accompagnées" Icon={Building2} color="#4f5fba" {...product} footer={d ? `Sociétés référencées · dont ${d.archived_companies ?? '—'} archivées` : 'Sociétés et économies : interface client'}>
        <div className="ceo-metric-value">{d?.companies == null ? '—' : new Intl.NumberFormat('fr-FR').format(d.companies)}</div><div className="ceo-metric-note">Interface client · au {formatDate(d?.companies_as_of)}</div>
      </Card>
      <Card title="Dirigeants accompagnés" Icon={Users} color="#7544ce" {...identities} loading={identities.loading || !directors} footer={directors?.missing ? `${directors.missing} dossiers sans identité NDA documentée` : 'Identités documentées lors de la génération du NDA'}>
        <div className="ceo-metric-value">{directors ? new Intl.NumberFormat('fr-FR').format(directors.count) : '—'}</div>
        <div className="ceo-metric-note">Source : NDA Owner · clients en cours</div>
      </Card>
      <Card title="Économies réalisées" Icon={Sparkles} color="#a75b09" {...product} footer="Total réalisé · économies à venir exclues">
        <div className="ceo-metric-value">{euro(d?.savings)}</div><div className="ceo-metric-note">Arrêté au {formatDate(d?.savings_as_of)}</div>
      </Card>
    </div>
    {d?.stale && <p className="ceo-metrics-caption" role="status">
      Actualisation temporairement indisponible · dernières données disponibles
    </p>}
  </section>;
}

const DELAYS = [
  ['ads_contact', 'Arrivée du lead Ads → premier contact', 'Leads Ads reçus pendant la période · minutes calendaires'],
  ['contact_owner', 'Premier contact → signature Owner', 'Premiers contacts de la période'],
  ['owner_optilex', 'Signature Owner → signature Opti’lex', 'Signatures Owner de la période'],
  ['owner_onboarding', 'Signature Owner → onboarding Owner effectué', 'Signatures Owner de la période'],
  ['optilex_onboarding', 'Signature Opti’lex → intégration cabinet effectuée', 'Signatures Opti’lex de la période'],
  ['owner_payment_monthly', 'Signature Owner → premier paiement mensuel', 'Signatures Owner de la période · reçus réels datés'],
  ['owner_payment_annual', 'Signature Owner → premier paiement annuel', 'Signatures Owner de la période · reçus réels datés'],
];

export function CeoDelayMetrics({ darkMode }) {
  const [period, setPeriod] = useState(todayMonth);
  const state = useDashboardData(`/api/v1/ceo-dashboard/delays?period=${period}`);
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Délais moyens">
    <div className="ceo-metrics-title"><h2>Délais moyens <small>Étapes réellement enregistrées</small></h2><PeriodSelect value={period} onChange={setPeriod} all label="Période des délais moyens" /></div>
    <div className="ceo-card ceo-delay-list" aria-busy={state.loading}>
      {state.error && <div className="ceo-metric-error">Données indisponibles <button onClick={state.retry}>Réessayer</button></div>}
      {DELAYS.map(([key, label, cohort]) => {
        const d = state.data?.metrics?.[key];
        return <div className="ceo-delay-row" key={key}><Clock size={19} aria-hidden="true" /><div><strong>{label}</strong><small>{cohort} · {d ? `${d.count} / ${d.eligible} dossiers mesurables` : '—'}</small></div>
          <span className="ceo-delay-value">{d?.average == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(d.average)} <small>{d?.average == null ? '' : d.unit}</small></span>
        </div>;
      })}
    </div>
  </section>;
}

export function CeoUpcomingAppointments({ appointments, loading }) {
  return <div className="ceo-appointments" role="group" aria-label="Rendez-vous à venir" aria-busy={loading}>
    {[['onboarding', 'RDV onboarding à venir', 'Owner', CalendarClock], ['integration', 'RDV intégration à venir', 'Cabinet partenaire', Scale]].map(([key, label, entity, Icon]) => {
      const data = appointments[key];
      return <div className="ceo-appointment" key={key}>
        <span className={`ceo-appointment-icon ceo-appointment-icon--${key}`}><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></span>
        <div className="ceo-appointment-copy"><h3>{label}</h3><span>{entity}</span>
          {!loading && data.overdue > 0 && <span className="ceo-appointment-alert">{key === 'integration' ? 'dont ' : '+ '}{data.overdue} en retard</span>}
        </div>
        <strong className="ceo-appointment-value">{loading ? '—' : new Intl.NumberFormat('fr-FR').format(data.upcoming)}</strong>
      </div>;
    })}
  </div>;
}
