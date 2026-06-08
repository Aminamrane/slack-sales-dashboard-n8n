import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import apiClient from '../../services/apiClient';
import SharedNavbar from '../../components/SharedNavbar.jsx';

import { buildTheme, fmtInt, fmtPct } from './theme';
import DateRangePicker from './components/DateRangePicker';
import SourceFilter from './components/SourceFilter';
import PartialDataBanner from './components/PartialDataBanner';
import HeroKpiStrip from './components/HeroKpiStrip';
import SourceBreakdown from './components/SourceBreakdown';
import TrafficChart from './components/TrafficChart';
import EmailEngagement from './components/EmailEngagement';
import CampaignCard from './components/CampaignCard';
import NurtureTable from './components/NurtureTable';
import LeadsPipeline from './components/LeadsPipeline';
import SatisfactionGauge from './components/SatisfactionGauge';
import Heatmap from './components/Heatmap';
import BudgetEditor from './components/BudgetEditor';
import BudgetByDayChart from './components/BudgetByDayChart';
import SalesWebinarRanking from './components/SalesWebinarRanking';
import SalesWebinarRankingCompact from './components/SalesWebinarRankingCompact';
import RdvBySourceDonut from './components/RdvBySourceDonut';
import Card from './components/Card';

const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director', 'head_of_acquisition'];
// Édition des budgets réservée à Timothy (marketing) + admin (debug/safety).
// CEO/AcqDir/head_of_acquisition voient le BudgetEditor en lecture seule.
const ROLES_WITH_BUDGET_EDIT = ['admin', 'marketing'];

// Slug par défaut quand l'URL ne précise pas `?webinar=` — c'est la cohorte
// historique 26 mai, dont les chiffres sont figés. Le dropdown header
// expose maintenant les autres cohortes (multi-webinaire 2026-06-04).
const DEFAULT_WEBINAR_ID = 'webinar-2026-05-26';

// Cohorte qui possède les 4 séquences emails post-webinaire (post-missed,
// postponement, NurtureTable, broad) côté landing. Pour toute autre cohorte,
// ces 4 cards sont masquées (la landing les retourne quand même mais ce
// serait de la data 26 mai sous un header 22 juin = trompeur).
const COHORT_WITH_CAMPAIGNS = 'webinar-2026-05-26';

function readWebinarFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search).get('webinar');
    return v && /^webinar-\d{4}-\d{2}-\d{2}$/.test(v) ? v : DEFAULT_WEBINAR_ID;
  } catch {
    return DEFAULT_WEBINAR_ID;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function sevenDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Marketing dashboard — mirrors `https://webinaire.ownertechnology.com/admin`
 * for the internal CRM. Renders inside the existing SharedNavbar layout,
 * gates auth at `admin | ceo | marketing` roles, polls the 4 campaign
 * endpoints, gracefully handles `_partial: true` from the overview
 * aggregator.
 *
 * Visual references : src/assets/marketing/*.jpg (5 SaaS dashboard mockups).
 */
export default function Marketing() {
  const navigate = useNavigate();

  // ── Embed mode (rendered inside a Ceo* wrapper sidebar shell) ────
  // Quand `?embed=true` est posé dans l'URL (par CeoWebinarView via
  // history.replaceState), on masque le SharedNavbar interne et on
  // réduit le padding-top, le wrapper se chargeant déjà du chrome.
  const embedMode = useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === 'true',
    []
  );

  // ── Webinar selection (multi-cohorte 2026-06-04) ─────────────────
  // L'URL `?webinar=<slug>` détermine la cohorte affichée. Fallback sur
  // webinar-2026-05-26 si pas de param (rétro-compat avec les bookmarks
  // existants). Switch via dropdown header → URL replaceState (préserve
  // `?embed=true`) + refetch overview/realtimeLeads.
  const [webinarId, setWebinarId] = useState(readWebinarFromUrl);
  const handleWebinarChange = useCallback((nextId) => {
    if (!nextId || nextId === webinarId) return;
    setWebinarId(nextId);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('webinar', nextId);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // history API indisponible → state-only update, deep-link perdu
      // mais l'UI fonctionne.
    }
  }, [webinarId]);

  // ── Dark mode (kept consistent with the rest of the app) ─────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  const C = useMemo(() => buildTheme(darkMode), [darkMode]);

  // ── Auth + role gate ─────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Aligné sur le pattern CeoDashboard et autres pages du CRM : on check
    // uniquement la présence du user et son role. L'apiClient gère lui-même
    // les 401 sur les requêtes (refresh token, redirect login si nécessaire).
    const user = apiClient.getUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      navigate('/login');
      return;
    }
    setUserRole(user.role);
    setSession({
      user: {
        email: user.email,
        user_metadata: { name: user.name, avatar_url: user.avatar_url || null },
      },
    });
    setAuthReady(true);
  }, [navigate]);

  // ── Filters ──────────────────────────────────────────────────────
  // Default = 'all' (vue globale depuis le début de la campagne webinaire).
  // Le webinaire 26 mai est terminé : ouvrir la page avec un range étroit
  // (7j glissant) montrerait surtout du vide. La vue globale donne d'emblée
  // les chiffres totaux (315 inscrits, 942 emails J-day, etc.).
  const [preset, setPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState(sevenDaysAgoIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [source, setSource] = useState('all');

  // ── Webinar meta (multi-cohorte) ─────────────────────────────────
  // Déclaré ICI (avant queryString) car `queryString` lit `webinar.date_start`
  // pour calculer la fenêtre du preset "Webinaire complet". Bouger
  // ce bloc plus bas → ReferenceError TDZ sur la dep `webinar` de queryString.
  const [webinarsList, setWebinarsList] = useState([]);
  const webinar = useMemo(
    () => webinarsList.find((w) => w.id === webinarId) || webinarsList[0] || null,
    [webinarsList, webinarId]
  );

  // Borne basse historique de la vue "Global" si jamais le webinaire courant
  // n'a pas de `date_start` exposé (ancien backend ou cohorte non encore
  // référencée dans `_STATIC_WEBINARS`). À jour, chaque webinaire fournit
  // ses propres dates → séparation cohorte propre côté budgets/CPL.
  const GLOBAL_FROM_FALLBACK = '2026-04-01';

  const queryString = useCallback(() => {
    const parts = [];
    if (preset === 'custom') {
      parts.push(`from=${encodeURIComponent(customFrom)}`);
      parts.push(`to=${encodeURIComponent(customTo)}`);
    } else if (preset === 'all') {
      // 'Webinaire complet' = on couvre la fenêtre d'activité de la cohorte
      // sélectionnée. Si la cohorte expose `date_start/date_end` (via
      // `_STATIC_WEBINARS`), on les utilise → vue 22 juin = budgets 5 juin-
      // 6 juillet, vue 26 mai = budgets 1 avr-4 juin, zéro chevauchement.
      // Fallback sur GLOBAL_FROM_FALLBACK → today pour rétrocompat.
      const from = webinar?.date_start || GLOBAL_FROM_FALLBACK;
      // Clamp `to` à `today` pour ne pas demander des dates futures (la
      // landing n'a pas de budget côté demain).
      const today = todayIso();
      const to = webinar?.date_end && webinar.date_end < today ? webinar.date_end : today;
      parts.push(`from=${encodeURIComponent(from)}`);
      parts.push(`to=${encodeURIComponent(to)}`);
    } else {
      parts.push(`range=${preset}`);
    }
    if (source !== 'all') parts.push(`source=${source}`);
    return parts.join('&');
  }, [preset, customFrom, customTo, source, webinar]);

  // ── Overview fetch (aggregator) ──────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const qs = queryString();
      const json = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/overview?${qs}`);
      setOverview(json);
      setOverviewError(null);
    } catch (e) {
      setOverviewError(e?.message || 'Erreur de chargement');
    } finally {
      setOverviewLoading(false);
    }
  }, [queryString, webinarId]);

  // Premier fetch + refetch sur changement de filtres / webinarId.
  // Garde anti-race : on attend que `webinarsList` soit chargée pour que
  // `webinar.date_start/date_end` (utilisés par queryString) soient résolus.
  // Sans cette garde, le 1er fetch part avec `GLOBAL_FROM_FALLBACK` =
  // 2026-04-01 → la landing retourne le budget 26 mai sur la vue 22 juin
  // (budgets côté landing filtrent par date pas par cohorte).
  useEffect(() => {
    if (!authReady) return;
    if (webinarsList.length === 0) return;
    void loadOverview();
  }, [authReady, loadOverview, webinarsList.length]);

  // Polling auto 60s pour suivre l'arrivée des leads en live (cohorte en
  // cours type 22 juin). Pause quand l'onglet n'est pas visible pour
  // économiser les appels (pattern aligné sur useCampaignPolling).
  // Ref stockant la dernière `loadOverview` (closure stable indépendante
  // du intervalle, évite re-bind à chaque re-render).
  const loadOverviewRef = useRef(loadOverview);
  useEffect(() => { loadOverviewRef.current = loadOverview; }, [loadOverview]);
  useEffect(() => {
    if (!authReady) return undefined;
    // Idem garde anti-race : ne démarrer le polling qu'après webinarsList
    // chargée (sinon polling fetch avec mauvaise fenêtre date).
    if (webinarsList.length === 0) return undefined;
    let timer = null;
    const start = () => {
      if (timer || document.hidden) return;
      timer = setInterval(() => { void loadOverviewRef.current(); }, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [authReady, webinarsList.length]);

  // ── Realtime leads (Supabase leads_realtime) ─────────────────────
  // Source pour les tiles "Présents au live" + "Rendez-vous pris" + le
  // composant "Classement sales webinaire". Refetch à chaque mount /
  // changement de filtres pertinents — la donnée est cachée 60s côté
  // backend, donc plusieurs onglets ouverts ne flood pas Supabase.
  const [realtimeLeads, setRealtimeLeads] = useState(null);
  const fetchRealtimeLeads = useCallback(async () => {
    try {
      const json = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/realtime-leads`);
      setRealtimeLeads(json);
    } catch {
      // Silencieux — les tiles tomberont sur leur fallback "—"
    }
  }, [webinarId]);

  // Refetch immédiat au mount et sur changement de webinarId.
  useEffect(() => {
    if (!authReady) return;
    void fetchRealtimeLeads();
  }, [authReady, fetchRealtimeLeads]);

  // Polling auto 60s — aligné sur TTL_REALTIME_LEADS backend = 60s. Pause
  // si l'onglet n'est pas visible. Mêmes garde-fous que loadOverview.
  const fetchRealtimeRef = useRef(fetchRealtimeLeads);
  useEffect(() => { fetchRealtimeRef.current = fetchRealtimeLeads; }, [fetchRealtimeLeads]);
  useEffect(() => {
    if (!authReady) return undefined;
    let timer = null;
    const start = () => {
      if (timer || document.hidden) return;
      timer = setInterval(() => { void fetchRealtimeRef.current(); }, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [authReady]);

  // ── Webinar list fetch (état déclaré plus haut près de `webinar`) ──
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await apiClient.get('/api/v1/marketing/webinars');
        const list = Array.isArray(json?.webinars) ? json.webinars : (Array.isArray(json) ? json : []);
        if (!cancelled) setWebinarsList(list);
      } catch {
        // Non-blocking — the hero card falls back to defaults
      }
    })();
    return () => { cancelled = true; };
  }, [authReady]);

  // ── Derived data ─────────────────────────────────────────────────
  const stats = overview?.stats || null;
  const leads = overview?.leads?.leads || [];
  const scoresByLeadId = useMemo(() => {
    // Built fresh from the overview payload — wrapping the source in
    // the memo callback avoids the "new array reference every render"
    // dependency trap that ESLint flags.
    const list = overview?.leadScores?.scores || [];
    const m = new Map();
    for (const s of list) m.set(s.lead_id, s);
    return m;
  }, [overview?.leadScores?.scores]);

  const summary = stats?.summary;
  const pageviews = stats?.timeseries?.pageviews || [];
  const leadsByDay = stats?.timeseries?.leadsByDay || [];
  const budgetByDay = stats?.timeseries?.budgetByDay || [];
  const emailEngagement = stats?.emailEngagement || [];

  // Partial errors flag
  const partialErrors = overview?._partial ? (overview?._errors || []) : [];

  // Filtered leads when source changes — we always pass `source` to the
  // backend so the leads array is already filtered. The SourceFilter
  // below just triggers a refetch.
  const filteredLeads = leads;

  // ── Source filter handler — triggers refetch via queryString change ──
  const handleSourceChange = (next) => {
    setSource(next);
    // useEffect above re-runs loadOverview when queryString deps change
  };

  // ── Render ───────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.backdrop,
        color: C.muted,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}>
        Chargement…
      </div>
    );
  }

  const canEditBudgets = ROLES_WITH_BUDGET_EDIT.includes(userRole) || userRole === 'admin';

  return (
    <div style={{
      minHeight: '100vh',
      background: C.backdrop,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: C.text,
    }}>
      {!embedMode && (
        <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 1480,
          margin: '0 auto',
          // En embed, le wrapper gère déjà la padding-top sous sa SharedNavbar
          // (paddingTop: 64) ; on ne re-padding pas une 2e fois.
          padding: embedMode ? '24px 32px 64px' : '92px 32px 64px',
        }}
      >
        {/* ── HEADER ── */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 28,
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 50,
              background: C.surface,
              border: `1px solid ${C.hairline}`,
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              boxShadow: C.shadow,
            }}>
              Marketing · Owner Technology
            </div>
            <h1 style={{
              margin: '10px 0 2px',
              fontSize: 32,
              fontWeight: 800,
              color: C.text,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}>
              Performance webinaire
            </h1>
            <p style={{
              margin: 0,
              fontSize: 14,
              color: C.muted,
              fontWeight: 500,
            }}>
              KPIs landing, séquence emailing et pipeline prospects
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Sélecteur cohorte webinaire — affiché dès qu'il y a 2+
                entrées dans `/marketing/webinars`. On garde un style
                discret cohérent avec DateRangePicker (pill blanche +
                ombre, font-weight 600). */}
            {webinarsList.length > 1 && (
              <WebinarSelector
                webinars={webinarsList}
                value={webinarId}
                onChange={handleWebinarChange}
                C={C}
              />
            )}
            <DateRangePicker
              preset={preset}
              customFrom={customFrom}
              customTo={customTo}
              onChange={(next) => {
                setPreset(next.preset);
                setCustomFrom(next.customFrom);
                setCustomTo(next.customTo);
              }}
              C={C}
            />
          </div>
        </header>

        {/* ── PARTIAL DATA BANNER ── */}
        {partialErrors.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <PartialDataBanner errors={partialErrors} C={C} />
          </div>
        )}

        {/* ── ERROR STATE (full failure) ── */}
        {overviewError && !overview && (
          <Card title="Erreur de chargement" C={C}>
            <div style={{
              padding: '12px 16px',
              background: C.rose.bg,
              color: C.rose.fg,
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {overviewError}
            </div>
            <button
              type="button"
              onClick={loadOverview}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 10,
                background: C.accent,
                color: '#fff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Réessayer
            </button>
          </Card>
        )}

        {/* ── HERO + KPI STRIP ── */}
        <section style={{ marginBottom: 24 }}>
          <HeroKpiStrip
            webinar={webinar}
            summary={summary}
            realtimeLeads={realtimeLeads}
            rankingPanel={<SalesWebinarRankingCompact data={realtimeLeads} C={C} />}
            donutPanel={<RdvBySourceDonut data={realtimeLeads} C={C} />}
            C={C}
            loading={overviewLoading && !summary}
          />
        </section>

        {/* ── SOURCE BREAKDOWN ── */}
        {summary && (
          <section style={{ marginBottom: 24 }}>
            <SourceBreakdown summary={summary} C={C} />
          </section>
        )}

        {/* ── TRAFFIC & BUDGET CHART ── */}
        <section style={{ marginBottom: 24 }}>
          <TrafficChart
            pageviews={pageviews}
            leadsByDay={leadsByDay}
            budgetByDay={budgetByDay}
            C={C}
            darkMode={darkMode}
          />
        </section>

        {/* ── BUDGET PAR JOUR (graph dédié, lecture rapide) ── */}
        <section style={{ marginBottom: 24 }}>
          <BudgetByDayChart budgetByDay={budgetByDay} C={C} darkMode={darkMode} />
        </section>

        {/* ── SATISFACTION GAUGE + HEATMAP (side by side) ── */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) 1.4fr',
          gap: 16,
          marginBottom: 24,
        }}>
          <SatisfactionGauge score={summary?.globalOpenRatePct} C={C} />
          <Heatmap leads={leads} C={C} />
        </section>

        {/* ── EMAIL ENGAGEMENT TABLE ── */}
        <section style={{ marginBottom: 24 }}>
          <EmailEngagement rows={emailEngagement} C={C} />
        </section>

        {/* ── CAMPAGNES CIBLÉES (4 cards, polling actif) ──
            Masquées hors cohorte 26 mai : les 4 endpoints campagnes côté
            landing ne sont PAS paramétrés par webinaire et retourneraient
            leurs chiffres 26 mai même sous un header "Webinaire 22 juin"
            — trompeur. Sur les autres cohortes, on n'affiche tout simplement
            pas cette section (cohérent avec le fait que ces séquences
            n'existent pas encore pour elles). */}
        {webinarId === COHORT_WITH_CAMPAIGNS && (
        <section style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <h2 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.02em',
            }}>
              Campagnes ciblées
            </h2>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: C.subtle,
              border: `1px solid ${C.hairline}`,
              borderRadius: 50,
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                background: C.emerald.strong,
                borderRadius: '50%',
                animation: 'mktPulse 1.8s ease-in-out infinite',
              }} />
              Polling actif
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CampaignCard
              webinarId={webinarId}
              kind="post-missed"
              title="Relance post-webinaire · pas venus + pas de RDV"
              subtitle="Séquence 4 jours pour les inscrits qui n'ont pas pris de RDV"
              intervalMs={15000}
              progressColor={C.heroEmerald}
              C={C}
            />
            <CampaignCard
              webinarId={webinarId}
              kind="postponement"
              title="Campagne décalage 26 mai · notification one-shot"
              subtitle="Email envoyé à tous les inscrits pour annoncer le décalage"
              intervalMs={15000}
              progressColor={C.heroEmerald}
              C={C}
            />
            <NurtureTable webinarId={webinarId} C={C} />
            <CampaignCard
              webinarId={webinarId}
              kind="broad"
              title="Campagne Broad invite · cold outreach (CSV)"
              subtitle="Invitation aux anciens prospects via /broad"
              intervalMs={30000}
              progressColor={`linear-gradient(90deg, ${C.amber.strong}, ${C.amber.fg})`}
              C={C}
              // Cold outreach Resend sans pixel → pas de tracking
              // ouverture/clic ni feedback bounce/plainte exploitable.
              // On garde uniquement Délivrés + Inscrits via /broad.
              excludeTiles={['opened', 'clicked', 'bounced', 'complained']}
              // Campagne one-shot massive : drain horaire pas exploitable.
              hideSentByHour
              extraTiles={(data, T) => [
                <BroadInscritsTile key="inscrits" data={data} C={T} />,
              ]}
            />
          </div>
        </section>
        )}

        {/* ── CLASSEMENT SALES WEBINAIRE ── */}
        <section style={{ marginBottom: 24 }}>
          <SalesWebinarRanking data={realtimeLeads} C={C} />
        </section>

        {/* ── LEADS PIPELINE ── */}
        <section style={{ marginBottom: 24 }}>
          <LeadsPipeline
            leads={filteredLeads}
            scoresByLeadId={scoresByLeadId}
            C={C}
            sourceFilter={
              <SourceFilter value={source} onChange={handleSourceChange} C={C} />
            }
          />
        </section>

        {/* ── BUDGET EDITOR ── */}
        <section style={{ marginBottom: 16 }}>
          <BudgetEditor
            webinarId={webinarId}
            C={C}
            onChange={loadOverview}
            readOnly={!canEditBudgets}
            dateFrom={webinar?.date_start}
            dateTo={webinar?.date_end}
          />
        </section>

        <footer style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: `1px solid ${C.hairline}`,
          fontSize: 11,
          color: C.faded,
          fontWeight: 500,
          textAlign: 'center',
        }}>
          Owner Technology · Marketing interne · Données Plausible +
          Postgres via api-owner
        </footer>
      </motion.div>
    </div>
  );
}

/** Sélecteur de cohorte webinaire — select natif stylé pill cohérent
 *  avec DateRangePicker. Apparaît dès qu'il y a 2+ webinaires dans
 *  `/marketing/webinars`. Change la cohorte via state + URL `?webinar=`.
 */
function WebinarSelector({ webinars, value, onChange, C }) {
  return (
    <label style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px 6px 14px',
      background: '#ffffff',
      border: `1px solid ${C.hairline}`,
      borderRadius: 50,
      boxShadow: C.shadow,
      fontSize: 12.5,
      fontWeight: 600,
      color: C.text,
      cursor: 'pointer',
    }}>
      <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Webinaire
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          color: C.text,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          paddingRight: 18,
          fontFamily: 'inherit',
          letterSpacing: '-0.005em',
          // Caret via SVG inline (cohérent UI)
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1L5 5L9 1' stroke='%239ca3af' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right center',
        }}
      >
        {webinars.map((w) => (
          <option key={w.id} value={w.id}>{w.title || w.id}</option>
        ))}
      </select>
    </label>
  );
}

/** Extra tile for the broad campaign — "Inscrits via /broad" + conversion %. */
function BroadInscritsTile({ data, C }) {
  const value = data.engagement?.broadSignups ?? 0;
  const conv = data.rates?.conversionRatePct;
  return (
    <div style={{
      background: C.emerald.bg,
      borderRadius: 12,
      padding: '12px 14px',
      border: `1px solid ${C.emerald.bg}`,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: C.emerald.fg,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Inscrits via /broad
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 22,
        fontWeight: 700,
        color: C.emerald.fg,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {fmtInt(value)}
      </div>
      <div style={{
        marginTop: 4,
        fontSize: 11,
        color: C.emerald.fg,
        fontWeight: 600,
      }}>
        {fmtPct(conv)} de conversion
      </div>
    </div>
  );
}
