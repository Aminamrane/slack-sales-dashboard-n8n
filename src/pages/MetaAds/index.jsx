// src/pages/MetaAds/index.jsx — Meta Ads (page interne CRM).
//
// Trois onglets qui suivent les questions de celui qui ouvre la page :
//   « Vue d'ensemble » : est-ce que l'acquisition est rentable sur la période ?
//   « Créas »          : qu'est-ce qui vend, qu'est-ce qui brûle du budget ?
//   « Campagnes »      : où part l'argent (campagnes, ensembles, publicités) ?
// Les ventes sont celles du Suivi des ventes (déclarations de la période),
// rattachées à la créa d'origine du lead de chaque client. Charte Owner.
// Rôles : admin / ceo / marketing / acquisition_director / head_of_acquisition.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';
import Overview from './overview/Overview.jsx';
import Creatives from './Creatives.jsx';
import Structure from './Structure.jsx';
import Pict from './icons.jsx';
import { getTheme } from './theme.js';

const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director', 'head_of_acquisition'];

// ── périodes ───────────────────────────────────────────────────────────────
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
  // Le mois en cours d'abord : c'est la période par défaut de la page.
  return [
    { key: 'this_month', short: 'Ce mois-ci', since: iso(thisMonthStart), until: iso(now), label: `Ce mois-ci : ${fmtFr(thisMonthStart)} au ${fmtFr(now)}` },
    { key: 'last_month', short: 'Le mois dernier', since: iso(lastMonthStart), until: iso(lastMonthEnd), label: `Le mois dernier : ${fmtFr(lastMonthStart)} au ${fmtFr(lastMonthEnd)}` },
    { key: 'd30', short: '30 derniers jours', since: iso(d30), until: iso(now), label: '30 derniers jours' },
    { key: 'd90', short: '90 derniers jours', since: iso(d90), until: iso(now), label: '90 derniers jours' },
    { key: 'max', short: 'Depuis 2024', since: '2024-01-01', until: iso(now), label: 'Tout, depuis 2024' },
  ];
}

const TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: 'overview', hint: 'Est-ce rentable ?' },
  { key: 'creatives', label: 'Créas', icon: 'creatives', hint: 'Qu\'est-ce qui vend ?' },
  { key: 'structure', label: 'Campagnes', icon: 'structure', hint: 'Où part l\'argent ?' },
];
const PORTFOLIOS = [['all', 'Les deux portefeuilles'], ['owner_technology', 'Owner Technology'], ['portefeuille2', 'Portefeuille 2']];

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
  const [tab, setTab] = useState('overview');
  const [portfolio, setPortfolio] = useState('all');

  if (!authChecked) return null;

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '92px 24px 64px' }}>
        {/* ── en-tête ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.navy, color: '#8fd1ad' }}>
              <Pict name="ads" size={21} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em', margin: 0, color: T.text }}>Meta Ads</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {tab === 'overview' && (
              <div style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                {PORTFOLIOS.map(([k, l]) => {
                  const on = portfolio === k;
                  return (
                    <button key={k} onClick={() => setPortfolio(k)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                        background: on ? T.accentBg : 'transparent', color: on ? T.accent : T.textMuted, fontSize: 12.5, fontWeight: 650 }}>
                      {k === 'all' && <Pict name="portfolio" size={13} />}{l}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setPeriodOpen((v) => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13.5, fontWeight: 650, cursor: 'pointer', boxShadow: T.shadow }}>
                <Pict name="calendar" size={15} color={T.textMuted} /> {period.label}
                <Pict name="back" size={14} color={T.textMuted} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <AnimatePresence>
                {periodOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, minWidth: 240, padding: 6, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                    {PRESETS.map((p) => (
                      <button key={p.key} onClick={() => { setPeriod(p); setPeriodOpen(false); }}
                        style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '9px 11px', borderRadius: 8, border: 'none', background: period.key === p.key ? T.accentBg : 'transparent', color: period.key === p.key ? T.accent : T.text, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                        {p.short}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── onglets ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22, padding: 4, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#eef1f8' : T.textMuted, whiteSpace: 'nowrap' }}>
                {active && <motion.span layoutId="metaTab" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'absolute', inset: 0, borderRadius: 10, background: T.navy }} />}
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Pict name={t.icon} size={16} color={active ? '#8fd1ad' : T.textFaint} />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {tab === 'overview' && <Overview T={T} period={period} portfolio={portfolio} />}
        {tab === 'creatives' && <Creatives T={T} period={period} />}
        {tab === 'structure' && <Structure T={T} period={period} />}
      </div>
    </div>
  );
}
