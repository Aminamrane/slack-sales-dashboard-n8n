import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Card from './components/Card';

const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director', 'head_of_acquisition'];
const ROLES_WITH_BUDGET_EDIT = ['admin', 'ceo'];

// Only webinar in DB for now — kept hardcoded since the backend's
// /webinars endpoint returns a static list of 1 entry. Future-proof :
// once a multi-webinar router is wired, /marketing/webinars/:id will
// route to this same component with `:id` as param.
const DEFAULT_WEBINAR_ID = 'webinar-2026-05-26';

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

  // Borne basse pour la vue "Global" : avant l'ouverture des inscriptions
  // du webinaire 26 mai 2026. À élargir quand on aura d'autres webinaires.
  const GLOBAL_FROM = '2026-04-01';

  const queryString = useCallback(() => {
    const parts = [];
    if (preset === 'custom') {
      parts.push(`from=${encodeURIComponent(customFrom)}`);
      parts.push(`to=${encodeURIComponent(customTo)}`);
    } else if (preset === 'all') {
      // 'Global' = on couvre toute la fenêtre d'activité du webinaire en
      // envoyant un from/to explicite (le backend supporte déjà la
      // sémantique from/to comme pour 'custom').
      parts.push(`from=${encodeURIComponent(GLOBAL_FROM)}`);
      parts.push(`to=${encodeURIComponent(todayIso())}`);
    } else {
      parts.push(`range=${preset}`);
    }
    if (source !== 'all') parts.push(`source=${source}`);
    return parts.join('&');
  }, [preset, customFrom, customTo, source]);

  // ── Overview fetch (aggregator) ──────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const qs = queryString();
      const json = await apiClient.get(`/api/v1/marketing/webinars/${DEFAULT_WEBINAR_ID}/overview?${qs}`);
      setOverview(json);
      setOverviewError(null);
    } catch (e) {
      setOverviewError(e?.message || 'Erreur de chargement');
    } finally {
      setOverviewLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!authReady) return;
    void loadOverview();
  }, [authReady, loadOverview]);

  // ── Realtime leads (Supabase leads_realtime) ─────────────────────
  // Source pour les tiles "Présents au live" + "Rendez-vous pris" + le
  // composant "Classement sales webinaire". Refetch à chaque mount /
  // changement de filtres pertinents — la donnée est cachée 60s côté
  // backend, donc plusieurs onglets ouverts ne flood pas Supabase.
  const [realtimeLeads, setRealtimeLeads] = useState(null);
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await apiClient.get(`/api/v1/marketing/webinars/${DEFAULT_WEBINAR_ID}/realtime-leads`);
        if (!cancelled) setRealtimeLeads(json);
      } catch {
        // Silencieux — les tiles tomberont sur leur fallback "—"
      }
    })();
    return () => { cancelled = true; };
  }, [authReady]);

  // ── Webinar meta (static list, fetched once) ─────────────────────
  const [webinar, setWebinar] = useState(null);
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await apiClient.get('/api/v1/marketing/webinars');
        const list = json?.webinars || json || [];
        const found = list.find((w) => w.id === DEFAULT_WEBINAR_ID) || list[0];
        if (!cancelled && found) setWebinar(found);
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
  const rangeWindow = stats?.range || null;

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
              {rangeWindow && (
                <span style={{ marginLeft: 8, color: C.faded }}>
                  · {rangeWindow.from} → {rangeWindow.to}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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

        {/* ── CAMPAGNES CIBLÉES (4 cards, polling actif) ── */}
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
              webinarId={DEFAULT_WEBINAR_ID}
              kind="post-missed"
              title="Relance post-webinaire · pas venus + pas de RDV"
              subtitle="Séquence 4 jours pour les inscrits qui n'ont pas pris de RDV"
              intervalMs={15000}
              progressColor={C.heroEmerald}
              C={C}
            />
            <CampaignCard
              webinarId={DEFAULT_WEBINAR_ID}
              kind="postponement"
              title="Campagne décalage 26 mai · notification one-shot"
              subtitle="Email envoyé à tous les inscrits pour annoncer le décalage"
              intervalMs={15000}
              progressColor={C.heroEmerald}
              C={C}
            />
            <NurtureTable webinarId={DEFAULT_WEBINAR_ID} C={C} />
            <CampaignCard
              webinarId={DEFAULT_WEBINAR_ID}
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
            webinarId={DEFAULT_WEBINAR_ID}
            C={C}
            onChange={loadOverview}
            readOnly={!canEditBudgets}
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
