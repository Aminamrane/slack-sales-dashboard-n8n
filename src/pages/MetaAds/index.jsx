// src/pages/MetaAds/index.jsx — Meta Ads Performance (page interne CRM).
//
// Lit l'endpoint additif `GET /api/v1/marketing/meta-ads` (api-owner) qui
// agrège les Insights Meta des 2 portefeuilles + croise le CRM
// (leads_realtime → match, clients → ventes/CA/ROAS).
//
// 100 % additif : nouvelle route + nouvelle page. Rien de l'existant touché.
// Rôles : admin / ceo / marketing / acquisition_director (mêmes que le backend).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, RefreshCw, Calendar, ChevronDown, Search, Layers,
  LayoutGrid, Megaphone, AlertCircle, Trophy,
} from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';
import Leaderboard from './Leaderboard.jsx';

const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director'];
const ACCENT = '#f0653e'; // coral, comme la réf

// ── theme (light / dark, palette CRM) ──────────────────────────────────────
function getTheme(dark) {
  return dark
    ? { pageBg:'#13141b', surface:'#1e1f28', surfaceAlt:'#181922', border:'#2a2b36',
        borderSoft:'#23242f', text:'#eef0f6', textMuted:'#8b8fa0', textFaint:'#6b6f7e',
        accent:ACCENT, accentBg:'rgba(240,101,62,0.14)', green:'#32d74b', amber:'#ff9f0a',
        red:'#ff453a', rowHover:'#23242f', shadow:'0 2px 8px rgba(0,0,0,0.3)' }
    : { pageBg:'#f6f7f9', surface:'#ffffff', surfaceAlt:'#f6f7fb', border:'#e7e9ef',
        borderSoft:'#f1f1ef', text:'#1e2330', textMuted:'#787880', textFaint:'#9b9aa2',
        accent:ACCENT, accentBg:'#fdeae4', green:'#0f9d58', amber:'#e09112',
        red:'#d23a2c', rowHover:'#fbf6f4', shadow:'0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)' };
}

// ── formatters (fr-FR) ─────────────────────────────────────────────────────
const nf = new Intl.NumberFormat('fr-FR');
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtInt = (n) => (n == null ? '—' : nf.format(Math.round(n)));
const fmtEur = (n) => (n == null ? '—' : eur.format(n));
const fmtPct = (n) => (n == null ? '—' : `${Number(n).toFixed(2)} %`);
const fmtRoas = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}x`);
function syncLabel(iso) {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  return `il y a ${Math.floor(mins / 60)} h`;
}

// ── date presets ───────────────────────────────────────────────────────────
function iso(d) { return d.toISOString().slice(0, 10); }
function presets() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const lastMonthStart = new Date(y, m - 1, 1);
  const lastMonthEnd = new Date(y, m, 0);
  const thisMonthStart = new Date(y, m, 1);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 89);
  const fmtFr = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    { key: 'last_month', short: 'Le mois dernier', since: iso(lastMonthStart), until: iso(lastMonthEnd),
      label: `Le mois dernier : ${fmtFr(lastMonthStart)} – ${fmtFr(lastMonthEnd)}` },
    { key: 'this_month', short: 'Ce mois-ci', since: iso(thisMonthStart), until: iso(now),
      label: `Ce mois-ci : ${fmtFr(thisMonthStart)} – ${fmtFr(now)}` },
    { key: 'd30', short: '30 derniers jours', since: iso(d30), until: iso(now),
      label: `30 derniers jours` },
    { key: 'd90', short: '90 derniers jours', since: iso(d90), until: iso(now),
      label: `90 derniers jours` },
    { key: 'max', short: 'Maximum', since: '2024-01-01', until: iso(now),
      label: `Maximum (depuis 2024)` },
  ];
}

const TABS = [
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'campaign', label: 'Campagnes', icon: Layers },
  { key: 'adset', label: 'Ensembles de pub', icon: LayoutGrid },
  { key: 'ad', label: 'Publicités', icon: Megaphone },
];

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

  const PRESETS = useMemo(() => presets(), []);
  const [period, setPeriod] = useState(PRESETS[0]);
  const [periodOpen, setPeriodOpen] = useState(false);
  // Onglet par défaut : le leaderboard (la vue "jugement des créas").
  const [level, setLevel] = useState('leaderboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // L'onglet Leaderboard fait son propre fetch (endpoint dédié) — le
    // tableau standard n'a rien à charger dans ce mode.
    if (level === 'leaderboard') { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const q = `?level=${level}&since=${period.since}&until=${period.until}`;
      const r = await apiClient.get(`/api/v1/marketing/meta-ads${q}`);
      setData(r);
    } catch (e) {
      setData(null);
      if (e?.status === 503) setError({ kind: 'config', msg: e?.data?.detail || 'Configuration Meta en attente (tokens .env).' });
      else setError({ kind: 'err', msg: e?.data?.detail || e?.message || 'Erreur de chargement' });
    } finally { setLoading(false); }
  }, [level, period]);

  useEffect(() => { if (authChecked) fetchData(); }, [authChecked, fetchData]);

  const rows = useMemo(() => {
    let r = data?.rows || [];
    if (statusFilter !== 'all') r = r.filter((x) => (x.status || 'active') === statusFilter);
    const s = search.trim().toLowerCase();
    if (s) r = r.filter((x) => (x.name || '').toLowerCase().includes(s));
    return r;
  }, [data, search, statusFilter]);

  if (!authChecked) return null;

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '92px 24px 64px' }}>
        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent }}>
                <TrendingUp size={19} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Meta Ads Performance</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, marginLeft: 45, fontSize: 12.5, color: T.textFaint }}>
              <span>Synchro {syncLabel(data?.synced_at)} · cache</span>
              <button onClick={fetchData} title="Rafraîchir"
                style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: T.textMuted, cursor: 'pointer', padding: 2 }}>
                <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }} style={{ display: 'flex' }}>
                  <RefreshCw size={13} />
                </motion.span>
              </button>
            </div>
          </div>

          {/* date range */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPeriodOpen((v) => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 12,
                border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: T.shadow }}>
              <Calendar size={15} style={{ color: T.textMuted }} /> {period.label}
              <ChevronDown size={15} style={{ color: T.textMuted }} />
            </button>
            <AnimatePresence>
              {periodOpen && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, minWidth: 240, padding: 6, borderRadius: 12,
                    background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  {PRESETS.map((p) => (
                    <button key={p.key} onClick={() => { setPeriod(p); setPeriodOpen(false); }}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '9px 11px', borderRadius: 8, border: 'none',
                        background: period.key === p.key ? T.accentBg : 'transparent', color: period.key === p.key ? T.accent : T.text,
                        fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                      {p.short}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── tabs ── */}
        <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${T.border}`, marginBottom: 18 }}>
          {TABS.map((t) => {
            const active = level === t.key;
            return (
              <button key={t.key} onClick={() => setLevel(t.key)}
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 2px 13px',
                  border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  color: active ? T.accent : T.textMuted }}>
                <t.icon size={16} /> {t.label}
                {active && <motion.span layoutId="metaTab" style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, background: T.accent }} />}
              </button>
            );
          })}
        </div>

        {level === 'leaderboard' ? (
          <Leaderboard T={T} period={period} />
        ) : (
        <>
        {/* ── card : toolbar + table ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
          {/* toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.borderSoft}`, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textFaint }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Rechercher ${level === 'campaign' ? 'une campagne' : level === 'adset' ? 'un adset' : 'une créa'}…`}
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, fontSize: 13.5, color: T.text,
                  background: T.surfaceAlt, border: `1px solid ${T.border}`, outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }} />
            <SegFilter T={T} value={statusFilter} onChange={setStatusFilter} />
            <span style={{ fontSize: 13, color: T.textFaint, fontWeight: 600 }}>{rows.length} {level === 'campaign' ? 'campagnes' : level === 'adset' ? 'adsets' : 'publicités'}</span>
          </div>

          {/* states */}
          {loading && <Centered T={T}>Chargement…</Centered>}
          {!loading && error?.kind === 'config' && (
            <Centered T={T}>
              <AlertCircle size={26} style={{ color: T.amber, marginBottom: 10 }} />
              <div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div>
              <div style={{ marginTop: 4, fontSize: 13, color: T.textMuted, maxWidth: 420 }}>
                Les tokens Meta ne sont pas encore dans le `.env` du serveur. Dès qu'ils sont ajoutés, les données s'affichent ici.
              </div>
            </Centered>
          )}
          {!loading && error?.kind === 'err' && (
            <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>
          )}
          {!loading && !error && rows.length === 0 && <Centered T={T}>Aucune donnée sur cette période.</Centered>}

          {/* table */}
          {!loading && !error && rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                <thead>
                  <tr>
                    {['NOM','IMPRESSIONS','PORTÉE','CLICS','CTR','CPC','CPM','LEADS','CPL','VENTES','MATCH','CA','ROAS'].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '11px 16px', fontSize: 10.5, fontWeight: 700,
                        letterSpacing: '0.06em', color: T.textFaint, whiteSpace: 'nowrap', position: i === 0 ? 'sticky' : 'static', left: 0,
                        background: T.surface }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => <Row key={(r.name || '') + idx} T={T} r={r} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* totals */}
        {data?.totals && !loading && !error && (
          <div style={{ marginTop: 16, display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13, color: T.textMuted }}>
            <span>Dépense : <b style={{ color: T.text }}>{fmtEur(data.totals.spend)}</b></span>
            <span>Leads : <b style={{ color: T.text }}>{fmtInt(data.totals.leads)}</b></span>
            <span>CPL moyen : <b style={{ color: T.text }}>{fmtEur(data.totals.cpl)}</b></span>
            <span>Ventes : <b style={{ color: T.green }}>{fmtInt(data.totals.ventes)}</b></span>
            <span>CA : <b style={{ color: T.text }}>{fmtEur(data.totals.ca)}</b></span>
            <span>ROAS : <b style={{ color: (data.totals.roas || 0) >= 1 ? T.green : T.red }}>{fmtRoas(data.totals.roas)}</b></span>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function Row({ T, r }) {
  const [hover, setHover] = useState(false);
  const active = (r.status || 'active') === 'active';
  const roas = r.roas;
  const roasColor = roas == null ? T.textFaint : roas >= 1 ? T.green : T.red;
  const td = { padding: '12px 16px', fontSize: 13.5, textAlign: 'right', color: T.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? T.rowHover : 'transparent', borderTop: `1px solid ${T.borderSoft}`, transition: 'background 0.12s' }}>
      <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0, background: hover ? T.rowHover : T.surface, transition: 'background 0.12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 280 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: T.surfaceAlt, border: `1px solid ${T.border}`, flexShrink: 0 }} />
          <span style={{ width: 7, height: 7, borderRadius: 99, background: active ? T.green : T.textFaint, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '—'}</span>
        </div>
      </td>
      <td style={td}>{fmtInt(r.impressions)}</td>
      <td style={td}>{fmtInt(r.reach)}</td>
      <td style={td}>{fmtInt(r.clicks)}</td>
      <td style={td}>{fmtPct(r.ctr)}</td>
      <td style={td}>{fmtEur(r.cpc)}</td>
      <td style={td}>{fmtEur(r.cpm)}</td>
      <td style={{ ...td, fontWeight: 700 }}>{fmtInt(r.leads)}</td>
      <td style={{ ...td, fontWeight: 700 }}>{fmtEur(r.cpl)}</td>
      <td style={{ ...td, color: r.ventes ? T.green : T.textFaint, fontWeight: 700 }}>{fmtInt(r.ventes)}</td>
      <td style={{ ...td, color: r.match ? T.amber : T.textFaint, fontWeight: 600 }}>{fmtInt(r.match)}</td>
      <td style={td}>{fmtEur(r.ca)}</td>
      <td style={{ ...td, color: roasColor, fontWeight: 700 }}>{fmtRoas(roas)}</td>
    </tr>
  );
}

function SegFilter({ T, value, onChange }) {
  const opts = [{ k: 'all', l: 'Toutes' }, { k: 'active', l: 'Actives', dot: T.green }, { k: 'inactive', l: 'Inactives', dot: T.amber }];
  return (
    <div style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
      {opts.map((o) => {
        const on = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none',
              background: on ? T.surface : 'transparent', color: on ? T.text : T.textMuted, boxShadow: on ? T.shadow : 'none',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {o.dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: o.dot }} />}
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function Centered({ T, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '56px 20px', color: T.textMuted, fontSize: 14 }}>
      {children}
    </div>
  );
}
