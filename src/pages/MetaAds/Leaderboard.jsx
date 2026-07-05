// src/pages/MetaAds/Leaderboard.jsx — Leaderboard des créas (onglet de /meta-ads).
//
// Lit `GET /api/v1/marketing/meta-ads/leaderboard?since&until` (api-owner) :
// funnel CRM complet par créa (leads → R1 posés/faits → R2 → ventes/CA),
// score composite 0-100 (pondérations "senior marketing", lissage bayésien
// vers les taux globaux de la fenêtre) et recommandation par créa.
//
// Les "variantes" sont des SUGGESTIONS textuelles générées par heuristiques
// côté backend — rien n'est créé ni modifié sur Meta.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Lightbulb, Info, AlertCircle, ChevronDown } from 'lucide-react';
import apiClient from '../../services/apiClient.js';

const nf = new Intl.NumberFormat('fr-FR');
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtInt = (n) => (n == null ? '—' : nf.format(Math.round(n)));
const fmtEur = (n) => (n == null ? '—' : eur.format(n));
const fmtPct01 = (n) => (n == null ? '—' : `${(Number(n) * 100).toFixed(1)} %`);
const fmtRoas = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}x`);

// Couleur du score : rouge < 35, ambre < 55, vert ensuite (échelle stable,
// indépendante du thème pour rester lisible dans les deux modes).
function scoreColor(score, T) {
  if (score == null) return T.textFaint;
  if (score < 35) return T.red;
  if (score < 55) return T.amber;
  return T.green;
}

const RECO_COLORS = {
  decliner: (T) => ({ bg: `${T.green}22`, fg: T.green }),
  hook: (T) => ({ bg: `${T.amber}22`, fg: T.amber }),
  qualif: (T) => ({ bg: `${T.amber}22`, fg: T.amber }),
  noshow: (T) => ({ bg: `${T.amber}22`, fg: T.amber }),
  couper: (T) => ({ bg: `${T.red}22`, fg: T.red }),
  observer: (T) => ({ bg: 'transparent', fg: undefined }),
  garder: (T) => ({ bg: 'transparent', fg: undefined }),
};

function RecoBadge({ reco, T }) {
  if (!reco) return null;
  const c = (RECO_COLORS[reco.key] || RECO_COLORS.garder)(T);
  return (
    <span
      title={reco.detail}
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
        fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'help',
        background: c.bg || T.surfaceAlt, color: c.fg || T.textMuted,
        border: `1px solid ${c.fg ? `${c.fg}44` : T.border}`,
      }}
    >
      {reco.label}
    </span>
  );
}

function ConfDots({ confidence, T }) {
  const n = confidence === 'haute' ? 3 : confidence === 'moyenne' ? 2 : 1;
  return (
    <span title={`Confiance ${confidence} (volume de leads)`} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: i <= n ? T.accent : T.border }} />
      ))}
    </span>
  );
}

function ScoreBar({ score, T, delay = 0 }) {
  const color = scoreColor(score, T);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 130 }}>
      <span style={{ fontSize: 14.5, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', width: 38, textAlign: 'right' }}>
        {score == null ? '—' : score.toFixed(0)}
      </span>
      <div style={{ flex: 1, height: 5, borderRadius: 99, background: T.surfaceAlt, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }}
          transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', borderRadius: 99, background: color }}
        />
      </div>
    </div>
  );
}

// ── Podium top 3 ────────────────────────────────────────────────────────────
function Podium({ rows, T }) {
  const top = rows.slice(0, 3);
  const medals = ['#f5c04a', '#c0c6d4', '#cd9468']; // or / argent / bronze
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 18 }}>
      {top.map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'relative', padding: '18px 18px 16px', borderRadius: 16,
            background: T.surface, border: `1px solid ${i === 0 ? `${medals[0]}66` : T.border}`,
            boxShadow: T.shadow, overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${medals[i]}26`, color: medals[i], fontWeight: 800, fontSize: 14,
            }}>
              {i + 1}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                {r.name}
              </div>
              <div style={{ fontSize: 11.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.campaign_name || '—'}
              </div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: r.status === 'active' ? T.green : T.textFaint }}
              title={r.status === 'active' ? 'Active' : 'Inactive'} />
          </div>

          <ScoreBar score={r.score} T={T} delay={0.15 + 0.06 * i} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              ['CPL', fmtEur(r.cpl)],
              ['R1 faits', fmtInt(r.r1_fait)],
              ['Ventes', fmtInt(r.ventes)],
              ['ROAS', fmtRoas(r.roas)],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: T.textFaint, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RecoBadge reco={r.reco} T={T} />
            <ConfDots confidence={r.confidence} T={T} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Panneau "Suggestions de variantes" ──────────────────────────────────────
function VariantSuggestions({ rows, T }) {
  const [open, setOpen] = useState(true);
  const candidates = rows.filter((r) => r.reco?.key === 'decliner' && r.reco.suggestions?.length);
  if (!candidates.length) return null;
  return (
    <div style={{ marginTop: 18, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '15px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent }}>
          <Lightbulb size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>
            Variantes recommandées <span style={{ color: T.textMuted, fontWeight: 600 }}>· {candidates.length} créa{candidates.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textFaint }}>
            Suggestions générées par heuristiques — aucune variante n'est créée automatiquement.
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', color: T.textMuted }}>
          <ChevronDown size={17} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 18px 18px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              {candidates.map((r) => (
                <div key={r.name} style={{ padding: 14, borderRadius: 12, background: T.surfaceAlt, border: `1px solid ${T.borderSoft}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.accent }}>#{r.rank}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 6 }}>
                    {r.reco.suggestions.map((s, i) => (
                      <li key={i} style={{ fontSize: 12.5, lineHeight: 1.45, color: T.textMuted }}>{s}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function Leaderboard({ T, period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = `?since=${period.since}&until=${period.until}`;
      const r = await apiClient.get(`/api/v1/marketing/meta-ads/leaderboard${q}`);
      setData(r);
    } catch (e) {
      setData(null);
      if (e?.status === 503) setError({ kind: 'config', msg: e?.data?.detail || 'Configuration Meta en attente (tokens .env).' });
      else setError({ kind: 'err', msg: e?.data?.detail || e?.message || 'Erreur de chargement' });
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const td = { padding: '11px 14px', fontSize: 13, textAlign: 'right', color: T.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

  if (loading) {
    return <Centered T={T}>Calcul du leaderboard…</Centered>;
  }
  if (error?.kind === 'config') {
    return (
      <Centered T={T}>
        <AlertCircle size={26} style={{ color: T.amber, marginBottom: 10 }} />
        <div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div>
        <div style={{ marginTop: 4, fontSize: 13, color: T.textMuted, maxWidth: 420 }}>{error.msg}</div>
      </Centered>
    );
  }
  if (error) {
    return <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>;
  }
  if (!rows.length) {
    return <Centered T={T}>Aucune créa sur cette période.</Centered>;
  }

  return (
    <div>
      <Podium rows={rows} T={T} />

      {/* Table complète */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${T.borderSoft}` }}>
          <Trophy size={15} style={{ color: T.accent }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Classement complet</span>
          <span style={{ fontSize: 12.5, color: T.textFaint, fontWeight: 600 }}>{rows.length} créas</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
            <thead>
              <tr>
                {['#', 'CRÉA', 'SCORE', 'SPEND', 'LEADS', 'CPL', 'R1 POSÉS', 'R1 FAITS', 'CPR1', 'R2 FAITS', 'VENTES', 'CAC', 'ROAS', 'RECOMMANDATION'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i <= 1 ? 'left' : i === 2 ? 'left' : 'right', padding: '10px 14px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.06em', color: T.textFaint, whiteSpace: 'nowrap',
                    position: i === 1 ? 'sticky' : 'static', left: 0, background: T.surface,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <LeaderRow key={r.name} r={r} T={T} td={td} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <VariantSuggestions rows={rows} T={T} />

      {/* Méthodologie */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '0 4px', color: T.textFaint, fontSize: 12 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1.5 }} />
        <span>
          Score composite 0-100 : 25 % coût (CPL vs médiane) · 30 % lead → R1 tenu · 15 % R1 → R2 · 20 % close (ventes/lead) · 10 % volume.
          Les taux sont lissés vers la moyenne de la période (bayésien) pour ne pas surclasser les créas à faible volume — la confiance (points) reflète le volume.
          R1/R2 et ventes proviennent du CRM (leads_realtime / clients), rattachés par nom de créa.
        </span>
      </div>
    </div>
  );
}

function LeaderRow({ r, T, td }) {
  const [hover, setHover] = useState(false);
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? T.rowHover : 'transparent', borderTop: `1px solid ${T.borderSoft}`, transition: 'background 0.12s' }}>
      <td style={{ ...td, textAlign: 'left', fontWeight: 800, color: r.rank <= 3 ? T.accent : T.textMuted, width: 34 }}>{r.rank}</td>
      <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0, background: hover ? T.rowHover : T.surface, transition: 'background 0.12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, maxWidth: 280 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: r.status === 'active' ? T.green : T.textFaint, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
            <div style={{ fontSize: 11, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign_name || ''}</div>
          </div>
        </div>
      </td>
      <td style={{ ...td, textAlign: 'left', minWidth: 150 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScoreBar score={r.score} T={T} />
          <ConfDots confidence={r.confidence} T={T} />
        </div>
      </td>
      <td style={td}>{fmtEur(r.spend)}</td>
      <td style={td} title={`Meta : ${fmtInt(r.leads_meta)} · CRM : ${fmtInt(r.crm_leads)}`}>{fmtInt(Math.max(r.leads_meta, r.crm_leads))}</td>
      <td style={td}>{fmtEur(r.cpl)}</td>
      <td style={td}>{fmtInt(r.r1_pose)}</td>
      <td style={{ ...td, fontWeight: 700 }} title={`Taux lead → R1 tenu (lissé) : ${fmtPct01(r.rates?.lead_to_r1)}`}>{fmtInt(r.r1_fait)}</td>
      <td style={td}>{fmtEur(r.cpr1)}</td>
      <td style={{ ...td, fontWeight: 700 }} title={`Taux R1 → R2 (lissé) : ${fmtPct01(r.rates?.r1_to_r2)}`}>{fmtInt(r.r2_fait)}</td>
      <td style={{ ...td, color: r.ventes ? T.green : T.textFaint, fontWeight: 700 }}>{fmtInt(r.ventes)}</td>
      <td style={td}>{fmtEur(r.cac)}</td>
      <td style={{ ...td, color: r.roas == null ? T.textFaint : r.roas >= 1 ? T.green : T.red, fontWeight: 700 }}>{fmtRoas(r.roas)}</td>
      <td style={{ ...td, textAlign: 'left' }}><RecoBadge reco={r.reco} T={T} /></td>
    </tr>
  );
}

function Centered({ T, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '56px 20px', color: T.textMuted, fontSize: 14 }}>
      {children}
    </div>
  );
}
