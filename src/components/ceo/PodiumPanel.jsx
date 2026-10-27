import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import apiClient from '../../services/apiClient';
import ceo6 from '../../assets/ceo6.svg';
import firstPlace from '../../assets/1st-place.png';
import secondPlace from '../../assets/2st-place.png';
import thirdPlace from '../../assets/3st-place.png';
import trophyIcon from '../../assets/medal-gold.png';
import silverMedalIcon from '../../assets/medal-silver.png';
import bronzeMedalIcon from '../../assets/medal-bronze.png';
import crownIcon from '../../assets/crown.png';
import podiumArt from '../../assets/ceo-podium-fresque.webp';
import MedalStack from '../MedalStack.jsx';
import { loadPodiumMedals, nameKey } from '../../utils/podiumMedals.js';
import { intFr, Share } from './Figures.jsx';
import PanelIcon from './PanelIcon.jsx';
import { EASE_OUT, useMotionPrefs } from './motion.js';

const RANK_MEDALS = [firstPlace, secondPlace, thirdPlace];
const MEDAL_ICONS = { gold: trophyIcon, silver: silverMedalIcon, bronze: bronzeMedalIcon };
const getInitials = (name) => {
  const parts = (name || '').split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?').slice(0, 2).toUpperCase();
};

// Les distinctions de « Suivi des ventes », mêmes sources : trophées du 1er de chaque
// mois (/leaderboard/trophies), médailles d'argent et de bronze (2e et 3e de chaque mois
// terminé, classements mensuels mis en cache 6 h), couronne du meilleur de tous les temps.
// Chargées après le reste de la page : elles décorent, elles n'attendent rien.
function useHonours(enabled) {
  const [honours, setHonours] = useState({ gold: {}, silver: {}, bronze: {}, allTimeTop: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [trophies, allTime, podium] = await Promise.all([
        apiClient.get('/api/v1/leaderboard/trophies').catch(() => null),
        apiClient.getLeaderboardStats('all').catch(() => null),
        loadPodiumMedals(apiClient).catch(() => null),
      ]);
      if (cancelled) return;
      setHonours({
        gold: trophies?.monthly_winners || {},
        silver: podium?.second || {},
        bronze: podium?.third || {},
        allTimeTop: allTime?.all_sellers?.[0]?.name || null,
      });
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [enabled]);
  return honours;
}

// Classement du mois : les quatre premiers commerciaux, leurs ventes, leurs distinctions,
// et l'objectif mensuel (ventes cibles) que le CEO, l'admin ou la direction financière éditent.
export default function PodiumPanel({ leaderboard, loading, objective, canEdit, onEditObjectives, monthLabel }) {
  const { reduce, item } = useMotionPrefs();
  const sellers = (leaderboard?.all_sellers || []).slice(0, 4);
  const max = Math.max(1, ...sellers.map((s) => s.sales || 0));
  const monthSales = leaderboard?.totals?.sales ?? null;
  const honours = useHonours(sellers.length > 0);
  return (
    <motion.article className="an-panel an-podium" variants={item} aria-label="Classement du mois">
      <div className="an-podium-art" aria-hidden="true">
        <img src={podiumArt} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add('is-ready')} />
      </div>
      <img
        src={ceo6}
        alt={canEdit ? 'Éditer les objectifs mensuels' : ''}
        onClick={canEdit ? onEditObjectives : undefined}
        style={{ position: 'absolute', top: -12, right: -10, width: 58, height: 55, objectFit: 'contain', pointerEvents: canEdit ? 'auto' : 'none', cursor: canEdit ? 'pointer' : 'default', zIndex: 10, transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transformOrigin: 'center' }}
        onMouseEnter={canEdit ? (e) => { e.currentTarget.style.transform = 'scale(1.08)'; } : undefined}
        onMouseLeave={canEdit ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
      />
      <div className="an-panel-title an-panel-title--lead"><PanelIcon name="laurel" /><h3>Classement<small>top commerciaux, {monthLabel}</small></h3></div>
      <div className="an-podium-rows">
        {sellers.map((seller, i) => (
          <motion.div
            key={seller.name || i}
            className="an-podium-row"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE_OUT, delay: 0.1 + i * 0.07 }}
          >
            <span className="an-podium-rank" aria-label={`${i + 1}e`}>
              {RANK_MEDALS[i] ? <img src={RANK_MEDALS[i]} alt="" /> : i + 1}
            </span>
            <span className={`an-podium-avatar${honours.allTimeTop && seller.name === honours.allTimeTop ? ' is-crowned' : ''}`}>
              {seller.avatar_url ? <img src={seller.avatar_url} alt="" decoding="async" onLoad={(e) => e.currentTarget.classList.add('is-ready')} /> : getInitials(seller.name)}
              {honours.allTimeTop && seller.name === honours.allTimeTop && (
                <img src={crownIcon} className="an-podium-crown" alt="Top ventes all-time" title="Top ventes all-time" />
              )}
            </span>
            <span className="an-podium-name">
              <span className="an-podium-name-row">
                <span className="an-podium-name-text">{seller.name}</span>
                <motion.span style={{ display: 'inline-flex' }} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }} key={`${honours.gold[seller.name] || 0}-${honours.silver[nameKey(seller.name)] || 0}-${honours.bronze[nameKey(seller.name)] || 0}`}>
                  <MedalStack
                    counts={{ gold: honours.gold[seller.name], silver: honours.silver[nameKey(seller.name)], bronze: honours.bronze[nameKey(seller.name)] }}
                    icons={MEDAL_ICONS}
                  />
                </motion.span>
              </span>
              <small>{seller.sales || 0} vente{(seller.sales || 0) > 1 ? 's' : ''}</small>
            </span>
            <span className="an-podium-bar" aria-hidden="true">
              <motion.div initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: (seller.sales || 0) / max }} viewport={{ once: true, amount: 0.5 }} transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT, delay: 0.25 + i * 0.07 }} />
            </span>
            <span className="an-podium-value">{seller.sales || 0}</span>
          </motion.div>
        ))}
        {sellers.length === 0 && (
          <div className="an-figure-cap" style={{ padding: '18px 0', textAlign: 'center' }}>{loading ? 'Chargement…' : 'Aucune donnée'}</div>
        )}
      </div>
      <div className="an-panel-foot" style={{ marginTop: 'auto' }}>
        <div className="an-objective">
          <Target size={15} strokeWidth={2} aria-hidden="true" />
          <span>
            Objectif du mois : <strong style={{ color: 'var(--an-ink)' }}>{objective ?? '—'}</strong>
            {objective != null && monthSales != null && <> · {intFr(monthSales)} vente{monthSales > 1 ? 's' : ''} déclarée{monthSales > 1 ? 's' : ''}</>}
          </span>
        </div>
        {canEdit && <button type="button" className="an-objective-edit" onClick={onEditObjectives}>Objectifs</button>}
      </div>
      {objective != null && monthSales != null && objective > 0 && (
        <Share part={Math.min(monthSales, objective)} total={objective} label="de l’objectif atteint" tone={monthSales >= objective ? 'good' : 'watch'} />
      )}
    </motion.article>
  );
}
