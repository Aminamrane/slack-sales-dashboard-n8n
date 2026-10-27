import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Banknote, RotateCcw, TrendingUp, Wallet } from 'lucide-react';
import { computeKpis } from '../../pages/TrackingSheetFinance/constants.js';
import { recoveryPace, newSalesCash } from '../../utils/dashboardRecovery.js';
import useDashboardData from './useDashboardData.js';
import PeriodSelect, { todayMonth } from './PeriodSelect.jsx';
import { Inscription } from './Ornaments.jsx';
import { euro, intFr, nf, Numeral, PaceGauge, StatusCard } from './Figures.jsx';
import Bubble from './Bubble.jsx';
import PanelIcon from './PanelIcon.jsx';
import factures from '../../assets/ceo-factures.webp';
import { useMotionPrefs } from './motion.js';

const Dash = () => <span className="an-placeholder">—</span>;

function PanelState({ error, retry, children }) {
  if (error) return <div className="an-error">Données indisponibles <button type="button" onClick={retry}>Réessayer</button></div>;
  return children;
}

// Reçu / attendu d'une jambe de la récupération. Le repère calendaire dit où on
// devrait en être à cette date ; la pastille porte l'écart en euros (ce que le
// rythme aurait déjà rapporté, ou l'avance prise).
const dayLabel = (period) => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date());
  if (period > today) return null;
  if (period < today) return 'fin de mois';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }).format(new Date());
};

// Verdict en deux mots sur la carte (le repère « du mois écoulé » est déjà sous la jauge) ; le libellé
// complet de recoveryPace reste dans la bulle et pour les lecteurs d'écran.
const SHORT_LABEL = { 'Au rythme du mois': 'Au rythme', 'Rythme à renforcer': 'À renforcer', 'Sous le rythme du mois': 'Sous le rythme' };

function Recovery({ title, Icon, received, expected, period, caption, loading, dark }) {
  const pace = recoveryPace(received, expected, period);
  const expectedNow = pace.benchmark != null && expected != null ? (Number(expected) * pace.benchmark) / 100 : null;
  const gap = expectedNow != null && received != null ? Number(received) - expectedNow : null;
  const points = pace.percentage != null && pace.benchmark != null ? pace.percentage - pace.benchmark : null;
  const rows = pace.benchmark == null ? [] : [
    { label: 'Mois écoulé', value: `${nf(pace.benchmark, 1)} %` },
    { label: 'Attendu à cette date', value: euro(expectedNow) },
    { label: 'Reçu', value: `${euro(received)} · ${nf(pace.percentage, 1)} %` },
    { label: 'Écart', value: `${points >= 0 ? '+' : '−'}${nf(Math.abs(points), 1)} pts · ${gap >= 0 ? '+' : '−'}${euro(Math.abs(gap))}` },
    { note: 'Vert au rythme ou au-dessus · ambre dès 75 % du rythme · rouge en dessous.' },
  ];
  return (
    <div className="an-figure an-recovery">
      <span className="an-figure-label"><Icon size={13} strokeWidth={2.2} aria-hidden="true" /> {title}</span>
      <div className="an-recovery-head">
        <span className="an-figure-value an-figure-value--md">{loading ? <Dash /> : <Numeral value={received} format={euro} />}</span>
        <span className="an-recovery-pct">{loading || pace.percentage == null ? '' : `${nf(pace.percentage, 1)} %`}</span>
      </div>
      <span className="an-figure-cap">sur <strong>{loading ? '—' : euro(expected)}</strong> attendus</span>
      <div style={{ marginTop: 14 }}>
        <Bubble rows={rows} dark={dark} align="start">
          <PaceGauge
            ratio={pace.percentage}
            benchmark={pace.benchmark}
            tone={pace.tone}
            markLabel={dayLabel(period)}
            leftLabel={pace.percentage == null ? 'Taux non calculable' : `${nf(pace.percentage, 1)} % reçus`}
            rightLabel={pace.benchmark == null ? null : `${nf(pace.benchmark, 0)} % du mois écoulé`}
          />
        </Bubble>
      </div>
      {pace.label && !loading && (
        <StatusCard tone={pace.tone} label={SHORT_LABEL[pace.label] || pace.label} value={gap == null ? null : `${gap >= 0 ? '+' : '−'}${euro(Math.abs(gap))}`} className="an-recovery-status" />
      )}
      <span className="an-figure-cap an-recovery-foot">{caption}</span>
    </div>
  );
}

// Finance : même vision que la page finance par défaut (Globale = Owner + Opti'lex),
// le CEO et l'équipe finance lisent les mêmes totaux (demande dev 2026-09-23).
export default function FinancePanel({ onOpenFinance, dark }) {
  const [period, setPeriod] = useState(todayMonth);
  const finance = useDashboardData(`/api/v1/finance-periods?period=${period}`);
  const sales = useDashboardData(`/api/v1/ceo-dashboard/sales?period=${period}`);
  const k = useMemo(() => (finance.data ? computeKpis(finance.data.periods, 'global') : null), [finance.data]);
  const { reduce, item, list } = useMotionPrefs();
  const s = sales.data;
  const salesRows = s ? [
    { label: 'Ventes comptées', value: intFr(s.count) },
    ...(s.missing_amount_or_plan ? [{ label: 'Sans montant ou formule', value: intFr(s.missing_amount_or_plan) }, { note: 'Sans montant : ventes signées dans le mois que l’API ne peut pas valoriser (contrat signé sans vente déclarée, déclaration sans mode de paiement, ou tarif hors grille). Exclues du cash et de l’ARR.' }] : []),
    { note: 'Nouvel ARR = mensualités × 12 + contrats annuels signés, compté dès la signature, avant encaissement.' },
  ] : [];
  return (
    <section className="an-section" aria-label="Finance">
      <Inscription reduce={reduce} sub="Owner + Opti’lex" right={<PeriodSelect value={period} onChange={setPeriod} label="Mois des indicateurs finance" />}>Finance</Inscription>
      <motion.div className="an-grid an-grid--2" variants={list()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
        <motion.article className="an-panel" variants={item} aria-busy={finance.loading}>
          <div className="an-panel-title"><h3>Récupération<small>reçu / attendu</small></h3><PanelIcon name="wallet" /></div>
          <PanelState error={finance.error} retry={finance.retry}>
            <div className="an-recov">
              <Recovery title="Du mois" Icon={Wallet} received={k?.receivedTotal} expected={k?.expectedGlobal} period={period} loading={finance.loading} dark={dark} caption="Reçu affecté au mois / attendu du mois" />
              <Recovery title="Des antérieurs" Icon={RotateCcw} received={k?.recoveredPrior} expected={k?.openingDebt} period={period} loading={finance.loading} dark={dark} caption="Recouvré / créances dues au début du mois" />
            </div>
          </PanelState>
          <div className="an-panel-foot">
            <span>Même vision que la page Finance</span>
            <button type="button" className="an-link" onClick={() => onOpenFinance(period)}>Voir dans Finance <ArrowUpRight size={15} aria-hidden="true" /></button>
          </div>
        </motion.article>

        <motion.article className="an-panel an-panel--object" variants={item} aria-busy={sales.loading}>
          {/* Pile de factures (rendu 3D généré pour cette carte), en bas à droite, coupée par le bord. */}
          <img className="an-panel-object" src={factures} alt="" loading="lazy" decoding="async" aria-hidden="true" />
          <div className="an-panel-title"><h3>Nouveau du mois<small>ventes signées</small></h3><PanelIcon name="notes" /></div>
          <PanelState error={sales.error} retry={sales.retry}>
            <div className="an-new">
              <div className="an-figure">
                <span className="an-figure-label"><Banknote size={13} strokeWidth={2.2} aria-hidden="true" /> Nouveau cash</span>
                <span className="an-figure-value an-figure-value--md">{sales.loading ? <Dash /> : euro(newSalesCash(s))}</span>
                <span className="an-figure-cap">encaissable sur les ventes du mois</span>
                <div className="an-kv"><span>Mensualités</span><strong>{sales.loading ? '—' : euro(s?.monthly)}</strong></div>
                <div className="an-kv"><span>Annuités</span><strong>{sales.loading ? '—' : euro(s?.annual)}</strong></div>
              </div>
              <Bubble rows={salesRows} dark={dark} align="start">
                <div className="an-figure">
                  <span className="an-figure-label"><TrendingUp size={13} strokeWidth={2.2} aria-hidden="true" /> Nouvel ARR</span>
                  <span className="an-figure-value an-figure-value--md an-money">{sales.loading ? <Dash /> : <>{euro(s?.annualized)}<span className="an-unit">/ an</span></>}</span>
                  <span className="an-figure-cap">Engagement signé, même avant encaissement</span>
                  {s && <div className="an-kv"><span>Ventes comptées</span><strong>{intFr(s.count)}{s.missing_amount_or_plan ? ` · ${intFr(s.missing_amount_or_plan)} sans montant` : ''}</strong></div>}
                </div>
              </Bubble>
            </div>
          </PanelState>
        </motion.article>
      </motion.div>
    </section>
  );
}
