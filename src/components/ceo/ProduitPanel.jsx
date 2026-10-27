import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, CalendarCheck, CalendarClock, FileUp, Hourglass, Sparkles, UserRoundCheck, Users } from 'lucide-react';
import { computeDirectors, computeOnboarding } from '../../utils/ceoDashboardStats.js';
import useDashboardData from './useDashboardData.js';
import { Inscription } from './Ornaments.jsx';
import { Chip, compactEuro, euro, intFr, nf, Numeral, Share } from './Figures.jsx';
import Bubble from './Bubble.jsx';
import PanelIcon from './PanelIcon.jsx';
import { useMotionPrefs } from './motion.js';

const NIGHTLY = 15 * 60 * 1000;
const Dash = () => <span className="an-placeholder">—</span>;
const formatDate = (v) => (v ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(new Date(v)) : 'non renseignée');
const monthOf = (key, options) => (key ? new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)) : '');

function PanelState({ error, retry, children }) {
  if (error) return <div className="an-error">Données indisponibles <button type="button" onClick={retry}>Réessayer</button></div>;
  return children;
}

// Produit : le parc (onboarding, sociétés, dirigeants, économies) et l'usage du
// portail client (chiffres arrêtés chaque nuit côté portail, définitions du portail
// dans la bulle de chaque chiffre). Rien n'est recalculé ici.
export default function ProduitPanel({ boardRows, dark }) {
  const product = useDashboardData('/api/v1/ceo-dashboard/product', NIGHTLY);
  const identities = useDashboardData('/api/v1/ceo-dashboard/portfolio', NIGHTLY);
  const pilotage = useDashboardData('/api/v1/ceo-dashboard/pilotage', NIGHTLY);
  const onboarding = useMemo(() => computeOnboarding(boardRows), [boardRows]);
  const directors = useMemo(() => computeDirectors(boardRows, identities.data), [boardRows, identities.data]);
  const { reduce, item, list } = useMotionPrefs();
  const d = product.data;
  const p = pilotage.data;
  const defs = p?.definitions || {};
  const onboardingTotal = (onboarding?.done ?? 0) + (onboarding?.remaining ?? 0);
  const onboardingPct = onboardingTotal ? Math.round((onboarding.done / onboardingTotal) * 100) : null;
  const perDirector = d?.companies && directors?.count ? d.companies / directors.count : null;
  const monthTitle = monthOf(p?.month, { month: 'long', year: 'numeric' });
  const def = (text) => (text ? [{ note: text }] : []);

  return (
    <section className="an-section" aria-label="Produit">
      <Inscription reduce={reduce} sub="Parc client à date">Produit</Inscription>
      <motion.div className="an-grid an-grid--produit" variants={list()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
        <motion.article className="an-panel" variants={item} aria-busy={product.loading || identities.loading}>
          <div className="an-panel-title"><h3>Parc produit<small>clients accompagnés</small></h3><PanelIcon name="temple" /></div>
          <div className="an-figures an-figures--4">
            <Bubble dark={dark} align="start" rows={onboarding ? [
              { label: 'Onboardings effectués', value: intFr(onboarding.done) },
              { label: 'À réaliser', value: intFr(onboarding.remaining) },
              { label: 'Parc produit courant', value: intFr(onboardingTotal) },
              { note: 'Effectué = case cochée par le Client Success sur le board ; à réaliser = client du parc courant sans onboarding effectué.' },
            ] : []}>
              <div className="an-figure">
                <span className="an-figure-label"><CalendarCheck size={13} strokeWidth={2.2} aria-hidden="true" /> Onboarding Owner</span>
                <span className="an-figure-value an-figure-value--lg" style={{ color: 'var(--an-verdigris)' }}>{onboarding ? <Numeral value={onboarding.done} /> : <Dash />}</span>
                <span className="an-figure-cap an-onboarding-cap">
                  effectués
                  {onboarding && onboarding.remaining > 0 && <Chip tone="neutral" icon={CalendarClock}>{intFr(onboarding.remaining)} à réaliser</Chip>}
                </span>
                {onboardingPct != null && <Share part={onboarding.done} total={onboardingTotal} label="du parc onboardé" />}
              </div>
            </Bubble>
            <PanelState error={product.error} retry={product.retry}>
              <div className="an-figure">
                <span className="an-figure-label"><Building2 size={13} strokeWidth={2.2} aria-hidden="true" /> Sociétés</span>
                <span className="an-figure-value an-figure-value--lg" style={{ color: 'var(--an-verdigris)' }}>{product.loading ? <Dash /> : <Numeral value={d?.companies} delay={0.14} />}</span>
                <span className="an-figure-cap">sociétés accompagnées au {formatDate(d?.companies_as_of)}</span>
              </div>
            </PanelState>
            <PanelState error={identities.error} retry={identities.retry}>
              <Bubble dark={dark} align="start" rows={directors ? [
                { label: 'Dirigeants identifiés (NDA)', value: intFr(directors.count) },
                { label: 'Dossiers sans dirigeant documenté', value: intFr(directors.missing) },
                ...(perDirector ? [{ label: 'Sociétés par dirigeant', value: nf(perDirector, 1) }] : []),
              ] : []}>
                <div className="an-figure">
                  <span className="an-figure-label"><Users size={13} strokeWidth={2.2} aria-hidden="true" /> Dirigeants</span>
                  <span className="an-figure-value an-figure-value--lg">{identities.loading || !directors ? <Dash /> : <Numeral value={directors.count} delay={0.21} />}</span>
                  <span className="an-figure-cap">dans le parc actif{perDirector ? ` · ${nf(perDirector, 1)} sociétés par dirigeant` : ''}</span>
                </div>
              </Bubble>
            </PanelState>
            <PanelState error={product.error} retry={product.retry}>
              <div className="an-figure">
                <span className="an-figure-label"><Sparkles size={13} strokeWidth={2.2} aria-hidden="true" /> Économies réalisées</span>
                <span className="an-figure-value an-figure-value--lg">{product.loading ? <Dash /> : <Numeral className="an-money" value={d?.savings} format={compactEuro} delay={0.28} />}</span>
                <span className="an-figure-cap">{d?.savings != null ? `${euro(d.savings)} · ` : ''}arrêté au {formatDate(d?.savings_as_of)}</span>
              </div>
            </PanelState>
          </div>
          {d?.stale && <p className="an-caption" role="status">Actualisation temporairement indisponible · dernières données disponibles</p>}
        </motion.article>

        <motion.article className="an-panel" variants={item} aria-busy={pilotage.loading}>
          <div className="an-panel-title"><h3>Portail client<small>{monthTitle ? `${monthTitle.charAt(0).toUpperCase()}${monthTitle.slice(1)} · ` : ''}mis à jour chaque nuit</small></h3><PanelIcon name="door" /></div>
          <PanelState error={pilotage.error} retry={pilotage.retry}>
            <div className="an-figures an-figures--3">
              <Bubble dark={dark} align="start" rows={def(defs.clients_back_30d)}>
                <div className="an-figure">
                  <span className="an-figure-label"><UserRoundCheck size={13} strokeWidth={2.2} aria-hidden="true" /> Revenus sur 30 j</span>
                  <span className="an-figure-value an-figure-value--lg">{pilotage.loading ? <Dash /> : <Numeral value={p?.clients_back_30d} />}</span>
                  <span className="an-figure-cap">sur {intFr(p?.client_accounts)} comptes clients</span>
                  <Share part={p?.clients_back_30d} total={p?.client_accounts} label="des comptes" />
                </div>
              </Bubble>
              <Bubble dark={dark} align="start" rows={def(defs.requests_waiting)}>
                <div className="an-figure">
                  <span className="an-figure-label"><Hourglass size={13} strokeWidth={2.2} aria-hidden="true" /> Demandes sans réponse</span>
                  <span className="an-figure-value an-figure-value--lg">{pilotage.loading ? <Dash /> : <Numeral value={p?.requests_waiting} delay={0.07} />}</span>
                  <span className="an-figure-cap">dont {intFr(p?.requests_waiting_over_30d)} depuis plus de 30 jours</span>
                  <Share part={p?.requests_waiting_over_30d} total={p?.requests_waiting} label="de plus de 30 j" tone="watch" />
                </div>
              </Bubble>
              <Bubble dark={dark} align="start" rows={def(defs.documents_month)}>
                <div className="an-figure">
                  <span className="an-figure-label"><FileUp size={13} strokeWidth={2.2} aria-hidden="true" /> Documents déposés</span>
                  <span className="an-figure-value an-figure-value--lg">{pilotage.loading ? <Dash /> : <Numeral value={p?.documents_month} delay={0.14} />}</span>
                  <span className="an-figure-cap">{intFr(p?.documents_sent_to_firm)} envois au cabinet{p?.month ? ` en ${monthOf(p.month, { month: 'long' })}` : ' ce mois-ci'}</span>
                  <Share part={p?.documents_sent_to_firm} total={p?.documents_month} label="envoyés au cabinet" />
                </div>
              </Bubble>
            </div>
          </PanelState>
          {p?.stale && <p className="an-caption" role="status">Actualisation temporairement indisponible · dernières données disponibles</p>}
        </motion.article>
      </motion.div>
    </section>
  );
}
