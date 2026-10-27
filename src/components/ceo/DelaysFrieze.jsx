import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, ChevronDown, Coins, Megaphone, PenLine, PhoneCall, Scale, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import useDashboardData from './useDashboardData.js';
import PeriodSelect, { todayMonth } from './PeriodSelect.jsx';
import { Inscription } from './Ornaments.jsx';
import PanelIcon from './PanelIcon.jsx';
import { intFr, nf, Numeral, plural } from './Figures.jsx';
import { DRY_EXIT, EASE_OUT, FOLLOW_DELAY, SPRING, SPRING_POP, useMotionPrefs } from './motion.js';

// Libellé, puis la cohorte : à quel mois un dossier est rattaché. Le cycle de
// vente se lit sur les SIGNATURES du mois (cohorte « fin ») ; les délais
// opérationnels après signature se lisent sur les signatures du mois (cohorte
// « début »), avec les dossiers encore en attente comptés à part.
export const DELAYS = [
  ['ads_contact', 'Arrivée du lead Ads → premier contact', 'Leads Ads reçus dans la période et affectés à un sales · minutes calendaires'],
  ['contact_owner', 'Premier contact → signature Owner', 'Signatures Owner de la période, quel que soit le mois du premier contact'],
  ['owner_optilex', 'Signature Owner → signature Opti’lex', 'Signatures Owner de la période'],
  ['owner_onboarding', 'Signature Owner → onboarding Owner effectué', 'Signatures Owner de la période'],
  ['owner_payment_monthly', 'Signature Owner → premier paiement mensuel', 'Signatures Owner de la période · clients mensuels · reçus réels datés'],
  ['owner_payment_annual', 'Signature Owner → premier paiement annuel', 'Signatures Owner de la période · clients annuels · reçus réels datés'],
];
const LABEL = Object.fromEntries(DELAYS.map(([k, l]) => [k, l]));

// La route : le parcours d'un client, de gauche à droite. Ligne principale du lead
// à l'intégration ; en dessous, ce qui part de la signature Owner (trois délais qui
// partent tous de la même station : chaque station marque la fin de son segment).
// Le délai « Signature Opti'lex → intégration cabinet » n'est plus affiché : les RDV
// d'intégration (rdv_lancement) n'existent plus, la mesure du back ne reçoit plus rien.
const MAIN_LINE = {
  stations: ['Lead Ads', 'Premier contact', 'Signature Owner', 'Signature Opti’lex'],
  segments: ['ads_contact', 'contact_owner', 'owner_optilex'],
};
const BRANCH_LINE = {
  stations: ['Signature Owner', 'Onboarding Owner', 'Premier paiement mensuel', 'Premier paiement annuel'],
  segments: ['owner_onboarding', 'owner_payment_monthly', 'owner_payment_annual'],
};
// Chaque station porte le pictogramme de son événement.
const STATION_ICONS = {
  'Lead Ads': Megaphone, 'Premier contact': PhoneCall, 'Signature Owner': PenLine, 'Signature Opti’lex': Scale,
  'Onboarding Owner': CalendarCheck, 'Premier paiement mensuel': Coins, 'Premier paiement annuel': Coins,
};

const periodLabel = (period) => (period === 'all'
  ? 'Tout l’historique'
  : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`)));
const unitLabel = (unit) => (unit === 'min' ? 'min' : 'j');
// Un délai en minutes se LIT en heures (ou en jours) : c'est l'heure qui est
// affichée en grand, la minute reste en légende.
const readable = (d) => {
  if (d?.average == null) return null;
  if (d.unit !== 'min') return { value: d.average, unit: 'j', digits: 1, legend: null };
  const min = d.average;
  if (min < 90) return { value: min, unit: 'min', digits: 0, legend: null };
  if (min < 2880) return { value: min / 60, unit: 'h', digits: 1, legend: `${nf(min, 0)} min` };
  return { value: min / 1440, unit: 'j', digits: 1, legend: `${nf(min, 0)} min` };
};
// Une durée en jours, quelle que soit son unité : le remplissage du rail compare
// les étapes d'une même ligne entre elles.
const inDays = (d) => (d?.average == null ? null : d.unit === 'min' ? d.average / 1440 : d.average);
const medianInDays = (d) => (d?.median == null ? null : d.unit === 'min' ? d.median / 1440 : d.median);

// Sous chaque moyenne, une ligne de faits, courte : la médiane et sur combien de
// dossiers elle repose. Jamais une moyenne nue ; le reste (jamais contactés, non
// horodatés) est dans la modale du détail, un clic plus loin.
function delayFacts(key, d) {
  if (!d) return null;
  const parts = [];
  if (key === 'ads_contact') {
    if (d.median != null) parts.push(`médiane ${nf(d.median, 0)} min`);
    if (d.eligible != null) parts.push(`${nf(d.count, 0)} contacté${plural(d.count, '', 's')} sur ${nf(d.eligible, 0)}`);
    return parts.join(' · ');
  }
  if (d.count) parts.push(`médiane ${nf(d.median)} j · ${nf(d.count, 0)} dossier${plural(d.count, '', 's')}`);
  else if (d.eligible) parts.push(`aucun dossier mesurable sur ${nf(d.eligible, 0)}`);
  if (d.pending) parts.push(`${nf(d.pending, 0)} en attente`);
  return parts.join(' · ');
}

// Tempo de la ligne : chaque segment se révèle 160 ms après le précédent ; un
// reflet glisse ensuite sur le rail, segment après segment, puis se repose
// (boucle sans couture, voir .an-rail-fill::after).
const STEP = 0.16;

function Station({ label, index, hollow, lit, reduce }) {
  const Icon = STATION_ICONS[label];
  return (
    <div className={`an-station${lit ? ' is-lit' : ''}`}>
      <motion.span
        className={`an-medal${hollow ? ' an-medal--hollow' : ''}`}
        initial={reduce ? false : { scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduce ? { duration: 0 } : { ...SPRING_POP, delay: index * STEP }}
        aria-hidden="true"
      >
        {Icon && <Icon size={17} strokeWidth={2} />}
      </motion.span>
      <span className="an-station-label">{label}</span>
    </div>
  );
}

function Segment({ k, d, index, count, onOpen, onHover, reduce, maxDays }) {
  const r = readable(d);
  const facts = delayFacts(k, d);
  const days = inDays(d);
  const median = medianInDays(d);
  const share = days != null && maxDays ? Math.max(0.04, Math.min(1, days / maxDays)) : 0;
  const medianShare = median != null && maxDays ? Math.max(0, Math.min(1, median / maxDays)) : null;
  const delay = index * STEP;
  return (
    <div className="an-segment" onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      <motion.button
        type="button"
        className="an-segment-btn"
        onClick={() => onOpen(k)}
        disabled={!d}
        aria-haspopup="dialog"
        aria-label={`${LABEL[k]} : voir le détail des dossiers`}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduce ? { duration: 0 } : { ...SPRING, delay: delay + 0.2, opacity: { duration: 0.12, delay: delay + 0.2 } }}
      >
        <span className="an-segment-value">
          {r ? <Numeral value={r.value} format={(v) => nf(v, r.digits)} /> : '—'}
          {r && <span className="an-unit">{r.unit}</span>}
        </span>
        {r?.legend && <span className="an-segment-eq">{r.legend}</span>}
      </motion.button>
      <div className="an-rail" aria-hidden="true" style={{ '--sheen-delay': `${count * STEP + 1.2 + index * 0.35}s` }}>
        <motion.div className="an-rail-track" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.5 }} transition={reduce ? { duration: 0 } : { duration: 0.55, ease: EASE_OUT, delay }} />
        <motion.div className="an-rail-fill" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: share }} viewport={{ once: true, amount: 0.5 }} transition={reduce ? { duration: 0 } : { ...SPRING, delay: delay + 0.45 }} />
        {medianShare != null && <motion.b className="an-rail-median" style={{ left: `${medianShare * 100}%` }} initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.5 }} transition={reduce ? { duration: 0 } : { ...SPRING_POP, delay: delay + 0.45 + FOLLOW_DELAY }} />}
      </div>
      {facts && <span className="an-segment-facts">{facts}</span>}
    </div>
  );
}

function Line({ stations, segments, metrics, onOpen, reduce, hollowFirst }) {
  const [hover, setHover] = useState(null);
  const maxDays = Math.max(0, ...segments.map((k) => inDays(metrics?.[k]) ?? 0));
  return (
    <div className="an-frieze-line">
      {stations.map((label, i) => (
        <span key={label} style={{ display: 'contents' }}>
          <Station label={label} index={i} hollow={hollowFirst && i === 0} lit={hover != null && (i === hover || i === hover + 1)} reduce={reduce} />
          {i < segments.length && (
            <Segment k={segments[i]} d={metrics?.[segments[i]]} index={i} count={segments.length} onOpen={onOpen} onHover={setHover} reduce={reduce} maxDays={maxDays} />
          )}
        </span>
      ))}
    </div>
  );
}

export default function DelaysFrieze({ dark }) {
  const [period, setPeriod] = useState(todayMonth);
  // ?delay=<mesure> ouvre directement le détail (lien profond, harnais de capture).
  const [detail, setDetail] = useState(() => { const k = new URLSearchParams(window.location.search).get('delay'); return k && LABEL[k] ? k : null; });
  const state = useDashboardData(`/api/v1/ceo-dashboard/delays?period=${period}`, 5 * 60 * 1000);
  const { reduce, item } = useMotionPrefs();
  const metrics = state.data?.metrics;
  return (
    <section className="an-section" aria-label="Délais moyens">
      <Inscription reduce={reduce} sub="Parcours client, délais moyens" right={<PeriodSelect value={period} onChange={setPeriod} all label="Période des délais moyens" />}>Délais</Inscription>
      <motion.article className="an-panel an-panel--frieze" variants={item} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} aria-busy={state.loading}>
        <PanelIcon name="stopwatch" className="an-panel-icon--corner" />
        {state.error ? (
          <div className="an-error">Données indisponibles <button type="button" onClick={state.retry}>Réessayer</button></div>
        ) : (
          <div className="an-frieze">
            <Line {...MAIN_LINE} metrics={metrics} onOpen={setDetail} reduce={reduce} />
            <p className="an-branch-title">Après la signature Owner</p>
            <Line {...BRANCH_LINE} metrics={metrics} onOpen={setDetail} reduce={reduce} hollowFirst />
          </div>
        )}
        {!state.loading && !state.error && (
          <details className="an-details">
            <summary>Comment ces délais sont calculés <ChevronDown size={15} aria-hidden="true" /></summary>
            <dl>{DELAYS.map(([key, label, cohort]) => {
              const d = metrics?.[key];
              return <div key={key}><dt>{label}</dt><dd>{cohort} · {d ? `${nf(d.count, 0)} mesuré${plural(d.count, '', 's')} sur ${nf(d.eligible, 0)}${d.pending ? ` · ${nf(d.pending, 0)} en attente` : ''}` : '—'}</dd></div>;
            })}</dl>
          </details>
        )}
      </motion.article>
      <AnimatePresence>{detail && <DelayDetailModal key={detail} metric={detail} period={period} dark={dark} onClose={() => setDetail(null)} />}</AnimatePresence>
    </section>
  );
}

const DETAIL_TABS = [['rows', 'Mesurés'], ['pending', 'En attente'], ['missing', 'Non mesurables']];
const ROWS_ANIMATED = 24;   // au-delà, les lignes arrivent sans décalage : on ne fait pas attendre une liste

// Ce qu'il y a derrière une moyenne : chaque dossier, du plus long au plus court.
// Entrée en ressort, tuiles en cascade avec leurs chiffres comptés, soulignement
// d'onglet qui glisse, lignes qui arrivent une à une avec une barre à l'échelle du
// plus long délai ; sortie sèche.
export function DelayDetailModal({ metric, period, dark, onClose }) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [tab, setTab] = useState('rows');
  const { reduce, item, list } = useMotionPrefs();
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
  const digits = unit === 'min' ? 0 : 1;
  const label = LABEL[metric] || metric;
  const fmtDate = (v) => (v ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', ...(unit === 'min' ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(v)) : '—');
  const fmtValue = (v) => `${nf(v, digits)} ${unitLabel(unit)}`;
  const rows = d?.[tab] || [];
  const totals = { rows: d?.rows_total ?? 0, pending: d?.pending_total ?? 0, missing: d?.missing_total ?? 0 };
  const isLead = metric === 'ads_contact';
  const tabLabel = (key) => (key === 'pending' && d?.definition?.pending_label) || (key === 'missing' && d?.definition?.missing_label) || DETAIL_TABS.find(([k]) => k === key)[1];
  const cohortSentence = s?.cohort === 'end'
    ? 'Toutes les signatures de la période, quel que soit le mois du premier contact.'
    : 'Dossiers commencés dans la période. Ceux en attente ne pèsent pas dans la moyenne.';
  // Barre de chaque ligne : à l'échelle du plus long délai (ou de la plus longue attente) de l'onglet.
  const scaleKey = tab === 'pending' ? 'age' : 'value';
  const longest = Math.max(0, ...rows.map((r) => Number(r[scaleKey]) || 0));
  const bar = (v) => (longest > 0 && v != null ? Math.max(0.02, Math.min(1, v / longest)) : 0);

  const backdrop = reduce
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: DRY_EXIT } };
  const dialog = reduce
    ? {}
    : { initial: { opacity: 0, y: 16, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1, transition: { ...SPRING, opacity: { duration: 0.14 } } }, exit: { opacity: 0, y: 8, scale: 0.985, transition: DRY_EXIT } };

  return createPortal(
    <motion.div className="an-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} {...backdrop}>
      <motion.div className={`an-modal${dark ? ' is-dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="an-delay-modal-title" {...dialog}>
        <header className="an-modal-head">
          <div>
            <h3 id="an-delay-modal-title">{label}</h3>
            <p>{d?.definition?.cohort_label || ''}{d?.definition?.cohort_label ? ' · ' : ''}{periodLabel(period)}</p>
            <motion.span className="an-hairline" aria-hidden="true" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }} />
          </div>
          <button type="button" className="an-modal-close" onClick={onClose} aria-label="Fermer"><X size={16} aria-hidden="true" /></button>
        </header>
        {state.error ? <div className="an-error an-modal-pad">Détail indisponible</div>
          : state.loading ? <div className="an-modal-pad an-modal-loading" aria-busy="true">Chargement…</div>
          : <>
            <motion.dl className="an-tiles an-modal-pad" variants={list(0.06, 0.05)} initial="hidden" animate="show">
              <motion.div variants={item} className="is-hero"><dt>Moyenne</dt><dd><Numeral value={s.average} format={(v) => nf(v, digits)} unit={unitLabel(unit)} /></dd></motion.div>
              <motion.div variants={item}><dt>Médiane</dt><dd><Numeral value={s.median} format={(v) => nf(v, digits)} unit={unitLabel(unit)} /></dd></motion.div>
              <motion.div variants={item}><dt>Mesurés</dt><dd><Numeral value={s.count} /> <small>sur {intFr(s.eligible)}</small></dd></motion.div>
              <motion.div variants={item}><dt>En attente</dt><dd><Numeral value={s.pending} />{s.pending_average_age != null && <small>depuis {fmtValue(s.pending_average_age)} en moyenne</small>}</dd></motion.div>
            </motion.dl>
            <p className="an-modal-pad an-modal-cohort">{cohortSentence}</p>
            <div className="an-tabs an-modal-pad" role="tablist">
              {DETAIL_TABS.map(([key]) => (
                <button type="button" key={key} role="tab" aria-selected={tab === key} className={`an-tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
                  {tabLabel(key)} <span>{nf(totals[key], 0)}</span>
                  {tab === key && <motion.i className="an-tab-ink" layoutId="an-tab-ink" transition={reduce ? { duration: 0 } : SPRING} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="an-table-wrap">
              {rows.length === 0 ? <p className="an-empty">Aucun dossier dans cette liste.</p> : <table className="an-table">
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
                <tbody>{rows.map((r, i) => (
                  <motion.tr
                    key={`${tab}-${r.id}`}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT, delay: Math.min(i, ROWS_ANIMATED) * 0.03 }}
                  >
                    <td><span className="an-row-label">{r.label || '—'}</span><span className="an-row-id">{isLead ? `lead ${r.id}` : r.id}</span></td>
                    {!isLead && <td>{r.sales || '—'}</td>}
                    {tab !== 'missing' && <td>{fmtDate(r.start)}</td>}
                    {tab === 'rows' && <td>{fmtDate(r.end)}</td>}
                    {tab === 'missing' && <td>{fmtDate(r.end)}</td>}
                    {tab === 'rows' && (metric === 'contact_owner' || isLead) && <td className="an-source">{r.start_source || r.end_source || '—'}</td>}
                    {(tab === 'rows' || tab === 'pending') && (
                      <td className="is-num">
                        {fmtValue(tab === 'rows' ? r.value : r.age)}
                        <span className="an-row-bar" aria-hidden="true">
                          <motion.i initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: bar(tab === 'rows' ? r.value : r.age) }} transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT, delay: 0.12 + Math.min(i, ROWS_ANIMATED) * 0.03 }} />
                        </span>
                      </td>
                    )}
                    {isLead && tab !== 'rows' && <td>{[r.status, r.assigned_to].filter(Boolean).join(' · ') || '—'}</td>}
                  </motion.tr>
                ))}</tbody>
              </table>}
              {rows.length < totals[tab] && <p className="an-truncated">Les {nf(rows.length, 0)} premiers sur {nf(totals[tab], 0)}.</p>}
            </div>
          </>}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
