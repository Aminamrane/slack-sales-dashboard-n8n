// src/pages/MetaAds/index.jsx — Meta Ads (page interne CRM), sur le modèle de Search Console.
//
// Une seule page : la période et le portefeuille en puces, des tuiles de
// métriques que l'on coche pour tracer la courbe jour par jour, puis un
// tableau par dimension (créas, campagnes, ensembles, publicités, régions,
// âge et genre, placements, formats, portefeuilles, jours, ventes). Un clic
// sur une créa ou une publicité ouvre son détail. Les ventes sont celles du
// Suivi des ventes, rattachées à la créa d'origine du lead de chaque client.
// Rôles : admin / ceo / marketing / acquisition_director / head_of_acquisition.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';
import Filters, { PERIODS } from './Filters.jsx';
import MetricTiles from './MetricTiles.jsx';
import TimeChart from './TimeChart.jsx';
import DataTable, { DimensionTabs } from './DataTable.jsx';
import CreativePanel from './CreativePanel.jsx';
import { TABS } from './tabs.jsx';
import Pict from './icons.jsx';
import { getTheme, fmtInt, fmtCompact, fmtEur, fmtEur2, fmtRoas } from './theme.js';

const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director', 'head_of_acquisition'];
const MAX_SELECTED = 4;

// ── métriques (tuiles + courbe) ────────────────────────────────────────────
function metricsFor(T) {
  const s = T.series;
  return [
    { key: 'spend', label: 'Dépense', color: s[0], fmt: fmtEur, daily: (d) => d.spend },
    { key: 'leads', label: 'Leads', color: s[3], fmt: fmtInt, daily: (d) => d.leads },
    { key: 'sales', label: 'Ventes', color: s[2], fmt: fmtInt, daily: (d) => d.sales },
    { key: 'cpl', label: 'Coût par lead', color: s[1], fmt: fmtEur2, goodWhenDown: true, daily: (d) => (d.leads ? d.spend / d.leads : null) },
    { key: 'roas', label: 'Retour sur dépense', color: s[4], fmt: fmtRoas, daily: (d) => (d.spend ? d.ca / d.spend : null) },
    { key: 'reach', label: 'Portée', color: s[5], fmt: fmtCompact, daily: (d) => d.reach },
    { key: 'impressions', label: 'Impressions', color: s[6], fmt: fmtCompact, daily: (d) => d.impressions },
    { key: 'clicks', label: 'Clics', color: s[7], fmt: fmtInt, daily: (d) => d.clicks },
  ];
}

function valuesFrom(ov) {
  if (!ov) return null;
  const t = ov.totals || {};
  const s = ov.sales || {};
  return {
    spend: t.spend ?? null, leads: t.leads ?? null, sales: s.total ?? null, cpl: t.cpl ?? null,
    roas: t.spend ? (s.ca_attributed || 0) / t.spend : null, reach: t.reach ?? null, impressions: t.impressions ?? null, clicks: t.clicks ?? null,
    salesLine: s.total != null ? `${fmtInt(s.meta)} créa · ${fmtInt(s.webinaire)} webinaire · ${fmtInt(s.hors_meta)} hors Meta${s.sans_client ? ` · ${fmtInt(s.sans_client)} sans client` : ''}` : null,
  };
}

// jours de la période, enrichis des ventes déclarées et de leur CA par jour
function daysFrom(ov) {
  if (!ov?.daily) return [];
  const sales = {}, ca = {};
  (ov.sales?.detail || []).forEach((x) => { if (x.date) { sales[x.date] = (sales[x.date] || 0) + 1; ca[x.date] = (ca[x.date] || 0) + (x.attributed_to ? x.amount || 0 : 0); } });
  return ov.daily.map((d) => ({ ...d, sales: sales[d.date] || 0, ca: ca[d.date] || 0 }));
}

function previousWindow(since, until) {
  const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
  const days = Math.round((b - a) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) return null;
  const pu = new Date(a); pu.setUTCDate(pu.getUTCDate() - 1);
  const ps = new Date(pu); ps.setUTCDate(ps.getUTCDate() - (days - 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { since: iso(ps), until: iso(pu) };
}

// ── chargement avec mémoire par clé (les onglets ne rechargent pas) ─────────
function urlFor(source, range, portfolio) {
  const q = `since=${range.since}&until=${range.until}`;
  if (source === 'overview') return `/api/v1/marketing/meta-ads/overview?${q}&portfolio=${portfolio}`;
  if (source === 'leaderboard') return `/api/v1/marketing/meta-ads/leaderboard?${q}`;
  const level = source.replace('table_', '');
  return `/api/v1/marketing/meta-ads?level=${level}&${q}`;
}

function useSource(source, range, portfolio, enabled = true) {
  const cache = useRef(new Map());
  const url = urlFor(source, range, portfolio);
  const [state, setState] = useState({ url: null, data: null, loading: enabled, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const hit = cache.current.get(url);
    if (hit) { setState({ url, data: hit, loading: false, error: null }); return undefined; }
    setState({ url, data: null, loading: true, error: null });
    apiClient.get(url)
      .then((d) => { cache.current.set(url, d); if (alive) setState({ url, data: d, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ url, data: null, loading: false, error: e?.status === 503 ? 'Configuration Meta en attente sur le serveur.' : (e?.data?.detail || e?.message || 'Erreur de chargement') }); });
    return () => { alive = false; };
  }, [url, enabled]);
  return state;
}

function syncLabel(iso) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  return `il y a ${Math.floor(mins / 60)} h`;
}

export default function MetaAds() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate('/login'); return; }
    if (!ALLOWED_ROLES.includes(user.role)) { navigate('/'); return; }
    setAuthChecked(true);
  }, [navigate]);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  const T = useMemo(() => getTheme(darkMode), [darkMode]);
  const METRICS = useMemo(() => metricsFor(T), [T]);

  const [periodKey, setPeriodKey] = useState('month');
  const [range, setRange] = useState(() => PERIODS.find((p) => p.key === 'month').range());
  const [portfolio, setPortfolio] = useState('all');
  const [selected, setSelected] = useState(['spend', 'leads', 'sales']);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'creatives'));
  const [panel, setPanel] = useState(null);

  const onPeriod = useCallback((key, r) => { setPeriodKey(key); if (r?.since && r?.until) setRange({ since: r.since, until: r.until }); }, []);
  const onToggle = useCallback((key) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= MAX_SELECTED ? [...cur.slice(1), key] : [...cur, key])), []);

  const prevRange = useMemo(() => previousWindow(range.since, range.until), [range]);
  const overview = useSource('overview', range, portfolio, authChecked);
  const previous = useSource('overview', prevRange || range, portfolio, authChecked && !!prevRange);
  const tabDef = TABS.find((t) => t.key === tab) || TABS[0];
  const tableSource = useSource(tabDef.source, range, portfolio, authChecked && tabDef.source !== 'overview');
  const leaderboardForPanel = useSource('leaderboard', range, portfolio, authChecked); // préchargé : onglet par défaut + détail

  const values = useMemo(() => valuesFrom(overview.data), [overview.data]);
  const prevValues = useMemo(() => valuesFrom(previous.data), [previous.data]);
  const days = useMemo(() => daysFrom(overview.data), [overview.data]);

  const tabData = tabDef.source === 'overview' ? { ...overview.data, days } : (tabDef.source === 'leaderboard' ? leaderboardForPanel.data : tableSource.data);
  const tabLoading = tabDef.source === 'overview' ? overview.loading : (tabDef.source === 'leaderboard' ? leaderboardForPanel.loading : tableSource.loading);
  const tabError = tabDef.source === 'overview' ? overview.error : (tabDef.source === 'leaderboard' ? leaderboardForPanel.error : tableSource.error);
  const rows = useMemo(() => tabDef.rows(tabData), [tabDef, tabData]);
  const columns = useMemo(() => (typeof tabDef.columns === 'function' ? tabDef.columns(rows) : tabDef.columns), [tabDef, rows]);
  const reconciliation = tab === 'campaigns' ? tableSource.data?.reconciliation : null;
  const salesSummary = tab === 'sales' ? overview.data?.sales : null;
  // ?open=<nom de créa> : ouvre le détail dès que le leaderboard est là (liens profonds, contrôle visuel)
  useEffect(() => {
    const name = params.get('open');
    if (!name || panel || !leaderboardForPanel.data) return;
    const hit = (leaderboardForPanel.data.rows || []).find((r) => r.name === name);
    if (hit) setPanel(hit);
  }, [params, panel, leaderboardForPanel.data]);

  if (!authChecked) return null;
  const synced = overview.data?.synced_at;

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text, fontFamily: T.font }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '88px 24px 64px' }}>
        {/* ── en-tête ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', color: T.primary }}><Pict name="ads" size={22} /></span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: T.text }}>Meta Ads</h1>
          </div>
          {synced && <span style={{ fontSize: 12, color: T.textFaint }}>Dernière mise à jour {syncLabel(synced)}</span>}
        </div>

        <Filters T={T} periodKey={periodKey} range={range} onPeriod={onPeriod} portfolio={portfolio} onPortfolio={setPortfolio} />

        {/* ── métriques + courbe ── */}
        <section style={{ marginTop: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow }}>
          <div style={{ padding: 16 }}>
            <MetricTiles T={T} metrics={METRICS} values={values} previous={prevValues} selected={selected} onToggle={onToggle} />
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {overview.error ? <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.red, fontSize: 13 }}>{overview.error}</div>
              : overview.loading ? <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>Lecture de Meta…</div>
              : <TimeChart T={T} days={days} metrics={METRICS} selected={selected} />}
          </div>
        </section>

        {/* ── tableau par dimension ── */}
        <section style={{ marginTop: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
          <DimensionTabs T={T} tabs={TABS} value={tab} onChange={setTab} />
          {reconciliation && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '10px 16px', fontSize: 12.5, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, background: T.surfaceAlt }}>
              <span>Leads facturés par Meta <strong style={{ color: T.text }}>{fmtInt(reconciliation.meta_leads)}</strong></span>
              <span>Reçus au CRM <strong style={{ color: T.text }}>{fmtInt(reconciliation.received)}</strong>{reconciliation.recovery_rate != null && <span> ({Math.round(reconciliation.recovery_rate * 100)} %)</span>}</span>
              <span>Doublons écartés <strong style={{ color: T.text }}>{fmtInt(reconciliation.duplicates)}</strong></span>
              <span>Écart inexpliqué <strong style={{ color: reconciliation.unexplained > 0 ? T.red : T.green }}>{fmtInt(reconciliation.unexplained)}</strong></span>
              {reconciliation.fresh_day && <span style={{ color: T.textFaint }}>aujourd'hui inclus, chiffres Meta du jour incomplets</span>}
            </div>
          )}
          {salesSummary && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '10px 16px', fontSize: 12.5, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, background: T.surfaceAlt }}>
              <span><strong style={{ color: T.text }}>{fmtInt(salesSummary.total)}</strong> ventes déclarées, même total que le Suivi des ventes</span>
              <span>via une créa <strong style={{ color: T.text }}>{fmtInt(salesSummary.meta)}</strong></span>
              <span>webinaire <strong style={{ color: T.text }}>{fmtInt(salesSummary.webinaire)}</strong></span>
              <span>hors Meta <strong style={{ color: T.text }}>{fmtInt(salesSummary.hors_meta)}</strong></span>
              {salesSummary.sans_client > 0 && <span>sans client <strong style={{ color: T.red }}>{fmtInt(salesSummary.sans_client)}</strong></span>}
              <span>CA déclaré <strong style={{ color: T.text }}>{fmtEur(salesSummary.ca)}</strong>, rattaché aux créas <strong style={{ color: T.text }}>{fmtEur(salesSummary.ca_attributed)}</strong></span>
            </div>
          )}
          <DataTable key={tab} T={T} columns={columns} rows={rows} defaultSort={tabDef.defaultSort} rowKey={tabDef.rowKey}
            loading={tabLoading} error={tabError} onRowClick={tabDef.clickable ? (r) => setPanel(r) : undefined} />
        </section>
      </div>

      <AnimatePresence>
        {panel && <CreativePanel key={panel.name} row={panel} sales={overview.data?.sales} period={range} T={T} onClose={() => setPanel(null)} />}
      </AnimatePresence>
    </div>
  );
}
