import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { motion } from 'framer-motion';
import apiClient from '../../services/apiClient';
import SharedNavbar from '../../components/SharedNavbar.jsx';
// Réutilise le design system de la page Marketing (cohérence + DRY).
// L'import de theme injecte aussi les keyframes mkt* globales.
import { buildTheme, fmtInt } from '../Marketing/theme';
import Card from '../Marketing/components/Card';

const ALLOWED_ROLES = ['admin', 'ceo', 'acquisition_director'];

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const FIRST = { y: 2026, m: 4 }; // antériorité à partir d'avril 2026

const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  const name = MONTH_NAMES[parseInt(m, 10) - 1] || '';
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
};

const availableMonths = () => {
  const now = new Date();
  const end = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const out = [];
  let y = FIRST.y;
  let m = FIRST.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    out.push(y + '-' + String(m).padStart(2, '0'));
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

const HERO_GRADIENT = 'linear-gradient(135deg, #9b8dff 0%, #6c5ce7 65%, #5239d6 100%)';

export default function FunnelLeads() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  const C = useMemo(() => buildTheme(darkMode), [darkMode]);

  // Mode embarqué (rendu dans le shell CEO / Acquisition Director via
  // ?embed=true) : on masque la SharedNavbar interne + on réduit le padding.
  const embedMode = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('embed') === 'true'; } catch { return false; }
  }, []);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user) { navigate('/login'); return; }
    if (!ALLOWED_ROLES.includes(user.role)) { navigate('/'); return; }
    setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });
    setAuthReady(true);
  }, [navigate]);

  const months = useMemo(availableMonths, []);
  const [month, setMonth] = useState(() => {
    const all = availableMonths();
    return all[all.length - 1];
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient.get('/api/v1/stats/leads-funnel?month=' + month)
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'Erreur de chargement'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [authReady, month]);

  const isCurrentMonth = month === months[months.length - 1];

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.backdrop, color: C.muted, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
        Chargement…
      </div>
    );
  }

  const f = data?.funnel || {};
  const s = data?.signatures || {};

  // Entonnoir : étapes ordonnées, largeur de barre = part des "reçus".
  const recus = f.recus || 0;
  const pctOf = (n) => (recus > 0 ? Math.round((n / recus) * 1000) / 10 : 0);
  const STAGES = [
    { key: 'recus', label: 'Leads reçus', color: '#8b5cf6' },
    { key: 'sans', label: 'Sans (1‑2 / <100k€)', color: '#7c6cf0' },
    { key: 'clean_tel_fr', label: 'Clean (tél FR)', color: '#6c7ce0' },
    { key: 'repondu', label: 'Répondu', color: '#3b82f6' },
    { key: 'r1_place', label: 'R1 placé', color: '#0ea5e9' },
    { key: 'r1_effectue', label: 'R1 effectué', color: '#10b981' },
    { key: 'r2_place', label: 'R2 placé', color: '#0e9468' },
    { key: 'r2_effectue', label: 'R2 effectué', color: '#0e8f5c' },
  ];

  const Skel = ({ w = 80, h = 26 }) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: C.subtle, animation: 'mktPulse 1.4s ease-in-out infinite' }} />
  );

  // Tuile KPI compacte.
  const Kpi = ({ label, value, hint, tone }) => (
    <div style={{ flex: 1, minWidth: 150, background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: 14, padding: '14px 16px', boxShadow: C.shadow }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faded, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: tone || C.text, marginTop: 4 }}>
        {loading ? <Skel /> : value}
      </div>
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.backdrop, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: C.text }}>
      {!embedMode && <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ maxWidth: 1280, margin: '0 auto', padding: embedMode ? '24px 32px 64px' : '92px 32px 64px' }}
      >
        {/* ── HEADER : titre + sélecteur de mois ── */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: C.text }}>Funnel Leads</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
              Entonnoir mensuel des leads (reçus → signés). Recalcul live — les mois récents continuent de mûrir.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {months.map((m) => {
              const active = m === month;
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  style={{
                    padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    fontFamily: 'inherit', transition: 'all 0.15s',
                    border: `1px solid ${active ? C.accent : C.border}`,
                    background: active ? C.accent : C.surface,
                    color: active ? '#fff' : C.muted,
                  }}
                >
                  {monthLabel(m)}{m === months[months.length - 1] ? ' (en cours)' : ''}
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#c0264a', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── HERO ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative', overflow: 'hidden', background: HERO_GRADIENT, borderRadius: 20, padding: '28px 32px', marginBottom: 20, color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center' }}
        >
          <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>{monthLabel(month)}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', margin: '2px 0 6px' }}>Leads reçus</div>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, animation: 'mktNumberTick 0.5s ease both' }}>
              {loading ? '—' : fmtInt(f.recus)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            {[
              { label: 'Total signatures', value: loading ? '—' : fmtInt(s.total) },
              { label: 'Part leads du mois', value: loading ? '—' : (s.part_mois_pct != null ? s.part_mois_pct + ' %' : '—') },
              { label: 'Signés (leads du mois)', value: loading ? '—' : fmtInt(s.part_mois_n) },
            ].map((p) => (
              <div key={p.label} style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '14px 18px', minWidth: 130 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase' }}>{p.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{p.value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── GRID : entonnoir (gauche) + cartes (droite) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>

          {/* ENTONNOIR */}
          <Card title="Entonnoir des leads traitables" subtitle="Largeur = part des leads reçus" C={C}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STAGES.map((st, i) => {
                const n = f[st.key] || 0;
                const pct = pctOf(n);
                return (
                  <div key={st.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{st.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '—' : fmtInt(n)}
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.faded, marginLeft: 6 }}>{loading ? '' : pct + '%'}</span>
                      </span>
                    </div>
                    <div style={{ height: 12, borderRadius: 6, background: C.subtle, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: loading ? '0%' : Math.max(pct, 1.5) + '%' }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${st.color}, ${st.color}cc)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* CARTES DROITE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card title="Disqualifiés" C={C}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Kpi label="1‑2 OU <100k€" value={loading ? '—' : fmtInt(f.segment_1_2_100k)} tone="#b45309" />
                <Kpi label="Non pertinent" value={loading ? '—' : fmtInt(f.non_pertinent)} tone="#c0264a" />
              </div>
            </Card>

            <Card title="Signatures du mois" C={C}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Kpi label="Total" value={loading ? '—' : fmtInt(s.total)} tone="#10b981" />
                  <Kpi label="Part leads mois" value={loading ? '—' : (s.part_mois_pct != null ? s.part_mois_pct + ' %' : '—')} hint={loading ? '' : fmtInt(s.part_mois_n) + ' signés'} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Kpi label="Signatures CC" value={loading ? '—' : fmtInt(s.cc)} />
                  <Kpi label="Mois précédents" value={loading ? '—' : fmtInt(s.mois_precedents)} hint="leads reçus avant ce mois" />
                </div>
                {!loading && s.non_resolus > 0 && (
                  <div style={{ fontSize: 11, color: C.faded }}>{s.non_resolus} signature(s) non rattachée(s) à un mois de réception (email non retrouvé).</div>
                )}
              </div>
            </Card>

            {isCurrentMonth && !loading && (
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, padding: '0 4px' }}>
                ⓘ Mois en cours : les chiffres se remplissent au fil du mois et continueront de mûrir (R1/R2/signés) après sa fin.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
