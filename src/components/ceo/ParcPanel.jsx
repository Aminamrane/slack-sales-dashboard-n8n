import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, CalendarDays, CircleCheck, Clock, UserRoundX, RotateCcw, Users, TrendingUp, Cloud, BadgeEuro, Hourglass } from 'lucide-react';
import { METEO_BANDS, meteoBandOf } from '../../utils/meteoBands.js';
import { monthsAndDays, periodLabelOf } from '../../utils/ceoDashboardStats.js';
import { Chip, euro, intFr, Numeral, ReadingSwap, Spark } from './Figures.jsx';
import { Orbits, CornerTicks } from './Ornaments.jsx';
import { MeteoShowcase } from './Meteo.jsx';
import Bubble from './Bubble.jsx';
import PeriodSelect from './PeriodSelect.jsx';
import { useMotionPrefs } from './motion.js';

// Bleu clair Owner : courbes et météo sur le panneau lapis.
const LAPIS_ACCENT = '#dbe3f1';

// Formulation de la moyenne météo. On n'affirme ("Clients satisfaits") que loin
// des frontières de bande ; près d'une frontière on nuance ("Plutôt satisfaits").
const meteoWording = (avg) => {
  if (avg >= 4.3) return 'Clients satisfaits';
  if (avg >= 3.6) return 'Plutôt satisfaits';
  if (avg >= 2.6) return 'Clients mécontents';
  if (avg >= 2.0) return 'Plutôt critiques';
  return 'Situation critique';
};

const Dash = () => <span className="an-placeholder">—</span>;
// Taux de résiliation au centième, comme la feuille de la Finance (6,91 %).
const pctFr = (rate) => (rate == null ? '—' : `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate * 100)}\u00a0%`);
const durationFr = (days) => { const d = monthsAndDays(days); return d ? `${d.months} mois ${d.days} j` : '—'; };

// Une colonne de sorties : les actées (cumul ↔ mois en cours), leur trajectoire sur
// 12 mois, la part Owner HT perdue sur les MÊMES dossiers, et ce qui est en cours.
function ExitColumn({ Icon, name, count, thisMonth, series, arr, arrFailed, pending, pendingLabel, nounPlural, stats, hovered }) {
  const loading = !stats;
  const p = stats?.periodLabel;
  const readings = !p && stats ? [
    { value: intFr(count), sub: `${nounPlural} actées`, icon: CircleCheck },
    { value: intFr(thisMonth), sub: `En ${stats.currentMonthLabel}`, icon: CalendarDays },
  ] : [{ value: loading ? null : intFr(count), sub: p ? `Actées en ${p}` : `${nounPlural} actées`, icon: CircleCheck }];
  const missing = (n) => (n > 0 ? ` · ${n} sans montant` : '');
  const arrReadings = arr ? (!p ? [
    { value: euro(arr.total), sub: `Part Owner HT${missing(arr.missing)}` },
    { value: euro(arr.thisMonth.total), sub: `En ${stats.currentMonthLabel}${missing(arr.thisMonth.missing)}` },
  ] : [{ value: euro(arr.total), sub: `Part Owner HT, ${p}${missing(arr.missing)}` }]) : null;
  const arrRows = arr ? [
    { label: `${nounPlural} chiffrées`, value: `${arr.known} sur ${arr.known + arr.missing}` },
    ...(arr.missing > 0 ? [{ label: 'Sans montant Owner', value: String(arr.missing) }] : []),
    { note: 'Base : attendu Owner HT annualisé, montants de la Finance.' },
  ] : [];
  return (
    <div className="an-exit">
      <div className="an-figure">
        <span className="an-figure-label"><Icon size={13} strokeWidth={2.2} aria-hidden="true" /> {name}</span>
        <ReadingSwap
          readings={readings}
          paused={hovered}
          height={82}
          render={(r) => (
            <>
              <span className="an-figure-value an-figure-value--lg">{r?.value == null ? <Dash /> : r.value}</span>
              <div style={{ marginTop: 6 }}><Chip tone="onlapis" icon={r?.icon}>{r?.sub}</Chip></div>
            </>
          )}
        />
      </div>
      {stats && <Spark values={series} color={LAPIS_ACCENT} height={46} />}
      <div className="an-exit-arr">
        <span className="an-figure-label"><BadgeEuro size={13} strokeWidth={2.2} aria-hidden="true" /> ARR perdu</span>
        {arrFailed ? (
          <span className="an-figure-cap">Montants de la Finance indisponibles</span>
        ) : (
          <Bubble rows={arrRows} dark>
            <ReadingSwap
              readings={arrReadings || [{ value: null, sub: '' }]}
              paused={hovered}
              height={62}
              render={(r) => (
                <>
                  <span className="an-figure-value an-figure-value--md">{r?.value == null ? <Dash /> : r.value}</span>
                  <span className="an-figure-cap">{r?.sub}</span>
                </>
              )}
            />
          </Bubble>
        )}
      </div>
      <div className="an-exit-pending">
        <span>{pendingLabel}</span>
        <strong>{loading ? <Dash /> : <Numeral value={pending} />}</strong>
      </div>
    </div>
  );
}

// Le parc clients : stock (actifs, total), sorties (résiliés, rétractés, ARR perdu,
// en cours), santé (météo, rendez-vous à venir). Tout vient du board Owner/Opti'Lex.
export default function ParcPanel({ stats, period, setPeriod, periodOptions, ownerArrFailed }) {
  const { reduce, item } = useMotionPrefs();
  const [hovered, setHovered] = useState(false);
  const p = stats?.periodLabel;
  const loading = !stats;
  const meteoRounded = stats?.meteoAvg != null ? Math.round(stats.meteoAvg) : null;
  const band = meteoRounded != null ? meteoBandOf(meteoRounded) : null;
  const bands = stats?.meteoBands;
  const actifsRows = stats ? [
    { label: p ? `Signés au plus tard fin ${p}` : 'Clients établis', value: intFr(stats.total) },
    { label: p ? `Encore actifs fin ${p}` : 'Onglet Signé du board', value: intFr(stats.actifs) },
    { label: 'En cours de sortie (comptés actifs)', value: intFr(stats.pendingResiliation + stats.pendingRetraction) },
  ] : [];
  // Rétention : durée de vie moyenne (LTV) et taux de résiliation, définitions de la Finance.
  const life = stats?.lifetime;
  const lifeParts = life ? monthsAndDays(life.averageDays) : null;
  const lifeRows = life ? [
    { label: 'Médiane', value: durationFr(life.medianDays) },
    { label: 'Clients mesurés', value: intFr(life.measured) },
    { label: 'Encore clients', value: intFr(life.open) },
    { label: 'Partis', value: intFr(life.closed) },
    ...(life.unmeasured ? [{ label: 'Sans date, hors calcul', value: intFr(life.unmeasured) }] : []),
    ...(life.incoherent ? [{ label: 'Dates incohérentes, hors calcul', value: intFr(life.incoherent) }] : []),
    { note: 'De la signature Owner à la sortie, ou à aujourd’hui pour un client encore là. Rétractés exclus.' },
  ] : [];
  const month = stats?.resiliationMonth;
  const previous = stats?.resiliationPreviousMonth;
  const monthLabel = month ? periodLabelOf(month.key) : null;
  const monthRows = month ? [
    { label: `Résiliations en ${monthLabel}`, value: intFr(month.count) },
    { label: `En cours au 1er ${monthLabel}`, value: intFr(month.base) },
    { label: `${periodLabelOf(previous.key)}`, value: `${pctFr(previous.rate)} (${intFr(previous.count)} sur ${intFr(previous.base)})` },
    { note: 'Self-résiliations comprises, comme la Finance.' },
  ] : [];
  const global = stats?.resiliationGlobal;
  const globalRows = global ? [
    { label: 'Résiliations depuis le début', value: intFr(global.count) },
    { label: 'Clients en cours', value: intFr(global.base) },
    ...(global.undated ? [{ label: 'Résiliations sans date, hors calcul', value: intFr(global.undated) }] : []),
    { note: 'Résiliations, self-résiliations comprises, rapportées aux clients en cours, comme la Finance.' },
  ] : [];
  return (
    <motion.section
      className="an-panel an-panel--lapis"
      variants={item}
      aria-label="Le parc clients"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Orbits reduce={reduce} />
      <CornerTicks />
      <div className="an-parc-head">
        <h3>
          Le parc clients
          {p && <small>Fin {p} · onboarding et météo restent à date</small>}
        </h3>
        <PeriodSelect value={period} onChange={setPeriod} options={periodOptions} label="Période des états clients" />
      </div>

      <div className="an-parc">
        {/* ── Stock ── */}
        <div className="an-stock">
          <p className="an-parc-zone-title">Stock</p>
          <Bubble rows={actifsRows} dark align="start">
            <div className="an-figure">
              <span className="an-figure-label"><TrendingUp size={13} strokeWidth={2.2} aria-hidden="true" /> Clients actifs</span>
              <span className="an-figure-value an-figure-value--xl">{loading ? <Dash /> : <Numeral value={stats.actifs} />}</span>
              <span className="an-figure-cap">{p ? `Encore actifs fin ${p}` : 'Onglet Signé du board'}</span>
            </div>
          </Bubble>
          <div className="an-stock-sub">
            <div className="an-figure">
              <span className="an-figure-label"><Users size={13} strokeWidth={2.2} aria-hidden="true" /> Total clients</span>
              <span className="an-figure-value an-figure-value--md">{loading ? <Dash /> : <Numeral value={stats.total} delay={0.07} />}</span>
              <span className="an-figure-cap">{p ? `Signés au plus tard en ${p}` : 'Clients établis du board'}</span>
            </div>
            <div className="an-figure">
              <span className="an-figure-label">Part active</span>
              <span className="an-figure-value an-figure-value--md">{loading || !stats.total ? <Dash /> : <Numeral value={Math.round((stats.actifs / stats.total) * 100)} format={(v) => `${intFr(v)} %`} delay={0.14} />}</span>
              <span className="an-figure-cap">des clients signés</span>
            </div>
          </div>
          <Bubble rows={lifeRows} dark align="start">
            <div className="an-figure an-lifetime">
              <span className="an-figure-label"><Hourglass size={13} strokeWidth={2.2} aria-hidden="true" /> Durée de vie moyenne</span>
              <span className="an-figure-value an-figure-value--md">
                {loading || !lifeParts ? <Dash /> : <><Numeral value={lifeParts.months} unit="mois" delay={0.21} /><Numeral value={lifeParts.days} unit="j" delay={0.28} /></>}
              </span>
              <span className="an-figure-cap">LTV par client{p ? `, fin ${p}` : ''}</span>
            </div>
          </Bubble>
        </div>

        {/* ── Sorties ── */}
        <div>
          <p className="an-parc-zone-title">Sorties</p>
          <div className="an-exits">
            <ExitColumn Icon={UserRoundX} name="Résiliés" nounPlural="Résiliations" stats={stats} hovered={hovered}
              count={stats?.resilies} thisMonth={stats?.resiliesThisMonth} series={stats?.resiliesSeries}
              arr={stats?.arrResilies} arrFailed={ownerArrFailed}
              pending={stats?.pendingResiliation} pendingLabel="En cours de résiliation" />
            <ExitColumn Icon={RotateCcw} name="Rétractés" nounPlural="Rétractations" stats={stats} hovered={hovered}
              count={stats?.retractes} thisMonth={stats?.retractesThisMonth} series={stats?.retractesSeries}
              arr={stats?.arrRetractes} arrFailed={ownerArrFailed}
              pending={stats?.pendingRetraction} pendingLabel="En cours de rétractation" />
          </div>
        </div>

        {/* ── Santé ── */}
        <div className="an-health">
          <p className="an-parc-zone-title">Santé</p>
          <Bubble dark rows={bands ? [
            { label: 'Satisfaits (4-5)', value: intFr(bands.vert) },
            { label: 'Mécontents (3)', value: intFr(bands.orange) },
            { label: 'Critiques (1-2)', value: intFr(bands.rouge) },
            { label: 'Notés', value: `${intFr(stats.meteoRated)} sur ${intFr(stats.meteoSigned)} signés` },
          ] : []}>
            <div className="an-meteo">
              <MeteoShowcase realScore={meteoRounded} hovered={hovered} size={56} color={LAPIS_ACCENT} />
              <div className="an-figure">
                <span className="an-figure-label"><Cloud size={13} strokeWidth={2.2} aria-hidden="true" /> Météo client</span>
                <span className="an-figure-value an-figure-value--md">
                  {loading ? <Dash /> : stats.meteoAvg != null ? <>{stats.meteoAvg.toFixed(1).replace('.', ',')}<span className="an-unit">/5</span></> : '—'}
                </span>
                <span className="an-figure-cap">{band ? meteoWording(stats.meteoAvg) : 'Aucune note posée'}</span>
                {bands && (
                  <div className="an-meteo-bands">
                    {['vert', 'orange', 'rouge'].map((k) => (
                      <span key={k} className="an-meteo-band"><i style={{ background: METEO_BANDS[k].color }} />{intFr(bands[k])}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Bubble>
          <div className="an-rdv">
            {/* Un seul rendez-vous suivi : l'onboarding Owner. Les « RDV intégration » (rdv_lancement,
                ancien parcours) n'existent plus ; leur compteur n'était qu'une accumulation jamais clôturée. */}
            {[
              ['onboarding', 'RDV onboarding à venir', 'Owner', CalendarClock, stats?.onboarding, stats?.onboardingOverdue],
            ].map(([key, label, entity, Icon, upcoming, overdue]) => (
              <div className="an-rdv-row" key={key}>
                <span className="an-rdv-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
                <div className="an-rdv-copy">
                  {label}
                  <small>
                    {entity}
                    {!loading && overdue > 0 && <> · <span className="an-rdv-late"><Clock size={11} strokeWidth={2.4} aria-hidden="true" />{intFr(overdue)} en retard</span></>}
                  </small>
                </div>
                <span className="an-rdv-value">{loading ? <Dash /> : <Numeral value={upcoming} />}</span>
              </div>
            ))}
          </div>
          <div className="an-rdv">
            {[
              ['month', 'Résiliation du mois', month && `${periodLabelOf(previous.key).split(' ')[0]} : ${pctFr(previous.rate)}`, month?.rate, monthRows],
              ['global', 'Résiliation globale', 'Depuis le début', global?.rate, globalRows],
            ].map(([key, label, sub, rate, rows]) => (
              <Bubble key={key} rows={rows} dark>
                <div className="an-rdv-row">
                  <span className="an-rdv-icon" aria-hidden="true"><UserRoundX size={17} strokeWidth={1.9} /></span>
                  <div className="an-rdv-copy">
                    {label}
                    <small>{loading ? '' : sub}</small>
                  </div>
                  <span className="an-rdv-value an-rdv-value--rate">{loading || rate == null ? <Dash /> : <Numeral value={rate} format={pctFr} />}</span>
                </div>
              </Bubble>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
