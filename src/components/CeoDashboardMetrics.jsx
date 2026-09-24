import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Wallet, RotateCcw, TrendingUp, CalendarCheck, Building2, Users, Sparkles, Banknote, ChevronDown, ChevronRight, CalendarDays, Scale, CalendarClock, FileCheck2, X } from 'lucide-react';
import apiClient from '../services/apiClient';
import { computeKpis } from '../pages/TrackingSheetFinance/constants.js';
import { isCurrentProductClient } from '../utils/boardClientState.js';
import { displayEtat } from '../pages/OptilexBoard.jsx';
import { recoveryPace, newSalesCash } from '../utils/dashboardRecovery.js';
import './CeoDashboardMetrics.css';

const euro = (v) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(v)).replace(/\u202f/g, '\u00a0');
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

function Card({ title, Icon, children, footer, loading, error, retry, onClick, tone }) {
  const reduceMotion = useReducedMotion();
  return <motion.article className={`ceo-card ceo-metric${tone ? ` ceo-metric--${tone}` : ''}`} initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .4, ease: [.22, 1, .36, 1] }} aria-busy={loading}>
    <div className="ceo-metric-heading"><h3>{title}</h3><span className="ceo-metric-icon"><Icon size={24} strokeWidth={1.9} aria-hidden="true" /></span></div>
    <div className="ceo-metric-body">
      {error ? <div className="ceo-metric-error">Données indisponibles <button onClick={retry}>Réessayer</button></div> : loading ? <div className="ceo-metric-placeholder" aria-label="Chargement">—</div> : children}
    </div>
    {(footer || onClick) && <div className="ceo-metric-footer">{footer}
      {onClick && <button className="ceo-metric-link" onClick={onClick}>Voir dans Finance <ArrowUpRight size={17} aria-hidden="true" /></button>}
    </div>}
  </motion.article>;
}

function Ratio({ received, expected, period }) {
  const reduceMotion = useReducedMotion();
  const { percentage: pct, benchmark, tone, label } = recoveryPace(received, expected, period);
  const percent = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
  const benchmarkDescription = benchmark == null ? '' : `Repère calendaire : ${percent(benchmark)} % du mois. Vert à ce niveau ou au-dessus ; ambre à partir de 75 % de ce repère ; rouge en dessous.`;
  return <div className={`ceo-recovery ceo-recovery--${tone}`}>
    <div className="ceo-metric-value">{euro(received)}</div>
    <div className="ceo-metric-expected">sur <strong>{euro(expected)}</strong> attendus</div>
    <div className="ceo-metric-ratio"><div className="ceo-recovery-track-wrap">
      <div className="ceo-metric-track" aria-hidden="true"><motion.div initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: Math.min(1, Math.max(0, (pct || 0) / 100)) }} viewport={{ once: true }} transition={{ duration: reduceMotion ? 0 : .65, ease: [.22, 1, .36, 1] }} /></div>
      {pct != null && benchmark != null && <span className="ceo-recovery-marker" style={{ left: `${benchmark}%` }} aria-hidden="true" />}
    </div><span>{pct == null ? 'Taux non calculable' : `${percent(pct)} % récupérés`}</span>
      {label && <span className="ceo-recovery-status" title={benchmarkDescription} tabIndex={0} aria-label={`${label}. ${benchmarkDescription}`}>{label}</span>}
    </div>
  </div>;
}

export function CeoFinanceMetrics({ onOpenFinance, darkMode }) {
  const [period, setPeriod] = useState(todayMonth);
  const finance = useDashboardData(`/api/v1/finance-periods?period=${period}`);
  const sales = useDashboardData(`/api/v1/ceo-dashboard/sales?period=${period}`);
  // Même vision que la page finance par défaut (Globale = Owner + Opti'lex) :
  // le CEO et l'équipe finance lisent les mêmes totaux (demande dev 2026-09-23).
  const k = useMemo(() => finance.data ? computeKpis(finance.data.periods, 'global') : null, [finance.data]);
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Finance">
    <div className="ceo-metrics-title"><h2>Finance <small>Owner + Opti'lex</small></h2><PeriodSelect value={period} onChange={setPeriod} label="Mois des indicateurs finance" /></div>
    <div className="ceo-metrics-grid">
      <Card title="Récupération du mois" Icon={Wallet} {...finance} footer="Reçu affecté au mois / attendu du mois" onClick={() => onOpenFinance(period)}>
        <Ratio received={k?.receivedTotal} expected={k?.expectedGlobal} period={period} />
      </Card>
      <Card title="Récupération des antérieurs" Icon={RotateCcw} {...finance} footer="Recouvré / créances dues au début du mois" onClick={() => onOpenFinance(period)}>
        <Ratio received={k?.recoveredPrior} expected={k?.openingDebt} period={period} />
      </Card>
      <Card title="Nouveau cash du mois" Icon={Banknote} {...sales}>
        <div className="ceo-metric-value">{euro(newSalesCash(sales.data))}</div>
        <div className="ceo-metric-secondary"><span>Mensualités</span><strong>{euro(sales.data?.monthly)}</strong></div>
        <div className="ceo-metric-secondary"><span>Annuités</span><strong>{euro(sales.data?.annual)}</strong></div>
      </Card>
      <Card title="Nouvel ARR du mois" Icon={TrendingUp} {...sales} footer="Mensualités × 12 + contrats annuels signés">
        <div className="ceo-metric-value">{euro(sales.data?.annualized)}<span> / an</span></div>
        <div className="ceo-metric-note">Engagement signé, même avant encaissement</div>
      </Card>
    </div>
  </section>;
}

// ── Chiffres héros animés (section Produit, demande dev 2026-09-24) ──────────
// Le compteur part de zéro quand la carte entre dans le champ et ralentit à
// l'arrivée (easeOutExpo) ; chiffres tabulaires pour que rien ne saute ;
// « réduire les animations » = valeur finale directement.
function useInViewOnce(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen || typeof IntersectionObserver === 'undefined') { if (el && !seen && typeof IntersectionObserver === 'undefined') setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function useCountUp(target, duration, enabled) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) return undefined;
    if (!enabled) { setShown(target); from.current = target; return undefined; }
    const origin = from.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(origin + (target - origin) * eased);
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return shown;
}

function HeroNumber({ value, format = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v), duration = 1400, className = '' }) {
  const ref = useRef(null);
  const seen = useInViewOnce(ref);
  const reduce = useReducedMotion();
  const shown = useCountUp(seen && value != null ? value : null, duration, !reduce);
  const settled = value != null && (reduce || Math.abs(shown - value) < 1e-9);
  return <span ref={ref} className={`ceo-hero-number${className ? ` ${className}` : ''}${settled ? ' is-settled' : ''}`} aria-label={value == null ? undefined : format(value)}>
    {value == null ? '—' : format(reduce || !seen ? (seen ? value : 0) : shown)}
  </span>;
}

// 3 918 987 € se lit « 3,92 M€ » d'un coup d'œil ; le montant exact reste en légende.
const compactEuro = (v) => v == null ? '—' : v >= 1e6 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v / 1e6)} M€`
  : v >= 1e3 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v / 1e3)} k€` : euro(v);

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
  const reduceMotion = useReducedMotion();
  const formatDate = (v) => v ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(new Date(v)) : 'non renseignée';
  const onboardingTotal = (onboarding?.done ?? 0) + (onboarding?.remaining ?? 0);
  const onboardingPct = onboardingTotal ? Math.round((onboarding.done / onboardingTotal) * 100) : null;
  const perDirector = d?.companies && directors?.count ? d.companies / directors.count : null;
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Produit">
    <div className="ceo-metrics-title"><h2>Produit <small>Parc client à date</small></h2></div>
    <div className="ceo-metrics-grid">
      <Card title="Onboarding Owner" Icon={CalendarCheck} loading={!onboarding}>
        <dl className="ceo-onboarding-counts">
          <div className="ceo-onboarding-count ceo-onboarding-count--done">
            <dt>Effectués</dt>
            <dd><HeroNumber value={onboarding?.done} duration={1100} /></dd>
          </div>
          <div className="ceo-onboarding-count ceo-onboarding-count--remaining">
            <dt>À réaliser</dt>
            <dd><HeroNumber value={onboarding?.remaining} duration={1100} /></dd>
          </div>
        </dl>
        {onboardingPct != null && <div className="ceo-progress">
          <div className="ceo-progress-track" role="img" aria-label={`${onboardingPct} % du parc onboardé`}>
            <motion.div className="ceo-progress-fill" initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: onboardingPct / 100 }} viewport={{ once: true, amount: .6 }} transition={{ duration: 1.3, ease: [.16, 1, .3, 1], delay: .25 }} />
          </div>
          <span><strong>{onboardingPct} %</strong> du parc onboardé</span>
        </div>}
      </Card>
      <Card title="Sociétés accompagnées" Icon={Building2} {...product} tone="star">
        <div className="ceo-hero ceo-hero--star">
          <HeroNumber value={d?.companies} duration={1700} className="ceo-hero-value" />
          <div className="ceo-hero-caption">sociétés accompagnées au {formatDate(d?.companies_as_of)}</div>
        </div>
      </Card>
      <Card title="Dirigeants accompagnés" Icon={Users} {...identities} loading={identities.loading || !directors}>
        <div className="ceo-hero">
          <HeroNumber value={directors?.count} duration={1500} className="ceo-hero-value" />
          <div className="ceo-hero-caption">dirigeants dans le parc actif{perDirector ? ` · ${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(perDirector)} sociétés par dirigeant` : ''}</div>
        </div>
      </Card>
      <Card title="Économies réalisées" Icon={Sparkles} {...product} tone="money">
        <div className="ceo-hero ceo-hero--money">
          <HeroNumber value={d?.savings} duration={1900} className="ceo-hero-value" format={compactEuro} />
          <div className="ceo-hero-caption">{d?.savings != null ? `${euro(d.savings)} · ` : ''}arrêté au {formatDate(d?.savings_as_of)}</div>
        </div>
      </Card>
    </div>
    {d?.stale && <p className="ceo-metrics-caption" role="status">
      Actualisation temporairement indisponible · dernières données disponibles
    </p>}
  </section>;
}

// Libellé, puis la cohorte : à quel mois un dossier est rattaché. Le cycle de
// vente se lit sur les SIGNATURES du mois (cohorte « fin ») ; les délais
// opérationnels après signature se lisent sur les signatures du mois (cohorte
// « début »), avec les dossiers encore en attente comptés à part.
const DELAYS = [
  ['ads_contact', 'Arrivée du lead Ads → premier contact', 'Leads Ads reçus dans la période et affectés à un sales · minutes calendaires'],
  ['contact_owner', 'Premier contact → signature Owner', 'Signatures Owner de la période, quel que soit le mois du premier contact'],
  ['owner_optilex', 'Signature Owner → signature Opti’lex', 'Signatures Owner de la période'],
  ['owner_onboarding', 'Signature Owner → onboarding Owner effectué', 'Signatures Owner de la période'],
  ['optilex_onboarding', 'Signature Opti’lex → intégration cabinet effectuée', 'Signatures Opti’lex de la période'],
  ['owner_payment_monthly', 'Signature Owner → premier paiement mensuel', 'Signatures Owner de la période · clients mensuels · reçus réels datés'],
  ['owner_payment_annual', 'Signature Owner → premier paiement annuel', 'Signatures Owner de la période · clients annuels · reçus réels datés'],
];

const DELAY_GROUPS = [
  { title: 'Commercial', Icon: FileCheck2, keys: ['ads_contact', 'contact_owner', 'owner_optilex'] },
  { title: 'Onboarding', Icon: CalendarCheck, keys: ['owner_onboarding', 'optilex_onboarding'] },
  { title: 'Premiers paiements', Icon: Wallet, keys: ['owner_payment_monthly', 'owner_payment_annual'] },
];

const nf = (v, digits = 1) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(v);
const plural = (n, one, many) => (n > 1 ? many : one);
const periodLabel = (period) => period === 'all'
  ? 'Tout l’historique'
  : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));
const unitLabel = (unit) => unit === 'min' ? 'min' : 'j';
// Un délai en minutes se lit aussi en heures ou en jours.
const minutesEquivalent = (min) => min == null ? null : min < 90 ? null : min < 2880 ? `≈ ${nf(min / 60)} h` : `≈ ${nf(min / 1440, 2)} j`;

// Les faits sous chaque moyenne : sur combien de dossiers elle repose, combien
// attendent encore, combien sont hors mesure. Jamais une moyenne nue.
function delayFacts(key, d) {
  if (!d) return null;
  const parts = [];
  if (key === 'ads_contact') {
    if (d.eligible != null) parts.push(`${nf(d.count, 0)} contacté${plural(d.count, '', 's')} sur ${nf(d.eligible, 0)} affecté${plural(d.eligible, '', 's')}`);
    if (d.pending) parts.push(`${nf(d.pending, 0)} ${(d.pending_label || 'en attente').toLowerCase()}`);
    if (d.missing_start) parts.push(`${nf(d.missing_start, 0)} non horodaté${plural(d.missing_start, '', 's')}`);
    if (d.median != null) parts.push(`médiane ${nf(d.median, 0)} min`);
    return parts.join(' · ');
  }
  if (d.count) parts.push(`médiane ${nf(d.median)} j · sur ${nf(d.count, 0)} dossier${plural(d.count, '', 's')}`);
  else if (d.eligible) parts.push(`aucun dossier mesurable sur ${nf(d.eligible, 0)}`);
  if (d.pending) parts.push(`${nf(d.pending, 0)} en attente`);
  if (d.missing_start) parts.push(`${nf(d.missing_start, 0)} sans premier contact connu`);
  return parts.join(' · ');
}

export function CeoDelayMetrics({ darkMode }) {
  const [period, setPeriod] = useState(todayMonth);
  const [detail, setDetail] = useState(null);
  const state = useDashboardData(`/api/v1/ceo-dashboard/delays?period=${period}`);
  const reduceMotion = useReducedMotion();
  return <section className={`ceo-metrics-section${darkMode ? ' is-dark' : ''}`} aria-label="Délais moyens">
    <div className="ceo-metrics-title"><h2>Délais moyens <small>Parcours client</small></h2><PeriodSelect value={period} onChange={setPeriod} all label="Période des délais moyens" /></div>
    {state.error ? <div className="ceo-metric-error">Données indisponibles <button onClick={state.retry}>Réessayer</button></div> : <div className="ceo-delay-groups" aria-busy={state.loading}>
      {DELAY_GROUPS.map(({ title, Icon, keys }) => <motion.article className="ceo-delay-group" key={title} initial={reduceMotion ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .45, ease: [.22, 1, .36, 1] }}>
        <header className="ceo-delay-heading"><span className="ceo-metric-icon"><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></span><h3>{title}</h3></header>
        <ul className="ceo-delay-measures">
          {DELAYS.filter(([key]) => keys.includes(key)).map(([key, label]) => {
            const d = state.data?.metrics?.[key];
            const equivalent = key === 'ads_contact' ? minutesEquivalent(d?.average) : null;
            const facts = delayFacts(key, d);
            return <li className="ceo-delay-measure" key={key}>
              <button type="button" className="ceo-delay-open" onClick={() => setDetail(key)} aria-haspopup="dialog" title="Voir le détail des dossiers" disabled={!d}>
                <span className="ceo-delay-copy">
                  <span className="ceo-delay-label">{label}</span>
                  <span className="ceo-delay-main">
                    <span className="ceo-delay-number">{nf(d?.average)}{d?.average != null && <span className="ceo-delay-unit">{unitLabel(d.unit)}</span>}</span>
                    {equivalent && <span className="ceo-delay-equivalent">{equivalent}</span>}
                  </span>
                  {facts && <span className="ceo-delay-facts">{facts}</span>}
                </span>
                <ChevronRight className="ceo-delay-chevron" size={18} aria-hidden="true" />
              </button>
            </li>;
          })}
        </ul>
      </motion.article>)}
    </div>}
    {!state.loading && !state.error && <details className="ceo-delay-details">
      <summary>Comment ces délais sont calculés <ChevronDown size={16} aria-hidden="true" /></summary>
      <dl>{DELAYS.map(([key, label, cohort]) => {
        const d = state.data?.metrics?.[key];
        return <div key={key}><dt>{label}</dt><dd>{cohort} · {d ? `${nf(d.count, 0)} mesuré${plural(d.count, '', 's')} sur ${nf(d.eligible, 0)}${d.pending ? ` · ${nf(d.pending, 0)} en attente` : ''}` : '—'}</dd></div>;
      })}</dl>
    </details>}
    {detail && <DelayDetailModal metric={detail} period={period} darkMode={darkMode} onClose={() => setDetail(null)} />}
  </section>;
}

const DETAIL_TABS = [
  ['rows', 'Mesurés'],
  ['pending', 'En attente'],
  ['missing', 'Non mesurables'],
];

// Ce qu'il y a derrière une moyenne : chaque dossier, du plus long au plus court.
function DelayDetailModal({ metric, period, darkMode, onClose }) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [tab, setTab] = useState('rows');
  useEffect(() => {
    let stopped = false;
    setState({ data: null, loading: true, error: false });
    setTab('rows');
    apiClient.get(`/api/v1/ceo-dashboard/delays/detail?metric=${encodeURIComponent(metric)}&period=${encodeURIComponent(period)}`)
      .then((data) => { if (!stopped) setState({ data, loading: false, error: false }); })
      .catch(() => { if (!stopped) setState({ data: null, loading: false, error: true }); });
    return () => { stopped = true; };
  }, [metric, period]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  const d = state.data;
  const s = d?.summary;
  const unit = s?.unit || 'j';
  const label = DELAYS.find(([key]) => key === metric)?.[1] || metric;
  const fmtDate = (v) => v ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', ...(unit === 'min' ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(v)) : '—';
  const fmtValue = (v) => `${nf(v, unit === 'min' ? 0 : 1)} ${unitLabel(unit)}`;
  const rows = d?.[tab] || [];
  const totals = { rows: d?.rows_total ?? 0, pending: d?.pending_total ?? 0, missing: d?.missing_total ?? 0 };
  const isLead = metric === 'ads_contact';
  const tabLabel = (key) => (key === 'pending' && d?.definition?.pending_label) || (key === 'missing' && d?.definition?.missing_label) || DETAIL_TABS.find(([k]) => k === key)[1];
  const cohortSentence = s?.cohort === 'end'
    ? 'Toutes les signatures de la période, quel que soit le mois du premier contact.'
    : 'Dossiers commencés dans la période. Ceux en attente ne pèsent pas dans la moyenne.';

  return createPortal(
    <div className={`ceo-delay-modal-backdrop${darkMode ? ' is-dark' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ceo-delay-modal${darkMode ? ' is-dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ceo-delay-modal-title">
        <header className="ceo-delay-modal-head">
          <div>
            <h3 id="ceo-delay-modal-title">{label}</h3>
            <p>{d?.definition?.cohort_label || ''}{d?.definition?.cohort_label ? ' · ' : ''}{periodLabel(period)}</p>
          </div>
          <button type="button" className="ceo-delay-modal-close" onClick={onClose} aria-label="Fermer"><X size={16} aria-hidden="true" /></button>
        </header>
        {state.error ? <div className="ceo-metric-error ceo-delay-modal-pad">Détail indisponible</div>
          : state.loading ? <div className="ceo-delay-modal-pad ceo-delay-modal-loading" aria-busy="true">Chargement…</div>
          : <>
            <dl className="ceo-delay-tiles ceo-delay-modal-pad">
              <div><dt>Moyenne</dt><dd>{fmtValue(s.average)}</dd></div>
              <div><dt>Médiane</dt><dd>{fmtValue(s.median)}</dd></div>
              <div><dt>Mesurés</dt><dd>{nf(s.count, 0)} <small>sur {nf(s.eligible, 0)}</small></dd></div>
              <div><dt>En attente</dt><dd>{nf(s.pending, 0)}{s.pending_average_age != null && <small>depuis {fmtValue(s.pending_average_age)} en moyenne</small>}</dd></div>
            </dl>
            <p className="ceo-delay-modal-pad ceo-delay-cohort">{cohortSentence}</p>
            <div className="ceo-delay-tabs ceo-delay-modal-pad" role="tablist">
              {DETAIL_TABS.map(([key]) => <button type="button" key={key} role="tab" aria-selected={tab === key} className={`ceo-delay-tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>{tabLabel(key)} <span>{nf(totals[key], 0)}</span></button>)}
            </div>
            <div className="ceo-delay-table-wrap">
              {rows.length === 0 ? <p className="ceo-delay-empty">Aucun dossier dans cette liste.</p> : <table className="ceo-delay-table">
                <thead><tr>
                  <th>{isLead ? 'Lead' : 'Client'}</th>
                  {!isLead && <th>Sales</th>}
                  {tab !== 'missing' && <th>{d.definition.start}</th>}
                  {tab === 'rows' && <th>{d.definition.end}</th>}
                  {tab === 'missing' && <th>{d.definition.end}</th>}
                  {tab === 'rows' && (metric === 'contact_owner' || isLead) && <th>Source</th>}
                  {tab === 'rows' && <th className="is-num">Délai</th>}
                  {tab === 'pending' && <th className="is-num">Depuis</th>}
                  {isLead && tab !== 'rows' && <th>Statut</th>}
                </tr></thead>
                <tbody>{rows.map((r) => <tr key={`${tab}-${r.id}`}>
                  <td><span className="ceo-delay-row-label">{r.label || '—'}</span><span className="ceo-delay-row-id">{isLead ? `lead ${r.id}` : r.id}</span></td>
                  {!isLead && <td>{r.sales || '—'}</td>}
                  {tab !== 'missing' && <td>{fmtDate(r.start)}</td>}
                  {tab === 'rows' && <td>{fmtDate(r.end)}</td>}
                  {tab === 'missing' && <td>{fmtDate(r.end)}</td>}
                  {tab === 'rows' && (metric === 'contact_owner' || isLead) && <td className="ceo-delay-source">{r.start_source || r.end_source || '—'}</td>}
                  {tab === 'rows' && <td className="is-num">{fmtValue(r.value)}</td>}
                  {tab === 'pending' && <td className="is-num">{fmtValue(r.age)}</td>}
                  {isLead && tab !== 'rows' && <td>{[r.status, r.assigned_to].filter(Boolean).join(' · ') || '—'}</td>}
                </tr>)}</tbody>
              </table>}
              {rows.length < totals[tab] && <p className="ceo-delay-truncated">Les {nf(rows.length, 0)} premiers sur {nf(totals[tab], 0)}.</p>}
            </div>
          </>}
      </div>
    </div>,
    document.body,
  );
}

export function CeoUpcomingAppointments({ appointments, loading }) {
  return <div className="ceo-appointments" role="group" aria-label="Rendez-vous à venir" aria-busy={loading}>
    {[['onboarding', 'RDV onboarding à venir', 'Owner', CalendarClock], ['integration', 'RDV intégration à venir', 'Cabinet partenaire', Scale]].map(([key, label, entity, Icon]) => {
      const data = appointments[key];
      return <div className="ceo-appointment" key={key}>
        <span className={`ceo-appointment-icon ceo-appointment-icon--${key}`}><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></span>
        <div className="ceo-appointment-copy"><h3>{label}</h3><span>{entity}</span>
          {!loading && data.overdue > 0 && <span className="ceo-appointment-alert">dont {data.overdue} en retard</span>}
        </div>
        <strong className="ceo-appointment-value">{loading ? '—' : new Intl.NumberFormat('fr-FR').format(data.upcoming)}</strong>
      </div>;
    })}
  </div>;
}
