import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- motion + AnimatePresence utilisés via JSX (faux positif)
import { motion, AnimatePresence } from 'framer-motion';
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

  // ── Sélecteur de mois (dropdown custom, scale-first) ──────────────────────
  // Ancré en haut à droite, groupé par année (au-delà d'une année), clavier
  // complet (flèches / Home / End / Enter / Échap). Aucune dépendance externe.
  const monthSelectRef = useRef(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const currentMonth = months[months.length - 1];

  // Options affichées : du mois le + récent au + ancien. En-têtes d'année
  // uniquement si plusieurs années sont présentes (évite un « 2026 » solitaire).
  const monthOptions = useMemo(() => {
    const ordered = [...months].reverse();
    const multiYear = new Set(ordered.map((m) => m.slice(0, 4))).size > 1;
    const out = [];
    let lastYear = null;
    ordered.forEach((m) => {
      const year = m.slice(0, 4);
      if (multiYear && year !== lastYear) { out.push({ type: 'year', year }); lastYear = year; }
      out.push({ type: 'month', m });
    });
    return out;
  }, [months]);

  // Liste plate des mois sélectionnables (navigation clavier).
  const selectableMonths = useMemo(
    () => monthOptions.filter((o) => o.type === 'month').map((o) => o.m),
    [monthOptions],
  );
  const [activeIdx, setActiveIdx] = useState(0);

  // À l'ouverture, place le surlignage clavier sur le mois sélectionné.
  useEffect(() => {
    if (!monthOpen) return;
    const i = selectableMonths.indexOf(month);
    setActiveIdx(i < 0 ? 0 : i);
  }, [monthOpen, month, selectableMonths]);

  // Click-outside + clavier (flèches / Home / End / Enter / Échap).
  useEffect(() => {
    if (!monthOpen) return;
    const onDown = (e) => {
      if (monthSelectRef.current && !monthSelectRef.current.contains(e.target)) {
        setMonthOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMonthOpen(false);
        monthSelectRef.current?.querySelector('[data-month-trigger]')?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, selectableMonths.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIdx(selectableMonths.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const picked = selectableMonths[activeIdx];
        if (picked) { setMonth(picked); setMonthOpen(false); }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [monthOpen, selectableMonths, activeIdx]);

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
          </div>
          <div ref={monthSelectRef} style={{ position: 'relative' }}>
            {/* Scrollbar fine, thématisée (webkit). Une seule injection. */}
            <style>{`
              .funnel-month-scroll::-webkit-scrollbar { width: 8px; }
              .funnel-month-scroll::-webkit-scrollbar-track { background: transparent; }
              .funnel-month-scroll::-webkit-scrollbar-thumb {
                background: ${C.border}; border-radius: 8px;
                border: 2px solid transparent; background-clip: padding-box;
              }
              .funnel-month-scroll::-webkit-scrollbar-thumb:hover {
                background: ${C.muted}; background-clip: padding-box;
              }
            `}</style>

            {/* Déclencheur */}
            <button
              type="button"
              data-month-trigger
              onClick={() => setMonthOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={monthOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px 8px 14px', borderRadius: 11, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${monthOpen ? C.accent : C.border}`,
                background: C.surface, color: C.text,
                boxShadow: monthOpen ? C.shadowFloat : C.shadow,
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <span>{monthLabel(month)}</span>
              {month === currentMonth && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                  padding: '2px 7px', borderRadius: 999, lineHeight: 1.4,
                  background: C.accent, color: '#fff',
                }}>
                  en cours
                </span>
              )}
              <motion.svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                animate={{ rotate: monthOpen ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{ color: C.muted, flexShrink: 0 }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </button>

            {/* Panneau */}
            <AnimatePresence>
              {monthOpen && (
                <motion.ul
                  role="listbox"
                  aria-label="Sélection du mois"
                  tabIndex={-1}
                  className="funnel-month-scroll"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
                    transformOrigin: 'top right',
                    minWidth: 220, maxHeight: 300, overflowY: 'auto', overflowX: 'hidden',
                    margin: 0, padding: 6, listStyle: 'none',
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 14, boxShadow: C.shadowFloat,
                  }}
                >
                  {monthOptions.map((opt) => {
                    if (opt.type === 'year') {
                      return (
                        <li
                          key={`year-${opt.year}`}
                          aria-hidden="true"
                          style={{
                            position: 'sticky', top: -6, zIndex: 1,
                            padding: '8px 12px 4px', margin: '2px 0',
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: C.faded,
                            background: C.surface,
                          }}
                        >
                          {opt.year}
                        </li>
                      );
                    }
                    const m = opt.m;
                    const selected = m === month;
                    const idx = selectableMonths.indexOf(m);
                    const active = idx === activeIdx;
                    const current = m === currentMonth;
                    return (
                      <li key={m} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => { setMonth(m); setMonthOpen(false); }}
                          onMouseEnter={() => setActiveIdx(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                            width: '100%', textAlign: 'left',
                            padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: selected ? 700 : 500, fontFamily: 'inherit',
                            background: selected ? C.accent : active ? C.subtle : 'transparent',
                            color: selected ? '#fff' : C.text,
                            transition: 'background 0.12s, color 0.12s',
                          }}
                        >
                          <span>{monthLabel(m)}</span>
                          {current && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                              padding: '2px 7px', borderRadius: 999, lineHeight: 1.4,
                              background: selected ? 'rgba(255,255,255,0.22)' : C.subtle,
                              color: selected ? '#fff' : C.muted,
                              border: selected ? 'none' : `1px solid ${C.hairline}`,
                            }}>
                              en cours
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
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
